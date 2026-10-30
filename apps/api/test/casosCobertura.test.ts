import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  PERMISOS_POR_ROL,
  ROLES,
  type CoberturaCreada,
  type CoberturaData,
  type PatronTurno,
  type Rol,
} from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken, type AccionCtx } from '../src/core';
import type { TurnoProgramado } from '../src/modules/asistencia/vigilancia';
import type { EventoNuevo } from '../src/modules/bitacora/registrar';
import { createCasosCoberturaModule } from '../src/modules/casos-cobertura';
import {
  CasosCoberturaRepository,
  type Candidato,
  type CasoRow,
  type DatosCaso,
  type EntradaCaso,
} from '../src/modules/casos-cobertura/casos.repository';
import { CasosCoberturaService } from '../src/modules/casos-cobertura/casos.service';
import type { Alcance } from '../src/modules/sitios/alcance';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const en = (iso: string) => new Date(iso);

/** Juan (10) de día (8:00 a 20:00, todos los días) y Ana (11) de noche (20:00 a 8:00), en POETAS. Zona UTC-6. */
const dia: PatronTurno = { tipo: 'fija', horas: 12, dias: { tipo: 'diario' }, horaInicio: '08:00', horaFin: null, desde: '2026-10-01', hasta: null };
const noche: PatronTurno = { ...dia, horaInicio: '20:00' };
const SITIO = { id: 1, nombre: 'POETAS', supervisorId: 5 };
const TURNOS: TurnoProgramado[] = [
  { asignacionId: 1, sitio: SITIO, guardia: { id: 10, nombre: 'Juan' }, patron: dia },
  { asignacionId: 2, sitio: SITIO, guardia: { id: 11, nombre: 'Ana' }, patron: noche },
];

/** Juan entró el lunes 26 a las 8:00 y debía salir a las 20:00 (02:00Z del martes). */
const ENTRADA: EntradaCaso = {
  id: 100,
  usuarioId: 10,
  guardia: 'Juan',
  sitio: SITIO,
  registradaEn: en('2026-10-26T14:02:00Z'),
  programadaEntrada: en('2026-10-26T14:00:00Z'),
  programadaSalida: en('2026-10-27T02:00:00Z'),
};

class MemoriaCasos extends CasosCoberturaRepository {
  caso: CasoRow | null = null;
  /** Si hay horas extra abiertas de Juan. */
  abierta = true;
  relevo: { id: number; nombre: string; inicio: Date } | null = { id: 11, nombre: 'Ana', inicio: en('2026-10-27T02:00:00Z') };
  pausas: { casoId: number; usuarioId: number; fechas: string[] }[] = [];
  enviados = new Set<string>();
  noPuede: { noPuedeEn: Date | null; noPuedeMotivo: string | null; noPuedeNota: string | null } = {
    noPuedeEn: null,
    noPuedeMotivo: null,
    noPuedeNota: null,
  };

  private candidatoActual(): Candidato | null {
    return this.abierta
      ? { entrada: ENTRADA, horaExtra: { id: 1, estado: 'abierta', origen: 'jornada_abierta', desde: ENTRADA.programadaSalida!, ...this.noPuede }, caso: this.caso }
      : null;
  }
  async candidatos() {
    const c = this.candidatoActual();
    return c ? [c] : [];
  }
  async candidato(entradaId: number) {
    return entradaId === ENTRADA.id ? this.candidatoActual() : null;
  }
  async candidatoDe(usuarioId: number) {
    return usuarioId === 10 ? this.candidatoActual() : null;
  }
  async relevoDe() {
    return this.relevo;
  }
  async guardarCaso(entrada: EntradaCaso, datos: DatosCaso) {
    this.caso = { id: 7, entradaId: entrada.id, guardiaId: entrada.usuarioId, sitioId: entrada.sitio.id, ...datos };
    return this.caso;
  }
  async actualizarCaso(_id: number, datos: Partial<DatosCaso>) {
    this.caso = { ...this.caso!, ...datos };
    return this.caso;
  }
  async eliminarCaso() {
    this.caso = null;
  }
  async registrarNoPuede(_id: number, d: { en: Date; motivo: string; nota: string | null }) {
    this.noPuede = { noPuedeEn: d.en, noPuedeMotivo: d.motivo, noPuedeNota: d.nota };
  }
  async crearPausas(casoId: number, usuarioId: number, fechas: string[]) {
    this.pausas.push({ casoId, usuarioId, fechas });
  }
  async paraReconsultar(ahora: Date) {
    const c = this.candidatoActual();
    return c && this.caso?.estado === 'en_espera' && this.caso.reconsultarEn! <= ahora ? [c] : [];
  }
  async casoPorEntrada() {
    return this.caso;
  }
  async guardia(id: number) {
    return { 12: { id: 12, nombre: 'Luis' }, 11: { id: 11, nombre: 'Ana' } }[id as 11 | 12] ?? null;
  }
  async marcarEnviado(clave: string) {
    if (this.enviados.has(clave)) return false;
    this.enviados.add(clave);
    return true;
  }
  async revisoresDe() {
    return [5];
  }
}

let repo: MemoriaCasos;
let audit: MemoryAuditLogger;
let avisos: { usuarioIds: number[]; mensaje: string; ruta?: string | null }[];
let bitacora: EventoNuevo[];
let coberturas: CoberturaData[];
let canceladas: number[];
let alcance: Alcance | null;
let ahora: Date;
let servicio: CasosCoberturaService;
let app: ReturnType<typeof createApp>;

const token = (id: number, rol: Rol) => `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol] })}`;
const como = (id: number, rol: Rol) => ({
  get: (u: string) => request(app).get(`/api/casos-cobertura${u}`).set('Authorization', token(id, rol)),
  post: (u: string, b: object = {}) => request(app).post(`/api/casos-cobertura${u}`).set('Authorization', token(id, rol)).send(b),
});
const sup = () => como(5, ROLES.SUPERVISOR);
const guardia = () => como(10, ROLES.GUARDIA);

beforeEach(() => {
  repo = new MemoriaCasos();
  audit = new MemoryAuditLogger();
  avisos = [];
  bitacora = [];
  coberturas = [];
  canceladas = [];
  alcance = null;
  // Martes 27, 02:30Z = lunes 26, 20:30 locales: Ana no llegó (20:00) y Juan sigue en el sitio.
  ahora = en('2026-10-27T02:30:00Z');
  const deps = {
    repo,
    audit,
    turnos: async () => TURNOS,
    avisar: async (usuarioIds: number[], a: { mensaje: string; ruta?: string | null }) =>
      void avisos.push({ usuarioIds, mensaje: a.mensaje, ruta: a.ruta }),
    bitacora: async (e: EventoNuevo) => void bitacora.push(e),
    cubrir: async (data: CoberturaData, _ctx: AccionCtx): Promise<CoberturaCreada> => {
      coberturas.push(data);
      return { cobertura: { id: 50 + coberturas.length } as never, advertencia: null };
    },
    cancelarCobertura: async (id: number) => void canceladas.push(id),
    ahora: () => ahora,
  };
  servicio = new CasosCoberturaService(repo, deps.turnos, deps.cubrir, audit, deps.avisar, deps.bitacora, deps.ahora, deps.cancelarCobertura);
  app = createApp([createCasosCoberturaModule({ ...deps, alcance: async (u) => (u.rol === ROLES.SUPERVISOR ? alcance : null) })]);
});

describe('casos de cobertura: lista y vista previa (AS6-05, AS6-06)', () => {
  it('lista el caso: quién se queda, quién no llegó y el turno que debía cubrir', async () => {
    const res = await sup().get('/');
    expect(res.status).toBe(200);
    expect(res.body.data.pendientes).toBe(1);
    expect(res.body.data.items[0]).toMatchObject({
      entradaId: 100,
      estado: 'nuevo',
      guardia: { id: 10, nombre: 'Juan' },
      sitio: { id: 1, nombre: 'POETAS' },
      relevo: { id: 11, nombre: 'Ana', inicio: '2026-10-27T02:00:00.000Z', fin: '2026-10-27T14:00:00.000Z', horas: 12 },
      decision: null,
    });
  });

  it('el supervisor solo ve los casos de sus sitios', async () => {
    alcance = { sitioIds: new Set([2]), guardiaIds: new Set([99]) };
    expect((await sup().get('/')).body.data.items).toEqual([]);
    expect((await sup().get('/100/vista-previa')).status).toBe(404);
  });

  it('vista previa: cubre hasta el fin del turno de Ana, descansa 12 h como su patrón y deja un hueco', async () => {
    const res = await sup().get('/100/vista-previa?descansoExtraHoras=0');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      finCubierto: '2026-10-27T14:00:00.000Z',
      descansoPatronHoras: 12,
      regresaEn: '2026-10-28T02:00:00.000Z',
      vuelveA: '2026-10-28T14:00:00.000Z',
      limiteExtra: '2026-10-27T14:00:00.000Z',
      huecos: [{ fecha: '2026-10-27', horaInicio: '08:00', horas: 12 }],
      entraTarde: null,
    });
  });

  it('el plan exige motivo; con "otro" pide el detalle y el motivo queda en el caso, bitácora y avisos', async () => {
    expect((await sup().post('/100/resolver', { decision: 'en_camino' })).status).toBe(400);
    expect((await sup().post('/100/resolver', { decision: 'en_camino', motivo: 'otro' })).status).toBe(400);
    const res = await sup().post('/100/resolver', { decision: 'en_camino', motivo: 'falta_personal', nota: 'Faltaron dos' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ motivo: 'falta_personal', nota: 'Faltaron dos' });
    expect(repo.caso).toMatchObject({ motivo: 'falta_personal' });
    expect(bitacora[0].detalle).toContain('Motivo: Falta de personal: Faltaron dos');
    expect(avisos.find((x) => x.usuarioIds[0] === 10)?.mensaje).toContain('Motivo: Falta de personal: Faltaron dos');
    expect(audit.eventos.find((e) => e.accion === 'casos_cobertura.resolver')?.datos).toMatchObject({ motivo: 'falta_personal' });
  });

  it('solo admin y supervisor ven los casos; el guardia no', async () => {
    expect((await guardia().get('/')).status).toBe(403);
    expect((await como(1, ROLES.ADMIN).get('/')).status).toBe(200);
  });
});

describe('casos de cobertura: el supervisor deja el plan (AS6-05)', () => {
  it('"viene en camino": el guardia espera, se le avisa y a las 2 h se vuelve a preguntar', async () => {
    const res = await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'en_camino' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ estado: 'en_espera', decision: 'en_camino' });
    expect(avisos.at(-1)).toMatchObject({ usuarioIds: [10], mensaje: expect.stringContaining('viene en camino') });
    expect(bitacora[0]).toMatchObject({ tipo: 'cobertura', usuarioIds: [10], actorId: 5 });
    expect(audit.eventos.map((e) => e.accion)).toContain('casos_cobertura.resolver');
    expect(coberturas).toEqual([]);

    avisos.length = 0;
    await servicio.revisar();
    expect(avisos).toEqual([]);
    ahora = en('2026-10-27T04:31:00Z');
    await servicio.revisar();
    expect(avisos).toEqual([
      { usuarioIds: [5], mensaje: expect.stringContaining('esperando a su relevo'), ruta: '/asistencia/casos' },
    ]);
    // No repite el aviso hasta pasadas otras 2 h.
    avisos.length = 0;
    await servicio.revisar();
    expect(avisos).toEqual([]);
  });

  it('"no llegará" + "lo trabaja normal": las horas extra terminan donde empieza su turno; nadie descansa', async () => {
    const res = await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara', siguiente: 'normal' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ estado: 'resuelto', decision: 'no_llegara', siguiente: 'normal' });
    expect(repo.caso).toMatchObject({ limiteExtra: en('2026-10-27T14:00:00Z'), finCubierto: en('2026-10-27T14:00:00Z'), resueltoPorId: 5 });
    expect(repo.pausas).toEqual([]);
    expect(coberturas).toEqual([]);
    expect(avisos.find((x) => x.usuarioIds[0] === 10)?.mensaje).toContain('lo trabajas normal');
  });

  it('"no llegará": el supervisor elige hasta qué hora se queda y esa hora manda en el plan', async () => {
    const res = await sup().post('/100/resolver', {
      motivo: 'relevo_no_llego',
      decision: 'no_llegara',
      siguiente: 'normal',
      finCubierto: '2026-10-27T05:00:00.000Z',
    });
    expect(res.status).toBe(200);
    expect(repo.caso).toMatchObject({ finCubierto: en('2026-10-27T05:00:00Z') });
    expect((await sup().get('/100/vista-previa?finCubierto=2026-10-27T05:00:00.000Z')).body.data.finCubierto).toBe('2026-10-27T05:00:00.000Z');
    expect(avisos.find((x) => x.usuarioIds[0] === 10)?.mensaje).toContain('marca tu salida');
  });

  it('"no llegará": si la hora ya pasó (la elegida o la del turno del relevo) no deja guardar el plan', async () => {
    // La hora elegida ya pasó.
    let res = await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara', siguiente: 'normal', finCubierto: '2026-10-27T02:10:00.000Z' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ path: 'finCubierto', message: expect.stringContaining('ya pasó') }]);
    // El turno del relevo terminaba 14:00Z y ya son las 15:00Z: hay que decir hasta cuándo se queda.
    ahora = en('2026-10-27T15:00:00Z');
    res = await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara', siguiente: 'normal' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ path: 'finCubierto' });
    expect(repo.caso).toBeNull();
    // Antes de su hora de salida tampoco.
    ahora = en('2026-10-27T02:30:00Z');
    res = await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara', siguiente: 'normal', finCubierto: '2026-10-27T01:00:00.000Z' });
    expect(res.status).toBe(400);
  });

  it('pasada la hora autorizada sin salida se avisa una sola vez al guardia y al supervisor', async () => {
    await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara', siguiente: 'normal', finCubierto: '2026-10-27T05:00:00.000Z' });
    avisos.length = 0;
    await servicio.revisar();
    expect(avisos).toEqual([]);
    ahora = en('2026-10-27T05:01:00Z');
    await servicio.revisar();
    expect(avisos).toEqual([
      { usuarioIds: [10], mensaje: expect.stringContaining('Ya pasó tu hora autorizada'), ruta: '/marcar' },
      { usuarioIds: [5], mensaje: expect.stringContaining('pasó la hora que autorizaste'), ruta: '/asistencia/casos' },
    ]);
    avisos.length = 0;
    await servicio.revisar();
    expect(avisos).toEqual([]);
  });

  it('"no llegará" + "descansa" + quien cubre el hueco: cobertura, pausa del turno y hora de regreso', async () => {
    const res = await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara', siguiente: 'descansa', cubridorId: 12 });
    expect(res.status).toBe(200);
    expect(coberturas).toEqual([
      expect.objectContaining({ usuarioId: 12, sitioId: 1, desde: '2026-10-27', horaInicio: '08:00', horas: 12, cubreAId: 10 }),
    ]);
    // Su turno del 27 queda en pausa (sin falta ni retardo) y regresa el 28 a las 8:00.
    expect(repo.pausas).toEqual([{ casoId: 7, usuarioId: 10, fechas: ['2026-10-27'] }]);
    expect(repo.caso).toMatchObject({ siguiente: 'descansa', regresaEn: en('2026-10-28T14:00:00Z'), coberturaId: 51 });
    expect(avisos.find((a) => a.usuarioIds[0] === 10)?.mensaje).toContain('descansas');
  });

  it('descansa sin elegir quién cubre: queda el hueco y se dice en la bitácora', async () => {
    await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara', siguiente: 'descansa' });
    expect(coberturas).toEqual([]);
    expect(repo.pausas).toHaveLength(1);
    expect(bitacora[0].detalle).toContain('Queda un turno sin cubrir');
  });

  it('el supervisor puede agregar descanso: regresa más tarde', async () => {
    await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara', siguiente: 'descansa', descansoExtraHoras: 24 });
    expect(repo.caso).toMatchObject({ descansoExtraHoras: 24, regresaEn: en('2026-10-29T14:00:00Z') });
  });

  it('"mando a otro": se crea la cobertura del turno de Ana y el guardia entrega', async () => {
    const res = await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'otro_cubre', cubridorId: 12 });
    expect(res.status).toBe(200);
    expect(coberturas).toEqual([
      expect.objectContaining({ usuarioId: 12, desde: '2026-10-26', horaInicio: '20:00', horas: 12, cubreAId: 11 }),
    ]);
    expect(repo.caso).toMatchObject({ estado: 'resuelto', decision: 'otro_cubre', coberturaId: 51 });
    expect(avisos.at(-1)).toMatchObject({ usuarioIds: [10], mensaje: expect.stringContaining('Luis llega a cubrir') });
  });

  it('avisa del cansancio al supervisor cuando el plan deja muchas horas seguidas', async () => {
    // Entró el 26 a las 8:00; si sigue hasta el fin del turno de Ana (8:00 del 27) son 24 h.
    await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara', siguiente: 'normal' });
    expect(avisos.some((a) => a.usuarioIds[0] === 5 && a.mensaje.includes('h seguidas'))).toBe(true);
  });

  it('valida: "no llegará" pide el siguiente turno y "mando a otro" pide quién', async () => {
    expect((await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara' })).status).toBe(400);
    expect((await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'otro_cubre' })).status).toBe(400);
    expect((await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'otro_cubre', cubridorId: 99 })).status).toBe(400);
    expect((await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara', siguiente: 'descansa', descansoExtraHoras: 200 })).status).toBe(400);
  });

  it('un caso con plan no se resuelve dos veces y un guardia no puede resolverlo', async () => {
    expect((await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'no_llegara', siguiente: 'normal' })).status).toBe(200);
    expect((await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'en_camino' })).status).toBe(409);
    expect((await guardia().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'en_camino' })).status).toBe(403);
  });

  it('si el guardia ya terminó sus horas extra no hay caso', async () => {
    repo.abierta = false;
    expect((await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'en_camino' })).status).toBe(404);
  });
});

describe('casos de cobertura: cancelar o cambiar el plan (A-45)', () => {
  const confirmar = (extra: object = {}) =>
    sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'otro_cubre', cubridorId: 12, ...extra });

  it('cancelar pide motivo, deshace las coberturas del plan, deja el caso "sin decidir" y avisa al guardia', async () => {
    expect((await confirmar()).status).toBe(200);
    avisos.length = 0;
    bitacora.length = 0;
    expect((await sup().post('/100/cancelar', {})).status).toBe(400);
    expect((await sup().post('/100/cancelar', { motivo: 'otro' })).status).toBe(400);

    const res = await sup().post('/100/cancelar', { motivo: 'relevo_llego' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ estado: 'nuevo', decision: null, motivo: null });
    expect(canceladas).toEqual([51]);
    expect(repo.caso).toBeNull();
    expect(avisos.find((x) => x.usuarioIds[0] === 10)?.mensaje).toContain('El relevo ya llegó');
    expect(bitacora[0].detalle).toContain('canceló el plan');
    expect(bitacora[0].detalle).toContain('Motivo: El relevo ya llegó');
    expect(audit.eventos.map((e) => e.accion)).toContain('casos_cobertura.cancelar');
  });

  it('cancela todas las coberturas del plan, no solo la primera', async () => {
    await confirmar();
    repo.caso = { ...repo.caso!, coberturasIds: '51,52' };
    await sup().post('/100/cancelar', { motivo: 'error' });
    expect(canceladas).toEqual([51, 52]);
  });

  it('cambiar deshace el plan anterior y confirma el nuevo con su motivo', async () => {
    await confirmar();
    const res = await sup().post('/100/cambiar', { motivo: 'falta_personal', decision: 'en_camino' });
    expect(res.status).toBe(200);
    expect(canceladas).toEqual([51]);
    expect(res.body.data).toMatchObject({ decision: 'en_camino', motivo: 'falta_personal' });
    expect(audit.eventos.map((e) => e.accion)).toEqual(expect.arrayContaining(['casos_cobertura.cambiar', 'casos_cobertura.resolver']));
    expect((await sup().post('/100/cambiar', { decision: 'en_camino' })).status).toBe(400);
  });

  it('sin plan no hay qué cancelar ni cambiar; con las horas extra cerradas tampoco', async () => {
    expect((await sup().post('/100/cancelar', { motivo: 'error' })).status).toBe(409);
    expect((await sup().post('/100/cambiar', { motivo: 'falta_personal', decision: 'en_camino' })).status).toBe(409);
    await confirmar();
    repo.abierta = false;
    expect((await sup().post('/100/cancelar', { motivo: 'error' })).status).toBe(404);
  });

  it('el guardia no puede cancelar ni cambiar', async () => {
    await confirmar();
    expect((await guardia().post('/100/cancelar', { motivo: 'error' })).status).toBe(403);
    expect((await guardia().post('/100/cambiar', { motivo: 'falta_personal', decision: 'en_camino' })).status).toBe(403);
  });
});

describe('casos de cobertura: avisos y el guardia (AS6-05, AS6-08)', () => {
  it('la vigilancia avisa una sola vez al supervisor y al guardia cuando el relevo no llegó', async () => {
    await servicio.revisar();
    expect(avisos).toEqual([
      { usuarioIds: [5], mensaje: expect.stringContaining('Ana no llegó (le tocaba a las 8:00 p.m.) y Juan sigue en el sitio'), ruta: '/asistencia/casos' },
      { usuarioIds: [10], mensaje: expect.stringContaining('Tu supervisor ya sabe que sigues'), ruta: '/marcar' },
    ]);
    avisos.length = 0;
    await servicio.revisar();
    expect(avisos).toEqual([]);
  });

  it('sin relevo registrado no se avisa solo (el supervisor lo ve en la lista)', async () => {
    repo.relevo = null;
    await servicio.revisar();
    expect(avisos).toEqual([]);
    expect((await sup().get('/')).body.data.items[0]).toMatchObject({ estado: 'nuevo', relevo: null });
  });

  it('"No puedo quedarme": pide motivo, avisa al supervisor con él, queda en bitácora y auditoría', async () => {
    expect((await guardia().post('/no-puedo')).status).toBe(400);
    expect((await guardia().post('/no-puedo', { motivo: 'otro' })).status).toBe(400);
    const res = await guardia().post('/no-puedo', { motivo: 'salud' });
    expect(res.status).toBe(200);
    expect(avisos).toEqual([
      {
        usuarioIds: [5],
        mensaje: expect.stringContaining('avisó que no puede quedarse (Cuestión de salud). Elige quién cubre'),
        ruta: '/asistencia/casos',
      },
    ]);
    expect(bitacora[0]).toMatchObject({ tipo: 'cobertura', usuarioIds: [10], actorId: 10 });
    expect(bitacora[0].detalle).toContain('Motivo: Cuestión de salud');
    expect(audit.eventos.map((e) => e.accion)).toContain('casos_cobertura.no_puede_quedarse');
  });

  it('con "otro" el detalle es obligatorio y es lo que se ve como motivo', async () => {
    const res = await guardia().post('/no-puedo', { motivo: 'otro', nota: 'Cuido a mi mamá' });
    expect(res.status).toBe(200);
    expect(avisos[0].mensaje).toContain('(Cuido a mi mamá)');
  });

  it('el supervisor ve en el caso que el guardia no puede quedarse y por qué; solo se avisa una vez', async () => {
    await guardia().post('/no-puedo', { motivo: 'cansancio', nota: 'Llevo 16 h' });
    expect((await sup().get('/')).body.data.items[0].noPuede).toMatchObject({
      motivo: 'cansancio',
      nota: 'Llevo 16 h',
    });
    expect((await guardia().post('/no-puedo', { motivo: 'salud' })).status).toBe(409);
  });

  it('con el plan ya dejado, "No puedo quedarme" no aplica', async () => {
    await sup().post('/100/resolver', { motivo: 'relevo_no_llego', decision: 'en_camino' });
    repo.caso = { ...repo.caso!, estado: 'resuelto' };
    expect((await guardia().post('/no-puedo', { motivo: 'salud' })).status).toBe(409);
  });

  it('sin horas extra abiertas "No puedo quedarme" no aplica; el supervisor no usa esa ruta', async () => {
    repo.abierta = false;
    expect((await guardia().post('/no-puedo', { motivo: 'salud' })).status).toBe(409);
    expect((await sup().post('/no-puedo', { motivo: 'salud' })).status).toBe(403);
  });
});
