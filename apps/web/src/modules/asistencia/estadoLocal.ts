import {
  comidasDelTurno,
  type EstadoAsistencia,
  type Jornada,
  type Marcacion,
  type TipoMarcacion,
} from '@platinum/shared';
import type { MarcaPendiente } from '../../core/offline/cola';

/** Marca todavía no enviada, con el aspecto de una ya registrada (id negativo = local). */
export const marcaPendienteAMarcacion = (m: MarcaPendiente, n: number): Marcacion => ({
  id: -(n + 1),
  tipo: m.tipo,
  registradaEn: m.capturadaEn,
  sitio: m.sitio,
  lat: m.lat,
  lng: m.lng,
  precisionM: m.precisionM,
  distanciaM: null,
  alertas: ['enviada_sin_conexion'],
  foto: null,
  rostro: null,
  rostroAprobadoEn: null,
});

/**
 * Qué puede checar según lo último que se sabe y lo que ya checó sin conexión (las mismas reglas del
 * servidor): entrada → comida → regreso → (otra comida) → salida. Así el Checador sigue guiando sin
 * red, aunque aún no se hayan enviado las marcas.
 */
export function aplicarPendientes(estado: EstadoAsistencia, pendientes: MarcaPendiente[]): EstadoAsistencia {
  if (pendientes.length === 0) return estado;
  let jornada: Jornada | null = estado.jornada && !estado.jornada.salida ? structuredClone(estado.jornada) : null;
  let completadas = jornada?.comidas.filter((c) => c.fin).length ?? 0;
  let permitidasComidas = jornada?.comidasPermitidas ?? 1;
  let ultima: Jornada | null = estado.jornada;

  pendientes.forEach((p, n) => {
    const m = marcaPendienteAMarcacion(p, n);
    if (p.tipo === 'entrada') {
      permitidasComidas = p.comidas ?? 1;
      completadas = 0;
      jornada = {
        entrada: m,
        inicioComida: null,
        finComida: null,
        comidas: [],
        comidasPermitidas: permitidasComidas,
        salida: null,
        sitio: p.sitio,
        alertas: [...m.alertas],
        programada: null,
        retardoMin: null,
        salidaAnticipadaMin: null,
      };
    } else if (jornada) {
      if (p.tipo === 'inicio_comida') {
        jornada.comidas.push({ inicio: m, fin: null });
        jornada.inicioComida ??= m;
      } else if (p.tipo === 'fin_comida') {
        const abierta = jornada.comidas.at(-1);
        if (abierta && !abierta.fin) abierta.fin = m;
        completadas = jornada.comidas.filter((c) => c.fin).length;
        if (jornada.comidas.length === 1) jornada.finComida = m;
      } else if (p.tipo === 'salida') {
        jornada.salida = m;
      }
    }
    ultima = jornada;
    if (p.tipo === 'salida') jornada = null;
  });

  const abierta = jornada as Jornada | null;
  let permitidas: TipoMarcacion[];
  if (!abierta) permitidas = ['entrada'];
  else if (abierta.comidas.at(-1) && !abierta.comidas.at(-1)!.fin) permitidas = ['fin_comida'];
  else permitidas = completadas < Math.max(permitidasComidas, 1) ? ['inicio_comida'] : ['salida'];

  return { ...estado, jornada: (ultima as Jornada | null) ?? estado.jornada, permitidas };
}

/** Comidas que le tocan en el turno (para guardarlo con la entrada). */
export const comidasDe = (horas: number | null | undefined) => comidasDelTurno(horas ?? null);
