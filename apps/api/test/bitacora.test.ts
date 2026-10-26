import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import { createBitacoraModule } from '../src/modules/bitacora';
import { BitacoraRepository, type EventoBitacoraRow } from '../src/modules/bitacora/bitacora.repository';
import { sinAlcance } from '../src/modules/sitios/alcance';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const NOMBRES: Record<number, string> = { 2: 'Supervisora' };

class MemoryBitacoraRepository extends BitacoraRepository {
  eventosGuardados: EventoBitacoraRow[] = [];

  async existeGuardia(usuarioId: number) {
    return usuarioId === 10;
  }
  async eventos(usuarioId: number, desde: Date, hasta: Date) {
    return this.eventosGuardados
      .filter((e) => e.usuarioId === usuarioId && e.ocurrioEn >= desde && e.ocurrioEn < hasta)
      .sort((a, b) => b.ocurrioEn.getTime() - a.ocurrioEn.getTime());
  }
  async eventosDeTodos(tipos: readonly EventoBitacoraRow['tipo'][], desde: Date, hasta: Date) {
    return this.eventosGuardados
      .filter((e) => tipos.includes(e.tipo) && e.ocurrioEn >= desde && e.ocurrioEn < hasta)
      .sort((a, b) => b.ocurrioEn.getTime() - a.ocurrioEn.getTime());
  }
  async guardiasActivos() {
    return [
      { id: 10, nombre: 'Juan Pérez', email: 'juan@x.mx', fotoClave: null },
      { id: 11, nombre: 'Ana López', email: 'ana@x.mx', fotoClave: null },
    ];
  }
  async findById(id: number) {
    const e = this.eventosGuardados.find((x) => x.id === id);
    return e ? structuredClone(e) : null;
  }
  async comentar(eventoId: number, autorId: number, texto: string) {
    const e = this.eventosGuardados.find((x) => x.id === eventoId)!;
    e.comentarios.push({
      id: e.comentarios.length + 1,
      texto,
      autor: NOMBRES[autorId],
      createdAt: new Date(),
    });
  }
  async decidir(eventoId: number, porId: number, decision: 'asistencia' | 'falta', en: Date) {
    Object.assign(
      this.eventosGuardados.find((x) => x.id === eventoId)!,
      {
        decision,
        decididoPor: NOMBRES[porId],
        decididoEn: en,
      },
    );
  }
  async justificar(eventoId: number, porId: number, motivo: string, en: Date) {
    Object.assign(
      this.eventosGuardados.find((x) => x.id === eventoId)!,
      {
        justificacion: motivo,
        justificadoPor: NOMBRES[porId],
        justificadoEn: en,
      },
    );
  }
}

const evento = (
  id: number,
  tipo: EventoBitacoraRow['tipo'],
  ocurrioEn: string,
  usuarioId = 10,
): EventoBitacoraRow => ({
  id,
  usuarioId,
  guardia: { id: usuarioId, nombre: usuarioId === 10 ? 'Juan Pérez' : 'Ana López', email: 'x@x.mx' },
  tipo,
  ocurrioEn: new Date(ocurrioEn),
  detalle: `Evento ${id}`,
  datos: null,
  marcacionId: null,
  sitio: null,
  actor: null,
  fotoMarca: null,
  incidencia: null,
  justificacion: null,
  justificadoPor: null,
  justificadoEn: null,
  decision: null,
  decididoPor: null,
  decididoEn: null,
  comentarios: [],
});

let repo: MemoryBitacoraRepository;
let audit: MemoryAuditLogger;
let app: ReturnType<typeof createApp>;

const token = (rol: Rol) =>
  `Bearer ${signAccessToken({ id: 2, email: 'u2@x.mx', rol, permisos: PERMISOS_POR_ROL[rol] })}`;
const como = (rol: Rol) => ({
  get: (u: string) => request(app).get(`/api/bitacora${u}`).set('Authorization', token(rol)),
  post: (u: string, b: object) =>
    request(app).post(`/api/bitacora${u}`).set('Authorization', token(rol)).send(b),
});
const sup = () => como(ROLES.SUPERVISOR);

beforeEach(() => {
  repo = new MemoryBitacoraRepository();
  audit = new MemoryAuditLogger();
  repo.eventosGuardados = [
    evento(1, 'retardo', '2026-10-05T14:00:00.000Z'),
    evento(2, 'asignacion', '2026-10-20T15:00:00.000Z'),
    // 30 de septiembre a las 20:00 en CDMX: es del mes anterior.
    evento(3, 'retardo', '2026-10-01T02:00:00.000Z'),
  ];
  app = createApp([
    createBitacoraModule({
      repo,
      audit,
      ahora: () => new Date('2026-10-21T18:00:00.000Z'),
      alcance: sinAlcance,
    }),
  ]);
});

describe('bitácora del guardia (DA-41)', () => {
  it('solo admin y supervisor; el guardia y el cliente no la ven', async () => {
    expect((await como(ROLES.GUARDIA).get('/guardias/10?mes=2026-10')).status).toBe(403);
    // El cliente tiene el permiso de ver asistencia (portal), pero no la bitácora interna.
    expect((await como(ROLES.CLIENTE).get('/guardias/10?mes=2026-10')).status).toBe(403);
    expect((await como(ROLES.CLIENTE).get('/incidencias/guardias?mes=2026-10')).status).toBe(403);
    expect((await como(ROLES.CLIENTE).post('/eventos/1/justificar', { motivo: 'x' })).status).toBe(403);
    expect((await como(ROLES.ADMIN).get('/guardias/10?mes=2026-10')).status).toBe(200);
  });

  it('eventos del mes en la zona del negocio, del más nuevo al más viejo', async () => {
    const res = await sup().get('/guardias/10?mes=2026-10');
    expect(res.body.data.map((e: { id: number }) => e.id)).toEqual([2, 1]);
    expect((await sup().get('/guardias/99?mes=2026-10')).status).toBe(404);
  });

  it('comenta cualquier evento y queda en auditoría', async () => {
    const res = await sup().post('/eventos/2/comentarios', { texto: '  Se le explicó el horario  ' });
    expect(res.status).toBe(201);
    expect(res.body.data.comentarios).toEqual([
      expect.objectContaining({ texto: 'Se le explicó el horario', autor: 'Supervisora' }),
    ]);
    expect(audit.acciones()).toEqual(['bitacora.comentar']);
    expect((await sup().post('/eventos/2/comentarios', { texto: ' ' })).status).toBe(400);
  });

  it('justifica solo retardos, salidas, comida fuera y faltas; una vez', async () => {
    const res = await sup().post('/eventos/1/justificar', { motivo: 'Cita en el IMSS' });
    expect(res.status).toBe(200);
    expect(res.body.data.justificacion).toEqual({
      motivo: 'Cita en el IMSS',
      por: 'Supervisora',
      en: '2026-10-21T18:00:00.000Z',
    });
    expect(audit.acciones()).toEqual(['bitacora.justificar']);
    expect((await sup().post('/eventos/1/justificar', { motivo: 'Otra vez' })).status).toBe(409);
    expect((await sup().post('/eventos/2/justificar', { motivo: 'No aplica' })).status).toBe(400);
    expect((await sup().post('/eventos/99/justificar', { motivo: 'No existe' })).status).toBe(404);
  });

  it('incidencias por guardia: asistencia y rostro del mes, sin justificadas; pendientes primero', async () => {
    repo.eventosGuardados.push(
      evento(4, 'salida_anticipada', '2026-10-06T14:00:00.000Z', 11),
      { ...evento(5, 'incidencia_rostro', '2026-10-07T14:00:00.000Z', 11), incidencia: null },
      evento(6, 'retardo', '2026-10-08T14:00:00.000Z', 11),
    );
    // La de rostro ya revisada; el retardo de Ana justificado; el de Juan comentado.
    repo.eventosGuardados[4].incidencia = {
      id: 1,
      motivo: 'pantalla',
      fotoClave: 'intentos/a.jpg',
      revisadaPor: 'Supervisora',
      revisadaEn: new Date('2026-10-07T15:00:00.000Z'),
      conclusion: 'falsa_alarma',
      nota: null,
    };
    Object.assign(repo.eventosGuardados[5], { justificacion: 'IMSS', justificadoEn: new Date() });
    repo.eventosGuardados[0].comentarios.push({ id: 1, texto: 'ok', autor: null, createdAt: new Date() });

    const res = await sup().get('/incidencias/guardias?mes=2026-10');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { guardia: expect.objectContaining({ id: 11 }), asistencia: 1, rostro: 1, pendientes: 1 },
      { guardia: expect.objectContaining({ id: 10 }), asistencia: 1, rostro: 0, pendientes: 0 },
    ]);
    expect((await como(ROLES.GUARDIA).get('/incidencias/guardias?mes=2026-10')).status).toBe(403);
  });

  it('lista general de incidencias con filtro por clase, estado y guardia', async () => {
    repo.eventosGuardados.push(
      evento(4, 'incidencia_rostro', '2026-10-06T14:00:00.000Z', 11),
      evento(5, 'grupo_alta', '2026-10-06T15:00:00.000Z', 11),
    );
    const ids = async (q: string) =>
      (await sup().get(`/incidencias?mes=2026-10${q}`)).body.data.items.map((e: { id: number }) => e.id);
    expect(await ids('')).toEqual([4, 1]);
    expect(await ids('&clase=rostro')).toEqual([4]);
    expect(await ids('&estado=pendientes&q=juan')).toEqual([1]);
    expect(await ids('&estado=atendidas')).toEqual([]);
  });

  it('el supervisor solo ve a los guardias de sus sitios (DA-45)', async () => {
    repo.eventosGuardados.push(evento(4, 'retardo', '2026-10-06T14:00:00.000Z', 11));
    app = createApp([
      createBitacoraModule({
        repo,
        audit,
        alcance: async () => ({ sitioIds: new Set([2]), guardiaIds: new Set([11]) }),
      }),
    ]);
    expect((await sup().get('/guardias/10?mes=2026-10')).status).toBe(404);
    const porGuardia = await sup().get('/incidencias/guardias?mes=2026-10');
    expect(porGuardia.body.data.map((f: { guardia: { id: number } }) => f.guardia.id)).toEqual([11]);
    const todas = await sup().get('/incidencias?mes=2026-10');
    expect(todas.body.data.items.map((e: { id: number }) => e.id)).toEqual([4]);
    expect((await sup().post('/eventos/1/comentarios', { texto: 'hola' })).status).toBe(404);
  });

  it('falta con llegada tarde: el supervisor acepta la asistencia una vez (DA-45)', async () => {
    repo.eventosGuardados.push(
      { ...evento(4, 'falta', '2026-10-07T16:00:00.000Z'), datos: { llegoEn: '2026-10-07T17:05:00.000Z' } },
      evento(5, 'falta', '2026-10-08T16:00:00.000Z'),
    );
    expect((await sup().post('/eventos/5/decidir', { decision: 'asistencia' })).status).toBe(400);
    const res = await sup().post('/eventos/4/decidir', { decision: 'asistencia' });
    expect(res.status).toBe(200);
    expect(res.body.data.decision).toEqual({
      tipo: 'asistencia',
      por: 'Supervisora',
      en: '2026-10-21T18:00:00.000Z',
    });
    expect((await sup().post('/eventos/4/decidir', { decision: 'falta' })).status).toBe(409);
    expect(audit.acciones()).toEqual(['bitacora.decidir_falta']);
    // Aceptada: ya no cuenta como falta ni queda pendiente.
    const porGuardia = await sup().get('/incidencias/guardias?mes=2026-10');
    const juan = porGuardia.body.data.find((f: { guardia: { id: number } }) => f.guardia.id === 10);
    expect(juan).toMatchObject({ asistencia: 2, pendientes: 2 });
  });
});
