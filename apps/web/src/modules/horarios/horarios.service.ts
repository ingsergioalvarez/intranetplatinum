import { api } from '../../core/api';

/** Horario de guardias en PDF (A-55). */
export const horariosService = {
  /** Descarga el PDF con la sesión actual. `guardias` son ids separados por coma. */
  async pdf(q: { desde: string; hasta: string; guardias?: string; sitioId?: number }) {
    const params = new URLSearchParams({ desde: q.desde, hasta: q.hasta });
    if (q.guardias) params.set('guardias', q.guardias);
    if (q.sitioId) params.set('sitioId', String(q.sitioId));
    const blob = await api.blob(`/horarios/pdf?${params.toString()}`);
    return { blob, nombre: `horario_${q.desde}_a_${q.hasta}.pdf` };
  },
};
