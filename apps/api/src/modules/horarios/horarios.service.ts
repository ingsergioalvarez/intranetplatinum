import { diasEntre, sumarDiasFecha, trabajaEl, type HorarioPdfQuery } from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, type AccionCtx } from '../../core';
import { horarioDe } from '../informes/calculo';
import type { InformesRepository } from '../informes/informes.repository';
import { exigirGuardia, guardiaEnAlcance, type Alcance } from '../sitios/alcance';
import type { TurnoProgramado } from '../asistencia/vigilancia';
import { generarHorarioPdf, type HorarioGuardia } from './horarios.pdf';

/**
 * Horario de guardias en PDF (A-55): un apoyo para supervisor y admin, nunca para el guardia (el horario
 * válido es el de la app, que cambia). Se arma con los mismos turnos y coberturas que usa el calendario.
 */
export class HorariosService extends BaseService {
  constructor(
    private readonly repo: InformesRepository,
    private readonly audit: AuditLogger,
    private readonly ahora: () => Date = () => new Date(),
  ) {
    super();
  }

  /** Lo que trabaja un guardia ese día: sus turnos que tocan, sin los que quedan en pausa por una cobertura. */
  private turnosDelDia(fecha: string, turnos: TurnoProgramado[]) {
    return turnos
      .filter((t) => trabajaEl(fecha, t.patron) && !t.pausas?.some((p) => fecha >= p.desde && fecha <= p.hasta))
      .map((t) => ({
        sitio: t.sitio.nombre,
        horario: horarioDe(t.patron) ?? '—',
        cobertura: !!t.coberturaId,
      }));
  }

  async pdf(
    q: HorarioPdfQuery,
    ctx: AccionCtx,
    alcance: Alcance | null = null,
  ): Promise<{ buffer: Buffer; nombre: string }> {
    const ids = q.guardias ? [...new Set(q.guardias.split(',').map(Number))] : null;
    ids?.forEach((id) => exigirGuardia(alcance, id));
    let alcanceTexto = 'Todos los guardias';

    if (q.sitioId) {
      if (alcance && !alcance.sitioIds.has(q.sitioId)) throw HttpError.notFound('Sitio no encontrado');
      const sitio = (await this.repo.sitios([q.sitioId]))[0];
      if (!sitio) throw HttpError.notFound('Sitio no encontrado');
      alcanceTexto = `Sitio: ${sitio.nombre}`;
    }

    const personas = (
      await this.repo.guardias(ids ?? (alcance ? [...alcance.guardiaIds] : null))
    ).filter((g) => guardiaEnAlcance(alcance, g.id));
    if (ids && personas.length === 0) throw HttpError.notFound('Guardia no encontrado');
    if (ids) {
      alcanceTexto = personas.length === 1 ? `Guardia: ${personas[0].nombre}` : `${personas.length} guardias`;
    }

    const turnos = await this.repo.turnos(q.desde, q.hasta);
    const fechas = Array.from({ length: diasEntre(q.desde, q.hasta) }, (_, i) => sumarDiasFecha(q.desde, i));

    const guardias: HorarioGuardia[] = [];
    for (const g of personas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) {
      const suyos = turnos.filter((t) => t.guardia.id === g.id);
      // Sin guardias elegidos, solo salen quienes tienen turnos (en el sitio, si se eligió uno).
      if (!ids && !suyos.some((t) => !q.sitioId || t.sitio.id === q.sitioId)) continue;
      guardias.push({ nombre: g.nombre, dias: fechas.map((fecha) => ({ fecha, turnos: this.turnosDelDia(fecha, suyos) })) });
    }

    const generador = (await this.repo.guardia(ctx.actorId))?.nombre ?? 'Administración';
    const buffer = await generarHorarioPdf({
      desde: q.desde,
      hasta: q.hasta,
      alcance: alcanceTexto,
      guardias,
      generadoPor: generador,
      generadoEn: this.ahora(),
    });
    await this.audit.registrarAccion(ctx, 'horarios.descargar_pdf', 'horarios', ids?.length === 1 ? ids[0] : 0, {
      desde: q.desde,
      hasta: q.hasta,
      guardias: guardias.length,
      sitioId: q.sitioId ?? null,
    });
    return { buffer, nombre: `horario_${q.desde}_a_${q.hasta}.pdf` };
  }
}
