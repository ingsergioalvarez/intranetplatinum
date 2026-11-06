import { z } from 'zod';
import { ALCANCES, type AlcanceRol } from '../constants/alcance';
import { CATALOGO_PERMISOS, PERMISOS, type Permiso } from '../constants/permisos';

/** Claves de permisos editables desde la pantalla de Roles y permisos (C-11 parte 5). */
export const PERMISOS_CATALOGO_CLAVES = CATALOGO_PERMISOS.map((p) => p.clave) as [Permiso, ...Permiso[]];

/**
 * Permisos que se pueden asignar de forma individual a una persona (C-11 parte 5, DC-019):
 * cualquiera del catálogo excepto `roles.administrar`, que solo se otorga a través de un rol.
 */
export const PERMISOS_INDIVIDUALES_CLAVES = CATALOGO_PERMISOS.map((p) => p.clave).filter(
  (c) => c !== PERMISOS.ROLES_ADMINISTRAR,
) as [Permiso, ...Permiso[]];

export interface RolEmpresa {
  id: number;
  clave: string;
  nombre: string;
  esBase: boolean;
  alcance: AlcanceRol;
  permisos: Permiso[];
  personas: number;
}

export const rolCreateSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del rol').max(60, 'Máximo 60 caracteres'),
  aPartirDeId: z.coerce.number().int().positive('Elige el rol de partida'),
});

export type RolCreate = z.infer<typeof rolCreateSchema>;

export const rolUpdateSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del rol').max(60, 'Máximo 60 caracteres').optional(),
  alcance: z.enum(ALCANCES, 'Selecciona un alcance válido').optional(),
  permisos: z
    .array(z.enum(PERMISOS_CATALOGO_CLAVES, 'Permiso no válido'))
    .transform((lista) => [...new Set(lista)])
    .optional(),
});

export type RolUpdate = z.infer<typeof rolUpdateSchema>;

export const usuarioPermisosSchema = z.object({
  permisos: z
    .array(z.enum(PERMISOS_INDIVIDUALES_CLAVES, 'Permiso individual no permitido'))
    .transform((lista) => [...new Set(lista)]),
});

export type UsuarioPermisosUpdate = z.infer<typeof usuarioPermisosSchema>;

