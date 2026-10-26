import { randomBytes } from 'node:crypto';
import ExcelJS from 'exceljs';
import {
  ESTADO_DIA_INFORME_LABEL,
  type Informe,
  type InformeResumen,
} from '@platinum/shared';
import { env } from '../../config/env';

const NAVY = 'FF121D38';
const ZEBRA = 'FFF5F7FB';
const AVISO = 'COPIA DE TRABAJO, NO OFICIAL. El documento oficial es el PDF con folio.';

const hora = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-MX', { timeZone: env.APP_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(
        new Date(iso),
      )
    : '';
const horas = (min: number | null) => (min === null ? null : Math.round((min / 60) * 100) / 100);

type Hoja = ExcelJS.Worksheet;

/** Título, aviso de copia y encabezado de tabla; devuelve la fila donde empiezan los datos. */
function preparar(ws: Hoja, i: Informe, titulo: string, columnas: { h: string; w: number }[]) {
  ws.columns = columnas.map((c) => ({ width: c.w }));
  const ancho = columnas.length;
  ws.mergeCells(1, 1, 1, ancho);
  const t = ws.getCell(1, 1);
  t.value = `PLATINUM AGENCY · ${titulo} · ${i.folio}`;
  t.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  t.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 24;
  ws.mergeCells(2, 1, 2, ancho);
  const a = ws.getCell(2, 1);
  a.value = AVISO;
  a.font = { bold: true, size: 10, color: { argb: 'FF991B1B' } };
  a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
  ws.mergeCells(3, 1, 3, ancho);
  ws.getCell(3, 1).value = `${i.datos.alcance} · Periodo ${i.desde} a ${i.hasta}`;
  ws.getCell(3, 1).font = { size: 10, color: { argb: 'FF475569' } };
  const cab = ws.getRow(5);
  columnas.forEach((c, n) => {
    const cell = cab.getCell(n + 1);
    cell.value = c.h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF253B70' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  cab.height = 22;
  ws.views = [{ state: 'frozen', ySplit: 5 }];
  return 6;
}

function agregar(ws: Hoja, desde: number, filas: (string | number | null)[][]) {
  filas.forEach((f, n) => {
    const row = ws.getRow(desde + n);
    f.forEach((v, c) => {
      row.getCell(c + 1).value = v;
    });
    if (n % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
      });
    }
  });
}

const filaResumen = (r: InformeResumen) => [
  r.programados,
  r.trabajados,
  r.faltas,
  r.justificadas,
  r.retardos,
  r.retardoMin,
  r.salidasAntes,
  r.comidas,
  horas(r.minutosTrabajados),
  horas(r.minutosEsperados),
];
const COLS_RESUMEN = [
  { h: 'Programados', w: 12 },
  { h: 'Trabajados', w: 12 },
  { h: 'Faltas', w: 9 },
  { h: 'Justificadas', w: 12 },
  { h: 'Retardos', w: 10 },
  { h: 'Min. retardo', w: 12 },
  { h: 'Salidas antes', w: 13 },
  { h: 'Comidas', w: 10 },
  { h: 'Horas trabajadas', w: 16 },
  { h: 'Horas esperadas', w: 16 },
];

/** Excel de trabajo (no oficial) del reporte congelado: horas en número para poder sumarlas. */
export async function generarExcel(i: Informe, url: string, hash: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Platinum Agency';
  wb.created = new Date(i.createdAt);
  wb.title = `Reporte de asistencia ${i.folio} (copia de trabajo)`;
  const d = i.datos;

  // Resumen
  const res = wb.addWorksheet('Resumen');
  if (i.tipo === 'general') {
    const cols = [{ h: 'Guardias', w: 12 }, ...COLS_RESUMEN];
    const n = preparar(res, i, 'Resumen general', cols);
    agregar(res, n, [[d.guardias.length, ...filaResumen(d.resumen)]]);
  } else {
    const n = preparar(res, i, 'Resumen del periodo', COLS_RESUMEN);
    agregar(res, n, [filaResumen(d.resumen)]);
  }

  // Por guardia / por sitio (general)
  if (i.tipo === 'general') {
    const pg = wb.addWorksheet('Por guardia');
    const n = preparar(pg, i, 'Asistencia por guardia', [{ h: 'Guardia', w: 28 }, { h: 'Sitio', w: 28 }, ...COLS_RESUMEN]);
    agregar(
      pg,
      n,
      d.guardias.map((g) => [g.nombre, g.sitios.join(', '), ...filaResumen(g.resumen)]),
    );
    const t = pg.getRow(n + d.guardias.length);
    const tot = pg.getRow(n + d.guardias.length);
    tot.getCell(1).value = 'TOTAL';
    filaResumen(d.resumen).forEach((v, c) => (tot.getCell(c + 3).value = v));
    t.font = { bold: true };

    const ps = wb.addWorksheet('Por sitio');
    const m = preparar(ps, i, 'Subtotales por sitio', [{ h: 'Sitio', w: 30 }, { h: 'Guardias', w: 10 }, ...COLS_RESUMEN]);
    agregar(
      ps,
      m,
      d.porSitio.map((s) => [s.sitio, s.guardias, ...filaResumen(s.resumen)]),
    );
  }

  // Detalle
  const det = wb.addWorksheet('Detalle');
  const n = preparar(det, i, 'Detalle día por día', [
    { h: 'Guardia', w: 26 },
    { h: 'Fecha', w: 12 },
    { h: 'Sitio', w: 24 },
    { h: 'Horario', w: 16 },
    { h: 'Entrada', w: 10 },
    { h: 'Retardo (min)', w: 13 },
    { h: 'Comida', w: 18 },
    { h: 'Salida', w: 10 },
    { h: 'Horas trabajadas', w: 16 },
    { h: 'Estado', w: 22 },
    { h: 'Notas', w: 60 },
  ]);
  agregar(
    det,
    n,
    d.guardias.flatMap((g) =>
      g.dias.map((x) => [
        g.nombre,
        x.fecha,
        x.sitio,
        x.horario,
        hora(x.entrada),
        x.estado === 'retardo' ? x.retardoMin : null,
        x.comidas.map((c) => `${hora(c.inicio)}-${hora(c.fin)}`).join(' / '),
        hora(x.salida),
        horas(x.minutos),
        ESTADO_DIA_INFORME_LABEL[x.estado],
        x.notas.join(' | '),
      ]),
    ),
  );
  det.getColumn(9).numFmt = '0.00';

  // Hechos
  const he = wb.addWorksheet('Hechos');
  const h = preparar(he, i, 'Hechos relevantes', [
    { h: 'Fecha y hora', w: 20 },
    { h: 'Guardia', w: 26 },
    { h: 'Hecho', w: 100 },
  ]);
  agregar(
    he,
    h,
    d.hechos.map((x) => [new Date(x.en).toLocaleString('es-MX', { timeZone: env.APP_TIMEZONE }), x.guardia, x.texto]),
  );

  // Verificación
  const ve = wb.addWorksheet('Verificación');
  const v = preparar(ve, i, 'Verificación', [{ h: 'Campo', w: 26 }, { h: 'Valor', w: 90 }]);
  agregar(ve, v, [
    ['Folio', i.folio],
    ['Tipo', i.tipo === 'personal' ? 'Personal' : 'General'],
    ['Alcance', d.alcance],
    ['Periodo', `${i.desde} a ${i.hasta}`],
    ['Generó', i.generadoPor],
    ['Emitido (hora del servidor)', i.createdAt],
    ['Reemplaza al folio', i.reemplaza?.folio ?? null],
    ['Código de verificación', i.codigo],
    ['Huella SHA-256', hash],
    ['Verificar en', url.split('?')[0]],
    ['Estado', 'COPIA DE TRABAJO, NO OFICIAL'],
  ]);

  // Protegidas contra edición accidental; la clave es aleatoria y no se guarda (la copia oficial es el PDF).
  const clave = randomBytes(12).toString('hex');
  for (const ws of wb.worksheets) {
    await ws.protect(clave, { selectLockedCells: true, selectUnlockedCells: true, sort: false, autoFilter: true });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
