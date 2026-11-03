import type {
  Ausencia,
  AusenciaCreateInput,
  AusenciasLista,
  CancelarAusenciaInput,
  ResolverAusenciaInput,
  VistaPreviaAusencia,
} from '@platinum/shared';
import { api } from '../../core/api';
import { comprimirImagen } from '../../core/files/comprimirImagen';

/** Ausencias justificadas por adelantado (A-43). */
export const ausenciasService = {
  keys: {
    all: ['ausencias'] as const,
    lista: ['ausencias', 'lista'] as const,
    previa: (usuarioId: number, desde: string, hasta: string) => ['ausencias', 'previa', usuarioId, desde, hasta] as const,
  },
  lista: () => api.get<AusenciasLista>('/ausencias'),
  vistaPrevia: (usuarioId: number, desde: string, hasta: string) =>
    api.get<VistaPreviaAusencia>('/ausencias/vista-previa', { query: { usuarioId, desde, hasta } }),
  /** Pide o registra una ausencia; el comprobante (una foto) se comprime antes de subirlo. */
  async crear(campos: AusenciaCreateInput, comprobante?: File) {
    const form = new FormData();
    for (const [k, v] of Object.entries(campos)) {
      if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
    }
    if (comprobante) {
      const foto = await comprimirImagen(comprobante);
      form.append('foto', foto, foto.name);
    }
    return api.upload<Ausencia>('/ausencias', form);
  },
  resolver: (id: number, input: ResolverAusenciaInput) => api.post<Ausencia>(`/ausencias/${id}/resolver`, input),
  cancelar: (id: number, input: CancelarAusenciaInput) => api.post<Ausencia>(`/ausencias/${id}/cancelar`, input),
};
