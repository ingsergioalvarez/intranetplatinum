import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TIPOS_CON_FOTO } from '@platinum/shared';
import { asistenciaService } from '../../modules/asistencia/asistencia.service';
import { ApiError } from '../api';
import { marcarConError, pendientesDe, quitarMarca, useCola, type MarcaPendiente } from './cola';
import { toast } from '../../components/ui';

/** Cuerpo de la marca tal como lo recibe el servidor. */
function enviar(m: MarcaPendiente) {
  const base = {
    idCliente: m.idCliente,
    tipo: m.tipo,
    lat: m.lat,
    lng: m.lng,
    precisionM: m.precisionM,
    horaCelular: m.horaCelular,
    capturadaEn: m.capturadaEn,
  };
  if (!TIPOS_CON_FOTO.includes(m.tipo) || !m.foto) return asistenciaService.marcar(base);
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...base, intento: m.intento })) form.append(k, String(v));
  if (m.descriptor) form.append('descriptor', JSON.stringify(m.descriptor));
  if (m.conLentes) form.append('conLentes', 'true');
  form.append('foto', m.foto, 'marca.jpg');
  return asistenciaService.marcarConFoto(form);
}

let enCurso = false;

/**
 * Envía en orden las checadas guardadas sin conexión (AS2-02). Se detiene si no hay red o sesión, y
 * si el servidor rechaza una (queda marcada con el motivo hasta que se descarte, porque las que
 * siguen dependen de ella). Devuelve cuántas se enviaron.
 */
export async function enviarPendientes(usuarioId: number): Promise<number> {
  if (enCurso) return 0;
  enCurso = true;
  let enviadas = 0;
  try {
    for (const m of pendientesDe(usuarioId)) {
      if (m.error) break;
      try {
        await enviar(m);
        await quitarMarca(m.idCliente);
        enviadas++;
      } catch (err) {
        if (err instanceof ApiError && (err.code === 'NETWORK_ERROR' || err.status === 401 || err.status >= 500)) break;
        await marcarConError(m.idCliente, err instanceof Error ? err.message : 'El servidor la rechazó');
        break;
      }
    }
  } finally {
    enCurso = false;
  }
  return enviadas;
}

const CADA_MS = 30_000;

/** Envía las pendientes al abrir la app, al volver la conexión y cada 30 s mientras haya. */
export function useSincronizacion(usuarioId: number | undefined) {
  const qc = useQueryClient();
  const cola = useCola(usuarioId);
  const hayQueEnviar = cola.some((m) => !m.error);

  useEffect(() => {
    if (usuarioId === undefined) return;
    const intentar = async () => {
      if (!pendientesDe(usuarioId).some((m) => !m.error)) return;
      const n = await enviarPendientes(usuarioId);
      if (n > 0) {
        toast.success(n === 1 ? 'Se envió tu checada guardada' : `Se enviaron ${n} checadas guardadas`);
        void qc.invalidateQueries({ queryKey: ['asistencia'] });
        void qc.invalidateQueries({ queryKey: ['reportes'] });
      }
    };
    void intentar();
    window.addEventListener('online', intentar);
    const t = hayQueEnviar ? setInterval(intentar, CADA_MS) : undefined;
    return () => {
      window.removeEventListener('online', intentar);
      if (t) clearInterval(t);
    };
  }, [usuarioId, hayQueEnviar, qc]);
}
