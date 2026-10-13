import { z } from 'zod';
import {
  ESTATUS_REPORTE,
  PRIORIDAD_REPORTE,
  type EstatusReporte,
  type PrioridadReporte,
} from '../constants/reportes';
import { coordenada, fechaSchema, idCoerce, textoOpcional } from './comunes';
import { paginationQuerySchema } from './pagination';

// ---------- Categorías (F3-01) ----------

const categoriaBase = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre').max(80),
  icono: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9-]*$/, 'Usa minúsculas, números y guiones')
    .transform((v) => v || null)
    .nullish(),
  orden: z.coerce.number().int().min(0).max(999),
  /** null = categoría principal. */
  padreId: z.coerce.number().int().positive().nullish(),
  activo: z.boolean(),
});

export const categoriaCreateSchema = categoriaBase.omit({ activo: true }).extend({
  orden: z.coerce.number().int().min(0).max(999).default(0),
});
export type CategoriaCreate = z.input<typeof categoriaCreateSchema>;

/** Sin defaults: un PATCH parcial no toca campos omitidos. */
export const categoriaUpdateSchema = categoriaBase.partial();
export type CategoriaUpdate = z.input<typeof categoriaUpdateSchema>;

export interface Categoria {
  id: number;
  padreId: number | null;
  nombre: string;
  icono: string | null;
  orden: number;
  activo: boolean;
}

/** Categoría principal con sus subcategorías (árbol de 2 niveles). */
export interface CategoriaNodo extends Categoria {
  hijas: Categoria[];
}

// ---------- Reportes (F3-02..F3-06) ----------

/** Campos de texto del alta (llegan en multipart junto con las fotos). */
export const reporteCreateSchema = z.object({
  sitioId: idCoerce('Selecciona el sitio'),
  categoriaId: idCoerce('Selecciona la categoría'),
  prioridad: z.enum(PRIORIDAD_REPORTE, 'Selecciona la prioridad'),
  titulo: z.string().trim().min(5, 'Describe brevemente el problema (mín. 5 caracteres)').max(150),
  descripcion: z.string().trim().min(10, 'Agrega más detalle (mín. 10 caracteres)').max(2000),
  ubicacionDetalle: textoOpcional(200),
  lat: coordenada(-90, 90),
  lng: coordenada(-180, 180),
});

export type ReporteCreate = z.input<typeof reporteCreateSchema>;
export type ReporteCreateData = z.output<typeof reporteCreateSchema>;

export const seguimientoCreateSchema = z.object({
  comentario: textoOpcional(2000),
  estatus: z
    .union([z.enum(ESTATUS_REPORTE), z.literal('')])
    .transform((v) => v || undefined)
    .optional(),
});

export type SeguimientoCreate = z.input<typeof seguimientoCreateSchema>;
export type SeguimientoCreateData = z.output<typeof seguimientoCreateSchema>;

const idOpcional = z.coerce.number().int().positive().optional();

export const reporteFiltroSchema = paginationQuerySchema.extend({
  /** Folio o texto del título. */
  q: z.string().trim().max(100).optional(),
  estatus: z.enum(ESTATUS_REPORTE).optional(),
  prioridad: z.enum(PRIORIDAD_REPORTE).optional(),
  clienteId: idOpcional,
  sitioId: idOpcional,
  categoriaId: idOpcional,
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
  /** Solo los creados por el usuario en sesión. */
  mios: z.stringbool().optional(),
});

export type ReporteFiltro = z.infer<typeof reporteFiltroSchema>;

export interface Persona {
  id: number;
  nombre: string;
}

export interface ReporteResumen {
  id: number;
  folio: string;
  titulo: string;
  prioridad: PrioridadReporte;
  estatus: EstatusReporte;
  createdAt: string;
  cerradoEn: string | null;
  sitio: { id: number; nombre: string };
  cliente: { id: number; nombreComercial: string };
  categoria: { id: number; nombre: string; padre: string | null };
  creadoPor: Persona;
  totalFotos: number;
}

/** Foto de evidencia; `url` es un enlace firmado que caduca. */
export interface Evidencia {
  id: number;
  url: string;
  mime: string;
  tamano: number;
  createdAt: string;
  subidaPor: Persona;
}

export interface Seguimiento {
  id: number;
  usuario: Persona;
  comentario: string | null;
  estatusAnterior: EstatusReporte | null;
  estatusNuevo: EstatusReporte | null;
  createdAt: string;
  evidencias: Evidencia[];
}

export interface ReporteDetalle extends ReporteResumen {
  descripcion: string;
  ubicacionDetalle: string | null;
  lat: number | null;
  lng: number | null;
  evidencias: Evidencia[];
  seguimientos: Seguimiento[];
  /** Lo que el usuario en sesión puede hacer con este reporte. */
  acciones: { comentar: boolean; estatusPermitidos: EstatusReporte[] };
}

/** Sitio elegible para reportar (`GET /reportes/sitios`). */
export interface SitioReportable {
  id: number;
  nombre: string;
  direccion: string | null;
  cliente: { id: number; nombreComercial: string };
}
