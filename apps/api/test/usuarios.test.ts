import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  PERMISOS,
  PERMISOS_POR_ROL,
  ROLES,
  passwordSchema,
  type Paginated,
  type PaginationQuery,
  type Permiso,
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
import { todasLasPersonas } from '../src/modules/areas/alcance';
import { MemoryAuditLogger } from './helpers/memoryAudit';

// ---------- Doble en memoria ----------
type Fila = Usuario & { passwordHash: string; sesionesActivas: number };

class MemoryUsuariosRepository extends UsuariosRepository {
  filas: Fila[] = [];
  rolesValidos = new Set<string>(Object.values(ROLES));

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
  async findPaged({ q, rol, estado }: UsuarioFiltroData, { page, limit }: PaginationQuery) {
    const items = this.filas
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
  async create(data: UsuarioCreateData) {
    const f: Fila = {
      id: this.filas.length + 1,
      esSuperAdmin: false,
      areaId: null,
      activo: true,
      bloqueadoHasta: null,
      ultimoAcceso: null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      sesionesActivas: 0,
      ...data,
      rol: data.rol as Rol,
      permisosPropios: [],
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
  async existeRol(clave: string) {
    return this.rolesValidos.has(clave);
  }
  async fijarPermisosPropios(id: number, permisos: Permiso[]) {
    this.fila(id).permisosPropios = [...permisos].sort();
    return this.pub(this.fila(id));
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

const tokenDe = (id: number, rol: Rol, extra: { esSuperAdmin?: boolean } = {}) =>
  signAccessToken({ id, email: `u${id}@platinum.local`, rol, permisos: PERMISOS_POR_ROL[rol], ...extra });

/** Admin 1 = super admin: las pruebas de antes siguen igual. */
const ADMIN = tokenDe(1, ROLES.ADMIN, { esSuperAdmin: true });
const SUPERVISOR = tokenDe(2, ROLES.SUPERVISOR);
const GUARDIA = tokenDe(3, ROLES.COLABORADOR);

const como = (token: string) => ({
  get: (url: string) => request(app).get(`/api/usuarios${url}`).set('Authorization', `Bearer ${token}`),
  post: (url: string, body?: object) =>
    request(app).post(`/api/usuarios${url}`).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url: string, body?: object) =>
    request(app).patch(`/api/usuarios${url}`).set('Authorization', `Bearer ${token}`).send(body),
  put: (url: string, body?: object) =>
    request(app).put(`/api/usuarios${url}`).set('Authorization', `Bearer ${token}`).send(body),
});

beforeEach(() => {
  repo = new MemoryUsuariosRepository();
  audit = new MemoryAuditLogger();
  repo.filas.push(
    semilla(1, ROLES.ADMIN, { nombre: 'Admin Principal', esSuperAdmin: true }),
    semilla(2, ROLES.SUPERVISOR, { nombre: 'Sofía Supervisora' }),
    semilla(3, ROLES.COLABORADOR, { nombre: 'Gabriel Guardia' }),
    semilla(4, ROLES.COLABORADOR, { nombre: 'Baja Antigua', deletedAt: new Date().toISOString(), activo: false }),
  );
  app = createApp([createUsuariosModule({ repo, audit, personasVisibles: todasLasPersonas })]);
});

// ---------- Pruebas ----------
describe('permisos', () => {
  it('sin token → 401; guardia → 403; supervisor puede ver pero no crear', async () => {
    expect((await request(app).get('/api/usuarios')).status).toBe(401);
    expect((await como(GUARDIA).get('/')).status).toBe(403);
    expect((await como(SUPERVISOR).get('/')).status).toBe(200);
    expect(
      (await como(SUPERVISOR).post('/', { nombre: 'Nuevo', email: 'n@x.mx', rol: 'colaborador' })).status,
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
    expect((await como(ADMIN).get('/?rol=colaborador')).body.data.total).toBe(1);
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
      rol: 'colaborador',
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
      rol: 'colaborador',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual([
      { path: 'email', message: 'Ya existe un usuario con este correo' },
    ]);
  });

  it('guardia y supervisor deben tener teléfono de contacto; el admin no; el personal es opcional (A-60)', async () => {
    for (const rol of ['colaborador', 'supervisor']) {
      const res = await como(ADMIN).post('/', { nombre: 'Sin Teléfono', email: `${rol}@x.mx`, rol });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toMatchObject({ path: 'telefono' });
    }
    expect((await como(ADMIN).post('/', { nombre: 'Otro Admin', email: 'adm@x.mx', rol: 'admin' })).status).toBe(201);
    const ok = await como(ADMIN).post('/', {
      nombre: 'Con Personal',
      email: 'cp@x.mx',
      rol: 'colaborador',
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

  it('valida campos obligatorios y que el rol exista en la empresa', async () => {
    const res = await como(ADMIN).post('/', { nombre: 'A', email: 'x', rol: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'email',
      'nombre',
      'rol',
    ]);
    const rolInexistente = await como(ADMIN).post('/', {
      nombre: 'Ana Perez',
      email: 'ana@x.mx',
      rol: 'gerente',
    });
    expect(rolInexistente.status).toBe(400);
    expect(rolInexistente.body.error.details).toEqual([
      { path: 'rol', message: 'Selecciona un rol válido' },
    ]);
  });
});

describe('PATCH /api/usuarios/:id', () => {
  it('edita y audita solo los cambios reales', async () => {
    const res = await como(ADMIN).patch('/3', {
      nombre: 'Gabriel G.',
      rol: 'colaborador',
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

// ---------- Admin y super admin ----------
describe('usuarios de la empresa', () => {
  // Super admin = 1. Admin A = 10 y admin B = 11. Cada uno tiene supervisor y guardia.
  const A = tokenDe(10, ROLES.ADMIN);
  const B = tokenDe(11, ROLES.ADMIN);

  beforeEach(() => {
    repo.filas.push(
      semilla(10, ROLES.ADMIN, { nombre: 'Admin A' }),
      semilla(11, ROLES.ADMIN, { nombre: 'Admin B' }),
      semilla(20, ROLES.SUPERVISOR, { nombre: 'Sup de A' }),
      semilla(21, ROLES.COLABORADOR, { nombre: 'Guardia de A' }),
      semilla(30, ROLES.SUPERVISOR, { nombre: 'Sup de B' }),
      semilla(31, ROLES.COLABORADOR, { nombre: 'Guardia de B' }),
    );
  });

  const nombres = (res: request.Response) => res.body.data.items.map((u: { nombre: string }) => u.nombre).sort();

  it('un admin ve a todos los de su empresa', async () => {
    expect((await como(A).get('/')).body.data.total).toBe(9);
    expect(nombres(await como(B).get('/'))).toEqual(nombres(await como(A).get('/')));
    expect((await como(A).get('/31')).status).toBe(200);
  });

  it('un admin edita y da de baja a cualquier persona que no sea admin', async () => {
    expect((await como(A).patch('/31', { nombre: 'Guardia B2' })).status).toBe(200);
    expect((await como(A).post('/31/reset-password')).status).toBe(200);
    expect((await como(A).patch('/31/baja')).status).toBe(204);
  });

  it('lo que crea un admin lo ven todos', async () => {
    const res = await como(A).post('/', { nombre: 'Nuevo Guardia A', email: 'nga@x.mx', telefono: '5551112222', rol: 'colaborador' });
    expect(res.status).toBe(201);
    expect(nombres(await como(B).get('/'))).toContain('Nuevo Guardia A');
  });

  it('solo el super admin crea o cambia administradores', async () => {
    const nuevo = { nombre: 'Otro Admin', email: 'oa@x.mx', rol: 'admin' };
    expect((await como(A).post('/', nuevo)).status).toBe(403);
    expect((await como(ADMIN).post('/', nuevo)).status).toBe(201);
    expect((await como(A).patch('/21', { rol: 'admin' })).status).toBe(403);
    expect((await como(ADMIN).patch('/21', { rol: 'admin' })).status).toBe(200);
    expect((await como(A).patch('/11', { nombre: 'Admin B2' })).status).toBe(403);
  });

  it('nadie más puede tocar la cuenta del super admin; ella misma sí puede editar sus datos', async () => {
    repo.filas.push(semilla(12, ROLES.ADMIN, { nombre: 'Admin C' }));
    const C = tokenDe(12, ROLES.ADMIN);
    for (const t of [A, B, C]) expect((await como(t).patch('/1', { nombre: 'Hackeado' })).status).toBe(403);
    // El super admin no se da de baja a sí mismo ni se quita su rol.
    expect((await como(ADMIN).patch('/1/baja')).status).toBe(400);
    expect((await como(ADMIN).patch('/1', { rol: 'colaborador' })).status).toBe(400);
    expect((await como(ADMIN).patch('/1', { nombre: 'Super Admin' })).status).toBe(200);
  });

  it('asigna permisos individuales, aplica el atajo RH y rechaza roles.administrar (C-11 parte 5)', async () => {
    // Atajo RH: marcar emergencias.recibir incluye automáticamente emergencias.atender
    const rh = await como(A).put('/21/permisos', {
      permisos: [PERMISOS.EMERGENCIAS_RECIBIR, PERMISOS.ALCANCE_EMPRESA],
    });
    expect(rh.status).toBe(200);
    expect(rh.body.data.permisosPropios).toEqual([
      PERMISOS.ALCANCE_EMPRESA,
      PERMISOS.EMERGENCIAS_ATENDER,
      PERMISOS.EMERGENCIAS_RECIBIR,
    ]);
    expect(audit.eventos.at(-1)).toMatchObject({
      accion: 'usuarios.permisos',
      entidadId: 21,
      datos: {
        antes: { permisos: [] },
        despues: {
          permisos: [
            PERMISOS.ALCANCE_EMPRESA,
            PERMISOS.EMERGENCIAS_ATENDER,
            PERMISOS.EMERGENCIAS_RECIBIR,
          ],
        },
      },
    });

    // No se puede otorgar roles.administrar como permiso individual
    const prohibido = await como(A).put('/21/permisos', {
      permisos: [PERMISOS.ROLES_ADMINISTRAR],
    });
    expect(prohibido.status).toBe(400);

    // Quien no tiene roles.administrar recibe 403
    expect((await como(SUPERVISOR).put('/21/permisos', { permisos: [] })).status).toBe(403);
  });
});
