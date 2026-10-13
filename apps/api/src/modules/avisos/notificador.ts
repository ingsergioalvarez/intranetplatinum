import {
  ESTATUS_REPORTE_LABEL,
  PRIORIDAD_REPORTE_LABEL,
  avisaACliente,
  avisaASupervisor,
  resolverDestino,
  type EstatusReporte,
  type ReporteDetalle,
} from '@platinum/shared';
import type { AvisosRepository } from './avisos.repository';

/** Datos del reporte que usan los avisos. */
type ReporteAviso = Pick<
  ReporteDetalle,
  'id' | 'folio' | 'titulo' | 'prioridad' | 'sitio' | 'cliente' | 'creadoPor'
>;

/**
 * Decide a quién avisar de lo que pasa con un reporte (D-016) y lo registra.
 * Nunca debe romper la operación del reporte: los errores se registran en consola.
 */
export interface NotificadorReportes {
  reporteCreado(reporte: ReporteAviso, actorId: number): Promise<void>;
  estatusCambiado(reporte: ReporteAviso, nuevo: EstatusReporte, actorId: number): Promise<void>;
  comentarioAgregado(reporte: ReporteAviso, actorId: number, actorNombre: string): Promise<void>;
}

/** Sin avisos (pruebas o cuando no se inyecta). */
export const notificadorNulo: NotificadorReportes = {
  reporteCreado: async () => undefined,
  estatusCambiado: async () => undefined,
  comentarioAgregado: async () => undefined,
};

export class NotificadorAvisos implements NotificadorReportes {
  constructor(private readonly repo: AvisosRepository) {}

  async reporteCreado(r: ReporteAviso, actorId: number) {
    await this.seguro('reporteCreado', async () => {
      const destino = resolverDestino(await this.repo.reglasDelCliente(r.cliente.id), r.prioridad);
      if (avisaASupervisor(destino)) {
        await this.repo.crear(this.sin(await this.repo.supervisores(), actorId), {
          tipo: 'reporte_nuevo',
          reporteId: r.id,
          mensaje: `${r.folio} · ${PRIORIDAD_REPORTE_LABEL[r.prioridad]}: ${r.titulo} (${r.sitio.nombre}, ${r.cliente.nombreComercial})`,
        });
      }
      // El correo sale cuando haya SMTP (F3-07); mientras, queda en cola.
      if (avisaACliente(destino)) await this.repo.encolarCorreosCliente(r.id, r.cliente.id);
    });
  }

  async estatusCambiado(r: ReporteAviso, nuevo: EstatusReporte, actorId: number) {
    await this.seguro('estatusCambiado', () =>
      this.repo.crear(this.sin([r.creadoPor.id], actorId), {
        tipo: 'reporte_estatus',
        reporteId: r.id,
        mensaje: `${r.folio} ahora está "${ESTATUS_REPORTE_LABEL[nuevo]}": ${r.titulo}`,
      }),
    );
  }

  /** Comentario sin cambio de estatus: avisa a quien da seguimiento y a quien reportó (salvo al autor). */
  async comentarioAgregado(r: ReporteAviso, actorId: number, actorNombre: string) {
    await this.seguro('comentarioAgregado', async () => {
      const destino = resolverDestino(await this.repo.reglasDelCliente(r.cliente.id), r.prioridad);
      const supervisores = avisaASupervisor(destino) ? await this.repo.supervisores() : [];
      const destinatarios = [...new Set([...supervisores, r.creadoPor.id])];
      await this.repo.crear(this.sin(destinatarios, actorId), {
        tipo: 'reporte_comentario',
        reporteId: r.id,
        mensaje: `${actorNombre} comentó en ${r.folio}: ${r.titulo}`,
      });
    });
  }

  private sin(ids: number[], actorId: number) {
    return ids.filter((id) => id !== actorId);
  }

  private async seguro(evento: string, fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (err) {
      console.error(`[avisos] No se pudo registrar ${evento}`, err);
    }
  }
}
