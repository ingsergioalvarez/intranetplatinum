import type { EventoNuevo } from '../src/modules/bitacora/registrar';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  PERMISOS_POR_ROL,
  ROLES,
  horaSalida,
  huecosDelDia,
  letraDia,
  mismoHorario,
  seCruzan,
  textoDias,
  trabajaEl,
  type DiasTurno,
  type PatronTurno,
  type Rol,
  type TurnoCatalogo,
  type TurnoData,
} from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import { createTurnosModule } from '../src/modules/turnos';
import {
  TurnosRepository,
  type HorarioTurno,
  type UsoDelTurno,
  type UsoDetalle,
} from '../src/modules/turnos/turnos.repository';
import type { Alcance } from '../src/modules/sitios/alcance';
import { MemoryAuditLogger } from './helpers/memoryAudit';

class MemoryTurnosRepository extends TurnosRepository {
  turnos: (TurnoData & { id: number; activo: boolean })[] = [];
  usosPorTurno = new Map<number, UsoDelTurno[]>();
  copias: (HorarioTurno & { id: number })[] = [];
  /** Asignaciones con su sitio (para borrar con reemplazo). */
  detalle = new Map<number, UsoDetalle[]>();
  reasignaciones: { id: number; sitioId: number; nuevoId: number }[] = [];

  private dto(t: TurnoData & { id: number; activo: boolean }): TurnoCatalogo {
    return {
      ...t,
      horaSalida: horaSalida(t.horas, t.horaEntrada),
      enUso: this.usosPorTurno.get(t.id)?.length ?? 0,
    };
  }
  async listar() {
    return this.turnos.map((t) => this.dto(t));
  }
  async findById(id: number) {
    const t = this.turnos.find((x) => x.id === id);
    return t ? this.dto(t) : null;
  }
  async nombreOcupado(nombre: string, excluirId?: number) {
    return this.turnos.some((t) => t.nombre === nombre && t.id !== excluirId);
  }
  async crear(data: TurnoData) {
    const id = this.turnos.length + 1;
    this.turnos.push({ ...data, id, activo: true });
    return id;
  }
  async actualizar(id: number, data: TurnoData) {
    Object.assign(
      this.turnos.find((t) => t.id === id)!,
      data,
    );
  }
  async setActivo(id: number, activo: boolean) {
    this.turnos.find((t) => t.id === id)!.activo = activo;
  }
  async usos(id: number) {
    return this.usosPorTurno.get(id) ?? [];
  }
  async usosDetalle(id: number) {
    return this.detalle.get(id) ?? [];
  }
  async reasignar(id: number, _hoy: string, sitioId: number, nuevo: TurnoCatalogo) {
    this.reasignaciones.push({ id, sitioId, nuevoId: nuevo.id });
  }
  async copiarHorario(id: number, _hoy: string, { horas, horaEntrada, dias }: HorarioTurno) {
    this.copias.push({ id, horas, horaEntrada, dias });
  }
  async eliminar(id: number) {
    this.turnos = this.turnos.filter((t) => t.id !== id);
  }
}

let repo: MemoryTurnosRepository;
let audit: MemoryAuditLogger;
let avisos: { usuarioIds: number[]; mensaje: string }[];
let bitacora: EventoNuevo[];
let app: ReturnType<typeof createApp>;
let alcance: Alcance | null;

const token = (rol: Rol) =>
  `Bearer ${signAccessToken({ id: 2, email: 'u2@x.mx', rol, permisos: PERMISOS_POR_ROL[rol] })}`;
const sup = () => ({
  get: (u: string) => request(app).get(`/api/turnos${u}`).set('Authorization', token(ROLES.SUPERVISOR)),
  post: (u: string, b: object) =>
    request(app).post(`/api/turnos${u}`).set('Authorization', token(ROLES.SUPERVISOR)).send(b),
  put: (u: string, b: object) =>
    request(app).put(`/api/turnos${u}`).set('Authorization', token(ROLES.SUPERVISOR)).send(b),
  patch: (u: string) => request(app).patch(`/api/turnos${u}`).set('Authorization', token(ROLES.SUPERVISOR)),
});

beforeEach(() => {
  repo = new MemoryTurnosRepository();
  audit = new MemoryAuditLogger();
  avisos = [];
  bitacora = [];
  alcance = null;
  app = createApp([
    createTurnosModule({
      repo,
      audit,
      hoy: () => '2026-10-22',
      avisar: async (usuarioIds, { mensaje }) => void avisos.push({ usuarioIds, mensaje }),
      bitacora: async (e) => void bitacora.push(e),
      alcance: async (u) => (u.rol === ROLES.SUPERVISOR ? alcance : null),
    }),
  ]);
});

const UNO_Y_UNO: DiasTurno = { tipo: 'ciclo', trabaja: 1, descansa: 1 };
const DIARIO: DiasTurno = { tipo: 'diario' };

describe('catálogo de turnos (DA-37)', () => {
  const nuevo = { nombre: '24 h · 8:00 a.m.', horas: 24, horaEntrada: '08:00', dias: UNO_Y_UNO };

  it('crea y lista con la hora de salida calculada; el nombre no se repite', async () => {
    const res = await sup().post('', nuevo);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      horas: 24,
      horaSalida: '08:00',
      dias: UNO_Y_UNO,
      activo: true,
      enUso: 0,
    });
    expect((await sup().post('', { ...nuevo, horas: 12 })).status).toBe(409);
    await sup().post('', {
      nombre: 'Oficina',
      horas: 8,
      horaEntrada: '09:00',
      dias: { tipo: 'semanal', semana: [5, 1, 2, 3, 4] },
    });
    const lista = await sup().get('');
    expect(lista.body.data[1]).toMatchObject({
      horaSalida: '17:00',
      dias: { tipo: 'semanal', semana: [1, 2, 3, 4, 5] },
    });
    expect(audit.acciones()).toEqual(['turnos.crear', 'turnos.crear']);
  });

  it('jornadas libres: cualquier hora de 1 a 24 y días válidos', async () => {
    const ok = await sup().post('', {
      nombre: '24x48',
      horas: 24,
      horaEntrada: '07:00',
      dias: { tipo: 'ciclo', trabaja: 1, descansa: 2 },
    });
    expect(ok.status).toBe(201);
    expect((await sup().post('', { ...nuevo, nombre: 'X', horas: 25 })).status).toBe(400);
    expect(
      (await sup().post('', { ...nuevo, nombre: 'Y', dias: { tipo: 'semanal', semana: [] } })).status,
    ).toBe(400);
    expect((await sup().post('', { ...nuevo, nombre: 'Z', horaEntrada: '25:00' })).status).toBe(400);
  });

  it('cambiar el horario lo copia a sus asignaciones y avisa a cada guardia una vez por sitio', async () => {
    await sup().post('', nuevo);
    repo.usosPorTurno.set(1, [
      { asignacionId: 10, sitio: 'POETAS', usuarioId: 3, integrantes: [], grupo: null },
      { asignacionId: 11, sitio: 'POETAS', usuarioId: null, integrantes: [3, 4], grupo: 'Cuadrilla A' },
      { asignacionId: 12, sitio: 'Plaza Norte', usuarioId: 5, integrantes: [], grupo: null },
    ]);
    const res = await sup().put('/1', { ...nuevo, horaEntrada: '07:00' });
    expect(res.body.data).toMatchObject({ horaEntrada: '07:00', horaSalida: '07:00' });
    expect(repo.copias).toEqual([{ id: 1, horas: 24, horaEntrada: '07:00', dias: UNO_Y_UNO }]);
    expect(avisos).toEqual([
      {
        usuarioIds: [3, 4],
        mensaje: 'Cambió tu horario en POETAS: 24 h · entrada 7:00 a.m. (un día sí, uno no)',
      },
      {
        usuarioIds: [5],
        mensaje: 'Cambió tu horario en Plaza Norte: 24 h · entrada 7:00 a.m. (un día sí, uno no)',
      },
    ]);
    // Solo el nombre: no toca asignaciones ni avisa.
    await sup().put('/1', { ...nuevo, nombre: 'Día', horaEntrada: '07:00' });
    expect(avisos).toHaveLength(2);
  });

  it('no se da de baja si está en uso; el guardia no administra turnos', async () => {
    await sup().post('', nuevo);
    repo.usosPorTurno.set(1, [
      { asignacionId: 10, sitio: 'POETAS', usuarioId: 3, integrantes: [], grupo: null },
    ]);
    expect((await sup().patch('/1/baja')).status).toBe(409);
    repo.usosPorTurno.clear();
    expect((await sup().patch('/1/baja')).status).toBe(204);
    expect((await sup().get('')).body.data[0].activo).toBe(false);
    const guardia = await request(app).get('/api/turnos').set('Authorization', token(ROLES.GUARDIA));
    expect(guardia.status).toBe(403);
  });
});

describe('borrar un turno (supervisor o admin)', () => {
  const nuevo = { nombre: '24 h · 8:00 a.m.', horas: 24, horaEntrada: '08:00', dias: UNO_Y_UNO };
  const POETAS = { id: 1, nombre: 'POETAS', supervisorId: 2 };
  const NORTE = { id: 2, nombre: 'Plaza Norte', supervisorId: 9 };
  const uso = (sitio: typeof POETAS, activo = true, asignado = 'Diego', usuarioId: number | null = 3): UsoDetalle => ({
    asignacionId: sitio.id * 10,
    sitio,
    activo,
    asignado,
    usuarioId,
    integrantes: [],
  });
  const borrar = (rol: Rol, id: number, body?: object) =>
    request(app).delete(`/api/turnos/${id}`).set('Authorization', token(rol)).send(body);

  beforeEach(async () => {
    await sup().post('', nuevo);
    await sup().post('', { ...nuevo, nombre: 'Día 12 h', horas: 12, dias: DIARIO });
    alcance = { sitioIds: new Set([1]), guardiaIds: new Set([3]) };
  });

  it('sin asignaciones el supervisor lo borra directo', async () => {
    expect((await borrar(ROLES.SUPERVISOR, 1)).status).toBe(204);
    expect(repo.turnos.map((t) => t.id)).toEqual([2]);
    expect(avisos).toEqual([]);
    expect(audit.eventos.at(-1)).toMatchObject({ accion: 'turnos.eliminar', datos: { reemplazos: [] } });
  });

  it('antes de borrar, el sistema dice a dónde está asignado', async () => {
    repo.detalle.set(1, [uso(POETAS), uso(POETAS, true, 'Cuadrilla A', null), uso({ ...NORTE }, true, 'Ana', 4), uso({ id: 3, nombre: 'Viejo', supervisorId: 2 }, false)]);
    const res = await sup().get('/1/uso');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      turno: { id: 1 },
      puedeBorrar: false,
      motivo: expect.stringContaining('Plaza Norte'),
      sitios: [
        { sitio: { nombre: 'POETAS' }, activo: true, propio: true, asignados: ['Diego', 'Cuadrilla A'] },
        { sitio: { nombre: 'Plaza Norte' }, activo: true, propio: false, asignados: ['Ana'] },
        { sitio: { nombre: 'Viejo' }, activo: false },
      ],
    });
  });

  it('asignado a un sitio activo: pide el turno nuevo; con él, reasigna, avisa a los guardias y borra', async () => {
    repo.detalle.set(1, [{ ...uso(POETAS), usuarioId: 3 }, { ...uso(POETAS, true, 'Cuadrilla A', null), integrantes: [5, 6] }]);
    const sin = await borrar(ROLES.SUPERVISOR, 1);
    expect(sin.status).toBe(409);
    expect(sin.body.error.message).toContain('Elige el turno nuevo de POETAS');
    expect(repo.turnos.map((t) => t.id)).toEqual([1, 2]);

    const ok = await borrar(ROLES.SUPERVISOR, 1, { reemplazos: [{ sitioId: 1, turnoId: 2 }] });
    expect(ok.status).toBe(204);
    expect(repo.reasignaciones).toEqual([{ id: 1, sitioId: 1, nuevoId: 2 }]);
    expect(repo.turnos.map((t) => t.id)).toEqual([2]);
    expect(avisos).toEqual([{ usuarioIds: [3, 5, 6], mensaje: expect.stringContaining('ahora es "Día 12 h"') }]);
    expect(bitacora[0]).toMatchObject({ tipo: 'asignacion_cambio', usuarioIds: [3, 5, 6], sitioId: 1 });
    expect(audit.eventos.at(-1)).toMatchObject({
      accion: 'turnos.eliminar',
      datos: { reemplazos: [{ sitio: 'POETAS', turno: 'Día 12 h' }] },
    });
  });

  it('un sitio dado de baja no necesita reemplazo', async () => {
    repo.detalle.set(1, [uso({ id: 3, nombre: 'Viejo', supervisorId: 2 }, false)]);
    expect((await borrar(ROLES.SUPERVISOR, 1)).status).toBe(204);
    expect(repo.reasignaciones).toEqual([]);
    expect(audit.eventos.at(-1)).toMatchObject({ datos: { sitiosDeBaja: ['Viejo'] } });
  });

  it('el reemplazo debe ser otro turno activo que exista', async () => {
    repo.detalle.set(1, [uso(POETAS)]);
    expect((await borrar(ROLES.SUPERVISOR, 1, { reemplazos: [{ sitioId: 1, turnoId: 1 }] })).status).toBe(400);
    expect((await borrar(ROLES.SUPERVISOR, 1, { reemplazos: [{ sitioId: 1, turnoId: 99 }] })).status).toBe(400);
    repo.turnos.find((t) => t.id === 2)!.activo = false;
    expect((await borrar(ROLES.SUPERVISOR, 1, { reemplazos: [{ sitioId: 1, turnoId: 2 }] })).status).toBe(400);
    expect(repo.turnos.map((t) => t.id)).toEqual([1, 2]);
  });

  it('el supervisor no cambia sitios de otro supervisor; el admin sí', async () => {
    repo.detalle.set(1, [uso(POETAS), uso(NORTE, true, 'Ana', 4)]);
    const res = await borrar(ROLES.SUPERVISOR, 1, { reemplazos: [{ sitioId: 1, turnoId: 2 }, { sitioId: 2, turnoId: 2 }] });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Plaza Norte');
    expect(repo.turnos.map((t) => t.id)).toEqual([1, 2]);

    const admin = await borrar(ROLES.ADMIN, 1, { reemplazos: [{ sitioId: 1, turnoId: 2 }, { sitioId: 2, turnoId: 2 }] });
    expect(admin.status).toBe(204);
    expect(repo.reasignaciones.map((r) => r.sitioId)).toEqual([1, 2]);
  });

  it('el guardia no puede borrar ni consultar', async () => {
    expect((await borrar(ROLES.GUARDIA, 1)).status).toBe(403);
    expect((await request(app).get('/api/turnos/1/uso').set('Authorization', token(ROLES.GUARDIA))).status).toBe(403);
  });
});

describe('calendario de turnos (compartido)', () => {
  const patron = (horas: number, hora: string, dias: DiasTurno, desde = '2026-10-22'): PatronTurno => ({
    tipo: 'fija',
    horas,
    dias,
    horaInicio: hora,
    horaFin: horaSalida(horas, hora),
    desde,
    hasta: null,
  });
  const t24 = (desde: string) => patron(24, '08:00', UNO_Y_UNO, desde);
  const t12 = (hora: string) => patron(12, hora, DIARIO);

  it('días: 1 y 1, 24x48 (1 y 2), todos los días y días de la semana', () => {
    const dias = (p: PatronTurno) =>
      ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((f) => trabajaEl(f, p));
    expect(dias(t24('2026-10-22'))).toEqual([true, false, true, false]);
    expect(dias(patron(24, '08:00', { tipo: 'ciclo', trabaja: 1, descansa: 2 }))).toEqual([
      true,
      false,
      false,
      true,
    ]);
    expect(dias(t12('08:00'))).toEqual([true, true, true, true]);
    // 22 oct 2026 es jueves: lunes a viernes trabaja jueves y viernes, no sábado ni domingo.
    expect(dias(patron(8, '09:00', { tipo: 'semanal', semana: [1, 2, 3, 4, 5] }))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(trabajaEl('2026-10-21', t24('2026-10-22'))).toBe(false);
    expect(letraDia('2026-10-23', '2026-10-22')).toBe('B');
  });

  it('textos de los días', () => {
    expect(textoDias(UNO_Y_UNO)).toBe('Un día sí, uno no');
    expect(textoDias({ tipo: 'ciclo', trabaja: 1, descansa: 2 })).toBe('Trabaja 1 día, descansa 2 días');
    expect(textoDias({ tipo: 'semanal', semana: [1, 2, 3, 4, 5, 6] })).toBe('Lun a Sáb');
    expect(textoDias({ tipo: 'semanal', semana: [1, 3, 5] })).toBe('Lun, Mié, Vie');
    expect(textoDias(DIARIO)).toBe('Todos los días');
  });

  it('cruces: el 1 y 1 no se cruza; 24 h y 12 h noche el mismo día sí; 8 h de oficina vs 12 h noche no', () => {
    expect(seCruzan(t24('2026-10-22'), t24('2026-10-23'))).toBe(false);
    expect(seCruzan(t24('2026-10-22'), t24('2026-10-24'))).toBe(true);
    expect(seCruzan(t24('2026-10-22'), t12('20:00'))).toBe(true);
    expect(seCruzan(t12('08:00'), t12('20:00'))).toBe(false);
    expect(seCruzan(patron(8, '09:00', { tipo: 'semanal', semana: [1, 2, 3, 4, 5] }), t12('20:00'))).toBe(
      false,
    );
  });

  it('mismo horario: mismo turno y misma fase', () => {
    expect(mismoHorario(t24('2026-10-22'), t24('2026-10-24'))).toBe(true);
    expect(mismoHorario(t24('2026-10-22'), t24('2026-10-23'))).toBe(false);
    expect(mismoHorario(t12('08:00'), t12('20:00'))).toBe(false);
  });

  it('huecos del día: 12 h día + 12 h noche cubren todo; con solo el día falta la noche', () => {
    expect(huecosDelDia('2026-10-23', [t12('08:00'), t12('20:00')])).toEqual([]);
    expect(huecosDelDia('2026-10-23', [t12('08:00')])).toEqual([
      { desde: '00:00', hasta: '08:00' },
      { desde: '20:00', hasta: '00:00' },
    ]);
    expect(huecosDelDia('2026-10-23', [t24('2026-10-22'), t24('2026-10-23')])).toEqual([]);
    expect(huecosDelDia('2026-10-23', [t24('2026-10-22')])).toEqual([{ desde: '08:00', hasta: '00:00' }]);
  });
});
