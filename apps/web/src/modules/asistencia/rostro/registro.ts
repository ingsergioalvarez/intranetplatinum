import type { Captura } from './EscanerRostro';
import type { Objetivo } from './calidad';

/**
 * Pasos del registro (AS1-15): de frente, mirando un poco arriba, a la izquierda, a la derecha y
 * bajando un poco la cabeza. Variar el ángulo mejora el reconocimiento al marcar. Arriba y abajo se
 * miden contra la foto de frente de la misma persona.
 */
export const PASOS_REGISTRO: { texto: string; objetivo: (previas: Captura[]) => Objetivo }[] = [
  { texto: 'Mira de frente', objetivo: () => ({ tipo: 'frente' }) },
  {
    texto: 'Mira un poco hacia arriba',
    objetivo: (previas) => ({ tipo: 'vertical', sentido: 'arriba', base: previas[0]?.cabeceo ?? null }),
  },
  { texto: 'Gira un poco hacia la flecha', objetivo: () => ({ tipo: 'lado', signo: 1 }) },
  { texto: 'Gira un poco hacia la flecha', objetivo: () => ({ tipo: 'lado', signo: -1 }) },
  {
    texto: 'Baja un poco la cabeza',
    objetivo: (previas) => ({ tipo: 'vertical', sentido: 'abajo', base: previas[0]?.cabeceo ?? null }),
  },
];

/** Formulario multipart del registro: los vectores y una foto por muestra. */
export function formularioRostro(capturas: Captura[]) {
  const form = new FormData();
  form.append('descriptores', JSON.stringify(capturas.map((c) => c.descriptor)));
  capturas.forEach((c, i) => form.append('fotos', c.foto, `rostro-${i + 1}.jpg`));
  if (capturas.some((c) => c.sinLentes)) form.append('sinLentes', 'true');
  return form;
}
