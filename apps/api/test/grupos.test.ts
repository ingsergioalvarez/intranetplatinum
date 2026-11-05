import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type Grupo, type GrupoData, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import { createGruposModule } from '../src/modules/grupos';
import { GruposRepository, type GrupoFiltro } from '../src/modules/grupos/grupos.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

// Guardias activos de la prueba.
const GUARDIAS = [21, 22, 31];

class Memoria extends GruposRepository {
  grupos: Grupo[] = [];
  integrantes = new Map<number, number[]>();
  async listar({ estado }: GrupoFiltro) {
    return this.grupos
      .filter((g) => (estado === 'activos' ? !g.deletedAt : estado === 'baja' ? !!g.deletedAt : true));
  }
  async findById(id: number) {
    return this.grupos.find((g) => g.id === id) ?? null;
  }
  async nombreOcupado(nombre: string, excluirId?: number) {
    return this.grupos.some((g) => g.nombre === nombre && g.id !== excluirId);
  }
  async crear(data: GrupoData) {
    const id = this.grupos.length + 1;
    this.grupos.push({
      id,
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      deletedAt: null,
      integrantes: [],
      asignacionesVigentes: 0,
    });
    return id;
  }
  async actualizar(id: number, data: Partial<GrupoData>) {
    Object.assign(this.grupos[id - 1], data);
  }
  async guardiasActivos(ids: number[]) {
    return ids.filter((id) => GUARDIAS.includes(id));
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

const tokenDe = (id: number, rol: Rol, extra: { esSuperAdmin?: boolean } = {}) =>
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

describe('grupos de la empresa', () => {
  it('lo que crea un admin lo ven todos los admin y el supervisor', async () => {
    const a = await como(A).post('', { nombre: 'Grupo de A', usuarioIds: [21] });
    expect(a.status).toBe(201);
    await como(B).post('', { nombre: 'Grupo de B', usuarioIds: [31] });
    const todos = ['Grupo de A', 'Grupo de B'];
    expect(nombres(await como(A).get())).toEqual(todos);
    expect(nombres(await como(B).get())).toEqual(todos);
    expect(nombres(await como(SUPER).get())).toEqual(todos);
    expect(nombres(await como(tokenDe(5, ROLES.SUPERVISOR)).get())).toEqual(todos);
  });

  it('cualquier admin edita y da de baja los grupos de la empresa', async () => {
    await como(B).post('', { nombre: 'Grupo de B', usuarioIds: [31] });
    expect((await como(A).get('/1')).status).toBe(200);
    expect((await como(A).patch('/1', { nombre: 'Renombrado' })).status).toBe(200);
    expect((await como(A).put('/1/integrantes', { usuarioIds: [21] })).status).toBe(200);
    expect((await como(A).patch('/1/baja')).status).toBe(204);
  });

  it('solo se agregan guardias activos', async () => {
    const r = await como(A).post('', { nombre: 'Mezcla', usuarioIds: [21, 99] });
    expect(r.status).toBe(400);
    expect(r.body.error.details[0]).toMatchObject({ path: 'usuarioIds' });
  });
});
