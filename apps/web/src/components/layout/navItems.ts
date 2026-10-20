import type { LucideIcon } from 'lucide-react';
import { Building2, ClipboardList, Home, LayoutGrid, Tags, Users, UsersRound } from 'lucide-react';
import { PERMISOS, type Permiso } from '@platinum/shared';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Si se define, solo lo ven usuarios con ese permiso (admin ve todo). */
  permiso?: Permiso;
  /** Solo visible en desarrollo. */
  devOnly?: boolean;
}

/** Menú principal. El orden es el de la navegación inferior en celular (máx. 5). */
export const navItems: NavItem[] = [
  { label: 'Inicio', to: '/', icon: Home },
  { label: 'Reportes', to: '/reportes', icon: ClipboardList, permiso: PERMISOS.REPORTES_CREAR },
  { label: 'Clientes', to: '/clientes', icon: Building2, permiso: PERMISOS.CLIENTES_VER },
  { label: 'Grupos', to: '/grupos', icon: UsersRound, permiso: PERMISOS.GRUPOS_ADMINISTRAR },
  { label: 'Usuarios', to: '/usuarios', icon: Users, permiso: PERMISOS.USUARIOS_VER },
  { label: 'Catálogos', to: '/catalogos/categorias', icon: Tags, permiso: PERMISOS.CATALOGOS_ADMINISTRAR },
  { label: 'Componentes', to: '/ui', icon: LayoutGrid, devOnly: true },
];
