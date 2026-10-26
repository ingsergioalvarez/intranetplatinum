import { createHash } from 'node:crypto';
import {
  codigoInforme,
  folioInforme,
  type Informe,
  type InformeDatos,
  type InformeEmitido,
  type InformeResumenFila,
  type InformesQuery,
  type NuevoInformeData,
  type OpcionesInforme,
  type Paginated,
  type VerificacionInforme,
} from '@platinum/shared';
import { env } from '../../config/env';
import { AuditLogger, BaseService, HttpError, hoyISO, inicioDelDia, type AccionCtx, type AuthUser } from '../../core';
import { armarJornadas } from '../asistencia/asistencia.service';
import { sumarDiasFecha } from '@platinum/shared';
import { exigirGuardia, type Alcance } from '../sitios/alcance';
import { calcularInforme, type JornadaDe } from './calculo';
import { generarExcel } from './excel';
import type { InformeRow, InformesRepository } from './informes.repository';
import { generarPdf } from './pdf';

/** JSON con las llaves en orden: MySQL reordena las llaves de un JSON, así que el hash no puede depender de ellas. */
export function canonico(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`)
    .join(',')}}`;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Huella del contenido: no incluye el folio ni la hora, para detectar un reporte idéntico. */
export function huellaDe(x: {
  tipo: string;
  usuarioId: number | null;
  sitioId: number | null;
  incluirDetalle: boolean;
  incluirFirmas: boolean;
  datos: InformeDatos;
}) {
  return sha256(canonico(x));
}

/** Hash oficial del reporte emitido (de aquí sale el código del QR). */
export const hashOficial = (folio: string, creado: Date, huella: string) =>
  sha256(`${folio}|${creado.toISOString()}|${huella}`);

export const urlVerificacion = (folio: string, hash: string) =>
  `${env.APP_URL.replace(/\/$/, '')}/verificar/${folio}?c=${codigoInforme(hash)}`;

const aFila = (r: InformeRow): InformeResumenFila => ({
  id: r.id,
  folio: r.folio,
  tipo: r.tipo,
  alcance: r.datos.alcance,
  guardia: r.usuarioId ? { id: r.usuarioId, nombre: r.usuarioNombre ?? r.datos.guardias[0]?.nombre ?? '' } : null,
  desde: r.desde,
  hasta: r.hasta,
  incluirDetalle: r.incluirDetalle,
  incluirFirmas: r.incluirFirmas,
  generadoPor: r.generadoPor,
  createdAt: r.createdAt.toISOString(),
  codigo: codigoInforme(r.hash),
  reemplaza: r.reemplaza,
  reemplazadoPor: r.reemplazadoPor,
  resumen: r.datos.resumen,
});

/**
 * Reporte oficial de asistencia (DA-52): se calcula con lo que hay al emitirlo, se guarda congelado con
 * folio y hash, y ya no cambia. Solo admin y supervisor (dentro de su alcance).
 */
export class InformesService extends BaseService {
  constructor(
    private readonly repo: InformesRepository,
    private readonly audit: AuditLogger,
    private readonly ahora: () => Date = () => new Date(),
  ) {
    super();
  }

  private hoy() {
    return hoyISO(undefined, this.ahora());
  }

  /** Guardias y sitios que quien consulta puede elegir. */
  async opciones(alcance: Alcance | null): Promise<OpcionesInforme> {
    const [guardias, sitios] = await Promise.all([
      this.repo.guardias(alcance ? [...alcance.guardiaIds] : null),
      this.repo.sitios(alcance ? [...alcance.sitioIds] : null),
    ]);
    return { guardias: guardias.map((g) => ({ id: g.id, nombre: g.nombre })), sitios };
  }

  /** Calcula el contenido con lo que existe hoy (sin guardarlo). */
  private async calcular(d: NuevoInformeData, alcance: Alcance | null): Promise<{ datos: InformeDatos; sitioId: number | null }> {
    let sitioId: number | null = null;
    let alcanceTexto = 'Todos los sitios';
    let personas;
    if (d.tipo === 'personal') {
      exigirGuardia(alcance, d.guardiaId!);
      const g = await this.repo.guardia(d.guardiaId!);
      if (!g) throw HttpError.notFound('Guardia no encontrado');
      personas = [g];
      alcanceTexto = `Guardia: ${g.nombre}`;
    } else {
      if (d.sitioId) {
        if (alcance && !alcance.sitioIds.has(d.sitioId)) throw HttpError.notFound('Sitio no encontrado');
        const [s] = await this.repo.sitios([d.sitioId]);
        if (!s) throw HttpError.notFound('Sitio no encontrado');
        sitioId = s.id;
        alcanceTexto = `Sitio: ${s.nombre}`;
      }
      personas = await this.repo.guardias(alcance ? [...alcance.guardiaIds] : null);
    }

    // Las jornadas se ubican por el día en que empezó el turno: un día de margen por los turnos de noche.
    const desdeMarca = inicioDelDia(sumarDiasFecha(d.desde, -1));
    const hastaMarca = inicioDelDia(sumarDiasFecha(d.hasta, 2));
    const [turnos, marcas, eventos, supervisores] = await Promise.all([
      this.repo.turnos(d.desde, d.hasta),
      this.repo.marcas(desdeMarca, hastaMarca),
      this.repo.eventos(inicioDelDia(d.desde), inicioDelDia(sumarDiasFecha(d.hasta, 1))),
      this.repo.supervisores(),
    ]);
    const ids = new Set(personas.map((p) => p.id));
    const porGuardia = new Map<number, typeof marcas>();
    for (const m of marcas) {
      if (!ids.has(m.usuario.id)) continue;
      porGuardia.set(m.usuario.id, [...(porGuardia.get(m.usuario.id) ?? []), m]);
    }
    const jornadas: JornadaDe[] = [...porGuardia].flatMap(([usuarioId, rows]) =>
      armarJornadas(rows).map((j) => ({ ...j, usuarioId })),
    );
    const datos = calcularInforme({
      tipo: d.tipo,
      desde: d.desde,
      hasta: d.hasta,
      alcance: alcanceTexto,
      guardias: personas,
      turnos,
      jornadas,
      eventos: eventos.filter((e) => ids.has(e.usuarioId)),
      supervisores,
      sitioId,
      hoy: this.hoy(),
      ahora: this.ahora(),
    });
    return { datos, sitioId };
  }

  /** Emite el reporte. Si ya existe uno idéntico lo devuelve en lugar de abrir otro folio. */
  async emitir(d: NuevoInformeData, ctx: AccionCtx, alcance: Alcance | null): Promise<InformeEmitido> {
    if (d.hasta > this.hoy() && d.desde > this.hoy()) {
      throw HttpError.badRequest('El periodo todavía no empieza');
    }
    const { datos, sitioId } = await this.calcular(d, alcance);
    const usuarioId = d.tipo === 'personal' ? d.guardiaId! : null;
    const base = { tipo: d.tipo, usuarioId, sitioId, incluirDetalle: d.incluirDetalle, incluirFirmas: d.incluirFirmas };
    const huella = huellaDe({ ...base, datos });

    const igual = await this.repo.buscarPorHuella(huella);
    if (igual && !igual.reemplazadoPor) return { informe: aFila(igual), existente: true };

    const previo = await this.repo.ultimoDelAlcance({ tipo: d.tipo, usuarioId, sitioId, desde: d.desde, hasta: d.hasta });
    const creado = await this.repo.crear(
      {
        ...base,
        desde: d.desde,
        hasta: d.hasta,
        datos,
        huella,
        generadoPorId: ctx.actorId,
        reemplazaId: previo?.id ?? null,
      },
      (id, en) => {
        const folio = folioInforme(id, en);
        return { folio, hash: hashOficial(folio, en, huella) };
      },
    );
    await this.audit.registrarAccion(ctx, 'informes.emitir', 'informe_asistencia', creado.id, {
      folio: creado.folio,
      tipo: d.tipo,
      desde: d.desde,
      hasta: d.hasta,
      guardiaId: usuarioId,
      sitioId,
      reemplaza: previo?.folio ?? null,
    });
    return { informe: aFila(creado), existente: false };
  }

  /** Un supervisor solo ve los personales de sus guardias y los generales que él emitió. */
  private visible(r: InformeRow, user: AuthUser, alcance: Alcance | null) {
    if (!alcance) return true;
    return r.tipo === 'personal'
      ? r.usuarioId !== null && alcance.guardiaIds.has(r.usuarioId)
      : r.generadoPorId === user.id;
  }

  async listar(q: InformesQuery, user: AuthUser, alcance: Alcance | null): Promise<Paginated<InformeResumenFila>> {
    const { items, total } = await this.repo.listar({
      q: q.q,
      tipo: q.tipo,
      guardiaId: q.guardiaId,
      mes: q.mes,
      visible: alcance ? { guardiaIds: [...alcance.guardiaIds], usuarioId: user.id } : undefined,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return { items: items.map(aFila), total, page: q.page, limit: q.limit };
  }

  private async cargar(id: number, user: AuthUser, alcance: Alcance | null) {
    const r = await this.repo.findById(id);
    if (!r || !this.visible(r, user, alcance)) throw HttpError.notFound('Reporte no encontrado');
    return r;
  }

  async obtener(id: number, user: AuthUser, alcance: Alcance | null): Promise<Informe> {
    const r = await this.cargar(id, user, alcance);
    return { ...aFila(r), datos: r.datos };
  }

  /** PDF oficial o Excel (copia de trabajo) del reporte congelado. */
  async archivo(id: number, formato: 'pdf' | 'excel', user: AuthUser, alcance: Alcance | null) {
    const r = await this.cargar(id, user, alcance);
    const informe: Informe = { ...aFila(r), datos: r.datos };
    const url = urlVerificacion(r.folio, r.hash);
    const nombre = `${r.folio}${formato === 'pdf' ? '.pdf' : '.xlsx'}`;
    if (formato === 'pdf') {
      return { nombre, tipo: 'application/pdf', buffer: await generarPdf(informe, url) };
    }
    return {
      nombre,
      tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await generarExcel(informe, url, r.hash),
    };
  }

  /** Lo que ve quien escanea el QR: solo si el reporte existe y sus totales. */
  async verificar(folio: string, codigo: string | undefined): Promise<VerificacionInforme> {
    const r = await this.repo.findByFolio(folio);
    if (!r) throw HttpError.notFound('No existe un reporte con ese folio');
    const { programados, trabajados, faltas, retardos } = r.datos.resumen;
    return {
      valido: true,
      folio: r.folio,
      tipo: r.tipo,
      desde: r.desde,
      hasta: r.hasta,
      emitidoEn: r.createdAt.toISOString(),
      codigoValido: codigo ? codigo.toUpperCase() === codigoInforme(r.hash) : null,
      vigente: !r.reemplazadoPor,
      reemplazadoPor: r.reemplazadoPor?.folio ?? null,
      resumen: { programados, trabajados, faltas, retardos },
    };
  }
}
