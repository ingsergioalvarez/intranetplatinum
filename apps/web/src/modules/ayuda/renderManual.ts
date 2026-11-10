import { Marked } from 'marked';
import { capturaPorId } from './manuales';

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Id de una sección a partir de su título (para ir a ella desde el índice). */
export const slug = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** Etiqueta y estilo de un recuadro, según lo que dice el texto. */
function tipoDeAviso(texto: string): [string, string] {
  const t = texto.toLowerCase();
  if (t.includes('peligro') || t.includes('emergencia')) return ['emergencia', 'EMERGENCIA'];
  if (t.includes('si algo sale mal')) return ['ayuda', 'SI ALGO SALE MAL'];
  if (t.includes('importante')) return ['importante', 'IMPORTANTE'];
  return ['nota', 'NOTA'];
}

const ETIQUETAS: Record<string, [string, string]> = {
  IMPORTANTE: ['importante', 'IMPORTANTE'],
  NOTA: ['nota', 'NOTA'],
  EMERGENCIA: ['emergencia', 'EMERGENCIA'],
  'SI ALGO SALE MAL': ['ayuda', 'SI ALGO SALE MAL'],
};

/**
 * Un recuadro puede empezar con su etiqueta en negritas (`> **IMPORTANTE:** texto`): esa etiqueta decide el tipo y se
 * quita del texto, porque el recuadro ya la muestra arriba. Sin etiqueta, el tipo sale de las palabras del texto.
 */
function aviso(html: string): { clase: string; etiqueta: string; html: string } {
  const m = html.match(/^<p><strong>(IMPORTANTE|NOTA|EMERGENCIA|SI ALGO SALE MAL):<\/strong>\s*/);
  if (m) {
    const [clase, etiqueta] = ETIQUETAS[m[1]];
    // Sin la etiqueta, el texto debe seguir empezando con mayúscula.
    const resto = html.replace(m[0], '<p>').replace(/^(<p>(?:<strong>|<em>)?)(\p{Ll})/u, (_, a: string, b: string) => a + b.toUpperCase());
    return { clase, etiqueta, html: resto };
  }
  const [clase, etiqueta] = tipoDeAviso(html.replace(/<[^>]+>/g, ' '));
  return { clase, etiqueta, html };
}

export interface ManualRenderizado {
  html: string;
  /** Secciones (títulos de nivel 2) para el índice. */
  secciones: { id: string; titulo: string }[];
}

/**
 * Convierte el texto de un manual a HTML para la pantalla de Ayuda. El texto es propio del proyecto (no lo escribe
 * ningún usuario), por eso no se filtra. Los marcadores `{{captura:ID|descripción}}` se vuelven imagen, o un
 * recuadro de "pendiente" si todavía no existe.
 */
export function renderizarManual(texto: string, prefijo: string): ManualRenderizado {
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const contenido = this.parser.parseInline(tokens);
        const plano = contenido.replace(/<[^>]+>/g, '');
        return depth === 2
          ? `<h2 id="${prefijo}-${slug(plano)}">${contenido}</h2>\n`
          : `<h${depth}>${contenido}</h${depth}>\n`;
      },
      blockquote({ tokens }) {
        const { clase, etiqueta, html } = aviso(this.parser.parse(tokens));
        return `<div class="manual-aviso manual-aviso-${clase}" data-etiqueta="${etiqueta}">${html}</div>\n`;
      },
      // Las tablas anchas se deslizan de lado en el celular en vez de ensanchar la página.
      table(token) {
        const encabezado = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join('');
        // En el celular cada fila se muestra como tarjeta, con el nombre de la columna sobre cada dato.
        const etiquetas = token.header.map((c) => esc(c.text));
        const filas = token.rows
          .map(
            (f) =>
              `<tr>${f.map((c, i) => `<td data-label="${etiquetas[i] ?? ''}">${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`,
          )
          .join('');
        return `<div class="manual-tabla"><table><thead><tr>${encabezado}</tr></thead><tbody>${filas}</tbody></table></div>\n`;
      },
    },
  });

  const conCapturas = texto.replace(/^\{\{captura:([^|}]+)\|([^}]+)\}\}\s*$/gm, (_, id: string, desc: string) => {
    const url = capturaPorId(id);
    return url
      ? `\n\n<figure class="manual-captura"><img src="${url}" alt="${esc(desc)}" loading="lazy"><figcaption>${esc(desc)}</figcaption></figure>\n\n`
      : `\n\n<div class="manual-pendiente"><b>Captura pendiente</b><span>${esc(desc)}</span></div>\n\n`;
  });

  const tokens = marked.lexer(conCapturas);
  const secciones = tokens
    .filter((t) => t.type === 'heading' && t.depth === 2)
    .map((t) => ({ id: `${prefijo}-${slug((t as { text: string }).text)}`, titulo: (t as { text: string }).text }));
  // El primer título (H1) es el nombre del archivo; la pantalla ya tiene su propio título.
  const primero = tokens.findIndex((t) => t.type === 'heading' && t.depth === 1);
  if (primero >= 0) tokens.splice(primero, 1);
  return { html: marked.parser(tokens), secciones };
}
