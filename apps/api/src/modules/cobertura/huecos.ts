import { horaLegible, sumarDiasFecha } from '@platinum/shared';
import { hoyISO } from '../../core';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type { CoberturaRepository } from './cobertura.repository';
import type { CoberturaService } from './cobertura.service';

/** Días hacia adelante (desde mañana) que se revisan. */
const DIAS_ADELANTE = 7;
/** Cada cuánto se revisa (el aviso de un sitio sale una sola vez al día). */
const CADA_MS = 30 * 60_000;

/** `mié 28 oct` */
const diaCorto = (fecha: string) =>
  new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${fecha}T12:00:00Z`))
    .replace(/\./g, '');

/**
 * Avisa al supervisor del sitio (sin supervisor, al admin) de los turnos sin cubrir de los próximos
 * días, una vez al día por sitio (AS6-04). Lo de hoy ya lo avisan "no se presentó" y "sin salida".
 */
export class AvisosHuecos {
  private ultima = 0;

  constructor(
    private readonly service: CoberturaService,
    private readonly repo: CoberturaRepository,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async revisar() {
    const ahora = this.ahora();
    if (ahora.getTime() - this.ultima < CADA_MS) return;
    this.ultima = ahora.getTime();
    const hoy = hoyISO(undefined, ahora);
    const desde = sumarDiasFecha(hoy, 1);
    const resumen = await this.service.resumen({ desde, hasta: sumarDiasFecha(hoy, DIAS_ADELANTE) }, null);
    for (const s of resumen.sitios) {
      const huecos = s.dias.flatMap((d) =>
        d.estados.flatMap((e, i) => (e === 'sin_cubrir' ? [{ fecha: d.fecha, turno: s.turnos[i] }] : [])),
      );
      if (huecos.length === 0) continue;
      if (!(await this.repo.marcarEnviado(`huecos:${s.sitio.id}:${hoy}`))) continue;
      const primero = huecos[0];
      const n = huecos.length;
      await this.avisar(await this.repo.revisoresDe(s.sitio.id), {
        tipo: 'cobertura',
        titulo: n === 1 ? 'Turno sin cubrir' : 'Turnos sin cubrir',
        mensaje: `${s.sitio.nombre}: ${n} ${n === 1 ? 'turno sin cubrir' : 'turnos sin cubrir'} en los próximos ${DIAS_ADELANTE} días (el primero: ${diaCorto(primero.fecha)}, ${horaLegible(primero.turno.horaInicio)})`,
        ruta: `/asistencia/calendario?sitio=${s.sitio.id}&dia=${primero.fecha}`,
      });
    }
  }
}
