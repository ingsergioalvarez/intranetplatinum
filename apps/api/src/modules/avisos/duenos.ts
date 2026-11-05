import { ROLES } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';

/** De qué cosa trata el aviso (guardia y sitio). Hoy no cambia a quién le toca; lo usará la cadena de jefes (C-10 paso 5). */
export interface ContextoDueno {
  guardiaId?: number | null;
  sitioId?: number | null;
}

/**
 * Admins activos de la empresa. Sin Carteras ya no hay un dueño de cada guardia o sitio, así que de momento todos
 * los admin reciben lo que antes le llegaba al dueño. Los avisos pasan a la cadena de jefes en C-10 paso 5 (DC-017).
 */
export async function adminsDe(_contexto?: ContextoDueno): Promise<number[]> {
  const admins = await getPrisma().usuario.findMany({
    where: { activo: true, deletedAt: null, rol: { clave: ROLES.ADMIN } },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}
