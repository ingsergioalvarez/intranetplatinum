import type { AuthUser } from './types/auth';

/** El super admin (A-65): administra la plataforma y todas las empresas. */
export const esSuperAdmin = (u: Pick<AuthUser, 'esSuperAdmin'>) => u.esSuperAdmin === true;
