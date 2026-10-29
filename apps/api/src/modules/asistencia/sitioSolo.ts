import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import type { DestinoRevision, MarcacionGuardiaRow } from './asistencia.repository';
import { armarJornadas } from './asistencia.service';

/** Un guardia mandado a casa por un retardo (A-25). */
export interface EnviadoACasa {
  eventoId: number;
  guardiaId: number;
  guardiaNombre: string;
  sitioId: number | null;
  sitioNombre: string;
  decididoEn: Date;
}

/** Datos para el recordatorio de "el sitio sigue sin guardia" (A-26). */
export abstract class SitioSoloRepository {
  /** Retardos que terminaron en "mandado a casa" y se decidieron entre esos instantes. */
  abstract enviadosACasa(desde: Date, hasta: Date): Promise<EnviadoACasa[]>;
  /** Marcas de las jornadas que empezaron en ese rango, con su guardia. */
  abstract jornadasDesde(desde: Date, hasta: Date): Promise<MarcacionGuardiaRow[]>;
  /** Registra que ya se envió ese aviso; false si ya se había enviado (no se repite). */
  abstract marcarEnviado(clave: string): Promise<boolean>;
  abstract revisoresDe(destino: DestinoRevision): Promise<number[]>;
}

/** Minutos que se espera a que llegue alguien antes de recordar. */
export const SITIO_SOLO_RECORDATORIO_MIN = 30;
/** Después de este tiempo ya no se recuerda (el turno siguiente decide). */
const HASTA_MS = 6 * 3_600_000;
/** Jornadas de hasta 30 h atrás (turnos de 24 h y un margen). */
const VENTANA_MS = 30 * 3_600_000;

/**
 * Recordatorio a los 30 min (A-26): si mandaron a casa a un guardia y el sitio sigue sin ningún guardia
 * en el sitio, se avisa una sola vez al supervisor y a los administradores, y queda en la bitácora.
 */
export class RecordatorioSitioSolo {
  constructor(
    private readonly repo: SitioSoloRepository,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly bitacora: RegistrarBitacora = sinBitacora,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async revisar() {
    const t = this.ahora().getTime();
    const casos = await this.repo.enviadosACasa(
      new Date(t - HASTA_MS),
      new Date(t - SITIO_SOLO_RECORDATORIO_MIN * 60_000),
    );
    if (casos.length === 0) return;

    const jornadas = armarJornadas(await this.repo.jornadasDesde(new Date(t - VENTANA_MS), new Date(t + 60_000)));
    for (const c of casos) {
      if (c.sitioId === null) continue;
      // Si ya hay alguien en el sitio, no hay nada que recordar.
      if (jornadas.some((j) => !j.salida && j.sitio?.id === c.sitioId)) continue;
      if (!(await this.repo.marcarEnviado(`sitio-solo:${c.eventoId}`))) continue;

      const min = Math.floor((t - c.decididoEn.getTime()) / 60_000);
      await this.avisar(await this.repo.revisoresDe({ sitioId: c.sitioId, guardiaId: c.guardiaId }), {
        tipo: 'marca_alerta',
        titulo: 'El sitio sigue sin guardia',
        mensaje: `${c.sitioNombre}: pasaron ${min} min desde que mandaron a casa a ${c.guardiaNombre} y no hay ningún guardia en el sitio`,
        ruta: `/asistencia/calendario?sitio=${c.sitioId}`,
      });
      await this.bitacora({
        usuarioIds: [c.guardiaId],
        tipo: 'cobertura',
        detalle: `Recordatorio: ${c.sitioNombre} sigue sin guardia ${min} min después de mandar a casa a ${c.guardiaNombre}`,
        sitioId: c.sitioId,
      });
    }
  }
}
