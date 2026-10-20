import type { AlertaMarcacion, GuardiaResumen, TipoMarcacion } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { vigenteEn } from '../clientes/clientes.repository';

export interface MarcacionRow {
  id: number;
  idCliente: string;
  usuarioId: number;
  entradaId: number | null;
  tipo: TipoMarcacion;
  registradaEn: Date;
  sitio: { id: number; nombre: string } | null;
  lat: number;
  lng: number;
  precisionM: number;
  distanciaM: number | null;
  alertas: AlertaMarcacion[];
}

export interface NuevaMarcacion {
  idCliente: string;
  usuarioId: number;
  sitioId: number | null;
  entradaId: number | null;
  tipo: TipoMarcacion;
  lat: number;
  lng: number;
  precisionM: number;
  distanciaM: number | null;
  alertas: AlertaMarcacion[];
  ip?: string;
  userAgent?: string;
}

export interface MarcacionGuardiaRow extends MarcacionRow {
  usuario: GuardiaResumen;
}

/** Guardia con asignación vigente en un día (directa o por grupo) y su sitio. */
export interface GuardiaAsignado {
  guardia: GuardiaResumen;
  sitio: { id: number; nombre: string };
}

/** Marcas de asistencia. Solo inserta y consulta: no hay edición ni borrado (DA-08). */
export abstract class AsistenciaRepository {
  abstract findByIdCliente(idCliente: string): Promise<MarcacionRow | null>;
  /** Última entrada del usuario y las marcas de esa jornada, en orden. Vacío si nunca ha marcado. */
  abstract ultimaJornada(usuarioId: number): Promise<MarcacionRow[]>;
  /** Marcas de las jornadas cuya entrada cae en [desde, hasta). */
  abstract jornadasEntre(usuarioId: number, desde: Date, hasta: Date): Promise<MarcacionRow[]>;
  abstract coordenadasSitio(sitioId: number): Promise<{ lat: number; lng: number } | null>;
  abstract crear(data: NuevaMarcacion): Promise<MarcacionRow>;
  // ---- Vista de admin / supervisor (AS1-07) ----
  /** Jornadas de todos los guardias cuya entrada cae en [desde, hasta), con sus marcas. */
  abstract jornadasDeTodos(desde: Date, hasta: Date): Promise<MarcacionGuardiaRow[]>;
  /** Guardias activos con asignación vigente el día `AAAA-MM-DD` (sitio y cliente activos). */
  abstract guardiasAsignados(fecha: string): Promise<GuardiaAsignado[]>;
  abstract findGuardia(usuarioId: number): Promise<GuardiaResumen | null>;
}

const select = {
  id: true,
  idCliente: true,
  usuarioId: true,
  entradaId: true,
  tipo: true,
  registradaEn: true,
  lat: true,
  lng: true,
  precisionM: true,
  distanciaM: true,
  alertas: true,
  sitio: { select: { id: true, nombre: true } },
} as const;

type Row = {
  id: number;
  idCliente: string;
  usuarioId: number;
  entradaId: number | null;
  tipo: TipoMarcacion;
  registradaEn: Date;
  lat: unknown;
  lng: unknown;
  precisionM: number;
  distanciaM: number | null;
  alertas: unknown;
  sitio: { id: number; nombre: string } | null;
};

const toRow = ({ lat, lng, alertas, ...r }: Row): MarcacionRow => ({
  ...r,
  lat: Number(lat),
  lng: Number(lng),
  alertas: (Array.isArray(alertas) ? alertas : []) as AlertaMarcacion[],
});

export class PrismaAsistenciaRepository extends AsistenciaRepository {
  async findByIdCliente(idCliente: string) {
    const r = await getPrisma().marcacion.findUnique({ where: { idCliente }, select });
    return r && toRow(r);
  }

  async ultimaJornada(usuarioId: number) {
    const entrada = await getPrisma().marcacion.findFirst({
      where: { usuarioId, tipo: 'entrada' },
      orderBy: { registradaEn: 'desc' },
      select: { id: true },
    });
    if (!entrada) return [];
    const rows = await getPrisma().marcacion.findMany({
      where: { OR: [{ id: entrada.id }, { entradaId: entrada.id }] },
      orderBy: [{ registradaEn: 'asc' }, { id: 'asc' }],
      select,
    });
    return rows.map(toRow);
  }

  async jornadasEntre(usuarioId: number, desde: Date, hasta: Date) {
    const entradas = await getPrisma().marcacion.findMany({
      where: { usuarioId, tipo: 'entrada', registradaEn: { gte: desde, lt: hasta } },
      select: { id: true },
    });
    if (entradas.length === 0) return [];
    const ids = entradas.map((e) => e.id);
    const rows = await getPrisma().marcacion.findMany({
      where: { OR: [{ id: { in: ids } }, { entradaId: { in: ids } }] },
      orderBy: [{ registradaEn: 'asc' }, { id: 'asc' }],
      select,
    });
    return rows.map(toRow);
  }

  async coordenadasSitio(sitioId: number) {
    const s = await getPrisma().sitio.findUnique({
      where: { id: sitioId },
      select: { lat: true, lng: true },
    });
    return s?.lat != null && s.lng != null ? { lat: Number(s.lat), lng: Number(s.lng) } : null;
  }

  async crear(data: NuevaMarcacion) {
    const r = await getPrisma().marcacion.create({ data, select });
    return toRow(r);
  }

  async jornadasDeTodos(desde: Date, hasta: Date) {
    const entradas = await getPrisma().marcacion.findMany({
      where: { tipo: 'entrada', registradaEn: { gte: desde, lt: hasta } },
      select: { id: true },
    });
    if (entradas.length === 0) return [];
    const ids = entradas.map((e) => e.id);
    const rows = await getPrisma().marcacion.findMany({
      where: { OR: [{ id: { in: ids } }, { entradaId: { in: ids } }] },
      orderBy: [{ registradaEn: 'asc' }, { id: 'asc' }],
      select: { ...select, usuario: { select: { id: true, nombre: true, email: true } } },
    });
    return rows.map(({ usuario, ...r }) => ({ ...toRow(r), usuario }));
  }

  async guardiasAsignados(fecha: string) {
    const usuarioActivo = { activo: true, deletedAt: null };
    const guardia = { select: { id: true, nombre: true, email: true } } as const;
    const rows = await getPrisma().sitioGuardia.findMany({
      where: {
        AND: [
          vigenteEn(fecha),
          { sitio: { deletedAt: null, cliente: { deletedAt: null, estatus: 'activo' } } },
        ],
        OR: [{ usuario: usuarioActivo }, { grupo: { deletedAt: null } }],
      },
      orderBy: [{ sitio: { nombre: 'asc' } }, { grupoId: 'asc' }],
      select: {
        sitio: { select: { id: true, nombre: true } },
        usuario: { select: { ...guardia.select, activo: true, deletedAt: true } },
        grupo: {
          select: { integrantes: { where: { usuario: usuarioActivo }, select: { usuario: guardia } } },
        },
      },
    });
    // Un guardia aparece una vez (con su primer sitio), llegue directo o por grupo.
    const vistos = new Map<number, GuardiaAsignado>();
    for (const { sitio, usuario, grupo } of rows) {
      const directos = usuario && usuario.activo && !usuario.deletedAt ? [usuario] : [];
      const delGrupo = grupo?.integrantes.map((i) => i.usuario) ?? [];
      for (const { id, nombre, email } of [...directos, ...delGrupo]) {
        if (!vistos.has(id)) vistos.set(id, { guardia: { id, nombre, email }, sitio });
      }
    }
    return [...vistos.values()];
  }

  async findGuardia(usuarioId: number) {
    return getPrisma().usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, nombre: true, email: true },
    });
  }
}
