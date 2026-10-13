import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  PERMISOS_POR_ROL,
  ROLES,
  type Asignacion,
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
  type GuardiaEstado,
} from '../src/modules/sitios/sitios.repository';
import { calcularCambios, hoyISO, signAccessToken } from '../src/core';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const HOY = '2026-10-12';

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
      guardiasVigentes: 0,
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
  reglas = new Map<number, ReglasAviso>();
  async getReglasAviso(id: number) {
    return this.reglas.get(id) ?? { porDefecto: 'supervisor' as const, porPrioridad: {} };
  }
  async setReglasAviso(id: number, r: ReglasAviso) {
    this.reglas.set(id, r);
  }
}

class MemorySitiosRepository extends SitiosRepository {
  sitio = { id: 1, clienteId: 1, deletedAt: null as Date | null, clienteDeBaja: false };
  guardias: GuardiaEstado[] = [
    { id: 3, nombre: 'Gabriel', rol: ROLES.GUARDIA, deletedAt: null },
    { id: 2, nombre: 'Sofía', rol: ROLES.SUPERVISOR, deletedAt: null },
  ];
  asignaciones: (AsignacionData & { id: number })[] = [];

  async findSitio(id: number) {
    return id === 1 ? this.sitio : null;
  }
  async findGuardia(id: number) {
    return this.guardias.find((g) => g.id === id) ?? null;
  }
  private dto(a: AsignacionData & { id: number }, hoy: string): Asignacion {
    return {
      id: a.id,
      sitioId: a.sitioId,
      usuarioId: a.usuarioId,
      guardia: { id: a.usuarioId, nombre: 'G', email: 'g@x', telefono: null },
      turno: a.turno,
      desde: a.desde,
      hasta: a.hasta ?? null,
      vigente: a.desde <= hoy && (!a.hasta || a.hasta >= hoy),
    };
  }
  async listAsignaciones(sitioId: number, hoy: string) {
    return this.asignaciones.filter((a) => a.sitioId === sitioId).map((a) => this.dto(a, hoy));
  }
  async findAsignacion(id: number, hoy: string) {
    const a = this.asignaciones.find((x) => x.id === id);
    return a ? this.dto(a, hoy) : null;
  }
  async haySolape({ sitioId, usuarioId, desde, hasta }: AsignacionData, excluirId?: number) {
    return this.asignaciones.some(
      (a) =>
        a.id !== excluirId &&
        a.sitioId === sitioId &&
        a.usuarioId === usuarioId &&
        (!hasta || a.desde <= hasta) &&
        (!a.hasta || a.hasta >= desde),
    );
  }
  async createAsignacion(data: AsignacionData, hoy: string) {
    const a = { id: this.asignaciones.length + 1, ...data, hasta: data.hasta ?? null };
    this.asignaciones.push(a);
    return this.dto(a, hoy);
  }
  async updateAsignacion(id: number, data: { turno?: AsignacionData['turno']; hasta?: string | null }) {
    const a = this.asignaciones.find((x) => x.id === id)!;
    if (data.turno) a.turno = data.turno;
    if (data.hasta !== undefined) a.hasta = data.hasta;
  }
  async misSitios() {
    return [];
  }
}

// ---------- Utilidades ----------
let clientes: MemoryClientesRepository;
let sitios: MemorySitiosRepository;
let audit: MemoryAuditLogger;
let app: ReturnType<typeof createApp>;

const tokenDe = (id: number, rol: Rol) =>
  signAccessToken({ id, email: `u${id}@x.mx`, rol, permisos: PERMISOS_POR_ROL[rol] });
const SUPERVISOR = tokenDe(2, ROLES.SUPERVISOR);
const GUARDIA = tokenDe(3, ROLES.GUARDIA);

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
  app = createApp([
    createClientesModule({ repo: clientes, audit, hoy: () => HOY }),
    createSitiosModule({ repo: sitios, audit, hoy: () => HOY }),
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
    const res = await como(SUPERVISOR).put('/clientes/1/avisos', {
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
    expect((await como(SUPERVISOR).put('/clientes/1/avisos', { porDefecto: 'nadie' })).status).toBe(400);
    expect((await como(GUARDIA).put('/clientes/1/avisos', { porDefecto: 'ambos' })).status).toBe(403);
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
describe('asignación de guardias (F2-05)', () => {
  const asignar = (b: object) => como(SUPERVISOR).post('/sitios/1/guardias', b);

  it('asigna solo a guardias activos y en sitios activos', async () => {
    const noGuardia = await asignar({ usuarioId: 2, turno: 'diurno', desde: HOY });
    expect(noGuardia.status).toBe(400);
    expect(noGuardia.body.error.details[0].path).toBe('usuarioId');

    const ok = await asignar({ usuarioId: 3, turno: '24x24', desde: HOY });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ vigente: true, turno: '24x24', hasta: null });
    expect(audit.acciones()).toContain('sitios.asignar_guardia');

    sitios.sitio.clienteDeBaja = true;
    expect((await asignar({ usuarioId: 3, turno: 'diurno', desde: '2027-01-01' })).status).toBe(409);
  });

  it('rechaza asignaciones que se cruzan; permite consecutivas', async () => {
    await asignar({ usuarioId: 3, turno: 'diurno', desde: '2026-10-01', hasta: '2026-10-31' });
    expect((await asignar({ usuarioId: 3, turno: 'diurno', desde: '2026-10-31' })).status).toBe(409);
    expect(
      (await asignar({ usuarioId: 3, turno: 'diurno', desde: '2026-09-01', hasta: '2026-10-01' })).status,
    ).toBe(409);
    expect((await asignar({ usuarioId: 3, turno: 'nocturno', desde: '2026-11-01' })).status).toBe(201);
  });

  it('valida fechas y permite terminar o cambiar turno', async () => {
    expect((await asignar({ usuarioId: 3, turno: 'diurno', desde: HOY, hasta: '2026-01-01' })).status).toBe(
      400,
    );
    await asignar({ usuarioId: 3, turno: 'diurno', desde: '2026-10-01' });
    expect((await como(SUPERVISOR).patch('/sitios/1/guardias/1', { hasta: '2026-09-01' })).status).toBe(400);
    const fin = await como(SUPERVISOR).patch('/sitios/1/guardias/1', { hasta: HOY, turno: 'mixto' });
    expect(fin.body.data).toMatchObject({ hasta: HOY, turno: 'mixto', vigente: true });
    expect(audit.eventos.at(-1)?.datos).toMatchObject({ antes: { hasta: null }, despues: { hasta: HOY } });
    expect((await como(SUPERVISOR).patch('/sitios/2/guardias/1', { hasta: HOY })).status).toBe(404);
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
