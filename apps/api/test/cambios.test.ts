import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type PatronTurno, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import type { TurnoProgramado } from '../src/modules/asistencia/vigilancia';
import type { EventoNuevo } from '../src/modules/bitacora/registrar';
import { createCambiosModule } from '../src/modules/cambios';
import {
  CambiosRepository,
  type CambioRow,
  type FiltroCambios,
  type NuevoCambio,
} from '../src/modules/cambios/cambios.repository';
import type { Alcance } from '../src/modules/sitios/alcance';
import { MemoryAuditLogger } from './helpers/memoryAudit';

/** Lunes 26 de octubre de 2026. */
const HOY = '2026-10-26';
const AHORA = new Date('2026-10-26T18:00:00.000Z');

/** Lunes a viernes, 08:00, 12 h. */
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
  { asignacionId: 2, sitio: { id: 1, nombre: 'POETAS' }, guardia: { id: 11, nombre: 'Ana' }, patron },
  { asignacionId: 3, sitio: { id: 2, nombre: 'Plaza Norte' }, guardia: { id: 12, nombre: 'Beto' }, patron },
];

const PERSONAS = [
  { id: 10, nombre: 'Juan', rol: ROLES.GUARDIA as Rol, activo: true },
  { id: 11, nombre: 'Ana', rol: ROLES.GUARDIA as Rol, activo: true },
  { id: 12, nombre: 'Beto', rol: ROLES.GUARDIA as Rol, activo: true },
  { id: 5, nombre: 'Sofía Sup', rol: ROLES.SUPERVISOR as Rol, activo: true },
];

class MemoryCambiosRepository extends CambiosRepository {
  filas: CambioRow[] = [];
  pausas: { usuarioId: number; fecha: string; cambioId: number }[] = [];
  async findGuardia(id: number) {
    return PERSONAS.find((p) => p.id === id) ?? null;
  }
  async guardiasActivos() {
    return PERSONAS.filter((p) => p.rol === ROLES.GUARDIA).map(({ id, nombre }) => ({ id, nombre }));
  }
  async admins() {
    return [1];
  }
  async hayCambio(usuarioId: number, fecha: string) {
    return this.filas.some(
      (f) => f.guardia.id === usuarioId && f.fecha === fecha && ['pendiente', 'aprobado'].includes(f.estado),
    );
  }
  async crear(d: NuevoCambio) {
    const persona = (id: number) => ({ id, nombre: PERSONAS.find((p) => p.id === id)?.nombre ?? '?' });
    const fila: CambioRow = {
      id: this.filas.length + 1,
      tipo: d.tipo,
      estado: d.estado,
      guardia: persona(d.usuarioId),
      solicitante: persona(d.solicitanteId),
      sitio: { id: d.sitioId, nombre: d.sitioId === 1 ? 'POETAS' : 'Plaza Norte', supervisorId: d.sitioId === 1 ? 5 : 6 },
      fecha: d.fecha,
      fechaNueva: d.fechaNueva,
      cubre: d.cubreId ? persona(d.cubreId) : null,
      motivo: d.motivo,
      horaInicio: d.horaInicio,
      horas: d.horas,
      resueltoPor: null,
      resueltoEn: null,
      notaResolucion: null,
      coberturaId: null,
      createdAt: AHORA,
    };
    this.filas.push(fila);
    return fila;
  }
  async findById(id: number) {
    return this.filas.find((f) => f.id === id) ?? null;
  }
  async listar({ estado, propios, alcance, skip, take }: FiltroCambios) {
    const l = this.filas
      .filter((f) => !estado || f.estado === estado)
      .filter((f) => !propios || [f.guardia.id, f.solicitante.id, f.cubre?.id].includes(propios))
      .filter(
        (f) =>
          !alcance ||
          alcance.sitioIds.includes(f.sitio.id) ||
          alcance.guardiaIds.includes(f.guardia.id) ||
          f.solicitante.id === alcance.usuarioId,
      )
      .reverse();
    return { items: l.slice(skip, skip + take), total: l.length };
  }
  async resolver(
    id: number,
    d: { estado: CambioRow['estado']; resueltoPorId: number | null; en: Date; nota: string | null; coberturaId?: number | null },
  ) {
    const f = this.filas.find((x) => x.id === id)!;
    f.estado = d.estado;
    f.resueltoEn = d.en;
    f.notaResolucion = d.nota;
    f.resueltoPor = d.resueltoPorId ? (PERSONAS.find((p) => p.id === d.resueltoPorId)?.nombre ?? null) : null;
    if (d.coberturaId !== undefined) f.coberturaId = d.coberturaId;
  }
  async crearPausa(usuarioId: number, fecha: string, cambioId: number) {
    this.pausas.push({ usuarioId, fecha, cambioId });
  }
  async borrarPausas(cambioId: number) {
    this.pausas = this.pausas.filter((p) => p.cambioId !== cambioId);
  }
  async pendientes() {
    return this.filas.filter((f) => f.estado === 'pendiente').length;
  }
}

let repo: MemoryCambiosRepository;
let audit: MemoryAuditLogger;
let avisos: { usuarioIds: number[]; mensaje: string }[];
let bitacora: EventoNuevo[];
let creadas: { usuarioId: number; sitioId: number; desde: string; cubreAId?: number }[];
let canceladas: number[];
let alcance: Alcance | null;
let app: ReturnType<typeof createApp>;

const token = (id: number, rol: Rol) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol] })}`;
const como = (id: number, rol: Rol) => ({
  get: (u: string) => request(app).get(`/api/cambios-turno${u}`).set('Authorization', token(id, rol)),
  post: (u: string, b: object = {}) => request(app).post(`/api/cambios-turno${u}`).set('Authorization', token(id, rol)).send(b),
});
const guardia = () => como(10, ROLES.GUARDIA);
const sup = () => como(5, ROLES.SUPERVISOR);

const cubrir = { tipo: 'cubrir', fecha: '2026-10-27', cubreId: 11, motivo: 'Cita médica' };
const descanso = { tipo: 'descanso', fecha: '2026-10-27', fechaNueva: '2026-10-31', motivo: 'Evento familiar' };

beforeEach(() => {
  repo = new MemoryCambiosRepository();
  audit = new MemoryAuditLogger();
  avisos = [];
  bitacora = [];
  creadas = [];
  canceladas = [];
  alcance = null;
  app = createApp([
    createCambiosModule({
      repo,
      audit,
      turnos: async () => TURNOS.map((t) => ({ ...t, pausas: repo.pausas.filter((p) => p.usuarioId === t.guardia.id).map((p) => ({ desde: p.fecha, hasta: p.fecha })) })),
      coberturas: {
        crear: async (d) => {
          creadas.push(d);
          return { cobertura: { id: creadas.length } };
        },
        cancelar: async (id) => void canceladas.push(id),
      },
      avisar: async (usuarioIds, a) => void avisos.push({ usuarioIds, mensaje: a.mensaje }),
      bitacora: async (e) => void bitacora.push(e),
      alcance: async (u) => (u.rol === ROLES.SUPERVISOR ? alcance : null),
      hoy: () => HOY,
      ahora: () => AHORA,
    }),
  ]);
});

describe('cambios de turno (TC-22)', () => {
  it('el guardia pide que un compañero lo cubra: queda pendiente y avisa al supervisor del sitio', async () => {
    const res = await guardia().post('', cubrir);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      estado: 'pendiente',
      tipo: 'cubrir',
      guardia: { id: 10 },
      cubre: { id: 11 },
      sitio: { nombre: 'POETAS' },
      horario: '8:00 a.m. · 12 h',
    });
    expect(creadas).toHaveLength(0); // todavía no cambia nada
    expect(avisos).toEqual([{ usuarioIds: [5], mensaje: expect.stringContaining('Juan pide que Ana lo cubra') }]);
  });

  it('al aprobarlo: el compañero cubre, el guardia queda sin turno ese día y se avisa', async () => {
    const { body } = await guardia().post('', cubrir);
    const res = await sup().post(`/${body.data.id}/resolver`, { decision: 'aprobar' });
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('aprobado');
    expect(creadas).toEqual([expect.objectContaining({ usuarioId: 11, sitioId: 1, desde: '2026-10-27', cubreAId: 10 })]);
    expect(repo.pausas).toEqual([{ usuarioId: 10, fecha: '2026-10-27', cambioId: 1 }]);
    expect(bitacora[0]).toMatchObject({ tipo: 'asignacion_cambio', usuarioIds: [10, 11] });
    expect(avisos.at(-1)).toMatchObject({ usuarioIds: [10], mensaje: expect.stringContaining('Se aprobó tu cambio') });
    expect(audit.acciones()).toEqual(['cambios_turno.crear', 'cambios_turno.aprobar']);
  });

  it('rechazar no cambia nada y avisa con la nota', async () => {
    const { body } = await guardia().post('', cubrir);
    const res = await sup().post(`/${body.data.id}/resolver`, { decision: 'rechazar', nota: 'Falta personal ese día' });
    expect(res.body.data).toMatchObject({ estado: 'rechazado', resolucion: { nota: 'Falta personal ese día' } });
    expect(creadas).toHaveLength(0);
    expect(repo.pausas).toHaveLength(0);
    expect(avisos.at(-1)?.mensaje).toContain('Falta personal ese día');
    // Ya resuelto: no se puede volver a resolver.
    expect((await sup().post(`/${body.data.id}/resolver`, { decision: 'aprobar' })).status).toBe(409);
  });

  it('si lo hace el supervisor queda aprobado al momento', async () => {
    const res = await sup().post('', { ...cubrir, guardiaId: 10 });
    expect(res.status).toBe(201);
    expect(res.body.data.estado).toBe('aprobado');
    expect(creadas).toHaveLength(1);
    expect(repo.pausas).toHaveLength(1);
  });

  it('mover el descanso: trabaja el día nuevo (cobertura en su sitio) y descansa el día que le tocaba', async () => {
    const { body } = await guardia().post('', descanso);
    expect(body.data).toMatchObject({ tipo: 'descanso', fecha: '2026-10-27', fechaNueva: '2026-10-31' });
    await sup().post(`/${body.data.id}/resolver`, { decision: 'aprobar' });
    expect(creadas).toEqual([expect.objectContaining({ usuarioId: 10, sitioId: 1, desde: '2026-10-31' })]);
    expect(creadas[0].cubreAId).toBeUndefined();
    expect(repo.pausas[0]).toMatchObject({ usuarioId: 10, fecha: '2026-10-27' });
  });

  it('el guardia no puede aprobar; el supervisor ajeno no ve el cambio', async () => {
    const { body } = await guardia().post('', cubrir);
    expect((await guardia().post(`/${body.data.id}/resolver`, { decision: 'aprobar' })).status).toBe(403);
    alcance = { sitioIds: new Set([2]), guardiaIds: new Set([12]) };
    expect((await sup().post(`/${body.data.id}/resolver`, { decision: 'aprobar' })).status).toBe(404);
    expect((await sup().get('')).body.data.items).toHaveLength(0);
    expect((await sup().post('', { ...cubrir, guardiaId: 10 })).status).toBe(404);
  });

  it('el guardia cancela su solicitud pendiente; un cambio aprobado lo cancela el supervisor y se deshace', async () => {
    const a = await guardia().post('', cubrir);
    expect((await guardia().post(`/${a.body.data.id}/cancelar`)).body.data.estado).toBe('cancelado');

    const b = await guardia().post('', { ...cubrir, fecha: '2026-10-28' });
    await sup().post(`/${b.body.data.id}/resolver`, { decision: 'aprobar' });
    expect((await guardia().post(`/${b.body.data.id}/cancelar`)).status).toBe(403);
    const res = await sup().post(`/${b.body.data.id}/cancelar`);
    expect(res.body.data.estado).toBe('cancelado');
    expect(canceladas).toEqual([1]);
    expect(repo.pausas).toHaveLength(0);
  });

  it('valida: motivo, día con turno, día de descanso, fechas pasadas y duplicados', async () => {
    expect((await guardia().post('', { ...cubrir, motivo: '' })).status).toBe(400);
    expect((await guardia().post('', { ...cubrir, fecha: '2026-10-31' })).status).toBe(400); // sábado: no trabaja
    expect((await guardia().post('', { ...descanso, fechaNueva: '2026-10-28' })).status).toBe(400); // ya trabaja ese día
    expect((await guardia().post('', { ...cubrir, fecha: '2026-10-23' })).status).toBe(400); // pasado
    expect((await guardia().post('', { ...cubrir, cubreId: 10 })).status).toBe(400); // consigo mismo
    expect((await guardia().post('', { tipo: 'cubrir', fecha: '2026-10-27', motivo: 'Cita' })).status).toBe(400);
    expect((await guardia().post('', cubrir)).status).toBe(201);
    expect((await guardia().post('', cubrir)).status).toBe(409);
  });

  it('un pendiente cuya fecha ya pasó no se puede aprobar', async () => {
    const { body } = await guardia().post('', cubrir);
    repo.filas[0].fecha = '2026-10-20';
    const lista = await sup().get('');
    expect(lista.body.data.items[0].vencido).toBe(true);
    expect((await sup().post(`/${body.data.id}/resolver`, { decision: 'aprobar' })).status).toBe(409);
  });

  it('opciones: el guardia ve sus próximos turnos y a sus compañeros de sitio', async () => {
    const res = await guardia().get('/opciones');
    expect(res.body.data.companeros).toEqual([{ id: 11, nombre: 'Ana' }]);
    expect(res.body.data.misTurnos[0]).toEqual({ fecha: '2026-10-26', sitio: 'POETAS', horario: '8:00 a.m. · 12 h' });
    expect(res.body.data.misTurnos.map((t: { fecha: string }) => t.fecha)).not.toContain('2026-10-31');
  });

  it('el guardia ve solo lo suyo y el supervisor cuenta los pendientes', async () => {
    await guardia().post('', cubrir);
    const ajeno = await como(12, ROLES.GUARDIA).get('');
    expect(ajeno.body.data.items).toHaveLength(0);
    const propio = await como(11, ROLES.GUARDIA).get(''); // Ana: la que cubre
    expect(propio.body.data.items).toHaveLength(1);
    expect((await sup().get('')).body.data.pendientes).toBe(1);
    expect((await request(app).get('/api/cambios-turno')).status).toBe(401);
    expect((await como(20, ROLES.CLIENTE).get('')).status).toBe(403);
  });
});
