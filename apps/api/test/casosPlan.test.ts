import { describe, expect, it } from 'vitest';
import type { DiasTurno, PatronTurno } from '@platinum/shared';
import type { TurnoProgramado } from '../src/modules/asistencia/vigilancia';
import { planearSiguiente } from '../src/modules/casos-cobertura/plan';

const en = (iso: string) => new Date(iso);
const patron = (horaInicio: string, horas: number, dias: DiasTurno, desde = '2026-10-01'): PatronTurno => ({
  tipo: 'fija',
  horas,
  dias,
  horaInicio,
  horaFin: null,
  desde,
  hasta: null,
});
const turno = (p: PatronTurno, pausas?: { desde: string; hasta: string }[]): TurnoProgramado => ({
  asignacionId: 1,
  sitio: { id: 1, nombre: 'POETAS' },
  guardia: { id: 1, nombre: 'Diego' },
  patron: p,
  pausas,
});

describe('plan del siguiente turno de quien cubre un turno de más (AS6-06)', () => {
  // Zona UTC-6: 08:00 locales = 14:00Z.
  it('24x24: entró el lunes 8:00, cubre el turno del martes (hasta el miércoles 8:00) y descansa 24 h', () => {
    // Diego trabaja lunes, miércoles, viernes… (24 h, un día sí y uno no).
    const p = patron('08:00', 24, { tipo: 'ciclo', trabaja: 1, descansa: 1 }, '2026-10-26');
    const r = planearSiguiente({
      turnos: [turno(p)],
      entrada: en('2026-10-26T14:00:00Z'),
      salidaProgramada: en('2026-10-27T14:00:00Z'),
      finCubierto: en('2026-10-28T14:00:00Z'),
      descansoExtraHoras: 0,
    });
    expect(r.descansoPatronHoras).toBe(24);
    // Termina de cubrir el miércoles 8:00, descansa 24 h y regresa el jueves 8:00.
    expect(r.regresaEn).toBe('2026-10-29T14:00:00.000Z');
    // Su turno del miércoles 8:00 a jueves 8:00 queda sin cubrir completo; regresa el viernes 8:00.
    expect(r.huecos).toEqual([
      { inicio: '2026-10-28T14:00:00.000Z', fin: '2026-10-29T14:00:00.000Z', fecha: '2026-10-28', horaInicio: '08:00', horas: 24 },
    ]);
    expect(r.entraTarde).toBeNull();
    expect(r.vuelveA).toBe('2026-10-30T14:00:00.000Z');
    expect(r.limiteExtra).toBe('2026-10-28T14:00:00.000Z');
  });

  it('el supervisor puede agregar descanso: regresa más tarde y el sistema calcula el hueco', () => {
    const p = patron('08:00', 24, { tipo: 'ciclo', trabaja: 1, descansa: 1 }, '2026-10-26');
    const r = planearSiguiente({
      turnos: [turno(p)],
      entrada: en('2026-10-26T14:00:00Z'),
      salidaProgramada: en('2026-10-27T14:00:00Z'),
      finCubierto: en('2026-10-28T14:00:00Z'),
      descansoExtraHoras: 24,
    });
    // 24 h del patrón + 24 h extra = regresa el viernes 8:00, justo en su siguiente turno.
    expect(r.regresaEn).toBe('2026-10-30T14:00:00.000Z');
    expect(r.huecos).toHaveLength(1);
    expect(r.vuelveA).toBe('2026-10-30T14:00:00.000Z');
  });

  it('12x12 de día: cubre la noche, descansa 12 h y su turno del día siguiente queda completo sin cubrir', () => {
    const p = patron('08:00', 12, { tipo: 'diario' });
    const r = planearSiguiente({
      turnos: [turno(p)],
      entrada: en('2026-10-26T14:00:00Z'),
      salidaProgramada: en('2026-10-27T02:00:00Z'),
      // Cubre la noche de 20:00 a 08:00.
      finCubierto: en('2026-10-27T14:00:00Z'),
      descansoExtraHoras: 0,
    });
    expect(r.descansoPatronHoras).toBe(12);
    // Regresa a las 20:00; su turno 8:00-20:00 queda sin cubrir completo y vuelve al siguiente.
    expect(r.regresaEn).toBe('2026-10-28T02:00:00.000Z');
    expect(r.huecos).toEqual([
      { inicio: '2026-10-27T14:00:00.000Z', fin: '2026-10-28T02:00:00.000Z', fecha: '2026-10-27', horaInicio: '08:00', horas: 12 },
    ]);
    expect(r.vuelveA).toBe('2026-10-28T14:00:00.000Z');
  });

  it('si regresa a la mitad de un turno, entra tarde y termina a la hora original (no se recorre)', () => {
    const p = patron('08:00', 12, { tipo: 'diario' });
    const r = planearSiguiente({
      turnos: [turno(p)],
      entrada: en('2026-10-26T14:00:00Z'),
      salidaProgramada: en('2026-10-27T02:00:00Z'),
      finCubierto: en('2026-10-27T14:00:00Z'),
      // 12 h del patrón + 4 h agregadas por el supervisor.
      descansoExtraHoras: 4,
    });
    // Regresa 16 h después de las 8:00 (medianoche); su turno de día del 28 sigue intacto.
    expect(r.regresaEn).toBe('2026-10-28T06:00:00.000Z');
    expect(r.huecos).toEqual([
      { inicio: '2026-10-27T14:00:00.000Z', fin: '2026-10-28T02:00:00.000Z', fecha: '2026-10-27', horaInicio: '08:00', horas: 12 },
    ]);
    expect(r.entraTarde).toBeNull();
    expect(r.vuelveA).toBe('2026-10-28T14:00:00.000Z');
  });

  it('un descanso que cae a la mitad de un turno: entra tarde y sale a la hora original', () => {
    // Turno de 24 h todos los días (sin descanso en el patrón): el descanso agregado cae a media jornada.
    const p = patron('08:00', 24, { tipo: 'diario' });
    const r = planearSiguiente({
      turnos: [turno(p)],
      entrada: en('2026-10-26T14:00:00Z'),
      salidaProgramada: en('2026-10-27T14:00:00Z'),
      finCubierto: en('2026-10-28T14:00:00Z'),
      descansoExtraHoras: 12,
    });
    expect(r.descansoPatronHoras).toBe(0);
    // Regresa el miércoles 20:00, a la mitad de su turno de 8:00 a 8:00.
    expect(r.regresaEn).toBe('2026-10-29T02:00:00.000Z');
    expect(r.huecos).toEqual([
      { inicio: '2026-10-28T14:00:00.000Z', fin: '2026-10-29T02:00:00.000Z', fecha: '2026-10-28', horaInicio: '08:00', horas: 12 },
    ]);
    expect(r.entraTarde).toEqual({
      inicio: '2026-10-29T02:00:00.000Z',
      fin: '2026-10-29T14:00:00.000Z',
      fecha: '2026-10-28',
      horaInicio: '20:00',
      horas: 12,
    });
    expect(r.vuelveA).toBe('2026-10-29T02:00:00.000Z');
  });

  it('avisa del cansancio cuando lleva muchas horas seguidas', () => {
    const p = patron('08:00', 24, { tipo: 'ciclo', trabaja: 1, descansa: 1 }, '2026-10-26');
    const r = planearSiguiente({
      turnos: [turno(p)],
      entrada: en('2026-10-26T14:00:00Z'),
      salidaProgramada: en('2026-10-27T14:00:00Z'),
      finCubierto: en('2026-10-28T14:00:00Z'),
      descansoExtraHoras: 0,
    });
    // De lunes 8:00 a miércoles 8:00 son 48 h; si además trabaja su turno del miércoles, 72 h.
    expect(r.horasSeguidas).toBe(72);
    expect(r.advertencias.join(' ')).toContain('48 h seguidas');
    expect(r.advertencias.join(' ')).toContain('72 h seguidas');
  });

  it('los días en pausa no cuentan como turnos suyos', () => {
    const p = patron('08:00', 12, { tipo: 'diario' });
    const r = planearSiguiente({
      turnos: [turno(p, [{ desde: '2026-10-27', hasta: '2026-10-27' }])],
      entrada: en('2026-10-26T14:00:00Z'),
      salidaProgramada: en('2026-10-27T02:00:00Z'),
      finCubierto: en('2026-10-27T14:00:00Z'),
      descansoExtraHoras: 0,
    });
    // El 27 está en pausa: su siguiente turno es el 28.
    expect(r.siguienteTurno?.inicio).toBe('2026-10-28T14:00:00.000Z');
  });

  it('sin turnos propios no hay plan de descanso', () => {
    const r = planearSiguiente({
      turnos: [],
      entrada: en('2026-10-26T14:00:00Z'),
      salidaProgramada: en('2026-10-27T02:00:00Z'),
      finCubierto: en('2026-10-27T14:00:00Z'),
      descansoExtraHoras: 0,
    });
    expect(r).toMatchObject({ siguienteTurno: null, regresaEn: null, vuelveA: null, huecos: [], limiteExtra: null });
  });
});
