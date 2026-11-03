import { describe, expect, it } from 'vitest';
import type { PatronTurno } from '@platinum/shared';
import type { TurnoProgramado } from '../src/modules/asistencia/vigilancia';
import { calcularInforme } from '../src/modules/informes/calculo';

const patron: PatronTurno = {
  tipo: 'fija',
  horas: 12,
  dias: { tipo: 'diario' },
  horaInicio: '08:00',
  horaFin: null,
  desde: '2026-10-01',
  hasta: null,
};
const turno = (extra: Partial<TurnoProgramado> = {}): TurnoProgramado => ({
  asignacionId: 1,
  sitio: { id: 1, nombre: 'POETAS' },
  guardia: { id: 10, nombre: 'Juan Pérez' },
  patron,
  ...extra,
});

const calcular = (turnos: TurnoProgramado[]) =>
  calcularInforme({
    tipo: 'personal',
    desde: '2026-11-02',
    hasta: '2026-11-06',
    alcance: 'Guardia: Juan Pérez',
    guardias: [{ id: 10, nombre: 'Juan Pérez', email: 'j@x.mx' }],
    turnos,
    jornadas: [],
    eventos: [],
    supervisores: new Map(),
    hoy: '2026-11-10',
    ahora: new Date('2026-11-10T18:00:00.000Z'),
  }).guardias[0];

describe('ausencias justificadas en el reporte (A-43)', () => {
  it('los días de ausencia salen como "Ausencia justificada", no cuentan como falta ni como programados', () => {
    const g = calcular([
      turno({
        // Las ausencias aprobadas también pausan el turno (así no hay faltas ni avisos).
        pausas: [{ desde: '2026-11-03', hasta: '2026-11-04' }],
        ausencias: [{ desde: '2026-11-03', hasta: '2026-11-04', tipo: 'vacaciones' }],
      }),
    ]);
    const estados = Object.fromEntries(g.dias.map((d) => [d.fecha, d.estado]));
    expect(estados['2026-11-03']).toBe('ausencia_justificada');
    expect(estados['2026-11-04']).toBe('ausencia_justificada');
    // Los demás días sin jornada sí son falta, como siempre.
    expect(estados['2026-11-02']).toBe('falta');
    expect(estados['2026-11-05']).toBe('falta');
    const dia = g.dias.find((d) => d.fecha === '2026-11-03')!;
    expect(dia.notas[0]).toContain('Vacaciones');
    expect(g.resumen).toMatchObject({ ausencias: 2, faltas: 3, programados: 3 });
  });

  it('sin ausencias todo queda igual', () => {
    const g = calcular([turno()]);
    expect(g.dias.every((d) => d.estado === 'falta')).toBe(true);
    expect(g.resumen.ausencias).toBe(0);
  });

  it('un día de descanso del turno no se marca como ausencia', () => {
    const semanal: PatronTurno = { ...patron, dias: { tipo: 'semanal', semana: [1, 2, 3, 4, 5] } };
    const g = calcular([
      turno({
        patron: semanal,
        pausas: [{ desde: '2026-11-01', hasta: '2026-11-08' }],
        ausencias: [{ desde: '2026-11-01', hasta: '2026-11-08', tipo: 'incapacidad' }],
      }),
    ]);
    // Lunes 2 a viernes 6 trabajaba: 5 días de ausencia (el reporte es de lunes a viernes).
    expect(g.resumen.ausencias).toBe(5);
  });
});
