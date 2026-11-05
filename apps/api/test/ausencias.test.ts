import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { StorageService, signAccessToken } from '../src/core';
import { createAusenciasModule } from '../src/modules/ausencias';
import {
  AusenciasRepository,
  type AusenciaRow,
  type EventoAfectado,
  type NuevaAusencia,
  type ResolucionAusencia,
} from '../src/modules/ausencias/ausencias.repository';
import type { EventoNuevo } from '../src/modules/bitacora/registrar';
import type { Alcance } from '../src/modules/sitios/alcance';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const HOY = '2026-11-03';
const NOMBRES: Record<number, string> = { 1: 'Admin Ada', 5: 'Sofía Sup', 6: 'Pedro Sup', 10: 'Juan Pérez', 11: 'Ana Ruiz' };
const ROL_DE: Record<number, string> = { 1: 'admin', 5: 'supervisor', 6: 'supervisor', 10: 'guardia', 11: 'guardia' };
/** Bytes de un JPEG (lo que `detectarImagen` reconoce por su firma). */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

class MemoryStorage extends StorageService {
  archivos = new Map<string, Buffer>();
  async guardar(buffer: Buffer, _mime: string, carpeta: string) {
    const clave = `${carpeta}/2026/11/${this.archivos.size + 1}.jpg`;
    this.archivos.set(clave, buffer);
    return clave;
  }
  async leer() {
    return null;
  }
  async eliminar(clave: string) {
    this.archivos.delete(clave);
  }
}

class Memoria extends AusenciasRepository {
  filas: AusenciaRow[] = [];
  /** Faltas y "No se presentó" sin justificar. */
  eventos: (EventoAfectado & { justificado: boolean })[] = [];
  justificados: { ids: number[]; texto: string }[] = [];
  async crear(d: NuevaAusencia) {
    const f: AusenciaRow = {
      id: this.filas.length + 1,
      estado: 'pendiente',
      tipo: d.tipo,
      guardia: { id: d.usuarioId, nombre: NOMBRES[d.usuarioId] },
      desde: d.desde,
      hasta: d.hasta,
      motivo: d.motivo,
      solicitante: { id: d.solicitanteId, nombre: NOMBRES[d.solicitanteId], rol: ROL_DE[d.solicitanteId] },
      comprobanteClave: d.comprobanteClave,
      createdAt: new Date('2026-11-03T16:00:00.000Z'),
      resueltaEn: null,
      resueltaPor: null,
      resolucion: null,
      faltasJustificadas: 0,
    };
    this.filas.push(f);
    return f;
  }
  async findById(id: number) {
    return this.filas.find((f) => f.id === id) ?? null;
  }
  async listar(ids: number[] | null) {
    return this.filas
      .filter((f) => !ids || ids.includes(f.guardia.id))
      .sort((a, b) => Number(b.estado === 'pendiente') - Number(a.estado === 'pendiente'));
  }
  async hayTraslape(usuarioId: number, desde: string, hasta: string) {
    return this.filas.some(
      (f) => f.guardia.id === usuarioId && ['pendiente', 'aprobada'].includes(f.estado) && f.desde <= hasta && f.hasta >= desde,
    );
  }
  async resolver(id: number, r: ResolucionAusencia) {
    Object.assign(this.filas.find((f) => f.id === id)!, {
      estado: r.estado,
      resueltaEn: r.resueltaEn,
      resueltaPor: r.resueltaPor,
      resolucion: r.resolucion ?? null,
      ...(r.faltasJustificadas !== undefined && { faltasJustificadas: r.faltasJustificadas }),
    });
  }
  async guardia(id: number) {
    return NOMBRES[id] ? { id, nombre: NOMBRES[id], rol: ROL_DE[id], activo: id !== 99 } : null;
  }
  async nombreDe(id: number) {
    return NOMBRES[id] ?? null;
  }
  async eventosAfectados(_u: number, desde: string, hasta: string) {
    return this.eventos.filter((e) => !e.justificado && e.fecha >= desde && e.fecha <= hasta);
  }
  async justificarEventos(ids: number[], texto: string) {
    this.justificados.push({ ids, texto });
    for (const e of this.eventos) if (ids.includes(e.id)) e.justificado = true;
  }
  async admins() {
    return [1];
  }
  async supervisoresDe() {
    return [5];
  }
}

let repo: Memoria;
let storage: MemoryStorage;
let audit: MemoryAuditLogger;
let avisos: { usuarioIds: number[]; titulo?: string; mensaje: string; ruta?: string | null; entidad?: string }[];
let atendidos: string[];
let bitacora: EventoNuevo[];
let alcance: Alcance | null;
let app: ReturnType<typeof createApp>;

const token = (id: number, rol: Rol) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol] })}`;
const como = (id: number, rol: Rol) => ({
  get: (u = '') => request(app).get(`/api/ausencias${u}`).set('Authorization', token(id, rol)),
  post: (u: string, b: object = {}) => request(app).post(`/api/ausencias${u}`).set('Authorization', token(id, rol)).send(b),
  /** Formulario con comprobante opcional. */
  pedir: (campos: Record<string, string>, foto?: Buffer) => {
    const req = request(app).post('/api/ausencias').set('Authorization', token(id, rol));
    for (const [k, v] of Object.entries(campos)) req.field(k, v);
    if (foto) req.attach('foto', foto, { filename: 'comprobante.jpg', contentType: 'image/jpeg' });
    return req;
  },
});
const admin = () => como(1, ROLES.ADMIN);
const sup = () => como(5, ROLES.SUPERVISOR);
const guardia = () => como(10, ROLES.GUARDIA);

const vacaciones = { usuarioId: '10', tipo: 'vacaciones', desde: '2026-11-04', hasta: '2026-11-08' };

beforeEach(() => {
  repo = new Memoria();
  storage = new MemoryStorage();
  audit = new MemoryAuditLogger();
  avisos = [];
  atendidos = [];
  bitacora = [];
  alcance = null;
  app = createApp([
    createAusenciasModule({
      repo,
      storage,
      audit,
      avisar: async (usuarioIds, a) =>
        void avisos.push({
          usuarioIds,
          titulo: a.titulo,
          mensaje: a.mensaje,
          ruta: a.ruta,
          entidad: a.entidad && `${a.entidad.tipo}:${a.entidad.id}`,
        }),
      bitacora: async (e) => void bitacora.push(e),
      atencion: {
        atender: async (e, a) => void atendidos.push(`${e.tipo}:${e.id}:${a.resultado}`),
        reabrir: async () => undefined,
      },
      alcance: async (u) => (u.rol === ROLES.SUPERVISOR ? alcance : null),
      hoy: () => HOY,
      ahora: () => new Date('2026-11-03T16:00:00.000Z'),
    }),
  ]);
});

describe('ausencias justificadas por adelantado (A-43)', () => {
  it('el admin la registra directo: queda aprobada, justifica las faltas de esos días y lo anota en la bitácora', async () => {
    repo.eventos = [
      { id: 100, fecha: '2026-11-05', justificado: false },
      { id: 101, fecha: '2026-11-06', justificado: false },
      { id: 102, fecha: '2026-11-20', justificado: false }, // fuera del rango
    ];
    const res = await admin().pedir({ ...vacaciones, motivo: 'Vacaciones de noviembre' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ estado: 'aprobada', tipo: 'vacaciones', dias: 5, faltasJustificadas: 2, resueltaPor: 'Admin Ada' });
    expect(repo.justificados).toEqual([{ ids: [100, 101], texto: 'Ausencia justificada: Vacaciones' }]);
    expect(repo.eventos.map((e) => e.justificado)).toEqual([true, true, false]);
    expect(atendidos).toEqual(expect.arrayContaining(['bitacora:100:Ausencia justificada', 'bitacora:101:Ausencia justificada', 'ausencia:1:Aprobada']));
    expect(bitacora[0]).toMatchObject({ tipo: 'ausencia', usuarioIds: [10], actorId: 1 });
    expect(bitacora[0].detalle).toContain('Justificó 2 faltas');
    expect(audit.acciones()).toEqual(['ausencias.crear', 'ausencias.registrar']);
    // Se avisa al guardia y al supervisor (su sitio puede quedar sin cubrir).
    expect(avisos.find((a) => a.usuarioIds.join() === '10')).toMatchObject({ titulo: 'Tu ausencia fue aprobada' });
    expect(avisos.find((a) => a.usuarioIds.join() === '5')).toMatchObject({ ruta: '/asistencia/calendario' });
  });

  it('lo médico exige comprobante; el permiso y "otro", motivo; el comprobante tiene que ser una foto', async () => {
    const incapacidad = { ...vacaciones, tipo: 'incapacidad' };
    const sinFoto = await admin().pedir(incapacidad);
    expect(sinFoto.status).toBe(400);
    expect(sinFoto.body.error.details[0].path).toBe('foto');
    expect((await admin().pedir({ ...incapacidad, tipo: 'cita_medica' })).status).toBe(400);
    expect((await admin().pedir(incapacidad, Buffer.from('no es una foto'))).status).toBe(400);
    expect(storage.archivos.size).toBe(0);

    const ok = await admin().pedir(incapacidad, JPEG);
    expect(ok.status).toBe(201);
    expect(ok.body.data.comprobante).toMatch(/^\/api\/archivos\/ausencias\/.+\?exp=\d+&sig=/);
    expect(storage.archivos.size).toBe(1);

    const permiso = { ...vacaciones, tipo: 'permiso', desde: '2026-12-01', hasta: '2026-12-01' };
    expect((await admin().pedir(permiso)).status).toBe(400); // pide motivo
    expect((await admin().pedir({ ...permiso, motivo: 'Trámite personal' })).status).toBe(201); // foto opcional
    // Vacaciones no pide nada.
    expect((await admin().pedir({ ...vacaciones, usuarioId: '11' })).status).toBe(201);
  });

  it('el guardia la pide para sí: queda pendiente, avisa al admin (con aviso ligado) y al supervisor; no puede pedir por otro', async () => {
    const res = await guardia().pedir({ ...vacaciones, usuarioId: '11' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ estado: 'pendiente', guardia: { id: 10 }, solicitante: { id: 10 } });
    expect(repo.justificados).toEqual([]);
    expect(avisos.find((a) => a.usuarioIds.join() === '1')).toMatchObject({
      titulo: 'Solicitud de ausencia',
      ruta: '/asistencia/ausencias',
      entidad: 'ausencia:1',
    });
    expect(avisos.find((a) => a.usuarioIds.join() === '5')?.titulo).toBe('Un guardia pidió una ausencia');
  });

  it('el supervisor la pide a nombre de un guardia suyo; el de otro supervisor no', async () => {
    alcance = { sitioIds: new Set([1]), guardiaIds: new Set([10]) };
    expect((await sup().pedir({ ...vacaciones, usuarioId: '11' })).status).toBe(404);
    expect((await sup().pedir(vacaciones)).status).toBe(201);
    expect(repo.filas[0]).toMatchObject({ estado: 'pendiente', solicitante: { id: 5 } });
    expect(avisos.find((a) => a.usuarioIds.join() === '10')?.titulo).toBe('Pidieron una ausencia por ti');
    const { usuarioId: _guardia, ...sinGuardia } = vacaciones;
    expect((await sup().pedir(sinGuardia)).status).toBe(400);
  });

  it('solo el admin aprueba o rechaza; al rechazar pide motivo; no se cruzan dos ausencias', async () => {
    await guardia().pedir(vacaciones);
    expect((await sup().post('/1/resolver', { decision: 'aprobar' })).status).toBe(403);
    expect((await guardia().post('/1/resolver', { decision: 'aprobar' })).status).toBe(403);
    expect((await admin().post('/1/resolver', { decision: 'rechazar' })).status).toBe(400);
    expect((await admin().post('/1/resolver', { decision: 'rechazar', categoria: 'otro' })).status).toBe(400);
    // Mientras está pendiente no se puede encimar otra.
    expect((await guardia().pedir({ ...vacaciones, desde: '2026-11-06', hasta: '2026-11-10' })).status).toBe(409);

    repo.eventos = [{ id: 7, fecha: '2026-11-04', justificado: false }];
    const ok = await admin().post('/1/resolver', { decision: 'aprobar' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ estado: 'aprobada', faltasJustificadas: 1 });
    expect(avisos.find((a) => a.usuarioIds.join() === '10' && a.titulo === 'Tu ausencia fue aprobada')).toBeDefined();
    expect((await admin().post('/1/resolver', { decision: 'aprobar' })).status).toBe(409);
    expect(audit.acciones()).toContain('ausencias.aprobar');
  });

  it('rechazada: queda el motivo, se avisa al guardia y al final se puede volver a pedir', async () => {
    await guardia().pedir(vacaciones);
    const res = await admin().post('/1/resolver', { decision: 'rechazar', categoria: 'fechas_incorrectas' });
    expect(res.body.data).toMatchObject({ estado: 'rechazada', resolucion: 'Las fechas no son correctas' });
    expect(atendidos).toContain('ausencia:1:Rechazada');
    expect(avisos.at(-1)).toMatchObject({ usuarioIds: [10], titulo: 'Ausencia rechazada' });
    expect(repo.justificados).toEqual([]);
    expect((await guardia().pedir(vacaciones)).status).toBe(201);
  });

  it('cancelar: quien la pidió su pendiente; la aprobada futura solo el admin; una que ya empezó no', async () => {
    await guardia().pedir(vacaciones);
    expect((await como(11, ROLES.GUARDIA).post('/1/cancelar', { categoria: 'se_equivoco' })).status).toBe(404);
    expect((await guardia().post('/1/cancelar', {})).status).toBe(400);
    const c = await guardia().post('/1/cancelar', { categoria: 'se_equivoco' });
    expect(c.body.data).toMatchObject({ estado: 'cancelada', resolucion: 'Se pidió por error' });
    expect((await guardia().post('/1/cancelar', { categoria: 'se_equivoco' })).status).toBe(409);

    await admin().pedir({ ...vacaciones, desde: '2026-11-10', hasta: '2026-11-12' });
    expect((await guardia().post('/2/cancelar', { categoria: 'ya_no_se_necesita' })).status).toBe(403);
    expect((await sup().post('/2/cancelar', { categoria: 'ya_no_se_necesita' })).status).toBe(404);
    expect((await admin().post('/2/cancelar', { categoria: 'ya_no_se_necesita' })).status).toBe(200);

    await admin().pedir({ ...vacaciones, desde: '2026-11-03', hasta: '2026-11-05' });
    expect((await admin().post('/3/cancelar', { categoria: 'ya_no_se_necesita' })).status).toBe(409);
  });

  it('cada quien ve lo suyo: el guardia las suyas, el supervisor las de sus guardias y el admin todas', async () => {
    await admin().pedir(vacaciones);
    await admin().pedir({ ...vacaciones, usuarioId: '11' });
    expect((await guardia().get()).body.data.items.map((a: { guardia: { id: number } }) => a.guardia.id)).toEqual([10]);
    alcance = { sitioIds: new Set([1]), guardiaIds: new Set([11]) };
    expect((await sup().get()).body.data.items.map((a: { guardia: { id: number } }) => a.guardia.id)).toEqual([11]);
    expect((await admin().get()).body.data.items).toHaveLength(2);
  });

  it('la vista previa cuenta las faltas que se justificarían solas', async () => {
    repo.eventos = [
      { id: 1, fecha: '2026-11-05', justificado: false },
      { id: 2, fecha: '2026-11-05', justificado: false },
      { id: 3, fecha: '2026-11-07', justificado: false },
    ];
    const res = await admin().get('/vista-previa?usuarioId=10&desde=2026-11-04&hasta=2026-11-08');
    expect(res.body.data).toEqual({ faltas: 3, fechas: ['2026-11-05', '2026-11-07'] });
    expect((await guardia().get('/vista-previa?usuarioId=10&desde=2026-11-04&hasta=2026-11-08')).status).toBe(403);
  });

  it('valida las fechas y un guardia que no existe', async () => {
    expect((await admin().pedir({ ...vacaciones, hasta: '2026-11-01' })).status).toBe(400);
    expect((await admin().pedir({ ...vacaciones, hasta: '2027-12-31' })).status).toBe(400);
    expect((await admin().pedir({ ...vacaciones, usuarioId: '99' })).status).toBe(400);
    expect((await admin().pedir({ ...vacaciones, usuarioId: '5' })).status).toBe(400); // no es guardia
    expect((await admin().pedir({ ...vacaciones, tipo: 'viaje' })).status).toBe(400);
  });
});
