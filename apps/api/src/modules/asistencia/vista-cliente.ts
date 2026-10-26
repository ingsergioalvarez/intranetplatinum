import {
  type AlertaMarcacion,
  type AsistenciaGuardia,
  type FilaAsistencia,
  type Jornada,
  type Marcacion,
} from '@platinum/shared';
import type { Alcance } from '../sitios/alcance';

/**
 * Lo que ve el cliente del portal (DA-48): asistencia operativa de sus guardias en SUS sitios, sin
 * nada de biometría ni de otros clientes. Se aplica en el servidor: esconderlo solo en la pantalla no
 * basta porque la respuesta de la API llega completa.
 */

/** Alertas de reconocimiento facial: control interno de la empresa, no del cliente. */
const ALERTAS_BIOMETRICAS: AlertaMarcacion[] = [
  'rostro_no_coincide',
  'sin_rostro_registrado',
  'rostro_pendiente',
  'rostro_rechazado',
  'sin_lentes_declarado',
];

const sinBiometria = (alertas: AlertaMarcacion[]) => alertas.filter((a) => !ALERTAS_BIOMETRICAS.includes(a));

function marcaParaCliente(m: Marcacion): Marcacion {
  return { ...m, alertas: sinBiometria(m.alertas), rostro: null, rostroAprobadoEn: null };
}

export function jornadaParaCliente(j: Jornada): Jornada {
  const opcional = (m: Marcacion | null) => (m ? marcaParaCliente(m) : null);
  return {
    ...j,
    entrada: marcaParaCliente(j.entrada),
    inicioComida: opcional(j.inicioComida),
    finComida: opcional(j.finComida),
    comidas: j.comidas.map((c) => ({ inicio: marcaParaCliente(c.inicio), fin: opcional(c.fin) })),
    salida: opcional(j.salida),
    alertas: sinBiometria(j.alertas),
  };
}

export const filaParaCliente = (f: FilaAsistencia): FilaAsistencia => ({
  ...f,
  jornada: f.jornada && jornadaParaCliente(f.jornada),
});

/**
 * Ficha del guardia para el cliente: solo sus jornadas y sitios (no los de otros clientes) y sin el
 * rostro registrado.
 */
export function fichaParaCliente(ficha: AsistenciaGuardia, alcance: Alcance | null): AsistenciaGuardia {
  const suyo = (sitioId: number | undefined) =>
    !alcance || (sitioId !== undefined && alcance.sitioIds.has(sitioId));
  return {
    ...ficha,
    rostro: null,
    jornadas: ficha.jornadas.filter((j) => suyo(j.sitio?.id)).map(jornadaParaCliente),
    asignaciones: ficha.asignaciones.filter((a) => suyo(a.sitio.id)),
  };
}
