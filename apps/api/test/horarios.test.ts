import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, atajosHorario, type PatronTurno, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import type { TurnoProgramado } from '../src/modules/asistencia/vigilancia';
import { createHorariosModule } from '../src/modules/horarios';
import { InformesRepository } from '../src/modules/informes/informes.repository';
import type { Alcance } from '../src/modules/sitios/alcance';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const diario = (desde: string, hasta: string | null = null): PatronTurno => ({
  tipo: 'fija',
  horas: 12,
  dias: { tipo: 'diario' },
  horaInicio: '08:00',
  horaFin: null,
  desde,
  hasta,
});
/** Juan trabaja de lunes a viernes; Ana, diario, y el 21 cubre otro sitio. */
const semanal: PatronTurno = { ...diario('2026-10-01'), dias: { tipo: 'semanal', semana: [1, 2, 3, 4, 5] } };
const TURNOS: TurnoProgramado[] = [
  { asignacionId: 1, sitio: { id: 1, nombre: 'POETAS' }, guardia: { id: 10, nombre: 'Juan Pérez' }, patron: semanal },
  {
    asignacionId: 2,
    sitio: { id: 2, nombre: 'Plaza Norte' },
    guardia: { id: 11, nombre: 'Ana Ruiz' },
    patron: diario('2026-10-01'),
    pausas: [{ desde: '2026-10-21', hasta: '2026-10-21' }],
  },
  {
    asignacionId: null,
    coberturaId: 7,
    sitio: { id: 1, nombre: 'POETAS' },
    guardia: { id: 11, nombre: 'Ana Ruiz' },
    patron: diario('2026-10-21', '2026-10-21'),
  },
];

class MemoriaInformes extends InformesRepository {
  personas = [
    { id: 10, nombre: 'Juan Pérez', email: 'j@x.mx' },
    { id: 11, nombre: 'Ana Ruiz', email: 'a@x.mx' },
    { id: 12, nombre: 'Sin Turnos', email: 's@x.mx' },
  ];
  async guardias(ids: number[] | null) {
    return this.personas.filter((p) => !ids || ids.includes(p.id));
  }
  async guardia(id: number) {
    return this.personas.find((p) => p.id === id) ?? null;
  }
  async sitios(ids: number[] | null) {
    return [
      { id: 1, nombre: 'POETAS' },
      { id: 2, nombre: 'Plaza Norte' },
    ].filter((s) => !ids || ids.includes(s.id));
  }
  async turnos() {
    return TURNOS;
  }
  async marcas() {
    return [];
  }
  async eventos() {
    return [];
  }
  async supervisores() {
    return new Map<number, string>();
  }
  async buscarPorHuella() {
    return null;
  }
  async ultimoDelAlcance() {
    return null;
  }
  async crear(): Promise<never> {
    throw new Error('no se usa');
  }
  async listar() {
    return { items: [], total: 0 };
  }
  async findById() {
    return null;
  }
  async findByFolio() {
    return null;
  }
}

let app: ReturnType<typeof createApp>;
let audit: MemoryAuditLogger;
let alcance: Alcance | null;

const token = (id: number, rol: Rol) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol] })}`;
const pdf = (query: string, rol: Rol = ROLES.ADMIN, id = 1) =>
  request(app)
    .get(`/api/horarios/pdf?${query}`)
    .set('Authorization', token(id, rol))
    .buffer(true)
    .parse((res, cb) => {
      const trozos: Buffer[] = [];
      res.on('data', (t: Buffer) => trozos.push(t));
      res.on('end', () => cb(null, Buffer.concat(trozos)));
    });

beforeEach(() => {
  audit = new MemoryAuditLogger();
  alcance = null;
  app = createApp([
    createHorariosModule({
      repo: new MemoriaInformes(),
      audit,
      alcance: async () => alcance,
      ahora: () => new Date('2026-10-24T00:00:00.000Z'),
    }),
  ]);
});

describe('horario de guardias en PDF (A-55)', () => {
  it('admin y supervisor lo descargan; guardia, cliente y sin sesión no', async () => {
    const q = 'desde=2026-10-19&hasta=2026-10-25';
    const ok = await pdf(q);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('application/pdf');
    expect(ok.headers['content-disposition']).toContain('horario_2026-10-19_a_2026-10-25.pdf');
    expect((ok.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    expect((await pdf(q, ROLES.SUPERVISOR, 5)).status).toBe(200);
    expect((await pdf(q, ROLES.GUARDIA, 10)).status).toBe(403);
    expect((await request(app).get(`/api/horarios/pdf?${q}`)).status).toBe(401);
  });

  it('valida las fechas: orden, formato y máximo de días', async () => {
    expect((await pdf('desde=2026-10-25&hasta=2026-10-19')).status).toBe(400);
    expect((await pdf('desde=hoy&hasta=2026-10-19')).status).toBe(400);
    expect((await pdf('desde=2026-01-01&hasta=2026-12-31')).status).toBe(400);
    expect((await pdf('desde=2026-10-19&hasta=2026-10-25&guardias=a,b')).status).toBe(400);
  });

  it('un guardia que no existe es 404; el supervisor no pide guardias ni sitios fuera de su alcance', async () => {
    expect((await pdf('desde=2026-10-19&hasta=2026-10-25&guardias=999')).status).toBe(404);
    alcance = { sitioIds: new Set([1]), guardiaIds: new Set([10]) };
    expect((await pdf('desde=2026-10-19&hasta=2026-10-25&guardias=11', ROLES.SUPERVISOR, 5)).status).toBe(404);
    expect((await pdf('desde=2026-10-19&hasta=2026-10-25&sitioId=2', ROLES.SUPERVISOR, 5)).status).toBe(404);
    expect((await pdf('desde=2026-10-19&hasta=2026-10-25&guardias=10', ROLES.SUPERVISOR, 5)).status).toBe(200);
  });

  it('queda en la auditoría con el rango y cuántos guardias salieron (sin los que no tienen turnos)', async () => {
    expect((await pdf('desde=2026-10-19&hasta=2026-10-25')).status).toBe(200);
    const e = audit.eventos.find((x) => x.accion === 'horarios.descargar_pdf');
    expect(e?.datos).toMatchObject({ desde: '2026-10-19', hasta: '2026-10-25', guardias: 2, sitioId: null });
    // Por sitio: solo quienes tienen turno en él (Juan y, por la cobertura del 21, Ana).
    await pdf('desde=2026-10-19&hasta=2026-10-25&sitioId=1');
    expect(audit.eventos.at(-1)?.datos).toMatchObject({ guardias: 2, sitioId: 1 });
    // Si se piden guardias, salen aunque no tengan turnos.
    await pdf('desde=2026-10-19&hasta=2026-10-25&guardias=12');
    expect(audit.eventos.at(-1)?.datos).toMatchObject({ guardias: 1 });
  });
});

describe('atajos de rango del horario', () => {
  it('esta semana, la próxima y este mes (lunes a domingo)', () => {
    // Jueves 22 de octubre de 2026.
    expect(atajosHorario('2026-10-22')).toEqual({
      estaSemana: ['2026-10-19', '2026-10-25'],
      proximaSemana: ['2026-10-26', '2026-11-01'],
      esteMes: ['2026-10-01', '2026-10-31'],
    });
    // En domingo, la semana todavía es la que termina ese día.
    expect(atajosHorario('2026-10-25').estaSemana).toEqual(['2026-10-19', '2026-10-25']);
  });
});
