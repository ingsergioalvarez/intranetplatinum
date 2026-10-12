import { Link, NavLink, Outlet } from 'react-router-dom';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { ROL_DESCRIPCIONES } from '@platinum/shared';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { authService } from '../../core/auth/AuthService';
import { cn } from '../ui';
import { navItems } from './navItems';

function useVisibleNav() {
  const user = useAuthStore((s) => s.user);
  return navItems.filter((i) => (!i.devOnly || import.meta.env.DEV) && hasPermission(user, i.permiso));
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

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-brand-900 text-white md:flex">
      <Brand className="h-16 px-5" />
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map(({ to, label, icon: Icon }) => (
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
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      {user && (
        <div className="border-t border-brand-800 p-4">
          <p className="truncate text-sm font-medium">{user.nombre}</p>
          <p className="truncate text-xs text-brand-200">{ROL_DESCRIPCIONES[user.rol]}</p>
          <Link
            to="/cambiar-password"
            className="mt-3 flex items-center gap-2 text-sm text-brand-200 hover:text-white"
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

function BottomNav() {
  const items = useVisibleNav().slice(0, 5);
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden">
      <ul className="flex">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  isActive ? 'text-brand-700' : 'text-slate-500',
                )
              }
            >
              <Icon className="size-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Estructura principal: sidebar en escritorio; topbar + navegación inferior en celular. */
export function AppShell() {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
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
