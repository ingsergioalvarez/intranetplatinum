/**
 * Validación de un SVG subido por un usuario (ícono de empresa, C-07). Un SVG puede traer código, así que se
 * rechaza lo que ejecuta o carga cosas de fuera. Es una defensa más: además se sirve con
 * `Content-Security-Policy: sandbox` y la web lo muestra siempre con `<img>` (donde no corren scripts).
 */
export const SVG_MAX_BYTES = 300 * 1024;

const PROHIBIDO: [RegExp, string][] = [
  [/<script/i, 'scripts'],
  [/<foreignobject/i, 'contenido incrustado (foreignObject)'],
  [/<(iframe|embed|object|audio|video|canvas)\b/i, 'contenido incrustado'],
  [/<!doctype/i, 'declaraciones DOCTYPE'],
  [/<!entity/i, 'entidades'],
  [/\son[a-z]+\s*=/i, 'eventos (onclick, onload…)'],
  [/javascript:/i, 'enlaces javascript:'],
  [/data:\s*text\/html/i, 'HTML incrustado'],
  [/(?:xlink:)?href\s*=\s*["']\s*(?:https?:)?\/\//i, 'recursos externos'],
  [/@import/i, 'hojas de estilo externas'],
  [/url\(\s*["']?\s*(?:https?:)?\/\//i, 'recursos externos'],
];

export type ResultadoSvg = { ok: true } | { ok: false; motivo: string };

export function validarSvg(contenido: Buffer): ResultadoSvg {
  if (contenido.length === 0) return { ok: false, motivo: 'El archivo está vacío' };
  if (contenido.length > SVG_MAX_BYTES) return { ok: false, motivo: 'El SVG pesa más de 300 KB' };
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(contenido);
  } catch {
    return { ok: false, motivo: 'El archivo no es un SVG válido' };
  }
  // Puede empezar con BOM, declaración XML y comentarios; después debe venir <svg.
  const sinBom = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const sinPrologo = sinBom
    .replace(/^\s*<\?xml[^>]*\?>/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trimStart();
  if (!/^<svg[\s>]/i.test(sinPrologo) || !/<\/svg\s*>\s*$/i.test(sinPrologo)) {
    return { ok: false, motivo: 'El archivo no es un SVG válido' };
  }
  for (const [patron, nombre] of PROHIBIDO) {
    if (patron.test(texto)) return { ok: false, motivo: `El SVG contiene ${nombre}, que no se permite` };
  }
  return { ok: true };
}
