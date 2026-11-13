import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  History,
  Home,
  Mail,
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
import { MENU_POR_ROL, PERMISOS, ROLES, type Permiso, type Rol } from '@platinum/shared';

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

/** Todas las opciones del menú. El orden por rol (barra de abajo, "Más" y barra de escritorio) está en `MENU_POR_ROL`. */
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
  // El supervisor lee lo que hace el C2 sobre sus sitios (A-82); el admin lo ve dentro de C2.
  { label: 'Bitácora C2', to: '/bitacora-c2', icon: History, permiso: PERMISOS.C2_BITACORA, roles: [ROLES.SUPERVISOR] },
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
  // Datos del servidor de correo (A-87).
  { label: 'Correo', to: '/correo', icon: Mail, superAdmin: true },
  {
    label: 'Turnos',
    to: '/catalogos/turnos',
    icon: Clock,
    permiso: PERMISOS.CATALOGOS_ADMINISTRAR,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR],
  },
  { label: 'Catálogos', to: '/catalogos/categorias', icon: Tags, permiso: PERMISOS.CATALOGOS_ADMINISTRAR },
];

export interface MenuOrdenado {
  /** Las que van en la barra de abajo del celular. */
  barra: NavItem[];
  /** Lo demás, ordenado y con título (sin título: opciones nuevas que aún no tienen lugar). */
  grupos: { titulo: string; items: NavItem[] }[];
  /** Todas, en el orden en que se muestran (barra de escritorio). */
  todos: NavItem[];
}

/** Ordena las opciones que puede ver el rol según su plan (`MENU_POR_ROL`). Lo que el plan no menciona va al final. */
export function ordenarMenu(rol: Rol, visibles: NavItem[]): MenuOrdenado {
  const plan = MENU_POR_ROL[rol];
  const porRuta = new Map(visibles.map((i) => [i.to, i]));
  const usadas = new Set<string>();
  const tomar = (rutas: readonly string[]) =>
    rutas.flatMap((r) => {
      const item = porRuta.get(r);
      if (!item || usadas.has(r)) return [];
      usadas.add(r);
      return [item];
    });
  const barra = tomar(plan.barra);
  const grupos = plan.mas.map((g) => ({ titulo: g.titulo, items: tomar(g.rutas) })).filter((g) => g.items.length > 0);
  const sueltas = visibles.filter((i) => !usadas.has(i.to));
  if (sueltas.length > 0) grupos.push({ titulo: '', items: sueltas });
  return { barra, grupos, todos: [...barra, ...grupos.flatMap((g) => g.items)] };
}
