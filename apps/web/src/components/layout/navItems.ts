import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Home,
  MapPin,
  Tags,
  Timer,
  Users,
  UsersRound,
} from 'lucide-react';
import { PERMISOS, ROLES, type Permiso, type Rol } from '@platinum/shared';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Si se define, solo lo ven usuarios con ese permiso (admin ve todo). */
  permiso?: Permiso;
  /** Si se define, solo lo ven estos roles (aunque el admin tenga el permiso). */
  roles?: Rol[];
}

/** Menú principal. El orden es el de la navegación inferior en celular (máx. 5). */
export const navItems: NavItem[] = [
  // El guardia entra directo al Checador, así que no tiene Inicio (DA-51).
  { label: 'Inicio', to: '/', icon: Home, roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CLIENTE] },
  {
    label: 'Checador',
    to: '/marcar',
    icon: Timer,
    permiso: PERMISOS.ASISTENCIA_MARCAR,
    roles: [ROLES.GUARDIA],
  },
  {
    label: 'Mis sitios',
    to: '/mis-sitios',
    icon: MapPin,
    permiso: PERMISOS.ASISTENCIA_MARCAR,
    roles: [ROLES.GUARDIA],
  },
  { label: 'Reportes', to: '/reportes', icon: ClipboardList, permiso: PERMISOS.REPORTES_VER_PROPIOS },
  { label: 'Asistencia', to: '/asistencia', icon: ClipboardCheck, permiso: PERMISOS.ASISTENCIA_VER },
  { label: 'Clientes', to: '/clientes', icon: Building2, permiso: PERMISOS.CLIENTES_VER },
  { label: 'Grupos', to: '/grupos', icon: UsersRound, permiso: PERMISOS.GRUPOS_ADMINISTRAR },
  { label: 'Usuarios', to: '/usuarios', icon: Users, permiso: PERMISOS.USUARIOS_VER },
  {
    label: 'Turnos',
    to: '/catalogos/turnos',
    icon: Clock,
    permiso: PERMISOS.CATALOGOS_ADMINISTRAR,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR],
  },
  { label: 'Catálogos', to: '/catalogos/categorias', icon: Tags, permiso: PERMISOS.CATALOGOS_ADMINISTRAR },
];
