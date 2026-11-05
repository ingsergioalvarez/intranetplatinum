import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  PERMISOS_POR_ROL,
  ROLES,
  passwordSchema,
  type Paginated,
  type PaginationQuery,
  type Rol,
  type Usuario,
} from '@platinum/shared';
import { createApp } from '../src/app';
import { createUsuariosModule } from '../src/modules/usuarios';
import {
  UsuariosRepository,
  type UsuarioCreateData,
  type UsuarioFiltroData,
  type UsuarioUpdateData,
} from '../src/modules/usuarios/usuarios.repository';
import { generateTemporaryPassword, signAccessToken } from '../src/core';
import { MemoryAuditLogger } from './helpers/memoryAudit';

// ---------- Doble en memoria ----------
type Fila = Usuario & { passwordHash: string; sesionesActivas: number };

/** Nombre de cada usuario de la cartera de prueba (para `propietario`). */
const NOMBRE_DE = (filas: Fila[], id: number | null | undefined) =>
  id ? { id, nombre: filas.find((f) => f.id === id)?.nombre ?? `Usuario ${id}` } : null;

class MemoryUsuariosRepository extends UsuariosRepository {
  filas: Fila[] = [];

  private pub = ({ passwordHash: _p, sesionesActivas: _s, ...u }: Fila): Usuario => u;
  private fila = (id: number) => this.filas.find((f) => f.id === id)!;

  async findById(id: number) {
    const f = this.filas.find((x) => x.id === id);
    return f ? this.pub(f) : null;
  }
  async findByEmail(email: string) {
    const f = this.filas.find((x) => x.email === email);
    return f ? this.pub(f) : null;
  }
  async findPaged(
    { q, rol, estado, propietarioId, sinAsignar, cartera }: UsuarioFiltroData,
    { page, limit }: PaginationQuery,
  ) {
    const items = this.filas
      .filter((f) => !cartera || f.propietario?.id === cartera.adminId || [cartera.adminId, ...cartera.tambien].includes(f.id))
      .filter((f) => !cartera && sinAsignar ? !f.propietario && !f.esSuperAdmin : true)
      .filter((f) => !cartera && !sinAsignar && propietarioId ? f.propietario?.id === propietarioId : true)
      .filter((f) => (estado === 'activos' ? !f.deletedAt : estado === 'baja' ? !!f.deletedAt : true))
      .filter((f) => !rol || f.rol === rol)
      .filter((f) => !q || f.nombre.includes(q) || f.email.includes(q))
      .map(this.pub);
    const page_: Paginated<Usuario> = {
      items: items.slice((page - 1) * limit, page * limit),
      total: items.length,
      page,
      limit,
    };
    return page_;
  }
  async create({ propietarioId, ...data }: UsuarioCreateData) {
    const f: Fila = {
      id: this.filas.length + 1,
      esSuperAdmin: false,
      propietario: NOMBRE_DE(this.filas, propietarioId),
      areaId: null,
      activo: true,
      bloqueadoHasta: null,
      ultimoAcceso: null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      sesionesActivas: 0,
      ...data,
      telefono: data.telefono ?? null,
      telefonoPersonal: data.telefonoPersonal ?? null,
    };
    this.filas.push(f);
    return this.pub(f);
  }
  async update(id: number, data: UsuarioUpdateData) {
    Object.assign(this.fila(id), data);
    return this.pub(this.fila(id));
  }
  async softDelete(id: number) {
    Object.assign(this.fila(id), { activo: false, deletedAt: new Date().toISOString() });
  }
  async restore(id: number) {
    Object.assign(this.fila(id), { activo: true, deletedAt: null });
  }
  async countAdminsActivos() {
    return this.filas.filter((f) => f.rol === 'admin' && !f.deletedAt).length;
  }
  async setPasswordTemporal(id: number, passwordHash: string) {
    Object.assign(this.fila(id), { passwordHash, debeCambiarPassword: true, bloqueadoHasta: null });
  }
  async revocarSesiones(id: number) {
    this.fila(id).sesionesActivas = 0;
  }
  async soltarCartera(adminId: number) {
    const suyos = this.filas.filter((f) => f.propietario?.id === adminId);
    suyos.forEach((f) => (f.propietario = null));
    return { usuarios: suyos.length, clientes: 0, grupos: 0 };
  }
}

// ---------- Utilidades ----------
let repo: MemoryUsuariosRepository;
let audit: MemoryAuditLogger;
let app: ReturnType<typeof createApp>;

function semilla(id: number, rol: Rol, over: Partial<Fila> = {}): Fila {
  return {
    id,
    nombre: `Usuario ${id}`,
    email: `u${id}@platinum.local`,
    telefono: null,
    telefonoPersonal: null,
    rol,
    esSuperAdmin: false,
    propietario: null,
    areaId: null,
    activo: true,
    debeCambiarPassword: false,
    bloqueadoHasta: null,
    ultimoAcceso: null,
    createdAt: new Date().toISOString(),
    deletedAt: null,
    passwordHash: 'x',
    sesionesActivas: 2,
    ...over,
  };
}

const tokenDe = (id: number, rol: Rol, extra: { esSuperAdmin?: boolean; propietarioId?: number } = {}) =>
  signAccessToken({ id, email: `u${id}@platinum.local`, rol, permisos: PERMISOS_POR_ROL[rol], ...extra });

/** Admin 1 = super admin: las pruebas de antes siguen igual. */
const ADMIN = tokenDe(1, ROLES.ADMIN, { esSuperAdmin: true });
const SUPERVISOR = tokenDe(2, ROLES.SUPERVISOR);
const GUARDIA = tokenDe(3, ROLES.GUARDIA);

const como = (token: string) => ({
  get: (url: string) => request(app).get(`/api/usuarios${url}`).set('Authorization', `Bearer ${token}`),
  post: (url: string, body?: object) =>
    request(app).post(`/api/usuarios${url}`).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url: string, body?: object) =>
    request(app).patch(`/api/usuarios${url}`).set('Authorization', `Bearer ${token}`).send(body),
});

beforeEach(() => {
  repo = new MemoryUsuariosRepository();
  audit = new MemoryAuditLogger();
  repo.filas.push(
    semilla(1, ROLES.ADMIN, { nombre: 'Admin Principal', esSuperAdmin: true }),
    semilla(2, ROLES.SUPERVISOR, { nombre: 'Sofía Supervisora' }),
    semilla(3, ROLES.GUARDIA, { nombre: 'Gabriel Guardia' }),
    semilla(4, ROLES.GUARDIA, { nombre: 'Baja Antigua', deletedAt: new Date().toISOString(), activo: false }),
  );
  app = createApp([createUsuariosModule({ repo, audit })]);
});

// ---------- Pruebas ----------
describe('permisos', () => {
  it('sin token → 401; guardia → 403; supervisor puede ver pero no crear', async () => {
    expect((await request(app).get('/api/usuarios')).status).toBe(401);
    expect((await como(GUARDIA).get('/')).status).toBe(403);
    expect((await como(SUPERVISOR).get('/')).status).toBe(200);
    expect(
      (await como(SUPERVISOR).post('/', { nombre: 'Nuevo', email: 'n@x.mx', rol: 'guardia' })).status,
    ).toBe(403);
    expect((await como(SUPERVISOR).patch('/3/baja')).status).toBe(403);
  });

  it('con contraseña temporal pendiente → 403 PASSWORD_CHANGE_REQUIRED', async () => {
    const t = signAccessToken({
      id: 1,
      email: 'u1@platinum.local',
      rol: ROLES.ADMIN,
      permisos: PERMISOS_POR_ROL.admin,
      debeCambiarPassword: true,
    });
    const res = await como(t).get('/');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});

describe('GET /api/usuarios (F1-07)', () => {
  it('lista activos por defecto, paginado', async () => {
    const res = await como(ADMIN).get('/?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0].passwordHash).toBeUndefined();
  });

  it('filtra por estado, rol y búsqueda', async () => {
    expect((await como(ADMIN).get('/?estado=baja')).body.data.total).toBe(1);
    expect((await como(ADMIN).get('/?estado=todos')).body.data.total).toBe(4);
    expect((await como(ADMIN).get('/?rol=guardia')).body.data.total).toBe(1);
    expect((await como(ADMIN).get('/?q=Sof')).body.data.items[0].id).toBe(2);
  });

  it('valida filtros y obtiene por id (404 si no existe)', async () => {
    expect((await como(ADMIN).get('/?rol=gerente')).status).toBe(400);
    expect((await como(ADMIN).get('/3')).body.data.nombre).toBe('Gabriel Guardia');
    expect((await como(ADMIN).get('/99')).status).toBe(404);
  });
});

describe('POST /api/usuarios (F1-08)', () => {
  it('crea con contraseña temporal que cumple la regla y lo audita', async () => {
    const res = await como(ADMIN).post('/', {
      nombre: '  Nora Nueva ',
      email: 'NORA@Platinum.local',
      telefono: '5559998888',
      rol: 'guardia',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.usuario).toMatchObject({
      nombre: 'Nora Nueva',
      email: 'nora@platinum.local',
      telefono: '5559998888',
      telefonoPersonal: null,
      debeCambiarPassword: true,
    });
    const { passwordTemporal } = res.body.data;
    expect(passwordSchema.safeParse(passwordTemporal).success).toBe(true);
    const fila = repo.filas.at(-1)!;
    expect(await bcrypt.compare(passwordTemporal, fila.passwordHash)).toBe(true);
    expect(audit.eventos.at(-1)).toMatchObject({
      usuarioId: 1,
      accion: 'usuarios.crear',
      entidadId: fila.id,
    });
  });

  it('rechaza correo duplicado (incluye usuarios de baja) con error en el campo', async () => {
    const res = await como(ADMIN).post('/', {
      nombre: 'Otra Persona',
      email: 'u4@platinum.local',
      telefono: '5550001111',
      rol: 'guardia',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual([
      { path: 'email', message: 'Ya existe un usuario con este correo' },
    ]);
  });

  it('guardia y supervisor deben tener teléfono de contacto; el admin no; el personal es opcional (A-60)', async () => {
    for (const rol of ['guardia', 'supervisor']) {
      const res = await como(ADMIN).post('/', { nombre: 'Sin Teléfono', email: `${rol}@x.mx`, rol });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toMatchObject({ path: 'telefono' });
    }
    expect((await como(ADMIN).post('/', { nombre: 'Otro Admin', email: 'adm@x.mx', rol: 'admin' })).status).toBe(201);
    const ok = await como(ADMIN).post('/', {
      nombre: 'Con Personal',
      email: 'cp@x.mx',
      rol: 'guardia',
      telefono: '5550001111',
      telefonoPersonal: '5552223333',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.usuario).toMatchObject({ telefono: '5550001111', telefonoPersonal: '5552223333' });
  });

  it('un guardia existente no puede quedarse sin teléfono al editarlo', async () => {
    expect((await como(ADMIN).patch('/3', { nombre: 'Gabriel G.' })).status).toBe(200);
    const res = await como(ADMIN).patch('/3', { telefono: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ path: 'telefono' });
    expect((await como(ADMIN).patch('/3', { telefonoPersonal: '5557776666' })).body.data.telefonoPersonal).toBe(
      '5557776666',
    );
  });

  it('valida campos obligatorios', async () => {
    const res = await como(ADMIN).post('/', { nombre: 'A', email: 'x', rol: 'gerente' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'email',
      'nombre',
      'rol',
    ]);
  });
});

describe('PATCH /api/usuarios/:id', () => {
  it('edita y audita solo los cambios reales', async () => {
    const res = await como(ADMIN).patch('/3', {
      nombre: 'Gabriel G.',
      rol: 'guardia',
      telefono: '5551234567',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ nombre: 'Gabriel G.', telefono: '5551234567' });
    expect(audit.eventos.at(-1)).toMatchObject({
      accion: 'usuarios.editar',
      datos: {
        antes: { nombre: 'Gabriel Guardia', telefono: null },
        despues: { nombre: 'Gabriel G.', telefono: '5551234567' },
      },
    });
  });

  it('sin cambios no audita', async () => {
    await como(ADMIN).patch('/3', { nombre: 'Gabriel Guardia' });
    expect(audit.eventos).toHaveLength(0);
  });

  it('no permite cambiar el propio rol ni quitar el último admin', async () => {
    expect((await como(ADMIN).patch('/1', { rol: 'supervisor' })).status).toBe(400);
    // Con otro super admin (la cuenta 1 aún sin marcar): no deja sin administradores.
    repo.filas[0].esSuperAdmin = false;
    const otroAdmin = tokenDe(2, ROLES.ADMIN, { esSuperAdmin: true });
    const res = await como(otroAdmin).patch('/1', { rol: 'supervisor' });
    expect(res.status).toBe(409);
  });

  it('rechaza correo de otro usuario', async () => {
    expect((await como(ADMIN).patch('/3', { email: 'u2@platinum.local' })).status).toBe(409);
  });
});

describe('baja y reactivación (F1-09)', () => {
  it('da de baja, revoca sesiones y lo audita; reactivar lo devuelve', async () => {
    expect((await como(ADMIN).patch('/3/baja')).status).toBe(204);
    const fila = repo.filas[2];
    expect(fila.deletedAt).not.toBeNull();
    expect(fila.activo).toBe(false);
    expect(fila.sesionesActivas).toBe(0);
    expect(audit.acciones()).toContain('usuarios.baja');

    expect((await como(ADMIN).patch('/3/reactivar')).status).toBe(204);
    expect(fila.deletedAt).toBeNull();
    expect(audit.acciones()).toContain('usuarios.reactivar');
  });

  it('no permite darse de baja a sí mismo ni dejar sin administradores', async () => {
    expect((await como(ADMIN).patch('/1/baja')).status).toBe(400);
    repo.filas[0].esSuperAdmin = false;
    const res = await como(tokenDe(2, ROLES.ADMIN, { esSuperAdmin: true })).patch('/1/baja');
    expect(res.status).toBe(409);
  });

  it('es idempotente y 404 si no existe', async () => {
    expect((await como(ADMIN).patch('/4/baja')).status).toBe(204);
    expect((await como(ADMIN).patch('/99/baja')).status).toBe(404);
    expect(audit.eventos).toHaveLength(0);
  });
});

describe('POST /api/usuarios/:id/reset-password (F1-10)', () => {
  it('genera contraseña temporal, desbloquea, revoca sesiones y audita', async () => {
    repo.filas[2].bloqueadoHasta = new Date(Date.now() + 60_000).toISOString();
    const res = await como(ADMIN).post('/3/reset-password');
    expect(res.status).toBe(200);
    expect(res.body.data.usuario).toMatchObject({ id: 3, debeCambiarPassword: true, bloqueadoHasta: null });
    const fila = repo.filas[2];
    expect(await bcrypt.compare(res.body.data.passwordTemporal, fila.passwordHash)).toBe(true);
    expect(fila.sesionesActivas).toBe(0);
    expect(audit.eventos.at(-1)).toMatchObject({ accion: 'usuarios.reset_password', entidadId: 3 });
  });

  it('no aplica a sí mismo ni a usuarios de baja', async () => {
    expect((await como(ADMIN).post('/1/reset-password')).status).toBe(400);
    expect((await como(ADMIN).post('/4/reset-password')).status).toBe(409);
  });
});

describe('generateTemporaryPassword', () => {
  it('siempre cumple la regla de contraseña y no repite', () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateTemporaryPassword();
      expect(passwordSchema.safeParse(p).success).toBe(true);
      expect(p).not.toMatch(/[0O1lI]/);
      vistas.add(p);
    }
    expect(vistas.size).toBe(200);
  });
});

// ---------- Carteras de los admin y super admin (A-65) ----------
describe('carteras de admin (A-65)', () => {
  // Super admin = 1. Admin A = 10 y admin B = 11 (los creó el super admin). Cada uno tiene supervisor y guardia.
  const A = tokenDe(10, ROLES.ADMIN);
  const B = tokenDe(11, ROLES.ADMIN);
  const dueno = (id: number) => ({ id, nombre: `Usuario ${id}` });

  beforeEach(() => {
    repo.filas.push(
      semilla(10, ROLES.ADMIN, { nombre: 'Admin A', propietario: dueno(1) }),
      semilla(11, ROLES.ADMIN, { nombre: 'Admin B', propietario: dueno(1) }),
      semilla(20, ROLES.SUPERVISOR, { nombre: 'Sup de A', propietario: dueno(10) }),
      semilla(21, ROLES.GUARDIA, { nombre: 'Guardia de A', propietario: dueno(10) }),
      semilla(30, ROLES.SUPERVISOR, { nombre: 'Sup de B', propietario: dueno(11) }),
      semilla(31, ROLES.GUARDIA, { nombre: 'Guardia de B', propietario: dueno(11) }),
      semilla(40, ROLES.GUARDIA, { nombre: 'Guardia sin dueño' }),
    );
  });

  const nombres = (res: request.Response) => res.body.data.items.map((u: { nombre: string }) => u.nombre).sort();

  it('un admin ve solo a los suyos y a sí mismo: no ve a otros admin ni lo sin asignar', async () => {
    expect(nombres(await como(A).get('/'))).toEqual(['Admin A', 'Guardia de A', 'Sup de A']);
    expect(nombres(await como(B).get('/'))).toEqual(['Admin B', 'Guardia de B', 'Sup de B']);
  });

  it('el super admin ve todos y puede filtrar por dueño o por sin asignar', async () => {
    expect((await como(ADMIN).get('/')).body.data.total).toBe(10);
    expect(nombres(await como(ADMIN).get('/?propietarioId=10'))).toEqual(['Guardia de A', 'Sup de A']);
    expect(nombres(await como(ADMIN).get('/?sinAsignar=true'))).toEqual(['Gabriel Guardia', 'Guardia sin dueño', 'Sofía Supervisora']);
  });

  it('un admin no puede filtrar para ver lo de otro', async () => {
    expect(nombres(await como(A).get('/?propietarioId=11'))).toEqual(['Admin A', 'Guardia de A', 'Sup de A']);
    expect(nombres(await como(A).get('/?sinAsignar=true'))).toEqual(['Admin A', 'Guardia de A', 'Sup de A']);
  });

  it('lo de otro admin o sin dueño se responde como si no existiera', async () => {
    for (const id of [31, 30, 11, 40, 1]) {
      expect((await como(A).get(`/${id}`)).status).toBe(404);
      expect((await como(A).patch(`/${id}`, { nombre: 'Hackeado' })).status).toBe(404);
      expect((await como(A).patch(`/${id}/baja`)).status).toBe(404);
      expect((await como(A).post(`/${id}/reset-password`)).status).toBe(404);
    }
    expect((await como(A).get('/21')).status).toBe(200);
  });

  it('lo que crea un admin queda a su nombre; el otro admin no lo ve', async () => {
    const res = await como(A).post('/', { nombre: 'Nuevo Guardia A', email: 'nga@x.mx', telefono: '5551112222', rol: 'guardia' });
    expect(res.status).toBe(201);
    expect(res.body.data.usuario.propietario).toEqual({ id: 10, nombre: 'Admin A' });
    expect(nombres(await como(A).get('/'))).toContain('Nuevo Guardia A');
    expect(nombres(await como(B).get('/'))).not.toContain('Nuevo Guardia A');
  });

  it('solo el super admin crea o cambia administradores', async () => {
    const nuevo = { nombre: 'Otro Admin', email: 'oa@x.mx', rol: 'admin' };
    expect((await como(A).post('/', nuevo)).status).toBe(403);
    expect((await como(ADMIN).post('/', nuevo)).status).toBe(201);
    // Subir a alguien de su cartera a admin tampoco.
    expect((await como(A).patch('/21', { rol: 'admin' })).status).toBe(403);
    expect((await como(ADMIN).patch('/21', { rol: 'admin' })).status).toBe(200);
  });

  it('nadie más puede tocar la cuenta del super admin; ella misma sí puede editar sus datos', async () => {
    repo.filas.push(semilla(12, ROLES.ADMIN, { nombre: 'Admin C', propietario: dueno(1) }));
    const C = tokenDe(12, ROLES.ADMIN);
    for (const t of [A, B, C]) expect((await como(t).patch('/1', { nombre: 'Hackeado' })).status).toBe(404);
    // El super admin no se da de baja a sí mismo ni se quita su rol.
    expect((await como(ADMIN).patch('/1/baja')).status).toBe(400);
    expect((await como(ADMIN).patch('/1', { rol: 'guardia' })).status).toBe(400);
    expect((await como(ADMIN).patch('/1', { nombre: 'Super Admin' })).status).toBe(200);
  });

  it('un supervisor ve a los de su admin, no a los de otro', async () => {
    const supA = tokenDe(20, ROLES.SUPERVISOR, { propietarioId: 10 });
    expect(nombres(await como(supA).get('/'))).toEqual(['Admin A', 'Guardia de A', 'Sup de A']);
    const sinAdmin = tokenDe(20, ROLES.SUPERVISOR);
    expect(nombres(await como(sinAdmin).get('/'))).toEqual(['Sup de A']);
  });

  it('al dar de baja a un admin, su cartera queda sin asignar y solo la ve el super admin', async () => {
    expect((await como(ADMIN).patch('/10/baja')).status).toBe(204);
    expect(nombres(await como(ADMIN).get('/?sinAsignar=true'))).toEqual([
      'Gabriel Guardia',
      'Guardia de A',
      'Guardia sin dueño',
      'Sofía Supervisora',
      'Sup de A',
    ]);
    const evento = audit.eventos.find((e) => e.accion === 'usuarios.baja')!;
    expect(evento.datos).toMatchObject({ sinAsignar: { usuarios: 2 } });
  });
});
