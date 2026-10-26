import type {
  Informe,
  InformeEmitido,
  InformeResumenFila,
  NuevoInformeInput,
  OpcionesInforme,
  Paginated,
  VerificacionInforme,
} from '@platinum/shared';
import { api, type ListParams } from '../../core/api';

export type FormatoInforme = 'pdf' | 'excel';

export const informesService = {
  keys: {
    all: ['informes'] as const,
    list: (params: ListParams) => ['informes', 'lista', params] as const,
    uno: (id: number) => ['informes', 'uno', id] as const,
    opciones: ['informes', 'opciones'] as const,
  },
  list: (params: ListParams) => api.get<Paginated<InformeResumenFila>>('/informes', { query: params }),
  opciones: () => api.get<OpcionesInforme>('/informes/opciones'),
  emitir: (input: NuevoInformeInput) => api.post<InformeEmitido>('/informes', input),
  obtener: (id: number) => api.get<Informe>(`/informes/${id}`),
  /** Pública (la abre el QR del PDF). */
  verificar: (folio: string, codigo?: string) =>
    api.get<VerificacionInforme>(`/informes/verificar/${folio}`, { query: { c: codigo } }),
  /**
   * Excel: se descarga. PDF: se abre en una pestaña con el visor del navegador (vista previa) para
   * revisarlo antes de guardarlo. La pestaña se abre al instante (con el toque del usuario) para que
   * el navegador no la bloquee; si ya se abrió antes, se pasa en `ventana`.
   */
  async descargar(
    informe: { id: number; folio: string },
    formato: FormatoInforme,
    ventana: Window | null = formato === 'pdf' ? window.open('', '_blank') : null,
  ) {
    let blob: Blob;
    try {
      blob = await api.blob(`/informes/${informe.id}/${formato}`);
    } catch (e) {
      ventana?.close();
      throw e;
    }
    const url = URL.createObjectURL(blob);
    if (formato === 'pdf' && ventana) {
      ventana.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${informe.folio}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};
