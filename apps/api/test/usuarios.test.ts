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
      activo: true,
      bloqueadoHasta: null,
      ultimoAcceso: null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      sesionesActivas: 0,
      ...data,
      telefono: data.telefono ?? null,
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
    rol,
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

const tokenDe = (id: number, rol: Rol) =>
  signAccessToken({ id, email: `u${id}@platinum.local`, rol, permisos: PERMISOS_POR_ROL[rol] });

const ADMIN = tokenDe(1, ROLES.ADMIN);
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
    semilla(1, ROLES.ADMIN, { nombre: 'Admin Principal' }),
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
    expect((await como(ADMIN).get('/?rol=jefe')).status).toBe(400);
    expect((await como(ADMIN).get('/3')).body.data.nombre).toBe('Gabriel Guardia');
    expect((await como(ADMIN).get('/99')).status).toBe(404);
  });
});

describe('POST /api/usuarios (F1-08)', () => {
  it('crea con contraseña temporal que cumple la regla y lo audita', async () => {
    const res = await como(ADMIN).post('/', {
      nombre: '  Nora Nueva ',
      email: 'NORA@Platinum.local',
      telefono: '',
      rol: 'guardia',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.usuario).toMatchObject({
      nombre: 'Nora Nueva',
      email: 'nora@platinum.local',
      telefono: null,
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
      rol: 'guardia',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual([
      { path: 'email', message: 'Ya existe un usuario con este correo' },
    ]);
  });

  it('valida campos obligatorios', async () => {
    const res = await como(ADMIN).post('/', { nombre: 'A', email: 'x', rol: 'jefe' });
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
    const otroAdmin = tokenDe(2, ROLES.ADMIN);
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
    const res = await como(tokenDe(2, ROLES.ADMIN)).patch('/1/baja');
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
