import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { BookOpen, ChevronDown } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import { EmptyState, cn } from '../../components/ui';
import { useAuthStore } from '../../core/auth/authStore';
import { manualDelRolPendiente, manualesDe } from './manuales';
import { renderizarManual } from './renderManual';

/** Sección del manual en la que va quien lee: la última cuyo título ya pasó por debajo de la barra fija. */
function useSeccionActual(ids: string[]) {
  const [actual, setActual] = useState<string | null>(null);
  useEffect(() => {
    if (ids.length === 0) return;
    const calcular = () => {
      let id: string | null = null;
      for (const s of ids) {
        const el = document.getElementById(s);
        if (el && el.getBoundingClientRect().top <= 150) id = s;
      }
      setActual(id);
    };
    let pendiente = 0;
    const alDesplazar = () => {
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(calcular);
    };
    calcular();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => {
      window.removeEventListener('scroll', alDesplazar);
      cancelAnimationFrame(pendiente);
    };
  }, [ids]);
  return actual;
}

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
  const contenido = useMemo(() => (activo ? renderizarManual(activo.texto, activo.clave, user.rol === 'admin') : null), [activo, user.rol]);

  const idsSecciones = useMemo(() => contenido?.secciones.map((s) => s.id) ?? [], [contenido]);
  const seccionActual = useSeccionActual(idsSecciones);
  const tituloActual = contenido?.secciones.find((s) => s.id === seccionActual)?.titulo;

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
    // Primero se cierra el índice (y se pinta ya cerrado) y después se calcula a dónde ir: si no, el desplazamiento
    // se mide con el índice abierto y, al encogerse, se llega más abajo del título.
    flushSync(() => setIndiceAbierto(false));
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
        // Fija debajo de la barra superior (en computadora, al borde) mientras se lee: se salta de una sección a otra
        // sin volver al principio. El índice flota sobre el texto en vez de empujarlo.
        <nav aria-label="Contenido" className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 mb-5 md:top-0">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 ring-inset">
            <button
              type="button"
              aria-expanded={indiceAbierto}
              onClick={() => setIndiceAbierto((a) => !a)}
              className="flex h-12 w-full items-center justify-between gap-3 px-4 text-sm font-semibold text-slate-700"
            >
              <span className="truncate">
                {tituloActual ? (
                  <>
                    Contenido <span className="font-normal text-slate-500">· {tituloActual}</span>
                  </>
                ) : (
                  `Contenido (${contenido.secciones.length} secciones)`
                )}
              </span>
              <ChevronDown className={cn('size-4 shrink-0 transition-transform', indiceAbierto && 'rotate-180')} />
            </button>
          </div>
          {indiceAbierto && (
            <ol className="absolute inset-x-0 top-full mt-1 grid max-h-[min(60vh,28rem)] grid-cols-1 gap-x-6 gap-y-0.5 overflow-y-auto rounded-2xl bg-white px-4 py-2 shadow-lg ring-1 ring-slate-200 ring-inset sm:grid-cols-2">
              {contenido.secciones.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => irA(s.id)}
                    className={cn(
                      'w-full py-1.5 text-left text-sm active:text-brand-900',
                      s.id === seccionActual ? 'font-semibold text-brand-900' : 'text-brand-700',
                    )}
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
