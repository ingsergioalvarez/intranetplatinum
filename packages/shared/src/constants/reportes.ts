export const ESTATUS_REPORTE = ['abierto', 'notificado', 'en_proceso', 'resuelto', 'cerrado'] as const;
export type EstatusReporte = (typeof ESTATUS_REPORTE)[number];

export const ESTATUS_REPORTE_LABEL: Record<EstatusReporte, string> = {
  abierto: 'Abierto',
  notificado: 'Notificado',
  en_proceso: 'En proceso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

/**
 * Cambios de estatus permitidos manualmente. `notificado` lo pone el envío de avisos (F3-07);
 * resuelto/cerrado pueden reabrirse a "en proceso".
 */
export const TRANSICIONES_ESTATUS: Record<EstatusReporte, EstatusReporte[]> = {
  abierto: ['en_proceso', 'resuelto', 'cerrado'],
  notificado: ['en_proceso', 'resuelto', 'cerrado'],
  en_proceso: ['resuelto', 'cerrado'],
  resuelto: ['cerrado', 'en_proceso'],
  cerrado: ['en_proceso'],
};

export const PRIORIDAD_REPORTE = ['baja', 'media', 'alta', 'critica'] as const;
export type PrioridadReporte = (typeof PRIORIDAD_REPORTE)[number];

export const PRIORIDAD_REPORTE_LABEL: Record<PrioridadReporte, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
};

export const PRIORIDAD_REPORTE_DESCRIPCION: Record<PrioridadReporte, string> = {
  baja: 'Puede esperar; no afecta la operación',
  media: 'Atender en los próximos días',
  alta: 'Afecta la seguridad u operación; atender hoy',
  critica: 'Riesgo inmediato para personas o el inmueble',
};

/** Fotos por reporte o seguimiento. */
export const MAX_FOTOS_REPORTE = 10;
