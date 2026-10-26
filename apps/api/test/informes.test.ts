import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type PatronTurno, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import type { MarcacionRow } from '../src/modules/asistencia/asistencia.repository';
import type { TurnoProgramado } from '../src/modules/asistencia/vigilancia';
import type { EventoBitacoraRow } from '../src/modules/bitacora/bitacora.repository';
import { createInformesModule } from '../src/modules/informes';
import {
  InformesRepository,
  type FiltroInformes,
  type Firmar,
  type InformeRow,
  type NuevoInformeRow,
} from '../src/modules/informes/informes.repository';
import { canonico } from '../src/modules/informes/informes.service';
import type { Alcance } from '../src/modules/sitios/alcance';
import { MemoryAuditLogger } from './helpers/memoryAudit';

/** Jueves 23 de octubre de 2026, 18:00 en la Ciudad de México (UTC-6). */
const AHORA = new Date('2026-10-24T00:00:00.000Z');
const local = (fecha: string, hhmm: string) => new Date(`${fecha}T${hhmm}:00.000-06:00`);

const patron: PatronTurno = {
  tipo: 'fija',
  horas: 12,
  dias: { tipo: 'diario' },
  horaInicio: '08:00',
  horaFin: null,
  desde: '2026-10-01',
  hasta: null,
};
const TURNOS: TurnoProgramado[] = [
  { asignacionId: 1, sitio: { id: 1, nombre: 'POETAS' }, guardia: { id: 10, nombre: 'Juan Pérez' }, patron },
  { asignacionId: 2, sitio: { id: 2, nombre: 'Plaza Norte' }, guardia: { id: 11, nombre: 'Ana Ruiz' }, patron },
];

let n = 0;
const marca = (
  usuarioId: number,
  tipo: MarcacionRow['tipo'],
  fecha: string,
  hhmm: string,
  extra: Partial<MarcacionRow> = {},
): MarcacionRow & { usuario: { id: number } } => ({
  id: ++n,
  idCliente: `c${n}`,
  usuarioId,
  entradaId: null,
  tipo,
  registradaEn: local(fecha, hhmm),
  sitio: { id: usuarioId === 10 ? 1 : 2, nombre: usuarioId === 10 ? 'POETAS' : 'Plaza Norte' },
  lat: 0,
  lng: 0,
  precisionM: 5,
  distanciaM: 0,
  alertas: [],
  fotoClave: null,
  rostroId: null,
  rostroDistancia: null,
  rostroIntentos: null,
  programadaEntrada: null,
  programadaSalida: null,
  usuario: { id: usuarioId },
  ...extra,
});

/** Jornada completa con su horario programado de 12 h. */
function jornada(usuarioId: number, fecha: string, entrada: string, salida: string | null, comida?: [string, string]) {
  const programadaEntrada = local(fecha, '08:00');
  const e = marca(usuarioId, 'entrada', fecha, entrada, {
    programadaEntrada,
    programadaSalida: local(fecha, '20:00'),
  });
  const filas = [e];
  if (comida) {
    filas.push(marca(usuarioId, 'inicio_comida', fecha, comida[0], { entradaId: e.id }));
    filas.push(marca(usuarioId, 'fin_comida', fecha, comida[1], { entradaId: e.id }));
  }
  if (salida) filas.push(marca(usuarioId, 'salida', fecha, salida, { entradaId: e.id }));
  return filas;
}

const evento = (o: Partial<EventoBitacoraRow> & Pick<EventoBitacoraRow, 'id' | 'tipo' | 'usuarioId'>): EventoBitacoraRow => ({
  guardia: { id: o.usuarioId, nombre: 'Juan Pérez', email: 'j@x.mx' },
  ocurrioEn: AHORA,
  detalle: '',
  datos: null,
  marcacionId: null,
  sitio: { id: 1, nombre: 'POETAS' },
  actor: null,
  fotoMarca: null,
  incidencia: null,
  justificacion: null,
  justificadoPor: null,
  justificadoEn: null,
  decision: null,
  decididoPor: null,
  decididoEn: null,
  comentarios: [],
  ...o,
});

class MemoryInformesRepository extends InformesRepository {
  personas = [
    { id: 10, nombre: 'Juan Pérez', email: 'juan@x.mx' },
    { id: 11, nombre: 'Ana Ruiz', email: 'ana@x.mx' },
  ];
  filas: InformeRow[] = [];
  marcasDe: (MarcacionRow & { usuario: { id: number } })[] = [];
  eventosDe: EventoBitacoraRow[] = [];

  async guardias(ids: number[] | null) {
    return this.personas.filter((p) => !ids || ids.includes(p.id));
  }
  async guardia(id: number) {
    return this.personas.find((p) => p.id === id) ?? null;
  }
  async sitios(ids: number[] | null) {
    return [
      { id: 1, nombre: 'POETAS' },
      { id: 2, nombre: 'Plaza Norte' },
    ].filter((s) => !ids || ids.includes(s.id));
  }
  async turnos() {
    return TURNOS;
  }
  async marcas() {
    return this.marcasDe;
  }
  async eventos() {
    return this.eventosDe;
  }
  async supervisores() {
    return new Map([
      [1, 'Sofía Sup'],
      [2, 'Pedro Sup'],
    ]);
  }
  async buscarPorHuella(huella: string) {
    return [...this.filas].reverse().find((f) => f.huella === huella) ?? null;
  }
  async ultimoDelAlcance(a: { tipo: string; usuarioId: number | null; sitioId: number | null; desde: string; hasta: string }) {
    return (
      [...this.filas].reverse().find(
        (f) =>
          f.tipo === a.tipo &&
          f.usuarioId === a.usuarioId &&
          f.sitioId === a.sitioId &&
          f.desde === a.desde &&
          f.hasta === a.hasta &&
          !f.reemplazadoPor,
      ) ?? null
    );
  }
  async crear(d: NuevoInformeRow, firmar: Firmar) {
    const id = this.filas.length + 1;
    const creado = new Date(AHORA);
    const { folio, hash } = firmar(id, creado);
    const previo = d.reemplazaId ? this.filas.find((f) => f.id === d.reemplazaId)! : null;
    const fila: InformeRow = {
      ...d,
      id,
      folio,
      hash,
      usuarioNombre: this.personas.find((p) => p.id === d.usuarioId)?.nombre ?? null,
      generadoPor: 'Admin',
      reemplaza: previo && { id: previo.id, folio: previo.folio },
      reemplazadoPor: null,
      createdAt: creado,
    };
    if (previo) previo.reemplazadoPor = { id, folio };
    this.filas.push(fila);
    return fila;
  }
  async listar({ visible, skip, take }: FiltroInformes) {
    const todos = this.filas
      .filter((f) => !visible || (f.usuarioId !== null && visible.guardiaIds.includes(f.usuarioId)) || f.generadoPorId === visible.usuarioId)
      .reverse();
    return { items: todos.slice(skip, skip + take), total: todos.length };
  }
  async findById(id: number) {
    return this.filas.find((f) => f.id === id) ?? null;
  }
  async findByFolio(folio: string) {
    return this.filas.find((f) => f.folio === folio) ?? null;
  }
}

let repo: MemoryInformesRepository;
let audit: MemoryAuditLogger;
let alcance: Alcance | null;
let app: ReturnType<typeof createApp>;

const token = (id: number, rol: Rol) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol] })}`;
const como = (id: number, rol: Rol) => ({
  get: (u: string) => request(app).get(`/api/informes${u}`).set('Authorization', token(id, rol)),
  post: (b: object) => request(app).post('/api/informes').set('Authorization', token(id, rol)).send(b),
});
const admin = () => como(1, ROLES.ADMIN);

const personal = { tipo: 'personal', guardiaId: 10, desde: '2026-10-19', hasta: '2026-10-22' };

beforeEach(() => {
  n = 0;
  repo = new MemoryInformesRepository();
  audit = new MemoryAuditLogger();
  alcance = null;
  // Juan: 19 completa con comida, 20 retardo de 25 min, 21 sin nada (falta), 22 sin salida.
  repo.marcasDe = [
    ...jornada(10, '2026-10-19', '08:02', '20:01', ['12:00', '12:50']),
    ...jornada(10, '2026-10-20', '08:25', '20:00'),
    ...jornada(10, '2026-10-22', '08:00', null),
  ];
  app = createApp([createInformesModule({ repo, audit, ahora: () => AHORA, alcance: async (u) => (u.rol === ROLES.SUPERVISOR ? alcance : null) })]);
});

// Generar PDF y Excel tarda más con toda la suite corriendo en paralelo.
describe('Reporte de asistencia', { timeout: 30_000 }, () => {
  it('calcula el reporte personal día por día y lo congela con folio', async () => {
    const res = await admin().post(personal);
    expect(res.status).toBe(201);
    const { informe, existente } = res.body.data;
    expect(existente).toBe(false);
    expect(informe.folio).toBe('ASIS-2026-000001');
    expect(informe.resumen).toMatchObject({
      programados: 4,
      trabajados: 3,
      faltas: 1,
      retardos: 1,
      retardoMin: 25,
      comidas: 1,
    });
    // 19: 08:02 a 20:01 = 11:59 h; 20: 08:25 a 20:00 = 11:35 h; 22: sin salida (no suma).
    expect(informe.resumen.minutosTrabajados).toBe(719 + 695);
    expect(informe.resumen.minutosEsperados).toBe(4 * 720);
    expect(audit.acciones()).toContain('informes.emitir');

    const ver = await admin().get(`/${informe.id}`);
    const dias = ver.body.data.datos.guardias[0].dias;
    expect(dias.map((d: { fecha: string; estado: string }) => [d.fecha, d.estado])).toEqual([
      ['2026-10-19', 'completa'],
      ['2026-10-20', 'retardo'],
      ['2026-10-21', 'falta'],
      ['2026-10-22', 'sin_salida'],
    ]);
  });

  it('un reporte idéntico devuelve el mismo folio en lugar de abrir otro', async () => {
    const a = await admin().post(personal);
    const b = await admin().post(personal);
    expect(b.status).toBe(200);
    expect(b.body.data.existente).toBe(true);
    expect(b.body.data.informe.folio).toBe(a.body.data.informe.folio);
    expect(repo.filas).toHaveLength(1);
  });

  it('si cambian los datos se emite otro folio que reemplaza al anterior', async () => {
    const a = await admin().post(personal);
    // El supervisor justifica el retardo del día 20.
    repo.eventosDe = [
      evento({
        id: 1,
        tipo: 'retardo',
        usuarioId: 10,
        marcacionId: repo.marcasDe[4].id,
        justificacion: 'Bloqueo en la avenida',
        justificadoPor: 'Sofía Sup',
        justificadoEn: AHORA,
      }),
    ];
    const b = await admin().post(personal);
    expect(b.status).toBe(201);
    expect(b.body.data.informe.folio).toBe('ASIS-2026-000002');
    expect(b.body.data.informe.reemplaza.folio).toBe(a.body.data.informe.folio);
    expect(b.body.data.informe.resumen.retardos).toBe(0);

    const lista = await admin().get('');
    const viejo = lista.body.data.items.find((i: { folio: string }) => i.folio === 'ASIS-2026-000001');
    expect(viejo.reemplazadoPor.folio).toBe('ASIS-2026-000002');
    // El primero sigue intacto: conserva su contenido original.
    const original = await admin().get(`/${a.body.data.informe.id}`);
    expect(original.body.data.datos.resumen.retardos).toBe(1);
  });

  it('el reporte general suma a todos y agrupa por sitio', async () => {
    repo.marcasDe.push(...jornada(11, '2026-10-19', '08:00', '20:00'));
    const res = await admin().post({ tipo: 'general', desde: '2026-10-19', hasta: '2026-10-19', incluirDetalle: true });
    expect(res.status).toBe(201);
    const { datos } = (await admin().get(`/${res.body.data.informe.id}`)).body.data;
    expect(datos.guardias.map((g: { nombre: string }) => g.nombre)).toEqual(['Ana Ruiz', 'Juan Pérez']);
    expect(datos.porSitio.map((s: { sitio: string }) => s.sitio)).toEqual(['Plaza Norte', 'POETAS']);
    expect(datos.resumen.trabajados).toBe(2);
  });

  it('descarga el PDF oficial y el Excel', async () => {
    const { body } = await admin().post({ ...personal, incluirFirmas: true });
    const id = body.data.informe.id;
    const pdf = await admin().get(`/${id}/pdf`).buffer(true).parse((r, cb) => {
      const t: Buffer[] = [];
      r.on('data', (c: Buffer) => t.push(c));
      r.on('end', () => cb(null, Buffer.concat(t)));
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('ASIS-2026-000001.pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    const xlsx = await admin().get(`/${id}/excel`).buffer(true).parse((r, cb) => {
      const t: Buffer[] = [];
      r.on('data', (c: Buffer) => t.push(c));
      r.on('end', () => cb(null, Buffer.concat(t)));
    });
    expect(xlsx.status).toBe(200);
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK');
  });

  it('el PDF general con anexo se genera horizontal', async () => {
    repo.marcasDe.push(...jornada(11, '2026-10-19', '08:00', '20:00'));
    const { body } = await admin().post({ tipo: 'general', desde: '2026-10-19', hasta: '2026-10-22', incluirDetalle: true });
    const pdf = await admin().get(`/${body.data.informe.id}/pdf`).buffer(true).parse((r, cb) => {
      const t: Buffer[] = [];
      r.on('data', (c: Buffer) => t.push(c));
      r.on('end', () => cb(null, Buffer.concat(t)));
    });
    expect(pdf.status).toBe(200);
    const texto = (pdf.body as Buffer).toString('latin1');
    // Carta horizontal: 792 x 612.
    expect(texto).toContain('/MediaBox [0 0 792 612]');
  });

  it('la verificación es pública, limitada y detecta un código falso', async () => {
    const { body } = await admin().post(personal);
    const folio = body.data.informe.folio;
    const codigo = body.data.informe.codigo;
    const ok = await request(app).get(`/api/informes/verificar/${folio}?c=${codigo}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ valido: true, codigoValido: true, vigente: true, folio });
    // No expone nombres ni detalle.
    expect(JSON.stringify(ok.body.data)).not.toContain('Juan');
    const mal = await request(app).get(`/api/informes/verificar/${folio}?c=ZZZZ-ZZZZ`);
    expect(mal.body.data.codigoValido).toBe(false);
    expect((await request(app).get('/api/informes/verificar/ASIS-2026-999999')).status).toBe(404);
    expect((await request(app).get('/api/informes/verificar/otra-cosa')).status).toBe(400);
  });

  it('solo admin y supervisor; el guardia y el cliente no entran', async () => {
    expect((await como(10, ROLES.GUARDIA).get('')).status).toBe(403);
    expect((await como(20, ROLES.CLIENTE).get('')).status).toBe(403);
    expect((await request(app).get('/api/informes')).status).toBe(401);
  });

  it('el supervisor solo emite y ve lo de sus guardias', async () => {
    alcance = { sitioIds: new Set([2]), guardiaIds: new Set([11]) };
    const sup = como(5, ROLES.SUPERVISOR);
    expect((await sup.post(personal)).status).toBe(404); // Juan no es suyo
    const mio = await sup.post({ ...personal, guardiaId: 11 });
    expect(mio.status).toBe(201);
    expect((await sup.post({ tipo: 'general', sitioId: 1, desde: '2026-10-19', hasta: '2026-10-20' })).status).toBe(404);

    // Un reporte de Juan emitido por el admin no le aparece ni se puede abrir.
    const deJuan = await admin().post(personal);
    const lista = await sup.get('');
    expect(lista.body.data.items.map((i: { folio: string }) => i.folio)).not.toContain(deJuan.body.data.informe.folio);
    expect((await sup.get(`/${deJuan.body.data.informe.id}`)).status).toBe(404);
    expect((await sup.get(`/${deJuan.body.data.informe.id}/pdf`)).status).toBe(404);

    const op = await sup.get('/opciones');
    expect(op.body.data.guardias.map((g: { id: number }) => g.id)).toEqual([11]);
    expect(op.body.data.sitios.map((s: { id: number }) => s.id)).toEqual([2]);
  });

  it('valida el periodo: máximo 31 días, sin invertir fechas, personal con guardia', async () => {
    expect((await admin().post({ ...personal, desde: '2026-09-01', hasta: '2026-10-22' })).status).toBe(400);
    expect((await admin().post({ ...personal, desde: '2026-10-22', hasta: '2026-10-19' })).status).toBe(400);
    expect((await admin().post({ tipo: 'personal', desde: '2026-10-19', hasta: '2026-10-20' })).status).toBe(400);
    expect((await admin().post({ ...personal, desde: '2026-10-24', hasta: '2026-10-30' })).status).toBe(400);
  });

  it('el hash canónico no depende del orden de las llaves', () => {
    expect(canonico({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } })).toBe(
      canonico({ a: { c: null, d: [1, { y: 2, z: 1 }] }, b: 1 }),
    );
  });
});
