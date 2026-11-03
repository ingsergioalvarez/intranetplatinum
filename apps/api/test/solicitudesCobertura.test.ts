import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import { createSolicitudesCoberturaModule, crearServicioSolicitudes } from '../src/modules/solicitudes-cobertura';
import {
  SolicitudesRepository,
  type CierreSolicitud,
  type NuevaSolicitud,
  type SolicitudRow,
} from '../src/modules/solicitudes-cobertura/solicitudes.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const NOMBRES: Record<number, string> = { 1: 'Admin Ada', 2: 'Admin Beto', 5: 'Sofía Sup', 6: 'Pedro Sup', 10: 'Juan Pérez' };
const SITIOS: Record<number, string> = { 1: 'POETAS', 2: 'Plaza Norte' };
/** Admin dueño del cliente de cada sitio (A-66): POETAS es del admin 10 y Plaza Norte del admin 11. */
const DUENOS: Record<number, number> = { 1: 10, 2: 11 };

class Memoria extends SolicitudesRepository {
  filas: SolicitudRow[] = [];
  reloj = () => new Date('2026-11-03T16:00:00.000Z');
  async crear(d: NuevaSolicitud) {
    const f: SolicitudRow = {
      id: this.filas.length + 1,
      estado: 'pendiente',
      sitio: { id: d.sitioId, nombre: SITIOS[d.sitioId] },
      sitioDueno: DUENOS[d.sitioId] ?? null,
      solicitante: { id: d.solicitanteId, nombre: NOMBRES[d.solicitanteId] },
      guardia: d.guardiaId ? { id: d.guardiaId, nombre: NOMBRES[d.guardiaId] } : null,
      fecha: d.fecha,
      motivo: d.motivo,
      createdAt: this.reloj(),
      cerradaEn: null,
      cerradaPor: null,
      resolucion: null,
      recordadaEn: null,
    };
    this.filas.push(f);
    return f;
  }
  async findById(id: number) {
    return this.filas.find((f) => f.id === id) ?? null;
  }
  async listar(solicitanteId: number | null, _limite: number, cartera?: number) {
    return this.filas
      .filter((f) => !solicitanteId || f.solicitante.id === solicitanteId)
      .filter((f) => cartera === undefined || f.sitioDueno === cartera)
      .sort((a, b) => Number(b.estado === 'pendiente') - Number(a.estado === 'pendiente'));
  }
  async pendientesDelSitio(sitioId: number) {
    return this.filas.filter((f) => f.sitio.id === sitioId && f.estado === 'pendiente');
  }
  async cerrar(id: number, c: CierreSolicitud) {
    Object.assign(this.filas.find((f) => f.id === id)!, {
      estado: c.estado,
      cerradaEn: c.cerradaEn,
      cerradaPor: c.cerradaPor,
      resolucion: c.resolucion,
    });
  }
  async porRecordar(creadasAntes: Date, recordadasAntes: Date) {
    return this.filas.filter(
      (f) => f.estado === 'pendiente' && f.createdAt <= creadasAntes && (!f.recordadaEn || f.recordadaEn <= recordadasAntes),
    );
  }
  async marcarRecordada(id: number, en: Date) {
    this.filas.find((f) => f.id === id)!.recordadaEn = en;
  }
  async admins() {
    return [1, 2];
  }
  async nombreDe(id: number) {
    return NOMBRES[id] ?? null;
  }
}

let repo: Memoria;
let audit: MemoryAuditLogger;
let avisos: { usuarioIds: number[]; titulo?: string; mensaje: string; entidad?: string }[];
let atendidos: string[];
let ahora: Date;
let app: ReturnType<typeof createApp>;
let servicio: ReturnType<typeof crearServicioSolicitudes>;

const token = (id: number, rol: Rol, esSuperAdmin = false) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol], esSuperAdmin })}`;
const como = (id: number, rol: Rol, esSuperAdmin = false) => ({
  get: () => request(app).get('/api/solicitudes-cobertura').set('Authorization', token(id, rol, esSuperAdmin)),
  cancelar: (solicitud: number, b: object = {}) =>
    request(app)
      .post(`/api/solicitudes-cobertura/${solicitud}/cancelar`)
      .set('Authorization', token(id, rol, esSuperAdmin))
      .send(b),
});
/** El admin 1 de estas pruebas es el super admin: ve todo. */
const admin = () => como(1, ROLES.ADMIN, true);
const sup = () => como(5, ROLES.SUPERVISOR);

const pedir = (sitioId = 1, solicitanteId = 5, fecha = '2026-11-03') =>
  servicio.crear({
    sitioId,
    sitioNombre: SITIOS[sitioId],
    solicitanteId,
    guardiaId: 10,
    guardiaNombre: 'Juan Pérez',
    fecha,
    motivo: 'Llegó tarde',
  });

beforeEach(() => {
  repo = new Memoria();
  audit = new MemoryAuditLogger();
  avisos = [];
  atendidos = [];
  ahora = new Date('2026-11-03T16:00:00.000Z');
  repo.reloj = () => ahora;
  const deps = {
    repo,
    audit,
    avisar: async (
      usuarioIds: number[],
      a: { titulo?: string; mensaje: string; entidad?: { tipo: string; id: number } },
    ) => void avisos.push({ usuarioIds, titulo: a.titulo, mensaje: a.mensaje, entidad: a.entidad && `${a.entidad.tipo}:${a.entidad.id}` }),
    atencion: {
      atender: async (e: { tipo: string; id: number }, a: { resultado: string }) =>
        void atendidos.push(`${e.tipo}:${e.id}:${a.resultado}`),
      reabrir: async () => undefined,
    },
    ahora: () => ahora,
  };
  servicio = crearServicioSolicitudes(deps);
  app = createApp([createSolicitudesCoberturaModule(deps)]);
});

describe('solicitudes de cobertura (A-39)', () => {
  it('al crearla queda guardada y avisa a los admin, con el aviso ligado a la solicitud', async () => {
    await pedir();
    expect(repo.filas).toHaveLength(1);
    expect(avisos).toEqual([
      {
        usuarioIds: [1, 2],
        titulo: 'Solicitud de cobertura',
        mensaje: expect.stringContaining('Sofía Sup pide un guardia de otro supervisor para POETAS'),
        entidad: 'solicitud:1',
      },
    ]);
    expect(avisos[0].mensaje).toContain('por Juan Pérez');
    expect(audit.acciones()).toContain('solicitudes_cobertura.crear');
  });

  it('el admin ve todas con las pendientes primero; el supervisor solo las suyas', async () => {
    await pedir(1, 5);
    await pedir(2, 6);
    await repo.cerrar(1, { estado: 'cancelada', cerradaEn: ahora, cerradaPor: 'x', resolucion: 'x' });
    const todas = await admin().get();
    expect(todas.body.data.items.map((s: { id: number }) => s.id)).toEqual([2, 1]);
    expect(todas.body.data.pendientes).toBe(1);
    const suyas = await sup().get();
    expect(suyas.body.data.items.map((s: { id: number }) => s.id)).toEqual([1]);
    expect(suyas.body.data.pendientes).toBe(0);
    expect((await como(10, ROLES.GUARDIA).get()).status).toBe(403);
    expect((await como(20, ROLES.CLIENTE).get()).status).toBe(403);
  });

  it('cancelar pide motivo de la lista; "otro" exige explicarlo', async () => {
    await pedir();
    expect((await sup().cancelar(1, {})).status).toBe(400);
    expect((await sup().cancelar(1, { categoria: 'otro' })).status).toBe(400);
    const res = await sup().cancelar(1, { categoria: 'lo_resolvi' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      estado: 'cancelada',
      cerradaPor: 'Sofía Sup',
      resolucion: 'Lo resolví con uno de mis guardias',
    });
    expect(atendidos).toEqual(['solicitud:1:Cancelada']);
    // La cancela quien la pidió: se enteran los admin.
    expect(avisos.at(-1)).toMatchObject({ usuarioIds: [1, 2], titulo: 'Solicitud de cobertura cancelada' });
    expect(audit.acciones()).toContain('solicitudes_cobertura.cancelar');
    expect((await sup().cancelar(1, { categoria: 'lo_resolvi' })).status).toBe(409);
  });

  it('un supervisor no cancela la de otro; el admin sí y se entera quien la pidió', async () => {
    await pedir(2, 6);
    expect((await sup().cancelar(1, { categoria: 'se_equivoco' })).status).toBe(404);
    const res = await admin().cancelar(1, { categoria: 'ya_no_se_necesita' });
    expect(res.status).toBe(200);
    expect(avisos.at(-1)).toMatchObject({ usuarioIds: [6], titulo: 'Solicitud de cobertura cancelada' });
    expect((await admin().cancelar(99, { categoria: 'ya_no_se_necesita' })).status).toBe(404);
  });

  it('al asignar la cobertura se cierra la solicitud del sitio de esos días y se avisa a quien la pidió', async () => {
    await pedir(1, 5, '2026-11-03');
    await pedir(2, 6, '2026-11-03'); // otro sitio
    await pedir(1, 5, '2026-11-20'); // otra fecha
    avisos = [];
    await servicio.cerrarPorCobertura({
      sitioId: 1,
      sitioNombre: 'POETAS',
      desde: '2026-11-04',
      hasta: '2026-11-04',
      guardiaNombre: 'Ana Ruiz',
      coberturaId: 7,
      actorId: 1,
    });
    expect(repo.filas.map((f) => f.estado)).toEqual(['atendida', 'pendiente', 'pendiente']);
    expect(repo.filas[0]).toMatchObject({ cerradaPor: 'Admin Ada', resolucion: 'Ana Ruiz cubre el 4 nov' });
    expect(atendidos).toEqual(['solicitud:1:Atendida']);
    expect(avisos).toEqual([
      expect.objectContaining({
        usuarioIds: [5],
        titulo: 'Tu solicitud de cobertura se atendió',
        mensaje: 'Para POETAS: Ana Ruiz cubre el 4 nov',
      }),
    ]);
    expect(audit.acciones()).toContain('solicitudes_cobertura.atender');
  });

  it('si quien asigna la cobertura es quien la pidió no se avisa a sí mismo', async () => {
    await pedir(1, 5);
    avisos = [];
    await servicio.cerrarPorCobertura({
      sitioId: 1,
      sitioNombre: 'POETAS',
      desde: '2026-11-03',
      hasta: '2026-11-03',
      guardiaNombre: 'Ana',
      coberturaId: 8,
      actorId: 5,
    });
    expect(repo.filas[0].estado).toBe('atendida');
    expect(avisos).toEqual([]);
  });

  it('a las 2 h sin atender se recuerda a los admin, y otra vez a las 4 h; una atendida ya no', async () => {
    await pedir();
    avisos = [];
    ahora = new Date('2026-11-03T17:30:00.000Z');
    await servicio.recordar();
    expect(avisos).toEqual([]);
    ahora = new Date('2026-11-03T18:05:00.000Z');
    await servicio.recordar();
    await servicio.recordar();
    expect(avisos).toEqual([
      expect.objectContaining({ usuarioIds: [1, 2], titulo: 'Solicitud de cobertura sin atender', entidad: 'solicitud:1' }),
    ]);
    ahora = new Date('2026-11-03T20:00:00.000Z');
    await servicio.recordar();
    expect(avisos).toHaveLength(1);
    ahora = new Date('2026-11-03T22:10:00.000Z');
    await servicio.recordar();
    expect(avisos).toHaveLength(2);
    await repo.cerrar(1, { estado: 'atendida', cerradaEn: ahora, cerradaPor: 'x', resolucion: 'x' });
    ahora = new Date('2026-11-04T10:00:00.000Z');
    await servicio.recordar();
    expect(avisos).toHaveLength(2);
  });
});

describe('solicitudes de cobertura: cada admin ve las de su cartera (A-66)', () => {
  it('un admin ve solo las solicitudes de los sitios de sus clientes; el super admin, todas', async () => {
    await pedir(1);
    await pedir(2, 6);
    const ids = async (c: ReturnType<typeof como>) => (await c.get()).body.data.items.map((s: { sitio: { id: number } }) => s.sitio.id);
    expect(await ids(como(10, ROLES.ADMIN))).toEqual([1]);
    expect(await ids(como(11, ROLES.ADMIN))).toEqual([2]);
    expect((await ids(admin())).sort()).toEqual([1, 2]);
    expect(await ids(como(12, ROLES.ADMIN))).toEqual([]);
  });

  it('un admin no cancela la solicitud de un sitio que no es de su cartera', async () => {
    await pedir(2, 6);
    expect((await como(10, ROLES.ADMIN).cancelar(1, { categoria: 'ya_no_se_necesita' })).status).toBe(404);
    expect((await como(11, ROLES.ADMIN).cancelar(1, { categoria: 'ya_no_se_necesita' })).status).toBe(200);
  });
});
