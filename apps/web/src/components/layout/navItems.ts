import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Home,
  CalendarOff,
  MessageSquareWarning,
  ScrollText,
  ShieldCheck,
  MapPin,
  MonitorDot,
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
  /** Solo el super admin (A-65). */
  superAdmin?: boolean;
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
  // Portal del cliente (A-38): los guardias asignados a sus sitios.
  {
    label: 'Guardias',
    to: '/guardias',
    icon: ShieldCheck,
    permiso: PERMISOS.ASISTENCIA_VER,
    roles: [ROLES.CLIENTE],
  },
  {
    label: 'Ausencias',
    to: '/mis-ausencias',
    icon: CalendarOff,
    permiso: PERMISOS.ASISTENCIA_MARCAR,
    roles: [ROLES.GUARDIA],
  },
  // Monitoreo de sitios para el C2 (A-61).
  { label: 'C2', to: '/c2', icon: MonitorDot, permiso: PERMISOS.C2_VER },
  { label: 'Reportes', to: '/reportes', icon: ClipboardList, permiso: PERMISOS.REPORTES_VER_PROPIOS },
  // Lo que el cliente reporta del servicio o de un guardia (A-59).
  { label: 'Reportar', to: '/reportes-cliente', icon: MessageSquareWarning, roles: [ROLES.CLIENTE] },
  { label: 'Quejas', to: '/reportes-cliente', icon: MessageSquareWarning, roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  // Quién aceptó el aviso de privacidad por el uso del rostro (A-68).
  { label: 'Privacidad', to: '/privacidad', icon: ScrollText, roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'Asistencia', to: '/asistencia', icon: ClipboardCheck, permiso: PERMISOS.ASISTENCIA_VER },
  { label: 'Clientes', to: '/clientes', icon: Building2, permiso: PERMISOS.CLIENTES_VER },
  { label: 'Grupos', to: '/grupos', icon: UsersRound, permiso: PERMISOS.GRUPOS_ADMINISTRAR },
  { label: 'Usuarios', to: '/usuarios', icon: Users, permiso: PERMISOS.USUARIOS_VER },
  { label: 'Carteras', to: '/carteras', icon: Briefcase, superAdmin: true },
  {
    label: 'Turnos',
    to: '/catalogos/turnos',
    icon: Clock,
    permiso: PERMISOS.CATALOGOS_ADMINISTRAR,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR],
  },
  { label: 'Catálogos', to: '/catalogos/categorias', icon: Tags, permiso: PERMISOS.CATALOGOS_ADMINISTRAR },
];
