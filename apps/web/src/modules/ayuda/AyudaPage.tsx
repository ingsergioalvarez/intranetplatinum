import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import { EmptyState, cn } from '../../components/ui';
import { useAuthStore } from '../../core/auth/authStore';
import { manualDelRolPendiente, manualesDe } from './manuales';
import { renderizarManual } from './renderManual';

/**
 * Ayuda (A-69): el manual de usuario dentro de la app, con el que corresponde al rol de cada quien (el
 * administrador ve todos). Se lee sin conexión, porque viaja con la app.
 */
export function AyudaPage() {
  const user = useAuthStore((s) => s.user)!;
  const manuales = useMemo(() => manualesDe(user.rol), [user.rol]);
  // Se abre en el manual del propio rol (el archivo se llama como el rol); si aún no existe, en la parte común.
  const [clave, setClave] = useState(() => manuales.find((m) => m.clave === user.rol)?.clave ?? manuales[0]?.clave);
  const [indiceAbierto, setIndiceAbierto] = useState(false);
  const activo = manuales.find((m) => m.clave === clave) ?? manuales[0];
  const contenido = useMemo(() => (activo ? renderizarManual(activo.texto, activo.clave) : null), [activo]);

  if (!activo || !contenido) {
    return (
      <>
        <PageHeader title="Ayuda" subtitle="Manual de uso de la aplicación" />
        <EmptyState
          icon={<BookOpen className="size-10" />}
          title="El manual está en preparación"
          description="Pronto lo tendrás aquí. Si necesitas ayuda, habla con tu supervisor o con el administrador."
        />
      </>
    );
  }

  const irA = (id: string) => {
    setIndiceAbierto(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <PageHeader title="Ayuda" subtitle="Manual de uso de la aplicación" />

      {manuales.length > 1 && (
        <div role="tablist" aria-label="Manuales" className="mb-4 flex flex-wrap gap-2">
          {manuales.map((m) => (
            <button
              key={m.clave}
              type="button"
              role="tab"
              aria-selected={m.clave === activo.clave}
              onClick={() => {
                setClave(m.clave);
                setIndiceAbierto(false);
              }}
              className={cn(
                'h-10 rounded-full px-4 text-sm font-medium ring-1 ring-inset transition-colors',
                m.clave === activo.clave
                  ? 'bg-brand-700 text-white ring-brand-700'
                  : 'bg-white text-slate-600 ring-slate-300 active:bg-slate-100',
              )}
            >
              {m.etiqueta}
            </button>
          ))}
        </div>
      )}

      {manualDelRolPendiente(user.rol) && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
          El manual de tu rol todavía está en preparación. Mientras tanto, aquí está la parte común.
        </p>
      )}

      {contenido.secciones.length > 0 && (
        <nav aria-label="Contenido" className="mb-5 rounded-2xl bg-white ring-1 ring-slate-200 ring-inset">
          <button
            type="button"
            aria-expanded={indiceAbierto}
            onClick={() => setIndiceAbierto((a) => !a)}
            className="flex h-12 w-full items-center justify-between px-4 text-sm font-semibold text-slate-700"
          >
            Contenido ({contenido.secciones.length} secciones)
            <ChevronDown className={cn('size-4 transition-transform', indiceAbierto && 'rotate-180')} />
          </button>
          {indiceAbierto && (
            <ol className="grid grid-cols-1 gap-x-6 gap-y-0.5 border-t border-slate-100 px-4 py-2 sm:grid-cols-2">
              {contenido.secciones.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => irA(s.id)}
                    className="w-full py-1.5 text-left text-sm text-brand-700 active:text-brand-900"
                  >
                    {s.titulo}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </nav>
      )}

      <article
        className="manual rounded-2xl bg-white p-4 ring-1 ring-slate-200 ring-inset md:p-8"
        // El texto es del propio proyecto (docs/manual), no de ningún usuario.
        dangerouslySetInnerHTML={{ __html: contenido.html }}
      />
    </>
  );
}
