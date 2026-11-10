import { getPrisma } from '../../core/data/prisma';

/** A qué cosa pertenece un aviso (A-54): así se sabe qué avisos actualizar cuando alguien la atiende. */
export interface EntidadAviso {
  /**
   * `rostro`, `incidencia` (de rostro), `bitacora` (un evento de la bitácora del guardia), `marca` (una checada:
   * retardo, salida anticipada o comida fuera), `cambio` (de turno), `hora_extra`, `caso` (de cobertura, por entrada) o `solicitud` (de cobertura al admin) o `ausencia` o `emergencia` (botón de pánico) o `reporte_cliente` (el cliente reporta el servicio o un guardia) o `aviso_privacidad` (el guardia aún no acepta el aviso de privacidad; el id es el del guardia).
   */
  tipo: 'rostro' | 'incidencia' | 'bitacora' | 'marca' | 'cambio' | 'hora_extra' | 'caso' | 'solicitud' | 'ausencia' | 'emergencia' | 'reporte_cliente' | 'aviso_privacidad';
  id: number;
}

/**
 * Avisos que se actualizan al atenderse (A-54): cuando alguien revisa un rostro, atiende una incidencia o
 * decide una falta, los avisos de esa cosa se marcan leídos para todos y quedan con "Atendido por X: resultado".
 * Nunca rompe la operación que lo origina.
 */
export interface AvisosAtencion {
  atender(entidad: EntidadAviso, atencion: { porId: number | null; resultado: string }): Promise<void>;
  /** Se deshizo la decisión: vuelve a quedar por atender (los avisos siguen leídos). */
  reabrir(entidad: EntidadAviso): Promise<void>;
}

export const atencionConPrisma: AvisosAtencion = {
  async atender(entidad, { porId, resultado }) {
    try {
      const db = getPrisma();
      const por = porId
        ? ((await db.usuario.findUnique({ where: { id: porId }, select: { nombre: true } }))?.nombre ?? null)
        : null;
      const ahora = new Date();
      const donde = { entidad: entidad.tipo, entidadId: entidad.id };
      await db.aviso.updateMany({ where: { ...donde, leidoEn: null }, data: { leidoEn: ahora } });
      await db.aviso.updateMany({
        where: donde,
        data: { atendidoEn: ahora, atendidoPor: por, resultado: resultado.slice(0, 120) },
      });
    } catch (err) {
      console.error('[avisos] No se pudo marcar el aviso como atendido', err);
    }
  },

  async reabrir(entidad) {
    try {
      await getPrisma().aviso.updateMany({
        where: { entidad: entidad.tipo, entidadId: entidad.id },
        data: { atendidoEn: null, atendidoPor: null, resultado: null },
      });
    } catch (err) {
      console.error('[avisos] No se pudo reabrir el aviso', err);
    }
  },
};

/** Para pruebas o módulos que no actualizan avisos. */
export const sinAtencion: AvisosAtencion = { atender: async () => undefined, reabrir: async () => undefined };
