import type { EventoNuevo } from '../src/modules/bitacora/registrar';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  PERMISOS_POR_ROL,
  ROLES,
  type AccesoCliente,
  type ClienteCreateData,
  type ClienteResumen,
  type Contacto,
  type ContactoData,
  type ReglasAviso,
  type Rol,
  type Sitio,
  type SitioData,
} from '@platinum/shared';
import { createApp } from '../src/app';
import { createClientesModule } from '../src/modules/clientes';
import { ClientesRepository } from '../src/modules/clientes/clientes.repository';
import { createSitiosModule } from '../src/modules/sitios';
import {
  SitiosRepository,
  type AsignacionData,
  type AsignacionDeGuardia,
  type CambioAsignacion,
  type TurnoEstado,
  type GuardiaEstado,
  type RangoAsignacion,
} from '../src/modules/sitios/sitios.repository';
import { calcularCambios, hoyISO, signAccessToken } from '../src/core';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const HOY = '2026-10-12';
const UNO_Y_UNO = { tipo: 'ciclo' as const, trabaja: 1, descansa: 1 };
const DIARIO = { tipo: 'diario' as const };

// ---------- Dobles en memoria ----------
class MemoryClientesRepository extends ClientesRepository {
  clientes: ClienteResumen[] = [];
  contactos: (Contacto & { deletedAt: string | null })[] = [];
  sitios: Sitio[] = [];
  terminados: number[] = [];

  async findById(id: number) {
    return this.clientes.find((c) => c.id === id) ?? null;
  }
  async findByRfc(rfc: string) {
    return this.clientes.find((c) => c.rfc === rfc) ?? null;
  }
  async findPaged() {
    return { items: this.clientes, total: this.clientes.length, page: 1, limit: 20 };
  }
  async create(data: ClienteCreateData) {
    const c: ClienteResumen = {
      id: this.clientes.length + 1,
      rfc: null,
      giro: null,
      direccionFiscal: null,
      telefono: null,
      email: null,
      notas: null,
      ...data,
      logoUrl: null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      totalSitios: 0,
      totalContactos: 0,
      responsable: null,
    };
    this.clientes.push(c);
    return c;
  }
  async update(id: number, data: Partial<ClienteCreateData>) {
    return Object.assign((await this.findById(id))!, data);
  }
  async softDelete(id: number) {
    (await this.findById(id))!.deletedAt = new Date().toISOString();
  }
  async restore(id: number) {
    (await this.findById(id))!.deletedAt = null;
  }
  async listContactos(clienteId: number) {
    return this.contactos.filter((c) => c.clienteId === clienteId && !c.deletedAt);
  }
  async findContacto(id: number) {
    return this.contactos.find((c) => c.id === id && !c.deletedAt) ?? null;
  }
  async createContacto(clienteId: number, data: ContactoData) {
    const c = { id: this.contactos.length + 1, clienteId, deletedAt: null, ...data } as Contacto & {
      deletedAt: null;
    };
    this.contactos.push(c);
    return c;
  }
  async updateContacto(id: number, data: ContactoData) {
    return Object.assign((await this.findContacto(id))!, data);
  }
  async softDeleteContacto(id: number) {
    this.contactos.find((c) => c.id === id)!.deletedAt = 'x';
  }
  async listSitios(clienteId: number) {
    return this.sitios.filter((s) => s.clienteId === clienteId);
  }
  async findSitio(id: number) {
    return this.sitios.find((s) => s.id === id) ?? null;
  }
  async createSitio(clienteId: number, data: SitioData) {
    const s = {
      id: this.sitios.length + 1,
      clienteId,
      direccion: null,
      referencias: null,
      lat: null,
      lng: null,
      ...data,
      deletedAt: null,
      asignacionesVigentes: 0,
      supervisor: null,
    } as Sitio;
    this.sitios.push(s);
    return s;
  }
  async updateSitio(id: number, data: Partial<SitioData>) {
    Object.assign((await this.findSitio(id))!, data);
  }
  async softDeleteSitio(id: number) {
    (await this.findSitio(id))!.deletedAt = 'x';
    this.terminados.push(id);
  }
  async restoreSitio(id: number) {
    (await this.findSitio(id))!.deletedAt = null;
  }
  usuarios: {
    id: number;
    nombre: string;
    email: string;
    rol: string;
    clienteId: number | null;
    deletedAt: string | null;
  }[] = [];
  private acceso(u: (typeof this.usuarios)[number]): AccesoCliente {
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      activo: !u.deletedAt,
      ultimoAcceso: null,
      debeCambiarPassword: true,
    };
  }
  async listAccesos(clienteId: number) {
    return this.usuarios.filter((u) => u.clienteId === clienteId && u.rol === ROLES.CLIENTE).map((u) => this.acceso(u));
  }
  async findUsuarioPorEmail(email: string) {
    return this.usuarios.find((u) => u.email === email) ?? null;
  }
  async findUsuarioPorId(id: number) {
    return this.usuarios.find((u) => u.id === id) ?? null;
  }
  async listClientesDisponibles() {
    return this.usuarios
      .filter((u) => u.rol === ROLES.CLIENTE && !u.clienteId && !u.deletedAt)
      .map(({ id, nombre, email }) => ({ id, nombre, email }));
  }
  async crearAcceso(clienteId: number, data: { nombre: string; email: string; passwordHash: string }) {
    const u = { id: 100 + this.usuarios.length, nombre: data.nombre, email: data.email, rol: ROLES.CLIENTE, clienteId, deletedAt: null };
    this.usuarios.push(u);
    return this.acceso(u);
  }
  async ligarAcceso(usuarioId: number, clienteId: number) {
    const u = this.usuarios.find((x) => x.id === usuarioId)!;
    u.clienteId = clienteId;
    return this.acceso(u);
  }
  reglas = new Map<number, ReglasAviso>();
  async getReglasAviso(id: number) {
    return this.reglas.get(id) ?? { porDefecto: 'supervisor' as const, porPrioridad: {} };
  }
  async setReglasAviso(id: number, r: ReglasAviso) {
    this.reglas.set(id, r);
  }
}

class MemorySitiosRepository extends SitiosRepository {
  sitio = {
    id: 1,
    nombre: 'Torre Norte',
    clienteId: 1,
    deletedAt: null as Date | null,
    clienteDeBaja: false,
    supervisorId: null as number | null,
  };
  guardias: GuardiaEstado[] = [
    { id: 3, nombre: 'Gabriel', rol: ROLES.GUARDIA, deletedAt: null },
    { id: 4, nombre: 'Lucía', rol: ROLES.GUARDIA, deletedAt: null },
    { id: 2, nombre: 'Sofía', rol: ROLES.SUPERVISOR, deletedAt: null },
  ];
  turnos = new Map<number, TurnoEstado>([
    [1, { id: 1, nombre: '24 h · 8:00', horas: 24, horaEntrada: '08:00', dias: UNO_Y_UNO, activo: true }],
    [2, { id: 2, nombre: '12 h noche', horas: 12, horaEntrada: '20:00', dias: DIARIO, activo: true }],
    [3, { id: 3, nombre: 'Viejo', horas: 12, horaEntrada: '07:00', dias: DIARIO, activo: false }],
    [4, { id: 4, nombre: '12 h día', horas: 12, horaEntrada: '08:00', dias: DIARIO, activo: true }],
  ]);
  grupos = [
    { id: 7, nombre: 'Nocturno Norte', deletedAt: null as Date | null },
    { id: 8, nombre: 'Eventos', deletedAt: new Date() as Date | null },
  ];
  asignaciones: (AsignacionData & { id: number })[] = [];

  async findSitio(id: number) {
    return id === 1 ? this.sitio : null;
  }
  async supervisores() {
    return this.guardias
      .filter((g) => g.rol === ROLES.SUPERVISOR)
      .map((g) => ({ id: g.id, nombre: g.nombre, email: `${g.id}@x.mx`, sitios: 0 }));
  }
  async setSupervisor(_sitioId: number, supervisorId: number | null) {
    this.sitio.supervisorId = supervisorId;
  }
  async findGuardia(id: number) {
    return this.guardias.find((g) => g.id === id) ?? null;
  }
  async findGrupo(id: number) {
    return this.grupos.find((g) => g.id === id) ?? null;
  }
  async integrantesGrupo(id: number) {
    return id === 7 ? [3, 4] : [];
  }
  private dto(a: AsignacionData & { id: number }, hoy: string) {
    return {
      id: a.id,
      sitioId: a.sitioId,
      tipo: a.tipo,
      guardia: a.usuarioId ? { id: a.usuarioId, nombre: 'G', email: 'g@x', telefono: null } : null,
      grupo: a.grupoId ? { id: a.grupoId, nombre: 'Grupo', integrantes: 2 } : null,
      turnoCatalogo: a.turnoId ? { id: a.turnoId, nombre: this.turnos.get(a.turnoId)!.nombre } : null,
      horas: a.horas ?? null,
      dias: a.dias ?? null,
      turno: a.turno ?? null,
      horaInicio: a.horaInicio ?? null,
      horaFin: a.horaFin ?? null,
      desde: a.desde,
      hasta: a.hasta ?? null,
      vigenteHasta: a.vigenteHasta,
      vigente: a.desde <= hoy && (!a.vigenteHasta || a.vigenteHasta >= hoy),
    };
  }
  async listAsignaciones(sitioId: number, hoy: string) {
    return this.asignaciones.filter((a) => a.sitioId === sitioId).map((a) => this.dto(a, hoy));
  }
  async findAsignacion(id: number, hoy: string) {
    const a = this.asignaciones.find((x) => x.id === id);
    return a ? this.dto(a, hoy) : null;
  }
  async haySolape(r: RangoAsignacion, excluirId?: number) {
    return this.asignaciones.some(
      (a) =>
        a.id !== excluirId &&
        a.sitioId === r.sitioId &&
        (r.usuarioId ? a.usuarioId === r.usuarioId : a.grupoId === r.grupoId) &&
        (!r.vigenteHasta || a.desde <= r.vigenteHasta) &&
        (!a.vigenteHasta || a.vigenteHasta >= r.desde),
    );
  }
  async createAsignacion(data: AsignacionData, hoy: string) {
    const a = { id: this.asignaciones.length + 1, ...data };
    this.asignaciones.push(a);
    return this.dto(a, hoy);
  }
  async updateAsignacion(id: number, data: CambioAsignacion) {
    const a = this.asignaciones.find((x) => x.id === id)!;
    if (data.turnoId) a.turnoId = data.turnoId;
    if (data.horas) a.horas = data.horas;
    if (data.dias) a.dias = data.dias;
    if (data.turno !== undefined) a.turno = data.turno;
    if (data.horaInicio) a.horaInicio = data.horaInicio;
    if (data.horaFin) a.horaFin = data.horaFin;
    if (data.hasta !== undefined) a.hasta = data.hasta;
    if (data.vigenteHasta !== undefined) a.vigenteHasta = data.vigenteHasta;
  }
  async misSitios() {
    return [];
  }
  async findTurno(id: number) {
    return this.turnos.get(id) ?? null;
  }
  async asignacionesDeGuardias(ids: number[], hoy: string) {
    const mapa = new Map<number, AsignacionDeGuardia[]>(ids.map((id) => [id, []]));
    for (const a of this.asignaciones.filter((x) => !x.vigenteHasta || x.vigenteHasta >= hoy)) {
      const de = a.usuarioId ? [a.usuarioId] : a.grupoId ? await this.integrantesGrupo(a.grupoId) : [];
      for (const id of de)
        mapa.get(id)?.push({
          asignacionId: a.id,
          tipo: a.tipo,
          turno: a.turno ?? null,
          horas: a.horas ?? null,
          dias: a.dias ?? null,
          horaInicio: a.horaInicio ?? null,
          horaFin: a.horaFin ?? null,
          desde: a.desde,
          hasta: a.hasta ?? null,
          sitio: { id: a.sitioId, nombre: a.sitioId === 1 ? this.sitio.nombre : 'Plaza Sur' },
          grupo: a.grupoId ? this.grupos.find((g) => g.id === a.grupoId)!.nombre : null,
          turnoId: a.turnoId ?? null,
          turnoNombre: a.turnoId ? this.turnos.get(a.turnoId)!.nombre : null,
        });
    }
    return mapa;
  }
  async guardiasActivos() {
    return this.guardias
      .filter((g) => g.rol === ROLES.GUARDIA)
      .map((g) => ({ id: g.id, nombre: g.nombre, email: `u${g.id}@x.mx`, fotoClave: null }));
  }
  async eliminarAsignacion(id: number) {
    this.asignaciones = this.asignaciones.filter((a) => a.id !== id);
  }
}

// ---------- Utilidades ----------
let clientes: MemoryClientesRepository;
let sitios: MemorySitiosRepository;
let audit: MemoryAuditLogger;
let avisos: { usuarioIds: number[]; tipo: string; mensaje: string }[];
let bitacora: EventoNuevo[];
let app: ReturnType<typeof createApp>;

const tokenDe = (id: number, rol: Rol) =>
  signAccessToken({ id, email: `u${id}@x.mx`, rol, permisos: PERMISOS_POR_ROL[rol] });
const SUPERVISOR = tokenDe(2, ROLES.SUPERVISOR);
const GUARDIA = tokenDe(3, ROLES.GUARDIA);
const ADMIN = tokenDe(1, ROLES.ADMIN);

const como = (t: string) => ({
  get: (u: string) => request(app).get(`/api${u}`).set('Authorization', `Bearer ${t}`),
  post: (u: string, b?: object) => request(app).post(`/api${u}`).set('Authorization', `Bearer ${t}`).send(b),
  put: (u: string, b?: object) => request(app).put(`/api${u}`).set('Authorization', `Bearer ${t}`).send(b),
  patch: (u: string, b?: object) =>
    request(app).patch(`/api${u}`).set('Authorization', `Bearer ${t}`).send(b),
  delete: (u: string) => request(app).delete(`/api${u}`).set('Authorization', `Bearer ${t}`),
});

beforeEach(async () => {
  clientes = new MemoryClientesRepository();
  sitios = new MemorySitiosRepository();
  audit = new MemoryAuditLogger();
  avisos = [];
  bitacora = [];
  app = createApp([
    createClientesModule({ repo: clientes, audit, hoy: () => HOY }),
    createSitiosModule({
      repo: sitios,
      audit,
      hoy: () => HOY,
      avisar: async (usuarioIds, { tipo, mensaje }) => void avisos.push({ usuarioIds, tipo, mensaje }),
      bitacora: async (e) => void bitacora.push(e),
    }),
  ]);
  await clientes.create({
    nombreComercial: 'Plaza Uno',
    razonSocial: 'Plaza Uno SA',
    rfc: 'PUN010101AB1',
    estatus: 'activo',
  });
  await clientes.create({ nombreComercial: 'Torre Dos', razonSocial: 'Torre Dos SA', estatus: 'activo' });
});

// ---------- Clientes ----------
describe('clientes (F2-02)', () => {
  it('permisos: supervisor administra; guardia no tiene acceso', async () => {
    expect((await como(SUPERVISOR).get('/clientes')).status).toBe(200);
    expect((await como(GUARDIA).get('/clientes')).status).toBe(403);
    expect((await como(GUARDIA).post('/clientes', {})).status).toBe(403);
  });

  it('crea normalizando RFC y rechaza RFC duplicado en el campo', async () => {
    const ok = await como(SUPERVISOR).post('/clientes', {
      nombreComercial: 'Nuevo',
      razonSocial: 'Nuevo SA',
      rfc: ' nue010101ab1 ',
      email: '',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ rfc: 'NUE010101AB1', email: null, estatus: 'activo' });
    expect(audit.acciones()).toContain('clientes.crear');

    const dup = await como(SUPERVISOR).post('/clientes', {
      nombreComercial: 'Otro',
      razonSocial: 'Otro SA',
      rfc: 'PUN010101AB1',
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.details[0].path).toBe('rfc');
  });

  it('PATCH parcial no reactiva un cliente suspendido y audita solo cambios', async () => {
    clientes.clientes[0].estatus = 'suspendido';
    const res = await como(SUPERVISOR).patch('/clientes/1', { giro: 'Comercial' });
    expect(res.body.data).toMatchObject({ estatus: 'suspendido', giro: 'Comercial' });
    expect(audit.eventos.at(-1)?.datos).toEqual({ antes: { giro: null }, despues: { giro: 'Comercial' } });
  });

  it('cliente de baja: no se edita ni se le agregan contactos/sitios; reactivar lo permite', async () => {
    expect((await como(SUPERVISOR).patch('/clientes/1/baja')).status).toBe(204);
    expect((await como(SUPERVISOR).patch('/clientes/1', { giro: 'X' })).status).toBe(409);
    expect((await como(SUPERVISOR).post('/clientes/1/contactos', { nombre: 'Ana' })).status).toBe(409);
    expect((await como(SUPERVISOR).post('/clientes/1/sitios', { nombre: 'Torre' })).status).toBe(409);
    expect((await como(SUPERVISOR).patch('/clientes/1/reactivar')).status).toBe(204);
    expect((await como(SUPERVISOR).patch('/clientes/1', { giro: 'X' })).status).toBe(200);
  });

  it('detalle incluye contactos y sitios; 404 si no existe', async () => {
    await como(SUPERVISOR).post('/clientes/1/contactos', { nombre: 'Laura', esResponsable: true });
    await como(SUPERVISOR).post('/clientes/1/sitios', { nombre: 'Torre A' });
    const res = await como(SUPERVISOR).get('/clientes/1');
    expect(res.body.data.contactos).toHaveLength(1);
    expect(res.body.data.sitios).toHaveLength(1);
    expect(res.body.data.totalSitios).toBeUndefined();
    expect((await como(SUPERVISOR).get('/clientes/99')).status).toBe(404);
  });
});

describe('reglas de aviso (F3-09)', () => {
  it('guarda la regla por defecto y descarta excepciones iguales a ella', async () => {
    const res = await como(ADMIN).put('/clientes/1/avisos', {
      porDefecto: 'supervisor',
      porPrioridad: { critica: 'ambos', baja: 'supervisor', media: null },
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ porDefecto: 'supervisor', porPrioridad: { critica: 'ambos' } });
    expect((await como(SUPERVISOR).get('/clientes/1')).body.data.reglasAviso.porPrioridad).toEqual({
      critica: 'ambos',
    });
    expect(audit.acciones()).toContain('clientes.reglas_aviso');
  });

  it('valida destinos y permisos', async () => {
    expect((await como(ADMIN).put('/clientes/1/avisos', { porDefecto: 'nadie' })).status).toBe(400);
    expect((await como(GUARDIA).put('/clientes/1/avisos', { porDefecto: 'ambos' })).status).toBe(403);
  });

  it('el supervisor no puede cambiar a quién se avisa (A-30)', async () => {
    const res = await como(SUPERVISOR).put('/clientes/1/avisos', { porDefecto: 'supervisor' });
    expect(res.status).toBe(403);
    expect(clientes.reglas.has(1)).toBe(false);
  });
});

describe('acceso del cliente (A-29)', () => {
  const alta = { nombre: 'Marta Ríos', email: 'MARTA@cliente.mx' };

  it('crea el usuario cliente con contraseña temporal y su contacto que recibe avisos', async () => {
    const res = await como(ADMIN).post('/clientes/1/accesos', alta);
    expect(res.status).toBe(201);
    expect(res.body.data.acceso).toMatchObject({ nombre: 'Marta Ríos', email: 'marta@cliente.mx' });
    expect(res.body.data.passwordTemporal).toHaveLength(12);
    const detalle = (await como(ADMIN).get('/clientes/1')).body.data;
    expect(detalle.accesos).toHaveLength(1);
    expect(detalle.contactos).toMatchObject([
      { email: 'marta@cliente.mx', recibeNotificaciones: true, esResponsable: true },
    ]);
    expect(audit.acciones()).toContain('clientes.acceso_crear');
  });

  it('liga a un usuario cliente elegido de la lista, sin contraseña nueva', async () => {
    clientes.usuarios.push({ id: 9, nombre: 'Comunicalo', email: 'comunicalo@platinum.com', rol: ROLES.CLIENTE, clienteId: null, deletedAt: null });
    const res = await como(ADMIN).post('/clientes/1/accesos', { usuarioId: 9 });
    expect(res.status).toBe(201);
    expect(res.body.data.passwordTemporal).toBeNull();
    expect(clientes.usuarios[0].clienteId).toBe(1);
    expect((await como(ADMIN).get('/clientes/1')).body.data.contactos).toMatchObject([
      { email: 'comunicalo@platinum.com', recibeNotificaciones: true },
    ]);
  });

  it('la lista de disponibles solo trae usuarios cliente sin cliente asignado', async () => {
    clientes.usuarios.push(
      { id: 9, nombre: 'Libre', email: 'libre@x.mx', rol: ROLES.CLIENTE, clienteId: null, deletedAt: null },
      { id: 10, nombre: 'Ocupado', email: 'ocupado@x.mx', rol: ROLES.CLIENTE, clienteId: 2, deletedAt: null },
      { id: 11, nombre: 'Sofía', email: 'sofia@x.mx', rol: ROLES.SUPERVISOR, clienteId: null, deletedAt: null },
      { id: 12, nombre: 'De baja', email: 'baja@x.mx', rol: ROLES.CLIENTE, clienteId: null, deletedAt: 'x' },
    );
    const res = await como(ADMIN).get('/clientes/1/accesos/disponibles');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: 9, nombre: 'Libre', email: 'libre@x.mx' }]);
    expect((await como(SUPERVISOR).get('/clientes/1/accesos/disponibles')).status).toBe(403);
  });

  it('máximo 2 usuarios activos por cliente', async () => {
    expect((await como(ADMIN).post('/clientes/1/accesos', alta)).status).toBe(201);
    expect((await como(ADMIN).post('/clientes/1/accesos', { nombre: 'Luis', email: 'luis@cliente.mx' })).status).toBe(201);
    const res = await como(ADMIN).post('/clientes/1/accesos', { nombre: 'Ana', email: 'ana@cliente.mx' });
    expect(res.status).toBe(409);
  });

  it('un correo que ya existe no se liga escribiéndolo: se elige de la lista', async () => {
    clientes.usuarios.push({ id: 5, nombre: 'Sofía', email: 'sofia@x.mx', rol: ROLES.SUPERVISOR, clienteId: null, deletedAt: null });
    clientes.usuarios.push({ id: 6, nombre: 'Libre', email: 'libre@x.mx', rol: ROLES.CLIENTE, clienteId: null, deletedAt: null });
    const supervisor = await como(ADMIN).post('/clientes/1/accesos', { nombre: 'Sofía', email: 'sofia@x.mx' });
    expect(supervisor.status).toBe(409);
    expect(supervisor.body.error.message).toContain('no es cliente');
    const cliente = await como(ADMIN).post('/clientes/1/accesos', { nombre: 'Libre', email: 'libre@x.mx' });
    expect(cliente.status).toBe(409);
    expect(cliente.body.error.message).toContain('elígelo de la lista');
    expect(clientes.usuarios.every((u) => u.clienteId === null)).toBe(true);
  });

  it('por id solo se liga a un usuario cliente libre', async () => {
    clientes.usuarios.push({ id: 5, nombre: 'Sofía', email: 'sofia@x.mx', rol: ROLES.SUPERVISOR, clienteId: null, deletedAt: null });
    clientes.usuarios.push({ id: 6, nombre: 'Otro', email: 'otro@x.mx', rol: ROLES.CLIENTE, clienteId: 2, deletedAt: null });
    expect((await como(ADMIN).post('/clientes/1/accesos', { usuarioId: 5 })).status).toBe(404);
    expect((await como(ADMIN).post('/clientes/1/accesos', { usuarioId: 6 })).status).toBe(409);
    expect((await como(ADMIN).post('/clientes/1/accesos', { usuarioId: 99 })).status).toBe(404);
  });

  it('solo el administrador da acceso', async () => {
    expect((await como(SUPERVISOR).post('/clientes/1/accesos', alta)).status).toBe(403);
    expect((await como(ADMIN).post('/clientes/1/accesos', { nombre: 'X', email: 'no-es-correo' })).status).toBe(400);
  });
});

describe('contactos (F2-03)', () => {
  it('varios contactos por cliente; notificaciones exigen correo', async () => {
    expect((await como(SUPERVISOR).post('/clientes/1/contactos', { nombre: 'Laura' })).status).toBe(201);
    expect((await como(SUPERVISOR).post('/clientes/1/contactos', { nombre: 'Pedro' })).status).toBe(201);
    const sinCorreo = await como(SUPERVISOR).post('/clientes/1/contactos', {
      nombre: 'Ana',
      recibeNotificaciones: true,
    });
    expect(sinCorreo.status).toBe(400);
    expect(sinCorreo.body.error.details[0].path).toBe('email');
    expect(await clientes.listContactos(1)).toHaveLength(2);
  });

  it('no permite editar o borrar un contacto de otro cliente', async () => {
    await como(SUPERVISOR).post('/clientes/1/contactos', { nombre: 'Laura' });
    expect((await como(SUPERVISOR).put('/clientes/2/contactos/1', { nombre: 'Xavier' })).status).toBe(404);
    expect((await como(SUPERVISOR).delete('/clientes/2/contactos/1')).status).toBe(404);
    expect((await como(SUPERVISOR).delete('/clientes/1/contactos/1')).status).toBe(204);
    expect(await clientes.listContactos(1)).toHaveLength(0);
  });
});

describe('sitios (F2-04)', () => {
  it('valida coordenadas y da de baja terminando asignaciones', async () => {
    const malo = await como(SUPERVISOR).post('/clientes/1/sitios', { nombre: 'Torre', lat: 200 });
    expect(malo.status).toBe(400);
    expect((await como(SUPERVISOR).post('/clientes/1/sitios', { nombre: 'Torre', lat: '19.4' })).status).toBe(
      201,
    );
    expect((await como(SUPERVISOR).patch('/clientes/1/sitios/1/baja')).status).toBe(204);
    expect(clientes.terminados).toEqual([1]);
    expect((await como(SUPERVISOR).put('/clientes/1/sitios/1', { nombre: 'Otro' })).status).toBe(409);
    expect((await como(SUPERVISOR).patch('/clientes/2/sitios/1/reactivar')).status).toBe(404);
    expect((await como(SUPERVISOR).patch('/clientes/1/sitios/1/reactivar')).status).toBe(204);
  });
});

// ---------- Asignaciones ----------
describe('asignación de sitios (F2-05, F2-07)', () => {
  const asignar = (b: object) => como(SUPERVISOR).post('/sitios/1/guardias', b);
  const fija = (b: object = {}) => ({
    usuarioId: 3,
    tipo: 'fija',
    turno: '24x24',
    horaInicio: '08:00',
    desde: HOY,
    ...b,
  });

  it('asigna solo a guardias activos o grupos activos, en sitios activos', async () => {
    const noGuardia = await asignar(fija({ usuarioId: 2 }));
    expect(noGuardia.status).toBe(400);
    expect(noGuardia.body.error.details[0].path).toBe('usuarioId');
    const grupoBaja = await asignar(fija({ usuarioId: undefined, grupoId: 8 }));
    expect(grupoBaja.body.error.details[0].path).toBe('grupoId');

    const ok = await asignar(fija({ turno: '24x24' }));
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ vigente: true, tipo: 'fija', turno: '24x24', hasta: null });
    expect(audit.acciones()).toContain('sitios.asignar');

    const grupo = await asignar(fija({ usuarioId: undefined, grupoId: 7 }));
    expect(grupo.status).toBe(201);
    expect(grupo.body.data.grupo).toMatchObject({ id: 7 });

    sitios.sitio.clienteDeBaja = true;
    expect((await asignar(fija({ desde: '2027-01-01' }))).status).toBe(409);
  });

  it('exige guardia o grupo (no ambos ni ninguno)', async () => {
    expect((await asignar(fija({ usuarioId: undefined }))).status).toBe(400);
    expect((await asignar(fija({ grupoId: 7 }))).body.error.details[0].path).toBe('usuarioId');
  });

  it('reglas por tipo: fija sin fin, temporal con fin, eventual con horario', async () => {
    expect((await asignar(fija({ hasta: '2026-12-31' }))).body.error.details[0].path).toBe('hasta');
    expect((await asignar(fija({ tipo: 'temporal' }))).body.error.details[0].path).toBe('hasta');
    const ev = await asignar({ usuarioId: 3, tipo: 'eventual', desde: '2026-10-20' });
    expect(ev.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'horaFin',
      'horaInicio',
    ]);
    const largo = await asignar({
      usuarioId: 3,
      tipo: 'eventual',
      desde: '2026-10-20',
      hasta: '2026-10-30',
      horaInicio: '08:00',
      horaFin: '18:00',
    });
    expect(largo.status).toBe(400);
  });

  it('evento que cruza medianoche sigue vigente la madrugada siguiente; no lleva turno', async () => {
    const r = await asignar({
      usuarioId: 3,
      tipo: 'eventual',
      turno: 'diurno',
      desde: '2026-10-11',
      horaInicio: '18:00',
      horaFin: '02:00',
    });
    expect(r.status).toBe(201);
    // HOY = 2026-10-12: el evento del día 11 que termina a las 02:00 sigue vigente.
    expect(r.body.data).toMatchObject({ vigente: true, turno: null, horaInicio: '18:00', horaFin: '02:00' });
    expect(sitios.asignaciones[0].vigenteHasta).toBe('2026-10-12');
  });

  it('rechaza cruces del mismo guardia o grupo; permite consecutivas', async () => {
    await asignar(fija({ tipo: 'temporal', desde: '2026-10-01', hasta: '2026-10-31' }));
    expect((await asignar(fija({ desde: '2026-10-31' }))).status).toBe(409);
    expect((await asignar(fija({ tipo: 'temporal', desde: '2026-09-01', hasta: '2026-10-01' }))).status).toBe(
      409,
    );
    expect((await asignar(fija({ desde: '2026-11-01' }))).status).toBe(201);
    // Otro destinatario (grupo) en las mismas fechas sí se permite.
    expect((await asignar(fija({ usuarioId: undefined, grupoId: 7, desde: '2026-10-05' }))).status).toBe(201);
  });

  it('terminar o cambiar turno; solo una fija puede quedar sin término', async () => {
    await asignar(fija({ desde: '2026-10-01' }));
    expect((await como(SUPERVISOR).patch('/sitios/1/guardias/1', { hasta: '2026-09-01' })).status).toBe(400);
    const fin = await como(SUPERVISOR).patch('/sitios/1/guardias/1', { hasta: HOY, turno: '12x12' });
    expect(fin.body.data).toMatchObject({ hasta: HOY, turno: '12x12', horaFin: '20:00', vigente: true });
    expect(audit.eventos.at(-1)?.datos).toMatchObject({ antes: { hasta: null }, despues: { hasta: HOY } });
    expect((await como(SUPERVISOR).patch('/sitios/2/guardias/1', { hasta: HOY })).status).toBe(404);

    await asignar(fija({ tipo: 'temporal', desde: '2026-11-01', hasta: '2026-11-30' }));
    expect((await como(SUPERVISOR).patch('/sitios/1/guardias/2', { hasta: null })).status).toBe(400);
  });

  it('guardia: solo /sitios/mios; no puede ver ni asignar', async () => {
    expect((await como(GUARDIA).get('/sitios/mios')).status).toBe(200);
    expect((await como(GUARDIA).get('/sitios/1/guardias')).status).toBe(403);
    expect((await como(GUARDIA).post('/sitios/1/guardias', {})).status).toBe(403);
  });
});

describe('utilidades', () => {
  it('hoyISO usa la zona del negocio', () => {
    const casiMedianocheUTC = new Date('2026-10-13T03:30:00Z'); // 21:30 del 12 en CDMX
    expect(hoyISO('America/Mexico_City', casiMedianocheUTC)).toBe('2026-10-12');
    expect(hoyISO('UTC', casiMedianocheUTC)).toBe('2026-10-13');
  });

  it('calcularCambios ignora undefined y valores iguales', () => {
    expect(calcularCambios({ a: 1, b: 'x', c: null }, { a: 1, b: 'y', c: undefined })).toEqual({
      antes: { b: 'x' },
      despues: { b: 'y' },
      hayCambios: true,
    });
  });
});

describe('horario del turno y avisos al guardia (DA-32, DA-34)', () => {
  const asignar = (b: object) => como(SUPERVISOR).post('/sitios/1/guardias', b);
  const base = { usuarioId: 3, tipo: 'fija', desde: '2026-10-22' };

  it('fija/temporal exigen turno de 24 o 12 h y hora de entrada; la salida se calcula', async () => {
    const sin = await asignar({ ...base, turno: 'diurno' });
    expect(sin.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'horaInicio',
      'turno',
    ]);
    const t24 = await asignar({ ...base, turno: '24x24', horaInicio: '08:00' });
    expect(t24.body.data).toMatchObject({ turno: '24x24', horaInicio: '08:00', horaFin: '08:00' });
    const t12 = await asignar({
      ...base,
      usuarioId: undefined,
      grupoId: 7,
      turno: '12x12',
      horaInicio: '20:00',
    });
    expect(t12.body.data).toMatchObject({ turno: '12x12', horaInicio: '20:00', horaFin: '08:00' });
  });

  it('avisa al guardia o a los integrantes del grupo al asignar y al cambiar el horario', async () => {
    await asignar({ ...base, turno: '24x24', horaInicio: '08:00' });
    expect(avisos[0]).toEqual({
      usuarioIds: [3],
      tipo: 'asignacion',
      mensaje: 'Te asignaron a Torre Norte: Turno de 24 h · entrada 8:00 a.m. · desde el 22 oct',
    });
    await asignar({ ...base, usuarioId: undefined, grupoId: 7, turno: '12x12', horaInicio: '19:30' });
    expect(avisos[1]).toMatchObject({
      usuarioIds: [3, 4],
      mensaje:
        'Tu grupo Grupo fue asignado a Torre Norte: Turno de 12 h · entrada 7:30 p.m. · desde el 22 oct',
    });

    await como(SUPERVISOR).patch('/sitios/1/guardias/1', { horaInicio: '07:00' });
    expect(avisos[2].mensaje).toBe(
      'Tu asignación en Torre Norte: nuevo horario: Turno de 24 h · entrada 7:00 a.m.',
    );
    expect(sitios.asignaciones[0]).toMatchObject({ horaInicio: '07:00', horaFin: '07:00' });
  });
});

describe('turnos del catálogo en el sitio: asignar en lote (DA-37)', () => {
  const asignarTurno = (b: object) => como(SUPERVISOR).post('/sitios/1/turnos', b);

  it('asigna un turno a varios guardias (Día A / Día B), copia horas y días y avisa a cada uno', async () => {
    const res = await asignarTurno({
      turnoId: 1,
      guardias: [
        { usuarioId: 3, desde: '2026-10-12' },
        { usuarioId: 4, desde: '2026-10-13' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      tipo: 'fija',
      horas: 24,
      dias: UNO_Y_UNO,
      horaInicio: '08:00',
      horaFin: '08:00',
      turnoCatalogo: { id: 1, nombre: '24 h · 8:00' },
      guardia: { id: 3 },
    });
    expect(avisos).toEqual([
      {
        usuarioIds: [3],
        tipo: 'asignacion',
        mensaje: 'Te asignaron a Torre Norte: 24 h · entrada 8:00 a.m. (un día sí, uno no) · desde el 12 oct',
      },
      expect.objectContaining({ usuarioIds: [4] }),
    ]);
    expect(audit.acciones().filter((a) => a === 'sitios.asignar')).toHaveLength(2);
  });

  it('a un grupo: avisa a sus integrantes; con fecha de fin queda temporal', async () => {
    const res = await asignarTurno({ turnoId: 2, hasta: '2026-12-31', grupos: [{ grupoId: 7, desde: HOY }] });
    expect(res.body.data[0]).toMatchObject({
      tipo: 'temporal',
      horaInicio: '20:00',
      horaFin: '08:00',
      grupo: { id: 7 },
    });
    expect(avisos[0]).toMatchObject({
      usuarioIds: [3, 4],
      mensaje:
        'Tu grupo Nocturno Norte fue asignado a Torre Norte: 12 h · entrada 8:00 p.m. (todos los días) · desde el 12 oct',
    });
  });

  it('mismo sitio y mismo horario: pasa al grupo sin cambiarle nada (sin aviso de horario)', async () => {
    await asignarTurno({ turnoId: 4, guardias: [{ usuarioId: 3, desde: HOY }] });
    avisos.length = 0;
    const res = await asignarTurno({ turnoId: 4, grupos: [{ grupoId: 7, desde: HOY }] });
    expect(res.status).toBe(201);
    // Su asignación individual se reemplaza por la del grupo.
    expect(sitios.asignaciones.map((a) => [a.usuarioId ?? null, a.grupoId ?? null])).toEqual([[null, 7]]);
    // Solo Lucía (a quien sí le cambia) recibe el aviso de su nuevo horario.
    expect(avisos.map((a) => a.usuarioIds)).toEqual([[4]]);
  });

  it('mismo sitio y otro horario: hay que elegir cambiarlo; con "reemplazar" su turno anterior termina un día antes', async () => {
    await asignarTurno({ turnoId: 2, guardias: [{ usuarioId: 3, desde: HOY }] });
    const sinElegir = await asignarTurno({ turnoId: 4, grupos: [{ grupoId: 7, desde: '2026-10-14' }] });
    expect(sinElegir.status).toBe(409);
    expect(sinElegir.body.error.message).toBe(
      'Gabriel (de Grupo Nocturno Norte) ya tiene otro horario en este sitio (12 h noche). Elige si lo cambias a este horario.',
    );
    avisos.length = 0;
    const res = await asignarTurno({
      turnoId: 4,
      grupos: [{ grupoId: 7, desde: '2026-10-14' }],
      reemplazar: [3],
    });
    expect(res.status).toBe(201);
    expect(sitios.asignaciones[0]).toMatchObject({
      usuarioId: 3,
      hasta: '2026-10-13',
      vigenteHasta: '2026-10-13',
    });
    // Los dos reciben su nuevo horario (a Gabriel le cambia de noche a día).
    expect(avisos[0].usuarioIds).toEqual([3, 4]);
    expect(audit.acciones()).toContain('sitios.reasignar');
  });

  it('otro sitio: solo se rechaza si los horarios se enciman', async () => {
    sitios.asignaciones.push({
      id: 50,
      sitioId: 2,
      usuarioId: 3,
      tipo: 'fija',
      turnoId: 2,
      horas: 12,
      dias: DIARIO,
      horaInicio: '20:00',
      horaFin: '08:00',
      desde: HOY,
      hasta: null,
      vigenteHasta: null,
    });
    // 12 h de día (8 a 20) no se encima con su noche en Plaza Sur.
    expect((await asignarTurno({ turnoId: 4, guardias: [{ usuarioId: 3, desde: HOY }] })).status).toBe(201);
    // 24 h sí.
    const cruce = await asignarTurno({
      turnoId: 1,
      guardias: [{ usuarioId: 4, desde: HOY }],
      grupos: [{ grupoId: 7, desde: '2026-10-13' }],
    });
    expect(cruce.status).toBe(409);
    expect(cruce.body.error.message).toMatch(/Gabriel \(de Grupo Nocturno Norte\)/);
  });

  it('ya está en este turno: no se duplica', async () => {
    await asignarTurno({ turnoId: 1, guardias: [{ usuarioId: 3, desde: HOY }] });
    const res = await asignarTurno({ turnoId: 1, guardias: [{ usuarioId: 3, desde: HOY }] });
    expect(res.body.error.message).toBe('Gabriel ya está en este turno');
  });

  it('valida: turno activo y al menos un guardia o grupo', async () => {
    expect((await asignarTurno({ turnoId: 3, guardias: [{ usuarioId: 3, desde: HOY }] })).status).toBe(400);
    const vacio = await asignarTurno({ turnoId: 1 });
    expect(vacio.body.error.details[0]).toMatchObject({ path: 'guardias' });
    expect((await asignarTurno({ turnoId: 1, guardias: [{ usuarioId: 2, desde: HOY }] })).status).toBe(400);
  });

  it('cancelar una asignación que aún no empieza (avisa); la que ya empezó se termina', async () => {
    await asignarTurno({ turnoId: 1, guardias: [{ usuarioId: 3, desde: '2026-10-20' }] });
    await asignarTurno({ turnoId: 1, guardias: [{ usuarioId: 4, desde: HOY }] });
    avisos.length = 0;
    expect((await como(SUPERVISOR).delete('/sitios/1/guardias/1')).status).toBe(204);
    expect(sitios.asignaciones.map((a) => a.id)).toEqual([2]);
    expect(avisos[0]).toEqual({
      usuarioIds: [3],
      tipo: 'asignacion',
      mensaje: 'Se canceló tu asignación en Torre Norte que empezaba el 20 oct',
    });
    expect((await como(SUPERVISOR).delete('/sitios/1/guardias/2')).status).toBe(409);
  });

  it('supervisor del sitio: se asigna, se cambia y se avisa a ambos (DA-45)', async () => {
    expect((await como(SUPERVISOR).get('/sitios/supervisores')).body.data).toEqual([
      { id: 2, nombre: 'Sofía', email: '2@x.mx', sitios: 0 },
    ]);
    expect((await como(SUPERVISOR).put('/sitios/1/supervisor', { supervisorId: 3 })).status).toBe(400);
    expect((await como(SUPERVISOR).put('/sitios/1/supervisor', { supervisorId: 2 })).status).toBe(204);
    expect(sitios.sitio.supervisorId).toBe(2);
    expect(avisos).toEqual([
      expect.objectContaining({
        usuarioIds: [2],
        mensaje: expect.stringMatching(/^Ahora supervisas Torre Norte/),
      }),
    ]);
    avisos.length = 0;
    await como(SUPERVISOR).put('/sitios/1/supervisor', { supervisorId: null });
    expect(avisos).toEqual([
      expect.objectContaining({ usuarioIds: [2], mensaje: 'Ya no supervisas Torre Norte' }),
    ]);
    expect(audit.acciones().filter((a) => a === 'sitios.supervisor')).toHaveLength(2);
  });

  it('el admin elimina al momento una asignación que ya empezó (aunque termine hoy) y avisa', async () => {
    await asignarTurno({ turnoId: 1, guardias: [{ usuarioId: 3, desde: '2026-10-01' }] });
    await como(SUPERVISOR).patch('/sitios/1/guardias/1', { hasta: HOY });
    avisos.length = 0;
    expect((await como(ADMIN).delete('/sitios/1/guardias/1')).status).toBe(204);
    expect(sitios.asignaciones).toEqual([]);
    expect(avisos).toEqual([
      { usuarioIds: [3], tipo: 'asignacion', mensaje: 'Ya no estás asignado a Torre Norte' },
    ]);
    expect(audit.acciones()).toContain('sitios.eliminar_asignacion');
    expect(bitacora.map((e) => [e.tipo, e.usuarioIds, e.detalle])).toEqual([
      ['asignacion', [3], expect.stringMatching(/^Asignado a Torre Norte: /)],
      ['asignacion_fin', [3], expect.stringMatching(/^Su asignación en Torre Norte termina el /)],
      ['asignacion_fin', [3], 'Lo quitaron de Torre Norte'],
    ]);
    expect(bitacora[2].actorId).toBe(1);
  });

  it('elegir un turno del catálogo para una asignación anterior copia su horario y avisa', async () => {
    await como(SUPERVISOR).post('/sitios/1/guardias', {
      usuarioId: 3,
      tipo: 'fija',
      turno: '24x24',
      horaInicio: '09:00',
      desde: HOY,
    });
    avisos.length = 0;
    const res = await como(SUPERVISOR).patch('/sitios/1/guardias/1', { turnoId: 2 });
    expect(res.body.data).toMatchObject({
      turno: null,
      horas: 12,
      dias: DIARIO,
      horaInicio: '20:00',
      horaFin: '08:00',
      turnoCatalogo: { id: 2 },
    });
    expect(avisos[0].mensaje).toBe(
      'Tu asignación en Torre Norte: nuevo horario: 12 h · entrada 8:00 p.m. (todos los días)',
    );
  });

  it('guardias disponibles: con lo que ya tienen asignado; el guardia no puede verlos', async () => {
    await asignarTurno({ turnoId: 1, guardias: [{ usuarioId: 3, desde: HOY }] });
    const res = await como(SUPERVISOR).get('/sitios/guardias-disponibles');
    expect(res.body.data.map((g: { nombre: string }) => g.nombre)).toEqual(['Gabriel', 'Lucía']);
    expect(res.body.data[0].asignaciones[0]).toMatchObject({
      sitio: { nombre: 'Torre Norte' },
      turnoNombre: '24 h · 8:00',
      turnoId: 1,
    });
    expect(res.body.data[1].asignaciones).toEqual([]);
    expect((await como(GUARDIA).get('/sitios/guardias-disponibles')).status).toBe(403);
  });
});
