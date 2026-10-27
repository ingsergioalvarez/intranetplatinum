import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type DiasTurno, type PatronTurno, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import type { TurnoProgramado } from '../src/modules/asistencia/vigilancia';
import { calcularCobertura, type RealesCobertura } from '../src/modules/cobertura/cobertura.calculo';
import { createCoberturaModule, crearAvisosHuecos } from '../src/modules/cobertura';
import type { AvisoAsistencia } from '../src/modules/asistencia/asistencia.repository';
import { CoberturaRepository } from '../src/modules/cobertura/cobertura.repository';
import type { Alcance } from '../src/modules/sitios/alcance';

const SITIO = { id: 1, nombre: 'POETAS' };
const en = (iso: string) => new Date(iso);
/** Martes 27 de octubre, 06:00 locales (UTC-6): el turno de las 08:00 de hoy aún no empieza. */
const AHORA = en('2026-10-27T12:00:00Z');
const VACIO: RealesCobertura = { turnosDia: [], entradas: [], extras: [] };

const patron = (horaInicio: string, horas: number, dias: DiasTurno, extra: Partial<PatronTurno> = {}): PatronTurno => ({
  tipo: 'fija',
  horas,
  dias,
  horaInicio,
  horaFin: null,
  desde: '2026-10-01',
  hasta: null,
  ...extra,
});
const diario: DiasTurno = { tipo: 'diario' };
const unoYUno: DiasTurno = { tipo: 'ciclo', trabaja: 1, descansa: 1 };

let n = 0;
const turno = (id: number, nombre: string, p: PatronTurno, extra: Partial<TurnoProgramado> = {}): TurnoProgramado => ({
  asignacionId: ++n,
  sitio: SITIO,
  guardia: { id, nombre },
  patron: p,
  ...extra,
});

const calcular = (turnos: TurnoProgramado[], reales: RealesCobertura = VACIO, ahora = AHORA, desde = '2026-10-26', hasta = '2026-10-29') =>
  calcularCobertura({ sitio: SITIO, desde, hasta, turnos, reales, ahora });
const celda = (r: ReturnType<typeof calcular>, fecha: string, clave: string) =>
  r.dias.find((d) => d.fecha === fecha)!.turnos.find((t) => t.clave === clave)!;

const DIA = '08:00|720';
const NOCHE = '20:00|720';

describe('cobertura por sitio y turno (AS6-01)', () => {
  it('un sitio 12x12 tiene una línea por turno, ordenadas por hora de entrada', () => {
    const r = calcular([turno(2, 'Ana', patron('20:00', 12, diario)), turno(1, 'Juan', patron('08:00', 12, diario))]);
    expect(r.turnos.map((t) => [t.clave, t.etiqueta])).toEqual([
      [DIA, '8:00 a.m. · 12 h'],
      [NOCHE, '8:00 p.m. · 12 h'],
    ]);
    expect(r.dias).toHaveLength(4);
    expect(celda(r, '2026-10-28', DIA)).toMatchObject({ estado: 'cubierto', guardias: [{ id: 1, nombre: 'Juan', situacion: 'programado' }] });
    expect(celda(r, '2026-10-28', NOCHE).estado).toBe('cubierto');
  });

  it('en 24x24 con un solo guardia, los días que no le tocan quedan sin cubrir', () => {
    const r = calcular([turno(1, 'Juan', patron('08:00', 24, unoYUno, { desde: '2026-10-28' }))], VACIO, AHORA, '2026-10-28', '2026-10-31');
    const clave = '08:00|1440';
    expect(celda(r, '2026-10-28', clave).estado).toBe('cubierto');
    expect(celda(r, '2026-10-29', clave)).toMatchObject({ estado: 'sin_cubrir', motivo: 'sin_asignar', guardias: [] });
    expect(celda(r, '2026-10-30', clave).estado).toBe('cubierto');
  });

  it('con dos guardias en días alternos (Día A y Día B) todo queda cubierto', () => {
    const r = calcular(
      [
        turno(1, 'Juan', patron('08:00', 24, unoYUno, { desde: '2026-10-26' })),
        turno(2, 'Ana', patron('08:00', 24, unoYUno, { desde: '2026-10-27' })),
      ],
      VACIO,
      AHORA,
      '2026-10-28',
      '2026-10-31',
    );
    expect(r.dias.every((d) => d.turnos[0].estado === 'cubierto')).toBe(true);
    expect(celda(r, '2026-10-28', '08:00|1440').guardias[0].nombre).toBe('Juan');
    expect(celda(r, '2026-10-29', '08:00|1440').guardias[0].nombre).toBe('Ana');
  });

  it('un guardia con descanso movido (pausa) deja el turno sin cubrir', () => {
    const r = calcular([turno(1, 'Juan', patron('08:00', 12, diario), { pausas: [{ desde: '2026-10-28', hasta: '2026-10-28' }] })]);
    expect(celda(r, '2026-10-28', DIA)).toMatchObject({ estado: 'sin_cubrir', motivo: 'sin_asignar' });
    expect(celda(r, '2026-10-29', DIA).estado).toBe('cubierto');
  });

  it('una cobertura cubre el turno y el día sale como cobertura', () => {
    const r = calcular([
      turno(1, 'Juan', patron('08:00', 12, diario), { pausas: [{ desde: '2026-10-28', hasta: '2026-10-28' }] }),
      turno(3, 'Luis', patron('08:00', 12, diario, { tipo: 'temporal', desde: '2026-10-28', hasta: '2026-10-28' }), {
        asignacionId: null,
        coberturaId: 9,
      }),
    ]);
    expect(celda(r, '2026-10-28', DIA)).toMatchObject({ estado: 'cobertura', guardias: [{ id: 3, origen: 'cobertura' }] });
    expect(celda(r, '2026-10-29', DIA).estado).toBe('cubierto');
  });

  it('un turno que terminó (asignación con fin) ya no se exige después', () => {
    const r = calcular([turno(1, 'Juan', patron('08:00', 12, diario, { tipo: 'temporal', hasta: '2026-10-27' }))]);
    expect(celda(r, '2026-10-27', DIA).estado).toBe('cubierto');
    expect(celda(r, '2026-10-28', DIA)).toMatchObject({ estado: 'sin_turno', guardias: [] });
  });

  it('un evento solo pinta sus días y el resto queda sin turno, no como hueco', () => {
    const r = calcular([
      turno(1, 'Juan', patron('08:00', 12, diario)),
      turno(4, 'Eva', patron('18:00', 4, diario, { tipo: 'eventual', horaFin: '22:00', desde: '2026-10-28', hasta: '2026-10-28' })),
    ]);
    expect(celda(r, '2026-10-28', '18:00|240').estado).toBe('cubierto');
    expect(celda(r, '2026-10-29', '18:00|240')).toMatchObject({ estado: 'sin_turno', guardias: [] });
  });

  it('un integrante de grupo se cuenta una sola vez por turno', () => {
    const p = patron('08:00', 12, diario);
    const r = calcular([turno(1, 'Juan', p), turno(1, 'Juan', p)]);
    expect(celda(r, '2026-10-28', DIA).guardias).toHaveLength(1);
  });

  describe('días que ya empezaron: se mide lo que pasó', () => {
    const juan = [turno(1, 'Juan', patron('08:00', 12, diario))];

    it('con entrada, cubierto', () => {
      const r = calcular(juan, { ...VACIO, entradas: [{ usuarioId: 1, registradaEn: en('2026-10-26T14:03:00Z') }] });
      expect(celda(r, '2026-10-26', DIA)).toMatchObject({ estado: 'cubierto', guardias: [{ situacion: 'presente' }] });
    });

    it('con la entrada ligada al turno (llegó después de la falta), cubierto', () => {
      const r = calcular(juan, {
        ...VACIO,
        turnosDia: [{ usuarioId: 1, programadaEntrada: en('2026-10-26T14:00:00Z'), entradaId: 7, noSePresentoEn: null, faltaEn: en('2026-10-26T16:00:00Z') }],
      });
      expect(celda(r, '2026-10-26', DIA).estado).toBe('cubierto');
    });

    it('con falta, sin cubrir por falta', () => {
      const r = calcular(juan, {
        ...VACIO,
        turnosDia: [{ usuarioId: 1, programadaEntrada: en('2026-10-26T14:00:00Z'), entradaId: null, noSePresentoEn: null, faltaEn: en('2026-10-26T16:00:00Z') }],
      });
      expect(celda(r, '2026-10-26', DIA)).toMatchObject({ estado: 'sin_cubrir', motivo: 'falta', guardias: [{ situacion: 'falta' }] });
    });

    it('sin entrada ni registro y mucho tiempo después, sin registro (no se sabe)', () => {
      const r = calcular(juan);
      expect(celda(r, '2026-10-26', DIA)).toMatchObject({ estado: 'sin_registro', motivo: null });
    });

    it('hoy, pasada la tolerancia y sin entrada, no se ha presentado', () => {
      const r = calcular(juan, VACIO, en('2026-10-27T14:40:00Z'));
      expect(celda(r, '2026-10-27', DIA)).toMatchObject({ estado: 'sin_cubrir', motivo: 'ausente', guardias: [{ situacion: 'ausente' }] });
    });

    it('hoy, dentro de la tolerancia, sigue programado', () => {
      const r = calcular(juan, VACIO, en('2026-10-27T14:10:00Z'));
      expect(celda(r, '2026-10-27', DIA)).toMatchObject({ estado: 'cubierto', guardias: [{ situacion: 'programado' }] });
    });

    it('con horas extra el turno sale como extra', () => {
      const r = calcular(
        juan,
        { ...VACIO, entradas: [{ usuarioId: 1, registradaEn: en('2026-10-26T14:03:00Z') }], extras: [{ usuarioId: 1, fecha: '2026-10-26' }] },
      );
      expect(celda(r, '2026-10-26', DIA)).toMatchObject({ estado: 'extra', guardias: [{ extra: true }] });
    });

    it('si falta el guardia pero lo cubre otro que sí llegó, queda como cobertura', () => {
      const r = calcular(
        [...juan, turno(3, 'Luis', patron('08:00', 12, diario, { tipo: 'temporal', desde: '2026-10-26', hasta: '2026-10-26' }), { asignacionId: null, coberturaId: 9 })],
        {
          ...VACIO,
          turnosDia: [{ usuarioId: 1, programadaEntrada: en('2026-10-26T14:00:00Z'), entradaId: null, noSePresentoEn: null, faltaEn: en('2026-10-26T16:00:00Z') }],
          entradas: [{ usuarioId: 3, registradaEn: en('2026-10-26T14:01:00Z') }],
        },
      );
      expect(celda(r, '2026-10-26', DIA).estado).toBe('cobertura');
    });
  });
});

class MemoriaCobertura extends CoberturaRepository {
  enviados = new Set<string>();
  async sitio(id: number) {
    return id === SITIO.id ? SITIO : null;
  }
  async reales() {
    return VACIO;
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

const token = (id: number, rol: Rol) => `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol] })}`;
const consulta = '?sitioId=1&desde=2026-10-26&hasta=2026-10-29';

function api(alcance: Alcance | null = null) {
  const app = createApp([
    createCoberturaModule({
      repo: new MemoriaCobertura(),
      turnos: async () => [turno(1, 'Juan', patron('08:00', 12, diario))],
      alcance: async (u) => (u.rol === ROLES.SUPERVISOR ? alcance : null),
      ahora: () => AHORA,
    }),
  ]);
  return (rol: Rol) => request(app).get(`/api/cobertura${consulta}`).set('Authorization', token(5, rol));
}

describe('GET /api/cobertura', () => {
  it('el admin ve la cobertura del sitio', async () => {
    const res = await api()(ROLES.ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.data.sitio).toEqual(SITIO);
    expect(res.body.data.dias).toHaveLength(4);
    expect(res.body.data.dias[0].turnos[0].clave).toBe(DIA);
  });

  it('el supervisor ve sus sitios y no los de otros', async () => {
    expect((await api({ sitioIds: new Set([1]), guardiaIds: new Set() })(ROLES.SUPERVISOR)).status).toBe(200);
    expect((await api({ sitioIds: new Set([2]), guardiaIds: new Set() })(ROLES.SUPERVISOR)).status).toBe(404);
  });

  it('el guardia no puede consultarla', async () => {
    expect((await api()(ROLES.GUARDIA)).status).toBe(403);
  });

  it('rechaza rangos de más de 62 días o invertidos', async () => {
    const app = createApp([createCoberturaModule({ repo: new MemoriaCobertura(), turnos: async () => [], alcance: async () => null })]);
    const get = (q: string) => request(app).get(`/api/cobertura${q}`).set('Authorization', token(5, ROLES.ADMIN));
    expect((await get('?sitioId=1&desde=2026-10-01&hasta=2026-12-31')).status).toBe(400);
    expect((await get('?sitioId=1&desde=2026-10-10&hasta=2026-10-01')).status).toBe(400);
  });
});

describe('GET /api/cobertura/resumen (AS6-03)', () => {
  const otro = { ...SITIO, id: 2, nombre: 'Plaza Norte' };
  const turnos = async () => [
    turno(1, 'Juan', patron('08:00', 12, diario)),
    // Plaza Norte: un guardia con 24x24 que empieza mañana; pasado mañana nadie.
    { ...turno(2, 'Ana', patron('08:00', 24, unoYUno, { desde: '2026-10-28' })), sitio: otro },
  ];
  const obtener = (rol: Rol, alcance: Alcance | null = null) => {
    const app = createApp([
      createCoberturaModule({
        repo: new MemoriaCobertura(),
        turnos,
        alcance: async (u) => (u.rol === ROLES.SUPERVISOR ? alcance : null),
        ahora: () => AHORA,
      }),
    ]);
    return request(app).get('/api/cobertura/resumen?desde=2026-10-27&hasta=2026-10-30').set('Authorization', token(5, rol));
  };

  it('el admin ve todos los sitios con un estado por turno y día, y cuántos turnos faltan por cubrir', async () => {
    const res = await obtener(ROLES.ADMIN);
    expect(res.status).toBe(200);
    const sitios = res.body.data.sitios as { sitio: { nombre: string }; dias: { fecha: string; estados: string[] }[] }[];
    expect(sitios.map((s) => s.sitio.nombre)).toEqual(['Plaza Norte', 'POETAS']);
    expect(sitios[0].dias.map((d) => d.estados[0])).toEqual(['sin_turno', 'cubierto', 'sin_cubrir', 'cubierto']);
    expect(sitios[1].dias.every((d) => d.estados[0] === 'cubierto' || d.estados[0] === 'sin_cubrir')).toBe(true);
    // Hoy 27 no cuenta como hueco de Plaza Norte (sin turno); el 29 sí.
    expect(res.body.data.sinCubrir).toBe(1);
  });

  it('el supervisor solo ve sus sitios', async () => {
    const res = await obtener(ROLES.SUPERVISOR, { sitioIds: new Set([2]), guardiaIds: new Set() });
    expect(res.body.data.sitios.map((s: { sitio: { nombre: string } }) => s.sitio.nombre)).toEqual(['Plaza Norte']);
  });

  it('el guardia no puede consultarlo', async () => {
    expect((await obtener(ROLES.GUARDIA)).status).toBe(403);
  });
});

describe('aviso de huecos al supervisor (AS6-04)', () => {
  const turnos = async () => [turno(2, 'Ana', patron('08:00', 24, unoYUno, { desde: '2026-10-28' }))];

  function armar() {
    const repo = new MemoriaCobertura();
    const avisos: { ids: number[]; aviso: AvisoAsistencia }[] = [];
    let reloj = AHORA;
    const job = crearAvisosHuecos({
      repo,
      turnos,
      avisar: async (ids, aviso) => {
        avisos.push({ ids, aviso: aviso as AvisoAsistencia });
      },
      ahora: () => reloj,
    });
    return { job, avisos, mover: (d: Date) => (reloj = d) };
  }

  it('avisa al supervisor de los turnos sin cubrir de los próximos 7 días, con ruta al calendario', async () => {
    const { job, avisos } = armar();
    await job.revisar();
    expect(avisos).toHaveLength(1);
    expect(avisos[0].ids).toEqual([5]);
    expect(avisos[0].aviso.tipo).toBe('cobertura');
    expect(avisos[0].aviso.mensaje).toContain('POETAS: 3 turnos sin cubrir en los próximos 7 días');
    expect(avisos[0].aviso.ruta).toBe('/asistencia/calendario?sitio=1&dia=2026-10-29');
  });

  it('no repite el aviso el mismo día aunque se revise otra vez, y sí al día siguiente', async () => {
    const { job, avisos, mover } = armar();
    await job.revisar();
    mover(en('2026-10-27T20:00:00Z'));
    await job.revisar();
    expect(avisos).toHaveLength(1);
    mover(en('2026-10-28T16:00:00Z'));
    await job.revisar();
    expect(avisos).toHaveLength(2);
  });
});
