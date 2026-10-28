import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type PatronTurno, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import type { MarcacionRow } from '../src/modules/asistencia/asistencia.repository';
import type { TurnoProgramado } from '../src/modules/asistencia/vigilancia';
import type { EventoNuevo } from '../src/modules/bitacora/registrar';
import { createHorasExtraModule } from '../src/modules/horas-extra';
import {
  HorasExtraRepository,
  type CambiosHoraExtra,
  type EntradaExtra,
  type FiltroHorasExtra,
  type HoraExtraRow,
  type NuevaHoraExtra,
} from '../src/modules/horas-extra/horasExtra.repository';
import { HorasExtraService } from '../src/modules/horas-extra/horasExtra.service';
import type { CasoRow } from '../src/modules/casos-cobertura/casos.repository';
import type { Alcance } from '../src/modules/sitios/alcance';
import { MemoryAuditLogger } from './helpers/memoryAudit';

/** Lunes a viernes, 08:00, 12 h (zona UTC-6: de 14:00Z a 02:00Z). */
const patron: PatronTurno = {
  tipo: 'fija',
  horas: 12,
  dias: { tipo: 'semanal', semana: [1, 2, 3, 4, 5] },
  horaInicio: '08:00',
  horaFin: null,
  desde: '2026-10-01',
  hasta: null,
};
const TURNOS: TurnoProgramado[] = [
  { asignacionId: 1, sitio: { id: 1, nombre: 'POETAS' }, guardia: { id: 10, nombre: 'Juan' }, patron },
];
const SITIO = { id: 1, nombre: 'POETAS', supervisorId: 5 };
const COORDS = { lat: 19.4326, lng: -99.1332, radioM: 100 };

const en = (iso: string) => new Date(iso);
/** Lunes 26: entrada 08:00 locales, salida programada 20:00 locales (02:00Z del martes). */
const ENTRADA_LUNES: EntradaExtra = {
  id: 100,
  usuarioId: 10,
  guardia: 'Juan',
  sitio: SITIO,
  registradaEn: en('2026-10-26T14:02:00Z'),
  programadaEntrada: en('2026-10-26T14:00:00Z'),
  programadaSalida: en('2026-10-27T02:00:00Z'),
};
/** Sábado 31 (descanso de Juan). */
const ENTRADA_SABADO: EntradaExtra = {
  id: 101,
  usuarioId: 10,
  guardia: 'Juan',
  sitio: SITIO,
  registradaEn: en('2026-10-31T14:00:00Z'),
  programadaEntrada: en('2026-10-31T14:00:00Z'),
  programadaSalida: en('2026-11-01T02:00:00Z'),
};

const PERSONAS = [
  { id: 10, nombre: 'Juan', rol: ROLES.GUARDIA as Rol, activo: true },
  { id: 11, nombre: 'Ana', rol: ROLES.GUARDIA as Rol, activo: true },
  { id: 5, nombre: 'Sofía Sup', rol: ROLES.SUPERVISOR as Rol, activo: true },
];

class MemoryHorasExtraRepository extends HorasExtraRepository {
  filas: HoraExtraRow[] = [];
  entradas: EntradaExtra[] = [ENTRADA_LUNES];
  reloj: () => Date = () => new Date();
  salidas = new Map<number, Date>();
  descansosMovidos: { usuarioId: number; fecha: string }[] = [];
  coords: typeof COORDS | null = COORDS;
  sitio = SITIO;

  async findGuardia(id: number) {
    return PERSONAS.find((p) => p.id === id) ?? null;
  }
  async guardiasActivos() {
    return PERSONAS.filter((p) => p.rol === ROLES.GUARDIA).map(({ id, nombre }) => ({ id, nombre }));
  }
  async sitiosActivos() {
    return [{ id: 1, nombre: 'POETAS' }, { id: 2, nombre: 'Plaza Norte' }];
  }
  async admins() {
    return [1];
  }
  async crear(d: NuevaHoraExtra) {
    const fila: HoraExtraRow = {
      id: this.filas.length + 1,
      guardia: { id: d.usuarioId, nombre: PERSONAS.find((p) => p.id === d.usuarioId)?.nombre ?? '?' },
      sitio: this.sitio,
      entradaId: d.entradaId,
      fecha: d.fecha,
      desde: d.desde,
      hasta: d.hasta,
      minutos: d.minutos,
      origen: d.origen,
      estado: d.estado,
      motivo: d.motivo ?? null,
      resueltoPor: d.resueltoPorId ? (PERSONAS.find((p) => p.id === d.resueltoPorId)?.nombre ?? null) : null,
      resueltoEn: d.resueltoEn ?? null,
      notaResolucion: d.notaResolucion ?? null,
      escaladaEn: null,
      createdAt: this.reloj(),
    };
    this.filas.push(fila);
    return fila;
  }
  async findById(id: number) {
    return this.filas.find((f) => f.id === id) ?? null;
  }
  async porEntrada(entradaId: number) {
    return this.filas.find((f) => f.entradaId === entradaId) ?? null;
  }
  async actualizar(id: number, c: CambiosHoraExtra) {
    const f = this.filas.find((x) => x.id === id)!;
    const { resueltoPorId, ...resto } = c;
    Object.assign(f, resto);
    if (resueltoPorId !== undefined) {
      f.resueltoPor = resueltoPorId ? (PERSONAS.find((p) => p.id === resueltoPorId)?.nombre ?? null) : null;
    }
    return f;
  }
  async eliminar(id: number) {
    this.filas = this.filas.filter((f) => f.id !== id);
  }
  private filtrar(f: FiltroHorasExtra) {
    return this.filas
      .filter((x) => !f.estados || f.estados.includes(x.estado))
      .filter((x) => !f.guardiaId || x.guardia.id === f.guardiaId)
      .filter((x) => !f.desde || x.fecha >= f.desde)
      .filter((x) => !f.hasta || x.fecha <= f.hasta)
      .filter((x) => !f.alcance || f.alcance.sitioIds.includes(x.sitio.id) || f.alcance.guardiaIds.includes(x.guardia.id));
  }
  async listar(f: FiltroHorasExtra) {
    const l = this.filtrar(f).reverse();
    return { items: f.take ? l.slice(f.skip ?? 0, (f.skip ?? 0) + f.take) : l, total: l.length };
  }
  async pendientes(alcance?: FiltroHorasExtra['alcance']) {
    return this.filtrar({ estados: ['por_aprobar', 'abierta', 'sin_salida'], alcance }).length;
  }
  async solapa(usuarioId: number, desde: Date, hasta: Date, excluirId?: number) {
    return this.filas.some(
      (f) =>
        f.guardia.id === usuarioId &&
        f.id !== excluirId &&
        f.estado !== 'rechazada' &&
        f.desde < hasta &&
        (f.hasta === null || f.hasta > desde),
    );
  }
  async abiertas() {
    return this.filas.filter((f) => f.estado === 'abierta');
  }
  async sinResponder(antes: Date) {
    return this.filas.filter(
      (f) => ['por_aprobar', 'sin_salida'].includes(f.estado) && !f.escaladaEn && f.createdAt < antes,
    );
  }
  async findEntrada(id: number) {
    return this.entradas.find((e) => e.id === id) ?? null;
  }
  async ultimaEntrada(usuarioId: number) {
    return [...this.entradas].filter((e) => e.usuarioId === usuarioId).sort((a, b) => b.registradaEn.getTime() - a.registradaEn.getTime())[0] ?? null;
  }
  async salidaDe(entradaId: number) {
    return this.salidas.get(entradaId) ?? null;
  }
  async jornadasSinSalida(programadaHasta: Date, entradaDesde: Date) {
    return this.entradas.filter(
      (e) =>
        e.programadaSalida! <= programadaHasta &&
        e.registradaEn >= entradaDesde &&
        !this.salidas.has(e.id) &&
        !this.filas.some((f) => f.entradaId === e.id),
    );
  }
  async coordenadasSitio() {
    return this.coords;
  }
  async descansoMovidoA(usuarioId: number, fecha: string) {
    return this.descansosMovidos.some((d) => d.usuarioId === usuarioId && d.fecha === fecha);
  }
}

let repo: MemoryHorasExtraRepository;
let audit: MemoryAuditLogger;
let avisos: { usuarioIds: number[]; mensaje: string }[];
let bitacora: EventoNuevo[];
let alcance: Alcance | null;
let ahora: Date;
let servicio: HorasExtraService;
let app: ReturnType<typeof createApp>;

const token = (id: number, rol: Rol) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol] })}`;
const como = (id: number, rol: Rol) => ({
  get: (u: string) => request(app).get(`/api/horas-extra${u}`).set('Authorization', token(id, rol)),
  post: (u: string, b: object = {}) => request(app).post(`/api/horas-extra${u}`).set('Authorization', token(id, rol)).send(b),
});
const guardia = () => como(10, ROLES.GUARDIA);
const sup = () => como(5, ROLES.SUPERVISOR);
const admin = () => como(1, ROLES.ADMIN);

/** Lo que la asistencia le pasa al servicio. */
const marca = (e: EntradaExtra): MarcacionRow =>
  ({
    id: e.id,
    usuarioId: e.usuarioId,
    tipo: 'entrada',
    registradaEn: e.registradaEn,
    programadaEntrada: e.programadaEntrada,
    programadaSalida: e.programadaSalida,
  }) as MarcacionRow;
const salida = (hora: string, extra: { final?: boolean; porSupervisor?: boolean } = {}) => ({
  registradaEn: en(hora),
  final: false,
  porSupervisor: false,
  ...extra,
});

beforeEach(() => {
  repo = new MemoryHorasExtraRepository();
  audit = new MemoryAuditLogger();
  avisos = [];
  bitacora = [];
  alcance = null;
  ahora = en('2026-10-27T03:00:00Z'); // 21:00 locales del lunes
  repo.reloj = () => ahora;
  const deps = {
    repo,
    audit,
    turnos: async () => TURNOS,
    misSitios: async () => [{ sitio: { id: 1, nombre: 'POETAS' } }] as never,
    avisar: async (usuarioIds: number[], a: { mensaje: string }) => void avisos.push({ usuarioIds, mensaje: a.mensaje }),
    bitacora: async (e: EventoNuevo) => void bitacora.push(e),
    ahora: () => ahora,
  };
  servicio = new HorasExtraService(
    repo,
    deps.turnos,
    deps.misSitios,
    audit,
    deps.avisar,
    deps.bitacora,
    deps.ahora,
  );
  app = createApp([createHorasExtraModule({ ...deps, alcance: async (u) => (u.rol === ROLES.SUPERVISOR ? alcance : null) })]);
});

describe('horas extra: al marcar la salida (AS5-01)', () => {
  it('una salida tarde (más de 15 min) crea horas extra por aprobar y avisa al supervisor', async () => {
    await servicio.alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T02:40:00Z') });
    expect(repo.filas).toHaveLength(1);
    expect(repo.filas[0]).toMatchObject({ estado: 'por_aprobar', origen: 'salida_tardia', minutos: 40, entradaId: 100 });
    expect(repo.filas[0].desde).toEqual(en('2026-10-27T02:00:00Z'));
    expect(avisos).toEqual([{ usuarioIds: [5], mensaje: expect.stringContaining('40 min de horas extra por aprobar') }]);
    expect(bitacora[0]).toMatchObject({ tipo: 'horas_extra', usuarioIds: [10], sitioId: 1 });
  });

  it('dentro de la tolerancia de 15 min no hay horas extra', async () => {
    await servicio.alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T02:15:00Z') });
    expect(repo.filas).toHaveLength(0);
    expect(avisos).toHaveLength(0);
  });

  it('si la cierra el supervisor no se inventan horas extra aunque la hora sea tarde', async () => {
    await servicio.alSalir({
      entrada: marca(ENTRADA_LUNES),
      salida: salida('2026-10-27T05:00:00Z', { porSupervisor: true }),
    });
    expect(repo.filas).toHaveLength(0);
  });

  it('trabajar en su día de descanso cuenta toda la jornada', async () => {
    repo.entradas.push(ENTRADA_SABADO);
    await servicio.alSalir({ entrada: marca(ENTRADA_SABADO), salida: salida('2026-11-01T02:00:00Z') });
    expect(repo.filas[0]).toMatchObject({ origen: 'cobertura_descanso', estado: 'por_aprobar', minutos: 720, fecha: '2026-10-31' });
    expect(repo.filas[0].desde).toEqual(ENTRADA_SABADO.registradaEn);
  });

  it('un descanso movido con un cambio de turno aprobado no cuenta como extra', async () => {
    repo.entradas.push(ENTRADA_SABADO);
    repo.descansosMovidos.push({ usuarioId: 10, fecha: '2026-10-31' });
    await servicio.alSalir({ entrada: marca(ENTRADA_SABADO), salida: salida('2026-11-01T02:00:00Z') });
    expect(repo.filas).toHaveLength(0);
  });

  it('un día de trabajo normal no es descanso', async () => {
    await servicio.alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T02:00:00Z') });
    expect(repo.filas).toHaveLength(0);
  });
});

describe('horas extra: el guardia dice que sigue en turno (AS5-02)', () => {
  it('pasada su hora + 15 min sin salida se le pregunta; después de contestar ya no', async () => {
    ahora = en('2026-10-27T02:14:00Z');
    expect((await servicio.paraGuardia(marca(ENTRADA_LUNES), null))?.preguntar).toBe(false);
    ahora = en('2026-10-27T02:16:00Z');
    expect(await servicio.paraGuardia(marca(ENTRADA_LUNES), null)).toMatchObject({ preguntar: true, solicitud: null, requiereUbicacion: false });

    const res = await guardia().post('/extender', {});
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ estado: 'abierta' });
    expect(repo.filas[0]).toMatchObject({ origen: 'guardia_extiende', estado: 'abierta', entradaId: 100 });
    expect(avisos.at(-1)).toMatchObject({ usuarioIds: [5], mensaje: expect.stringContaining('pidió extender su horario') });
    expect((await servicio.paraGuardia(marca(ENTRADA_LUNES), null))?.preguntar).toBe(false);
    // No se puede pedir dos veces.
    expect((await guardia().post('/extender', {})).status).toBe(409);
  });

  it('extendió antes de salir: al marcar su salida quedan las horas extra por aprobar', async () => {
    ahora = en('2026-10-27T02:20:00Z');
    await guardia().post('/extender', {});
    await servicio.alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T04:30:00Z') });
    expect(repo.filas[0]).toMatchObject({ estado: 'por_aprobar', minutos: 150, origen: 'guardia_extiende' });
    expect(avisos.at(-1)?.mensaje).toContain('2 h 30 min');
  });

  it('antes de que termine su turno no puede extender', async () => {
    ahora = en('2026-10-27T01:00:00Z');
    expect((await guardia().post('/extender', {})).status).toBe(409);
  });

  it('ya marcó su salida: extiende solo si sigue dentro del sitio y marca su salida final', async () => {
    repo.salidas.set(100, en('2026-10-27T02:00:00Z'));
    ahora = en('2026-10-27T02:30:00Z');
    expect(await servicio.paraGuardia(marca(ENTRADA_LUNES), { registradaEn: en('2026-10-27T02:00:00Z') } as MarcacionRow)).toMatchObject({
      preguntar: true,
      requiereUbicacion: true,
    });
    // Sin ubicación o lejos del sitio: no.
    expect((await guardia().post('/extender', {})).status).toBe(400);
    const lejos = await guardia().post('/extender', { lat: COORDS.lat + 0.01, lng: COORDS.lng });
    expect(lejos.status).toBe(409);
    expect(lejos.body.error.code).toBe('FUERA_DE_RANGO');
    expect(repo.filas).toHaveLength(0);
    // Dentro: se abre y se habilita la salida final.
    expect(await servicio.puedeSalidaFinal(100)).toBe(false);
    const ok = await guardia().post('/extender', { lat: COORDS.lat, lng: COORDS.lng, precisionM: 10 });
    expect(ok.status).toBe(200);
    expect(await servicio.puedeSalidaFinal(100)).toBe(true);
    // La salida final cierra desde la hora de su primera salida.
    await servicio.alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T04:00:00Z', { final: true }) });
    expect(repo.filas[0]).toMatchObject({ estado: 'por_aprobar', minutos: 120 });
    expect(await servicio.puedeSalidaFinal(100)).toBe(false);
  });

  it('un supervisor no puede usar la ruta del guardia', async () => {
    expect((await sup().post('/extender', {})).status).toBe(403);
  });
});

describe('horas extra: vigilancia del servidor (AS5-03)', () => {
  it('jornada sin salida pasada su hora + 15 min: se abre el registro y avisa al supervisor y al guardia, una sola vez', async () => {
    ahora = en('2026-10-27T02:20:00Z');
    await servicio.revisar();
    expect(repo.filas).toHaveLength(1);
    expect(repo.filas[0]).toMatchObject({ estado: 'abierta', origen: 'jornada_abierta', minutos: null });
    expect(avisos.map((a) => a.usuarioIds)).toEqual([[5], [10]]);
    await servicio.revisar();
    expect(repo.filas).toHaveLength(1);
    expect(avisos).toHaveLength(2);
  });

  it('no abre nada antes de la tolerancia ni si ya marcó salida', async () => {
    ahora = en('2026-10-27T02:10:00Z');
    await servicio.revisar();
    expect(repo.filas).toHaveLength(0);
    repo.salidas.set(100, en('2026-10-27T02:00:00Z'));
    ahora = en('2026-10-27T03:00:00Z');
    await servicio.revisar();
    expect(repo.filas).toHaveLength(0);
  });

  it('el guardia no avisó y marca su salida casi a tiempo: se descarta; si fue mucho después, queda por aprobar', async () => {
    ahora = en('2026-10-27T02:20:00Z');
    await servicio.revisar();
    await servicio.alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T02:15:00Z') });
    expect(repo.filas).toHaveLength(0);

    repo.entradas = [ENTRADA_LUNES];
    await servicio.revisar();
    await servicio.alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T03:00:00Z') });
    expect(repo.filas[0]).toMatchObject({ estado: 'por_aprobar', origen: 'salida_tardia', minutos: 60 });
  });

  it('pasado el límite de la jornada sin salida final queda "sin salida" y avisa', async () => {
    ahora = en('2026-10-27T02:20:00Z');
    await guardia().post('/extender', {});
    ahora = en('2026-10-27T21:00:00Z'); // más de 30 h desde la entrada
    await servicio.revisar();
    expect(repo.filas[0].estado).toBe('sin_salida');
    expect(avisos.some((a) => a.mensaje.includes('Fija la hora'))).toBe(true);
  });

  it('sin respuesta del supervisor en 12 h el aviso sube a los admins, una sola vez', async () => {
    await servicio.alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T03:00:00Z') });
    ahora = en('2026-10-27T10:00:00Z');
    await servicio.revisar();
    expect(avisos.some((a) => a.usuarioIds[0] === 1)).toBe(false);
    ahora = en('2026-10-27T20:00:00Z');
    await servicio.revisar();
    expect(avisos.filter((a) => a.usuarioIds[0] === 1)).toHaveLength(1);
    await servicio.revisar();
    expect(avisos.filter((a) => a.usuarioIds[0] === 1)).toHaveLength(1);
  });
});

describe('horas extra: supervisor y admin (AS5-04)', () => {
  const porAprobar = async () => {
    await servicio.alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T04:30:00Z') });
    avisos.length = 0;
    bitacora.length = 0;
    return repo.filas[0].id;
  };

  it('el guardia no ve nada de esto', async () => {
    expect((await guardia().get('')).status).toBe(403);
    expect((await guardia().get('/reporte?desde=2026-10-01&hasta=2026-10-31')).status).toBe(403);
    expect((await guardia().post('/1/resolver', { decision: 'aprobar' })).status).toBe(403);
  });

  it('lista con el contador de pendientes', async () => {
    await porAprobar();
    const res = await sup().get('?estado=pendientes');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 1, pendientes: 1 });
    expect(res.body.data.items[0]).toMatchObject({ estado: 'por_aprobar', minutos: 150, guardia: { nombre: 'Juan' } });
  });

  it('aprobar deja constancia en auditoría y bitácora y avisa al guardia', async () => {
    const id = await porAprobar();
    const res = await sup().post(`/${id}/resolver`, { decision: 'aprobar' });
    expect(res.body.data).toMatchObject({ estado: 'aprobada', resolucion: { por: 'Sofía Sup' } });
    expect(audit.acciones()).toEqual(['horas_extra.aprobar']);
    expect(bitacora[0]).toMatchObject({ tipo: 'horas_extra', actorId: 5, usuarioIds: [10] });
    expect(bitacora[0].detalle).toContain('Aprobó');
    expect(avisos).toEqual([{ usuarioIds: [10], mensaje: expect.stringContaining('fueron aprobadas') }]);
    // Ya resuelta.
    expect((await sup().post(`/${id}/resolver`, { decision: 'rechazar', nota: 'x' })).status).toBe(409);
  });

  it('rechazar pide el motivo y lo guarda', async () => {
    const id = await porAprobar();
    expect((await sup().post(`/${id}/resolver`, { decision: 'rechazar' })).status).toBe(400);
    const res = await sup().post(`/${id}/resolver`, { decision: 'rechazar', nota: 'Era relevo tardío' });
    expect(res.body.data).toMatchObject({ estado: 'rechazada', resolucion: { nota: 'Era relevo tardío' } });
    expect(avisos[0].mensaje).toContain('Era relevo tardío');
  });

  it('una abierta o sin salida no se aprueba, pero sí se corta y luego se aprueba', async () => {
    ahora = en('2026-10-27T02:20:00Z');
    await servicio.revisar();
    const id = repo.filas[0].id;
    expect((await sup().post(`/${id}/resolver`, { decision: 'aprobar' })).status).toBe(409);
    ahora = en('2026-10-27T05:00:00Z');
    expect((await sup().post(`/${id}/cortar`, { hasta: '2026-10-27T04:00:00.000Z' })).status).toBe(400); // sin motivo
    expect((await sup().post(`/${id}/cortar`, { hasta: '2026-10-27T01:00:00.000Z', nota: 'Antes' })).status).toBe(400);
    expect((await sup().post(`/${id}/cortar`, { hasta: '2026-10-27T06:00:00.000Z', nota: 'Futuro' })).status).toBe(400);
    const cortada = await sup().post(`/${id}/cortar`, { hasta: '2026-10-27T04:00:00.000Z', nota: 'Se fue a las 10 pm' });
    expect(cortada.body.data).toMatchObject({ estado: 'por_aprobar', minutos: 120 });
    expect(audit.acciones()).toContain('horas_extra.cortar');
    expect(bitacora.at(-1)?.detalle).toContain('Se fue a las 10 pm');
    expect((await sup().post(`/${id}/resolver`, { decision: 'aprobar' })).status).toBe(200);
  });

  it('captura manual: queda aprobada con motivo, en bitácora y avisa al guardia; no se empalma', async () => {
    ahora = en('2026-10-27T08:00:00Z');
    const cuerpo = { guardiaId: 10, fecha: '2026-10-26', desde: '20:00', hasta: '22:30', motivo: 'Se quedó por el relevo' };
    const res = await sup().post('', cuerpo);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      estado: 'aprobada',
      origen: 'captura_supervisor',
      minutos: 150,
      motivo: 'Se quedó por el relevo',
      sitio: { id: 1 },
      resolucion: { por: 'Sofía Sup' },
    });
    expect(audit.acciones()).toEqual(['horas_extra.capturar']);
    expect(bitacora[0]).toMatchObject({ tipo: 'horas_extra', actorId: 5 });
    expect(bitacora[0].detalle).toContain('Capturó 2 h 30 min');
    expect(avisos[0].usuarioIds).toEqual([10]);
    expect((await sup().post('', { ...cuerpo, desde: '21:00', hasta: '23:00' })).status).toBe(409);
    // Cruza la medianoche.
    expect((await admin().post('', { ...cuerpo, desde: '23:00', hasta: '01:00' })).body.data.minutos).toBe(120);
    // Sin motivo, día futuro o guardia que no es.
    expect((await sup().post('', { ...cuerpo, motivo: '' })).status).toBe(400);
    expect((await sup().post('', { ...cuerpo, fecha: '2026-10-30' })).status).toBe(400);
    expect((await sup().post('', { ...cuerpo, guardiaId: 5 })).status).toBe(400);
  });

  it('un supervisor solo ve y resuelve lo de su alcance', async () => {
    const id = await porAprobar();
    alcance = { sitioIds: new Set([2]), guardiaIds: new Set([11]) };
    expect((await sup().get('')).body.data.total).toBe(0);
    expect((await sup().post(`/${id}/resolver`, { decision: 'aprobar' })).status).toBe(404);
    expect((await sup().post('', { guardiaId: 10, fecha: '2026-10-26', desde: '20:00', hasta: '21:00', motivo: 'x y z' })).status).toBe(404);
    expect((await sup().get('/opciones')).body.data).toEqual({
      guardias: [{ id: 11, nombre: 'Ana' }],
      sitios: [{ id: 2, nombre: 'Plaza Norte' }],
    });
    expect((await admin().get('')).body.data.total).toBe(1);
  });
});

describe('horas extra: reporte (AS5-05)', () => {
  it('suma por guardia solo lo aprobado y muestra aparte lo pendiente', async () => {
    await servicio.alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T04:30:00Z') });
    await sup().post('/1/resolver', { decision: 'aprobar' });
    await sup().post('', { guardiaId: 11, fecha: '2026-10-26', desde: '20:00', hasta: '21:00', motivo: 'Cubrió relevo' });
    repo.entradas.push(ENTRADA_SABADO);
    await servicio.alSalir({ entrada: marca(ENTRADA_SABADO), salida: salida('2026-11-01T02:00:00Z') });

    const res = await sup().get('/reporte?desde=2026-10-01&hasta=2026-10-31');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ aprobadasMin: 210, pendientesMin: 720 });
    const [ana, juan] = res.body.data.guardias;
    expect(ana).toMatchObject({ guardia: { nombre: 'Ana' }, aprobadasMin: 60, pendientesMin: 0 });
    expect(juan).toMatchObject({ guardia: { nombre: 'Juan' }, aprobadasMin: 150, pendientesMin: 720 });
    expect(juan.registros).toHaveLength(2);
    expect((await sup().get('/reporte?desde=2026-10-31&hasta=2026-10-01')).status).toBe(400);
  });
});

describe('horas extra: con el plan del supervisor (AS6-05, AS6-08)', () => {
  const caso = (extra: Partial<CasoRow> = {}): CasoRow => ({
    id: 7,
    entradaId: 100,
    guardiaId: 10,
    sitioId: 1,
    relevoId: 11,
    relevoInicio: null,
    estado: 'resuelto',
    decision: 'no_llegara',
    siguiente: 'normal',
    descansoExtraHoras: 0,
    finCubierto: en('2026-10-27T14:00:00Z'),
    regresaEn: null,
    limiteExtra: en('2026-10-27T04:00:00Z'),
    coberturaId: null,
    resueltoPorId: 5,
    reconsultarEn: null,
    nota: null,
    ...extra,
  });
  const conPlan = (c: CasoRow | null) =>
    new HorasExtraService(
      repo,
      async () => TURNOS,
      async () => [{ sitio: { id: 1, nombre: 'POETAS' } }] as never,
      audit,
      async (usuarioIds, a) => void avisos.push({ usuarioIds, mensaje: a.mensaje }),
      async (e) => void bitacora.push(e),
      () => ahora,
      async () => c,
    );

  it('con "no llegará" las horas se aprueban solas y terminan donde empieza su turno normal', async () => {
    ahora = en('2026-10-27T02:20:00Z');
    await guardia().post('/extender', {});
    avisos.length = 0;
    // Marca su salida a las 5:00Z, pero su turno normal empieza a las 4:00Z: lo extra es de 2:00 a 4:00.
    await conPlan(caso()).alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T05:00:00Z') });
    expect(repo.filas[0]).toMatchObject({ estado: 'aprobada', minutos: 120, resueltoPor: expect.any(String), notaResolucion: 'Aprobadas con el plan de cobertura' });
    expect(repo.filas[0].hasta).toEqual(en('2026-10-27T04:00:00Z'));
    // No se vuelve a pedir la aprobación al supervisor; se le dice al guardia.
    expect(avisos).toEqual([{ usuarioIds: [10], mensaje: expect.stringContaining('quedaron aprobadas con el plan') }]);
    expect(bitacora.at(-1)).toMatchObject({ tipo: 'horas_extra', actorId: 5 });
  });

  it('lo que pasa de la hora autorizada se aprueba solo hasta esa hora y el resto queda por aprobar', async () => {
    ahora = en('2026-10-27T02:20:00Z');
    await guardia().post('/extender', {});
    avisos.length = 0;
    // Autorizado hasta las 4:00Z; marca su salida a las 5:00Z.
    await conPlan(caso({ finCubierto: en('2026-10-27T04:00:00Z'), limiteExtra: null })).alSalir({
      entrada: marca(ENTRADA_LUNES),
      salida: salida('2026-10-27T05:00:00Z'),
    });
    expect(repo.filas[0]).toMatchObject({ estado: 'aprobada', minutos: 120 });
    expect(repo.filas[0].hasta).toEqual(en('2026-10-27T04:00:00Z'));
    expect(repo.filas[1]).toMatchObject({ estado: 'por_aprobar', minutos: 60, origen: 'salida_tardia' });
    expect(repo.filas[1].desde).toEqual(en('2026-10-27T04:00:00Z'));
    // Al supervisor le llega la aprobación del excedente; al guardia, lo aprobado.
    expect(avisos.some((a) => a.usuarioIds.includes(5) && a.mensaje.includes('por aprobar'))).toBe(true);
  });

  it('un par de minutos después de la hora autorizada no cuentan como excedente', async () => {
    ahora = en('2026-10-27T02:20:00Z');
    await guardia().post('/extender', {});
    await conPlan(caso({ finCubierto: en('2026-10-27T04:00:00Z'), limiteExtra: null })).alSalir({
      entrada: marca(ENTRADA_LUNES),
      salida: salida('2026-10-27T04:05:00Z'),
    });
    expect(repo.filas).toHaveLength(1);
    expect(repo.filas[0]).toMatchObject({ estado: 'aprobada', minutos: 120 });
  });

  it('con "descansa" no hay tope: se aprueban las horas que trabajó', async () => {
    ahora = en('2026-10-27T02:20:00Z');
    await guardia().post('/extender', {});
    await conPlan(caso({ siguiente: 'descansa', limiteExtra: null })).alSalir({ entrada: marca(ENTRADA_LUNES), salida: salida('2026-10-27T05:00:00Z') });
    expect(repo.filas[0]).toMatchObject({ estado: 'aprobada', minutos: 180 });
  });

  it('con "viene en camino" o sin plan siguen por aprobar como siempre', async () => {
    ahora = en('2026-10-27T02:20:00Z');
    await guardia().post('/extender', {});
    await conPlan(caso({ decision: 'en_camino', estado: 'en_espera', limiteExtra: null })).alSalir({
      entrada: marca(ENTRADA_LUNES),
      salida: salida('2026-10-27T05:00:00Z'),
    });
    expect(repo.filas[0]).toMatchObject({ estado: 'por_aprobar', minutos: 180 });
  });

  it('el guardia ve su plan: hasta cuándo cubre, qué pasa con su siguiente turno y cuándo regresa', async () => {
    expect(await conPlan(null).plan(100)).toBeNull();
    expect(await conPlan(caso({ estado: 'cancelado' })).plan(100)).toBeNull();
    expect(await conPlan(caso({ siguiente: 'descansa', regresaEn: en('2026-10-28T14:00:00Z') })).plan(100)).toEqual({
      estado: 'resuelto',
      decision: 'no_llegara',
      cubreHasta: '2026-10-27T14:00:00.000Z',
      siguiente: 'descansa',
      vuelveA: '2026-10-28T14:00:00.000Z',
      limiteExtra: '2026-10-27T04:00:00.000Z',
      nota: null,
    });
  });
});
