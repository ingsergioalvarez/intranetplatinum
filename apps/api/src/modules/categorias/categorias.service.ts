import type { Categoria, CategoriaNodo } from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, calcularCambios, type AccionCtx } from '../../core';
import type { CategoriaCreateData, CategoriasRepository } from './categorias.repository';

const nombreRepetido = () =>
  HttpError.conflict('Ya existe una categoría con ese nombre en el mismo nivel', [
    { path: 'nombre', message: 'Ya existe una categoría con ese nombre en el mismo nivel' },
  ]);

/** Arma el árbol de 2 niveles; las subcategorías cuyo padre no viene en la lista se omiten. */
export function armarArbol(categorias: Categoria[]): CategoriaNodo[] {
  const principales = categorias
    .filter((c) => c.padreId === null)
    .map((c) => ({ ...c, hijas: [] as Categoria[] }));
  const porId = new Map(principales.map((p) => [p.id, p]));
  for (const c of categorias) if (c.padreId !== null) porId.get(c.padreId)?.hijas.push(c);
  return principales;
}

/** Catálogo de tipos de incidencia (F3-01, A-12): el admin lo amplía sin tocar código. */
export class CategoriasService extends BaseService {
  constructor(
    private readonly repo: CategoriasRepository,
    private readonly audit: AuditLogger,
  ) {
    super();
  }

  async arbol(incluirInactivas: boolean) {
    return armarArbol(await this.repo.listar(incluirInactivas));
  }

  async crear(data: CategoriaCreateData, ctx: AccionCtx) {
    const padreId = data.padreId ?? null;
    if (padreId !== null) await this.validarPadre(padreId);
    if (await this.repo.nombreOcupado(data.nombre, padreId)) throw nombreRepetido();
    const categoria = await this.repo.crear({ ...data, padreId });
    await this.audit.registrarAccion(ctx, 'catalogos.categoria_crear', 'categorias_reporte', categoria.id, {
      nombre: categoria.nombre,
      padreId,
    });
    return categoria;
  }

  async actualizar(id: number, data: Partial<Categoria>, ctx: AccionCtx) {
    const actual = await this.repo.findById(id);
    if (!actual) throw HttpError.notFound('Categoría no encontrada');

    const padreId = data.padreId === undefined ? actual.padreId : (data.padreId ?? null);
    if (padreId !== actual.padreId && padreId !== null) {
      if (padreId === id) throw HttpError.badRequest('Una categoría no puede ser su propia subcategoría');
      if ((await this.repo.contarHijas(id)) > 0) {
        throw HttpError.conflict('Tiene subcategorías: no puede convertirse en subcategoría');
      }
      await this.validarPadre(padreId);
    }
    const nombre = data.nombre ?? actual.nombre;
    const cambiaIdentidad = nombre !== actual.nombre || padreId !== actual.padreId;
    if (cambiaIdentidad && (await this.repo.nombreOcupado(nombre, padreId, id))) throw nombreRepetido();

    const { antes, despues, hayCambios } = calcularCambios<Categoria>(actual, { ...data, padreId });
    if (!hayCambios) return actual;
    const categoria = await this.repo.actualizar(id, despues);
    await this.audit.registrarAccion(ctx, 'catalogos.categoria_editar', 'categorias_reporte', id, {
      antes,
      despues,
    });
    return categoria;
  }

  /** Solo 2 niveles: el padre debe ser una categoría principal. */
  private async validarPadre(padreId: number) {
    const padre = await this.repo.findById(padreId);
    if (!padre || padre.padreId !== null) {
      throw HttpError.badRequest('Datos inválidos', [
        { path: 'padreId', message: 'Elige una categoría principal' },
      ]);
    }
  }
}
