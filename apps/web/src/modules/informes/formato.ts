import type { InformeResumenFila } from '@platinum/shared';
import { formatFecha } from '../../core/format/fechas';

export const periodoTexto = (i: Pick<InformeResumenFila, 'desde' | 'hasta'>) =>
  `${formatFecha(i.desde)} – ${formatFecha(i.hasta)}`;
