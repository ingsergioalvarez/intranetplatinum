import type { BadgeTone } from '../../components/ui';
import type { Usuario } from '@platinum/shared';

export interface EstadoUsuario {
  label: string;
  tone: BadgeTone;
}

/** Estado visible de la cuenta, del más al menos relevante. */
export function estadoUsuario(u: Usuario, ahora = Date.now()): EstadoUsuario {
  if (u.deletedAt) return { label: 'De baja', tone: 'neutral' };
  if (u.bloqueadoHasta && new Date(u.bloqueadoHasta).getTime() > ahora) {
    return { label: 'Bloqueado', tone: 'danger' };
  }
  if (u.debeCambiarPassword) return { label: 'Contraseña temporal', tone: 'warning' };
  return { label: 'Activo', tone: 'success' };
}
