import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type Cobertura, type PatronTurno, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import type { TurnoProgramado } from '../src/modules/asistencia/vigilancia';
import type { EventoNuevo } from '../src/modules/bitacora/registrar';
import { createCoberturasModule } from '../src/modules/coberturas';
import {
  CoberturasRepository,
  type CoberturaRow,
  type GuardiaCobertura,
  type NuevaCobertura,
} from '../src/modules/coberturas/coberturas.repository';
import type { Alcance } from '../src/modules/sitios/alcance';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const HOY = '2026-10-23';

const guardia = (id: number, nombre: string): GuardiaCobertura => ({
  id,
  nombre,
  email: `${id}@x.mx`,
  rol: ROLES.GUARDIA,
  activo: true,
  fotoClave: null,
});

class MemoryCoberturasRepository extends CoberturasRepository {
  sitios = new Map([
    [1, { id: 1, nombre: 'POETAS', supervisorId: 5, activo: true }],
    [2, { id: 2, nombre: 'Plaza Norte', supervisorId: 6, activo: true }],
  ]);
  guardias = [guardia(10, 'Juan'), guardia(11, 'Ana'), guardia(12, 'Beto')];
  coberturas: CoberturaRow[] = [];

  async findSitio(id: number) {
    return this.sitios.get(id) ?? null;
  }
  async findGuardia(id: number) {
    return this.guardias.find((g) => g.id === id) ?? null;
  }
  async guardiasActivos() {
    return this.guardias;
  }
  async haySolape(usuarioId: number, desde: string, hasta: string) {
    return this.coberturas.some(
      (c) => c.guardia.id === usuarioId && !c.canceladaEn && c.desde <= hasta && c.hasta >= desde,
    );
  }
  async crear(d: NuevaCobertura) {
    const c: CoberturaRow = {
      id: this.coberturas.length + 1,
      guardia: { id: d.usuarioId, nombre: this.guardias.find((g) => g.id === d.usuarioId)!.nombre },
      sitio: { id: d.sitioId, nombre: this.sitios.get(d.sitioId)!.nombre },
      cubreA: null,
      desde: d.desde,
      hasta: d.hasta,
      horaInicio: d.horaInicio,
      horas: d.horas,
      motivo: d.motivo,
      descansoHoras: d.descansoHoras,
      creadaPor: 'Sup',
      createdAt: new Date().toISOString(),
      canceladaEn: null,
    };
    this.coberturas.push(c);
    return c as Cobertura;
  }
  async findById(id: number) {
    return this.coberturas.find((c) => c.id === id) ?? null;
  }
  async cancelar(id: number, en: Date) {
    this.coberturas.find((c) => c.id === id)!.canceladaEn = en;
  }
  async listar() {
    return this.coberturas.filter((c) => !c.canceladaEn);
  }
  async supervisoresDeGuardia() {
    return [6];
  }
}

const patron = (horaInicio: string, horas: number): PatronTurno => ({
  tipo: 'fija',
  horas,
  dias: { tipo: 'diario' },
  horaInicio,
  horaFin: null,
  desde: '2026-10-01',
  hasta: null,
});

/** Juan trabaja en Plaza Norte 8:00 (12 h); Ana entra a las 20:00 (12 h) en Plaza Norte; Beto descansa. */
const TURNOS: TurnoProgramado[] = [
  {
    asignacionId: 1,
    sitio: { id: 2, nombre: 'Plaza Norte' },
    guardia: { id: 10, nombre: 'Juan' },
    patron: patron('08:00', 12),
  },
  {
    asignacionId: 2,
    sitio: { id: 2, nombre: 'Plaza Norte' },
    guardia: { id: 11, nombre: 'Ana' },
    patron: patron('20:00', 12),
  },
];

let repo: MemoryCoberturasRepository;
let audit: MemoryAuditLogger;
let avisos: { usuarioIds: number[]; mensaje: string }[];
let bitacora: EventoNuevo[];
let alcance: Alcance | null;
let app: ReturnType<typeof createApp>;

const token = (id: number, rol: Rol) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol] })}`;
const como = (id: number, rol: Rol) => ({
  get: (u: string) => request(app).get(`/api/coberturas${u}`).set('Authorization', token(id, rol)),
  post: (b: object) => request(app).post('/api/coberturas').set('Authorization', token(id, rol)).send(b),
  delete: (u: string) => request(app).delete(`/api/coberturas${u}`).set('Authorization', token(id, rol)),
});
const sup = () => como(5, ROLES.SUPERVISOR);

const nueva = {
  usuarioId: 12,
  sitioId: 1,
  desde: HOY,
  horaInicio: '08:00',
  horas: 12,
  motivo: 'Falta de Ana',
};

beforeEach(() => {
  repo = new MemoryCoberturasRepository();
  audit = new MemoryAuditLogger();
  avisos = [];
  bitacora = [];
  alcance = null;
  app = createApp([
    createCoberturasModule({
      repo,
      audit,
      turnos: async () => TURNOS,
      avisar: async (usuarioIds, { mensaje }) => void avisos.push({ usuarioIds, mensaje }),
      bitacora: async (e) => void bitacora.push(e),
      alcance: async () => alcance,
      hoy: () => HOY,
    }),
  ]);
});

describe('cubrir otro sitio (DA-39, DA-46)', () => {
  it('solo admin y supervisor', async () => {
    expect((await como(10, ROLES.GUARDIA).get('/')).status).toBe(403);
  });

  it('candidatos: primero quien descansa; quien trabaja a esa hora queda en pausa; descanso en horas', async () => {
    const res = await sup().get(`/candidatos?sitioId=1&desde=${HOY}&horaInicio=08:00&horas=12`);
    expect(
      res.body.data.map(
        (c: { guardia: { nombre: string }; estado: string; descansoHoras: number | null }) => [
          c.guardia.nombre,
          c.estado,
          c.descansoHoras,
        ],
      ),
    ).toEqual([
      ['Beto', 'descansa', null],
      // Ana sale a las 8:00 de su turno de noche y entraría a las 8:00: 0 h; vuelve a entrar a las 20:00.
      ['Ana', 'descansa', 0],
      ['Juan', 'trabaja', 12],
    ]);
  });

  it('el supervisor solo envía guardias de sus sitios a sus sitios', async () => {
    alcance = { sitioIds: new Set([1]), guardiaIds: new Set([10]) };
    expect((await sup().post(nueva)).status).toBe(403);
    expect((await sup().post({ ...nueva, usuarioId: 10, sitioId: 2 })).status).toBe(403);
  });

  it('envía con motivo, avisa al guardia y a los supervisores, queda en bitácora y auditoría', async () => {
    const res = await sup().post({ ...nueva, usuarioId: 11 });
    expect(res.status).toBe(201);
    expect(res.body.data.advertencia).toBe('Ana descansaría solo 0 h');
    expect(avisos).toEqual([
      {
        usuarioIds: [11],
        mensaje: 'Cubrirás POETAS el 23 oct: entras a las 8:00 a.m. (12 h). Motivo: Falta de Ana',
      },
      { usuarioIds: [6], mensaje: 'Ana cubrirá POETAS el 23 oct' },
    ]);
    expect(bitacora[0]).toMatchObject({ usuarioIds: [11], tipo: 'cobertura', actorId: 5 });
    expect(bitacora[0].detalle).toContain('Descansaba solo 0 h');
    expect(audit.acciones()).toEqual(['coberturas.crear']);
    expect((await sup().post({ ...nueva, usuarioId: 11 })).status).toBe(409);
  });

  it('motivo obligatorio y sin días pasados', async () => {
    expect((await sup().post({ ...nueva, motivo: '' })).status).toBe(400);
    expect((await sup().post({ ...nueva, desde: '2026-10-20' })).status).toBe(400);
  });

  it('cancelar: avisa al guardia y queda en su bitácora', async () => {
    await sup().post(nueva);
    avisos = [];
    expect((await sup().delete('/1')).status).toBe(204);
    expect(avisos).toEqual([
      { usuarioIds: [12], mensaje: 'Se canceló tu cobertura en POETAS el 23 oct: regresas a tu sitio' },
    ]);
    expect(bitacora.at(-1)).toMatchObject({ tipo: 'cobertura_cancelada' });
    expect((await sup().delete('/1')).status).toBe(404);
  });
});
