import type { RespuestaSos, TipoEventoC2 } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';

/** Una línea de la bitácora del C2 (A-80). */
export interface NuevoEventoC2 {
  tipo: TipoEventoC2;
  sitioId?: number | null;
  detalle?: string | null;
  usuarioId?: number | null;
  /** Nombre de quien lo hizo; sin él, se toma el del usuario. */
  usuarioNombre?: string | null;
  /** Cuánto duró lo que termina aquí. */
  minutos?: number | null;
  entidad?: { tipo: 'emergencia' | 'reporte'; id: number } | null;
  /** Cuándo ocurrió, si no es ahora (por ejemplo, el sitio estaba solo desde la hora del turno). */
  ocurrioEn?: Date;
}

/** Registra un evento. Nunca rompe la operación que lo origina. */
export type RegistrarEventoC2 = (evento: NuevoEventoC2) => Promise<void>;

/** Sin bitácora (pruebas o módulos que no la usan). */
export const sinEventosC2: RegistrarEventoC2 = async () => undefined;

export const registrarEventoC2ConPrisma: RegistrarEventoC2 = async (e) => {
  try {
    const db = getPrisma();
    const sitio = e.sitioId
      ? await db.sitio.findUnique({ where: { id: e.sitioId }, select: { nombre: true, cliente: { select: { nombreComercial: true } } } })
      : null;
    const usuarioNombre =
      e.usuarioNombre ?? (e.usuarioId ? (await db.usuario.findUnique({ where: { id: e.usuarioId }, select: { nombre: true } }))?.nombre : null) ?? null;
    await db.c2Evento.create({
      data: {
        tipo: e.tipo,
        sitioId: sitio ? e.sitioId : null,
        sitioNombre: sitio?.nombre ?? null,
        clienteNombre: sitio?.cliente.nombreComercial ?? null,
        detalle: e.detalle?.slice(0, 500) ?? null,
        usuarioId: e.usuarioId ?? null,
        usuarioNombre: usuarioNombre?.slice(0, 120) ?? null,
        minutos: e.minutos ?? null,
        entidad: e.entidad?.tipo ?? null,
        entidadId: e.entidad?.id ?? null,
        ...(e.ocurrioEn && { createdAt: e.ocurrioEn }),
      },
    });
  } catch (err) {
    console.error('[c2] No se pudo registrar el evento en la bitácora', err);
  }
};

/** Lo que ya se hizo en cada emergencia (A-81): quién la atiende y lo que registró el C2, en orden. */
export type RespuestasDe = (emergenciaIds: number[]) => Promise<Map<number, RespuestaSos[]>>;

export const sinRespuestas: RespuestasDe = async () => new Map();

export const respuestasConPrisma: RespuestasDe = async (ids) => {
  const mapa = new Map<number, RespuestaSos[]>();
  if (ids.length === 0) return mapa;
  try {
    const filas = await getPrisma().c2Evento.findMany({
      where: { entidad: 'emergencia', entidadId: { in: ids }, tipo: { in: ['sos_atendiendo', 'sos_respuesta'] } },
      orderBy: { id: 'asc' },
      select: { id: true, entidadId: true, detalle: true, usuarioNombre: true, createdAt: true },
    });
    for (const f of filas) {
      const lista = mapa.get(f.entidadId!) ?? [];
      lista.push({ id: f.id, texto: f.detalle ?? '', por: f.usuarioNombre, en: f.createdAt.toISOString() });
      mapa.set(f.entidadId!, lista);
    }
  } catch (err) {
    console.error('[c2] No se pudieron leer las respuestas de las emergencias', err);
  }
  return mapa;
};
