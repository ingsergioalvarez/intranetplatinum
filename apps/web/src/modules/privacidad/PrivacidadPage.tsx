import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { AVISO_PRIVACIDAD_ES_BORRADOR, type FiltroAvisoPrivacidad, type GuardiaAvisoPrivacidad } from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Card, EmptyState, Spinner, type BadgeTone } from '../../components/ui';
import { formatFechaHora } from '../../core/format/fechas';
import { Chips } from '../asistencia/BitacoraGuardia';
import { AvisoPrivacidadTexto } from './AvisoPrivacidadTexto';
import { privacidadService } from './privacidad.service';

function estadoDe(g: GuardiaAvisoPrivacidad): { texto: string; tono: BadgeTone } {
  if (g.vigente) return { texto: 'Aceptado', tono: 'success' };
  if (g.aceptada) return { texto: 'Falta la versión nueva', tono: 'info' };
  return { texto: 'Sin aceptar: no puede checar', tono: 'warning' };
}

/**
 * Aviso de privacidad por el uso del rostro (A-68): quién de los guardias ya lo aceptó y quién falta, y el texto
 * vigente. Admin y supervisor ven los de su cartera.
 */
export function PrivacidadPage() {
  const [filtro, setFiltro] = useState<FiltroAvisoPrivacidad>('pendientes');
  const [verTexto, setVerTexto] = useState(false);
  const lista = useQuery({
    queryKey: privacidadService.keys.guardias(filtro),
    queryFn: () => privacidadService.guardias(filtro),
    refetchInterval: 60_000,
  });
  const data = lista.data;

  return (
    <>
      <PageHeader
        title="Aviso de privacidad"
        subtitle="Quién ya aceptó el uso de su rostro para checar y quién falta"
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Chips
          label="Guardias"
          todas="Pendientes"
          opciones={[['todos', 'Todos'] as const]}
          valor={filtro === 'todos' ? 'todos' : null}
          onChange={(v) => setFiltro(v === 'todos' ? 'todos' : 'pendientes')}
        />
        {data && (
          <p className="text-sm text-slate-600">
            {data.sinAceptar > 0 ? (
              <>
                <strong>{data.sinAceptar}</strong> sin aceptar (no pueden checar)
              </>
            ) : (
              'Todos pueden checar'
            )}
            {data.pendientes > data.sinAceptar && ` · ${data.pendientes - data.sinAceptar} con versión anterior`}
          </p>
        )}
      </div>

      {lista.isPending ? (
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : lista.isError ? (
        <EmptyState title="No se pudo cargar" description="Revisa tu conexión e intenta de nuevo." />
      ) : data!.items.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-10" />}
          title={filtro === 'pendientes' ? 'Nadie pendiente' : 'Sin guardias'}
          description={
            filtro === 'pendientes'
              ? 'Todos los guardias aceptaron la versión vigente del aviso.'
              : 'Aún no hay guardias en tu cartera.'
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data!.items.map((g) => {
            const e = estadoDe(g);
            return (
              <li key={g.id}>
                <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{g.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {g.aceptadaEn
                        ? `Aceptó ${g.versionAceptada} · ${formatFechaHora(g.aceptadaEn)}`
                        : 'Nunca lo ha aceptado'}
                    </p>
                  </div>
                  <Badge tone={e.tono}>{e.texto}</Badge>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8">
        <button
          type="button"
          onClick={() => setVerTexto((v) => !v)}
          className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
        >
          {verTexto ? 'Ocultar el texto del aviso' : 'Ver el texto del aviso vigente'}
          {AVISO_PRIVACIDAD_ES_BORRADOR && ' (borrador)'}
        </button>
        {verTexto && (
          <Card className="mt-3 p-4">
            <AvisoPrivacidadTexto />
          </Card>
        )}
      </div>
    </>
  );
}
