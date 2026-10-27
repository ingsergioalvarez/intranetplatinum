import type { CoberturaQuery, CoberturaSitio, ResumenCobertura, ResumenCoberturaQuery } from '@platinum/shared';
import { HttpError, hoyISO } from '../../core';
import type { TurnoProgramado } from '../asistencia/vigilancia';
import type { TurnosFn } from '../coberturas/coberturas.service';
import type { Alcance } from '../sitios/alcance';
import { calcularCobertura } from './cobertura.calculo';
import type { CoberturaRepository } from './cobertura.repository';

/**
 * Cobertura de un sitio por día y turno (AS6-01, DA-56): quién cubre cada turno y si hay huecos.
 * El supervisor solo ve sus sitios; el admin, todos.
 */
export class CoberturaService {
  constructor(
    private readonly repo: CoberturaRepository,
    private readonly turnos: TurnosFn,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async sitio(q: CoberturaQuery, alcance: Alcance | null): Promise<CoberturaSitio> {
    const sitio = alcance && !alcance.sitioIds.has(q.sitioId) ? null : await this.repo.sitio(q.sitioId);
    if (!sitio) throw HttpError.notFound('Sitio no encontrado');
    const [turnos, reales] = await Promise.all([
      this.turnos(q.desde, q.hasta),
      this.repo.reales(sitio.id, q.desde, q.hasta),
    ]);
    return calcularCobertura({
      sitio,
      desde: q.desde,
      hasta: q.hasta,
      turnos: turnos.filter((t) => t.sitio.id === sitio.id),
      reales,
      ahora: this.ahora(),
    });
  }

  /** Todos los sitios con turnos en el rango (los del supervisor, si lo es): un estado por turno y día. */
  async resumen(q: ResumenCoberturaQuery, alcance: Alcance | null): Promise<ResumenCobertura> {
    const porSitio = new Map<number, { sitio: { id: number; nombre: string }; turnos: TurnoProgramado[] }>();
    for (const t of await this.turnos(q.desde, q.hasta)) {
      if (alcance && !alcance.sitioIds.has(t.sitio.id)) continue;
      const g = porSitio.get(t.sitio.id) ?? { sitio: t.sitio, turnos: [] };
      g.turnos.push(t);
      porSitio.set(t.sitio.id, g);
    }
    const ahora = this.ahora();
    const hoy = hoyISO(undefined, ahora);
    const calculados = await Promise.all(
      [...porSitio.values()].map(async (g) =>
        calcularCobertura({
          sitio: g.sitio,
          desde: q.desde,
          hasta: q.hasta,
          turnos: g.turnos,
          reales: await this.repo.reales(g.sitio.id, q.desde, q.hasta),
          ahora,
        }),
      ),
    );
    const sitios = calculados
      .filter((c) => c.turnos.length > 0)
      .sort((a, b) => a.sitio.nombre.localeCompare(b.sitio.nombre, 'es'))
      .map((c) => ({
        sitio: c.sitio,
        turnos: c.turnos,
        dias: c.dias.map((d) => ({ fecha: d.fecha, estados: d.turnos.map((t) => t.estado) })),
      }));
    const sinCubrir = sitios.reduce(
      (n, s) =>
        n + s.dias.filter((d) => d.fecha >= hoy).reduce((m, d) => m + d.estados.filter((e) => e === 'sin_cubrir').length, 0),
      0,
    );
    return { desde: q.desde, hasta: q.hasta, sitios, sinCubrir };
  }
}
