/**
 * Arma el manual de usuario en PDF (A-44). Lee los `.md` de `docs/manual/`, los convierte a una página HTML con el
 * estilo de `manual.css` y la imprime a PDF con Microsoft Edge sin ventana (modo "headless").
 *
 * Uso: `npm run manual` desde la raíz. Salida: `docs/manual/pdf/manual-<rol>.pdf` (solo local: no se sube a git ni
 * se publica; el manual se lee dentro de la app, en Ayuda).
 * Con `--html` solo deja la página HTML en la carpeta temporal y muestra su ruta (para revisar el diseño).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Marked } from 'marked';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANUAL = join(RAIZ, 'docs', 'manual');
const CAPTURAS = join(MANUAL, 'capturas');
const SALIDA = join(MANUAL, 'pdf');
const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'manual.css'), 'utf8');
const ICONO = pathToFileURL(join(RAIZ, 'apps', 'web', 'public', 'favicon.svg')).href;

const soloHtml = process.argv.includes('--html');

/** Cada manual junta partes (archivos `.md`). Los que aún no existen se omiten. */
const MANUALES = [
  {
    id: 'guardia',
    titulo: 'Manual del Guardia',
    subtitulo: 'Cómo checar, reportar y pedir ayuda',
    para: 'Guardias',
    partes: [
      { archivo: 'comun.md', titulo: 'Parte común: instalar, entrar y usar tu cuenta' },
      { archivo: 'guardia.md', titulo: 'Tu trabajo como guardia' },
    ],
  },
];

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hoy = () => new Date().toLocaleDateString('sv-SE');

function encontrarEdge() {
  const candidatos = [
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  const ruta = candidatos.find((c) => existsSync(c));
  if (!ruta) throw new Error('No se encontró Microsoft Edge. Define EDGE_PATH con la ruta de msedge.exe.');
  return ruta;
}

/** Etiqueta y estilo de un recuadro, según lo que dice el texto. */
function tipoDeAviso(texto) {
  const t = texto.toLowerCase();
  if (t.includes('peligro') || t.includes('emergencia')) return ['emergencia', 'EMERGENCIA'];
  if (t.includes('si algo sale mal')) return ['ayuda', 'SI ALGO SALE MAL'];
  if (t.includes('importante')) return ['importante', 'IMPORTANTE'];
  return ['nota', 'NOTA'];
}

function crearConversor() {
  let figura = 0;
  const marked = new Marked({
    gfm: true,
    renderer: {
      blockquote({ tokens }) {
        const html = this.parser.parse(tokens);
        const [clase, etiqueta] = tipoDeAviso(html.replace(/<[^>]+>/g, ' '));
        return `<div class="aviso aviso-${clase}" data-etiqueta="${etiqueta}">${html}</div>\n`;
      },
    },
  });

  /** Los marcadores `{{captura:ID|descripción}}` se vuelven imagen, o un recuadro de pendiente si no existe. */
  const conCapturas = (md) =>
    md.replace(/^\{\{captura:([^|}]+)\|([^}]+)\}\}\s*$/gm, (_, id, desc) => {
      const archivo = join(CAPTURAS, `${id}.png`);
      if (existsSync(archivo)) {
        figura += 1;
        return `\n\n<figure class="captura"><img src="${pathToFileURL(archivo).href}" alt="${esc(desc)}"><figcaption>Figura ${figura}. ${esc(desc)}.</figcaption></figure>\n\n`;
      }
      return `\n\n<div class="pendiente"><b>CAPTURA PENDIENTE</b><span>${esc(id)}: ${esc(desc)}</span></div>\n\n`;
    });

  return (md) => {
    const tokens = marked.lexer(conCapturas(md));
    const secciones = tokens.filter((t) => t.type === 'heading' && t.depth === 2).map((t) => t.text);
    // El primer título (H1) lo pone la parte; se quita del cuerpo.
    const cuerpo = tokens.filter((t, i) => !(i === tokens.findIndex((x) => x.type === 'heading' && x.depth === 1) && t.type === 'heading'));
    return { html: marked.parser(cuerpo), secciones };
  };
}

function armarHtml(manual, version) {
  const convertir = crearConversor();
  const partes = manual.partes
    .filter((p) => existsSync(join(MANUAL, p.archivo)))
    .map((p) => ({ ...p, ...convertir(readFileSync(join(MANUAL, p.archivo), 'utf8')) }));

  const indice = partes
    .map(
      (p) =>
        `<h3>${esc(p.titulo)}</h3><ol>${p.secciones.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`,
    )
    .join('');

  const css = CSS.replaceAll('__TITULO__', manual.titulo).replaceAll('__VERSION__', version);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(manual.titulo)}</title><style>${css}</style></head>
<body>
<section class="portada">
  <div class="banda">
    <div class="escudo"><img src="${ICONO}" alt=""></div>
    <div class="marca">Platinum Intranet<span>Seguridad intramuros</span></div>
  </div>
  <div class="titulo">
    <h1>${esc(manual.titulo)}</h1>
    <div class="barra"></div>
    <div class="subtitulo">${esc(manual.subtitulo)}</div>
  </div>
  <div class="datos">
    <div><b>Para</b><span>${esc(manual.para)}</span></div>
    <div><b>Versión</b><span>${version}</span></div>
    <div><b>Incluye</b><span>${partes.map((p) => esc(p.titulo.split(':')[0])).join(' + ')}</span></div>
  </div>
  <div class="pie">Platinum Agency</div>
</section>
<section class="indice"><h2>Contenido</h2>${indice}</section>
${partes.map((p) => `<section class="parte"><h1>${esc(p.titulo)}</h1>${p.html}</section>`).join('\n')}
</body></html>`;
}

function imprimir(htmlRuta, pdfRuta) {
  const perfil = mkdtempSync(join(tmpdir(), 'edge-manual-'));
  try {
    execFileSync(
      encontrarEdge(),
      [
        '--headless=new',
        '--disable-gpu',
        `--user-data-dir=${perfil}`,
        '--allow-file-access-from-files',
        '--no-pdf-header-footer',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=10000',
        `--print-to-pdf=${pdfRuta}`,
        pathToFileURL(htmlRuta).href,
      ],
      { stdio: 'ignore', timeout: 120_000 },
    );
  } finally {
    rmSync(perfil, { recursive: true, force: true });
  }
}

const version = hoy();
const trabajo = mkdtempSync(join(tmpdir(), 'manual-'));
mkdirSync(SALIDA, { recursive: true });

for (const manual of MANUALES) {
  if (!manual.partes.some((p) => existsSync(join(MANUAL, p.archivo)))) continue;
  const htmlRuta = join(trabajo, `manual-${manual.id}.html`);
  writeFileSync(htmlRuta, armarHtml(manual, version), 'utf8');
  if (soloHtml) {
    console.log(htmlRuta);
    continue;
  }
  const pdfRuta = join(SALIDA, `manual-${manual.id}.pdf`);
  imprimir(htmlRuta, pdfRuta);
  console.log(`${pdfRuta} (${Math.round(statSync(pdfRuta).size / 1024)} KB)`);
}
