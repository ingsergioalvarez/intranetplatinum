import { TURNO_LABEL, type Asignacion } from '@platinum/shared';
import { formatFecha } from '../../core/format/fechas';

type DatosAsignacion = Pick<Asignacion, 'tipo' | 'turno' | 'horaInicio' | 'horaFin' | 'desde' | 'hasta'>;

/** Texto corto: "Diurno · desde 12 oct 2026", "20:00–03:00 · 20 oct 2026", "Nocturno · 1 nov – 15 nov". */
export function describirAsignacion(a: DatosAsignacion) {
  const fechas =
    a.tipo === 'fija'
      ? `desde ${formatFecha(a.desde)}`
      : a.hasta && a.hasta !== a.desde
        ? `${formatFecha(a.desde)} – ${formatFecha(a.hasta)}`
        : formatFecha(a.desde);
  const cuando =
    a.tipo === 'eventual' ? `${a.horaInicio}–${a.horaFin}` : a.turno ? TURNO_LABEL[a.turno] : null;
  return [cuando, fechas].filter(Boolean).join(' · ');
}
