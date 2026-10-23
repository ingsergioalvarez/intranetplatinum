import { horaLegible, horaSalida, textoDias, type DiasTurno, type GuardiaDisponible } from '@platinum/shared';

/** "24 h · 8:00 a.m." (y los días si no es diario ni un día sí, uno no). */
export function nombreSugerido(horas: number, hora: string, dias: DiasTurno) {
  if (!hora || !horas) return '';
  const base = `${horas} h · ${horaLegible(hora)}`;
  if (dias.tipo === 'diario' || (dias.tipo === 'ciclo' && dias.trabaja === 1 && dias.descansa === 1))
    return base;
  if (dias.tipo === 'ciclo') return `${base} · ${dias.trabaja}x${dias.descansa}`;
  return `${base} · ${textoDias(dias)}`;
}

/** "Entra 8:00 a.m. · sale 8:00 a.m. del día siguiente" */
export function textoHorario(horas: number, entrada: string) {
  const salida = horaSalida(horas, entrada);
  return `Entra ${horaLegible(entrada)} · sale ${horaLegible(salida)}${salida <= entrada ? ' del día siguiente' : ''}`;
}

/** "POETAS · 24 h · 8:00 a.m." o "Sin sitio". */
export function asignacionActual(g: GuardiaDisponible) {
  if (g.asignaciones.length === 0) return 'Sin sitio';
  return g.asignaciones
    .map((a) =>
      [
        a.sitio.nombre,
        a.turnoNombre ?? (a.tipo === 'eventual' ? 'Evento' : null),
        a.grupo && `grupo ${a.grupo}`,
      ]
        .filter(Boolean)
        .join(' · '),
    )
    .join(' | ');
}
