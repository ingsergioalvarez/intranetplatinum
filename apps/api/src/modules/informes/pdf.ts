import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {
  ESTADO_DIA_INFORME_LABEL,
  SALIDA_ANTICIPADA_MIN,
  type EstadoDiaInforme,
  type Informe,
  type InformeDia,
  type InformeGuardia,
  type InformeResumen,
} from '@platinum/shared';
import { env } from '../../config/env';

// ---------- Estilo corporativo ----------

const C = {
  navy: '#121d38',
  brand: '#253b70',
  texto: '#0f172a',
  suave: '#64748b',
  linea: '#d5dbe8',
  zebra: '#f5f7fb',
  caja: '#eef1f8',
  plata: '#c3c9d9',
  blanco: '#ffffff',
};

const ESTADO: Record<EstadoDiaInforme, { fg: string; bg: string }> = {
  completa: { fg: '#166534', bg: '#dcfce7' },
  retardo: { fg: '#92400e', bg: '#fef3c7' },
  falta: { fg: '#991b1b', bg: '#fee2e2' },
  falta_justificada: { fg: '#7c2d12', bg: '#ffedd5' },
  descanso: { fg: '#475569', bg: '#e2e8f0' },
  sin_salida: { fg: '#92400e', bg: '#fef3c7' },
  cerrada: { fg: '#1e3a8a', bg: '#dbeafe' },
  en_curso: { fg: '#1e3a8a', bg: '#dbeafe' },
};

const MARGEN = 40;
const ALTO_CABECERA = 80;
const TOP = ALTO_CABECERA + 22;
const BOTTOM = 52;

// ---------- Formato ----------

const ZONA = env.APP_TIMEZONE;
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, ...o });
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** `05 oct 2026` de una fecha `AAAA-MM-DD`. */
const fechaLarga = (f: string) => `${f.slice(8, 10)} ${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`;
/** `lun 05/10` */
const fechaDia = (f: string) =>
  `${SEMANA[new Date(`${f}T12:00:00Z`).getUTCDay()]} ${f.slice(8, 10)}/${f.slice(5, 7)}`;
const hora = (iso: string | null) =>
  iso ? fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '—';
const fechaHora = (iso: string) =>
  `${fmt({ day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)).replace(/\./g, '')}, ${hora(iso)}`;
const periodo = (i: Informe) => `${fechaLarga(i.desde)} – ${fechaLarga(i.hasta)}`;
/** `8:05` */
const hhmm = (min: number | null) =>
  min === null ? '—' : `${Math.floor(min / 60)}:${String(Math.abs(min) % 60).padStart(2, '0')}`;
const horasTxt = (min: number) => `${hhmm(min)} h`;

// ---------- Utilidades de dibujo ----------

type Doc = InstanceType<typeof PDFDocument>;

interface Col {
  t: string;
  /** Fracción del ancho útil. */
  w: number;
  align?: 'left' | 'right' | 'center';
}
interface Celda {
  texto: string | string[];
  color?: string;
  bold?: boolean;
  pill?: { fg: string; bg: string };
  /** Segunda línea más pequeña (p. ej. los minutos de retardo). */
  detalle?: { texto: string; color: string };
}
interface Fila {
  celdas: Celda[];
  notas?: string[];
  total?: boolean;
}

class Lienzo {
  y = TOP;
  readonly ancho: number;
  readonly alto: number;
  readonly cw: number;

  constructor(readonly doc: Doc) {
    this.ancho = doc.page.width;
    this.alto = doc.page.height;
    this.cw = this.ancho - MARGEN * 2;
  }

  get limite() {
    return this.alto - BOTTOM;
  }

  nuevaPagina() {
    this.doc.addPage();
    this.y = TOP;
  }

  /** Pasa a otra hoja si no cabe `h`. */
  asegurar(h: number) {
    if (this.y + h > this.limite) this.nuevaPagina();
  }

  texto(
    t: string,
    x: number,
    y: number,
    o: { w?: number; size?: number; font?: string; color?: string; align?: 'left' | 'right' | 'center'; lineGap?: number } = {},
  ) {
    this.doc
      .font(o.font ?? 'Helvetica')
      .fontSize(o.size ?? 9)
      .fillColor(o.color ?? C.texto)
      .text(t, x, y, { width: o.w ?? this.cw, align: o.align ?? 'left', lineGap: o.lineGap ?? 0 });
  }

  alturaTexto(t: string, w: number, size: number, font = 'Helvetica') {
    return this.doc.font(font).fontSize(size).heightOfString(t, { width: w });
  }

  seccion(titulo: string) {
    this.asegurar(70);
    this.y += 6;
    this.doc.rect(MARGEN, this.y, 3.5, 13).fill(C.brand);
    this.texto(titulo.toUpperCase(), MARGEN + 10, this.y + 1.5, { size: 10, font: 'Helvetica-Bold', color: C.navy });
    this.doc
      .moveTo(MARGEN + 10 + this.doc.widthOfString(titulo.toUpperCase()) + 8, this.y + 7)
      .lineTo(MARGEN + this.cw, this.y + 7)
      .lineWidth(0.6)
      .strokeColor(C.linea)
      .stroke();
    this.y += 22;
  }

  /** Cuadrícula de datos "etiqueta / valor" en una caja. */
  datos(pares: [string, string][], columnas = 2) {
    const ancho = this.cw / columnas;
    const filas = Math.ceil(pares.length / columnas);
    const alturas = Array.from({ length: filas }, (_, f) =>
      Math.max(
        ...pares.slice(f * columnas, f * columnas + columnas).map(([, v]) => this.alturaTexto(v, ancho - 22, 9.5, 'Helvetica-Bold')),
        11,
      ) + 19,
    );
    const total = alturas.reduce((a, b) => a + b, 0) + 6;
    this.asegurar(total + 4);
    this.doc.roundedRect(MARGEN, this.y, this.cw, total, 4).fillAndStroke(C.caja, C.linea);
    let y = this.y + 6;
    alturas.forEach((h, f) => {
      pares.slice(f * columnas, f * columnas + columnas).forEach(([k, v], c) => {
        const x = MARGEN + c * ancho + 10;
        this.texto(k.toUpperCase(), x, y, { w: ancho - 22, size: 6.5, font: 'Helvetica-Bold', color: C.suave });
        this.texto(v, x, y + 9, { w: ancho - 22, size: 9.5, font: 'Helvetica-Bold', color: C.navy });
      });
      y += h;
    });
    this.y += total + 10;
  }

  /** Tarjetas de totales. */
  tarjetas(items: { valor: string; etiqueta: string; tono?: string }[]) {
    const porFila = this.cw > 600 ? Math.min(items.length, 8) : 4;
    const gap = 6;
    const w = (this.cw - gap * (porFila - 1)) / porFila;
    const h = 44;
    for (let i = 0; i < items.length; i += porFila) {
      this.asegurar(h + 6);
      items.slice(i, i + porFila).forEach((it, c) => {
        const x = MARGEN + c * (w + gap);
        this.doc.roundedRect(x, this.y, w, h, 4).fillAndStroke(C.zebra, C.linea);
        this.doc.rect(x, this.y + 6, 2.5, h - 12).fill(it.tono ?? C.brand);
        this.texto(it.valor, x + 9, this.y + 7, { w: w - 12, size: this.cw > 600 ? 12.5 : 15, font: 'Helvetica-Bold', color: C.navy });
        this.texto(it.etiqueta, x + 9, this.y + 27, { w: w - 12, size: 7, color: C.suave });
      });
      this.y += h + 6;
    }
    this.y += 4;
  }

  tabla(cols: Col[], filas: Fila[], o: { size?: number } = {}) {
    const size = o.size ?? 8;
    const xs: number[] = [];
    const ws = cols.map((c) => c.w * this.cw);
    ws.reduce((x, w) => (xs.push(x), x + w), MARGEN);
    const pad = 4;

    const cabecera = () => {
      this.asegurar(40);
      this.doc.rect(MARGEN, this.y, this.cw, 20).fill(C.navy);
      cols.forEach((c, i) =>
        this.texto(c.t, xs[i] + pad, this.y + 6.5, {
          w: ws[i] - pad * 2,
          size: 7,
          font: 'Helvetica-Bold',
          color: C.blanco,
          align: c.align,
        }),
      );
      this.y += 20;
    };
    cabecera();

    filas.forEach((f, n) => {
      const altos = f.celdas.map((c, i) => {
        const t = Array.isArray(c.texto) ? c.texto.join('\n') : c.texto;
        let h = c.pill ? 12 : this.alturaTexto(t, ws[i] - pad * 2, size, c.bold || f.total ? 'Helvetica-Bold' : 'Helvetica');
        if (c.detalle) h += this.alturaTexto(c.detalle.texto, ws[i] - pad * 2, size - 1.5) + 1;
        return h;
      });
      const notas = (f.notas ?? []).map((t) => this.alturaTexto(t, this.cw - 20, size - 0.5, 'Helvetica-Oblique'));
      const h = Math.max(...altos, 9) + 9 + notas.reduce((a, b) => a + b + 1.5, 0) + (notas.length ? 2 : 0);
      if (this.y + h > this.limite) {
        this.nuevaPagina();
        cabecera();
      }
      const y = this.y;
      if (f.total) {
        this.doc.rect(MARGEN, y, this.cw, h).fill(C.caja);
        this.doc.moveTo(MARGEN, y).lineTo(MARGEN + this.cw, y).lineWidth(1).strokeColor(C.navy).stroke();
      } else if (n % 2 === 1) {
        this.doc.rect(MARGEN, y, this.cw, h).fill(C.zebra);
      }
      f.celdas.forEach((c, i) => {
        const x = xs[i] + pad;
        const w = ws[i] - pad * 2;
        if (c.pill) {
          const t = Array.isArray(c.texto) ? c.texto.join(' ') : c.texto;
          this.doc.roundedRect(x - 1, y + 4, w + 2, 12, 6).fill(c.pill.bg);
          this.texto(t, x - 1, y + 7.2, { w: w + 2, size: 6.6, font: 'Helvetica-Bold', color: c.pill.fg, align: 'center' });
          return;
        }
        const t = Array.isArray(c.texto) ? c.texto.join('\n') : c.texto;
        const fuente = c.bold || f.total ? 'Helvetica-Bold' : 'Helvetica';
        this.texto(t, x, y + 5, { w, size, font: fuente, color: c.color ?? (f.total ? C.navy : C.texto), align: cols[i].align });
        if (c.detalle) {
          this.texto(c.detalle.texto, x, y + 5 + altos[i] - this.alturaTexto(c.detalle.texto, w, size - 1.5) - 1, {
            w,
            size: size - 1.5,
            font: 'Helvetica-Bold',
            color: c.detalle.color,
            align: cols[i].align,
          });
        }
      });
      let yn = y + 5 + Math.max(...altos, 9) + 3;
      (f.notas ?? []).forEach((t, k) => {
        this.doc.rect(MARGEN + 8, yn, 1.5, notas[k]).fill(C.plata);
        this.texto(t, MARGEN + 14, yn, { w: this.cw - 20, size: size - 0.5, font: 'Helvetica-Oblique', color: C.suave });
        yn += notas[k] + 1.5;
      });
      this.y += h;
    });
    this.doc.moveTo(MARGEN, this.y).lineTo(MARGEN + this.cw, this.y).lineWidth(0.6).strokeColor(C.linea).stroke();
    this.y += 10;
  }

  parrafos(items: { cabeza?: string; texto: string }[], viñeta = true) {
    for (const it of items) {
      const h = this.alturaTexto((it.cabeza ? `${it.cabeza}  ` : '') + it.texto, this.cw - 14, 8.5);
      this.asegurar(h + 6);
      if (viñeta) this.doc.circle(MARGEN + 3, this.y + 4.5, 1.6).fill(C.brand);
      if (it.cabeza) {
        this.texto(it.cabeza, MARGEN + 12, this.y, { w: this.cw - 14, size: 8.5, font: 'Helvetica-Bold', color: C.navy });
        const w = this.doc.font('Helvetica-Bold').fontSize(8.5).widthOfString(`${it.cabeza}  `);
        this.doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(C.texto)
          .text(it.texto, MARGEN + 12 + w, this.y, { width: this.cw - 14 - w, indent: 0 });
        // Las líneas siguientes a la primera quedan alineadas con la viñeta; es aceptable para textos cortos.
      } else {
        this.texto(it.texto, MARGEN + 12, this.y, { w: this.cw - 14, size: 8.5 });
      }
      this.y += h + 4;
    }
    this.y += 4;
  }

  caja(titulo: string, lineas: string[]) {
    const w = this.cw - 24;
    const hs = lineas.map((l) => this.alturaTexto(l, w - 10, 7.8));
    const total = hs.reduce((a, b) => a + b + 2.5, 0) + 30;
    this.asegurar(total + 6);
    this.doc.roundedRect(MARGEN, this.y, this.cw, total, 4).fillAndStroke(C.zebra, C.linea);
    this.texto(titulo.toUpperCase(), MARGEN + 12, this.y + 9, { size: 7.5, font: 'Helvetica-Bold', color: C.brand });
    let y = this.y + 22;
    lineas.forEach((l, i) => {
      this.doc.circle(MARGEN + 15, y + 3.6, 1.2).fill(C.suave);
      this.texto(l, MARGEN + 22, y, { w: w - 10, size: 7.8, color: '#334155' });
      y += hs[i] + 2.5;
    });
    this.y += total + 10;
  }

  firmas(titulos: [string, string][]) {
    const alto = 72;
    this.asegurar(alto + 24);
    this.y += 8;
    const gap = 26;
    const w = (this.cw - gap * (titulos.length - 1)) / titulos.length;
    titulos.forEach(([rol, leyenda], i) => {
      const x = MARGEN + i * (w + gap);
      this.doc.moveTo(x, this.y + 40).lineTo(x + w, this.y + 40).lineWidth(0.8).strokeColor(C.navy).stroke();
      this.texto(rol, x, this.y + 45, { w, size: 9, font: 'Helvetica-Bold', color: C.navy, align: 'center' });
      this.texto(leyenda, x, this.y + 57, { w, size: 7.5, color: C.suave, align: 'center' });
    });
    this.y += alto;
  }
}

// ---------- Contenido ----------

const resumenTarjetas = (r: InformeResumen) => [
  { valor: String(r.programados), etiqueta: 'Días programados' },
  { valor: String(r.trabajados), etiqueta: 'Días trabajados', tono: '#16a34a' },
  { valor: String(r.faltas), etiqueta: 'Faltas', tono: r.faltas ? '#dc2626' : C.plata },
  { valor: String(r.justificadas), etiqueta: 'Faltas justificadas', tono: C.plata },
  { valor: String(r.retardos), etiqueta: `Retardos (${r.retardoMin} min)`, tono: r.retardos ? '#d97706' : C.plata },
  { valor: String(r.salidasAntes), etiqueta: 'Salidas antes de hora', tono: r.salidasAntes ? '#d97706' : C.plata },
  { valor: String(r.comidas), etiqueta: 'Comidas registradas', tono: C.plata },
  { valor: horasTxt(r.minutosTrabajados), etiqueta: `de ${horasTxt(r.minutosEsperados)} esperadas` },
];

function filaDia(d: InformeDia): Fila {
  const est = ESTADO[d.estado];
  const retardo = (d.retardoMin ?? 0) > 10 && d.estado === 'retardo';
  const anticipada = (d.salidaAnticipadaMin ?? 0) >= SALIDA_ANTICIPADA_MIN;
  return {
    celdas: [
      { texto: fechaDia(d.fecha), bold: true },
      { texto: d.sitio ? `${d.sitio}${d.cobertura ? ' (cobertura)' : ''}` : '—' },
      { texto: d.horario ?? (d.estado === 'descanso' ? 'Descanso' : '—'), color: d.horario ? C.texto : C.suave },
      {
        texto: hora(d.entrada),
        detalle: retardo ? { texto: `+${d.retardoMin} min`, color: '#b45309' } : undefined,
      },
      { texto: d.comidas.length ? d.comidas.map((c) => `${hora(c.inicio)} – ${hora(c.fin)}`) : '—', color: C.suave },
      {
        texto: hora(d.salida),
        detalle: anticipada ? { texto: `-${d.salidaAnticipadaMin} min`, color: '#b45309' } : undefined,
      },
      { texto: hhmm(d.minutos), bold: true },
      { texto: ESTADO_DIA_INFORME_LABEL[d.estado], pill: est },
    ],
    notas: d.notas,
  };
}

const COLS_DIA: Col[] = [
  { t: 'FECHA', w: 0.1 },
  { t: 'SITIO', w: 0.18 },
  { t: 'HORARIO', w: 0.14 },
  { t: 'ENTRADA', w: 0.1 },
  { t: 'COMIDA', w: 0.14 },
  { t: 'SALIDA', w: 0.09 },
  { t: 'HORAS', w: 0.08, align: 'right' },
  { t: 'ESTADO', w: 0.17, align: 'center' },
];

function hojaGuardia(l: Lienzo, g: InformeGuardia, tituloDatos = 'Datos del guardia') {
  l.seccion(tituloDatos);
  l.datos([
    ['Nombre', g.nombre],
    ['Correo', g.email],
    ['Sitio', g.sitios.join(', ') || '—'],
    ['Supervisor', g.supervisores.join(', ') || 'Sin supervisor asignado'],
    ['Turno', g.turnos.join('  |  ') || '—'],
  ]);
  l.seccion('Resumen del periodo');
  l.tarjetas(resumenTarjetas(g.resumen));
  l.seccion('Detalle día por día');
  if (g.dias.length === 0) {
    l.texto('Sin turnos programados ni jornadas registradas en el periodo.', MARGEN, l.y, { size: 9, color: C.suave });
    l.y += 22;
  } else {
    l.tabla(COLS_DIA, g.dias.map(filaDia));
  }
}

function resumenGeneral(l: Lienzo, i: Informe) {
  const d = i.datos;
  l.seccion('Resumen general');
  l.tarjetas([{ valor: String(d.guardias.length), etiqueta: 'Guardias en el reporte' }, ...resumenTarjetas(d.resumen).slice(0, 7)]);

  l.seccion('Asistencia por guardia');
  const cols: Col[] = [
    { t: 'GUARDIA', w: 0.22 },
    { t: 'SITIO', w: 0.2 },
    { t: 'PROGR.', w: 0.07, align: 'right' },
    { t: 'TRAB.', w: 0.07, align: 'right' },
    { t: 'FALTAS', w: 0.07, align: 'right' },
    { t: 'JUST.', w: 0.07, align: 'right' },
    { t: 'RETARDOS (MIN)', w: 0.1, align: 'right' },
    { t: 'SAL. ANT.', w: 0.07, align: 'right' },
    { t: 'HORAS / ESPERADAS', w: 0.13, align: 'right' },
  ];
  const fila = (nombre: string, sitios: string, r: InformeResumen, total = false): Fila => ({
    total,
    celdas: [
      { texto: nombre, bold: true },
      { texto: sitios },
      { texto: String(r.programados) },
      { texto: String(r.trabajados) },
      { texto: String(r.faltas), color: r.faltas ? '#b91c1c' : undefined, bold: r.faltas > 0 },
      { texto: String(r.justificadas) },
      { texto: r.retardos ? `${r.retardos} (${r.retardoMin})` : '0', color: r.retardos ? '#b45309' : undefined },
      { texto: String(r.salidasAntes) },
      { texto: `${hhmm(r.minutosTrabajados)} / ${hhmm(r.minutosEsperados)}` },
    ],
  });
  if (d.guardias.length === 0) {
    l.texto('No hay guardias con turnos o jornadas en el periodo.', MARGEN, l.y, { size: 9, color: C.suave });
    l.y += 22;
  } else {
    l.tabla(cols, [
      ...d.guardias.map((g) => fila(g.nombre, g.sitios.join(', ') || '—', g.resumen)),
      fila('TOTAL', '', d.resumen, true),
    ]);
  }

  if (d.porSitio.length > 0) {
    l.seccion('Subtotales por sitio');
    l.tabla(
      [
        { t: 'SITIO', w: 0.42 },
        { t: 'GUARDIAS', w: 0.08, align: 'right' },
        { t: 'PROGR.', w: 0.07, align: 'right' },
        { t: 'TRAB.', w: 0.07, align: 'right' },
        { t: 'FALTAS', w: 0.07, align: 'right' },
        { t: 'RETARDOS', w: 0.09, align: 'right' },
        { t: 'HORAS / ESPERADAS', w: 0.2, align: 'right' },
      ],
      d.porSitio.map((s) => ({
        celdas: [
          { texto: s.sitio, bold: true },
          { texto: String(s.guardias) },
          { texto: String(s.resumen.programados) },
          { texto: String(s.resumen.trabajados) },
          { texto: String(s.resumen.faltas), color: s.resumen.faltas ? '#b91c1c' : undefined },
          { texto: String(s.resumen.retardos) },
          { texto: `${hhmm(s.resumen.minutosTrabajados)} / ${hhmm(s.resumen.minutosEsperados)}` },
        ],
      })),
    );
  }
}

// ---------- Cabecera y pie (se dibujan al final, ya con el total de hojas) ----------

function cabeceraYPie(doc: Doc, i: Informe, url: string, qr: Buffer, pagina: number, total: number) {
  const W = doc.page.width;
  const H = doc.page.height;
  const margenes = doc.page.margins;
  const bottom = margenes.bottom;
  margenes.bottom = 0; // para escribir en el pie sin que se abra otra hoja

  doc.rect(0, 0, W, ALTO_CABECERA).fill(C.navy);
  doc.rect(0, ALTO_CABECERA, W, 3).fill(C.plata);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(C.blanco).text('PLATINUM AGENCY', MARGEN, 15, { width: W / 2, characterSpacing: 1.5 });
  doc.font('Helvetica').fontSize(6.5).fillColor('#9fb0d6').text('SEGURIDAD FÍSICA INTRAMUROS', MARGEN, 35, { characterSpacing: 2 });
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.blanco).text(
    `REPORTE OFICIAL DE ASISTENCIA · ${i.tipo === 'personal' ? 'PERSONAL' : 'GENERAL'}`,
    MARGEN,
    50,
    { width: W - MARGEN * 2 - 230, lineBreak: false },
  );
  doc.font('Helvetica').fontSize(8).fillColor('#c9d3ee').text(i.datos.alcance, MARGEN, 65, {
    width: W - MARGEN * 2 - 230,
    lineBreak: false,
    ellipsis: true,
  });

  // Folio, periodo y código (derecha) junto al QR.
  const xq = W - MARGEN - 62;
  const xt = xq - 8 - 190;
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(C.blanco).text(i.folio, xt, 14, { width: 190, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#c9d3ee').text(`Periodo: ${periodo(i)}`, xt, 31, { width: 190, align: 'right', lineBreak: false });
  doc.text(`Código de verificación: ${i.codigo}`, xt, 43, { width: 190, align: 'right', lineBreak: false });
  doc.text(`Emitido: ${fechaHora(i.createdAt)}`, xt, 55, { width: 190, align: 'right', lineBreak: false });
  if (i.reemplaza) {
    doc.font('Helvetica-Bold').fillColor('#fcd34d').text(`Reemplaza al folio ${i.reemplaza.folio}`, xt, 67, {
      width: 190,
      align: 'right',
      lineBreak: false,
    });
  }
  doc.roundedRect(xq - 2, 8, 66, 66, 3).fill(C.blanco);
  doc.image(qr, xq + 1, 11, { width: 60, height: 60 });

  // Pie
  doc.moveTo(MARGEN, H - 40).lineTo(W - MARGEN, H - 40).lineWidth(0.6).strokeColor(C.linea).stroke();
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.navy).text(`${i.folio}  ·  ${i.codigo}`, MARGEN, H - 34, { width: W / 2, lineBreak: false });
  doc.font('Helvetica').fontSize(6.8).fillColor(C.suave);
  doc.text('Documento interno de Platinum Agency. Las horas las registra el servidor y no son editables.', MARGEN, H - 24, {
    width: W - MARGEN * 2,
    lineBreak: false,
  });
  doc.text(`Verifica su autenticidad en ${url.split('?')[0]}`, MARGEN, H - 15, { width: W - MARGEN * 2, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy).text(`Página ${pagina} de ${total}`, W - MARGEN - 90, H - 34, {
    width: 90,
    align: 'right',
    lineBreak: false,
  });
  margenes.bottom = bottom;
}

/** PDF oficial del reporte congelado (Carta; vertical el personal, horizontal el general). */
export async function generarPdf(i: Informe, url: string): Promise<Buffer> {
  const qr = await QRCode.toBuffer(url, { margin: 0, width: 240, errorCorrectionLevel: 'M', color: { dark: C.navy, light: '#ffffff' } });
  const doc = new PDFDocument({
    size: 'LETTER',
    layout: i.tipo === 'general' ? 'landscape' : 'portrait',
    margins: { top: TOP, bottom: BOTTOM, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: {
      Title: `Reporte de asistencia ${i.folio}`,
      Author: 'Platinum Agency',
      Subject: `${i.datos.alcance} · ${periodo(i)}`,
      Keywords: `${i.folio}, ${i.codigo}`,
      Creator: 'Intranet Platinum',
    },
  });
  const trozos: Buffer[] = [];
  doc.on('data', (t: Buffer) => trozos.push(t));
  const fin = new Promise<Buffer>((ok, ko) => {
    doc.on('end', () => ok(Buffer.concat(trozos)));
    doc.on('error', ko);
  });

  const l = new Lienzo(doc);
  const d = i.datos;

  // Datos de emisión
  const emision: [string, string][] = [
    ['Periodo', periodo(i)],
    ...(i.tipo === 'general' ? ([['Alcance', d.alcance]] as [string, string][]) : []),
    ['Generó', i.generadoPor ?? '—'],
    ['Emisión (hora del servidor)', fechaHora(i.createdAt)],
    ['Reemplaza al folio', i.reemplaza?.folio ?? 'Ninguno'],
  ];
  l.datos(emision, l.cw > 600 ? emision.length : 2);

  if (i.tipo === 'personal') {
    const g = d.guardias[0];
    if (g) hojaGuardia(l, g);
  } else {
    resumenGeneral(l, i);
  }

  if (d.hechos.length > 0) {
    l.seccion('Hechos relevantes');
    l.parrafos(d.hechos.map((h) => ({ cabeza: `${fechaHora(h.en)} · ${h.guardia}`, texto: h.texto })));
  }
  l.seccion('Criterios aplicados');
  l.caja('Cómo se calculó este reporte', d.criterios);

  if (i.incluirFirmas) {
    l.seccion('Firmas');
    l.firmas(
      i.tipo === 'personal'
        ? [
            ['Guardia', 'Enterado y conforme'],
            ['Supervisor', 'Revisó'],
            ['Administración', 'Autorizó'],
          ]
        : [
            ['Elaboró', 'Platinum Agency'],
            ['Supervisor', 'Revisó'],
            ['Administración', 'Autorizó'],
          ],
    );
  }

  if (i.tipo === 'general' && i.incluirDetalle) {
    for (const g of d.guardias) {
      l.nuevaPagina();
      l.texto(`ANEXO · ${g.nombre.toUpperCase()}`, MARGEN, l.y, { size: 11, font: 'Helvetica-Bold', color: C.brand });
      l.y += 20;
      hojaGuardia(l, g);
    }
  }

  const { start, count } = doc.bufferedPageRange();
  for (let p = 0; p < count; p++) {
    doc.switchToPage(start + p);
    cabeceraYPie(doc, i, url, qr, p + 1, count);
  }
  doc.end();
  return fin;
}
