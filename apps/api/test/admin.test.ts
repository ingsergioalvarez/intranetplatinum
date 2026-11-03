import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  PERMISOS_POR_ROL,
  type HistorialCliente,
  type HistorialSitio,
  type HistorialUsuario,
  type Rol,
} from '@platinum/shared';
import { createApp } from '../src/app';
import { StorageService, signAccessToken } from '../src/core';
import { createAdminModule } from '../src/modules/admin';
import { AdminRepository, type UsuarioEliminable } from '../src/modules/admin/admin.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

class MemoryAdminRepository extends AdminRepository {
  usuarios = new Map<number, UsuarioEliminable & { archivos: string[]; historial: HistorialUsuario }>();
  async findUsuario(id: number) {
    return this.usuarios.get(id) ?? null;
  }
  async adminsActivos() {
    return [...this.usuarios.values()].filter((u) => u.rol === 'admin' && u.activo && !u.deletedAt).length;
  }
  async historial(id: number) {
    return this.usuarios.get(id)!.historial;
  }
  async eliminarUsuario(id: number) {
    const archivos = this.usuarios.get(id)!.archivos;
    this.usuarios.delete(id);
    return archivos;
  }

  sitios = new Map([[7, { id: 7, nombre: 'POETAS', clienteId: 3 }]]);
  clientes = new Map([[3, { id: 3, nombre: 'CMC NETWORK' }]]);
  borrados: string[] = [];
  async findSitio(id: number) {
    return this.sitios.get(id) ?? null;
  }
  async findCliente(id: number) {
    return this.clientes.get(id) ?? null;
  }
  async historialSitio(): Promise<HistorialSitio> {
    return { asignaciones: 2, marcas: 40, reportes: 3, coberturas: 1 };
  }
  async historialCliente(): Promise<HistorialCliente> {
    return {
      asignaciones: 2,
      marcas: 40,
      reportes: 3,
      coberturas: 1,
      sitios: 2,
      contactos: 1,
      usuariosPortal: 1,
    };
  }
  async eliminarSitio(id: number) {
    this.sitios.delete(id);
    this.borrados.push(`sitio-${id}`);
    return ['reportes/a.jpg', 'asistencia/b.jpg'];
  }
  async eliminarCliente(id: number) {
    this.clientes.delete(id);
    this.sitios.clear();
    this.borrados.push(`cliente-${id}`);
    return ['reportes/c.jpg'];
  }
}

class MemoryStorage extends StorageService {
  eliminados: string[] = [];
  async guardar() {
    return '';
  }
  async leer() {
    return null;
  }
  async eliminar(clave: string) {
    this.eliminados.push(clave);
  }
}

const sinHistorial: HistorialUsuario = {
  marcas: 0,
  rostros: 0,
  reportes: 0,
  seguimientos: 0,
  asignaciones: 0,
};

let app: Express;
let repo: MemoryAdminRepository;
let storage: MemoryStorage;
let audit: MemoryAuditLogger;

/** Los admin de estas pruebas son super admin (sin límite de cartera), salvo que se pida otra cosa. */
const token = (id: number, rol: Rol, esSuperAdmin = rol === 'admin') =>
  `Bearer ${signAccessToken({ id, email: `u${id}@x.mx`, rol, permisos: PERMISOS_POR_ROL[rol], esSuperAdmin })}`;
const eliminar = (id: number, rol: Rol = 'admin', actor = 1) =>
  request(app).delete(`/api/admin/usuarios/${id}`).set('Authorization', token(actor, rol));

beforeEach(() => {
  repo = new MemoryAdminRepository();
  storage = new MemoryStorage();
  audit = new MemoryAuditLogger();
  const usuario = (id: number, rol: string, extra: Partial<HistorialUsuario> = {}, archivos: string[] = []) =>
    repo.usuarios.set(id, {
      id,
      nombre: `Usuario ${id}`,
      email: `u${id}@x.mx`,
      rol,
      activo: true,
      deletedAt: null,
      archivos,
      historial: { ...sinHistorial, ...extra },
    });
  usuario(1, 'admin');
  usuario(2, 'supervisor');
  usuario(10, 'guardia', { marcas: 4, rostros: 1, reportes: 2 }, ['asistencia/a.jpg', 'rostros/r.jpg']);
  app = createApp([createAdminModule({ repo, storage, audit })]);
});

describe('admin: eliminar usuario definitivamente', () => {
  it('solo el admin; el supervisor no', async () => {
    expect((await eliminar(10, 'supervisor', 2)).status).toBe(403);
    const historial = await request(app)
      .get('/api/admin/usuarios/10/historial')
      .set('Authorization', token(2, 'supervisor'));
    expect(historial.status).toBe(403);
  });

  it('muestra el historial que se perderá', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios/10/historial')
      .set('Authorization', token(1, 'admin'));
    expect(res.body.data).toMatchObject({ marcas: 4, rostros: 1, reportes: 2 });
  });

  it('elimina aunque tenga historial, borra sus archivos y lo deja en auditoría', async () => {
    expect((await eliminar(10)).status).toBe(204);
    expect(repo.usuarios.has(10)).toBe(false);
    expect(storage.eliminados).toEqual(['asistencia/a.jpg', 'rostros/r.jpg']);
    const evento = audit.eventos.find((e) => e.accion === 'usuarios.eliminar_definitivo')!;
    expect(evento.datos).toMatchObject({ email: 'u10@x.mx', marcas: 4, reportes: 2, archivos: 2 });
    expect((await eliminar(10)).status).toBe(404);
  });

  it('no se puede eliminar a sí mismo ni al único admin activo', async () => {
    expect((await eliminar(1)).status).toBe(400);
    repo.usuarios.set(3, { ...repo.usuarios.get(1)!, id: 3, email: 'u3@x.mx' });
    repo.usuarios.get(3)!.activo = false; // admin 3 dado de baja: el 1 sigue siendo el único activo
    expect((await eliminar(1, 'admin', 3)).status).toBe(409);
  });
});

describe('admin: eliminar sitios y clientes definitivamente (DA-50)', () => {
  const como = (rol: Rol, actor = 1) => ({
    get: (u: string) => request(app).get(`/api/admin${u}`).set('Authorization', token(actor, rol)),
    delete: (u: string) => request(app).delete(`/api/admin${u}`).set('Authorization', token(actor, rol)),
  });

  it('solo el admin; el supervisor no', async () => {
    expect((await como('supervisor').delete('/sitios/7')).status).toBe(403);
    expect((await como('supervisor').delete('/clientes/3')).status).toBe(403);
    expect((await como('supervisor').get('/sitios/7/historial')).status).toBe(403);
    expect(repo.borrados).toEqual([]);
  });

  it('muestra lo que se perderá', async () => {
    expect((await como('admin').get('/sitios/7/historial')).body.data).toEqual({
      asignaciones: 2,
      marcas: 40,
      reportes: 3,
      coberturas: 1,
    });
    expect((await como('admin').get('/clientes/3/historial')).body.data).toMatchObject({
      sitios: 2,
      contactos: 1,
      usuariosPortal: 1,
    });
    expect((await como('admin').get('/sitios/99/historial')).status).toBe(404);
  });

  it('elimina el sitio, borra sus archivos y lo deja en auditoría', async () => {
    expect((await como('admin').delete('/sitios/7')).status).toBe(204);
    expect(repo.borrados).toEqual(['sitio-7']);
    expect(storage.eliminados).toEqual(['reportes/a.jpg', 'asistencia/b.jpg']);
    expect(audit.acciones()).toEqual(['sitios.eliminar_definitivo']);
    expect((await como('admin').delete('/sitios/7')).status).toBe(404);
  });

  it('elimina el cliente con todo lo suyo y lo deja en auditoría', async () => {
    expect((await como('admin').delete('/clientes/3')).status).toBe(204);
    expect(storage.eliminados).toEqual(['reportes/c.jpg']);
    expect(audit.acciones()).toEqual(['clientes.eliminar_definitivo']);
    expect((await como('admin').delete('/clientes/3')).status).toBe(404);
  });
});

describe('admin: eliminar definitivamente solo lo de su cartera (A-65)', () => {
  // Admin A = 10, admin B = 11 (no son super admin). El guardia 20 es de A; el cliente 3 y su sitio 7 también.
  const normal = (id: number) => `Bearer ${signAccessToken({ id, email: `u${id}@x.mx`, rol: 'admin', permisos: PERMISOS_POR_ROL.admin })}`;
  const del = (u: string, t: string) => request(app).delete(`/api/admin${u}`).set('Authorization', t);
  const get = (u: string, t: string) => request(app).get(`/api/admin${u}`).set('Authorization', t);

  beforeEach(() => {
    const base = { activo: true, deletedAt: null, archivos: [], historial: { ...sinHistorial } };
    repo.usuarios.set(20, { ...base, id: 20, nombre: 'Guardia de A', email: 'g@x.mx', rol: 'guardia', propietarioId: 10 });
    repo.usuarios.set(11, { ...base, id: 11, nombre: 'Admin B', email: 'b@x.mx', rol: 'admin', propietarioId: 1 });
    repo.usuarios.set(1, { ...repo.usuarios.get(1)!, esSuperAdmin: true });
    repo.sitios.set(7, { id: 7, nombre: 'POETAS', clienteId: 3, propietarioId: 10 } as never);
    repo.clientes.set(3, { id: 3, nombre: 'CMC NETWORK', propietarioId: 10 } as never);
  });

  it('un admin elimina lo suyo, no lo de otro admin', async () => {
    expect((await get('/usuarios/20/historial', normal(11))).status).toBe(404);
    expect((await del('/usuarios/20', normal(11))).status).toBe(404);
    expect((await del('/sitios/7', normal(11))).status).toBe(404);
    expect((await del('/clientes/3', normal(11))).status).toBe(404);
    expect(repo.usuarios.has(20)).toBe(true);
    expect((await del('/usuarios/20', normal(10))).status).toBe(204);
    expect((await del('/sitios/7', normal(10))).status).toBe(204);
    expect((await del('/clientes/3', normal(10))).status).toBe(204);
  });

  it('un admin normal no toca a otro admin ni al super admin; el super admin sí a todo menos a sí mismo', async () => {
    expect((await del('/usuarios/11', normal(10))).status).toBe(404);
    expect((await del('/usuarios/1', normal(10))).status).toBe(404);
    const superToken = token(1, 'admin', true);
    expect((await del('/usuarios/1', superToken)).status).toBe(400);
    expect((await del('/usuarios/11', superToken)).status).toBe(204);
    expect((await del('/usuarios/20', superToken)).status).toBe(204);
  });
});
