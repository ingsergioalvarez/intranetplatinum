import {
  ESTADOS_CON_PROBLEMA,
  GRAVEDAD_SITIO_C2,
  TIPOS_ACTIVIDAD_C2,
  TIPOS_DEL_GRUPO,
  type ActividadC2,
  type AvisoSupervisorC2Input,
  type BitacoraC2,
  type C2BitacoraQuery,
  type C2TableroQuery,
  type EmergenciasLista,
  type EstadoSitioC2,
  type FilaAsistencia,
  type EventoC2,
  type NotaC2Input,
  type NotaSitioC2,
  type SitioC2,
  type TableroC2,
  type TipoEventoC2,
} from '@platinum/shared';
import { BaseService, HttpError, hoyISO, inicioDelDia, type AuthUser } from '../../core';
import { env } from '../../config/env';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type { Alcance } from '../sitios/alcance';
import type { C2Repository, EventoRow } from './c2.repository';
import { agruparPorCliente, calcularSitio, type SitioBase } from './estado';

const RUTA = '/c2';
const DIA_MS = 86_400_000;

/** Filas de asistencia de un día (todas, sin límite de cartera): las entrega la asistencia. */
export type DiaDeAsistencia = (fecha: string) => Promise<FilaAsistencia[]>;
/** Emergencias activas que le tocan a quien consulta. */
export type EmergenciasDelC2 = (activas: boolean, user: AuthUser) => Promise<EmergenciasLista>;

const hora = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: env.APP_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

/** "Falta: Luis Gómez (debía entrar 7:00)": lo que dice la bitácora cuando un sitio queda solo o parcial. */
function detalleFalta(s: SitioC2) {
  const faltan = s.guardias.filter((g) => !g.presente);
  return faltan.length ? `Falta: ${faltan.map((g) => `${g.nombre} (debía entrar ${hora(g.horario!.entrada)})`).join(', ')}` : null;
}

/** Una línea de la bitácora tal como la ve quien consulta. */
const aEvento = (f: EventoRow): EventoC2 => ({
  id: f.id,
  tipo: f.tipo,
  sitio: f.sitioNombre ? { id: f.sitioId, nombre: f.sitioNombre, cliente: f.clienteNombre ?? '' } : null,
  detalle: f.detalle,
  usuario: f.usuarioNombre,
  minutos: f.minutos,
  entidad: f.entidad === 'emergencia' || f.entidad === 'reporte' ? { tipo: f.entidad, id: f.entidadId ?? 0 } : null,
  createdAt: f.createdAt.toISOString(),
});

/** Cómo está el sitio, en una frase, para el aviso al supervisor. */
const SITUACION: Partial<Record<EstadoSitioC2, string>> = {
  solo: 'no tiene guardia',
  parcial: 'tiene la guardia incompleta',
  por_llegar: 'está por recibir a su guardia',
};

/**
 * Monitoreo del C2 (A-61, A-80). El estado de cada sitio sale de la asistencia (quién debe estar y quién ya checó). La
 * vigilancia abre y cierra los episodios de "sitio solo", avisa al C2 y deja cada cambio en la bitácora. El C2 actúa
 * con notas y avisos al supervisor; todo queda registrado con quién lo hizo.
 */
export class C2Service extends BaseService {
  constructor(
    private readonly repo: C2Repository,
    private readonly dia: DiaDeAsistencia,
    private readonly emergencias: EmergenciasDelC2,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly ahora: () => Date = () => new Date(),
  ) {
    super();
  }

  /** Estado de cada sitio ahora (sin el SOS), con su cliente. */
  async estados(alcance: Alcance | null = null): Promise<{ base: SitioBase; sitio: SitioC2 }[]> {
    const ahora = this.ahora();
    const hoy = hoyISO(undefined, ahora);
    // Ayer también: un turno de noche que empezó ayer sigue en curso después de medianoche.
    const ayer = hoyISO(undefined, new Date(ahora.getTime() - DIA_MS));
    const [sitios, deHoy, deAyer] = await Promise.all([this.repo.sitios(), this.dia(hoy), this.dia(ayer)]);
    const filas = [...deHoy, ...deAyer];
    return sitios
      .filter((s) => !alcance || alcance.sitioIds.has(s.id))
      .map((base) => ({ base, sitio: calcularSitio(base, filas, ahora) }));
  }

  async tablero({ q, page, limit, problema, agrupar, estado }: C2TableroQuery, user: AuthUser, alcance: Alcance | null = null): Promise<TableroC2> {
    const hoy = hoyISO(undefined, this.ahora());
    const [estados, emergencias, notas] = await Promise.all([
      this.estados(alcance),
      this.emergencias(true, user),
      this.repo.ultimasNotas(inicioDelDia(hoy)),
    ]);
    const conSos = new Set(emergencias.items.map((e) => e.sitio?.id).filter((id): id is number => !!id));
    const items = estados.map(({ base, sitio }) => {
      const nota = notas.get(sitio.id);
      return {
        cliente: base.cliente,
        sitio: {
          ...sitio,
          ...(conSos.has(sitio.id) && { estado: 'sos' as const }),
          ultimaNota: nota ? { texto: nota.texto, autor: nota.autor, en: nota.en.toISOString() } : null,
        },
      };
    });

    const resumen = {
      sitios: items.length,
      solos: items.filter((i) => i.sitio.estado === 'solo').length,
      parciales: items.filter((i) => i.sitio.estado === 'parcial').length,
      sos: emergencias.items.length,
    };

    const texto = q?.toLowerCase();
    const visibles = items
      .filter((i) => (estado ? i.sitio.estado === estado : !problema || ESTADOS_CON_PROBLEMA.includes(i.sitio.estado)))
      .filter(
        (i) =>
          !texto ||
          i.cliente.nombre.toLowerCase().includes(texto) ||
          i.sitio.nombre.toLowerCase().includes(texto) ||
          i.sitio.guardias.some((g) => g.nombre.toLowerCase().includes(texto)),
      );
    const desde = (page - 1) * limit;
    const clientes = agrupar ? agruparPorCliente(visibles) : [];
    // Vista normal: lo peor primero y, a igual gravedad, por cliente y sitio.
    const sitios = agrupar
      ? []
      : visibles.sort(
          (a, b) =>
            GRAVEDAD_SITIO_C2[a.sitio.estado] - GRAVEDAD_SITIO_C2[b.sitio.estado] ||
            a.cliente.nombre.localeCompare(b.cliente.nombre, 'es') ||
            a.sitio.nombre.localeCompare(b.sitio.nombre, 'es'),
        );
    return {
      generadoEn: this.ahora().toISOString(),
      resumen,
      sitiosSolos: items.filter((i) => i.sitio.estado === 'solo').map((i) => i.sitio.id),
      emergencias: emergencias.items,
      sitios: sitios.slice(desde, desde + limit),
      clientes: clientes.slice(desde, desde + limit),
      total: agrupar ? clientes.length : sitios.length,
      page,
      limit,
    };
  }

  /**
   * Cada minuto: abre y cierra los episodios de "sitio solo" y avisa al C2 de cada cambio, y deja en la bitácora cada
   * cambio de estado de los sitios (solo, parcial, cubierto). Solo registra cuando algo cambia, así que un reinicio no
   * repite nada.
   */
  async vigilar(): Promise<void> {
    const ahora = this.ahora();
    const [estados, abiertos, ultimos] = await Promise.all([this.estados(null), this.repo.episodiosAbiertos(), this.repo.ultimosEstados()]);
    const porSitio = new Map(abiertos.map((a) => [a.sitioId, a]));
    const cuentas = await this.repo.usuariosC2();
    const existentes = new Set(estados.map(({ base }) => base.id));

    for (const { base, sitio } of estados) {
      await this.registrarCambio(base, sitio, ultimos.get(base.id), ahora);

      const abierto = porSitio.get(base.id);
      if (sitio.estado === 'solo' && !abierto) {
        await this.repo.abrirEpisodio(base.id, sitio.desde ? new Date(sitio.desde) : ahora);
        await this.avisar(cuentas, {
          tipo: 'c2_sitio',
          titulo: 'Sitio sin guardia',
          mensaje: `${base.cliente.nombre} · ${base.nombre}: no hay guardia en el sitio`,
          ruta: RUTA,
          urgente: true,
        });
      } else if (sitio.estado !== 'solo' && abierto) {
        const cubierto = sitio.guardias.some((g) => g.presente);
        await this.repo.cerrarEpisodio(abierto.id, ahora, cubierto);
        if (cubierto) {
          await this.avisar(cuentas, {
            tipo: 'c2_sitio',
            titulo: 'Sitio con guardia',
            mensaje: `${base.cliente.nombre} · ${base.nombre}: ya hay guardia en el sitio`,
            ruta: RUTA,
          });
        }
      }
    }
    // Sitios que ya no existen (baja) con el episodio abierto: se cierran sin aviso.
    for (const abierto of abiertos) {
      if (!existentes.has(abierto.sitioId)) await this.repo.cerrarEpisodio(abierto.id, ahora, false);
    }
  }

  /** Deja en la bitácora el cambio de estado de un sitio, comparando con lo último que se registró de él. */
  private async registrarCambio(
    base: SitioBase,
    sitio: SitioC2,
    ultimo: { tipo: TipoEventoC2; createdAt: Date } | undefined,
    ahora: Date,
  ) {
    const abierto = ultimo?.tipo === 'sitio_solo' || ultimo?.tipo === 'sitio_parcial';
    const minutos = ultimo ? Math.max(0, Math.round((ahora.getTime() - ultimo.createdAt.getTime()) / 60_000)) : null;
    if (sitio.estado === 'solo' && ultimo?.tipo !== 'sitio_solo') {
      await this.repo.registrarEvento({ tipo: 'sitio_solo', sitioId: base.id, detalle: detalleFalta(sitio), ocurrioEn: sitio.desde ? new Date(sitio.desde) : ahora });
    } else if (sitio.estado === 'parcial' && ultimo?.tipo !== 'sitio_parcial') {
      await this.repo.registrarEvento({ tipo: 'sitio_parcial', sitioId: base.id, detalle: detalleFalta(sitio), ocurrioEn: sitio.desde ? new Date(sitio.desde) : ahora });
    } else if (sitio.estado === 'cubierto' && abierto) {
      const llego = [...sitio.guardias].filter((g) => g.presente).sort((a, b) => (b.entrada ?? '').localeCompare(a.entrada ?? ''))[0];
      await this.repo.registrarEvento({ tipo: 'sitio_cubierto', sitioId: base.id, detalle: llego ? `Llegó ${llego.nombre}` : 'Ya hay guardia', minutos });
    } else if ((sitio.estado === 'sin_turno' || sitio.estado === 'por_llegar') && abierto) {
      await this.repo.registrarEvento({ tipo: 'sitio_cierre', sitioId: base.id, detalle: 'El turno terminó sin que llegara nadie', minutos });
    }
  }

  /** Bitácora de un día (por defecto hoy): lo que pasó con los sitios y lo que hizo el C2. Los más nuevos primero. */
  async bitacora({ fecha, grupo, q }: C2BitacoraQuery, alcance: Alcance | null = null): Promise<BitacoraC2> {
    const dia = fecha ?? hoyISO(undefined, this.ahora());
    const desde = inicioDelDia(dia);
    const filas = await this.repo.eventos(desde, new Date(desde.getTime() + DIA_MS), {
      tipos: grupo === 'todo' ? undefined : TIPOS_DEL_GRUPO[grupo],
      q: q || undefined,
    });
    // Un admin de cartera solo ve lo de sus sitios.
    const visibles = alcance ? filas.filter((f) => f.sitioId !== null && alcance.sitioIds.has(f.sitioId)) : filas;
    return { fecha: dia, items: visibles.map(aEvento) };
  }

  /**
   * Lo último que hizo el C2 hoy (notas, avisos, reportes y respuestas a SOS) sobre los sitios de quien consulta: así
   * supervisor y admin ven al C2 sin entrar a su pantalla (A-82). Los más nuevos primero.
   */
  async actividad(alcance: Alcance | null = null, limite = 12): Promise<ActividadC2> {
    const desde = inicioDelDia(hoyISO(undefined, this.ahora()));
    const filas = await this.repo.eventos(desde, new Date(desde.getTime() + DIA_MS), { tipos: TIPOS_ACTIVIDAD_C2 });
    const visibles = alcance ? filas.filter((f) => f.sitioId !== null && alcance.sitioIds.has(f.sitioId)) : filas;
    return { items: visibles.slice(0, limite).map(aEvento), total: visibles.length };
  }

  /** La última nota del C2 de hoy en cada sitio de quien consulta: se ve en la asistencia del día. */
  async notasDelDia(alcance: Alcance | null = null): Promise<NotaSitioC2[]> {
    const notas = await this.repo.ultimasNotas(inicioDelDia(hoyISO(undefined, this.ahora())));
    return [...notas]
      .filter(([sitioId]) => !alcance || alcance.sitioIds.has(sitioId))
      .map(([sitioId, n]) => ({ sitioId, texto: n.texto, autor: n.autor, en: n.en.toISOString() }));
  }

  // ---------- Acciones del C2 sobre un sitio ----------

  private async sitioDelAlcance(sitioId: number, alcance: Alcance | null) {
    const sitio = await this.repo.sitioInfo(sitioId);
    if (!sitio || (alcance && !alcance.sitioIds.has(sitioId))) throw HttpError.notFound('Sitio no encontrado');
    return sitio;
  }

  /** Nota libre sobre un sitio: queda en la bitácora con quién la escribió. */
  async nota(sitioId: number, { texto }: NotaC2Input, user: AuthUser, alcance: Alcance | null = null) {
    await this.sitioDelAlcance(sitioId, alcance);
    await this.repo.registrarEvento({ tipo: 'nota', sitioId, detalle: texto, usuarioId: user.id });
  }

  /**
   * "Avisar al supervisor": le manda un aviso al supervisor del sitio y a los admin dueños de parte del C2 (con la
   * situación actual del sitio y, si quiere, un texto más) y lo deja en la bitácora.
   */
  async avisarSupervisor(sitioId: number, { mensaje }: AvisoSupervisorC2Input, user: AuthUser, alcance: Alcance | null = null) {
    const sitio = await this.sitioDelAlcance(sitioId, alcance);
    const actual = (await this.estados(alcance)).find((e) => e.base.id === sitioId)?.sitio;
    const situacion = (actual && SITUACION[actual.estado]) ?? 'necesita atención';
    const destinatarios = (await this.repo.destinatariosDeSitio(sitioId)).filter((id) => id !== user.id);
    if (destinatarios.length === 0) throw HttpError.conflict('Este sitio no tiene supervisor ni administrador a quien avisar');
    const texto = `El C2 reporta que ${sitio.nombre} (${sitio.cliente.nombre}) ${situacion}${mensaje ? `. ${mensaje}` : ''}`;
    await this.avisar(destinatarios, { tipo: 'c2_sitio', titulo: 'Aviso del C2', mensaje: texto, ruta: '/', urgente: true });
    await this.repo.registrarEvento({ tipo: 'aviso_supervisor', sitioId, detalle: texto, usuarioId: user.id });
    return { avisados: destinatarios.length };
  }
}
