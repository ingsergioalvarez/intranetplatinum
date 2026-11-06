import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  ALCANCE_POR_ROL,
  PERMISOS,
  PERMISOS_CATALOGO_CLAVES,
  PERMISOS_POR_ROL,
  ROLES,
  ROL_DESCRIPCIONES,
  type AlcanceRol,
  type Permiso,
  type Rol,
  type RolEmpresa,
} from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import { createRolesModule } from '../src/modules/roles';
import { RolesRepository } from '../src/modules/roles/roles.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const catalogoSet = new Set<string>(PERMISOS_CATALOGO_CLAVES);

class MemoryRolesRepository extends RolesRepository {
  filas: RolEmpresa[] = [];

  async todos() {
    return this.filas.map((f) => ({ ...f, permisos: [...f.permisos] }));
  }

  async findById(id: number) {
    const f = this.filas.find((r) => r.id === id);
    return f ? { ...f, permisos: [...f.permisos] } : null;
  }

  async crear(data: {
    clave: string;
    nombre: string;
    alcance: AlcanceRol;
    permisos: Permiso[];
    aPartirDeId: number;
  }) {
    const nuevo: RolEmpresa = {
      id: (this.filas.at(-1)?.id ?? 0) + 1,
      clave: data.clave,
      nombre: data.nombre,
      esBase: false,
      alcance: data.alcance,
      permisos: [...data.permisos].sort(),
      personas: 0,
    };
    this.filas.push(nuevo);
    return { ...nuevo };
  }

  async actualizar(
    id: number,
    data: { nombre?: string; alcance?: AlcanceRol; permisos?: Permiso[] },
  ) {
    const f = this.filas.find((r) => r.id === id)!;
    if (data.nombre !== undefined) f.nombre = data.nombre;
    if (data.alcance !== undefined) f.alcance = data.alcance;
    if (data.permisos !== undefined) f.permisos = [...data.permisos].sort();
    return { ...f, permisos: [...f.permisos] };
  }

  async eliminar(id: number) {
    this.filas = this.filas.filter((r) => r.id !== id);
  }
}

let repo: MemoryRolesRepository;
let audit: MemoryAuditLogger;
let app: ReturnType<typeof createApp>;

const tokenDe = (id: number, rol: Rol) =>
  signAccessToken({ id, email: `u${id}@x.mx`, rol, permisos: PERMISOS_POR_ROL[rol], empresaId: 1 });

const ADMIN = tokenDe(1, ROLES.ADMIN);
const JEFE = tokenDe(2, ROLES.JEFE);

const como = (token: string) => ({
  get: (url: string) => request(app).get(`/api/roles${url}`).set('Authorization', `Bearer ${token}`),
  post: (url: string, body?: object) =>
    request(app).post(`/api/roles${url}`).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url: string, body?: object) =>
    request(app).patch(`/api/roles${url}`).set('Authorization', `Bearer ${token}`).send(body),
  del: (url: string) => request(app).delete(`/api/roles${url}`).set('Authorization', `Bearer ${token}`),
});

beforeEach(() => {
  repo = new MemoryRolesRepository();
  audit = new MemoryAuditLogger();
  const base: Rol[] = [ROLES.ADMIN, ROLES.JEFE, ROLES.SUPERVISOR, ROLES.COLABORADOR];
  repo.filas = base.map((clave, i) => ({
    id: i + 1,
    clave,
    nombre: ROL_DESCRIPCIONES[clave],
    esBase: true,
    alcance: ALCANCE_POR_ROL[clave],
    permisos:
      clave === ROLES.ADMIN
        ? [...PERMISOS_CATALOGO_CLAVES]
        : PERMISOS_POR_ROL[clave].filter((p) => catalogoSet.has(p)).sort(),
    personas: clave === ROLES.COLABORADOR ? 12 : 1,
  }));
  app = createApp([createRolesModule({ repo, audit })]);
});

describe('API de roles y permisos (C-11 parte 5)', () => {
  it('requiere roles.administrar en todas sus rutas', async () => {
    expect((await request(app).get('/api/roles')).status).toBe(401);
    expect((await como(JEFE).get('/')).status).toBe(403);
    expect((await como(JEFE).post('/', { nombre: 'Nómina', aPartirDeId: 4 })).status).toBe(403);
    expect((await como(JEFE).patch('/4', { nombre: 'Operador' })).status).toBe(403);
    expect((await como(JEFE).del('/4')).status).toBe(403);
  });

  it('lista los roles con los 4 de partida en orden', async () => {
    const res = await como(ADMIN).get('/');
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: RolEmpresa) => r.clave)).toEqual([
      'admin',
      'jefe',
      'supervisor',
      'colaborador',
    ]);
    expect(res.body.data[0].permisos).toHaveLength(PERMISOS_CATALOGO_CLAVES.length);
  });

  it('crea un rol nuevo copiando permisos y alcance del rol de partida y lo audita', async () => {
    const res = await como(ADMIN).post('/', { nombre: '  Nómina y RH ', aPartirDeId: 4 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      clave: 'nomina_y_rh',
      nombre: 'Nómina y RH',
      esBase: false,
      alcance: 'propio',
      personas: 0,
    });
    expect(res.body.data.permisos).toEqual(repo.filas[3].permisos);
    expect(audit.eventos.at(-1)).toMatchObject({
      accion: 'roles.crear',
      datos: { nombre: 'Nómina y RH', clave: 'nomina_y_rh', aPartirDe: 'Colaborador' },
    });

    // Rechaza nombre repetido sin importar mayúsculas
    const dup = await como(ADMIN).post('/', { nombre: 'nómina y rh', aPartirDeId: 4 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.details).toEqual([
      { path: 'nombre', message: 'Ya existe un rol con ese nombre' },
    ]);
  });

  it('edita nombre, alcance y permisos de un rol y audita antes y después', async () => {
    const creado = await como(ADMIN).post('/', { nombre: 'Nómina', aPartirDeId: 4 });
    const id = creado.body.data.id;

    const editado = await como(ADMIN).patch(`/${id}`, {
      nombre: 'Nómina Corporativa',
      alcance: 'empresa',
      permisos: [PERMISOS.USUARIOS_VER, PERMISOS.INFORMES_VER],
    });
    expect(editado.status).toBe(200);
    expect(editado.body.data).toMatchObject({
      nombre: 'Nómina Corporativa',
      alcance: 'empresa',
      permisos: [PERMISOS.INFORMES_VER, PERMISOS.USUARIOS_VER],
    });
    expect(audit.eventos.at(-1)).toMatchObject({
      accion: 'roles.editar',
      entidadId: id,
      datos: {
        antes: { nombre: 'Nómina', alcance: 'propio' },
        despues: {
          nombre: 'Nómina Corporativa',
          alcance: 'empresa',
          permisos: [PERMISOS.INFORMES_VER, PERMISOS.USUARIOS_VER],
        },
      },
    });
  });

  it('protege el rol Administrador contra cualquier edición o borrado', async () => {
    expect((await como(ADMIN).patch('/1', { nombre: 'Super Jefe' })).status).toBe(400);
    expect((await como(ADMIN).patch('/1', { alcance: 'propio' })).status).toBe(400);
    expect((await como(ADMIN).patch('/1', { permisos: [] })).status).toBe(400);
    expect((await como(ADMIN).del('/1')).status).toBe(409);
  });

  it('no permite borrar roles base ni roles con personas asignadas; sí borra roles nuevos vacíos', async () => {
    // Rol base sin personas tampoco se borra
    repo.filas[2].personas = 0;
    expect((await como(ADMIN).del('/3')).status).toBe(409);

    // Rol nuevo con personas no se borra
    const creado = await como(ADMIN).post('/', { nombre: 'Nómina', aPartirDeId: 4 });
    const id = creado.body.data.id;
    repo.filas.find((r) => r.id === id)!.personas = 2;
    expect((await como(ADMIN).del(`/${id}`)).status).toBe(409);

    // Al quedar con 0 personas sí se puede eliminar
    repo.filas.find((r) => r.id === id)!.personas = 0;
    expect((await como(ADMIN).del(`/${id}`)).status).toBe(204);
    expect((await como(ADMIN).get(`/${id}`)).status).toBe(404);
    expect(audit.eventos.at(-1)).toMatchObject({
      accion: 'roles.eliminar',
      entidadId: id,
      datos: { nombre: 'Nómina', clave: 'nomina' },
    });
  });
});

