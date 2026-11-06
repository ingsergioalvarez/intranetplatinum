import { ALCANCE_POR_ROL, type AlcanceRol } from '@platinum/shared';
import type { AuthUser } from './types/auth';

/** Alcance de quien actúa: el de su rol y, si no se sabe, el de partida del nombre de su rol. */
export const alcanceDe = (u: Pick<AuthUser, 'alcance' | 'rol'>): AlcanceRol => u.alcance ?? ALCANCE_POR_ROL[u.rol];
