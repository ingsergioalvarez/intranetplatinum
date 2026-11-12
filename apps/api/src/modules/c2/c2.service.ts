import {
  type C2HistorialQuery,
  type C2TableroQuery,
  type EmergenciasLista,
  type FilaAsistencia,
  type HistorialC2,
  type SitioC2,
  type TableroC2,
} from '@platinum/shared';
import { BaseService, hoyISO, inicioDelDia, type AuthUser } from '../../core';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type { Alcance } from '../sitios/alcance';
import type { C2Repository } from './c2.repository';
import { agruparPorCliente, calcularSitio, type SitioBase } from './estado';

const RUTA = '/c2';
const DIA_MS = 86_400_000;

/** Filas de asistencia de un día (todas, sin límite de cartera): las entrega la asistencia. */
export type DiaDeAsistencia = (fecha: string) => Promise<FilaAsistencia[]>;
/** Emergencias activas que le tocan a quien consulta. */
export type EmergenciasDelC2 = (activas: boolean, user: AuthUser) => Promise<EmergenciasLista>;

/**
 * Monitoreo del C2 (A-61). Solo lectura para quien mira: el estado de cada sitio sale de la asistencia (quién debe
 * estar y quién ya checó). La vigilancia abre y cierra los episodios de "sitio solo" y avisa al C2.
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

  async tablero({ q, page, limit }: C2TableroQuery, user: AuthUser, alcance: Alcance | null = null): Promise<TableroC2> {
    const [estados, emergencias] = await Promise.all([this.estados(alcance), this.emergencias(true, user)]);
    const conSos = new Set(emergencias.items.map((e) => e.sitio?.id).filter((id): id is number => !!id));
    const items = estados.map(({ base, sitio }) => ({
      cliente: base.cliente,
      sitio: conSos.has(sitio.id) ? { ...sitio, estado: 'sos' as const } : sitio,
    }));

    const resumen = {
      sitios: items.length,
      solos: items.filter((i) => i.sitio.estado === 'solo').length,
      parciales: items.filter((i) => i.sitio.estado === 'parcial').length,
      sos: emergencias.items.length,
    };

    const texto = q?.toLowerCase();
    const visibles = texto
      ? items.filter(
          (i) =>
            i.cliente.nombre.toLowerCase().includes(texto) ||
            i.sitio.nombre.toLowerCase().includes(texto) ||
            i.sitio.guardias.some((g) => g.nombre.toLowerCase().includes(texto)),
        )
      : items;
    const clientes = agruparPorCliente(visibles);
    return {
      generadoEn: this.ahora().toISOString(),
      resumen,
      sitiosSolos: items.filter((i) => i.sitio.estado === 'solo').map((i) => i.sitio.id),
      emergencias: emergencias.items,
      clientes: clientes.slice((page - 1) * limit, page * limit),
      total: clientes.length,
      page,
      limit,
    };
  }

  /**
   * Abre el episodio de los sitios que se quedaron solos y cierra los de los que ya tienen guardia (o cuyo turno acabó
   * sin cubrirse). Avisa al C2 de cada cambio. Lo llama la vigilancia cada minuto.
   */
  async vigilar(): Promise<void> {
    const ahora = this.ahora();
    const [estados, abiertos] = await Promise.all([this.estados(null), this.repo.episodiosAbiertos()]);
    const porSitio = new Map(abiertos.map((a) => [a.sitioId, a]));
    const cuentas = await this.repo.usuariosC2();
    const existentes = new Set(estados.map(({ base }) => base.id));

    for (const { base, sitio } of estados) {
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

  /** Cuánto tiempo estuvo sin guardia cada sitio en un día (por defecto hoy). */
  async historial({ fecha }: C2HistorialQuery, alcance: Alcance | null = null): Promise<HistorialC2> {
    const ahora = this.ahora();
    const dia = fecha ?? hoyISO(undefined, ahora);
    const desde = inicioDelDia(dia);
    const hasta = new Date(desde.getTime() + DIA_MS);
    const filas = (await this.repo.episodios(desde, hasta)).filter((e) => !alcance || alcance.sitioIds.has(e.sitio.id));
    const items = filas.map((e) => {
      const fin = Math.min((e.fin ?? ahora).getTime(), hasta.getTime());
      const minutos = Math.max(0, Math.floor((fin - Math.max(e.inicio.getTime(), desde.getTime())) / 60_000));
      return {
        id: e.id,
        sitio: e.sitio,
        cliente: e.cliente,
        inicio: e.inicio.toISOString(),
        fin: e.fin?.toISOString() ?? null,
        cubierto: e.cubierto,
        minutos,
      };
    });
    return { fecha: dia, items, totalMinutos: items.reduce((n, i) => n + i.minutos, 0) };
  }
}
