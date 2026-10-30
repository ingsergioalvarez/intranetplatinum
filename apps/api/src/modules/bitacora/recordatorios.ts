import { TIPOS_JUSTIFICABLES } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { hoyISO, inicioDelDia } from '../../core/time/fechas';
import { PrismaAsistenciaRepository } from '../asistencia/asistencia.repository';
import type { AvisarUsuarios } from '../avisos/avisar';

export interface PendienteRow {
  usuarioId: number;
  sitioId: number | null;
  ocurrioEn: Date;
}

export abstract class RecordatoriosIncidenciasRepository {
  /** Incidencias de asistencia que nadie ha justificado ni decidido, desde esa fecha. */
  abstract pendientes(desde: Date): Promise<PendienteRow[]>;
  /** Supervisor del sitio; sin supervisor, los admin. */
  abstract revisoresDe(destino: { sitioId: number | null; guardiaId: number }): Promise<number[]>;
  abstract admins(): Promise<number[]>;
  /** El usuario ya recibió ese aviso (por título) desde esa fecha. */
  abstract yaAvisado(usuarioId: number, titulo: string, desde: Date): Promise<boolean>;
}

export class PrismaRecordatoriosIncidenciasRepository extends RecordatoriosIncidenciasRepository {
  private readonly asistencia = new PrismaAsistenciaRepository();

  async pendientes(desde: Date) {
    return getPrisma().eventoBitacora.findMany({
      where: {
        tipo: { in: [...TIPOS_JUSTIFICABLES] },
        justificadoEn: null,
        decision: null,
        ocurrioEn: { gte: desde },
        usuario: { activo: true, deletedAt: null },
      },
      select: { usuarioId: true, sitioId: true, ocurrioEn: true },
    });
  }

  revisoresDe(destino: { sitioId: number | null; guardiaId: number }) {
    return this.asistencia.revisoresDe({ sitioId: destino.sitioId, guardiaId: destino.guardiaId });
  }

  admins() {
    return this.asistencia.admins();
  }

  async yaAvisado(usuarioId: number, titulo: string, desde: Date) {
    const a = await getPrisma().aviso.findFirst({
      where: { usuarioId, titulo, createdAt: { gte: desde } },
      select: { id: true },
    });
    return !!a;
  }
}

const TITULO = 'Incidencias sin atender';
const TITULO_ADMIN = 'Incidencias sin atender más de 24 h';
/** Horas del día (zona del negocio) en que se recuerda: inicio de la jornada y a media jornada. */
export const HORAS_RECORDATORIO = [8, 14] as const;
const ATRASO_ESCALA_MS = 24 * 3_600_000;
const VENTANA_MS = 60 * 24 * 3_600_000;

/**
 * Recordatorios de incidencias sin atender (A-51): una falta, retardo o salida sin justificar ni decidir
 * no cuenta hasta que el supervisor la revise, así que se le recuerda a las 8:00 y a las 14:00 (un solo
 * aviso con el total) hasta que la atienda. Si lleva más de 24 h, se avisa también a los admin.
 * Corre cada minuto; no repite el aviso dentro de la misma hora de recordatorio.
 */
export class RecordatorioIncidencias {
  constructor(
    private readonly repo: RecordatoriosIncidenciasRepository,
    private readonly avisar: AvisarUsuarios,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async revisar() {
    const ahora = this.ahora();
    const inicioDia = inicioDelDia(hoyISO(undefined, ahora));
    const minutos = Math.floor((ahora.getTime() - inicioDia.getTime()) / 60_000);
    const hora = [...HORAS_RECORDATORIO].reverse().find((h) => minutos >= h * 60);
    if (hora === undefined) return;
    const desdeHora = new Date(inicioDia.getTime() + hora * 3_600_000);

    const pendientes = await this.repo.pendientes(new Date(ahora.getTime() - VENTANA_MS));
    if (pendientes.length === 0) return;

    const porRevisor = new Map<number, number>();
    const cache = new Map<string, number[]>();
    for (const p of pendientes) {
      const clave = `${p.sitioId ?? 0}-${p.usuarioId}`;
      let revisores = cache.get(clave);
      if (!revisores) {
        revisores = await this.repo.revisoresDe({ sitioId: p.sitioId, guardiaId: p.usuarioId });
        cache.set(clave, revisores);
      }
      for (const r of revisores) porRevisor.set(r, (porRevisor.get(r) ?? 0) + 1);
    }

    for (const [usuarioId, total] of porRevisor) {
      if (await this.repo.yaAvisado(usuarioId, TITULO, desdeHora)) continue;
      await this.avisar([usuarioId], {
        tipo: 'retardo',
        titulo: TITULO,
        mensaje:
          total === 1
            ? 'Tienes 1 incidencia de asistencia sin atender. No cuenta hasta que la confirmes o la justifiques.'
            : `Tienes ${total} incidencias de asistencia sin atender. No cuentan hasta que las confirmes o las justifiques.`,
        ruta: '/asistencia/incidencias',
      });
    }

    // Más de 24 h sin atender: también los admin (una vez al día).
    const viejas = pendientes.filter((p) => ahora.getTime() - p.ocurrioEn.getTime() >= ATRASO_ESCALA_MS).length;
    if (viejas === 0) return;
    for (const admin of await this.repo.admins()) {
      if (await this.repo.yaAvisado(admin, TITULO_ADMIN, inicioDia)) continue;
      await this.avisar([admin], {
        tipo: 'retardo',
        titulo: TITULO_ADMIN,
        mensaje:
          viejas === 1
            ? 'Hay 1 incidencia de asistencia con más de 24 h sin que el supervisor la atienda.'
            : `Hay ${viejas} incidencias de asistencia con más de 24 h sin que el supervisor las atienda.`,
        ruta: '/asistencia/incidencias',
      });
    }
  }
}
