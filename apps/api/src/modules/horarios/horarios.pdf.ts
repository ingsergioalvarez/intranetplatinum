import PDFDocument from 'pdfkit';
import { MARCA } from '@platinum/shared';
import { env } from '../../config/env';
import {
  ALTO_CABECERA,
  BOTTOM,
  COLORES_PDF as C,
  Lienzo,
  MARGEN,
  TOP,
  fechaDia,
  fechaLarga,
  type Col,
  type Fila,
} from '../informes/pdf';

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
      Author: MARCA.nombre,
      Subject: d.alcance,
      Creator: MARCA.nombre,
    },
  });
  const trozos: Buffer[] = [];
  doc.on('data', (t: Buffer) => trozos.push(t));
  const fin = new Promise<Buffer>((ok, ko) => {
    doc.on('end', () => ok(Buffer.concat(trozos)));
    doc.on('error', ko);
  });

  const l = new Lienzo(doc);
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
    l.tabla(COLS, filasDe(g), { size: 8.5 });
  }

  l.caja('Importante', [
    `Horario vigente al ${fechaHora(d.generadoEn)}. El horario válido siempre es el que aparece en la app.`,
    'Cualquier cambio de horario se avisa en la app (campanita y notificaciones). Este documento es solo un apoyo.',
  ]);

  // Cabecera y pie, con el total de hojas.
  const W = doc.page.width;
  const H = doc.page.height;
  const { start, count } = doc.bufferedPageRange();
  for (let p = 0; p < count; p++) {
    doc.switchToPage(start + p);
    const margenes = doc.page.margins;
    const bottom = margenes.bottom;
    margenes.bottom = 0;
    doc.rect(0, 0, W, ALTO_CABECERA).fill(C.navy);
    doc.rect(0, ALTO_CABECERA, W, 3).fill(C.plata);
    doc.font('Helvetica-Bold').fontSize(16).fillColor(C.blanco).text('PLATINUM AGENCY', MARGEN, 15, { width: W / 2, characterSpacing: 1.5 });
    doc.font('Helvetica').fontSize(6.5).fillColor('#9fb0d6').text('SEGURIDAD FÍSICA INTRAMUROS', MARGEN, 35, { characterSpacing: 2 });
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.blanco).text('HORARIO DE GUARDIAS', MARGEN, 50, { width: W - MARGEN * 2, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor('#c9d3ee').text(d.alcance, MARGEN, 65, { width: W / 2, lineBreak: false, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.blanco).text(`${fechaLarga(d.desde)} – ${fechaLarga(d.hasta)}`, W / 2, 20, {
      width: W / 2 - MARGEN,
      align: 'right',
      lineBreak: false,
    });
    doc.font('Helvetica').fontSize(8).fillColor('#c9d3ee').text(`Generado: ${fechaHora(d.generadoEn)}`, W / 2, 35, {
      width: W / 2 - MARGEN,
      align: 'right',
      lineBreak: false,
    });

    doc.moveTo(MARGEN, H - 40).lineTo(W - MARGEN, H - 40).lineWidth(0.6).strokeColor(C.linea).stroke();
    doc.font('Helvetica').fontSize(6.8).fillColor(C.suave).text(
      `Horario vigente al ${fechaHora(d.generadoEn)}. El horario válido siempre es el de la app; los cambios se avisan ahí.`,
      MARGEN,
      H - 34,
      { width: W - MARGEN * 2 - 100, lineBreak: false },
    );
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy).text(`Página ${p + 1} de ${count}`, W - MARGEN - 90, H - 34, {
      width: 90,
      align: 'right',
      lineBreak: false,
    });
    margenes.bottom = bottom;
  }
  doc.end();
  return fin;
}
