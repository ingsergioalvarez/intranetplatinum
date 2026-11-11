import type {
  AtenderReporteClienteInput,
  OpcionesReporteCliente,
  ReporteCliente,
  ReporteClienteCreateInput,
  ReportesClienteLista,
} from '@platinum/shared';
import { api } from '../../core/api';
import { formularioConFotos } from '../../core/files/comprimirImagen';

/** Reportes del cliente sobre el servicio o un guardia (A-59). */
export const reportesClienteService = {
  keys: {
    all: ['reportes-cliente'] as const,
    lista: ['reportes-cliente', 'lista'] as const,
    opciones: ['reportes-cliente', 'opciones'] as const,
  },
  lista: () => api.get<ReportesClienteLista>('/reportes-cliente'),
  opciones: () => api.get<OpcionesReporteCliente>('/reportes-cliente/opciones'),
  // Las fotos (opcionales, hasta 5) viajan en el mismo formulario, comprimidas.
  crear: async (input: ReporteClienteCreateInput, fotos: File[]) =>
    api.upload<ReporteCliente>('/reportes-cliente', await formularioConFotos(input, fotos)),
  atender: (id: number, input: AtenderReporteClienteInput) =>
    api.post<ReporteCliente>(`/reportes-cliente/${id}/atender`, input),
};
