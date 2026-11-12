export const ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  GUARDIA: 'guardia',
  CLIENTE: 'cliente',
  /** Operador del C2 (A-61): monitorea que los sitios tengan guardia y recibe los SOS. */
  C2: 'c2',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];
