import type { CambioTurno } from '@platinum/shared';
import { formatFecha } from '../../core/format/fechas';

/** Frase de lo que cambia, para listas y avisos. */
export function descripcionCambio(c: CambioTurno) {
  return c.tipo === 'cubrir'
    ? `${c.cubre?.nombre ?? 'Un compañero'} cubre a ${c.guardia.nombre} el ${formatFecha(c.fecha)}`
    : `${c.guardia.nombre} descansa el ${formatFecha(c.fecha)} y trabaja el ${formatFecha(c.fechaNueva)}`;
}
