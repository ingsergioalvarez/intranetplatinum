import { NavLink } from 'react-router-dom';
import { cn } from '../../components/ui';

/** Pestañas del menú Catálogos: categorías de reporte y turnos (DA-37). */
export function PestanasCatalogos() {
  return (
    <nav
      className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium md:w-fit"
      aria-label="Catálogos"
    >
      {[
        ['/catalogos/categorias', 'Categorías de reporte'],
        ['/catalogos/turnos', 'Turnos'],
      ].map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex-1 rounded-md px-4 py-2 text-center md:flex-none',
              isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
