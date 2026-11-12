import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type ResultadoEmergencia, type Rol, type TipoEmergencia } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import { createEmergenciasModule, crearServicioEmergencias } from '../src/modules/emergencias';
import {
  EmergenciasRepository,
  type EmergenciaRow,
  type NuevaEmergencia,
  type SitioDeGuardia,
} from '../src/modules/emergencias/emergencias.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

/*
 * Carteras de la prueba (A-65): super admin 1; admin A = 10 y admin B = 11.
 *   Supervisores: 5 (de A) y 6 (de B). Guardias: 21 (de A, en POETAS con el supervisor 5), 22 (de A, sin sitio),
 *   31 (de B, en PLAZA con el supervisor 6) y 40 (sin dueño ni sitio).
 */
const NOMBRES: Record<number, string> = {
  1: 'Super Ada',
  10: 'Admin A',
  11: 'Admin B',
  5: 'Sofía Sup',
  6: 'Pedro Sup',
  21: 'Juan Pérez',
  22: 'Ana Ruiz',
  31: 'Luis Gómez',
  40: 'Nadia Libre',
  90: 'Carla C2',
};
const ROL_DE: Record<number, string> = {
  1: 'admin',
  10: 'admin',
  11: 'admin',
  5: 'supervisor',
  6: 'supervisor',
  21: 'guardia',
  22: 'guardia',
  31: 'guardia',
  40: 'guardia',
  90: 'c2',
};
const DUENO: Record<number, number | null> = { 5: 10, 6: 11, 21: 10, 22: 10, 31: 11, 40: null };

/** Teléfonos de la prueba: [de contacto de la empresa, personal]. */
const TELEFONOS: Record<number, [string | null, string | null]> = {
  21: ['5521000000', '5521111111'],
  5: ['5505000000', null],
  10: ['5510000000', '5510111111'],
};

class Memoria extends EmergenciasRepository {
  filas: EmergenciaRow[] = [];
  /** Cuentas del C2 activas. */
  c2: number[] = [];
  sitios: Record<number, SitioDeGuardia | null> = {
    21: { id: 3, nombre: 'POETAS', supervisorId: 5 },
    31: { id: 4, nombre: 'PLAZA', supervisorId: 6 },
  };
  async crear(d: NuevaEmergencia, destinatarios: number[]) {
    const sitio = d.sitioId ? Object.values(this.sitios).find((s) => s?.id === d.sitioId) : null;
    const f: EmergenciaRow = {
      id: this.filas.length + 1,
      estado: 'activa',
      usuario: { id: d.usuarioId, nombre: NOMBRES[d.usuarioId], rol: ROL_DE[d.usuarioId], telefono: null, telefonoEtiqueta: null },
      destinatarios,
      lanzadaPorSuper: d.usuarioId === 1,
      sitio: sitio ? { id: sitio.id, nombre: sitio.nombre } : null,
      sitioSupervisorId: sitio?.supervisorId ?? null,
      tipo: null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      precisionM: d.precisionM ?? null,
      bateria: d.bateria ?? null,
      createdAt: new Date('2026-11-03T16:00:00.000Z'),
      acusadaPor: null,
      acusadaEn: null,
      escaladas: 0,
      cerradaEn: null,
      cerradaPor: null,
      resultado: null,
      nota: null,
    };
    this.filas.push(f);
    return f;
  }
  async guardarDestinatarios(id: number, ids: number[]) {
    this.filas[id - 1].destinatarios = ids;
  }
  async findById(id: number) {
    return this.filas.find((f) => f.id === id) ?? null;
  }
  async activaDe(usuarioId: number) {
    return this.filas.find((f) => f.usuario.id === usuarioId && f.estado === 'activa') ?? null;
  }
  async listar(soloActivas: boolean) {
    return this.filas.filter((f) => !soloActivas || f.estado === 'activa').reverse();
  }
  async acusar(id: number, _porId: number, por: string, en: Date) {
    Object.assign(this.filas[id - 1], { acusadaPor: por, acusadaEn: en });
  }
  async fijarTipo(id: number, tipo: TipoEmergencia) {
    this.filas[id - 1].tipo = tipo;
  }
  async cerrar(
    id: number,
    c: { cerradaEn: Date; cerradaPor: string; resultado: ResultadoEmergencia; nota: string | null },
  ) {
    Object.assign(this.filas[id - 1], { estado: 'cerrada', ...c });
  }
  private escaladaEn = new Map<number, Date>();
  async porEscalar(creadasAntes: Date, escaladasAntes: Date) {
    return this.filas.filter(
      (f) =>
        f.estado === 'activa' &&
        !f.acusadaEn &&
        f.createdAt <= creadasAntes &&
        (!this.escaladaEn.get(f.id) || this.escaladaEn.get(f.id)! <= escaladasAntes),
    );
  }
  async marcarEscalada(id: number, en: Date) {
    this.filas[id - 1].escaladas++;
    this.escaladaEn.set(id, en);
  }
  async sitioDe(usuarioId: number) {
    return this.sitios[usuarioId] ?? null;
  }
  async adminsDe({ guardiaId }: { guardiaId?: number | null; sitioId?: number | null }) {
    const d = guardiaId ? DUENO[guardiaId] : null;
    return d ? [d] : [];
  }
  async propietarioDe(id: number) {
    return DUENO[id] ?? null;
  }
  async supervisoresDe(adminId: number) {
    return Object.entries(DUENO)
      .filter(([id, d]) => d === adminId && ROL_DE[Number(id)] === 'supervisor')
      .map(([id]) => Number(id));
  }
  async superAdmins() {
    return [1];
  }
  async todosAdmins() {
    return [1, 10, 11];
  }
  async nombreDe(id: number) {
    return NOMBRES[id] ?? null;
  }
  async usuariosC2() {
    return this.c2;
  }
  async personasDe(ids: number[]) {
    return ids.map((id) => ({
      id,
      nombre: NOMBRES[id],
      rol: ROL_DE[id],
      telefono: TELEFONOS[id]?.[0] ?? null,
      telefonoPersonal: TELEFONOS[id]?.[1] ?? null,
    }));
  }
  async contactoDe(id: number) {
    return id === 5 ? { nombre: NOMBRES[5], telefono: '5550001111', telefonoEtiqueta: 'empresa' as const } : null;
  }
}

let repo: Memoria;
let audit: MemoryAuditLogger;
let ahora: Date;
let avisos: { usuarioIds: number[]; titulo?: string; mensaje: string; urgente?: boolean }[];
let atendidos: { entidad: string; resultado: string }[];
let eventosC2: { tipo: string; sitioId?: number | null; detalle?: string | null; usuarioId?: number | null; usuarioNombre?: string | null; minutos?: number | null }[];
let app: ReturnType<typeof createApp>;
let servicio: ReturnType<typeof crearServicioEmergencias>;

const deps = () => ({
  repo,
  audit,
  ahora: () => ahora,
  bitacoraC2: async (e: (typeof eventosC2)[number]) => void eventosC2.push(e),
  avisar: async (usuarioIds: number[], a: { titulo?: string; mensaje: string; urgente?: boolean }) =>
    void avisos.push({ usuarioIds: [...usuarioIds].sort((x, y) => x - y), titulo: a.titulo, mensaje: a.mensaje, urgente: a.urgente }),
  atencion: {
    atender: async (e: { tipo: string; id: number }, a: { resultado: string }) =>
      void atendidos.push({ entidad: `${e.tipo}:${e.id}`, resultado: a.resultado }),
    reabrir: async () => undefined,
  },
});

const token = (id: number, rol: Rol, extra: { esSuperAdmin?: boolean } = {}) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol], ...extra })}`;
const como = (id: number, rol: Rol, extra: { esSuperAdmin?: boolean } = {}) => ({
  get: (u = '') => request(app).get(`/api/emergencias${u}`).set('Authorization', token(id, rol, extra)),
  post: (u = '', b: object = {}) => request(app).post(`/api/emergencias${u}`).set('Authorization', token(id, rol, extra)).send(b),
});
const superAdmin = () => como(1, ROLES.ADMIN, { esSuperAdmin: true });
const adminA = () => como(10, ROLES.ADMIN);
const adminB = () => como(11, ROLES.ADMIN);
const supA = () => como(5, ROLES.SUPERVISOR);
const supB = () => como(6, ROLES.SUPERVISOR);
const juan = () => como(21, ROLES.GUARDIA);
const ana = () => como(22, ROLES.GUARDIA);
const luis = () => como(31, ROLES.GUARDIA);
const nadia = () => como(40, ROLES.GUARDIA);

beforeEach(() => {
  repo = new Memoria();
  audit = new MemoryAuditLogger();
  ahora = new Date('2026-11-03T16:00:00.000Z');
  avisos = [];
  atendidos = [];
  eventosC2 = [];
  app = createApp([createEmergenciasModule(deps())]);
  servicio = crearServicioEmergencias(deps());
});

describe('botón de pánico (A-60)', () => {
  it('el guardia la lanza sin preguntar nada: avisa a su supervisor y a su admin con alerta urgente', async () => {
    const r = await juan().post('', { lat: 19.43, lng: -99.13, bateria: 40 });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ estado: 'activa', tipo: null, lat: 19.43, bateria: 40, sitio: { nombre: 'POETAS' } });
    expect(avisos).toHaveLength(1);
    // Supervisor 5 y su admin (10). No se entera el admin B ni el super admin.
    expect(avisos[0].usuarioIds).toEqual([5, 10]);
    expect(avisos[0]).toMatchObject({ titulo: 'EMERGENCIA', urgente: true });
    expect(avisos[0].mensaje).toBe('Juan Pérez pidió ayuda en POETAS');
    expect(audit.acciones()).toContain('emergencias.crear');
    expect(r.body.data.supervisor).toEqual({ nombre: 'Sofía Sup', telefono: '5550001111', telefonoEtiqueta: 'empresa' });
    expect((await juan().get('/mia')).body.data.supervisor.nombre).toBe('Sofía Sup');
  });

  it('sin ubicación también se manda (el GPS puede fallar justo en una emergencia)', async () => {
    const r = await ana().post('');
    expect(r.status).toBe(201);
    expect(r.body.data.lat).toBeNull();
    expect(r.body.data.supervisor).toBeNull();
    // Ana no tiene sitio ni supervisor: le llega a su admin dueño.
    expect(avisos[0].usuarioIds).toEqual([10]);
  });

  it('un guardia sin dueño ni sitio: no se pierde, le llega al super admin', async () => {
    await nadia().post('');
    expect(avisos[0].usuarioIds).toEqual([1]);
  });

  it('un doble toque no duplica la alerta', async () => {
    const a = await juan().post('');
    const b = await juan().post('');
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(repo.filas).toHaveLength(1);
    expect(avisos).toHaveLength(1);
  });

  it('supervisor → su admin; admin → sus supervisores y el super admin; super admin → los demás admin', async () => {
    await supA().post('');
    expect(avisos.at(-1)!.usuarioIds).toEqual([10]);
    await supB().post('');
    expect(avisos.at(-1)!.usuarioIds).toEqual([11]);
    await adminA().post('');
    expect(avisos.at(-1)!.usuarioIds).toEqual([1, 5]);
    await superAdmin().post('');
    expect(avisos.at(-1)!.usuarioIds).toEqual([10, 11]);
  });

  it('el cliente no tiene botón', async () => {
    expect((await como(20, ROLES.CLIENTE).post('')).status).toBe(403);
  });

  it('el guardia elige el tipo después de enviar, solo en la suya', async () => {
    const { body } = await juan().post('');
    const id = body.data.id;
    expect((await juan().post(`/${id}/tipo`, { tipo: 'intruso' })).body.data.tipo).toBe('intruso');
    expect((await ana().post(`/${id}/tipo`, { tipo: 'incendio' })).status).toBe(404);
    expect((await juan().post(`/${id}/tipo`, { tipo: 'ovni' })).status).toBe(400);
  });

  it('"Fue sin querer" la cierra como falsa alarma y avisa a quienes la recibieron', async () => {
    const id = (await juan().post('')).body.data.id;
    avisos.length = 0;
    const r = await juan().post(`/${id}/cancelar`);
    expect(r.body.data).toMatchObject({ estado: 'cerrada', resultado: 'falsa_alarma' });
    expect(avisos[0]).toMatchObject({ usuarioIds: [5, 10], titulo: 'Falsa alarma', mensaje: 'Juan Pérez avisó que fue sin querer' });
    expect(atendidos[0]).toEqual({ entidad: `emergencia:${id}`, resultado: 'Falsa alarma (sin querer)' });
    expect((await juan().post(`/${id}/cancelar`)).status).toBe(409);
    expect((await juan().post('')).body.data.id).not.toBe(id);
  });

  it('el guardia ve la suya activa; solo quienes la recibieron ven la lista; el guardia no', async () => {
    expect((await juan().get('/mia')).body.data).toBeNull();
    await juan().post('');
    expect((await juan().get('/mia')).body.data.estado).toBe('activa');
    expect((await ana().get('/mia')).body.data).toBeNull();
    const lista = (await supA().get()).body.data;
    expect(lista).toMatchObject({ activas: 1 });
    expect(lista.items[0]).toMatchObject({ paraMi: true, usuario: { nombre: 'Juan Pérez' } });
    expect((await juan().get()).status).toBe(403);
  });

  it('una emergencia solo la ven y atienden quienes la recibieron (el super admin la ve, pero no le salta)', async () => {
    const id = (await juan().post('')).body.data.id; // la reciben 5 y 10
    for (const otro of [adminB(), supB()]) {
      expect((await otro.get()).body.data.items).toEqual([]);
      expect((await otro.post(`/${id}/acusar`)).status).toBe(404);
      expect((await otro.post(`/${id}/cerrar`, { resultado: 'atendida' })).status).toBe(404);
    }
    const delSuper = (await superAdmin().get()).body.data.items;
    expect(delSuper).toHaveLength(1);
    expect(delSuper[0].paraMi).toBe(false);
    expect((await superAdmin().post(`/${id}/acusar`)).status).toBe(200);
  });

  it('"Voy en camino" registra quién la recibió, le avisa al guardia y atiende los avisos', async () => {
    const id = (await juan().post('')).body.data.id;
    avisos.length = 0;
    const r = await supA().post(`/${id}/acusar`);
    expect(r.body.data).toMatchObject({ acusadaPor: 'Sofía Sup', acusadaEn: ahora.toISOString() });
    expect(avisos[0]).toMatchObject({ usuarioIds: [21], mensaje: 'Sofía Sup recibió tu alerta y va en camino' });
    expect(atendidos[0].resultado).toBe('En camino');
    expect((await adminA().post(`/${id}/acusar`)).body.data.acusadaPor).toBe('Sofía Sup');
    expect((await juan().post(`/${id}/acusar`)).status).toBe(403);
  });

  it('se cierra con resultado; "otro" pide nota; ya cerrada no se vuelve a cerrar', async () => {
    const id = (await juan().post('')).body.data.id;
    expect((await adminA().post(`/${id}/cerrar`, { resultado: 'otro' })).status).toBe(400);
    const r = await adminA().post(`/${id}/cerrar`, { resultado: 'atendida', nota: 'Se llamó a la policía' });
    expect(r.body.data).toMatchObject({ estado: 'cerrada', resultado: 'atendida', cerradaPor: 'Admin A' });
    expect(atendidos.at(-1)?.resultado).toBe('Atendida');
    expect((await adminA().post(`/${id}/cerrar`, { resultado: 'atendida' })).status).toBe(409);
    expect((await adminA().get()).body.data.activas).toBe(0);
    expect((await adminA().get('?estado=todas')).body.data.items).toHaveLength(1);
    expect(audit.acciones()).toEqual(expect.arrayContaining(['emergencias.cerrar']));
  });

  it('si nadie la recibe en un minuto se repite a los mismos y al super admin, y se sigue repitiendo', async () => {
    const id = (await juan().post('')).body.data.id;
    avisos.length = 0;
    await servicio.escalar();
    expect(avisos).toHaveLength(0); // aún no pasa un minuto

    ahora = new Date(ahora.getTime() + 61_000);
    await servicio.escalar();
    expect(avisos).toHaveLength(1);
    expect(avisos[0].usuarioIds).toEqual([1, 5, 10]);
    expect(avisos[0]).toMatchObject({ titulo: 'SIN RESPUESTA', urgente: true });
    expect(repo.filas[0].escaladas).toBe(1);
    // Desde ahora el super admin también la recibe: le salta la alerta y puede atenderla.
    expect((await superAdmin().get()).body.data.items[0].paraMi).toBe(true);

    await servicio.escalar(); // el mismo minuto no repite
    expect(avisos).toHaveLength(1);
    ahora = new Date(ahora.getTime() + 61_000);
    await servicio.escalar();
    expect(avisos).toHaveLength(2);
    expect(audit.acciones().filter((a) => a === 'emergencias.escalar')).toHaveLength(2);
    expect((await adminB().post(`/${id}/acusar`)).status).toBe(404);
  });

  it('una acusada o cerrada ya no se escala', async () => {
    const id = (await juan().post('')).body.data.id;
    await supA().post(`/${id}/acusar`);
    avisos.length = 0;
    ahora = new Date(ahora.getTime() + 120_000);
    await servicio.escalar();
    expect(avisos).toHaveLength(0);
  });

  it('la de un guardia de otro admin no le llega al admin A', async () => {
    await luis().post('');
    expect(avisos[0].usuarioIds).toEqual([6, 11]);
    expect((await adminA().get()).body.data.items).toEqual([]);
  });
});

describe('el C2 en las emergencias (A-61)', () => {
  const c2 = () => como(90, ROLES.C2);

  it('recibe toda emergencia, en paralelo con la cadena de supervisor y admin', async () => {
    repo.c2 = [90];
    await juan().post('');
    expect(avisos[0].usuarioIds).toEqual([5, 10, 90]);
    expect((await c2().get()).body.data.items).toHaveLength(1);
    // También las de un supervisor y las de un guardia sin dueño.
    await supA().post('');
    expect(avisos.at(-1)!.usuarioIds).toEqual([10, 90]);
    await nadia().post('');
    expect(avisos.at(-1)!.usuarioIds).toEqual([1, 90]);
  });

  it('sin cuentas de C2 todo queda como antes', async () => {
    await juan().post('');
    expect(avisos[0].usuarioIds).toEqual([5, 10]);
  });

  it('"Estamos atendiendo": queda como "Carla C2", avisa a quien la lanzó y a supervisor, admin y demás; sigue activa', async () => {
    repo.c2 = [90];
    const id = (await juan().post('')).body.data.id;
    avisos.length = 0;
    const r = await c2().post(`/${id}/acusar`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ estado: 'activa', acusadaPor: 'Carla C2 (C2)' });
    expect(avisos[0]).toMatchObject({ usuarioIds: [21], mensaje: 'Carla C2 (C2) recibió tu alerta y la está atendiendo' });
    expect(avisos[1]).toMatchObject({ usuarioIds: [5, 10], titulo: 'La están atendiendo' });
    expect(avisos[1].mensaje).toBe('Carla C2 (C2) atiende la emergencia de Juan Pérez en POETAS');
    expect(atendidos.at(-1)?.resultado).toBe('Atendiendo');
    // Repetir el toque no vuelve a avisar.
    avisos.length = 0;
    await c2().post(`/${id}/acusar`);
    expect(avisos).toHaveLength(0);
  });

  it('si el supervisor la atiende primero, el C2 se entera y la emergencia sigue activa', async () => {
    repo.c2 = [90];
    const id = (await juan().post('')).body.data.id;
    avisos.length = 0;
    await supA().post(`/${id}/acusar`);
    expect(avisos[1].usuarioIds).toEqual([10, 90]);
    expect(avisos[1].mensaje).toBe('Sofía Sup atiende la emergencia de Juan Pérez en POETAS');
    expect((await c2().get()).body.data.items[0].estado).toBe('activa');
  });

  it('el C2 no cierra emergencias ni las lanza, y solo ve las que le llegaron', async () => {
    repo.c2 = [90];
    const id = (await juan().post('')).body.data.id;
    expect((await c2().post(`/${id}/cerrar`, { resultado: 'atendida' })).status).toBe(403);
    expect((await c2().post('')).status).toBe(403);
    repo.c2 = [];
    const otro = (await luis().post('')).body.data.id;
    expect((await c2().post(`/${otro}/acusar`)).status).toBe(404);
  });

  it('el supervisor ve todos los números del guardia y del sitio; el C2 ve además el del admin', async () => {
    repo.c2 = [90];
    await juan().post('');
    // Supervisor 5: el guardia con sus dos números (no se incluye a sí mismo).
    const delSup = (await supA().get()).body.data.items[0].contactos;
    expect(delSup).toEqual([
      {
        nombre: 'Juan Pérez',
        cargo: 'guardia',
        telefonos: [
          { numero: '5521111111', etiqueta: 'personal' },
          { numero: '5521000000', etiqueta: 'empresa' },
        ],
      },
    ]);
    // Admin A: el guardia y el supervisor del sitio.
    const delAdmin = (await adminA().get()).body.data.items[0].contactos;
    expect(delAdmin.map((c: { nombre: string }) => c.nombre)).toEqual(['Juan Pérez', 'Sofía Sup']);
    // C2: guardia, supervisor y admin con todos sus números.
    const delC2 = (await c2().get()).body.data.items[0].contactos;
    expect(delC2.map((c: { nombre: string; cargo: string }) => `${c.cargo}:${c.nombre}`)).toEqual([
      'guardia:Juan Pérez',
      'supervisor:Sofía Sup',
      'admin:Admin A',
    ]);
    expect(delC2[2].telefonos).toHaveLength(2);
    // El supervisor sin teléfono personal solo tiene el de la empresa.
    expect(delC2[1].telefonos).toEqual([{ numero: '5505000000', etiqueta: 'empresa' }]);
  });
});

describe('bitácora del C2 en las emergencias (A-80)', () => {
  const c2 = () => como(90, ROLES.C2);

  it('cada paso del SOS queda registrado: lanzado, quién lo atiende y cerrado con resultado y nota', async () => {
    repo.c2 = [90];
    const id = (await juan().post('', { bateria: 69 })).body.data.id;
    expect(eventosC2).toEqual([{ tipo: 'sos_lanzado', sitioId: 3, detalle: 'Juan Pérez · batería 69%', usuarioId: 21, entidad: { tipo: 'emergencia', id } }]);
    await c2().post(`/${id}/acusar`);
    await supA().post(`/${id}/acusar`);
    expect(eventosC2.filter((e) => e.tipo === 'sos_atendiendo').map((e) => e.usuarioNombre)).toEqual(['Carla C2 (C2)', 'Sofía Sup']);
    ahora = new Date(ahora.getTime() + 8 * 60_000);
    await adminA().post(`/${id}/cerrar`, { resultado: 'atendida', nota: 'Se habló con el guardia' });
    expect(eventosC2.at(-1)).toMatchObject({ tipo: 'sos_cerrado', sitioId: 3, detalle: 'Atendida · Se habló con el guardia', usuarioNombre: 'Admin A', minutos: 8 });
  });

  it('repetir el "estamos atendiendo" de la misma persona no duplica la línea', async () => {
    repo.c2 = [90];
    const id = (await juan().post('')).body.data.id;
    await c2().post(`/${id}/acusar`);
    await c2().post(`/${id}/acusar`);
    expect(eventosC2.filter((e) => e.tipo === 'sos_atendiendo')).toHaveLength(1);
  });

  it('"fue sin querer" y la alerta sin respuesta también quedan', async () => {
    const id = (await juan().post('')).body.data.id;
    ahora = new Date(ahora.getTime() + 120_000);
    await servicio.escalar();
    expect(eventosC2.at(-1)).toMatchObject({ tipo: 'sos_sin_respuesta', sitioId: 3 });
    await juan().post(`/${id}/cancelar`);
    expect(eventosC2.at(-1)).toMatchObject({ tipo: 'sos_cerrado', detalle: 'Falsa alarma: fue sin querer (la canceló quien la lanzó)' });
  });
});
