import type {
  ConclusionIncidencia,
  DECISION_SUPERADO,
  DecisionFalta,
  DecisionRetardo,
  MotivoIncidencia,
  TipoEventoBitacora,
} from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';

export interface EventoBitacoraRow {
  id: number;
  usuarioId: number;
  guardia: { id: number; nombre: string; email: string };
  tipo: TipoEventoBitacora;
  ocurrioEn: Date;
  detalle: string;
  datos: unknown;
  marcacionId: number | null;
  sitio: { id: number; nombre: string } | null;
  actor: string | null;
  fotoMarca: string | null;
  incidencia: {
    id: number;
    motivo: MotivoIncidencia;
    fotoClave: string;
    revisadaPor: string | null;
    revisadaEn: Date | null;
    conclusion: ConclusionIncidencia | null;
    nota: string | null;
  } | null;
  justificacion: string | null;
  justificadoPor: string | null;
  justificadoEn: Date | null;
  decision: DecisionFalta | DecisionRetardo | typeof DECISION_SUPERADO | null;
  decididoPor: string | null;
  decididoEn: Date | null;
  decisionMotivo: string | null;
  comentarios: { id: number; texto: string; autor: string | null; createdAt: Date }[];
}

export interface GuardiaConFoto {
  id: number;
  nombre: string;
  email: string;
  fotoClave: string | null;
}

export abstract class BitacoraRepository {
  abstract existeGuardia(usuarioId: number): Promise<boolean>;
  /** Eventos del guardia entre dos instantes, del más nuevo al más viejo. */
  abstract eventos(usuarioId: number, desde: Date, hasta: Date): Promise<EventoBitacoraRow[]>;
  /** Eventos de esos tipos de todos los guardias entre dos instantes, del más nuevo al más viejo. */
  abstract eventosDeTodos(
    tipos: readonly TipoEventoBitacora[],
    desde: Date,
    hasta: Date,
  ): Promise<EventoBitacoraRow[]>;
  /** Guardias activos con la foto de su rostro vigente. */
  abstract guardiasActivos(): Promise<GuardiaConFoto[]>;
  abstract findById(id: number): Promise<EventoBitacoraRow | null>;
  abstract comentar(eventoId: number, autorId: number, texto: string): Promise<void>;
  abstract justificar(eventoId: number, porId: number, motivo: string, en: Date): Promise<void>;
  abstract decidir(
    eventoId: number,
    porId: number,
    decision: DecisionFalta,
    en: Date,
    motivo?: string,
  ): Promise<void>;
}

const nombre = { select: { nombre: true } } as const;
const select = {
  id: true,
  usuarioId: true,
  usuario: { select: { id: true, nombre: true, email: true } },
  tipo: true,
  ocurrioEn: true,
  detalle: true,
  datos: true,
  marcacionId: true,
  justificacion: true,
  justificadoEn: true,
  decision: true,
  decididoEn: true,
  decisionMotivo: true,
  decididoPor: nombre,
  sitio: { select: { id: true, nombre: true } },
  actor: nombre,
  justificadoPor: nombre,
  marcacion: { select: { fotoClave: true } },
  incidencia: {
    select: {
      id: true,
      motivo: true,
      fotoClave: true,
      revisadaEn: true,
      conclusion: true,
      nota: true,
      revisadaPor: nombre,
    },
  },
  comentarios: {
    select: { id: true, texto: true, createdAt: true, autor: nombre },
    orderBy: { createdAt: 'asc' },
  },
} as const;

type Fila = Prisma.EventoBitacoraGetPayload<{ select: typeof select }>;

function aRow(r: Fila): EventoBitacoraRow {
  return {
    id: r.id,
    usuarioId: r.usuarioId,
    guardia: r.usuario,
    tipo: r.tipo,
    ocurrioEn: r.ocurrioEn,
    detalle: r.detalle,
    datos: r.datos,
    marcacionId: r.marcacionId,
    sitio: r.sitio,
    actor: r.actor?.nombre ?? null,
    fotoMarca: r.marcacion?.fotoClave ?? null,
    incidencia: r.incidencia && {
      id: r.incidencia.id,
      motivo: r.incidencia.motivo,
      fotoClave: r.incidencia.fotoClave,
      revisadaPor: r.incidencia.revisadaPor?.nombre ?? null,
      revisadaEn: r.incidencia.revisadaEn,
      conclusion: r.incidencia.conclusion,
      nota: r.incidencia.nota,
    },
    justificacion: r.justificacion,
    justificadoPor: r.justificadoPor?.nombre ?? null,
    justificadoEn: r.justificadoEn,
    decision: r.decision as DecisionFalta | DecisionRetardo | typeof DECISION_SUPERADO | null,
    decididoPor: r.decididoPor?.nombre ?? null,
    decididoEn: r.decididoEn,
    decisionMotivo: r.decisionMotivo,
    comentarios: r.comentarios.map((c) => ({
      id: c.id,
      texto: c.texto,
      autor: c.autor?.nombre ?? null,
      createdAt: c.createdAt,
    })),
  };
}

export class PrismaBitacoraRepository extends BitacoraRepository {
  async existeGuardia(usuarioId: number) {
    return (await getPrisma().usuario.count({ where: { id: usuarioId } })) > 0;
  }

  async eventos(usuarioId: number, desde: Date, hasta: Date) {
    const rows = await getPrisma().eventoBitacora.findMany({
      where: { usuarioId, ocurrioEn: { gte: desde, lt: hasta } },
      select,
      orderBy: [{ ocurrioEn: 'desc' }, { id: 'desc' }],
    });
    return rows.map(aRow);
  }

  async eventosDeTodos(tipos: readonly TipoEventoBitacora[], desde: Date, hasta: Date) {
    const rows = await getPrisma().eventoBitacora.findMany({
      where: { tipo: { in: [...tipos] }, ocurrioEn: { gte: desde, lt: hasta } },
      select,
      orderBy: [{ ocurrioEn: 'desc' }, { id: 'desc' }],
    });
    return rows.map(aRow);
  }

  async guardiasActivos() {
    const rows = await getPrisma().usuario.findMany({
      where: { activo: true, deletedAt: null, rol: { clave: 'guardia' } },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        email: true,
        rostros: {
          where: { reemplazadoEn: null, estado: { not: 'rechazado' } },
          orderBy: { id: 'desc' },
          take: 1,
          select: { fotoClave: true },
        },
      },
    });
    return rows.map(({ rostros, ...g }) => ({ ...g, fotoClave: rostros[0]?.fotoClave ?? null }));
  }

  async findById(id: number) {
    const r = await getPrisma().eventoBitacora.findUnique({ where: { id }, select });
    return r && aRow(r);
  }

  async comentar(eventoId: number, autorId: number, texto: string) {
    await getPrisma().comentarioBitacora.create({ data: { eventoId, autorId, texto } });
  }

  async decidir(eventoId: number, porId: number, decision: DecisionFalta, en: Date, motivo?: string) {
    await getPrisma().eventoBitacora.update({
      where: { id: eventoId },
      data: { decision, decididoPorId: porId, decididoEn: en, decisionMotivo: motivo ?? null },
    });
  }

  async justificar(eventoId: number, porId: number, motivo: string, en: Date) {
    await getPrisma().eventoBitacora.update({
      where: { id: eventoId },
      data: { justificacion: motivo, justificadoPorId: porId, justificadoEn: en },
    });
  }
}
