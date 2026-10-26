import { COMIDA_AVISO_SUPERVISOR_MIN, COMIDA_MIN, horaLegible } from '@platinum/shared';
import { env } from '../../config/env';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import type { DestinoRevision, MarcacionGuardiaRow } from './asistencia.repository';
import { armarJornadas } from './asistencia.service';

/** Datos para los recordatorios de comida (DA-47). */
export abstract class ComidasRepository {
  /** Marcas de las jornadas que empezaron desde ese instante, con su guardia. */
  abstract jornadasDesde(desde: Date, hasta: Date): Promise<MarcacionGuardiaRow[]>;
  /** Registra que ya se envió ese aviso; false si ya se había enviado (no se repite). */
  abstract marcarEnviado(clave: string): Promise<boolean>;
  abstract revisoresDe(destino: DestinoRevision): Promise<number[]>;
}

/** Jornadas de hasta 30 h atrás (turnos de 24 h y un margen). */
const VENTANA_MS = 30 * 3_600_000;
/** El aviso "no registró comida" sale hasta 6 h después de que terminó su turno. */
const FIN_TURNO_MS = 6 * 3_600_000;

const duracion = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

/**
 * Recordatorios de comida (DA-47), cada minuto:
 * - Al guardia: a la mitad del turno si no ha comido (24 h: a 1/3 y 2/3) y cuando se cumple su hora
 *   de comida sin regresar.
 * - Al supervisor: una vez si a los 90 min no ha regresado ("comida sin cierre") y al final del turno
 *   si no registró su comida. Ambos quedan en la bitácora.
 */
export class RecordatoriosComida {
  constructor(
    private readonly repo: ComidasRepository,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly bitacora: RegistrarBitacora = sinBitacora,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async revisar() {
    const ahora = this.ahora();
    const t = ahora.getTime();
    const rows = await this.repo.jornadasDesde(new Date(t - VENTANA_MS), new Date(t + 60_000));
    const guardiaDe = new Map(rows.filter((r) => r.tipo === 'entrada').map((r) => [r.id, r.usuario]));
    for (const j of armarJornadas(rows)) {
      const guardia = guardiaDe.get(j.entrada.id);
      if (!guardia) continue;
      const destino = { sitioId: j.sitio?.id ?? null, guardiaId: guardia.id };
      const sitio = j.sitio?.nombre ?? 'su sitio';
      const abierta = j.comidas.at(-1)?.fin === null && !j.salida ? j.comidas.at(-1)! : null;

      // Hora de comida vencida: al guardia a los 60 min; al supervisor a los 90 min.
      if (abierta) {
        const id = abierta.inicio.id;
        const min = Math.floor((t - Date.parse(abierta.inicio.registradaEn)) / 60_000);
        if (min >= COMIDA_MIN && (await this.repo.marcarEnviado(`comida-guardia:${id}`))) {
          await this.avisar([guardia.id], {
            tipo: 'marca_alerta',
            mensaje: `Ya pasó tu hora de comida (saliste a las ${horaLocal(abierta.inicio.registradaEn)}): registra tu regreso`,
            ruta: '/marcar',
          });
        }
        if (
          min >= COMIDA_AVISO_SUPERVISOR_MIN &&
          (await this.repo.marcarEnviado(`comida-supervisor:${id}`))
        ) {
          await this.avisar(await this.repo.revisoresDe(destino), {
            tipo: 'marca_alerta',
            mensaje: `${guardia.nombre} · ${sitio}: no ha checado su regreso de comida (${duracion(min)})`,
            ruta: `/asistencia/guardias/${guardia.id}?vista=bitacora`,
          });
          await this.bitacora({
            usuarioIds: [guardia.id],
            tipo: 'comida_sin_cierre',
            detalle: `No checó su regreso de comida a tiempo en ${sitio} (salió a las ${horaLocal(abierta.inicio.registradaEn)})`,
            marcacionId: id,
            sitioId: j.sitio?.id ?? null,
          });
        }
      }

      if (!j.programada) continue;
      const entrada = Date.parse(j.programada.entrada);
      const salida = Date.parse(j.programada.salida);
      const tomadas = j.comidas.length;

      // A la mitad del turno (o a 1/3 y 2/3 con dos comidas), si aún no come.
      if (!j.salida && !abierta && t < salida) {
        for (let k = 1; k <= j.comidasPermitidas; k++) {
          const momento = entrada + ((salida - entrada) * k) / (j.comidasPermitidas + 1);
          if (
            tomadas < k &&
            t >= momento &&
            (await this.repo.marcarEnviado(`comida-mitad:${j.entrada.id}:${k}`))
          ) {
            await this.avisar([guardia.id], {
              tipo: 'marca_alerta',
              mensaje:
                j.comidasPermitidas > 1
                  ? `Aún no registras tu comida ${k} de ${j.comidasPermitidas}. Cuando salgas a comer, regístrala en el checador`
                  : 'Aún no registras tu comida. Cuando salgas a comer, regístrala en el checador',
              ruta: '/marcar',
            });
            break;
          }
        }
      }

      // Al final del turno: no registró su comida (o le faltó una).
      const fin = j.salida ? Date.parse(j.salida.registradaEn) : salida;
      if (
        tomadas < j.comidasPermitidas &&
        t >= fin &&
        t - fin < FIN_TURNO_MS &&
        (await this.repo.marcarEnviado(`sin-comida:${j.entrada.id}`))
      ) {
        const cuantas = j.comidasPermitidas > 1 ? ` (${tomadas} de ${j.comidasPermitidas})` : '';
        await this.avisar(await this.repo.revisoresDe(destino), {
          tipo: 'marca_alerta',
          mensaje: `${guardia.nombre} · ${sitio}: no registró su comida${cuantas} en su turno`,
          ruta: `/asistencia/guardias/${guardia.id}?vista=bitacora`,
        });
        await this.bitacora({
          usuarioIds: [guardia.id],
          tipo: 'sin_comida',
          detalle: `No registró su comida${cuantas} en su turno de ${sitio}`,
          marcacionId: j.entrada.id,
          sitioId: j.sitio?.id ?? null,
        });
      }
    }
  }
}

/** `1:05 p.m.` en la zona del negocio. */
function horaLocal(iso: string) {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: env.APP_TIMEZONE,
  }).format(new Date(iso));
  return horaLegible(hhmm);
}
