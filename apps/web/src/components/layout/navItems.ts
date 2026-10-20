import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  Home,
  LayoutGrid,
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
  /** Solo visible en desarrollo. */
  devOnly?: boolean;
}

/** Menú principal. El orden es el de la navegación inferior en celular (máx. 5). */
export const navItems: NavItem[] = [
  { label: 'Inicio', to: '/', icon: Home },
  {
    label: 'Marcar',
    to: '/marcar',
    icon: Timer,
    permiso: PERMISOS.ASISTENCIA_MARCAR,
    roles: [ROLES.GUARDIA],
  },
  { label: 'Reportes', to: '/reportes', icon: ClipboardList, permiso: PERMISOS.REPORTES_CREAR },
  { label: 'Asistencia', to: '/asistencia', icon: ClipboardCheck, permiso: PERMISOS.ASISTENCIA_VER },
  { label: 'Clientes', to: '/clientes', icon: Building2, permiso: PERMISOS.CLIENTES_VER },
  { label: 'Grupos', to: '/grupos', icon: UsersRound, permiso: PERMISOS.GRUPOS_ADMINISTRAR },
  { label: 'Usuarios', to: '/usuarios', icon: Users, permiso: PERMISOS.USUARIOS_VER },
  { label: 'Catálogos', to: '/catalogos/categorias', icon: Tags, permiso: PERMISOS.CATALOGOS_ADMINISTRAR },
  { label: 'Componentes', to: '/ui', icon: LayoutGrid, devOnly: true },
];
