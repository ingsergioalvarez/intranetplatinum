export const ROLES = {
  ADMIN: 'admin',
  /** Encabeza un área: ve y maneja lo operativo de su área y subáreas (C-10). Se asigna al designarlo jefe de un área. */
  JEFE: 'jefe',
  SUPERVISOR: 'supervisor',
  GUARDIA: 'guardia',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];
