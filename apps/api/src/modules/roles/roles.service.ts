import {
  ROLES,
  type AlcanceRol,
  type Permiso,
  type RolCreate,
  type RolEmpresa,
  type RolUpdate,
} from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, type AccionCtx } from '../../core';
import type { RolesRepository } from './roles.repository';

const ORDEN_BASE: Record<string, number> = {
  [ROLES.ADMIN]: 0,
  [ROLES.JEFE]: 1,
  [ROLES.SUPERVISOR]: 2,
  [ROLES.COLABORADOR]: 3,
};

const normalizarNombre = (texto: string) => texto.trim().toLocaleLowerCase('es');

function generarClave(nombre: string, ocupadas: Set<string>): string {
  const base =
    nombre
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'rol';
  if (!ocupadas.has(base)) return base;
  let n = 2;
  while (ocupadas.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export class RolesService extends BaseService {
  constructor(
    private readonly repo: RolesRepository,
    private readonly audit: AuditLogger,
  ) {
    super();
  }

  async list(): Promise<RolEmpresa[]> {
    const todos = await this.repo.todos();
    return [...todos].sort((a, b) => {
      const oa = ORDEN_BASE[a.clave] ?? 99;
      const ob = ORDEN_BASE[b.clave] ?? 99;
      if (oa !== ob) return oa - ob;
      return a.nombre.localeCompare(b.nombre, 'es');
    });
  }

  async getById(id: number): Promise<RolEmpresa> {
    const rol = await this.repo.findById(id);
    if (!rol) throw HttpError.notFound('Rol no encontrado');
    return rol;
  }

  private sinRepetirNombre(roles: RolEmpresa[], nombre: string, ignorarId?: number) {
    const buscado = normalizarNombre(nombre);
    const repetido = roles.some((r) => r.id !== ignorarId && normalizarNombre(r.nombre) === buscado);
    if (repetido) {
      throw HttpError.conflict('Ya existe un rol con ese nombre', [
        { path: 'nombre', message: 'Ya existe un rol con ese nombre' },
      ]);
    }
  }

  async crear({ nombre, aPartirDeId }: RolCreate, ctx: AccionCtx): Promise<RolEmpresa> {
    const todos = await this.repo.todos();
    const origen = todos.find((r) => r.id === aPartirDeId);
    if (!origen) {
      throw HttpError.notFound('Rol de partida no encontrado');
    }
    const nombreLimpio = nombre.trim();
    this.sinRepetirNombre(todos, nombreLimpio);

    const ocupadas = new Set(todos.map((r) => r.clave));
    const clave = generarClave(nombreLimpio, ocupadas);
    const creado = await this.repo.crear({
      clave,
      nombre: nombreLimpio,
      alcance: origen.alcance,
      permisos: origen.permisos,
      aPartirDeId: origen.id,
    });
    await this.registrar(ctx, 'roles.crear', creado.id, {
      nombre: creado.nombre,
      clave: creado.clave,
      aPartirDe: origen.nombre,
      alcance: creado.alcance,
      permisos: creado.permisos,
    });
    return creado;
  }

  async actualizar(id: number, cambios: RolUpdate, ctx: AccionCtx): Promise<RolEmpresa> {
    const todos = await this.repo.todos();
    const actual = todos.find((r) => r.id === id);
    if (!actual) throw HttpError.notFound('Rol no encontrado');
    if (actual.clave === ROLES.ADMIN) {
      throw HttpError.badRequest('El rol Administrador es fijo y no se puede modificar');
    }

    const antes: Record<string, unknown> = {};
    const despues: Record<string, unknown> = {};
    const datos: { nombre?: string; alcance?: AlcanceRol; permisos?: Permiso[] } = {};

    if (cambios.nombre !== undefined) {
      const nombreLimpio = cambios.nombre.trim();
      if (nombreLimpio !== actual.nombre) {
        this.sinRepetirNombre(todos, nombreLimpio, id);
        datos.nombre = nombreLimpio;
        antes.nombre = actual.nombre;
        despues.nombre = nombreLimpio;
      }
    }

    if (cambios.alcance !== undefined && cambios.alcance !== actual.alcance) {
      datos.alcance = cambios.alcance;
      antes.alcance = actual.alcance;
      despues.alcance = cambios.alcance;
    }

    if (cambios.permisos !== undefined) {
      const actuales = [...actual.permisos].sort();
      const nuevos = [...new Set(cambios.permisos)].sort();
      if (actuales.length !== nuevos.length || actuales.some((p, i) => p !== nuevos[i])) {
        datos.permisos = nuevos;
        antes.permisos = actuales;
        despues.permisos = nuevos;
      }
    }

    if (Object.keys(despues).length === 0) return actual;

    const actualizado = await this.repo.actualizar(id, datos);
    await this.registrar(ctx, 'roles.editar', id, { nombre: actualizado.nombre, antes, despues });
    return actualizado;
  }

  async eliminar(id: number, ctx: AccionCtx): Promise<void> {
    const actual = await this.getById(id);
    if (actual.esBase) {
      throw HttpError.conflict('Los roles base no se pueden eliminar');
    }
    if (actual.personas > 0) {
      throw HttpError.conflict('No se puede eliminar un rol que tiene personas asignadas');
    }
    await this.repo.eliminar(id);
    await this.registrar(ctx, 'roles.eliminar', id, { nombre: actual.nombre, clave: actual.clave });
  }

  private registrar(ctx: AccionCtx, accion: string, id: number, datos: Record<string, unknown>) {
    this.log(accion, { actorId: ctx.actorId, rolId: id });
    return this.audit.registrarAccion(ctx, accion, 'roles', id, datos);
  }
}

