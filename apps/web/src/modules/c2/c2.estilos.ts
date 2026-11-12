import { useEffect, useState } from 'react';
import type { EstadoSitioC2 } from '@platinum/shared';

/** Colores de cada estado: punto, fondo de la fila, texto y barra del borde izquierdo. */
export const ESTILO: Record<EstadoSitioC2, { punto: string; fila: string; texto: string; barra: string }> = {
  sos: { punto: 'bg-red-600 animate-pulse', fila: 'bg-red-100', texto: 'text-red-700', barra: 'border-l-red-600' },
  solo: { punto: 'bg-red-500', fila: 'bg-red-50', texto: 'text-red-700', barra: 'border-l-red-500' },
  parcial: { punto: 'bg-amber-500', fila: 'bg-amber-50', texto: 'text-amber-800', barra: 'border-l-amber-500' },
  por_llegar: { punto: 'bg-sky-400', fila: 'bg-sky-50/60', texto: 'text-sky-700', barra: 'border-l-sky-400' },
  cubierto: { punto: 'bg-emerald-500', fila: '', texto: 'text-emerald-700', barra: 'border-l-transparent' },
  sin_turno: { punto: 'bg-slate-300', fila: '', texto: 'text-slate-500', barra: 'border-l-transparent' },
};

/** Leyenda de colores: la usan la franja de la pantalla y la ventana de ayuda. */
export const LEYENDA: { estado: EstadoSitioC2; nombre: string; corta: string; explicacion: string }[] = [
  { estado: 'solo', nombre: 'Solo', corta: 'nadie ha checado, ya pasaron 15 min', explicacion: 'Nadie ha checado y ya pasaron 15 minutos de la hora del turno.' },
  { estado: 'parcial', nombre: 'Parcial', corta: 'falta alguno', explicacion: 'Debían estar varios guardias y falta alguno.' },
  { estado: 'por_llegar', nombre: 'Por llegar', corta: 'aún no pasan 15 min', explicacion: 'El turno empezó hace menos de 15 minutos. Todavía no es un problema.' },
  { estado: 'cubierto', nombre: 'Cubierto', corta: 'hay guardia', explicacion: 'Hay guardia en el sitio.' },
  { estado: 'sin_turno', nombre: 'Sin turno', corta: 'a esta hora no debe haber nadie', explicacion: 'A esta hora no debe haber nadie. No es un problema.' },
];

/** Cada cuánto se vuelve a calcular "hace…" aunque no haya datos nuevos. */
export function useAhora(ms = 15_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return ahora;
}

export const minutosHace = (desde: string | null, ahora: number) =>
  desde ? Math.max(0, Math.floor((ahora - Date.parse(desde)) / 60_000)) : null;

export const textoDuracion = (min: number) => (min < 60 ? `${min} m` : `${Math.floor(min / 60)} h ${min % 60} m`);

const CLAVE_AYUDA = 'c2.ayuda.vista';

/** La ayuda se abre sola la primera vez que se entra a la pantalla. */
export const ayudaYaVista = () => {
  try {
    return localStorage.getItem(CLAVE_AYUDA) === '1';
  } catch {
    return false;
  }
};

export const marcarAyudaVista = () => {
  try {
    localStorage.setItem(CLAVE_AYUDA, '1');
  } catch {
    // Sin almacenamiento: la ayuda se abrirá otra vez, sin más.
  }
};
