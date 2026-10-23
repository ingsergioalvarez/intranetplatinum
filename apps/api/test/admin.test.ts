import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { PERMISOS_POR_ROL, type HistorialUsuario, type Rol } from '@platinum/shared';
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

const token = (id: number, rol: Rol) =>
  `Bearer ${signAccessToken({ id, email: `u${id}@x.mx`, rol, permisos: PERMISOS_POR_ROL[rol] })}`;
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
