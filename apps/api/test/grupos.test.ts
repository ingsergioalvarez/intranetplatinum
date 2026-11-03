import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type Grupo, type GrupoData, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import { createGruposModule } from '../src/modules/grupos';
import { GruposRepository, type GrupoFiltro } from '../src/modules/grupos/grupos.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

// Guardias: 21 y 22 son del admin 10; 31 es del admin 11.
const DUENO_GUARDIA: Record<number, number> = { 21: 10, 22: 10, 31: 11 };

class Memoria extends GruposRepository {
  grupos: Grupo[] = [];
  integrantes = new Map<number, number[]>();
  async listar({ estado }: GrupoFiltro, _hoy: string, cartera?: number) {
    return this.grupos
      .filter((g) => cartera === undefined || g.propietario?.id === cartera)
      .filter((g) => (estado === 'activos' ? !g.deletedAt : estado === 'baja' ? !!g.deletedAt : true));
  }
  async findById(id: number) {
    return this.grupos.find((g) => g.id === id) ?? null;
  }
  async nombreOcupado(nombre: string, excluirId?: number) {
    return this.grupos.some((g) => g.nombre === nombre && g.id !== excluirId);
  }
  async crear(data: GrupoData, propietarioId: number | null) {
    const id = this.grupos.length + 1;
    this.grupos.push({
      id,
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      deletedAt: null,
      propietario: propietarioId ? { id: propietarioId, nombre: `Admin ${propietarioId}` } : null,
      integrantes: [],
      asignacionesVigentes: 0,
    });
    return id;
  }
  async actualizar(id: number, data: Partial<GrupoData>) {
    Object.assign(this.grupos[id - 1], data);
  }
  async guardiasActivos(ids: number[], cartera?: number) {
    return ids.filter((id) => id in DUENO_GUARDIA && (cartera === undefined || DUENO_GUARDIA[id] === cartera));
  }
  async setIntegrantes(id: number, usuarioIds: number[]) {
    this.integrantes.set(id, usuarioIds);
    this.grupos[id - 1].integrantes = usuarioIds.map((u) => ({ id: u, nombre: `Guardia ${u}`, email: `${u}@x.mx` }));
  }
  async softDelete(id: number) {
    this.grupos[id - 1].deletedAt = new Date().toISOString();
  }
  async restore(id: number) {
    this.grupos[id - 1].deletedAt = null;
  }
}

let repo: Memoria;
let app: ReturnType<typeof createApp>;

const tokenDe = (id: number, rol: Rol, extra: { esSuperAdmin?: boolean; propietarioId?: number } = {}) =>
  signAccessToken({ id, email: `u${id}@x.mx`, rol, permisos: PERMISOS_POR_ROL[rol], ...extra });
const SUPER = tokenDe(1, ROLES.ADMIN, { esSuperAdmin: true });
const A = tokenDe(10, ROLES.ADMIN);
const B = tokenDe(11, ROLES.ADMIN);

const como = (t: string) => ({
  get: (u = '') => request(app).get(`/api/grupos${u}`).set('Authorization', `Bearer ${t}`),
  post: (u = '', b?: object) => request(app).post(`/api/grupos${u}`).set('Authorization', `Bearer ${t}`).send(b),
  put: (u: string, b?: object) => request(app).put(`/api/grupos${u}`).set('Authorization', `Bearer ${t}`).send(b),
  patch: (u: string, b?: object) => request(app).patch(`/api/grupos${u}`).set('Authorization', `Bearer ${t}`).send(b),
});

beforeEach(() => {
  repo = new Memoria();
  app = createApp([
    createGruposModule({ repo, audit: new MemoryAuditLogger(), avisar: async () => undefined, bitacora: async () => undefined }),
  ]);
});

const nombres = (res: request.Response) => res.body.data.map((g: { nombre: string }) => g.nombre).sort();

describe('grupos: carteras de admin (A-65)', () => {
  it('lo que crea un admin es suyo; el otro admin no lo ve y el super admin ve todo', async () => {
    const a = await como(A).post('', { nombre: 'Grupo de A', usuarioIds: [21] });
    expect(a.status).toBe(201);
    expect(a.body.data.propietario).toEqual({ id: 10, nombre: 'Admin 10' });
    await como(B).post('', { nombre: 'Grupo de B', usuarioIds: [31] });
    expect(nombres(await como(A).get())).toEqual(['Grupo de A']);
    expect(nombres(await como(B).get())).toEqual(['Grupo de B']);
    expect(nombres(await como(SUPER).get())).toEqual(['Grupo de A', 'Grupo de B']);
  });

  it('un grupo de otro admin no existe para el admin: ni verlo ni editarlo ni darlo de baja', async () => {
    await como(B).post('', { nombre: 'Grupo de B', usuarioIds: [31] });
    expect((await como(A).get('/1')).status).toBe(404);
    expect((await como(A).patch('/1', { nombre: 'Robado' })).status).toBe(404);
    expect((await como(A).put('/1/integrantes', { usuarioIds: [21] })).status).toBe(404);
    expect((await como(A).patch('/1/baja')).status).toBe(404);
    expect((await como(B).get('/1')).status).toBe(200);
    expect((await como(SUPER).get('/1')).status).toBe(200);
  });

  it('un admin solo agrega a sus guardias; el super admin, a cualquiera', async () => {
    const ajeno = await como(A).post('', { nombre: 'Mezcla', usuarioIds: [21, 31] });
    expect(ajeno.status).toBe(400);
    expect(ajeno.body.error.details[0]).toMatchObject({ path: 'usuarioIds' });
    expect((await como(SUPER).post('', { nombre: 'De todos', usuarioIds: [21, 31] })).status).toBe(201);
    expect((await como(A).put('/1/integrantes', { usuarioIds: [21, 22] })).status).toBe(404);
  });

  it('un supervisor ve los grupos de su admin', async () => {
    await como(A).post('', { nombre: 'Grupo de A', usuarioIds: [21] });
    await como(B).post('', { nombre: 'Grupo de B', usuarioIds: [31] });
    const supDeA = tokenDe(5, ROLES.SUPERVISOR, { propietarioId: 10 });
    expect(nombres(await como(supDeA).get())).toEqual(['Grupo de A']);
    expect(nombres(await como(tokenDe(5, ROLES.SUPERVISOR)).get())).toEqual([]);
  });
});
