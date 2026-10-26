import type { Marcacion, TipoMarcacion } from '@platinum/shared';
import { encolarMarca, type MarcaPendiente } from '../../core/offline/cola';
import { horaEstimada } from '../../core/offline/reloj';
import { marcaPendienteAMarcacion } from './estadoLocal';
import type { Ubicacion } from './ubicacion';

export interface DatosSinConexion {
  idCliente: string;
  usuarioId: number;
  tipo: TipoMarcacion;
  ubicacion: Ubicacion;
  sitio: MarcaPendiente['sitio'];
  /** Comidas que le tocan en el turno (en la entrada). */
  comidas?: number;
  foto?: Blob;
  descriptor?: number[];
  sinLentes?: boolean;
  intento?: number;
}

/**
 * Guarda la checada en el celular para enviarla al volver la señal (AS2-02). Lleva la hora estimada con
 * el reloj corregido y la del celular tal cual; el servidor las compara (AS2-04).
 */
export async function guardarSinConexion(d: DatosSinConexion): Promise<Marcacion> {
  const pendiente: MarcaPendiente = {
    idCliente: d.idCliente,
    usuarioId: d.usuarioId,
    tipo: d.tipo,
    lat: d.ubicacion.lat,
    lng: d.ubicacion.lng,
    precisionM: d.ubicacion.precisionM,
    intento: d.intento ?? 1,
    descriptor: d.descriptor,
    sinLentes: d.sinLentes,
    foto: d.foto,
    horaCelular: new Date().toISOString(),
    capturadaEn: horaEstimada().toISOString(),
    sitio: d.sitio,
    comidas: d.comidas,
  };
  await encolarMarca(pendiente);
  return marcaPendienteAMarcacion(pendiente, 0);
}
