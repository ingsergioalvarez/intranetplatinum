import {
  MEDIDA_LABEL,
  ORIGEN_MEDIDA_LABEL,
  type MedidaDisciplinaria,
  type OrigenMedida,
  type TipoMedida,
} from '@platinum/shared';
import { hoyISO, inicioDelDia } from '../../core/time/fechas';
import { getPrisma } from '../../core/data/prisma';
import { avisarConPrisma } from '../avisos/avisar';
import { bitacoraConPrisma } from '../bitacora/registrar';

export interface MedidaNueva {
  usuarioId: number;
  tipo: TipoMedida;
  origen: OrigenMedida;
  /** Por qué se aplica (ya armado, con la lista y el detalle). */
  motivo: string;
  eventoId?: number | null;
  marcacionId?: number | null;
  sitioId?: number | null;
  sitio?: string | null;
  actorId: number;
}

/**
 * Medidas disciplinarias (A-48, A-49): historial formal del guardia. Aplicar una medida la guarda,
 * la deja en la bitácora y avisa al guardia. Nunca rompe la operación que la origina.
 */
export interface MedidasPuerto {
  aplicar(m: MedidaNueva): Promise<void>;
  /** Cuántas jornadas con salida sin marcar (cerradas por un supervisor) tuvo el guardia en el mes de `fecha`. */
  salidasSinMarcarDelMes(usuarioId: number, fecha: Date): Promise<number>;
  /** Historial formal del guardia, de la más nueva a la más vieja. */
  delGuardia(usuarioId: number): Promise<MedidaDisciplinaria[]>;
}

export const medidasConPrisma: MedidasPuerto = {
  async aplicar(m) {
    try {
      await getPrisma().medidaDisciplinaria.create({
        data: {
          usuarioId: m.usuarioId,
          tipo: m.tipo,
          origen: m.origen,
          motivo: m.motivo.slice(0, 255),
          eventoId: m.eventoId ?? null,
          marcacionId: m.marcacionId ?? null,
          sitioId: m.sitioId ?? null,
          aplicadaPorId: m.actorId,
        },
      });
    } catch (err) {
      console.error('[medidas] No se pudo guardar la medida', err);
      return;
    }
    const actor =
      (await getPrisma().usuario.findUnique({ where: { id: m.actorId }, select: { nombre: true } }))?.nombre ??
      'Un supervisor';
    const nombre = MEDIDA_LABEL[m.tipo];
    const origen = ORIGEN_MEDIDA_LABEL[m.origen].toLowerCase();
    await bitacoraConPrisma({
      usuarioIds: [m.usuarioId],
      tipo: 'medida_disciplinaria',
      detalle: `${actor} aplicó: ${nombre} (${origen}). Motivo: ${m.motivo}`,
      datos: { medida: m.tipo, origen: m.origen },
      sitioId: m.sitioId ?? null,
      marcacionId: m.marcacionId ?? null,
      actorId: m.actorId,
    });
    await avisarConPrisma([m.usuarioId], {
      tipo: 'marca_alerta',
      titulo: m.tipo === 'amonestacion' ? 'Recibiste una amonestación' : 'Recibiste una llamada de atención',
      mensaje: `${actor} te aplicó: ${nombre} por ${origen}${m.sitio ? ` en ${m.sitio}` : ''}. Motivo: ${m.motivo}`,
      ruta: '/marcar/historial',
    });
  },

  async salidasSinMarcarDelMes(usuarioId, fecha) {
    const mes = hoyISO(undefined, fecha).slice(0, 7);
    const [a, mm] = mes.split('-').map(Number);
    const siguiente = mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, '0')}`;
    return getPrisma().eventoBitacora.count({
      where: {
        usuarioId,
        tipo: 'jornada_cerrada',
        datos: { path: '$.origen', equals: 'salida_sin_marcar' },
        ocurrioEn: { gte: inicioDelDia(`${mes}-01`), lt: inicioDelDia(`${siguiente}-01`) },
      },
    });
  },

  async delGuardia(usuarioId) {
    const filas = await getPrisma().medidaDisciplinaria.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      include: { aplicadaPor: { select: { nombre: true } } },
    });
    const sitios = await getPrisma().sitio.findMany({
      where: { id: { in: [...new Set(filas.flatMap((f) => (f.sitioId ? [f.sitioId] : [])))] } },
      select: { id: true, nombre: true },
    });
    const nombreSitio = new Map(sitios.map((s) => [s.id, s.nombre]));
    return filas.map((f) => ({
      id: f.id,
      tipo: f.tipo as TipoMedida,
      origen: f.origen as OrigenMedida,
      motivo: f.motivo,
      sitio: f.sitioId ? (nombreSitio.get(f.sitioId) ?? null) : null,
      aplicadaPor: f.aplicadaPor?.nombre ?? null,
      createdAt: f.createdAt.toISOString(),
    }));
  },
};

/** Para pruebas o módulos que no aplican medidas. */
export const sinMedidas: MedidasPuerto = {
  aplicar: async () => undefined,
  salidasSinMarcarDelMes: async () => 0,
  delGuardia: async () => [],
};
