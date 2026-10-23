import type { TipoEventoBitacora } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';

export interface EventoNuevo {
  /** Guardia (o integrantes de un grupo) a cuya bitácora va el evento. */
  usuarioIds: number[];
  tipo: TipoEventoBitacora;
  detalle: string;
  /** Por omisión, ahora. */
  ocurrioEn?: Date;
  datos?: Record<string, string | number | boolean | null> | null;
  marcacionId?: number | null;
  incidenciaId?: number | null;
  sitioId?: number | null;
  /** Supervisor/admin que lo hizo; null si fue el sistema o el propio guardia. */
  actorId?: number | null;
}

/** Guarda un evento en la bitácora de cada guardia (DA-41). Nunca rompe la operación que lo origina. */
export type RegistrarBitacora = (evento: EventoNuevo) => Promise<void>;

export const bitacoraConPrisma: RegistrarBitacora = async ({ usuarioIds, detalle, datos, ...e }) => {
  const ids = [...new Set(usuarioIds)];
  if (ids.length === 0) return;
  try {
    await getPrisma().eventoBitacora.createMany({
      data: ids.map((usuarioId) => ({
        usuarioId,
        tipo: e.tipo,
        ocurrioEn: e.ocurrioEn ?? new Date(),
        detalle: detalle.slice(0, 300),
        datos: datos ?? undefined,
        marcacionId: e.marcacionId ?? null,
        incidenciaId: e.incidenciaId ?? null,
        sitioId: e.sitioId ?? null,
        actorId: e.actorId ?? null,
      })),
    });
  } catch (err) {
    console.error('[bitacora] No se pudo registrar el evento', err);
  }
};

/** Para pruebas o módulos que no registran. */
export const sinBitacora: RegistrarBitacora = async () => undefined;
