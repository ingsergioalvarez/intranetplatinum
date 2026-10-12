export const ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  GUARDIA: 'guardia',
  CLIENTE: 'cliente',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];
