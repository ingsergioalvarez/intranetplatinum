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
/** Carpeta de cada manual dentro de `capturas/`, según la letra con que empieza el ID (`G01-checador` va en `guardia/`). */
const CARPETAS = { C: 'comun', G: 'guardia', S: 'supervisor', A: 'admin', K: 'cliente', O: 'c2' };
const rutaCaptura = (id) => {
  const enCarpeta = join(CAPTURAS, CARPETAS[id[0]] ?? '', `${id}.png`);
  return existsSync(enCarpeta) ? enCarpeta : join(CAPTURAS, `${id}.png`);
};
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
  {
    id: 'supervisor',
    titulo: 'Manual del Supervisor',
    subtitulo: 'Cómo vigilar la asistencia, decidir y cubrir turnos',
    para: 'Supervisores',
    partes: [
      { archivo: 'comun.md', titulo: 'Parte común: instalar, entrar y usar tu cuenta' },
      { archivo: 'supervisor.md', titulo: 'Tu trabajo como supervisor' },
    ],
  },
  {
    id: 'admin',
    titulo: 'Manual del Administrador',
    subtitulo: 'Cómo administrar usuarios, clientes, cobertura y decisiones',
    para: 'Administradores',
    partes: [
      { archivo: 'comun.md', titulo: 'Parte común: instalar, entrar y usar tu cuenta' },
      { archivo: 'supervisor.md', titulo: 'Lo que haces igual que un supervisor' },
      { archivo: 'admin.md', titulo: 'Lo que solo hace el administrador' },
    ],
  },
  {
    id: 'cliente',
    titulo: 'Manual del Cliente',
    subtitulo: 'Cómo ver tus guardias, tus reportes y avisarnos del servicio',
    para: 'Clientes',
    partes: [
      { archivo: 'comun.md', titulo: 'Parte común: instalar, entrar y usar tu cuenta' },
      { archivo: 'cliente.md', titulo: 'Tu cuenta de cliente' },
    ],
  },
  {
    id: 'c2',
    titulo: 'Manual del Operador C2',
    subtitulo: 'Cómo vigilar los sitios, atender los SOS y dejar todo registrado',
    para: 'Operadores del C2',
    partes: [
      { archivo: 'comun.md', titulo: 'Parte común: instalar, entrar y usar tu cuenta' },
      { archivo: 'c2.md', titulo: 'Tu trabajo en el C2' },
    ],
  },
];

const PUNTOS = { rojo: 'Rojo', naranja: 'Naranja', azul: 'Azul', verde: 'Verde', gris: 'Gris', sos: 'SOS' };
/** Iconos de la pantalla del C2 (los mismos de la app, lucide) para las tablas del manual. */
const ICONOS = { llamar: '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>', avisar: '<path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/><path d="M8 6v8"/>', nota: '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>', reporte: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14h6"/><path d="M12 17v-6"/>' };

/** Marcas del manual: `{{punto:rojo}}` y `{{icono:llamar}}` (iguales que en la pantalla de Ayuda de la app). */
const conMarcas = (md) =>
  md
    .replace(/\{\{punto:([a-z]+)\}\}/g, (m, c) =>
      PUNTOS[c] ? `<span class="punto punto-${c}" role="img" aria-label="${PUNTOS[c]}"></span>` : m,
    )
    .replace(/\{\{icono:([a-z]+)\}\}/g, (m, c) =>
      ICONOS[c]
        ? `<svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[c]}</svg>`
        : m,
    );

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

const ETIQUETAS = {
  IMPORTANTE: ['importante', 'IMPORTANTE'],
  NOTA: ['nota', 'NOTA'],
  EMERGENCIA: ['emergencia', 'EMERGENCIA'],
  'SI ALGO SALE MAL': ['ayuda', 'SI ALGO SALE MAL'],
};

/** Una etiqueta en negritas al inicio del recuadro (`> **IMPORTANTE:** texto`) decide el tipo y se quita del texto. */
function aviso(html) {
  const m = html.match(/^<p><strong>(IMPORTANTE|NOTA|EMERGENCIA|SI ALGO SALE MAL):<\/strong>\s*/);
  if (m) {
    const [clase, etiqueta] = ETIQUETAS[m[1]];
    // Sin la etiqueta, el texto debe seguir empezando con mayúscula.
    const resto = html.replace(m[0], '<p>').replace(/^(<p>(?:<strong>|<em>)?)(\p{Ll})/u, (_, a, b) => a + b.toUpperCase());
    return { clase, etiqueta, html: resto };
  }
  const [clase, etiqueta] = tipoDeAviso(html.replace(/<[^>]+>/g, ' '));
  return { clase, etiqueta, html };
}

function crearConversor() {
  let figura = 0;
  const marked = new Marked({
    gfm: true,
    renderer: {
      blockquote({ tokens }) {
        const { clase, etiqueta, html } = aviso(this.parser.parse(tokens));
        return `<div class="aviso aviso-${clase}" data-etiqueta="${etiqueta}">${html}</div>\n`;
      },
    },
  });

  /** Los marcadores `{{captura:ID|descripción}}` se vuelven imagen, o un recuadro de pendiente si no existe. */
  const conCapturas = (md) =>
    md.replace(/^\{\{captura:([^|}]+)\|([^}]+)\}\}\s*$/gm, (_, id, desc) => {
      const archivo = rutaCaptura(id);
      if (existsSync(archivo)) {
        figura += 1;
        return `\n\n<figure class="captura"><img src="${pathToFileURL(archivo).href}" alt="${esc(desc)}"><figcaption>Figura ${figura}. ${esc(desc)}.</figcaption></figure>\n\n`;
      }
      return `\n\n<div class="pendiente"><b>CAPTURA PENDIENTE</b><span>${esc(id)}: ${esc(desc)}</span></div>\n\n`;
    });

  return (md) => {
    const tokens = marked.lexer(conCapturas(conMarcas(md)));
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
    <div class="marca">Grupo Platinum<span>Seguridad Privada</span></div>
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
  <div class="pie">Grupo Platinum</div>
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
    // Edge a veces tarda en soltar sus archivos: limpiar la carpeta temporal no debe tumbar la generación.
    try {
      rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    } catch {
      // Queda en la carpeta temporal del sistema, que se limpia sola.
    }
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
