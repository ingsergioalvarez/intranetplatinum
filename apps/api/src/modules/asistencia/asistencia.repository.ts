import type {
  AlertaMarcacion,
  ConclusionIncidencia,
  EstadoRostro,
  GuardiaResumen,
  MotivoIncidencia,
  Rol,
  TipoAviso,
  TipoMarcacion,
} from '@platinum/shared';
import { ROLES, trabajaEl } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { dateAFecha, fechaADate, hoyISO } from '../../core';
import { asignadaA, vigenteEn } from '../clientes/clientes.repository';
import { turnoDeDb } from '../sitios/sitios.repository';
import { diasDeDb, diasSelect } from '../turnos/dias';

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
  fotoClave: string | null;
  rostroId: number | null;
  rostroDistancia: number | null;
  rostroIntentos: number | null;
  programadaEntrada: Date | null;
  programadaSalida: Date | null;
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
  fotoClave?: string | null;
  rostroId?: number | null;
  rostroDistancia?: number | null;
  rostroIntentos?: number | null;
  programadaEntrada?: Date | null;
  programadaSalida?: Date | null;
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
  /** Horario de la asignación (null en asignaciones sin horario). */
  horaInicio?: string | null;
  horas?: number | null;
  /** Cubre este sitio ese día (DA-39). */
  cobertura?: boolean;
}

/** Rostro de un guardia (el último no reemplazado; vigente si no está rechazado). */
export interface RostroRow {
  id: number;
  usuarioId: number;
  estado: EstadoRostro;
  autoregistro: boolean;
  descriptores: number[][];
  fotoClave: string;
  fotos: string[];
  createdAt: Date;
  registradoPor: string;
  revisadoPor: string | null;
  revisadoEn: Date | null;
  motivoRechazo: string | null;
}

export interface NuevoRostro {
  usuarioId: number;
  estado: EstadoRostro;
  autoregistro: boolean;
  descriptores: number[][];
  fotoClave: string;
  fotos: string[];
  registradoPorId: number;
  revisadoPorId?: number | null;
  revisadoEn?: Date | null;
}

export interface AvisoAsistencia {
  tipo: Extract<
    TipoAviso,
    | 'rostro_pendiente'
    | 'rostro_suplantacion'
    | 'rostro_duplicado'
    | 'rostro_pantalla'
    | 'rostro_reto'
    | 'rostro_aprobado'
    | 'rostro_rechazado'
    | 'cuenta_intento'
    | 'retardo'
    | 'marca_alerta'
  >;
  mensaje: string;
  ruta: string;
  /** Foto que se muestra en miniatura en la campanita. */
  fotoClave?: string | null;
}

/** Intento rechazado con su foto (DA-31). */
export interface IncidenciaRow {
  id: number;
  usuario: GuardiaResumen;
  motivo: MotivoIncidencia;
  tipoMarca: TipoMarcacion | null;
  fotoClave: string;
  /** Foto de referencia del rostro actual del guardia. */
  rostroRegistrado: string | null;
  rostroDe: { id: number; nombre: string } | null;
  sitio: { id: number; nombre: string } | null;
  createdAt: Date;
  revisadaPor: string | null;
  revisadaEn: Date | null;
  conclusion: ConclusionIncidencia | null;
  nota: string | null;
}

export interface NuevaIncidencia {
  usuarioId: number;
  motivo: MotivoIncidencia;
  tipoMarca: TipoMarcacion | null;
  fotoClave: string;
  rostroDeId: number | null;
  sitioId: number | null;
}

/** De quién es el aviso: el sitio (si lo hay) y el guardia. */
export interface DestinoRevision {
  sitioId: number | null;
  guardiaId: number;
}

export interface FiltroIncidencias {
  revisadas: boolean;
  conclusion?: ConclusionIncidencia;
  q?: string;
  guardiaId?: number;
  /** Solo estos guardias (supervisor: los de sus sitios, DA-45). */
  guardiaIds?: number[];
  skip: number;
  take: number;
}

/** Datos del usuario para validar el registro de su rostro. */
export interface UsuarioRostro {
  id: number;
  nombre: string;
  rol: Rol;
  activo: boolean;
  deletedAt: Date | null;
}

/** Marcas de asistencia. Solo inserta y consulta: no hay edición ni borrado (DA-08). */
export abstract class AsistenciaRepository {
  abstract findByIdCliente(idCliente: string): Promise<MarcacionRow | null>;
  /** Última entrada del usuario y las marcas de esa jornada, en orden. Vacío si nunca ha marcado. */
  abstract ultimaJornada(usuarioId: number): Promise<MarcacionRow[]>;
  /** Marcas de las jornadas cuya entrada cae en [desde, hasta). */
  abstract jornadasEntre(usuarioId: number, desde: Date, hasta: Date): Promise<MarcacionRow[]>;
  /** Coordenadas y radio de la geocerca; null si el sitio no tiene coordenadas. */
  abstract coordenadasSitio(sitioId: number): Promise<{ lat: number; lng: number; radioM: number } | null>;
  abstract nombreSitio(sitioId: number): Promise<string | null>;
  abstract crear(data: NuevaMarcacion): Promise<MarcacionRow>;
  // ---- Vista de admin / supervisor (AS1-07) ----
  /** Jornadas de todos los guardias cuya entrada cae en [desde, hasta), con sus marcas. */
  abstract jornadasDeTodos(desde: Date, hasta: Date): Promise<MarcacionGuardiaRow[]>;
  /** Guardias activos con asignación vigente el día `AAAA-MM-DD` (sitio y cliente activos). */
  abstract guardiasAsignados(fecha: string): Promise<GuardiaAsignado[]>;
  abstract findGuardia(usuarioId: number): Promise<GuardiaResumen | null>;
  // ---- Rostros (AS1-02) ----
  /** Último rostro no reemplazado del usuario (puede estar pendiente, aprobado o rechazado). */
  abstract rostroActual(usuarioId: number): Promise<RostroRow | null>;
  /**
   * Rostros vigentes (pendientes o aprobados) de los demás usuarios: para detectar una cara ya
   * registrada en otra cuenta y para saber si quien marca es otro guardia (1 a N).
   */
  abstract rostrosDeOtros(
    usuarioId: number,
  ): Promise<{ usuario: { id: number; nombre: string }; descriptores: number[][] }[]>;
  abstract findUsuarioRostro(usuarioId: number): Promise<UsuarioRostro | null>;
  /**
   * Borra definitivamente los rostros del usuario (vigente e historial). Devuelve las claves de
   * sus fotos para borrarlas del almacenamiento. Las fotos de marcas no se tocan.
   */
  abstract eliminarRostros(usuarioId: number): Promise<string[]>;
  /** Guarda el rostro nuevo y marca el anterior como reemplazado (una transacción). */
  abstract guardarRostro(data: NuevoRostro): Promise<RostroRow>;
  /** Aprueba o rechaza un rostro pendiente. */
  abstract revisarRostro(
    rostroId: number,
    data: { estado: 'aprobado' | 'rechazado'; revisadoPorId: number; motivoRechazo: string | null },
  ): Promise<RostroRow>;
  /** Rostros pendientes de revisión (los más antiguos primero), con su guardia. */
  abstract rostrosPendientes(): Promise<{ guardia: GuardiaResumen; rostro: RostroRow }[]>;
  // ---- Avisos en la campanita ----
  /** Usuarios activos que revisan rostros: admin y roles con el permiso `asistencia.rostros`. */
  /**
   * A quién avisar de algo de un guardia (DA-45): al supervisor del sitio; sin sitio, a los
   * supervisores de sus sitios de hoy; si no hay supervisor, a los admin.
   */
  abstract revisoresDe(destino: DestinoRevision): Promise<number[]>;
  abstract avisar(usuarioIds: number[], aviso: AvisoAsistencia): Promise<void>;
  // ---- Incidencias de rostro (DA-31) ----
  /** Devuelve el id de la incidencia creada. */
  abstract crearIncidencia(data: NuevaIncidencia): Promise<number>;
  /** Más recientes primero. */
  abstract incidencias(filtro: FiltroIncidencias): Promise<{ items: IncidenciaRow[]; total: number }>;
  abstract findIncidencia(id: number): Promise<IncidenciaRow | null>;
  abstract revisarIncidencia(
    id: number,
    data: { revisadaPorId: number; conclusion: ConclusionIncidencia; nota: string | null },
  ): Promise<IncidenciaRow>;
  /** Estado actual de los rostros con los que se marcó (para las alertas de "pendiente", AS1-14). */
  abstract estadosRostros(ids: number[]): Promise<Map<number, EstadoRostroActual>>;
}

export interface EstadoRostroActual {
  estado: EstadoRostro;
  revisadoEn: Date | null;
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
  fotoClave: true,
  rostroId: true,
  rostroDistancia: true,
  rostroIntentos: true,
  programadaEntrada: true,
  programadaSalida: true,
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
  fotoClave: string | null;
  rostroId: number | null;
  rostroDistancia: number | null;
  rostroIntentos: number | null;
  programadaEntrada: Date | null;
  programadaSalida: Date | null;
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
      select: { lat: true, lng: true, radioM: true },
    });
    return s?.lat != null && s.lng != null
      ? { lat: Number(s.lat), lng: Number(s.lng), radioM: s.radioM }
      : null;
  }

  async nombreSitio(sitioId: number) {
    return (
      (await getPrisma().sitio.findUnique({ where: { id: sitioId }, select: { nombre: true } }))?.nombre ??
      null
    );
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
        tipo: true,
        turno: true,
        horas: true,
        horaInicio: true,
        horaFin: true,
        desde: true,
        hasta: true,
        ...diasSelect,
        sitio: { select: { id: true, nombre: true } },
        usuario: { select: { ...guardia.select, activo: true, deletedAt: true } },
        grupo: {
          select: { integrantes: { where: { usuario: usuarioActivo }, select: { usuario: guardia } } },
        },
      },
    });
    // Quien cubre otro sitio ese día aparece ahí; su sitio propio queda en pausa (DA-39).
    const coberturas = await getPrisma().cobertura.findMany({
      where: {
        canceladaEn: null,
        desde: { lte: fechaADate(fecha) },
        hasta: { gte: fechaADate(fecha) },
        usuario: usuarioActivo,
      },
      select: {
        horaInicio: true,
        horas: true,
        sitio: { select: { id: true, nombre: true } },
        usuario: guardia,
      },
    });
    const cubren = new Set(coberturas.map((c) => c.usuario.id));
    // Un guardia aparece una vez (con su primer sitio), llegue directo o por grupo, y solo si ese día
    // le toca trabajar según su horario (DA-45).
    const vistos = new Map<number, GuardiaAsignado>();
    for (const c of coberturas) {
      vistos.set(c.usuario.id, {
        guardia: c.usuario,
        sitio: c.sitio,
        horaInicio: c.horaInicio,
        horas: c.horas,
        cobertura: true,
      });
    }
    for (const r of rows) {
      const { sitio, usuario, grupo, horaInicio } = r;
      const patron = {
        tipo: r.tipo,
        turno: turnoDeDb(r.turno),
        horas: r.horas,
        dias: diasDeDb(r),
        horaInicio,
        horaFin: r.horaFin,
        desde: dateAFecha(r.desde),
        hasta: r.hasta && dateAFecha(r.hasta),
      };
      if (!trabajaEl(fecha, patron)) continue;
      const directos = usuario && usuario.activo && !usuario.deletedAt ? [usuario] : [];
      const delGrupo = grupo?.integrantes.map((i) => i.usuario) ?? [];
      for (const { id, nombre, email } of [...directos, ...delGrupo]) {
        if (!vistos.has(id) && !cubren.has(id)) {
          vistos.set(id, { guardia: { id, nombre, email }, sitio, horaInicio, horas: r.horas });
        }
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

  async rostroActual(usuarioId: number) {
    const r = await getPrisma().rostroGuardia.findFirst({
      where: { usuarioId, reemplazadoEn: null },
      orderBy: { id: 'desc' },
      select: rostroSelect,
    });
    return r && toRostro(r);
  }

  async rostrosDeOtros(usuarioId: number) {
    const rows = await getPrisma().rostroGuardia.findMany({
      where: {
        reemplazadoEn: null,
        estado: { in: ['pendiente', 'aprobado'] },
        usuarioId: { not: usuarioId },
        usuario: { deletedAt: null },
      },
      select: { descriptores: true, usuario: { select: { id: true, nombre: true } } },
    });
    return rows.map((r) => ({ usuario: r.usuario, descriptores: r.descriptores as number[][] }));
  }

  async findUsuarioRostro(usuarioId: number) {
    const u = await getPrisma().usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, nombre: true, activo: true, deletedAt: true, rol: { select: { clave: true } } },
    });
    return u && { ...u, rol: u.rol.clave as Rol };
  }

  async eliminarRostros(usuarioId: number) {
    const rostros = await getPrisma().rostroGuardia.findMany({
      where: { usuarioId },
      select: { fotoClave: true, fotos: true },
    });
    await getPrisma().rostroGuardia.deleteMany({ where: { usuarioId } });
    return [...new Set(rostros.flatMap((r) => [r.fotoClave, ...fotosDe(r.fotos)]))];
  }

  async guardarRostro(data: NuevoRostro) {
    const [, r] = await getPrisma().$transaction([
      getPrisma().rostroGuardia.updateMany({
        where: { usuarioId: data.usuarioId, reemplazadoEn: null },
        data: { reemplazadoEn: new Date() },
      }),
      getPrisma().rostroGuardia.create({ data, select: rostroSelect }),
    ]);
    return toRostro(r);
  }

  async revisarRostro(
    rostroId: number,
    data: { estado: 'aprobado' | 'rechazado'; revisadoPorId: number; motivoRechazo: string | null },
  ) {
    const r = await getPrisma().rostroGuardia.update({
      where: { id: rostroId },
      data: { ...data, revisadoEn: new Date() },
      select: rostroSelect,
    });
    return toRostro(r);
  }

  async rostrosPendientes() {
    const rows = await getPrisma().rostroGuardia.findMany({
      where: { estado: 'pendiente', reemplazadoEn: null, usuario: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: { ...rostroSelect, usuario: { select: { id: true, nombre: true, email: true } } },
    });
    return rows.map(({ usuario, ...r }) => ({ guardia: usuario, rostro: toRostro(r) }));
  }

  async revisoresDe({ sitioId, guardiaId }: DestinoRevision) {
    const db = getPrisma();
    const activo = { activo: true, deletedAt: null };
    const supervisores = sitioId
      ? await db.sitio.findMany({
          where: { id: sitioId, supervisor: activo },
          select: { supervisorId: true },
        })
      : (
          await db.sitioGuardia.findMany({
            where: { ...asignadaA(guardiaId, hoyISO()), sitio: { supervisor: activo } },
            select: { sitio: { select: { supervisorId: true } } },
          })
        ).map((a) => a.sitio);
    const ids = [...new Set(supervisores.map((s) => s.supervisorId!))];
    if (ids.length) return ids;
    const admins = await db.usuario.findMany({
      where: { ...activo, rol: { clave: ROLES.ADMIN } },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }

  async avisar(usuarioIds: number[], { tipo, mensaje, ruta, fotoClave = null }: AvisoAsistencia) {
    if (usuarioIds.length === 0) return;
    await getPrisma().aviso.createMany({
      data: usuarioIds.map((usuarioId) => ({
        usuarioId,
        tipo,
        mensaje: mensaje.slice(0, 255),
        ruta,
        fotoClave,
      })),
    });
  }

  async estadosRostros(ids: number[]) {
    if (ids.length === 0) return new Map<number, EstadoRostroActual>();
    const rows = await getPrisma().rostroGuardia.findMany({
      where: { id: { in: ids } },
      select: { id: true, estado: true, revisadoEn: true },
    });
    return new Map(rows.map((r) => [r.id, { estado: r.estado, revisadoEn: r.revisadoEn }]));
  }

  async crearIncidencia(data: NuevaIncidencia) {
    const { id } = await getPrisma().incidenciaRostro.create({ data, select: { id: true } });
    return id;
  }

  async incidencias({ revisadas, conclusion, q, guardiaId, guardiaIds, skip, take }: FiltroIncidencias) {
    const where = {
      revisadaEn: revisadas ? { not: null } : null,
      ...(revisadas && conclusion && { conclusion }),
      ...(guardiaIds && { usuarioId: { in: guardiaIds } }),
      ...(guardiaId && { usuarioId: guardiaId }),
      ...(q && {
        OR: [
          { usuario: { nombre: { contains: q } } },
          { usuario: { email: { contains: q } } },
          { sitio: { nombre: { contains: q } } },
        ],
      }),
    };
    const [rows, total] = await Promise.all([
      getPrisma().incidenciaRostro.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: incidenciaSelect,
      }),
      getPrisma().incidenciaRostro.count({ where }),
    ]);
    return { items: rows.map(toIncidencia), total };
  }

  async findIncidencia(id: number) {
    const r = await getPrisma().incidenciaRostro.findUnique({ where: { id }, select: incidenciaSelect });
    return r && toIncidencia(r);
  }

  async revisarIncidencia(
    id: number,
    data: { revisadaPorId: number; conclusion: ConclusionIncidencia; nota: string | null },
  ) {
    const r = await getPrisma().incidenciaRostro.update({
      where: { id },
      data: { ...data, revisadaEn: new Date() },
      select: incidenciaSelect,
    });
    return toIncidencia(r);
  }
}

const incidenciaSelect = {
  id: true,
  motivo: true,
  tipoMarca: true,
  fotoClave: true,
  createdAt: true,
  revisadaEn: true,
  conclusion: true,
  nota: true,
  usuario: {
    select: {
      id: true,
      nombre: true,
      email: true,
      rostros: {
        where: { reemplazadoEn: null },
        orderBy: { id: 'desc' },
        take: 1,
        select: { fotoClave: true },
      },
    },
  },
  rostroDe: { select: { id: true, nombre: true } },
  sitio: { select: { id: true, nombre: true } },
  revisadaPor: { select: { nombre: true } },
} as const;

function toIncidencia({
  usuario: { rostros, ...usuario },
  revisadaPor,
  ...r
}: {
  id: number;
  motivo: MotivoIncidencia;
  tipoMarca: TipoMarcacion | null;
  fotoClave: string;
  createdAt: Date;
  revisadaEn: Date | null;
  conclusion: ConclusionIncidencia | null;
  nota: string | null;
  usuario: GuardiaResumen & { rostros: { fotoClave: string }[] };
  rostroDe: { id: number; nombre: string } | null;
  sitio: { id: number; nombre: string } | null;
  revisadaPor: { nombre: string } | null;
}): IncidenciaRow {
  return {
    ...r,
    usuario,
    rostroRegistrado: rostros[0]?.fotoClave ?? null,
    revisadaPor: revisadaPor?.nombre ?? null,
  };
}

const fotosDe = (fotos: unknown) => (Array.isArray(fotos) ? (fotos as string[]) : []);

const rostroSelect = {
  id: true,
  usuarioId: true,
  estado: true,
  autoregistro: true,
  descriptores: true,
  fotoClave: true,
  fotos: true,
  createdAt: true,
  revisadoEn: true,
  motivoRechazo: true,
  registradoPor: { select: { nombre: true } },
  revisadoPor: { select: { nombre: true } },
} as const;

const toRostro = (r: {
  id: number;
  usuarioId: number;
  estado: EstadoRostro;
  autoregistro: boolean;
  descriptores: unknown;
  fotoClave: string;
  fotos: unknown;
  createdAt: Date;
  revisadoEn: Date | null;
  motivoRechazo: string | null;
  registradoPor: { nombre: string } | null;
  revisadoPor: { nombre: string } | null;
}): RostroRow => ({
  ...r,
  descriptores: r.descriptores as number[][],
  // Registros anteriores al autoregistro solo guardaban la foto de referencia.
  fotos: fotosDe(r.fotos).length ? fotosDe(r.fotos) : [r.fotoClave],
  registradoPor: r.registradoPor?.nombre ?? 'Usuario eliminado',
  revisadoPor: r.revisadoPor?.nombre ?? null,
});
