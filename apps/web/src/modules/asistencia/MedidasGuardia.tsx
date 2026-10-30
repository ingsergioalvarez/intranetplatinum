import { useQuery } from '@tanstack/react-query';
import { Gavel } from 'lucide-react';
import {
  MEDIDA_LABEL,
  ORIGEN_MEDIDA_LABEL,
  SALIDAS_SIN_MARCAR_SUGERIR,
  type MedidaDisciplinaria,
} from '@platinum/shared';
import { Badge, Card, CardHeader, EmptyState, Spinner } from '../../components/ui';
import { formatFechaHora } from '../../core/format/fechas';
import { asistenciaService } from './asistencia.service';

/** Historial formal de medidas disciplinarias del guardia (A-48, A-49). */
export function MedidasGuardia({ guardiaId }: { guardiaId: number }) {
  const medidas = useQuery({
    queryKey: asistenciaService.keys.medidas(guardiaId),
    queryFn: () => asistenciaService.medidas(guardiaId),
  });

  return (
    <Card>
      <CardHeader
        title="Medidas disciplinarias"
        subtitle={`Historial formal del guardia. Con ${SALIDAS_SIN_MARCAR_SUGERIR} salidas sin marcar en un mes se sugiere una amonestación.`}
      />
      {medidas.isPending ? (
        <div className="flex justify-center py-6 text-brand-600">
          <Spinner className="size-6" />
        </div>
      ) : medidas.isError ? (
        <EmptyState title="No se pudo cargar el historial" description="Revisa tu conexión." />
      ) : medidas.data.length === 0 ? (
        <EmptyState
          icon={<Gavel className="size-10" />}
          title="Sin medidas"
          description="Este guardia no tiene medidas disciplinarias."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {medidas.data.map((m) => (
            <Fila key={m.id} medida={m} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function Fila({ medida: m }: { medida: MedidaDisciplinaria }) {
  return (
    <li className="space-y-1 px-4 py-3 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-slate-900">{MEDIDA_LABEL[m.tipo]}</span>
        <Badge tone={m.tipo === 'amonestacion' ? 'danger' : 'warning'}>{ORIGEN_MEDIDA_LABEL[m.origen]}</Badge>
      </p>
      <p className="text-slate-700">{m.motivo}</p>
      <p className="text-xs text-slate-500">
        {formatFechaHora(m.createdAt)}
        {m.sitio && ` · ${m.sitio}`}
        {m.aplicadaPor && ` · Por ${m.aplicadaPor}`}
      </p>
    </li>
  );
}
