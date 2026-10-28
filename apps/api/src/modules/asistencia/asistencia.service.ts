import { randomUUID } from 'node:crypto';
import {
  AVISO_RETARDO_MIN,
  PATRON_SALIDA_MIN,
  PATRON_SEGUIDOS,
  SALIDA_ANTICIPADA_MIN,
  HORAS_TURNO,
  JORNADA_MAX_HORAS,
  RADIO_GEOCERCA_M,
  TOLERANCIA_RETARDO_MIN,
  DESFASE_RELOJ_MAX_SEG,
  HORAS_MAX_SIN_CONEXION,
  esTurnoJornada,
  horaLegible,
  ROLES,
  SIGUIENTES_MARCAS,
  TIPO_MARCACION_LABEL,
  TIPOS_CON_FOTO,
  UMBRAL_NO_TITULAR,
  UMBRAL_ROSTRO,
  distanciaMetros,
  distanciaRostro,
  sitioMasCercano,
  type AlertaMarcacion,
  type EstadoAsistencia,
  type Jornada,
  type Marcacion,
  type AsistenciaDiaQuery,
  type AsistenciaGuardia,
  type FilaAsistencia,
  type ConclusionIncidencia,
  type IncidenciaCreateInput,
  type IncidenciaRostro,
  type IncidenciasQuery,
  type MotivoIncidencia,
  type MarcacionCreateData,
  type ResultadoVerificacion,
  type RostroRegistro,
  type RostroRegistroInput,
  type MiRostro,
  type RostroPendiente,
  type Paginated,
  type MiSitio,
  type SitioMarcable,
  type TipoMarcacion,
  type EstadoTurno,
  trabajaEl,
  type TurnoDelGuardia,
  comidasDelTurno,
  type CerrarJornadaInput,
  COMIDA_MIN,
  type TableroAsistencia,
  type TableroItem,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseService,
  HttpError,
  StorageService,
  detectarImagen,
  firmarArchivo,
  hoyISO,
  inicioDelDia,
  type AccionCtx,
  type RequestContext,
} from '../../core';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import { sinHorasExtra, type HorasExtraPuerto } from '../horas-extra/puerto';
import { exigirGuardia, guardiaEnAlcance, type Alcance } from '../sitios/alcance';
import { horaLocal } from './formato';
import { MIN_FALTA, MIN_NO_SE_PRESENTO } from './vigilancia';
import type {
  AsistenciaRepository,
  AvisoAsistencia,
  DestinoRevision,
  EstadoRostroActual,
  IncidenciaRow,
  MarcacionGuardiaRow,
  MarcacionRow,
  RostroRow,
} from './asistencia.repository';

/** Archivo recibido por multer (en memoria). */
export interface ArchivoSubido {
  buffer: Buffer;
  size: number;
}

/** Fotos del mismo registro más separadas que esto no parecen de la misma persona. */
const UMBRAL_MISMA_PERSONA = 0.6;

const errorFoto = (message: string, path = 'foto') =>
  HttpError.badRequest('Datos inválidos', [{ path, message }]);

/** Una incidencia reportada por la cámara por guardia y motivo como máximo en este tiempo. */
const INCIDENCIA_CADA_MS = 2 * 60_000;

/** Tipo de aviso de la campanita para cada motivo de incidencia. */
const AVISO_DE: Record<MotivoIncidencia, AvisoAsistencia['tipo']> = {
  pantalla: 'rostro_pantalla',
  rostro_de_otro: 'rostro_suplantacion',
  no_titular: 'rostro_suplantacion',
  reto_fallido: 'rostro_reto',
  registro_duplicado: 'rostro_duplicado',
};

const toIncidencia = ({
  usuario,
  fotoClave,
  rostroRegistrado,
  createdAt,
  revisadaEn,
  ...r
}: IncidenciaRow): IncidenciaRostro => ({
  ...r,
  guardia: usuario,
  foto: firmarArchivo(fotoClave),
  rostroRegistrado: rostroRegistrado && firmarArchivo(rostroRegistrado),
  creadaEn: createdAt.toISOString(),
  revisadaEn: revisadaEn?.toISOString() ?? null,
});

/** Otro guardia cuya cara se parece a la recibida. */
type OtroRostro = { usuario: { id: number; nombre: string }; distancia: number };

/** Ruta de la pantalla donde se revisan los rostros pendientes. */
const RUTA_REVISION = '/asistencia/rostros';

/** Menor distancia entre un vector y cualquiera de los registrados. */
const menorDistancia = (descriptor: number[], registrados: number[][]) =>
  Math.min(...registrados.map((r) => distanciaRostro(descriptor, r)));

const toRostroRegistro = (r: RostroRow): RostroRegistro => ({
  id: r.id,
  estado: r.estado,
  autoregistro: r.autoregistro,
  fotoUrl: firmarArchivo(r.fotoClave),
  fotos: r.fotos.map((f) => firmarArchivo(f)),
  registradoEn: r.createdAt.toISOString(),
  registradoPor: r.registradoPor,
  muestras: r.descriptores.length,
  revisadoPor: r.revisadoPor,
  revisadoEn: r.revisadoEn?.toISOString() ?? null,
  motivoRechazo: r.motivoRechazo,
});

/** Un rostro sirve para comparar si está pendiente o aprobado (no si se rechazó). */
const vigente = (r: RostroRow | null) => (r && r.estado !== 'rechazado' ? r : null);

/** Sitios asignados hoy al guardia (los provee el módulo de sitios). */
export type MisSitiosFn = (usuarioId: number, hoy: string) => Promise<MiSitio[]>;

type EstadosRostros = Map<number, EstadoRostroActual>;

/**
 * La alerta "rostro pendiente" se guardó al marcar; se muestra según el estado actual del rostro
 * (AS1-14): si ya se aprobó deja de ser alerta, si se rechazó pasa a "rostro rechazado".
 */
function alertasActuales({ alertas, rostroId }: MarcacionRow, estados: EstadosRostros) {
  const e = rostroId !== null ? estados.get(rostroId) : undefined;
  if (!alertas.includes('rostro_pendiente') || !e || e.estado === 'pendiente') {
    return { alertas, rostroAprobadoEn: null };
  }
  const sinPendiente = alertas.filter((a) => a !== 'rostro_pendiente');
  return e.estado === 'aprobado'
    ? { alertas: sinPendiente, rostroAprobadoEn: e.revisadoEn?.toISOString() ?? null }
    : { alertas: [...sinPendiente, 'rostro_rechazado' as const], rostroAprobadoEn: null };
}

const toMarcacion = (r: MarcacionRow, estados: EstadosRostros = new Map()): Marcacion => ({
  id: r.id,
  tipo: r.tipo,
  registradaEn: r.registradaEn.toISOString(),
  sitio: r.sitio,
  lat: r.lat,
  lng: r.lng,
  precisionM: r.precisionM,
  distanciaM: r.distanciaM,
  ...alertasActuales(r, estados),
  foto: r.fotoClave ? firmarArchivo(r.fotoClave) : null,
  rostro: r.rostroIntentos !== null ? { distancia: r.rostroDistancia, intentos: r.rostroIntentos } : null,
});

const minutosEntre = (desde: Date, hasta: Date) => Math.round((hasta.getTime() - desde.getTime()) / 60_000);

/** Agrupa marcas (en orden) por su entrada. Las jornadas salen de la más reciente a la más antigua. */
export function armarJornadas(rows: MarcacionRow[], estados: EstadosRostros = new Map()): Jornada[] {
  const porEntrada = new Map<number, { jornada: Jornada; entrada: MarcacionRow }>();
  for (const r of rows) {
    const m = toMarcacion(r, estados);
    if (r.tipo === 'entrada') {
      const programada =
        r.programadaEntrada && r.programadaSalida
          ? { entrada: r.programadaEntrada.toISOString(), salida: r.programadaSalida.toISOString() }
          : null;
      porEntrada.set(r.id, {
        entrada: r,
        jornada: {
          entrada: m,
          inicioComida: null,
          finComida: null,
          comidas: [],
          comidasPermitidas: comidasDelTurno(
            programada ? (Date.parse(programada.salida) - Date.parse(programada.entrada)) / 3_600_000 : null,
          ),
          salida: null,
          sitio: r.sitio,
          alertas: [...m.alertas],
          programada,
          retardoMin: r.programadaEntrada
            ? m.alertas.includes('viene_de_horas_extra')
              ? 0
              : minutosEntre(r.programadaEntrada, r.registradaEn)
            : null,
          salidaAnticipadaMin: null,
        },
      });
      continue;
    }
    const e = r.entradaId !== null ? porEntrada.get(r.entradaId) : undefined;
    if (!e) continue;
    const j = e.jornada;
    if (r.tipo === 'inicio_comida') {
      j.comidas.push({ inicio: m, fin: null });
      j.inicioComida ??= m;
    }
    if (r.tipo === 'fin_comida') {
      const abierta = j.comidas.at(-1);
      if (abierta && !abierta.fin) abierta.fin = m;
      if (j.comidas.length === 1) j.finComida = m;
    }
    if (r.tipo === 'salida') {
      j.salida = m;
      if (e.entrada.programadaSalida)
        j.salidaAnticipadaMin = minutosEntre(r.registradaEn, e.entrada.programadaSalida);
    }
    for (const a of m.alertas) if (!j.alertas.includes(a)) j.alertas.push(a);
  }
  return [...porEntrada.values()]
    .map((e) => e.jornada)
    .sort((a, b) => b.entrada.registradaEn.localeCompare(a.entrada.registradaEn));
}

/** `AAAA-MM-DD` desplazado `n` días. */
function sumarDias(fecha: string, n: number) {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Horas que dura el turno de la asignación (las del catálogo, 24/12 h en las anteriores, o de inicio a fin en eventos). */
function horasTurno(s: SitioMarcable): number | null {
  if (s.horas) return s.horas;
  if (esTurnoJornada(s.turno)) return HORAS_TURNO[s.turno];
  if (!s.horaInicio || !s.horaFin) return null;
  const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  return ((min(s.horaFin) - min(s.horaInicio) + 1440) % 1440 || 1440) / 60;
}

/**
 * Entrada y salida programadas del turno que corresponde a una marca de entrada (DA-32): la hora
 * de entrada de la asignación más cercana a `ahora` (ayer, hoy o mañana, en la zona del negocio).
 */
export function programarTurno(
  s: SitioMarcable,
  ahora: Date,
): { entrada: Date; salida: Date; hora: string } | null {
  const horas = horasTurno(s);
  if (!s.horaInicio || !horas) return null;
  const minutos = Number(s.horaInicio.slice(0, 2)) * 60 + Number(s.horaInicio.slice(3, 5));
  const hoy = hoyISO(undefined, ahora);
  let entrada: Date | null = null;
  for (const d of [-1, 0, 1]) {
    const t = new Date(inicioDelDia(sumarDias(hoy, d)).getTime() + minutos * 60_000);
    if (!entrada || Math.abs(t.getTime() - ahora.getTime()) < Math.abs(entrada.getTime() - ahora.getTime())) {
      entrada = t;
    }
  }
  return {
    entrada: entrada!,
    salida: new Date(entrada!.getTime() + horas * 3_600_000),
    hora: s.horaInicio,
  };
}

/**
 * En qué va un turno sin entrada (DA-45): antes de su hora, en tolerancia, no se presentó (15 min) o
 * falta (2 h).
 */
function estadoDelTurno(
  fecha: string,
  horaInicio: string,
  ahora: Date,
): { entrada: string; estado: EstadoTurno } {
  const entrada = new Date(
    inicioDelDia(fecha).getTime() +
      (Number(horaInicio.slice(0, 2)) * 60 + Number(horaInicio.slice(3, 5))) * 60_000,
  );
  const min = (ahora.getTime() - entrada.getTime()) / 60_000;
  const estado: EstadoTurno =
    min < 0
      ? 'por_entrar'
      : min < MIN_NO_SE_PRESENTO
        ? 'por_llegar'
        : min < MIN_FALTA
          ? 'no_se_presento'
          : 'falta';
  return { entrada: entrada.toISOString(), estado };
}

/** La ventana "Tu turno empieza" sale desde 30 min antes de la entrada (DA-40). */
const ANTES_DEL_TURNO_MS = 30 * 60_000;

/**
 * Turno en curso (o que empieza en 30 min) y siguiente turno del guardia (DA-40), según el horario
 * de sus asignaciones (o su cobertura) desde ayer hasta 14 días.
 */
function turnosDelGuardia(sitios: SitioMarcable[], ahora: Date) {
  const hoy = hoyISO(undefined, ahora);
  const turnos: TurnoDelGuardia[] = [];
  for (const s of sitios) {
    const horas = horasTurno(s);
    if (!s.horaInicio || !horas) continue;
    const minutos = Number(s.horaInicio.slice(0, 2)) * 60 + Number(s.horaInicio.slice(3, 5));
    for (let d = -1; d <= 14; d++) {
      const fecha = sumarDias(hoy, d);
      const patron = {
        tipo: s.tipo ?? ('fija' as const),
        turno: s.turno,
        horas,
        dias: s.dias ?? null,
        horaInicio: s.horaInicio,
        horaFin: s.horaFin ?? null,
        desde: s.desde ?? fecha,
        hasta: s.hasta ?? null,
      };
      if (!trabajaEl(fecha, patron) || s.pausas?.includes(fecha)) continue;
      const entrada = new Date(inicioDelDia(fecha).getTime() + minutos * 60_000);
      turnos.push({
        sitio: { id: s.id, nombre: s.nombre, lat: s.lat, lng: s.lng, radioM: s.radioM ?? null },
        entrada: entrada.toISOString(),
        salida: new Date(entrada.getTime() + horas * 3_600_000).toISOString(),
        cobertura: s.cobertura ?? null,
      });
    }
  }
  turnos.sort((a, b) => a.entrada.localeCompare(b.entrada));
  const t = ahora.getTime();
  const actual =
    turnos.find((x) => Date.parse(x.entrada) - ANTES_DEL_TURNO_MS <= t && t < Date.parse(x.salida)) ?? null;
  const proximo = actual ? null : (turnos.find((x) => Date.parse(x.entrada) > t) ?? null);
  return { actual, proximo };
}

/** Una entrada hasta 3 h antes o después de la hora del turno cuenta como "le toca" (TC-11). */
const MARGEN_TURNO_MS = 3 * 3_600_000;

/** ¿Le toca el turno de ese sitio cerca de esta hora (y ese día según sus días de trabajo)? */
function leTocaAhora(s: SitioMarcable, ahora: Date) {
  const p = programarTurno(s, ahora);
  if (!p || Math.abs(ahora.getTime() - p.entrada.getTime()) > MARGEN_TURNO_MS) return false;
  if (s.pausas?.includes(hoyISO(undefined, p.entrada))) return false;
  if (!s.desde || !s.tipo) return true;
  return trabajaEl(hoyISO(undefined, p.entrada), {
    tipo: s.tipo,
    turno: s.turno,
    horas: s.horas ?? null,
    dias: s.dias ?? null,
    horaInicio: s.horaInicio ?? null,
    horaFin: s.horaFin ?? null,
    desde: s.desde,
    hasta: s.hasta ?? null,
  });
}

/** Sitio de la entrada: entre los que le tocan a esta hora el más cercano; si ninguno, el más cercano. */
function sitioDeLaEntrada(sitios: SitioMarcable[], punto: { lat: number; lng: number }, ahora: Date) {
  const tocan = sitios.filter((s) => leTocaAhora(s, ahora));
  return sitioMasCercano(tocan.length ? tocan : sitios, punto);
}

/** Una jornada cuenta como "sin salida" en el tablero 30 min después de su salida programada. */
const TABLERO_SALIDA_TOLERANCIA_MIN = 30;

/** `85 m`, `2.3 km` */
const distanciaTexto = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

/** `25 min`, `1 h 05 min` */
const duracionTexto = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

const fueraDeOrden = (tipo: TipoMarcacion, permitidas: TipoMarcacion[]) => {
  const mensaje =
    tipo === 'entrada'
      ? 'Ya tienes una entrada registrada. Registra tu salida primero.'
      : permitidas.includes('entrada')
        ? 'Primero registra tu entrada.'
        : tipo === 'fin_comida'
          ? 'Primero registra el inicio de tu comida.'
          : tipo === 'salida' && (permitidas.includes('inicio_comida') || permitidas.includes('fin_comida'))
            ? 'Debes registrar tus horas de comida antes de checar tu salida.'
            : 'Esta marca ya no se puede registrar en tu jornada actual.';
  return new HttpError(409, 'MARCA_FUERA_DE_ORDEN', mensaje);
};

/** Control de asistencia (A-17): marcas del guardia, rostros y consulta de admin/supervisor. */
/** Al checar entrada (DA-45): se liga a sus turnos sin entrada. */
export type LlegadaFn = (
  usuarioId: number,
  guardia: string,
  entrada: { id: number; registradaEn: Date },
) => Promise<void>;

export class AsistenciaService extends BaseService {
  constructor(
    private readonly repo: AsistenciaRepository,
    private readonly misSitios: MisSitiosFn,
    private readonly storage: StorageService,
    private readonly audit: AuditLogger,
    private readonly ahora: () => Date = () => new Date(),
    private readonly hoy: () => string = () => hoyISO(),
    private readonly bitacora: RegistrarBitacora = sinBitacora,
    /** Liga la entrada a un turno sin entrada (falta con llegada tarde, DA-45). */
    private readonly alLlegar: LlegadaFn = async () => undefined,
    /** Horas extra (AS5): pregunta al guardia, salida final y registro al salir. */
    private readonly extras: HorasExtraPuerto = sinHorasExtra,
  ) {
    super();
  }

  async estado(usuarioId: number): Promise<EstadoAsistencia> {
    const [rows, sitios, rostro] = await Promise.all([
      this.repo.ultimaJornada(usuarioId),
      this.sitiosMarcables(usuarioId),
      this.repo.rostroActual(usuarioId),
    ]);
    const miRostro: MiRostro = {
      estado: rostro?.estado ?? 'sin_registro',
      motivoRechazo: rostro?.estado === 'rechazado' ? rostro.motivoRechazo : null,
    };
    const { actual, proximo } = turnosDelGuardia(sitios, this.ahora());
    const vigente = rows.length > 0 && this.reciente(rows[0]);
    return {
      // La última jornada se muestra mientras siga dentro del límite de horas (resumen "Hoy").
      jornada: vigente ? (await this.jornadas(rows))[0] : null,
      permitidas: await this.permitidasAhora(rows),
      horaExtra: vigente ? await this.extras.paraGuardia(rows[0], rows.find((m) => m.tipo === 'salida') ?? null) : null,
      plan: vigente ? await this.extras.plan(rows[0].id) : null,
      sitios,
      rostro: miRostro,
      turnoActual: actual,
      proximoTurno: proximo,
    };
  }

  /**
   * Registra una marca. Entrada y salida llevan foto con reconocimiento facial (AS1-08). La cámara
   * ya verificó al titular en vivo (DA-28); aquí se vuelve a comprobar:
   * - Si el rostro corresponde a OTRO guardia registrado se bloquea al instante, se guarda la foto
   *   del intento, se avisa a los revisores y queda en auditoría.
   * - Si no coincide con el titular se rechaza siempre (ya no se registra con alerta).
   * - Sin rostro registrado o con rostro pendiente de aprobación se registra con alerta.
   */
  async marcar(
    usuarioId: number,
    data: MarcacionCreateData,
    foto: ArchivoSubido | undefined,
    ctx: RequestContext,
  ): Promise<Marcacion> {
    // Reenvío de la misma marca (doble toque o reintento): se devuelve la ya registrada.
    const previa = await this.repo.findByIdCliente(data.idCliente);
    if (previa) {
      if (previa.usuarioId !== usuarioId) throw HttpError.conflict('Identificador de marca repetido');
      return toMarcacion(previa);
    }

    const jornada = await this.repo.ultimaJornada(usuarioId);
    const permitidas = await this.permitidasAhora(jornada);
    if (!permitidas.includes(data.tipo)) throw fueraDeOrden(data.tipo, permitidas);

    const punto = { lat: data.lat, lng: data.lng };
    // Marca hecha sin conexión (AS2-02): la hora es la estimada por el celular (reloj corregido con la
    // última hora del servidor), nunca en el futuro. El resto de la marca se valida igual, pero lo que
    // ya no se puede corregir (está lejos, rostro dudoso) queda como alerta en vez de rechazarse.
    const recibida = this.ahora();
    const sinConexion = !!data.capturadaEn;
    const capturada = data.capturadaEn ? new Date(data.capturadaEn) : null;
    const ahora = capturada && capturada.getTime() < recibida.getTime() ? capturada : recibida;
    const alertasDeHora: AlertaMarcacion[] = [];
    if (sinConexion) alertasDeHora.push('enviada_sin_conexion');
    let desfaseSeg: number | null = null;
    if (data.horaCelular) {
      desfaseSeg = Math.round((Date.parse(data.horaCelular) - ahora.getTime()) / 1000);
      if (Math.abs(desfaseSeg) > DESFASE_RELOJ_MAX_SEG) alertasDeHora.push('hora_desfasada');
    }
    if (sinConexion && recibida.getTime() - ahora.getTime() > HORAS_MAX_SIN_CONEXION * 3_600_000) {
      if (!alertasDeHora.includes('hora_desfasada')) alertasDeHora.push('hora_desfasada');
    }
    let sitio: { id: number; nombre?: string } | null;
    let distanciaM: number | null;
    let radio: number;
    let programada: { entrada: Date; salida: Date; hora: string } | null = null;
    if (data.tipo === 'entrada') {
      // La entrada fija el sitio de la jornada: el del turno que le toca a esta hora; si no hay o hay
      // varios, el más cercano entre ellos (DA-01, AS1-04, TC-11).
      const cercano = sitioDeLaEntrada(await this.sitiosMarcables(usuarioId), punto, ahora);
      if (!cercano) {
        throw new HttpError(409, 'SIN_SITIO', 'No tienes un sitio asignado hoy. Avisa a tu supervisor.');
      }
      sitio = cercano.sitio;
      distanciaM = cercano.distanciaM;
      radio = cercano.sitio.radioM ?? RADIO_GEOCERCA_M;
      // Copia del horario de la asignación (DA-32).
      programada = programarTurno(cercano.sitio, ahora);
    } else {
      // Comida y salida se miden contra el sitio de la entrada.
      sitio = jornada[0].sitio;
      const coords = sitio ? await this.repo.coordenadasSitio(sitio.id) : null;
      distanciaM = coords ? distanciaMetros(punto, coords) : null;
      radio = coords?.radioM ?? RADIO_GEOCERCA_M;
    }

    // Entrada y salida solo dentro del sitio (DA-36). Sin coordenadas se permite con alerta.
    if (TIPOS_CON_FOTO.includes(data.tipo) && distanciaM !== null && !sinConexion) {
      const accion = data.tipo === 'entrada' ? 'tu entrada' : 'tu salida';
      if (data.precisionM > radio) {
        throw new HttpError(
          409,
          'GPS_IMPRECISO',
          `La señal de tu GPS es débil (±${Math.round(data.precisionM)} m). Sal a un lugar abierto e intenta de nuevo.`,
        );
      }
      if (distanciaM > radio) {
        await this.audit.registrar({
          usuarioId,
          accion: 'asistencia.intento_fuera_de_rango',
          entidad: 'usuarios',
          entidadId: usuarioId,
          datos: {
            tipo: data.tipo,
            sitioId: sitio?.id ?? null,
            distanciaM,
            radioM: radio,
            precisionM: data.precisionM,
          },
          ...ctx,
        });
        throw new HttpError(
          409,
          'FUERA_DE_RANGO',
          `Estás a ${distanciaTexto(distanciaM)} de ${sitio?.nombre ?? 'tu sitio'}. Acércate al sitio (máximo ${radio} m) para registrar ${accion}.`,
          { distanciaM, radioM: radio },
        );
      }
    }

    const alertas: AlertaMarcacion[] = [...alertasDeHora];
    if (distanciaM === null) alertas.push('sitio_sin_ubicacion');
    else if (distanciaM > radio) alertas.push('fuera_de_rango');
    if (data.precisionM > radio) alertas.push('gps_impreciso');
    if (data.sinLentes) alertas.push('sin_lentes_declarado');
    // Retardo y salida anticipada con tolerancia (DA-33).
    let retardoMin = programada ? minutosEntre(programada.entrada, ahora) : null;
    // Venía de horas extra (su salida fue después de la hora de este turno): no hay retardo (AS6-07).
    const ultimaMarca = jornada.at(-1);
    if (
      programada &&
      (ultimaMarca?.tipo === 'salida' || ultimaMarca?.tipo === 'salida_extra') &&
      ultimaMarca.registradaEn.getTime() >= programada.entrada.getTime() &&
      (await this.extras.tuvoHorasExtra(jornada[0].id))
    ) {
      retardoMin = 0;
      alertas.push('viene_de_horas_extra');
    }
    if (retardoMin !== null && retardoMin > TOLERANCIA_RETARDO_MIN) alertas.push('retardo');
    const salidaProgramada = data.tipo === 'salida' ? jornada[0].programadaSalida : null;
    if (salidaProgramada && minutosEntre(ahora, salidaProgramada) >= SALIDA_ANTICIPADA_MIN) {
      alertas.push('salida_anticipada');
    }

    let evidencia: {
      fotoClave: string;
      rostroId: number | null;
      rostroDistancia: number | null;
      rostroIntentos: number;
    } | null = null;
    if (TIPOS_CON_FOTO.includes(data.tipo)) {
      const mime = foto && detectarImagen(foto.buffer);
      if (!foto || !mime) throw errorFoto('Toma tu foto para registrar la marca');

      const { propio, distancia, otro } = await this.identificar(usuarioId, data.descriptor);
      if (otro) {
        await this.registrarIncidencia(
          usuarioId,
          { motivo: 'rostro_de_otro', rostroDe: otro.usuario, tipo: data.tipo, sitioId: sitio?.id ?? null },
          { buffer: foto.buffer, mime },
          ctx,
        );
        if (!sinConexion) {
          throw new HttpError(
            409,
            'ROSTRO_DE_OTRO',
            'El rostro frente a la cámara no corresponde al titular de esta cuenta',
          );
        }
        alertas.push('rostro_no_coincide');
      }

      if (!propio) {
        alertas.push('sin_rostro_registrado');
      } else {
        if (distancia === null || distancia > UMBRAL_ROSTRO) {
          if (!sinConexion) {
            throw new HttpError(422, 'ROSTRO_NO_COINCIDE', 'No pudimos confirmar que seas el titular');
          }
          if (!alertas.includes('rostro_no_coincide')) alertas.push('rostro_no_coincide');
        }
        if (propio.estado === 'pendiente') alertas.push('rostro_pendiente');
      }
      evidencia = {
        fotoClave: await this.storage.guardar(foto.buffer, mime, 'asistencia'),
        rostroId: propio?.id ?? null,
        rostroDistancia: distancia === null ? null : Math.round(distancia * 10_000) / 10_000,
        rostroIntentos: data.intento,
      };
    }

    const nueva = {
      idCliente: data.idCliente,
      usuarioId,
      sitioId: sitio?.id ?? null,
      entradaId: data.tipo === 'entrada' ? null : jornada[0].id,
      tipo: data.tipo,
      lat: data.lat,
      lng: data.lng,
      precisionM: Math.round(data.precisionM),
      distanciaM,
      alertas,
      ...evidencia,
      programadaEntrada: programada?.entrada ?? null,
      programadaSalida: programada?.salida ?? null,
      ...(sinConexion ? { registradaEn: ahora } : {}),
      recibidaEn: recibida,
      horaCelular: data.horaCelular ? new Date(data.horaCelular) : null,
      desfaseSeg,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    };
    let marca: MarcacionRow;
    try {
      marca = await this.repo.crear(nueva);
    } catch (err) {
      if (evidencia) await this.storage.eliminar(evidencia.fotoClave).catch(() => undefined);
      throw err;
    }
    if (data.tipo === 'salida' || data.tipo === 'salida_extra') {
      await this.extras
        .alSalir({
          entrada: jornada[0],
          salida: { registradaEn: marca.registradaEn, final: data.tipo === 'salida_extra', porSupervisor: false },
        })
        .catch((err) => console.error('[asistencia] No se pudieron registrar las horas extra', err));
    }
    if (data.tipo === 'entrada') {
      const guardia = (await this.repo.findUsuarioRostro(usuarioId))?.nombre ?? 'Un guardia';
      await this.alLlegar(usuarioId, guardia, { id: marca.id, registradaEn: marca.registradaEn }).catch(
        (err) => console.error('[asistencia] No se pudo ligar la llegada al turno', err),
      );
    }
    await this.avisosDeLaMarca(
      usuarioId,
      data.tipo,
      sitio?.nombre ?? 'su sitio',
      marca.id,
      sitio?.id ?? null,
      {
        fueraDelSitio: alertas.includes('fuera_de_rango') ? distanciaM : null,
        retardoMin: programada ? retardoMin : null,
        horaEntrada: programada?.hora ?? null,
        salidaAnticipadaMin: salidaProgramada ? minutosEntre(ahora, salidaProgramada) : null,
      },
    );
    return toMarcacion(marca);
  }

  /**
   * Avisos al supervisor por una marca, solo los que vale la pena saber (DA-33):
   * - Comida fuera del sitio.
   * - Retardo de más de 15 min o salida 10 min (o más) antes.
   * - Patrón: 3 turnos seguidos con retardo, o saliendo al menos 3 min antes (aunque cada uno
   *   por sí solo no avise). Si hay patrón, ese aviso reemplaza al individual.
   * En la bitácora (DA-41) queda todo retardo, salida 10 min antes, comida fuera y patrón.
   */
  private async avisosDeLaMarca(
    usuarioId: number,
    tipo: TipoMarcacion,
    sitio: string,
    marcacionId: number,
    sitioId: number | null,
    m: {
      fueraDelSitio: number | null;
      retardoMin: number | null;
      horaEntrada: string | null;
      salidaAnticipadaMin: number | null;
    },
  ) {
    const esRetardo = tipo === 'entrada' && m.retardoMin !== null && m.retardoMin > TOLERANCIA_RETARDO_MIN;
    const salioAntes =
      tipo === 'salida' && m.salidaAnticipadaMin !== null && m.salidaAnticipadaMin >= PATRON_SALIDA_MIN;
    const individual =
      m.fueraDelSitio !== null ||
      (esRetardo && m.retardoMin! > AVISO_RETARDO_MIN) ||
      (salioAntes && m.salidaAnticipadaMin! >= SALIDA_ANTICIPADA_MIN);
    if (!individual && !esRetardo && !salioAntes) return;

    const evento = { usuarioIds: [usuarioId], marcacionId, sitioId };
    if (esRetardo) {
      await this.bitacora({
        ...evento,
        tipo: 'retardo',
        detalle: `Llegó ${duracionTexto(m.retardoMin!)} tarde a ${sitio} (debía entrar a las ${horaLegible(m.horaEntrada!)})`,
        datos: { minutos: m.retardoMin },
      });
    }
    if (salioAntes && m.salidaAnticipadaMin! >= SALIDA_ANTICIPADA_MIN) {
      await this.bitacora({
        ...evento,
        tipo: 'salida_anticipada',
        detalle: `Salió ${duracionTexto(m.salidaAnticipadaMin!)} antes en ${sitio}`,
        datos: { minutos: m.salidaAnticipadaMin },
      });
    }
    if (m.fueraDelSitio !== null) {
      await this.bitacora({
        ...evento,
        tipo: 'comida_fuera',
        detalle: `${tipo === 'fin_comida' ? 'Regresó de comer' : 'Salió a comer'} fuera de ${sitio} (${distanciaTexto(m.fueraDelSitio)})`,
        datos: { distanciaM: m.fueraDelSitio },
      });
    }

    const guardia = (await this.repo.findUsuarioRostro(usuarioId))?.nombre ?? 'Un guardia';
    const ruta = `/asistencia/guardias/${usuarioId}?vista=bitacora&cat=incidencias`;
    const patron = esRetardo || salioAntes ? await this.racha(usuarioId, tipo === 'entrada') : null;

    if (patron) {
      await this.bitacora({
        ...evento,
        tipo: 'racha',
        detalle: `${PATRON_SEGUIDOS} turnos seguidos ${esRetardo ? 'llegando tarde' : 'saliendo antes de su hora'} (${patron
          .map((n) => `${esRetardo ? '+' : '−'}${n} min`)
          .join(', ')})`,
        datos: { minutos: patron.join(',') },
      });
      await this.avisarRevisores(
        { sitioId, guardiaId: usuarioId },
        {
          tipo: esRetardo ? 'retardo' : 'marca_alerta',
          titulo: esRetardo ? 'Retardos seguidos' : 'Salidas anticipadas seguidas',
          mensaje: `${guardia} · ${sitio}: lleva ${PATRON_SEGUIDOS} turnos seguidos ${
            esRetardo ? 'llegando tarde' : 'saliendo antes de su hora'
          } (${patron.map((n) => `${esRetardo ? '+' : '−'}${n} min`).join(', ')})`,
          ruta,
        },
      );
      if (m.fueraDelSitio === null) return;
    }
    if (m.fueraDelSitio !== null) {
      await this.avisarRevisores(
        { sitioId, guardiaId: usuarioId },
        {
          tipo: 'marca_alerta',
          titulo: 'Marca fuera del sitio',
          mensaje: `${guardia} · ${TIPO_MARCACION_LABEL[tipo]} en ${sitio}: fuera del sitio (${distanciaTexto(m.fueraDelSitio)})`,
          ruta,
        },
      );
    }
    if (!patron && esRetardo && m.retardoMin! > AVISO_RETARDO_MIN) {
      await this.avisarRevisores(
        { sitioId, guardiaId: usuarioId },
        {
          tipo: 'retardo',
          titulo: 'Llegó tarde',
          mensaje: `${guardia} · ${sitio}: llegó ${duracionTexto(m.retardoMin!)} tarde (debía entrar a las ${horaLegible(m.horaEntrada!)})`,
          ruta,
        },
      );
    }
    if (!patron && salioAntes && m.salidaAnticipadaMin! >= SALIDA_ANTICIPADA_MIN) {
      await this.avisarRevisores(
        { sitioId, guardiaId: usuarioId },
        {
          tipo: 'marca_alerta',
          titulo: 'Salida anticipada',
          mensaje: `${guardia} · Salida en ${sitio}: salió ${duracionTexto(m.salidaAnticipadaMin!)} antes de su hora`,
          ruta,
        },
      );
    }
  }

  /**
   * Si la marca recién registrada completa exactamente PATRON_SEGUIDOS turnos seguidos con retardo
   * (entrada) o saliendo antes (salida), los minutos de cada uno (del más viejo al más nuevo).
   * Solo al llegar a 3, para no repetir el aviso cada día de la misma racha.
   */
  private async racha(usuarioId: number, entrada: boolean): Promise<number[] | null> {
    const hasta = this.ahora();
    const rows = await this.repo.jornadasEntre(
      usuarioId,
      new Date(hasta.getTime() - 30 * 86_400_000),
      new Date(hasta.getTime() + 60_000),
    );
    const valores = armarJornadas(rows)
      .filter((j) => (entrada ? j.retardoMin !== null : j.salidaAnticipadaMin !== null))
      .map((j) => (entrada ? j.retardoMin! : j.salidaAnticipadaMin!));
    const cumple = (n: number) => (entrada ? n > TOLERANCIA_RETARDO_MIN : n >= PATRON_SALIDA_MIN);
    let seguidos = 0;
    while (seguidos < valores.length && cumple(valores[seguidos])) seguidos++;
    return seguidos === PATRON_SEGUIDOS ? valores.slice(0, PATRON_SEGUIDOS).reverse() : null;
  }

  /** Jornadas con las alertas de rostro según su estado actual (AS1-14). */
  private async jornadas(rows: MarcacionRow[]) {
    const ids = [...new Set(rows.map((r) => r.rostroId).filter((id): id is number => id !== null))];
    return armarJornadas(rows, await this.repo.estadosRostros(ids));
  }

  /**
   * Verificación en vivo (DA-28): mientras la cámara está abierta, ¿la cara es la del titular?
   * No guarda nada; la marca se vuelve a verificar al registrarse.
   */
  async verificarRostro(usuarioId: number, descriptor: number[]): Promise<ResultadoVerificacion> {
    const { propio, distancia, otro } = await this.identificar(usuarioId, descriptor);
    if (otro) return 'no_titular';
    if (!propio || distancia === null) return 'sin_rostro';
    if (distancia <= UMBRAL_ROSTRO) return 'titular';
    return distancia > UMBRAL_NO_TITULAR ? 'no_titular' : 'dudoso';
  }

  /**
   * La cámara reporta un intento rechazado (DA-31): pantalla o foto, persona que no es el titular
   * (desconocida u otro guardia) o gesto no completado. Se guarda la foto como evidencia, queda en
   * auditoría y se avisa a los revisores. Como mucho una por guardia y motivo cada 2 minutos.
   * "No es el titular" se comprueba con el vector: si la cara sí es del titular no se hace nada.
   */
  async reportarIncidencia(
    usuarioId: number,
    { tipo, motivo, descriptor }: IncidenciaCreateInput,
    foto: ArchivoSubido | undefined,
    ctx: RequestContext,
  ): Promise<void> {
    const mime = foto && detectarImagen(foto.buffer);
    if (!foto || !mime) throw errorFoto('Falta la foto del intento');
    if (motivo === 'no_titular' && !descriptor) throw errorFoto('Falta el vector facial', 'descriptor');
    const clave = `${usuarioId}:${motivo}`;
    const ahora = this.ahora().getTime();
    if (ahora - (this.ultimaIncidencia.get(clave) ?? -Infinity) < INCIDENCIA_CADA_MS) return;

    let rostroDe: { id: number; nombre: string } | null = null;
    if (motivo === 'no_titular') {
      if ((await this.verificarRostro(usuarioId, descriptor!)) !== 'no_titular') return;
      rostroDe = (await this.identificar(usuarioId, descriptor)).otro?.usuario ?? null;
    }
    this.ultimaIncidencia.set(clave, ahora);
    await this.registrarIncidencia(
      usuarioId,
      {
        motivo: rostroDe ? 'rostro_de_otro' : motivo,
        rostroDe,
        tipo,
        sitioId: await this.sitioActual(usuarioId, tipo),
      },
      { buffer: foto.buffer, mime },
      ctx,
    );
  }

  /** Última incidencia reportada por guardia y motivo (memoria del proceso: basta para no saturar). */
  private readonly ultimaIncidencia = new Map<string, number>();

  /** Incidencias de rostro (pendientes o revisadas), más recientes primero. */
  async incidencias(
    { estado, conclusion, q, guardiaId, page, limit }: IncidenciasQuery,
    alcance: Alcance | null = null,
  ): Promise<Paginated<IncidenciaRostro>> {
    if (guardiaId && !guardiaEnAlcance(alcance, guardiaId)) return { items: [], total: 0, page, limit };
    const { items, total } = await this.repo.incidencias({
      revisadas: estado === 'revisadas',
      conclusion,
      q,
      guardiaId,
      ...(alcance && { guardiaIds: [...alcance.guardiaIds] }),
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: items.map(toIncidencia), total, page, limit };
  }

  async incidencia(id: number, alcance: Alcance | null = null): Promise<IncidenciaRostro> {
    const r = await this.repo.findIncidencia(id);
    const i = r && toIncidencia(r);
    if (!i || !guardiaEnAlcance(alcance, i.guardia.id)) throw HttpError.notFound('Incidencia no encontrada');
    return i;
  }

  /** Marca la incidencia como revisada con su conclusión (DA-35) y nota opcional. */
  async revisarIncidencia(
    id: number,
    { conclusion, nota }: { conclusion: ConclusionIncidencia; nota?: string },
    ctx: AccionCtx,
    alcance: Alcance | null = null,
  ): Promise<IncidenciaRostro> {
    await this.incidencia(id, alcance);
    const actual = (await this.repo.findIncidencia(id))!;
    if (actual.revisadaEn) throw HttpError.conflict('La incidencia ya fue revisada');
    const r = await this.repo.revisarIncidencia(id, {
      revisadaPorId: ctx.actorId,
      conclusion,
      nota: nota || null,
    });
    await this.audit.registrarAccion(ctx, 'asistencia.revisar_incidencia', 'usuarios', actual.usuario.id, {
      incidenciaId: id,
      motivo: actual.motivo,
      conclusion,
      ...(nota && { nota }),
    });
    return toIncidencia(r);
  }

  /** Sitio de la jornada (salida) o el primero asignado hoy (entrada), para ubicar la incidencia. */
  private async sitioActual(usuarioId: number, tipo: TipoMarcacion) {
    if (tipo !== 'entrada') {
      const jornada = await this.repo.ultimaJornada(usuarioId);
      if (jornada.length && this.reciente(jornada[0])) return jornada[0].sitio?.id ?? null;
    }
    return (await this.sitiosMarcables(usuarioId))[0]?.id ?? null;
  }

  /**
   * Compara la cara con el rostro del titular y con los demás registrados (1 a N). `otro` es el
   * guardia al que corresponde si se parece más a él que al titular.
   */
  private async identificar(usuarioId: number, descriptor: number[] | undefined) {
    const propio = vigente(await this.repo.rostroActual(usuarioId));
    const distancia = propio && descriptor ? menorDistancia(descriptor, propio.descriptores) : null;
    let otro: OtroRostro | null = null;
    if (descriptor) {
      for (const o of await this.repo.rostrosDeOtros(usuarioId)) {
        const d = menorDistancia(descriptor, o.descriptores);
        if (!otro || d < otro.distancia) otro = { usuario: o.usuario, distancia: d };
      }
    }
    const esOtro =
      otro !== null && otro.distancia <= UMBRAL_ROSTRO && (distancia === null || otro.distancia < distancia);
    return { propio, distancia, otro: esOtro ? otro : null };
  }

  /** Rostro actual de un guardia (pendiente, aprobado o rechazado), o null (AS1-02). */
  async rostro(usuarioId: number, alcance: Alcance | null = null): Promise<RostroRegistro | null> {
    exigirGuardia(alcance, usuarioId);
    const r = await this.repo.rostroActual(usuarioId);
    return r && toRostroRegistro(r);
  }

  /** Rostros que esperan revisión de supervisor/admin. */
  async rostrosPendientes(alcance: Alcance | null = null): Promise<RostroPendiente[]> {
    const rows = (await this.repo.rostrosPendientes()).filter((r) => guardiaEnAlcance(alcance, r.guardia.id));
    return rows.map(({ guardia, rostro }) => ({ guardia, rostro: toRostroRegistro(rostro) }));
  }

  /**
   * Primer registro hecho por el propio guardia (una sola vez): queda pendiente de revisión y se
   * avisa a supervisores y admin en la campanita. Mientras tanto puede marcar (con alerta).
   */
  async autoregistrarRostro(
    usuarioId: number,
    { descriptores, sinLentes }: RostroRegistroInput,
    archivos: ArchivoSubido[] | undefined,
    ctx: RequestContext,
  ): Promise<RostroRegistro> {
    const usuario = await this.guardiaActivo(usuarioId);
    const actual = vigente(await this.repo.rostroActual(usuarioId));
    if (actual) {
      throw HttpError.conflict(
        actual.estado === 'pendiente' ? 'Tu rostro ya está en revisión' : 'Ya tienes un rostro registrado',
      );
    }
    const fotos = this.validarFotos(archivos, descriptores.length);
    validarMismaPersona(descriptores);
    await this.validarNoDuplicado(usuario, descriptores, fotos[0], ctx, true);

    const rostro = await this.guardarConFotos(fotos, (claves) =>
      this.repo.guardarRostro({
        usuarioId,
        estado: 'pendiente',
        autoregistro: true,
        descriptores,
        fotoClave: claves[0],
        fotos: claves,
        registradoPorId: usuarioId,
      }),
    );
    await this.audit.registrar({
      usuarioId,
      accion: 'asistencia.autoregistro_rostro',
      entidad: 'usuarios',
      entidadId: usuarioId,
      datos: { rostroId: rostro.id, muestras: descriptores.length, ...(sinLentes && { sinLentes }) },
      ...ctx,
    });
    await this.bitacora({
      usuarioIds: [usuarioId],
      tipo: 'rostro_registrado',
      detalle: 'Registró su rostro (pendiente de revisión)',
    });
    await this.avisarRevisores(
      { sitioId: null, guardiaId: usuarioId },
      {
        tipo: 'rostro_pendiente',
        titulo: 'Rostro por revisar',
        mensaje: `${usuario.nombre} registró su rostro: pendiente de revisión`,
        ruta: RUTA_REVISION,
        fotoClave: rostro.fotoClave,
      },
    );
    return toRostroRegistro(rostro);
  }

  /** Aprueba el rostro pendiente de un guardia (supervisor/admin). */
  async aprobarRostro(
    usuarioId: number,
    ctx: AccionCtx,
    alcance: Alcance | null = null,
  ): Promise<RostroRegistro> {
    exigirGuardia(alcance, usuarioId);
    return this.revisar(usuarioId, 'aprobado', null, ctx);
  }

  /** Rechaza el rostro pendiente; al guardia le vuelve a salir el registro con el motivo. */
  async rechazarRostro(
    usuarioId: number,
    motivo: string,
    ctx: AccionCtx,
    alcance: Alcance | null = null,
  ): Promise<RostroRegistro> {
    exigirGuardia(alcance, usuarioId);
    return this.revisar(usuarioId, 'rechazado', motivo, ctx);
  }

  /**
   * Elimina el rostro registrado (y su historial) de un guardia. Solo admin. El guardia queda
   * "sin rostro registrado"; las fotos de sus marcas pasadas se conservan como evidencia.
   */
  async eliminarRostro(usuarioId: number, ctx: AccionCtx): Promise<void> {
    const usuario = await this.repo.findUsuarioRostro(usuarioId);
    if (!usuario) throw HttpError.notFound('Guardia no encontrado');
    const fotos = await this.repo.eliminarRostros(usuarioId);
    if (fotos.length === 0) throw HttpError.notFound('El guardia no tiene rostro registrado');
    await Promise.all(fotos.map((f) => this.storage.eliminar(f).catch(() => undefined)));
    await this.audit.registrarAccion(ctx, 'asistencia.eliminar_rostro', 'usuarios', usuarioId, {
      guardia: usuario.nombre,
      registros: fotos.length,
    });
    await this.bitacora({
      usuarioIds: [usuarioId],
      tipo: 'rostro_eliminado',
      detalle: 'Se eliminó su rostro registrado',
      actorId: ctx.actorId,
    });
  }

  /**
   * Registro en persona por supervisor/admin (para casos raros): queda aprobado directamente.
   * Reemplaza al anterior. Rechaza fotos de distintas personas y caras ya registradas en otra cuenta.
   */
  async registrarRostro(
    usuarioId: number,
    { descriptores, sinLentes }: RostroRegistroInput,
    archivos: ArchivoSubido[] | undefined,
    ctx: AccionCtx,
    alcance: Alcance | null = null,
  ): Promise<RostroRegistro> {
    exigirGuardia(alcance, usuarioId);
    const usuario = await this.guardiaActivo(usuarioId);
    const fotos = this.validarFotos(archivos, descriptores.length);
    validarMismaPersona(descriptores);
    await this.validarNoDuplicado(usuario, descriptores, fotos[0], ctx, false);

    const rostro = await this.guardarConFotos(fotos, (claves) =>
      this.repo.guardarRostro({
        usuarioId,
        estado: 'aprobado',
        autoregistro: false,
        descriptores,
        fotoClave: claves[0],
        fotos: claves,
        registradoPorId: ctx.actorId,
        revisadoPorId: ctx.actorId,
        revisadoEn: new Date(),
      }),
    );
    await this.audit.registrarAccion(ctx, 'asistencia.registrar_rostro', 'usuarios', usuarioId, {
      guardia: usuario.nombre,
      rostroId: rostro.id,
      muestras: descriptores.length,
      ...(sinLentes && { sinLentes }),
    });
    await this.bitacora({
      usuarioIds: [usuarioId],
      tipo: 'rostro_registrado',
      detalle: 'Le registraron el rostro en persona (aprobado)',
      actorId: ctx.actorId,
    });
    return toRostroRegistro(rostro);
  }

  private async revisar(
    usuarioId: number,
    estado: 'aprobado' | 'rechazado',
    motivo: string | null,
    ctx: AccionCtx,
  ): Promise<RostroRegistro> {
    const actual = await this.repo.rostroActual(usuarioId);
    if (!actual || actual.estado !== 'pendiente') {
      throw HttpError.conflict('Este guardia no tiene un rostro pendiente de revisión');
    }
    const rostro = await this.repo.revisarRostro(actual.id, {
      estado,
      revisadoPorId: ctx.actorId,
      motivoRechazo: motivo,
    });
    await this.audit.registrarAccion(
      ctx,
      estado === 'aprobado' ? 'asistencia.aprobar_rostro' : 'asistencia.rechazar_rostro',
      'usuarios',
      usuarioId,
      { rostroId: actual.id, ...(motivo && { motivo }) },
    );
    await this.bitacora({
      usuarioIds: [usuarioId],
      tipo: estado === 'aprobado' ? 'rostro_aprobado' : 'rostro_rechazado',
      detalle: estado === 'aprobado' ? 'Rostro aprobado' : `Rostro rechazado: ${motivo}`,
      actorId: ctx.actorId,
    });
    await this.avisarGuardia(
      usuarioId,
      estado === 'aprobado'
        ? {
            tipo: 'rostro_aprobado',
            titulo: 'Tu rostro fue aprobado',
            mensaje: 'Tu rostro fue aprobado: ya puedes checar normalmente',
            ruta: '/marcar',
          }
        : {
            tipo: 'rostro_rechazado',
            titulo: 'Tu rostro fue rechazado',
            mensaje: `Tu rostro fue rechazado: ${motivo}. Vuelve a registrarlo la próxima vez que cheques`,
            ruta: '/marcar',
          },
    );
    return toRostroRegistro(rostro);
  }

  /**
   * Intento rechazado (DA-31): guarda la foto como evidencia, crea la incidencia para revisión,
   * lo deja en auditoría y avisa a supervisores y admin (con la foto en miniatura).
   */
  private async registrarIncidencia(
    usuarioId: number,
    {
      motivo,
      rostroDe,
      tipo,
      sitioId,
    }: {
      motivo: MotivoIncidencia;
      rostroDe: { id: number; nombre: string } | null;
      tipo: TipoMarcacion | null;
      sitioId: number | null;
    },
    foto: { buffer: Buffer; mime: string },
    ctx: RequestContext,
  ) {
    const guardia = (await this.repo.findUsuarioRostro(usuarioId))?.nombre ?? 'Un guardia';
    const fotoClave = await this.storage.guardar(foto.buffer, foto.mime, 'intentos');
    const id = await this.repo.crearIncidencia({
      usuarioId,
      motivo,
      tipoMarca: tipo,
      fotoClave,
      rostroDeId: rostroDe?.id ?? null,
      sitioId,
    });
    await this.audit.registrar({
      usuarioId,
      accion: 'asistencia.incidencia_rostro',
      entidad: 'usuarios',
      entidadId: usuarioId,
      datos: { incidenciaId: id, motivo, tipo, fotoClave, rostroDe },
      ...ctx,
    });
    const sitioNombre = sitioId ? await this.repo.nombreSitio(sitioId) : null;
    const enBitacora: Record<MotivoIncidencia, string> = {
      pantalla: 'Intentó marcar con una pantalla o foto',
      rostro_de_otro: `${rostroDe?.nombre ?? 'Otro guardia'} intentó marcar con su cuenta`,
      no_titular: 'Otra persona apareció frente a la cámara',
      reto_fallido: 'No completó el gesto al marcar',
      registro_duplicado: `Intentó registrar un rostro que ya es de ${rostroDe?.nombre ?? 'otro guardia'}`,
    };
    await this.bitacora({
      usuarioIds: [usuarioId],
      tipo: 'incidencia_rostro',
      detalle: `${enBitacora[motivo]}${sitioNombre ? ` en ${sitioNombre}` : ''}`,
      incidenciaId: id,
      sitioId,
    });
    const detalle: Record<MotivoIncidencia, string> = {
      pantalla: 'parece una pantalla o foto frente a la cámara',
      rostro_de_otro: `el rostro corresponde a ${rostroDe?.nombre}`,
      no_titular: 'el rostro no corresponde al titular',
      reto_fallido: 'no completó el gesto pedido',
      registro_duplicado: `intentó registrar un rostro que ya está registrado para ${rostroDe?.nombre}`,
    };
    const tituloIncidencia: Record<MotivoIncidencia, string> = {
      pantalla: 'Pantalla o foto al checar',
      rostro_de_otro: 'Rostro de otra persona al checar',
      no_titular: 'Rostro no corresponde al titular',
      reto_fallido: 'Gesto no completado',
      registro_duplicado: 'Rostro ya registrado en otra cuenta',
    };
    await this.avisarRevisores(
      { sitioId, guardiaId: usuarioId },
      {
        tipo: AVISO_DE[motivo],
        titulo: tituloIncidencia[motivo],
        mensaje:
          motivo === 'registro_duplicado'
            ? `${guardia} ${detalle[motivo]}`
            : `${guardia} · ${tipo ? TIPO_MARCACION_LABEL[tipo] : 'Registro'}: ${detalle[motivo]}`,
        ruta: `/asistencia/incidencias?id=${id}`,
        fotoClave,
      },
    );
    // El titular de la cuenta también se entera cuando otra cara o una pantalla intentó marcar (DA-34).
    if (motivo === 'pantalla' || motivo === 'rostro_de_otro' || motivo === 'no_titular') {
      await this.avisarGuardia(usuarioId, {
        tipo: 'cuenta_intento',
        titulo:
          motivo === 'pantalla'
            ? 'Intento con tu cuenta: foto o pantalla'
            : 'Intento con tu cuenta: otra persona',
        mensaje:
          motivo === 'pantalla'
            ? 'Se detectó un intento de checar con tu cuenta usando una foto o pantalla. Si no fuiste tú, avisa a tu supervisor.'
            : 'Se detectó un intento de checar con tu cuenta con el rostro de otra persona. Si no fuiste tú, avisa a tu supervisor.',
        ruta: '/marcar',
      });
    }
  }

  private async avisarGuardia(usuarioId: number, aviso: AvisoAsistencia) {
    try {
      await this.repo.avisar([usuarioId], aviso);
    } catch (err) {
      console.error('[asistencia] No se pudo crear el aviso', err);
    }
  }

  private async guardiaActivo(usuarioId: number) {
    const usuario = await this.repo.findUsuarioRostro(usuarioId);
    if (!usuario || usuario.deletedAt || !usuario.activo) throw HttpError.notFound('Guardia no encontrado');
    if (usuario.rol !== ROLES.GUARDIA) throw HttpError.badRequest('Solo se registra el rostro de guardias');
    return usuario;
  }

  /** Una foto por vector, imágenes reales (por firma de bytes). */
  private validarFotos(archivos: ArchivoSubido[] | undefined, muestras: number) {
    if (!archivos?.length) throw errorFoto('Faltan las fotos del rostro', 'fotos');
    if (archivos.length !== muestras) throw errorFoto('Debe haber una foto por cada muestra', 'fotos');
    return archivos.map((a) => {
      const mime = detectarImagen(a.buffer);
      if (!mime) throw errorFoto('Una de las fotos no es una imagen válida', 'fotos');
      return { buffer: a.buffer, mime };
    });
  }

  /**
   * La cara no debe estar registrada (pendiente o aprobada) en otra cuenta. Si lo está, se rechaza;
   * en el autoregistro además se guarda la foto como evidencia y se avisa a los revisores.
   */
  private async validarNoDuplicado(
    usuario: { id: number; nombre: string },
    descriptores: number[][],
    foto: { buffer: Buffer; mime: string },
    ctx: RequestContext,
    avisar: boolean,
  ) {
    for (const otro of await this.repo.rostrosDeOtros(usuario.id)) {
      const cercania = Math.min(...descriptores.map((d) => menorDistancia(d, otro.descriptores)));
      if (cercania > UMBRAL_ROSTRO) continue;
      if (avisar) {
        await this.registrarIncidencia(
          usuario.id,
          { motivo: 'registro_duplicado', rostroDe: otro.usuario, tipo: null, sitioId: null },
          foto,
          ctx,
        );
      }
      const mensaje = `Este rostro ya está registrado para ${otro.usuario.nombre}`;
      throw HttpError.conflict(mensaje, [{ path: 'descriptores', message: mensaje }]);
    }
  }

  /** Guarda las fotos y ejecuta `guardar`; si falla, borra las fotos ya subidas. */
  private async guardarConFotos(
    fotos: { buffer: Buffer; mime: string }[],
    guardar: (claves: string[]) => Promise<RostroRow>,
  ) {
    const claves: string[] = [];
    try {
      for (const f of fotos) claves.push(await this.storage.guardar(f.buffer, f.mime, 'rostros'));
      return await guardar(claves);
    } catch (err) {
      await Promise.all(claves.map((c) => this.storage.eliminar(c).catch(() => undefined)));
      throw err;
    }
  }

  /** Avisa al supervisor del sitio del guardia; sin supervisor, al admin (DA-45). */
  private async avisarRevisores(destino: DestinoRevision, aviso: AvisoAsistencia) {
    try {
      await this.repo.avisar(await this.repo.revisoresDe(destino), aviso);
    } catch (err) {
      // Un aviso que no se pudo crear no debe impedir la operación.
      console.error('[asistencia] No se pudo crear el aviso', err);
    }
  }

  /**
   * Cierra la jornada de un guardia que no pudo checar su salida (DA-49): registra una salida a su
   * nombre, marcada "cerrada por un supervisor", con motivo obligatorio. Las checadas no se editan:
   * se agrega esta. Queda en auditoría y en la bitácora, y se le avisa al guardia.
   */
  async cerrarJornada(
    entradaId: number,
    { motivo, salidaEn }: CerrarJornadaInput,
    ctx: AccionCtx,
    alcance: Alcance | null = null,
  ): Promise<void> {
    const entrada = await this.repo.findMarca(entradaId);
    if (!entrada || entrada.tipo !== 'entrada') throw HttpError.notFound('Jornada no encontrada');
    exigirGuardia(alcance, entrada.usuarioId);
    const desde = entrada.registradaEn;
    const [fila] = armarJornadas(
      await this.repo.jornadasEntre(entrada.usuarioId, desde, new Date(desde.getTime() + 1)),
    );
    if (!fila || fila.salida) throw HttpError.conflict('La jornada ya tiene su salida');

    const ahora = this.ahora();
    const programada = entrada.programadaSalida;
    // Por omisión: la salida programada si ya pasó; si no, ahora.
    const hora = salidaEn ? new Date(salidaEn) : programada && programada <= ahora ? programada : ahora;
    const ultima = [fila.entrada, ...fila.comidas.flatMap((c) => [c.inicio, c.fin])]
      .flatMap((m) => (m ? [Date.parse(m.registradaEn)] : []))
      .reduce((a, b) => Math.max(a, b));
    if (hora.getTime() < ultima) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [
        { path: 'salidaEn', message: 'La salida no puede ser antes de su última checada' },
      ]);
    }
    if (hora.getTime() > ahora.getTime() + 60_000) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [
        { path: 'salidaEn', message: 'La salida no puede ser en el futuro' },
      ]);
    }

    await this.repo.crear({
      idCliente: randomUUID(),
      usuarioId: entrada.usuarioId,
      sitioId: entrada.sitio?.id ?? null,
      entradaId: entrada.id,
      tipo: 'salida',
      lat: entrada.lat,
      lng: entrada.lng,
      precisionM: 0,
      distanciaM: null,
      alertas: ['cerrada_por_supervisor'],
      registradaEn: hora,
    });
    await this.extras
      .alSalir({ entrada, salida: { registradaEn: hora, final: false, porSupervisor: true } })
      .catch((err) => console.error('[asistencia] No se pudieron registrar las horas extra', err));
    const sitio = entrada.sitio?.nombre ?? 'su sitio';
    const quien = (await this.repo.findUsuarioRostro(ctx.actorId))?.nombre ?? 'Un supervisor';
    await this.audit.registrarAccion(ctx, 'asistencia.cerrar_jornada', 'marcaciones', entrada.id, {
      guardiaId: entrada.usuarioId,
      sitio,
      salida: hora.toISOString(),
      motivo,
    });
    await this.bitacora({
      usuarioIds: [entrada.usuarioId],
      tipo: 'jornada_cerrada',
      detalle: `${quien} cerró su jornada en ${sitio}: salida a las ${horaLocal(hora)}. Motivo: ${motivo}`,
      marcacionId: entrada.id,
      sitioId: entrada.sitio?.id ?? null,
      actorId: ctx.actorId,
    });
    await this.avisarGuardia(entrada.usuarioId, {
      tipo: 'marca_alerta',
      titulo: 'Cerraron tu jornada',
      mensaje: `${quien} cerró tu jornada en ${sitio} (salida a las ${horaLocal(hora)}). Motivo: ${motivo}`,
      ruta: '/marcar',
    });
  }

  /** Jornadas del guardia cuya entrada cae en el mes `AAAA-MM` (zona del negocio). */
  async misJornadas(usuarioId: number, mes: string): Promise<Jornada[]> {
    const [a, m] = mes.split('-').map(Number);
    const siguiente = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
    const rows = await this.repo.jornadasEntre(
      usuarioId,
      inicioDelDia(`${mes}-01`),
      inicioDelDia(`${siguiente}-01`),
    );
    return this.jornadas(rows);
  }

  /**
   * Lista del día (AS1-07): una fila por jornada que empezó ese día y una fila "sin marcas"
   * por cada guardia asignado que no ha marcado. Orden por nombre del guardia. Solo lectura.
   */
  async dia(
    { fecha, q, soloAlertas, page, limit }: AsistenciaDiaQuery,
    alcance: Alcance | null = null,
  ): Promise<Paginated<FilaAsistencia>> {
    const [rows, asignados] = await Promise.all([
      this.repo.jornadasDeTodos(inicioDelDia(fecha), inicioDelDia(diaSiguiente(fecha))),
      this.repo.guardiasAsignados(fecha),
    ]);

    const guardiaDe = new Map<number, MarcacionGuardiaRow['usuario']>();
    for (const r of rows) if (r.tipo === 'entrada') guardiaDe.set(r.id, r.usuario);
    // Quién cubre qué sitio ese día (DA-39), para la etiqueta "Cobertura".
    const cubre = new Map(asignados.filter((a) => a.cobertura).map((a) => [a.guardia.id, a.sitio.id]));
    const conJornada: FilaAsistencia[] = (await this.jornadas(rows)).map((jornada) => {
      const guardia = guardiaDe.get(jornada.entrada.id)!;
      return {
        guardia: {
          ...guardia,
          foto: jornada.entrada.foto ?? guardia.foto ?? null,
        },
        sitio: jornada.sitio,
        jornada,
        cobertura: !!jornada.sitio && cubre.get(guardia.id) === jornada.sitio.id,
      };
    });
    const marcaron = new Set(conJornada.map((f) => f.guardia.id));
    const ahora = this.ahora();
    // Hoy: quien sigue en una jornada que empezó antes (horas extra) no "no se presentó" a su turno de hoy
    // (AS6-07): se muestra su jornada abierta.
    const enCurso: FilaAsistencia[] = [];
    if (fecha === this.hoy()) {
      const recientes = await this.repo.jornadasDeTodos(new Date(ahora.getTime() - 30 * 3_600_000), new Date(ahora.getTime() + 60_000));
      const deQuien = new Map<number, MarcacionGuardiaRow['usuario']>();
      for (const r of recientes) if (r.tipo === 'entrada') deQuien.set(r.id, r.usuario);
      for (const j of await this.jornadas(recientes)) {
        const g = deQuien.get(j.entrada.id);
        if (!g || j.salida || marcaron.has(g.id) || enCurso.some((f) => f.guardia.id === g.id)) continue;
        enCurso.push({ guardia: { ...g, foto: j.entrada.foto ?? g.foto ?? null }, sitio: j.sitio, jornada: j });
      }
    }
    const sigueTrabajando = new Set(enCurso.map((f) => f.guardia.id));
    const sinMarcas: FilaAsistencia[] = asignados
      .filter((a) => !marcaron.has(a.guardia.id) && !sigueTrabajando.has(a.guardia.id))
      .map(({ guardia, sitio, horaInicio, horas, cobertura }) => ({
        guardia,
        sitio,
        jornada: null,
        turno: horaInicio ? { ...estadoDelTurno(fecha, horaInicio, ahora), horas: horas ?? null } : null,
        cobertura: !!cobertura,
      }));

    const texto = q?.toLowerCase();
    const filas = [...conJornada, ...enCurso, ...sinMarcas]
      // Supervisor: solo sus sitios y sus guardias (DA-45).
      .filter(
        (f) =>
          !alcance || (f.sitio ? alcance.sitioIds.has(f.sitio.id) : alcance.guardiaIds.has(f.guardia.id)),
      )
      .filter(
        (f) =>
          !soloAlertas ||
          !!f.jornada?.alertas.length ||
          f.turno?.estado === 'falta' ||
          f.turno?.estado === 'no_se_presento',
      )
      .filter(
        (f) =>
          !texto ||
          [f.guardia.nombre, f.guardia.email, f.sitio?.nombre].some((t) => t?.toLowerCase().includes(texto)),
      )
      .sort(
        (a, b) =>
          a.guardia.nombre.localeCompare(b.guardia.nombre, 'es') ||
          (a.jornada?.entrada.registradaEn ?? '').localeCompare(b.jornada?.entrada.registradaEn ?? ''),
      );

    return { items: filas.slice((page - 1) * limit, page * limit), total: filas.length, page, limit };
  }

  /**
   * Tablero del día (DA-51): quién no llegó, jornadas que ya debieron cerrarse y comidas sin cierre.
   * El supervisor solo ve sus sitios y guardias.
   */
  async tablero(alcance: Alcance | null = null): Promise<TableroAsistencia> {
    const fecha = this.hoy();
    const ahora = this.ahora();
    const t = ahora.getTime();
    const items: TableroItem[] = [];

    // No han llegado: lo que ya calcula la asistencia del día.
    const dia = await this.dia({ fecha, page: 1, limit: 1000 }, alcance);
    for (const fila of dia.items) {
      const e = fila.turno?.estado;
      if (!fila.jornada && (e === 'falta' || e === 'no_se_presento')) {
        items.push({
          clase: 'sin_llegar',
          fila,
          minutos: Math.floor((t - Date.parse(fila.turno!.entrada)) / 60_000),
        });
      }
    }

    // Jornadas abiertas de las últimas 30 h (turnos de 24 h y un margen).
    const rows = await this.repo.jornadasDeTodos(new Date(t - 30 * 3_600_000), new Date(t + 60_000));
    const guardiaDe = new Map(rows.filter((r) => r.tipo === 'entrada').map((r) => [r.id, r.usuario]));
    for (const jornada of await this.jornadas(rows)) {
      const guardia = guardiaDe.get(jornada.entrada.id);
      if (!guardia || jornada.salida) continue;
      if (
        alcance &&
        !(jornada.sitio ? alcance.sitioIds.has(jornada.sitio.id) : alcance.guardiaIds.has(guardia.id))
      ) {
        continue;
      }
      const fila: FilaAsistencia = { guardia, sitio: jornada.sitio, jornada };
      const salida = jornada.programada ? Date.parse(jornada.programada.salida) : null;
      const abierta = jornada.comidas.at(-1);
      if (salida !== null && t - salida >= TABLERO_SALIDA_TOLERANCIA_MIN * 60_000) {
        items.push({ clase: 'sin_salida', fila, minutos: Math.floor((t - salida) / 60_000), horaExtra: null });
      } else if (abierta && !abierta.fin) {
        const min = Math.floor((t - Date.parse(abierta.inicio.registradaEn)) / 60_000);
        if (min >= COMIDA_MIN) items.push({ clase: 'comida_abierta', fila, minutos: min });
      }
    }

    // Si ya tiene horas extra, la tarjeta lo dice (AS6-07): sigue en turno, no es un olvido.
    const sinSalida = items.filter((i) => i.clase === 'sin_salida');
    if (sinSalida.length) {
      const estados = await this.extras.estados(sinSalida.map((i) => i.fila.jornada!.entrada.id));
      for (const i of sinSalida) i.horaExtra = estados.get(i.fila.jornada!.entrada.id) ?? null;
    }

    // Primero quien no llegó, luego jornadas sin cerrar y comidas; dentro de cada clase, lo más viejo.
    const orden = { sin_llegar: 0, sin_salida: 1, comida_abierta: 2 };
    items.sort((a, b) => orden[a.clase] - orden[b.clase] || b.minutos - a.minutos);
    return { fecha, items };
  }

  /** Ficha de un guardia: sus jornadas del mes `AAAA-MM` (AS1-07). */
  async guardia(usuarioId: number, mes: string, alcance: Alcance | null = null): Promise<AsistenciaGuardia> {
    exigirGuardia(alcance, usuarioId);
    const guardia = await this.repo.findGuardia(usuarioId);
    if (!guardia) throw HttpError.notFound('Guardia no encontrado');
    const [rostro, jornadas, asignaciones] = await Promise.all([
      this.rostro(usuarioId),
      this.misJornadas(usuarioId, mes),
      this.misSitios(usuarioId, this.hoy()),
    ]);
    return { guardia, rostro, jornadas, asignaciones };
  }

  /** Qué puede marcar según su última jornada (SIGUIENTES_MARCAS). */
  private permitidas(jornada: MarcacionRow[]): TipoMarcacion[] {
    if (jornada.length === 0 || !this.reciente(jornada[0])) return ['entrada'];
    const ultima = jornada[jornada.length - 1].tipo;
    if (ultima === 'salida' || ultima === 'salida_extra') return SIGUIENTES_MARCAS.salida;
    // La salida exige haber iniciado y terminado la(s) comida(s) del turno, aunque sea en segundos:
    // así se obliga a registrarla (si de verdad comió es otro asunto) y queda constancia (DA-47).
    if (ultima === 'inicio_comida') return ['fin_comida'];
    const { programadaEntrada: e, programadaSalida: s } = jornada[0];
    const completadas = jornada.filter((m) => m.tipo === 'fin_comida').length;
    const horas = e && s ? (s.getTime() - e.getTime()) / 3_600_000 : null;
    return completadas < comidasDelTurno(horas) ? ['inicio_comida'] : ['salida'];
  }

  /** Las marcas permitidas, con la salida final si extendió su horario después de marcar su salida (AS5). */
  private async permitidasAhora(jornada: MarcacionRow[]): Promise<TipoMarcacion[]> {
    const base = this.permitidas(jornada);
    if (
      jornada.at(-1)?.tipo === 'salida' &&
      this.reciente(jornada[0]) &&
      (await this.extras.puedeSalidaFinal(jornada[0].id))
    ) {
      return ['salida_extra'];
    }
    return base;
  }

  /** Una entrada sigue "abierta" hasta JORNADA_MAX_HORAS después. */
  private reciente(entrada: MarcacionRow) {
    return this.ahora().getTime() - entrada.registradaEn.getTime() < JORNADA_MAX_HORAS * 3_600_000;
  }

  private async sitiosMarcables(usuarioId: number): Promise<SitioMarcable[]> {
    const mios = await this.misSitios(usuarioId, this.hoy());
    return mios.map(
      ({ sitio, cliente, turno, horaInicio, horaFin, horas, dias, tipo, desde, hasta, cobertura, pausas }) => ({
        id: sitio.id,
        nombre: sitio.nombre,
        cliente: cliente.nombreComercial,
        lat: sitio.lat,
        lng: sitio.lng,
        radioM: sitio.radioM,
        turno,
        horaInicio,
        horaFin,
        horas,
        dias,
        tipo,
        desde,
        hasta,
        cobertura: cobertura && { motivo: cobertura.motivo, cubreA: cobertura.cubreA },
        pausas,
      }),
    );
  }
}

/** `AAAA-MM-DD` del día siguiente. */
function diaSiguiente(fecha: string) {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Fotos del mismo registro muy distintas entre sí no parecen de la misma persona. */
function validarMismaPersona(descriptores: number[][]) {
  for (let i = 0; i < descriptores.length; i++) {
    for (let j = i + 1; j < descriptores.length; j++) {
      if (distanciaRostro(descriptores[i], descriptores[j]) > UMBRAL_MISMA_PERSONA) {
        throw HttpError.badRequest('Las fotos no parecen de la misma persona', [
          { path: 'descriptores', message: 'Las fotos no parecen de la misma persona. Repite el registro.' },
        ]);
      }
    }
  }
}
