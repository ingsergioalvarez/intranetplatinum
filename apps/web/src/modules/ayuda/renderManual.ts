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

const PUNTOS: Record<string, string> = { rojo: 'Rojo', naranja: 'Naranja', azul: 'Azul', verde: 'Verde', gris: 'Gris', sos: 'SOS' };
/** Iconos de la pantalla del C2 (los mismos de la app, lucide) para las tablas del manual. */
const ICONOS: Record<string, string> = { llamar: '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>', avisar: '<path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/><path d="M8 6v8"/>', nota: '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>', reporte: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14h6"/><path d="M12 17v-6"/>' };

/**
 * Marcas del manual: `{{punto:rojo}}` dibuja el mismo punto de color que la pantalla del C2 y `{{icono:llamar}}` su icono,
 * en vez de emojis (que se ven distintos en cada equipo y rompen el estilo). El PDF las dibuja igual.
 */
function conMarcas(texto: string): string {
  return texto
    .replace(/\{\{punto:([a-z]+)\}\}/g, (m, c: string) =>
      PUNTOS[c] ? `<span class="manual-punto manual-punto-${c}" role="img" aria-label="${PUNTOS[c]}"></span>` : m,
    )
    .replace(/\{\{icono:([a-z]+)\}\}/g, (m, c: string) =>
      ICONOS[c]
        ? `<svg class="manual-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[c]}</svg>`
        : m,
    );
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
export function renderizarManual(texto: string, prefijo: string, mostrarIds = false): ManualRenderizado {
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

  const conCapturas = conMarcas(texto).replace(/^\{\{captura:([^|}]+)\|([^}]+)\}\}\s*$/gm, (_, id: string, desc: string) => {
    const url = capturaPorId(id);
    return url
      ? `\n\n<figure class="manual-captura"><img src="${url}" alt="${esc(desc)}" loading="lazy"><figcaption>${esc(desc)}</figcaption></figure>\n\n`
      : `\n\n<div class="manual-pendiente"><b>Captura pendiente</b>${mostrarIds ? `<span><code>${esc(id)}.png</code></span>` : ''}<span>${esc(desc)}</span></div>\n\n`;
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
