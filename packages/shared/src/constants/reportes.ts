export const ESTATUS_REPORTE = ['abierto', 'notificado', 'en_proceso', 'resuelto', 'cerrado'] as const;
export type EstatusReporte = (typeof ESTATUS_REPORTE)[number];

export const PRIORIDAD_REPORTE = ['baja', 'media', 'alta', 'critica'] as const;
export type PrioridadReporte = (typeof PRIORIDAD_REPORTE)[number];
