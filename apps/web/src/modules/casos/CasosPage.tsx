import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CircleCheck, Route } from 'lucide-react';
import { DECISION_CASO_LABEL, horaLegible, type CasoCobertura } from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, EmptyState, Spinner } from '../../components/ui';
import { casosService } from './casos.service';
import { cuando, hora24 } from './formato';
import { PlanModal } from './PlanModal';

/** Lo que quedó decidido, en una frase. */
function resumen(c: CasoCobertura) {
  if (!c.decision) return null;
  if (c.decision === 'en_camino') return 'Viene en camino: el guardia espera.';
  if (c.decision === 'otro_cubre') return 'Mandaste a otro guardia a cubrir.';
  return c.siguiente === 'descansa'
    ? `Cubre el turno y descansa: se presenta ${cuando(c.regresaEn)}.`
    : 'Cubre el turno y trabaja normal su siguiente turno.';
}

/**
 * Casos de cobertura (AS6-05): guardias que siguen en el sitio porque su relevo no llegó. El
 * supervisor deja el plan completo desde el inicio; el sistema le muestra qué pasa con cada elección.
 */
export function CasosPage() {
  const [plan, setPlan] = useState<CasoCobertura | null>(null);
  const lista = useQuery({
    queryKey: casosService.keys.lista,
    queryFn: casosService.lista,
    refetchInterval: 60_000,
  });

  return (
    <>
      <Link
        to="/asistencia"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> Asistencia
      </Link>
      <PageHeader
        title="Casos de cobertura"
        subtitle="Un guardia sigue en el sitio porque su relevo no llegó: deja el plan completo desde el inicio."
      />

      {lista.isPending ? (
        <div className="flex justify-center py-10 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : lista.isError ? (
        <EmptyState
          title="No se pudieron cargar los casos"
          description="Revisa tu conexión e intenta de nuevo."
          action={
            <Button variant="secondary" onClick={() => void lista.refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : lista.data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CircleCheck className="size-10 text-emerald-600" />}
            title="Nada pendiente"
            description="Nadie sigue en el sitio esperando a su relevo."
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {lista.data.items.map((c) => (
            <li key={c.entradaId}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/asistencia/guardias/${c.guardia.id}`} className="font-semibold text-slate-900 hover:underline">
                        {c.guardia.nombre}
                      </Link>
                      <span className="text-sm text-slate-500">· {c.sitio.nombre}</span>
                      <Badge tone={c.estado === 'resuelto' ? 'success' : c.estado === 'en_espera' ? 'warning' : 'danger'}>
                        {c.estado === 'resuelto' ? 'Plan confirmado' : c.estado === 'en_espera' ? DECISION_CASO_LABEL.en_camino : 'Sin decidir'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">
                      Sigue en el sitio desde las {horaLegible(hora24(c.desde))}
                      {c.relevo
                        ? `; ${c.relevo.nombre} no llegó (le tocaba a las ${horaLegible(hora24(c.relevo.inicio))})`
                        : '; no hay un relevo registrado como ausente'}
                    </p>
                    {resumen(c) && <p className="mt-1 text-sm text-slate-600">{resumen(c)}</p>}
                  </div>
                  {c.estado !== 'resuelto' && (
                    <Button size="sm" icon={<Route className="size-4" />} onClick={() => setPlan(c)}>
                      Definir plan
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {plan && <PlanModal caso={plan} onClose={() => setPlan(null)} />}
    </>
  );
}
