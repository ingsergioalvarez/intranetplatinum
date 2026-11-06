import { ROLES, type Rol } from './roles';

/**
 * Hasta dónde llega un rol (C-11 parte 4, DC-019): a cuántas personas puede ver y manejar. Es una propiedad de cada rol
 * (se edita en la pantalla de Roles) y no depende de cómo se llame.
 * - `empresa`: a todas las de la empresa.
 * - `area_subareas`: a las de su área (o las que encabeza o supervisa) y las de todas sus subáreas.
 * - `area`: solo a las de su área (o las que encabeza o supervisa).
 * - `propio`: solo a sí misma.
 */
export const ALCANCES = ['empresa', 'area_subareas', 'area', 'propio'] as const;
export type AlcanceRol = (typeof ALCANCES)[number];

export const ALCANCE_LABEL: Record<AlcanceRol, string> = {
  empresa: 'Toda la empresa',
  area_subareas: 'Su área y sus subáreas',
  area: 'Solo su área',
  propio: 'Solo ella o él',
};

/** Alcance de partida de cada rol de partida. Un rol nuevo empieza en `propio` (lo menos) hasta que se edite. */
export const ALCANCE_POR_ROL: Record<Rol, AlcanceRol> = {
  [ROLES.ADMIN]: 'empresa',
  [ROLES.JEFE]: 'area_subareas',
  [ROLES.SUPERVISOR]: 'area',
  [ROLES.COLABORADOR]: 'propio',
};
