/**
 * Bloqueo del scroll de la página mientras hay un modal, un visor o la cámara abiertos (A-84). Con solo
 * `overflow: hidden` en el cuerpo, en el celular la pantalla de atrás sigue moviéndose al deslizar sobre el modal. Aquí
 * el cuerpo se fija en su lugar (`position: fixed`) y, al soltar, la página vuelve al punto donde estaba. Cuenta los
 * bloqueos para que dos ventanas abiertas a la vez no se estorben.
 */
let bloqueos = 0;
let guardado: { y: number; estilos: Record<string, string> } | null = null;

const PROPIEDADES = ['position', 'top', 'left', 'right', 'width', 'overflow', 'paddingRight'] as const;

/** Bloquea el scroll de la página y devuelve la función que lo libera (se puede llamar más de una vez). */
export function bloquearScroll(): () => void {
  const estilo = document.body.style;
  if (bloqueos === 0) {
    const y = window.scrollY;
    guardado = { y, estilos: Object.fromEntries(PROPIEDADES.map((p) => [p, estilo[p]])) };
    // En escritorio, al quitar la barra de scroll la página se ensancharía: se compensa con su ancho.
    const barra = window.innerWidth - document.documentElement.clientWidth;
    estilo.position = 'fixed';
    estilo.top = `-${y}px`;
    estilo.left = '0';
    estilo.right = '0';
    estilo.width = '100%';
    estilo.overflow = 'hidden';
    if (barra > 0) estilo.paddingRight = `${barra}px`;
  }
  bloqueos += 1;
  let liberado = false;
  return () => {
    if (liberado) return;
    liberado = true;
    bloqueos -= 1;
    if (bloqueos === 0 && guardado) {
      for (const p of PROPIEDADES) estilo[p] = guardado.estilos[p];
      window.scrollTo(0, guardado.y);
      guardado = null;
    }
  };
}
