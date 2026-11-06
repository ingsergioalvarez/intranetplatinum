import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  Building2,
  ClipboardCheck,
  Clock,
  Home,
  CalendarOff,

  Network,

  MapPin,
  Timer,
  Users,
  UsersRound,
} from 'lucide-react';
import { PERMISOS, type ModuloOpcionalClave, type Permiso } from '@platinum/shared';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Si se define, solo lo ven usuarios con ese permiso (admin ve todo). */
  permiso?: Permiso;
  /** Solo lo ve quien vive de marcar su asistencia (pantallas del colaborador), aunque el admin tenga el permiso. */
  soloColaborador?: boolean;
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
  { label: 'Inicio', to: '/', icon: Home, permiso: PERMISOS.ASISTENCIA_VER },
  {
    label: 'Checador',
    to: '/marcar',
    icon: Timer,
    permiso: PERMISOS.ASISTENCIA_MARCAR,
    soloColaborador: true,
  },
  {
    label: 'Mis sitios',
    to: '/mis-sitios',
    icon: MapPin,
    permiso: PERMISOS.ASISTENCIA_MARCAR,
    soloColaborador: true,
  },
  {
    label: 'Ausencias',
    to: '/mis-ausencias',
    modulo: 'ausencias',
    icon: CalendarOff,
    permiso: PERMISOS.AUSENCIAS_PEDIR,
    soloColaborador: true,
  },
  { label: 'Asistencia', to: '/asistencia', icon: ClipboardCheck, permiso: PERMISOS.ASISTENCIA_VER },
  { label: 'Clientes', to: '/clientes', modulo: 'clientes', icon: Building2, permiso: PERMISOS.CLIENTES_VER },
  { label: 'Grupos', to: '/grupos', modulo: 'grupos', icon: UsersRound, permiso: PERMISOS.GRUPOS_ADMINISTRAR },
  { label: 'Usuarios', to: '/usuarios', icon: Users, permiso: PERMISOS.USUARIOS_VER },
  // Estructura de la empresa (C-10): áreas con subáreas, sus personas y su jefe. Parte de lo siempre incluido.
  { label: 'Áreas', to: '/areas', icon: Network, permiso: PERMISOS.AREAS_VER },
  {
    label: 'Turnos',
    to: '/catalogos/turnos',
    modulo: 'turnos',
    icon: Clock,
    permiso: PERMISOS.TURNOS_ADMINISTRAR,
  },
  // Plataforma (C-07): empresas, su marca y sus módulos. Solo el super admin.
  { label: 'Empresas', to: '/plataforma/empresas', icon: Boxes, superAdmin: true, seccion: 'Plataforma' },
];
