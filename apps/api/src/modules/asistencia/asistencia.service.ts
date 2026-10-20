import {
  JORNADA_MAX_HORAS,
  RADIO_GEOCERCA_M,
  SIGUIENTES_MARCAS,
  distanciaMetros,
  sitioMasCercano,
  type AlertaMarcacion,
  type EstadoAsistencia,
  type Jornada,
  type Marcacion,
  type AsistenciaDiaQuery,
  type AsistenciaGuardia,
  type FilaAsistencia,
  type MarcacionCreate,
  type Paginated,
  type MiSitio,
  type SitioMarcable,
  type TipoMarcacion,
} from '@platinum/shared';
import { BaseService, HttpError, hoyISO, inicioDelDia, type RequestContext } from '../../core';
import type { AsistenciaRepository, MarcacionGuardiaRow, MarcacionRow } from './asistencia.repository';

/** Sitios asignados hoy al guardia (los provee el módulo de sitios). */
export type MisSitiosFn = (usuarioId: number, hoy: string) => Promise<MiSitio[]>;

const toMarcacion = ({
  id,
  tipo,
  registradaEn,
  sitio,
  lat,
  lng,
  precisionM,
  distanciaM,
  alertas,
}: MarcacionRow): Marcacion => ({
  id,
  tipo,
  registradaEn: registradaEn.toISOString(),
  sitio,
  lat,
  lng,
  precisionM,
  distanciaM,
  alertas,
});

/** Agrupa marcas (en orden) por su entrada. Las jornadas salen de la más reciente a la más antigua. */
export function armarJornadas(rows: MarcacionRow[]): Jornada[] {
  const porEntrada = new Map<number, Jornada>();
  for (const r of rows) {
    if (r.tipo === 'entrada') {
      porEntrada.set(r.id, {
        entrada: toMarcacion(r),
        inicioComida: null,
        finComida: null,
        salida: null,
        sitio: r.sitio,
        alertas: [...r.alertas],
      });
      continue;
    }
    const j = r.entradaId !== null ? porEntrada.get(r.entradaId) : undefined;
    if (!j) continue;
    const m = toMarcacion(r);
    if (r.tipo === 'inicio_comida') j.inicioComida = m;
    if (r.tipo === 'fin_comida') j.finComida = m;
    if (r.tipo === 'salida') j.salida = m;
    for (const a of r.alertas) if (!j.alertas.includes(a)) j.alertas.push(a);
  }
  return [...porEntrada.values()].sort((a, b) =>
    b.entrada.registradaEn.localeCompare(a.entrada.registradaEn),
  );
}

const fueraDeOrden = (tipo: TipoMarcacion, permitidas: TipoMarcacion[]) => {
  const mensaje =
    tipo === 'entrada'
      ? 'Ya tienes una entrada registrada. Registra tu salida primero.'
      : permitidas.includes('entrada')
        ? 'Primero registra tu entrada.'
        : tipo === 'fin_comida'
          ? 'Primero registra el inicio de tu comida.'
          : 'Esta marca ya no se puede registrar en tu jornada actual.';
  return new HttpError(409, 'MARCA_FUERA_DE_ORDEN', mensaje);
};

/** Marcas de asistencia del guardia (A-17, Fase 1 parte A). */
export class AsistenciaService extends BaseService {
  constructor(
    private readonly repo: AsistenciaRepository,
    private readonly misSitios: MisSitiosFn,
    private readonly ahora: () => Date = () => new Date(),
    private readonly hoy: () => string = () => hoyISO(),
  ) {
    super();
  }

  async estado(usuarioId: number): Promise<EstadoAsistencia> {
    const [rows, sitios] = await Promise.all([
      this.repo.ultimaJornada(usuarioId),
      this.sitiosMarcables(usuarioId),
    ]);
    return {
      // La última jornada se muestra mientras siga dentro del límite de horas (resumen "Hoy").
      jornada: rows.length && this.reciente(rows[0]) ? armarJornadas(rows)[0] : null,
      permitidas: this.permitidas(rows),
      sitios,
    };
  }

  async marcar(usuarioId: number, data: MarcacionCreate, ctx: RequestContext): Promise<Marcacion> {
    // Reenvío de la misma marca (doble toque o reintento): se devuelve la ya registrada.
    const previa = await this.repo.findByIdCliente(data.idCliente);
    if (previa) {
      if (previa.usuarioId !== usuarioId) throw HttpError.conflict('Identificador de marca repetido');
      return toMarcacion(previa);
    }

    const jornada = await this.repo.ultimaJornada(usuarioId);
    const permitidas = this.permitidas(jornada);
    if (!permitidas.includes(data.tipo)) throw fueraDeOrden(data.tipo, permitidas);

    const punto = { lat: data.lat, lng: data.lng };
    let sitio: { id: number } | null;
    let distanciaM: number | null;
    if (data.tipo === 'entrada') {
      // La entrada fija el sitio de la jornada: el asignado más cercano (DA-01, AS1-04).
      const cercano = sitioMasCercano(await this.sitiosMarcables(usuarioId), punto);
      if (!cercano) {
        throw new HttpError(409, 'SIN_SITIO', 'No tienes un sitio asignado hoy. Avisa a tu supervisor.');
      }
      sitio = cercano.sitio;
      distanciaM = cercano.distanciaM;
    } else {
      // Comida y salida se miden contra el sitio de la entrada.
      sitio = jornada[0].sitio;
      const coords = sitio ? await this.repo.coordenadasSitio(sitio.id) : null;
      distanciaM = coords ? distanciaMetros(punto, coords) : null;
    }

    const alertas: AlertaMarcacion[] = [];
    if (distanciaM === null) alertas.push('sitio_sin_ubicacion');
    else if (distanciaM > RADIO_GEOCERCA_M) alertas.push('fuera_de_rango');
    if (data.precisionM > RADIO_GEOCERCA_M) alertas.push('gps_impreciso');

    const marca = await this.repo.crear({
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
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return toMarcacion(marca);
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
    return armarJornadas(rows);
  }

  /** Marcas de todos los guardias en un día (vista de admin / supervisor, AS1-07). Solo lectura. */
  /**
   * Lista del día (AS1-07): una fila por jornada que empezó ese día y una fila "sin marcas"
   * por cada guardia asignado que no ha marcado. Orden por nombre del guardia. Solo lectura.
   */
  async dia({ fecha, q, soloAlertas, page, limit }: AsistenciaDiaQuery): Promise<Paginated<FilaAsistencia>> {
    const [rows, asignados] = await Promise.all([
      this.repo.jornadasDeTodos(inicioDelDia(fecha), inicioDelDia(diaSiguiente(fecha))),
      this.repo.guardiasAsignados(fecha),
    ]);

    const guardiaDe = new Map<number, MarcacionGuardiaRow['usuario']>();
    for (const r of rows) if (r.tipo === 'entrada') guardiaDe.set(r.id, r.usuario);
    const conJornada: FilaAsistencia[] = armarJornadas(rows).map((jornada) => ({
      guardia: guardiaDe.get(jornada.entrada.id)!,
      sitio: jornada.sitio,
      jornada,
    }));
    const marcaron = new Set(conJornada.map((f) => f.guardia.id));
    const sinMarcas: FilaAsistencia[] = asignados
      .filter((a) => !marcaron.has(a.guardia.id))
      .map(({ guardia, sitio }) => ({ guardia, sitio, jornada: null }));

    const texto = q?.toLowerCase();
    const filas = [...conJornada, ...sinMarcas]
      .filter((f) => !soloAlertas || !!f.jornada?.alertas.length)
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

  /** Ficha de un guardia: sus jornadas del mes `AAAA-MM` (AS1-07). */
  async guardia(usuarioId: number, mes: string): Promise<AsistenciaGuardia> {
    const guardia = await this.repo.findGuardia(usuarioId);
    if (!guardia) throw HttpError.notFound('Guardia no encontrado');
    return { guardia, jornadas: await this.misJornadas(usuarioId, mes) };
  }

  /** Qué puede marcar según su última jornada (SIGUIENTES_MARCAS). */
  private permitidas(jornada: MarcacionRow[]): TipoMarcacion[] {
    if (jornada.length === 0 || !this.reciente(jornada[0])) return ['entrada'];
    return SIGUIENTES_MARCAS[jornada[jornada.length - 1].tipo];
  }

  /** Una entrada sigue "abierta" hasta JORNADA_MAX_HORAS después. */
  private reciente(entrada: MarcacionRow) {
    return this.ahora().getTime() - entrada.registradaEn.getTime() < JORNADA_MAX_HORAS * 3_600_000;
  }

  private async sitiosMarcables(usuarioId: number): Promise<SitioMarcable[]> {
    const mios = await this.misSitios(usuarioId, this.hoy());
    return mios.map(({ sitio, cliente }) => ({
      id: sitio.id,
      nombre: sitio.nombre,
      cliente: cliente.nombreComercial,
      lat: sitio.lat,
      lng: sitio.lng,
    }));
  }
}

/** `AAAA-MM-DD` del día siguiente. */
function diaSiguiente(fecha: string) {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
