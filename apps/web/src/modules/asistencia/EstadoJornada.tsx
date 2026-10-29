import { ALERTA_MARCACION_LABEL, type FilaAsistencia, type Jornada } from '@platinum/shared';
import { Badge } from '../../components/ui';
import { formatHora, jornadaEnCurso } from './formato';

/**
 * Estado de una jornada en una sola etiqueta. Sin jornada: en qué va su turno (DA-45) — antes de su
 * hora, por llegar, no se ha presentado (15 min) o falta (2 h); "Sin marcas" si no tiene horario.
 */
export function EstadoJornada({
  jornada: j,
  turno = null,
}: {
  jornada: Jornada | null;
  turno?: FilaAsistencia['turno'];
}) {
  if (!j) {
    if (!turno) return <Badge>Sin marcas</Badge>;
    if (turno.estado === 'falta') return <Badge tone="danger">Falta</Badge>;
    if (turno.estado === 'no_se_presento') return <Badge tone="warning">No se ha presentado</Badge>;
    if (turno.estado === 'por_llegar') return <Badge tone="info">Por llegar</Badge>;
    return <Badge>Entra {formatHora(turno.entrada)}</Badge>;
  }
  if (j.alertas.includes('enviada_a_casa')) return <Badge tone="danger">Mandado a casa</Badge>;
  // Lo justificado por un supervisor ya no es pendiente (A-24).
  const pendientes = j.alertas.filter((a) => !j.justificadas.includes(a));
  if (pendientes.length === 1) return <Badge tone="warning">{ALERTA_MARCACION_LABEL[pendientes[0]]}</Badge>;
  if (pendientes.length) return <Badge tone="warning">{pendientes.length} alertas</Badge>;
  if (j.justificadas.length === 1 && j.salida)
    return <Badge tone="info">{ALERTA_MARCACION_LABEL[j.justificadas[0]]} justificado</Badge>;
  if (!j.salida)
    return jornadaEnCurso(j) ? <Badge tone="info">En curso</Badge> : <Badge tone="warning">Sin salida</Badge>;
  return <Badge tone="success">Completa</Badge>;
}
