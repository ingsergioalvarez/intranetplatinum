import { fileURLToPath } from 'node:url';
import type PDFDocument from 'pdfkit';

/**
 * Piezas de marca de Grupo Platinum para los documentos PDF (A-90): nombre, oficinas, escudo, marca de agua y membrete.
 * Todo vive aquí para que cada documento (reportes de datos, horario y, más adelante, las cartas de A-91) se vea igual
 * y, si cambia una dirección o un teléfono, se cambie en un solo lugar.
 */
type Doc = InstanceType<typeof PDFDocument>;

export const MARCA = {
  nombre: 'GRUPO Platinum',
  lema: 'SEGURIDAD PRIVADA',
  /** Azul del membrete de la hoja oficial (se toma de sus imágenes). */
  azul: '#143251',
  /** Azul claro para texto sobre el azul. */
  azulClaro: '#c9d3ee',
} as const;

export interface Oficina {
  lugar: string;
  /** Dirección en dos renglones. */
  direccion: [string, string];
  telefono: string;
}

/** Oficinas que salen en el pie de los documentos. Por ahora van las dos; después se elige al armar cada documento. */
export const OFICINAS: Oficina[] = [
  {
    lugar: 'Naucalpan',
    direccion: ['Purépechas No. 23, Col. Santa Cruz Acatlán', 'Naucalpan de Juárez, Estado de México, C.P. 53150'],
    telefono: '55 9489 6895',
  },
  {
    lugar: 'Tlalnepantla',
    direccion: ['Cerro de las Campanas No. 3, Col. San Andrés Atenco', 'Tlalnepantla de Baz, Estado de México, C.P. 54040'],
    telefono: '55 2271 0087',
  },
];

// Se pasan como ruta (no como Buffer) para que pdfkit guarde cada imagen una sola vez por documento.
const ruta = (archivo: string) => fileURLToPath(new URL(`../../../assets/marca/${archivo}`, import.meta.url));
// El encabezado de la hoja membretada viene en una sola imagen; se separó en el icono (escudo y letras grises) y la curva
// azul para poder mover el icono sin tocar la curva. `membrete-encabezado.png` es la imagen original completa.
const ICONO = ruta('membrete-icono.png');
const CURVA = ruta('membrete-curva.png');
const AGUA = ruta('marca-de-agua.png');
const ESCUDO = ruta('escudo.png');

const PX_ENCABEZADO = { ancho: 2305, alto: 495 };
/** Recortes de la imagen original, en píxeles: dónde empieza cada uno y cuánto mide. */
const PX_ICONO = { x: 0, y: 59, ancho: 300, alto: 436 };
const PX_CURVA = { x: 500, y: 0, ancho: 1805, alto: 297 };
/** El icono del membrete se dibuja un poco más pequeño que en la imagen original y separado del borde. */
const ESCALA_ICONO = 0.88;
const ARRIBA_ICONO = 10;
const PX_AGUA = { ancho: 1188, alto: 1472 };
const PX_ESCUDO = { ancho: 240, alto: 302 };

/** Alto del encabezado oficial a todo el ancho de la hoja. */
export const altoEncabezado = (anchoHoja: number) => (anchoHoja * PX_ENCABEZADO.alto) / PX_ENCABEZADO.ancho;

/** Alto de la franja azul del pie oficial (con las dos oficinas). */
export const ALTO_PIE_MEMBRETE = 68;

/** Marca de agua: el escudo grande y tenue, centrado y detrás de lo demás. Se dibuja al crear cada hoja. */
export function dibujarMarcaDeAgua(doc: Doc) {
  const W = doc.page.width;
  const H = doc.page.height;
  const alto = Math.min(H * 0.6, (W * 0.62 * PX_AGUA.alto) / PX_AGUA.ancho);
  const ancho = (alto * PX_AGUA.ancho) / PX_AGUA.alto;
  const { x, y } = doc; // dibujar una imagen mueve el cursor; que no afecte al contenido
  doc.save();
  doc.image(AGUA, (W - ancho) / 2, (H - alto) / 2, { width: ancho, height: alto });
  doc.restore();
  doc.x = x;
  doc.y = y;
}

/**
 * Encabezado oficial: la curva azul arriba a la derecha (tal como viene en la hoja de la empresa) y el icono (escudo y
 * letras grises) alineado con el margen del documento, un poco más pequeño. Devuelve el alto que se reserva (el del
 * encabezado original), para que el contenido empiece siempre en el mismo lugar.
 */
export function dibujarEncabezadoOficial(doc: Doc, margen = 40): number {
  const W = doc.page.width;
  const k = W / PX_ENCABEZADO.ancho; // puntos por píxel de la imagen original
  const { x, y } = doc;
  doc.save();
  doc.image(CURVA, PX_CURVA.x * k, PX_CURVA.y * k, { width: PX_CURVA.ancho * k, height: PX_CURVA.alto * k });
  doc.image(ICONO, margen, ARRIBA_ICONO, {
    width: PX_ICONO.ancho * k * ESCALA_ICONO,
    height: PX_ICONO.alto * k * ESCALA_ICONO,
  });
  doc.restore();
  doc.x = x;
  doc.y = y;
  return altoEncabezado(W);
}

/** Escudo suelto (para encabezados compactos). Se ajusta al alto dado y devuelve el ancho que ocupó. */
export function dibujarEscudo(doc: Doc, x: number, y: number, alto: number): number {
  const ancho = (alto * PX_ESCUDO.ancho) / PX_ESCUDO.alto;
  const { x: cx, y: cy } = doc;
  doc.save();
  doc.image(ESCUDO, x, y, { width: ancho, height: alto });
  doc.restore();
  doc.x = cx;
  doc.y = cy;
  return ancho;
}

/**
 * Pie oficial: franja azul que baja hacia la derecha, con las oficinas en dos columnas. Va pegado al borde de abajo.
 * `margen` es el margen lateral del documento.
 */
export function dibujarPieOficial(doc: Doc, margen: number) {
  const W = doc.page.width;
  const H = doc.page.height;
  const h = ALTO_PIE_MEMBRETE;
  const y0 = H - h;
  doc.save();
  doc
    .moveTo(0, y0)
    .bezierCurveTo(W * 0.3, y0 + h * 0.06, W * 0.68, y0 + h * 0.3, W, y0 + h * 0.5)
    .lineTo(W, H)
    .lineTo(0, H)
    .closePath()
    .fill(MARCA.azul);

  const margenes = doc.page.margins;
  const bottom = margenes.bottom;
  margenes.bottom = 0; // para escribir en el pie sin que se abra otra hoja
  const columna = (W - margen * 2) / 2;
  OFICINAS.forEach((o, k) => {
    const x = margen + k * columna;
    const y = H - 14 - 3 * 9;
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#ffffff').text(o.lugar.toUpperCase(), x, y - 1, { width: columna - 10, lineBreak: false, characterSpacing: 0.8 });
    doc.font('Helvetica').fontSize(6.8).fillColor('#ffffff');
    doc.text(o.direccion[0], x, y + 8, { width: columna - 10, lineBreak: false });
    doc.text(`${o.direccion[1]}`, x, y + 16, { width: columna - 10, lineBreak: false });
    doc.text(`Tel. ${o.telefono}`, x, y + 24, { width: columna - 10, lineBreak: false });
  });
  margenes.bottom = bottom;
  doc.restore();
}

/**
 * Encabezado ligero para las hojas que siguen a la primera: escudo, nombre y, a la derecha, lo que identifica al
 * documento (folio, periodo…). Ocupa unos 46 puntos.
 */
export function dibujarCabeceraLigera(
  doc: Doc,
  margen: number,
  derecha: { negrita: string; lineas: string[] },
) {
  const W = doc.page.width;
  const margenes = doc.page.margins;
  const bottom = margenes.bottom;
  margenes.bottom = 0;
  doc.save();
  const anchoEscudo = dibujarEscudo(doc, margen, 8, 32);
  const x = margen + anchoEscudo + 8;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(MARCA.azul).text(MARCA.nombre, x, 13, { lineBreak: false, characterSpacing: 0.6 });
  doc.font('Helvetica').fontSize(6).fillColor('#64748b').text(MARCA.lema, x, 27, { lineBreak: false, characterSpacing: 1.6 });
  const xd = W / 2;
  const wd = W / 2 - margen;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MARCA.azul).text(derecha.negrita, xd, 11, { width: wd, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
  derecha.lineas.forEach((t, k) => doc.text(t, xd, 24 + k * 10, { width: wd, align: 'right', lineBreak: false }));
  doc.moveTo(margen, 46).lineTo(W - margen, 46).lineWidth(1).strokeColor(MARCA.azul).stroke();
  doc.restore();
  margenes.bottom = bottom;
}
