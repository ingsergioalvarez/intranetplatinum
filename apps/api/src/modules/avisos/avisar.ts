import { tituloDeAviso, type TipoAviso } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { notificarPush } from '../push/enviar';

export interface AvisoUsuario {
  tipo: TipoAviso;
  /** Título propio del aviso, coherente con el mensaje (A-22); sin él se usa el genérico del tipo. */
  titulo?: string;
  mensaje: string;
  /** Pantalla a la que lleva el aviso. */
  ruta?: string | null;
  /** Foto en miniatura (clave en el almacenamiento). */
  fotoClave?: string | null;
}

/** Crea un aviso de campanita para cada usuario. Nunca rompe la operación que lo origina. */
export type AvisarUsuarios = (usuarioIds: number[], aviso: AvisoUsuario) => Promise<void>;

export const avisarConPrisma: AvisarUsuarios = async (
  usuarioIds,
  { tipo, titulo, mensaje, ruta = null, fotoClave = null },
) => {
  const ids = [...new Set(usuarioIds)];
  if (ids.length === 0) return;
  try {
    const t = tituloDeAviso(tipo, titulo);
    await getPrisma().aviso.createMany({
      data: ids.map((usuarioId) => ({ usuarioId, tipo, titulo: t, mensaje: mensaje.slice(0, 255), ruta, fotoClave })),
    });
    notificarPush(ids, { tipo, titulo: t, mensaje, ruta });
  } catch (err) {
    console.error('[avisos] No se pudo crear el aviso', err);
  }
};

/** Para pruebas o módulos que no avisan. */
export const sinAvisos: AvisarUsuarios = async () => undefined;
