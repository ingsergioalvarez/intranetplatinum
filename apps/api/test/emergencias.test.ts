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

const NOMBRES: Record<number, string> = { 1: 'Admin Ada', 5: 'Sofía Sup', 6: 'Pedro Sup', 10: 'Juan Pérez', 11: 'Ana Ruiz' };
const ROL_DE: Record<number, string> = { 1: 'admin', 5: 'supervisor', 6: 'supervisor', 10: 'guardia', 11: 'guardia' };

class Memoria extends EmergenciasRepository {
  filas: EmergenciaRow[] = [];
  /** Sitio de cada guardia (el de Juan lo supervisa Sofía; Ana no tiene). */
  sitios: Record<number, SitioDeGuardia | null> = {
    10: { id: 3, nombre: 'POETAS', supervisorId: 5 },
    11: null,
  };
  async crear(d: NuevaEmergencia) {
    const sitio = d.sitioId ? Object.values(this.sitios).find((s) => s?.id === d.sitioId) : null;
    const f: EmergenciaRow = {
      id: this.filas.length + 1,
      estado: 'activa',
      usuario: { id: d.usuarioId, nombre: NOMBRES[d.usuarioId], rol: ROL_DE[d.usuarioId], telefono: null },
      sitio: sitio ? { id: sitio.id, nombre: sitio.nombre } : null,
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
  async admins() {
    return [1];
  }
  async supervisores() {
    return [5, 6];
  }
  async nombreDe(id: number) {
    return NOMBRES[id] ?? null;
  }
}

let repo: Memoria;
let audit: MemoryAuditLogger;
let ahora: Date;
let avisos: { usuarioIds: number[]; titulo?: string; mensaje: string; urgente?: boolean }[];
let atendidos: { entidad: string; resultado: string }[];
let app: ReturnType<typeof createApp>;
let servicio: ReturnType<typeof crearServicioEmergencias>;

const deps = () => ({
  repo,
  audit,
  ahora: () => ahora,
  avisar: async (usuarioIds: number[], a: { titulo?: string; mensaje: string; urgente?: boolean }) =>
    void avisos.push({ usuarioIds, titulo: a.titulo, mensaje: a.mensaje, urgente: a.urgente }),
  atencion: {
    atender: async (e: { tipo: string; id: number }, a: { resultado: string }) =>
      void atendidos.push({ entidad: `${e.tipo}:${e.id}`, resultado: a.resultado }),
    reabrir: async () => undefined,
  },
});

const token = (id: number, rol: Rol) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol] })}`;
const como = (id: number, rol: Rol) => ({
  get: (u = '') => request(app).get(`/api/emergencias${u}`).set('Authorization', token(id, rol)),
  post: (u = '', b: object = {}) => request(app).post(`/api/emergencias${u}`).set('Authorization', token(id, rol)).send(b),
});
const admin = () => como(1, ROLES.ADMIN);
const sofia = () => como(5, ROLES.SUPERVISOR);
const juan = () => como(10, ROLES.GUARDIA);
const ana = () => como(11, ROLES.GUARDIA);

beforeEach(() => {
  repo = new Memoria();
  audit = new MemoryAuditLogger();
  ahora = new Date('2026-11-03T16:00:00.000Z');
  avisos = [];
  atendidos = [];
  app = createApp([createEmergenciasModule(deps())]);
  servicio = crearServicioEmergencias(deps());
});

describe('botón de pánico (A-60)', () => {
  it('el guardia la lanza sin preguntar nada: avisa a su supervisor y a los admin con alerta urgente', async () => {
    const r = await juan().post('', { lat: 19.43, lng: -99.13, bateria: 40 });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ estado: 'activa', tipo: null, lat: 19.43, bateria: 40, sitio: { nombre: 'POETAS' } });
    expect(avisos).toHaveLength(1);
    // Sofía supervisa el sitio de Juan; Pedro no. El admin siempre se entera.
    expect(avisos[0].usuarioIds.sort()).toEqual([1, 5]);
    expect(avisos[0]).toMatchObject({ titulo: 'EMERGENCIA', urgente: true });
    expect(avisos[0].mensaje).toBe('Juan Pérez pidió ayuda en POETAS');
    expect(audit.acciones()).toContain('emergencias.crear');
  });

  it('sin ubicación también se manda (el GPS puede fallar justo en una emergencia)', async () => {
    const r = await ana().post('');
    expect(r.status).toBe(201);
    expect(r.body.data.lat).toBeNull();
    // Ana no tiene sitio: se avisa a todos los supervisores y admin.
    expect(avisos[0].usuarioIds.sort()).toEqual([1, 5, 6]);
  });

  it('un doble toque no duplica la alerta', async () => {
    const a = await juan().post('');
    const b = await juan().post('');
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(repo.filas).toHaveLength(1);
    expect(avisos).toHaveLength(1);
  });

  it('si la lanza un supervisor se avisa a los demás supervisores y a los admin, no a él', async () => {
    await sofia().post('');
    expect(avisos[0].usuarioIds.sort()).toEqual([1, 6]);
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
    expect(avisos[0]).toMatchObject({ titulo: 'Falsa alarma', mensaje: 'Juan Pérez avisó que fue sin querer' });
    expect(atendidos[0]).toEqual({ entidad: `emergencia:${id}`, resultado: 'Falsa alarma (sin querer)' });
    expect((await juan().post(`/${id}/cancelar`)).status).toBe(409);
    // Ya cerrada, un nuevo botón lanza otra alerta.
    expect((await juan().post('')).body.data.id).not.toBe(id);
  });

  it('el guardia ve la suya activa; admin y supervisor ven la lista; el guardia no', async () => {
    expect((await juan().get('/mia')).body.data).toBeNull();
    await juan().post('');
    expect((await juan().get('/mia')).body.data.estado).toBe('activa');
    expect((await ana().get('/mia')).body.data).toBeNull();
    const lista = (await sofia().get()).body.data;
    expect(lista).toMatchObject({ activas: 1 });
    expect(lista.items[0].usuario.nombre).toBe('Juan Pérez');
    expect((await juan().get()).status).toBe(403);
  });

  it('"Voy en camino" registra quién la recibió, le avisa al guardia y atiende los avisos', async () => {
    const id = (await juan().post('')).body.data.id;
    avisos.length = 0;
    const r = await sofia().post(`/${id}/acusar`);
    expect(r.body.data).toMatchObject({ acusadaPor: 'Sofía Sup', acusadaEn: ahora.toISOString() });
    expect(avisos[0]).toMatchObject({ usuarioIds: [10], mensaje: 'Sofía Sup recibió tu alerta y va en camino' });
    expect(atendidos[0].resultado).toBe('En camino');
    // Un segundo acuse no cambia quién la recibió primero.
    expect((await admin().post(`/${id}/acusar`)).body.data.acusadaPor).toBe('Sofía Sup');
    expect((await juan().post(`/${id}/acusar`)).status).toBe(403);
  });

  it('se cierra con resultado; "otro" pide nota; ya cerrada no se vuelve a cerrar', async () => {
    const id = (await juan().post('')).body.data.id;
    expect((await admin().post(`/${id}/cerrar`, { resultado: 'otro' })).status).toBe(400);
    const r = await admin().post(`/${id}/cerrar`, { resultado: 'atendida', nota: 'Se llamó a la policía' });
    expect(r.body.data).toMatchObject({ estado: 'cerrada', resultado: 'atendida', cerradaPor: 'Admin Ada' });
    expect(atendidos.at(-1)?.resultado).toBe('Atendida');
    expect((await admin().post(`/${id}/cerrar`, { resultado: 'atendida' })).status).toBe(409);
    expect((await admin().get()).body.data.activas).toBe(0);
    expect((await admin().get('?estado=todas')).body.data.items).toHaveLength(1);
    expect(audit.acciones()).toEqual(expect.arrayContaining(['emergencias.cerrar']));
  });

  it('si nadie la recibe en un minuto se repite a todos los supervisores y admin, y se sigue repitiendo', async () => {
    await juan().post('');
    avisos.length = 0;
    await servicio.escalar();
    expect(avisos).toHaveLength(0); // aún no pasa un minuto

    ahora = new Date(ahora.getTime() + 61_000);
    await servicio.escalar();
    expect(avisos).toHaveLength(1);
    expect(avisos[0].usuarioIds.sort()).toEqual([1, 5, 6]);
    expect(avisos[0]).toMatchObject({ titulo: 'SIN RESPUESTA', urgente: true });
    expect(repo.filas[0].escaladas).toBe(1);

    await servicio.escalar(); // el mismo minuto no repite
    expect(avisos).toHaveLength(1);
    ahora = new Date(ahora.getTime() + 61_000);
    await servicio.escalar();
    expect(avisos).toHaveLength(2);
    expect(audit.acciones().filter((a) => a === 'emergencias.escalar')).toHaveLength(2);
  });

  it('una acusada o cerrada ya no se escala', async () => {
    const id = (await juan().post('')).body.data.id;
    await sofia().post(`/${id}/acusar`);
    avisos.length = 0;
    ahora = new Date(ahora.getTime() + 120_000);
    await servicio.escalar();
    expect(avisos).toHaveLength(0);
  });
});
