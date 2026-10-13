import type {
  Categoria,
  CategoriaCreate,
  CategoriaNodo,
  CategoriaUpdate,
  Paginated,
  ReporteCreate,
  ReporteDetalle,
  ReporteResumen,
  SitioReportable,
} from '@platinum/shared';
import { api, type ListParams } from '../../core/api';
import { formularioConFotos } from '../../core/files/comprimirImagen';

export const reportesService = {
  keys: {
    all: ['reportes'] as const,
    list: (params: ListParams) => ['reportes', 'list', params] as const,
    detail: (id: number) => ['reportes', 'detail', id] as const,
    sitios: ['reportes', 'sitios'] as const,
  },
  list: (params: ListParams) => api.get<Paginated<ReporteResumen>>('/reportes', { query: params }),
  detalle: (id: number) => api.get<ReporteDetalle>(`/reportes/${id}`),
  sitios: () => api.get<SitioReportable[]>('/reportes/sitios'),
  /** Fotos comprimidas en el dispositivo antes de subir. */
  crear: async (data: ReporteCreate, fotos: File[]) =>
    api.upload<ReporteDetalle>('/reportes', await formularioConFotos(data, fotos)),
  seguimiento: async (id: number, data: { comentario?: string; estatus?: string }, fotos: File[]) =>
    api.upload<ReporteDetalle>(`/reportes/${id}/seguimientos`, await formularioConFotos(data, fotos)),
};

export const categoriasService = {
  keys: {
    all: ['categorias'] as const,
    arbol: (todas: boolean) => ['categorias', todas] as const,
  },
  arbol: (todas = false) => api.get<CategoriaNodo[]>('/categorias', { query: { todas: todas || undefined } }),
  crear: (data: CategoriaCreate) => api.post<Categoria>('/categorias', data),
  actualizar: (id: number, data: CategoriaUpdate) => api.patch<Categoria>(`/categorias/${id}`, data),
};
