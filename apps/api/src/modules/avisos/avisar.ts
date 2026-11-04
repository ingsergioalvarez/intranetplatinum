import { tituloDeAviso, type TipoAviso } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { notificarPush } from '../push/enviar';
import type { EntidadAviso } from './atencion';
import { empresaActual } from '../../core/empresa/contexto';

export interface AvisoUsuario {
  tipo: TipoAviso;
  /** Título propio del aviso, coherente con el mensaje (A-22); sin él se usa el genérico del tipo. */
  titulo?: string;
  mensaje: string;
  /** Pantalla a la que lleva el aviso. */
  ruta?: string | null;
  /** Foto en miniatura (clave en el almacenamiento). */
  fotoClave?: string | null;
  /** Qué cosa atiende (A-54): al atenderla, el aviso se actualiza. */
  entidad?: EntidadAviso;
  /** Alerta urgente (A-60): el push suena y no se descarta sola. */
  urgente?: boolean;
}

/** Crea un aviso de campanita para cada usuario. Nunca rompe la operación que lo origina. */
export type AvisarUsuarios = (usuarioIds: number[], aviso: AvisoUsuario) => Promise<void>;

export const avisarConPrisma: AvisarUsuarios = async (
  usuarioIds,
  { tipo, titulo, mensaje, ruta = null, fotoClave = null, entidad, urgente },
) => {
  const ids = [...new Set(usuarioIds)];
  if (ids.length === 0) return;
  try {
    const t = tituloDeAviso(tipo, titulo);
    await getPrisma().aviso.createMany({
      data: ids.map((usuarioId) => ({
        empresaId: empresaActual(),
        usuarioId,
        tipo,
        titulo: t,
        mensaje: mensaje.slice(0, 255),
        ruta,
        fotoClave,
        entidad: entidad?.tipo ?? null,
        entidadId: entidad?.id ?? null,
      })),
    });
    notificarPush(ids, { tipo, titulo: t, mensaje, ruta, urgente });
  } catch (err) {
    console.error('[avisos] No se pudo crear el aviso', err);
  }
};

/** Para pruebas o módulos que no avisan. */
export const sinAvisos: AvisarUsuarios = async () => undefined;
