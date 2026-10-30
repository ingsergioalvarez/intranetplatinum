import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ellipsis, KeyRound, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { ROL_DESCRIPCIONES, type BandejaAvisos } from '@platinum/shared';
import { api } from '../../core/api';
import { hasPermission, hasRole, useAuthStore } from '../../core/auth/authStore';
import { authService } from '../../core/auth/AuthService';
import { Modal, cn } from '../ui';
import { useSincronizacion } from '../../core/offline/sincronizar';
import { AvisoPin } from '../../modules/auth/AvisoPin';
import { BienvenidaRostro } from '../../modules/asistencia/BienvenidaRostro';
import { VentanaComida, VentanaTurno } from '../../modules/asistencia/TurnoGuardia';
import { Campanita } from './Campanita';
import { ExigirPush } from './ExigirPush';
import { navItems } from './navItems';

function useReportesNoLeidos() {
  const bandeja = useQuery({
    queryKey: ['avisos'],
    queryFn: () => api.get<BandejaAvisos>('/avisos'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  return (
    bandeja.data?.items.filter((a) => !a.leido && (a.reporteId != null || a.tipo.startsWith('reporte_')))
      .length ?? 0
  );
}

function useVisibleNav() {
  const user = useAuthStore((s) => s.user);
  return navItems.filter((i) => hasPermission(user, i.permiso) && hasRole(user, i.roles));
}

function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <ShieldCheck className="size-6 text-platinum-300" />
      <span>
        Platinum <span className="font-normal text-platinum-300">Intranet</span>
      </span>
    </div>
  );
}

function Sidebar() {
  const items = useVisibleNav();
  const user = useAuthStore((s) => s.user);
  const reportesNoLeidos = useReportesNoLeidos();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-brand-900 text-white md:sticky md:top-0 md:flex md:h-dvh md:self-start">
      <div className="flex h-16 items-center justify-between pl-5 pr-3">
        <Brand />
        <Campanita />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map(({ to, label, icon: Icon }) => {
          const tieneBadge = to === '/reportes' && reportesNoLeidos > 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-700 text-white' : 'text-brand-100 hover:bg-brand-800 hover:text-white',
                )
              }
            >
              <Icon className="size-5 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {tieneBadge && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white leading-none shadow-xs"
                  aria-label={`${reportesNoLeidos} novedades`}
                >
                  {reportesNoLeidos > 99 ? '99+' : reportesNoLeidos}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
      {user && (
        <div className="border-t border-brand-800 p-4">
          <p className="truncate text-sm font-medium">{user.nombre}</p>
          <p className="truncate text-xs text-brand-200">{ROL_DESCRIPCIONES[user.rol]}</p>
          {user.rol === 'guardia' && (
            <Link to="/acceso-rapido" className="mt-3 flex items-center gap-2 text-sm text-brand-200 hover:text-white">
              <LockKeyhole className="size-4" /> Acceso rápido (PIN)
            </Link>
          )}
          <Link
            to="/cambiar-password"
            className={cn('flex items-center gap-2 text-sm text-brand-200 hover:text-white', user.rol === 'guardia' ? 'mt-2' : 'mt-3')}
          >
            <KeyRound className="size-4" /> Cambiar contraseña
          </Link>
          <button
            onClick={() => void authService.logout()}
            className="mt-2 flex items-center gap-2 text-sm text-brand-200 hover:text-white"
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
      )}
    </aside>
  );
}

function Topbar() {
  const user = useAuthStore((s) => s.user);
  return (
    <header className="pt-safe sticky top-0 z-30 bg-brand-900 text-white md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Brand className="text-base" />
        {user && (
          <div className="flex items-center gap-1">
            <Campanita />
            {user.rol === 'guardia' && (
              <Link
                to="/acceso-rapido"
                className="rounded-lg p-2 text-brand-100 active:bg-brand-800"
                aria-label="Acceso rápido con PIN"
              >
                <LockKeyhole className="size-5" />
              </Link>
            )}
            <Link
              to="/cambiar-password"
              className="rounded-lg p-2 text-brand-100 active:bg-brand-800"
              aria-label="Cambiar contraseña"
            >
              <KeyRound className="size-5" />
            </Link>
            <button
              onClick={() => void authService.logout()}
              className="rounded-lg p-2 text-brand-100 active:bg-brand-800"
              aria-label="Cerrar sesión"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

const MAX_BARRA = 5;

function BottomNav() {
  const todos = useVisibleNav();
  const reportesNoLeidos = useReportesNoLeidos();
  const { pathname } = useLocation();
  const [masAbierto, setMasAbierto] = useState(false);
  // Si no caben todos, la barra lleva los primeros y el resto va en la hoja "Más".
  const desborda = todos.length > MAX_BARRA;
  const items = desborda ? todos.slice(0, MAX_BARRA - 1) : todos;
  const resto = desborda ? todos.slice(MAX_BARRA - 1) : [];
  const enResto = resto.some((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden">
      <ul className="flex">
        {items.map(({ to, label, icon: Icon }) => {
          const tieneBadge = to === '/reportes' && reportesNoLeidos > 0;
          return (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className="flex h-16 flex-col items-center justify-center gap-0.5 text-[11px]"
              >
                {({ isActive }) => (
                  <>
                    {/* La pestaña activa se pinta: ícono en una píldora azul y etiqueta en negritas. */}
                    <div
                      className={cn(
                        'relative flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                        isActive ? 'bg-brand-700 text-white' : 'text-slate-500',
                      )}
                    >
                      <Icon className="size-6" />
                      {tieneBadge && (
                        <span
                          className="absolute -top-0.5 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-bold text-white shadow-xs ring-2 ring-white"
                          aria-label={`${reportesNoLeidos} novedades`}
                        >
                          {reportesNoLeidos > 99 ? '99+' : reportesNoLeidos}
                        </span>
                      )}
                    </div>
                    <span className={isActive ? 'font-bold text-brand-700' : 'font-medium text-slate-500'}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
        {desborda && (
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMasAbierto(true)}
              aria-haspopup="dialog"
              className="flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px]"
            >
              <div
                className={cn(
                  'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                  enResto ? 'bg-brand-700 text-white' : 'text-slate-500',
                )}
              >
                <Ellipsis className="size-6" />
              </div>
              <span className={enResto ? 'font-bold text-brand-700' : 'font-medium text-slate-500'}>Más</span>
            </button>
          </li>
        )}
      </ul>
      <Modal open={masAbierto} onClose={() => setMasAbierto(false)} title="Más módulos" size="sm">
        <ul className="-mx-2 space-y-1">
          {resto.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={() => setMasAbierto(false)}
                className={({ isActive }) =>
                  cn(
                    'flex h-12 items-center gap-3 rounded-lg px-3 text-base font-medium',
                    isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-700 active:bg-slate-100',
                  )
                }
              >
                <Icon className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Modal>
    </nav>
  );
}

/** Estructura principal: sidebar en escritorio; topbar + navegación inferior en celular. */
export function AppShell() {
  // Envía las checadas guardadas sin conexión al abrir la app y al volver la señal (AS2-02).
  const user = useAuthStore((s) => s.user);
  useSincronizacion(user?.rol === 'guardia' ? user.id : undefined);
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-8">
          <div className="mx-auto max-w-6xl">
            <AvisoPin />
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
      <ExigirPush />
      <BienvenidaRostro />
      <VentanaTurno />
      <VentanaComida />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
