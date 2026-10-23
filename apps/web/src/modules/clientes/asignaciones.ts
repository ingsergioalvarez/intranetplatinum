import { TURNO_LABEL, horaLegible, textoDias, type Asignacion } from '@platinum/shared';
import { formatFecha } from '../../core/format/fechas';

type DatosAsignacion = Pick<
  Asignacion,
  'tipo' | 'turno' | 'horaInicio' | 'horaFin' | 'desde' | 'hasta' | 'horas' | 'dias'
>;

/**
 * Texto corto: "24 h · entra 8:00 a.m. · desde 12 oct 2026", "6:00 p.m.–3:00 a.m. · 20 oct 2026",
 * "12 h · entra 8:00 p.m. · 1 nov – 15 nov".
 */
export function describirAsignacion(a: DatosAsignacion) {
  const fechas =
    a.tipo === 'fija'
      ? `desde ${formatFecha(a.desde)}`
      : a.hasta && a.hasta !== a.desde
        ? `${formatFecha(a.desde)} – ${formatFecha(a.hasta)}`
        : formatFecha(a.desde);
  const cuando =
    a.tipo === 'eventual'
      ? a.horaInicio && a.horaFin && `${horaLegible(a.horaInicio)}–${horaLegible(a.horaFin)}`
      : [
          a.horas ? `${a.horas} h` : a.turno && TURNO_LABEL[a.turno],
          a.horaInicio && `entra ${horaLegible(a.horaInicio)}`,
          a.dias && textoDias(a.dias).toLowerCase(),
        ]
          .filter(Boolean)
          .join(' · ');
  return [cuando, fechas].filter(Boolean).join(' · ');
}
