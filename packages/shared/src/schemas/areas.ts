import { z } from 'zod';
import type { Rol } from '../constants/roles';

/**
 * Áreas de la empresa (C-10): RH, Sistemas, Técnicos… con subáreas sin límite de niveles. Cada persona pertenece a una
 * sola área. El jefe del área forma parte de ella.
 */
const nombreArea = z.string().trim().min(2, 'Escribe el nombre del área').max(100, 'Máximo 100 caracteres');
const id = z.number().int().positive();

export const areaCreateSchema = z.object({
  nombre: nombreArea,
  /** Área superior; null o ausente = área de primer nivel. */
  padreId: id.nullish(),
  /** Si se indica, esa persona pasa a formar parte del área y queda como su jefe. */
  jefeId: id.nullish(),
  /** Supervisores del área (varios): pasan a formar parte de ella y su rol cambia solo a Supervisor. */
  supervisorIds: z.array(id).max(20).optional(),
});
export type AreaCreateInput = z.input<typeof areaCreateSchema>;
export type AreaCreate = z.output<typeof areaCreateSchema>;

/** Sin valores por defecto: en un PATCH solo cambia lo que se manda. */
export const areaUpdateSchema = z
  .object({
    nombre: nombreArea,
    padreId: id.nullable(),
    jefeId: id.nullable(),
    /** La lista completa de supervisores: los que ya no estén dejan de serlo. */
    supervisorIds: z.array(id).max(20),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'No hay nada que cambiar');
export type AreaUpdate = z.infer<typeof areaUpdateSchema>;

export const ESTADOS_AREA = ['activas', 'bajas', 'todas'] as const;
export const areaFiltroSchema = z.object({
  estado: z.enum(ESTADOS_AREA).default('activas'),
});
export type AreaFiltro = z.infer<typeof areaFiltroSchema>;

/** Mover a una persona a un área (null = dejarla sin área). */
export const asignarAreaSchema = z.object({ areaId: id.nullable() });
export type AsignarArea = z.infer<typeof asignarAreaSchema>;

export const candidatosAreaFiltroSchema = z.object({
  q: z.string().trim().max(100).optional(),
});
export type CandidatosAreaFiltro = z.infer<typeof candidatosAreaFiltroSchema>;

export interface Area {
  id: number;
  nombre: string;
  /** Ruta completa desde el primer nivel, por ejemplo "RH / Nómina". */
  nombreCompleto: string;
  padreId: number | null;
  jefe: { id: number; nombre: string } | null;
  /** Responsables del equipo, debajo del jefe (varios). */
  supervisores: { id: number; nombre: string }[];
  /** Personas que están directamente en el área. */
  personas: number;
  /** Personas del área y de todas sus subáreas. */
  personasTotal: number;
  /** Subáreas activas directas. */
  subareas: number;
  deletedAt: string | null;
}

export interface PersonaDeArea {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  esJefe: boolean;
  esSupervisor: boolean;
}

/** Persona que se puede agregar a un área, con el área que tiene hoy. */
export interface CandidatoArea {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  area: { id: number; nombreCompleto: string } | null;
}
