import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronUp, CircleHelp, CircleUser, Ellipsis, KeyRound, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { ROL_DESCRIPCIONES } from '@platinum/shared';
import { hasPermission, hasRole, useAuthStore } from '../../core/auth/authStore';
import { authService } from '../../core/auth/AuthService';
import { Modal, cn } from '../ui';
import { useEnLinea } from '../../core/offline/enLinea';
import { useSincronizacion } from '../../core/offline/sincronizar';
import { AvisoPin } from '../../modules/auth/AvisoPin';
import { OfertaPerfil } from '../../modules/auth/OfertaPerfil';
import { BienvenidaRostro } from '../../modules/asistencia/BienvenidaRostro';
import { AvisoPrivacidad } from '../../modules/privacidad/AvisoPrivacidad';
import { VentanaComida, VentanaTurno } from '../../modules/asistencia/TurnoGuardia';
import { AlertaEmergencia } from '../../modules/emergencias/AlertaEmergencia';
import { BotonSOS } from '../../modules/emergencias/BotonSOS';
import { Campanita } from './Campanita';
import { AvisoDeOtraCuenta } from './AvisoDeOtraCuenta';
import { ExigirPush } from './ExigirPush';
import { FranjaAvisos } from './FranjaAvisos';
import { useBarraLateral } from './barraLateral';
import { useBadgesMenu } from './badgesMenu';
import { navItems, ordenarMenu, type MenuOrdenado } from './navItems';

/** El menú del rol en sesión, ya ordenado (A-83): barra de abajo, "Más" con títulos y orden de la barra de escritorio. */
function useMenu(): MenuOrdenado {
  const user = useAuthStore((s) => s.user);
  const visibles = navItems.filter(
    (i) => hasPermission(user, i.permiso) && hasRole(user, i.roles) && (!i.superAdmin || !!user?.esSuperAdmin),
  );
  return user ? ordenarMenu(user.rol, visibles) : { barra: [], grupos: [], todos: [] };
}

/** Icono "?" del celular (A-69): lleva a la Ayuda, el manual de usuario dentro de la app. En escritorio es un enlace abajo de la barra lateral. */
function BotonAyuda() {
  return (
    <Link to="/ayuda" className="rounded-lg p-2.5 text-brand-100 active:bg-brand-800" aria-label="Ayuda: manual de uso">
      <CircleHelp className="size-6" />
    </Link>
  );
}

/**
 * Menú de la cuenta en el celular (A-71): un solo icono de usuario que despliega el nombre, el acceso rápido con PIN,
 * el cambio de contraseña y, aparte y en rojo, cerrar sesión. Sustituye a tres iconos sueltos en la barra de arriba.
 */
/** Dos letras para el círculo de la cuenta: inicial del primer nombre y del último apellido. */
function iniciales(nombre: string) {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '?';
  const dos = palabras.length === 1 ? palabras[0].slice(0, 2) : palabras[0][0] + palabras[palabras.length - 1][0];
  return dos.toUpperCase();
}

function MenuCuenta() {
  const user = useAuthStore((s) => s.user)!;
  const enLinea = useEnLinea();
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // Se cierra al cambiar de pantalla, al tocar fuera o con Escape.
  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const opcion = 'flex h-12 w-full items-center gap-3 px-4 text-left text-sm font-medium active:bg-slate-100';
  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label="Mi cuenta"
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={cn('rounded-lg p-2.5 text-brand-100 active:bg-brand-800', abierto && 'bg-brand-800')}
      >
        <CircleUser className="size-6" />
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl bg-white text-slate-800 shadow-xl ring-1 ring-slate-200"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 bg-brand-50 px-4 py-3.5">
            <div className="relative shrink-0">
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-full bg-brand-700 text-base font-semibold text-white"
              >
                {iniciales(user.nombre)}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute bottom-0 right-0 size-3.5 rounded-full ring-2 ring-brand-50',
                  enLinea ? 'bg-emerald-500' : 'bg-slate-400',
                )}
              />
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="truncate text-base font-semibold text-slate-900">
                {user.nombre}
              </p>
              <p className="truncate text-sm text-slate-600">{ROL_DESCRIPCIONES[user.rol]}</p>
              <p
                role="status"
                className={cn('truncate text-xs font-medium', enLinea ? 'text-emerald-700' : 'text-slate-500')}
              >
                {enLinea ? 'En línea' : 'Sin conexión'}
              </p>
            </div>
          </div>
          <Link to="/acceso-rapido" role="menuitem" className={opcion}>
            <LockKeyhole className="size-5 text-slate-500" /> Acceso rápido (PIN)
          </Link>
          <Link to="/cambiar-password" role="menuitem" className={opcion}>
            <KeyRound className="size-5 text-slate-500" /> Cambiar contraseña
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void authService.logout()}
            className={cn(opcion, 'border-t border-slate-100 text-red-700')}
          >
            <LogOut className="size-5" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

function Brand({ className, icono = 'size-6' }: { className?: string; icono?: string }) {
  return (
    <div className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <ShieldCheck className={cn(icono, 'text-platinum-300')} />
      <span>
        Platinum <span className="font-normal text-platinum-300">Intranet</span>
      </span>
    </div>
  );
}

/**
 * Tarjeta de la cuenta al pie de la barra de escritorio: nombre y rol en una sola pieza que despliega Ayuda, acceso
 * rápido con PIN, cambio de contraseña y cerrar sesión. Con la barra reducida solo se ve el avatar y el menú sale al
 * lado. Así los accesos secundarios no le quitan alto a la lista del menú.
 */
function CuentaBarra({ reducida }: { reducida: boolean }) {
  const user = useAuthStore((s) => s.user)!;
  const enLinea = useEnLinea();
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const opcion =
    'flex h-10 w-full items-center gap-3 px-4 text-left text-sm font-medium text-brand-100 hover:bg-brand-700 hover:text-white';
  return (
    <div ref={raiz} className="relative border-t border-brand-800 p-2">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Mi cuenta: ${user.nombre}`}
        title={reducida ? `${user.nombre} · ${ROL_DESCRIPCIONES[user.rol]}` : undefined}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-brand-800',
          reducida && 'justify-center',
          abierto && 'bg-brand-800',
        )}
      >
        <span className="relative shrink-0">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
            {iniciales(user.nombre)}
          </span>
          <span
            aria-hidden
            className={cn('absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-brand-900', enLinea ? 'bg-emerald-500' : 'bg-slate-400')}
          />
        </span>
        {!reducida && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.nombre}</span>
              <span className="block truncate text-xs text-brand-200">{ROL_DESCRIPCIONES[user.rol]}</span>
            </span>
            <ChevronUp className={cn('size-4 shrink-0 text-brand-200 transition-transform', !abierto && 'rotate-180')} aria-hidden />
          </>
        )}
      </button>
      {abierto && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 overflow-hidden rounded-xl bg-brand-800 py-1 shadow-xl ring-1 ring-brand-600',
            reducida ? 'bottom-2 left-full ml-2 w-60' : 'right-2 bottom-full left-2 mb-2',
          )}
        >
          <Link to="/ayuda" role="menuitem" className={opcion}>
            <CircleHelp className="size-4" aria-hidden /> Ayuda
          </Link>
          <Link to="/acceso-rapido" role="menuitem" className={opcion}>
            <LockKeyhole className="size-4" aria-hidden /> Acceso rápido (PIN)
          </Link>
          <Link to="/cambiar-password" role="menuitem" className={opcion}>
            <KeyRound className="size-4" aria-hidden /> Cambiar contraseña
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void authService.logout()}
            className={cn(opcion, 'border-t border-brand-700 text-red-300 hover:text-red-200')}
          >
            <LogOut className="size-4" aria-hidden /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  const items = useMenu().todos;
  const user = useAuthStore((s) => s.user);
  const badges = useBadgesMenu(items.map((i) => i.to));
  const { reducida, alternar } = useBarraLateral();

  return (
    // Fija (no `sticky`): al abrir un modal el `body` queda con `overflow: hidden` y una barra `sticky` se despegaba
    // de la pantalla dejando un hueco en blanco abajo. El contenido compensa con `md:pl-64` / `md:pl-16` en `AppShell`.
    <aside
      className={cn(
        'z-30 hidden shrink-0 flex-col bg-brand-900 text-white transition-[width] duration-200 md:fixed md:inset-y-0 md:left-0 md:flex',
        reducida ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn('flex shrink-0 items-center', reducida ? 'h-24 flex-col justify-center gap-1' : 'h-16 justify-between pr-3 pl-5')}>
        {reducida ? <ShieldCheck className="size-6 text-platinum-300" aria-label="Platinum" /> : <Brand />}
        <Campanita />
      </div>
      <nav aria-label="Menú principal" className="scroll-fino min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {items.map(({ to, label, icon: Icon }) => {
          const pendientes = badges.get(to) ?? 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={reducida ? label : undefined}
              aria-label={reducida ? (pendientes > 0 ? `${label}, ${pendientes} pendientes` : label) : undefined}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors',
                  reducida ? 'justify-center px-0' : 'gap-3 px-3',
                  isActive ? 'bg-brand-700 text-white' : 'text-brand-100 hover:bg-brand-800 hover:text-white',
                )
              }
            >
              <Icon className="size-5 shrink-0" />
              {!reducida && <span className="flex-1 truncate">{label}</span>}
              {pendientes > 0 &&
                (reducida ? (
                  <span
                    className="absolute top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-brand-900"
                    aria-hidden
                  >
                    {pendientes > 99 ? '99+' : pendientes}
                  </span>
                ) : (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs leading-none font-bold text-white shadow-xs"
                    aria-label={`${pendientes} pendientes`}
                  >
                    {pendientes > 99 ? '99+' : pendientes}
                  </span>
                ))}
            </NavLink>
          );
        })}
      </nav>
      {user && <CuentaBarra reducida={reducida} />}
      <button
        type="button"
        onClick={alternar}
        aria-expanded={!reducida}
        aria-label={reducida ? 'Mostrar la barra lateral' : 'Ocultar la barra lateral'}
        title={reducida ? 'Mostrar la barra lateral' : 'Ocultar la barra lateral'}
        className="absolute top-1/2 left-full z-10 flex h-12 w-5 -translate-y-1/2 items-center justify-center rounded-r-lg bg-brand-900 text-brand-200 shadow-md hover:bg-brand-800 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-300"
      >
        {reducida ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronLeft className="size-3.5" aria-hidden />}
      </button>
    </aside>
  );
}

function Topbar() {
  const user = useAuthStore((s) => s.user);
  return (
    <header className="pt-safe sticky top-0 z-30 bg-brand-900 text-white md:hidden">
      <div className="flex h-16 items-center justify-between px-4">
        <Brand className="text-lg" icono="size-7" />
        {user && (
          <div className="flex items-center gap-1.5">
            <Campanita />
            <BotonAyuda />
            <MenuCuenta />
          </div>
        )}
      </div>
    </header>
  );
}

const MAX_BARRA = 5;

/** Burbuja roja con el número de pendientes, sobre el ícono de un botón del menú (A-57). */
function BurbujaNumero({ n }: { n: number }) {
  return (
    <span
      className="absolute -top-0.5 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-bold text-white shadow-xs ring-2 ring-white"
      aria-label={`${n} pendientes`}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

function BottomNav() {
  const { grupos, todos } = useMenu();
  const badges = useBadgesMenu(todos.map((i) => i.to));
  const { pathname } = useLocation();
  const [masAbierto, setMasAbierto] = useState(false);
  // Si no caben todos, la barra lleva los primeros (los de uso diario del rol) y el resto va en la hoja "Más", con títulos.
  const desborda = todos.length > MAX_BARRA;
  const items = desborda ? todos.slice(0, MAX_BARRA - 1) : todos;
  const resto = desborda ? todos.slice(MAX_BARRA - 1) : [];
  const enMas = new Set(resto.map((i) => i.to));
  const gruposMas = grupos.map((g) => ({ titulo: g.titulo, items: g.items.filter((i) => enMas.has(i.to)) })).filter((g) => g.items.length > 0);
  const pendientesResto = resto.reduce((n, i) => n + (badges.get(i.to) ?? 0), 0);
  const enResto = resto.some((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden">
      <ul className="flex">
        {items.map(({ to, label, icon: Icon }) => {
          const pendientes = badges.get(to) ?? 0;
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
                      {pendientes > 0 && <BurbujaNumero n={pendientes} />}
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
                  'relative flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                  enResto ? 'bg-brand-700 text-white' : 'text-slate-500',
                )}
              >
                <Ellipsis className="size-6" />
                {pendientesResto > 0 && <BurbujaNumero n={pendientesResto} />}
              </div>
              <span className={enResto ? 'font-bold text-brand-700' : 'font-medium text-slate-500'}>Más</span>
            </button>
          </li>
        )}
      </ul>
      <Modal open={masAbierto} onClose={() => setMasAbierto(false)} title="Más módulos" size="sm">
        <div className="-mx-2 space-y-3">
          {gruposMas.map((g) => (
            <section key={g.titulo || 'otros'} aria-label={g.titulo || undefined}>
              {g.titulo && <h3 className="px-3 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{g.titulo}</h3>}
              <ul className="space-y-1">
                {g.items.map(({ to, label, icon: Icon }) => (
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
                      <span className="flex-1">{label}</span>
                      {(badges.get(to) ?? 0) > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                          {(badges.get(to) ?? 0) > 99 ? '99+' : badges.get(to)}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Modal>
    </nav>
  );
}

/** Estructura principal: sidebar en escritorio; topbar + navegación inferior en celular. */
export function AppShell() {
  // Envía las checadas guardadas sin conexión al abrir la app y al volver la señal (AS2-02).
  const user = useAuthStore((s) => s.user);
  useSincronizacion(user?.rol === 'guardia' ? user.id : undefined);
  const reducida = useBarraLateral((s) => s.reducida);
  // Para decir, en cada sección, qué avisos explican su burbuja roja (A-85).
  const rutasMenu = useMenu().todos.map((i) => i.to);
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className={cn('flex min-w-0 flex-1 flex-col transition-[padding] duration-200', reducida ? 'md:pl-16' : 'md:pl-64')}>
        <Topbar />
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-8">
          <div className="mx-auto max-w-6xl">
            <AvisoPin />
            <FranjaAvisos rutas={rutasMenu} />
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
      <AvisoDeOtraCuenta />
      <ExigirPush />
      <AvisoPrivacidad />
      <BienvenidaRostro />
      <VentanaTurno />
      <VentanaComida />
      <OfertaPerfil />
      {user && user.rol !== 'cliente' && user.rol !== 'c2' && <BotonSOS />}
      {(user?.rol === 'admin' || user?.rol === 'supervisor') && <AlertaEmergencia />}
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
