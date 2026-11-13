import PDFDocument from 'pdfkit';
import { env } from '../../config/env';
import {
  ALTO_PIE_MEMBRETE,
  MARCA,
  dibujarCabeceraLigera,
  dibujarEncabezadoOficial,
  dibujarMarcaDeAgua,
  dibujarPieOficial,
} from '../../core/marca/marca';
import {
  BOTTOM,
  COLORES_PDF as C,
  Lienzo,
  MARGEN,
  TOP,
  disposicionOficial,
  fechaDia,
  fechaLarga,
  pieInfo,
  type Col,
  type Fila,
} from '../informes/pdf';

/** Franja bajo el encabezado oficial de la primera hoja: título, alcance y periodo. */
const ALTO_FRANJA_HORARIO = 38;

/** Lo que trabaja un guardia un día: puede ser en más de un sitio (cobertura). */
export interface TurnoDelDia {
  sitio: string;
  /** `08:00 – 20:00`, o solo la hora de entrada si el turno no tiene hora de salida. */
  horario: string;
  cobertura: boolean;
}

export interface HorarioGuardia {
  nombre: string;
  dias: { fecha: string; turnos: TurnoDelDia[] }[];
}

export interface DatosHorario {
  desde: string;
  hasta: string;
  /** "Todos los guardias", "Sitio: Poetas 7", "Guardia: Juan Pérez"… */
  alcance: string;
  guardias: HorarioGuardia[];
  generadoPor: string;
  generadoEn: Date;
}

const ZONA = env.APP_TIMEZONE;
const fechaHora = (d: Date) =>
  `${new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric' })
    .format(d)
    .replace(/\./g, '')}, ${new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)}`;

const COLS: Col[] = [
  { t: 'FECHA', w: 0.17 },
  { t: 'SITIO', w: 0.37 },
  { t: 'HORARIO', w: 0.26 },
  { t: 'NOTA', w: 0.2 },
];

function filasDe(g: HorarioGuardia): Fila[] {
  const filas: Fila[] = [];
  for (const d of g.dias) {
    if (d.turnos.length === 0) {
      filas.push({
        celdas: [{ texto: fechaDia(d.fecha), color: C.suave }, { texto: '—', color: C.suave }, { texto: 'Descanso', color: C.suave }, { texto: '' }],
      });
      continue;
    }
    d.turnos.forEach((t, i) =>
      filas.push({
        celdas: [
          { texto: i === 0 ? fechaDia(d.fecha) : '', bold: true },
          { texto: t.sitio },
          { texto: t.horario, bold: true },
          { texto: t.cobertura ? 'Cobertura' : '', color: '#b45309' },
        ],
      }),
    );
  }
  return filas;
}

/** PDF del horario de guardias (A-55): una tabla por guardia, Carta vertical, con fecha de generación. */
export async function generarHorarioPdf(d: DatosHorario): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: TOP, bottom: BOTTOM, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: {
      Title: `Horario de guardias ${d.desde} a ${d.hasta}`,
      Author: 'Grupo Platinum',
      Subject: d.alcance,
      Creator: 'Intranet Platinum',
    },
  });
  const trozos: Buffer[] = [];
  doc.on('data', (t: Buffer) => trozos.push(t));
  const fin = new Promise<Buffer>((ok, ko) => {
    doc.on('end', () => ok(Buffer.concat(trozos)));
    doc.on('error', ko);
  });

  // Marca de agua en cada hoja, detrás del contenido.
  dibujarMarcaDeAgua(doc);
  doc.on('pageAdded', () => dibujarMarcaDeAgua(doc));

  const l = new Lienzo(doc, disposicionOficial(ALTO_FRANJA_HORARIO));
  l.datos(
    [
      ['Periodo', `${fechaLarga(d.desde)} – ${fechaLarga(d.hasta)}`],
      ['Alcance', d.alcance],
      ['Generó', d.generadoPor],
      ['Generado el', fechaHora(d.generadoEn)],
    ],
    2,
  );

  if (d.guardias.length === 0) {
    l.texto('No hay guardias con turnos programados en el periodo.', MARGEN, l.y, { size: 9, color: C.suave });
    l.y += 22;
  }
  for (const g of d.guardias) {
    const trabaja = g.dias.filter((x) => x.turnos.length > 0).length;
    const filas = filasDe(g);
    // No empezar a un guardia al pie de la hoja: que quepan su título, su resumen, la cabecera y unas filas.
    if (trabaja > 0) l.asegurar(62 + Math.min(filas.length, 6) * 17.5);
    l.seccion(g.nombre);
    if (trabaja === 0) {
      l.texto('Sin turnos programados en este periodo.', MARGEN, l.y, { size: 9, color: C.suave });
      l.y += 22;
      continue;
    }
    l.texto(`${trabaja} ${trabaja === 1 ? 'día' : 'días'} de trabajo · ${g.dias.length - trabaja} de descanso`, MARGEN, l.y - 4, {
      size: 8,
      color: C.suave,
    });
    l.y += 10;
    l.tabla(COLS, filas, { size: 8.5 });
  }

  l.caja('Importante', [
    `Horario vigente al ${fechaHora(d.generadoEn)}. El horario válido siempre es el que aparece en la app.`,
    'Cualquier cambio de horario se avisa en la app (campanita y notificaciones). Este documento es solo un apoyo.',
  ]);

  // Cabecera y pie, con el total de hojas: membrete oficial en la primera hoja y encabezado ligero en las demás.
  const W = doc.page.width;
  const H = doc.page.height;
  const periodoTxt = `${fechaLarga(d.desde)} – ${fechaLarga(d.hasta)}`;
  const aviso = `Horario vigente al ${fechaHora(d.generadoEn)}. El horario válido siempre es el de la app; los cambios se avisan ahí.`;
  const { start, count } = doc.bufferedPageRange();
  for (let p = 0; p < count; p++) {
    doc.switchToPage(start + p);
    const margenes = doc.page.margins;
    const bottom = margenes.bottom;
    margenes.bottom = 0;
    if (p === 0) {
      const y0 = dibujarEncabezadoOficial(doc, MARGEN) + 8;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(MARCA.azul).text('HORARIO DE GUARDIAS', MARGEN, y0, { width: W / 2, lineBreak: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(C.suave).text(d.alcance, MARGEN, y0 + 16, { width: W / 2 - MARGEN, lineBreak: false, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.navy).text(periodoTxt, W / 2, y0, { width: W / 2 - MARGEN, align: 'right', lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor(C.suave).text(`Generado: ${fechaHora(d.generadoEn)}`, W / 2, y0 + 15, {
        width: W / 2 - MARGEN,
        align: 'right',
        lineBreak: false,
      });
      dibujarPieOficial(doc, MARGEN);
      pieInfo(doc, H - ALTO_PIE_MEMBRETE - 4, { lineas: [aviso] }, p + 1, count);
    } else {
      dibujarCabeceraLigera(doc, MARGEN, { negrita: 'HORARIO DE GUARDIAS', lineas: [periodoTxt, d.alcance.slice(0, 60)] });
      pieInfo(doc, H, { lineas: [aviso] }, p + 1, count);
    }
    margenes.bottom = bottom;
  }
  doc.end();
  return fin;
}
