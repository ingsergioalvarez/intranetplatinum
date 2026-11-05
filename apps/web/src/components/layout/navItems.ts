import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Home,
  CalendarOff,
  MessageSquareWarning,
  Network,
  ShieldCheck,
  MapPin,
  Tags,
  Timer,
  Users,
  UsersRound,
} from 'lucide-react';
import { PERMISOS, ROLES, type ModuloOpcionalClave, type Permiso, type Rol } from '@platinum/shared';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Si se define, solo lo ven usuarios con ese permiso (admin ve todo). */
  permiso?: Permiso;
  /** Si se define, solo lo ven estos roles (aunque el admin tenga el permiso). */
  roles?: Rol[];
  /** Solo el super admin (A-65). */
  superAdmin?: boolean;
  /** Módulo de producto al que pertenece: si la empresa lo tiene apagado, no aparece (C-09). */
  modulo?: ModuloOpcionalClave;
  /** Encabezado de sección que se muestra encima de este elemento en la barra lateral de escritorio. */
  seccion?: string;
}

/** Menú principal. El orden es el de la navegación inferior en celular (máx. 5). */
export const navItems: NavItem[] = [
  // El guardia entra directo al Checador, así que no tiene Inicio (DA-51).
  { label: 'Inicio', to: '/', icon: Home, roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.JEFE, ROLES.CLIENTE] },
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
  // Portal del cliente (A-38): los guardias asignados a sus sitios.
  {
    label: 'Guardias',
    to: '/guardias',
    modulo: 'clientes',
    icon: ShieldCheck,
    permiso: PERMISOS.ASISTENCIA_VER,
    roles: [ROLES.CLIENTE],
  },
  {
    label: 'Ausencias',
    to: '/mis-ausencias',
    modulo: 'ausencias',
    icon: CalendarOff,
    permiso: PERMISOS.ASISTENCIA_MARCAR,
    roles: [ROLES.GUARDIA],
  },
  { label: 'Reportes', to: '/reportes', modulo: 'reportes', icon: ClipboardList, permiso: PERMISOS.REPORTES_VER_PROPIOS },
  // Lo que el cliente reporta del servicio o de un guardia (A-59).
  { label: 'Reportar', to: '/reportes-cliente', modulo: 'quejas', icon: MessageSquareWarning, roles: [ROLES.CLIENTE] },
  { label: 'Quejas', to: '/reportes-cliente', modulo: 'quejas', icon: MessageSquareWarning, roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.JEFE] },
  { label: 'Asistencia', to: '/asistencia', icon: ClipboardCheck, permiso: PERMISOS.ASISTENCIA_VER },
  { label: 'Clientes', to: '/clientes', modulo: 'clientes', icon: Building2, permiso: PERMISOS.CLIENTES_VER },
  { label: 'Grupos', to: '/grupos', modulo: 'grupos', icon: UsersRound, permiso: PERMISOS.GRUPOS_ADMINISTRAR },
  { label: 'Usuarios', to: '/usuarios', icon: Users, permiso: PERMISOS.USUARIOS_VER },
  // Estructura de la empresa (C-10): áreas con subáreas, sus personas y su jefe. Parte de lo siempre incluido.
  { label: 'Áreas', to: '/areas', icon: Network, roles: [ROLES.ADMIN] },
  {
    label: 'Turnos',
    to: '/catalogos/turnos',
    modulo: 'turnos',
    icon: Clock,
    permiso: PERMISOS.CATALOGOS_ADMINISTRAR,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.JEFE],
  },
  { label: 'Catálogos', to: '/catalogos/categorias', modulo: 'reportes', icon: Tags, permiso: PERMISOS.CATALOGOS_ADMINISTRAR },
  // Plataforma (C-07): empresas, su marca y sus módulos. Solo el super admin.
  { label: 'Empresas', to: '/plataforma/empresas', icon: Boxes, superAdmin: true, seccion: 'Plataforma' },
];
