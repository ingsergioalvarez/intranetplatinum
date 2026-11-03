import type {
  AtenderReporteClienteInput,
  OpcionesReporteCliente,
  ReporteCliente,
  ReporteClienteCreateInput,
  ReportesClienteLista,
} from '@platinum/shared';
import { api } from '../../core/api';

/** Reportes del cliente sobre el servicio o un guardia (A-59). */
export const reportesClienteService = {
  keys: {
    all: ['reportes-cliente'] as const,
    lista: ['reportes-cliente', 'lista'] as const,
    opciones: ['reportes-cliente', 'opciones'] as const,
  },
  lista: () => api.get<ReportesClienteLista>('/reportes-cliente'),
  opciones: () => api.get<OpcionesReporteCliente>('/reportes-cliente/opciones'),
  crear: (input: ReporteClienteCreateInput) => api.post<ReporteCliente>('/reportes-cliente', input),
  atender: (id: number, input: AtenderReporteClienteInput) =>
    api.post<ReporteCliente>(`/reportes-cliente/${id}/atender`, input),
};
