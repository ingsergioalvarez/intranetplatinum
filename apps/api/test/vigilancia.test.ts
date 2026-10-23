import { beforeEach, describe, expect, it } from 'vitest';
import type { PatronTurno } from '@platinum/shared';
import {
  VigilanciaRepository,
  VigilanciaTurnos,
  type EventoVigilancia,
  type TurnoDiaRow,
  type TurnoProgramado,
} from '../src/modules/asistencia/vigilancia';

const DIARIO_8: PatronTurno = {
  tipo: 'fija',
  horas: 12,
  dias: { tipo: 'diario' },
  horaInicio: '08:00',
  horaFin: '20:00',
  desde: '2026-10-01',
  hasta: null,
};

class MemoryVigilanciaRepository extends VigilanciaRepository {
  turnos: TurnoProgramado[] = [];
  entradas: { usuarioId: number; en: Date }[] = [];
  filas: (TurnoDiaRow & { sitio: string })[] = [];
  eventos: (EventoVigilancia & { id: number })[] = [];

  async turnosVigentes() {
    return this.turnos;
  }
  async huboEntrada(usuarioId: number, desde: Date, hasta: Date) {
    return this.entradas.some((e) => e.usuarioId === usuarioId && e.en >= desde && e.en <= hasta);
  }
  async findTurnoDia(usuarioId: number, programada: Date) {
    return (
      this.filas.find(
        (f) => f.usuarioId === usuarioId && f.programadaEntrada.getTime() === programada.getTime(),
      ) ?? null
    );
  }
  async crearTurnoDia(data: {
    usuarioId: number;
    sitioId: number;
    asignacionId: number;
    programadaEntrada: Date;
  }) {
    const fila = {
      id: this.filas.length + 1,
      usuarioId: data.usuarioId,
      sitioId: data.sitioId,
      programadaEntrada: data.programadaEntrada,
      avisoGuardiaEn: null,
      noSePresentoEn: null,
      faltaEn: null,
      faltaEventoId: null,
      entradaId: null,
      sitio: 'POETAS',
    };
    this.filas.push(fila);
    return fila;
  }
  async actualizarTurnoDia(id: number, data: Partial<TurnoDiaRow>) {
    Object.assign(
      this.filas.find((f) => f.id === id)!,
      data,
    );
  }
  async sinEntrada(usuarioId: number, desde: Date) {
    return this.filas.filter(
      (f) => f.usuarioId === usuarioId && !f.entradaId && f.programadaEntrada >= desde,
    );
  }
  async crearEvento(e: EventoVigilancia) {
    this.eventos.push({ ...e, id: this.eventos.length + 1 });
    return this.eventos.length;
  }
  async completarEvento(id: number, datos: Record<string, string | number | boolean | null>) {
    const e = this.eventos.find((x) => x.id === id)!;
    e.datos = { ...e.datos, ...datos };
  }
  async revisoresDe() {
    return [5];
  }
}

let repo: MemoryVigilanciaRepository;
let avisos: { usuarioIds: number[]; mensaje: string }[];
let ahora: Date;
let vigilancia: VigilanciaTurnos;

/** 2026-10-20 a las 08:00 en CDMX = 14:00 UTC. */
const a = (hhmm: string) => new Date(`2026-10-20T${hhmm}:00.000Z`);

beforeEach(() => {
  repo = new MemoryVigilanciaRepository();
  repo.turnos = [
    {
      asignacionId: 1,
      sitio: { id: 1, nombre: 'POETAS' },
      guardia: { id: 10, nombre: 'Juan Pérez' },
      patron: DIARIO_8,
    },
  ];
  avisos = [];
  vigilancia = new VigilanciaTurnos(
    repo,
    async (usuarioIds, { mensaje }) => void avisos.push({ usuarioIds, mensaje }),
    () => ahora,
  );
});

describe('vigilancia de turnos sin entrada (DA-45)', () => {
  it('5 min: aviso al guardia; 15 min: al supervisor; 2 h: falta. Sin repetir avisos', async () => {
    ahora = a('14:04');
    await vigilancia.revisar();
    expect(avisos).toEqual([]);

    ahora = a('14:05');
    await vigilancia.revisar();
    expect(avisos).toEqual([
      { usuarioIds: [10], mensaje: 'Tu turno en POETAS empezó a las 8:00 a.m. y aún no checas tu entrada' },
    ]);

    ahora = a('14:15');
    await vigilancia.revisar();
    await vigilancia.revisar();
    expect(avisos.slice(1)).toEqual([
      {
        usuarioIds: [5],
        mensaje: 'Juan Pérez · POETAS: no se presentó a su turno de las 8:00 a.m. (pasaron 15 min)',
      },
    ]);
    expect(repo.eventos.map((e) => e.tipo)).toEqual(['no_se_presento']);

    ahora = a('16:00');
    await vigilancia.revisar();
    await vigilancia.revisar();
    expect(avisos).toHaveLength(2);
    expect(repo.eventos.map((e) => [e.tipo, e.detalle])).toEqual([
      ['no_se_presento', 'No se presentó a su turno de las 8:00 a.m. en POETAS (15 min sin entrada)'],
      ['falta', 'Faltó a su turno de las 8:00 a.m. en POETAS (2 h sin entrada)'],
    ]);
  });

  it('llega después de la falta: se liga la entrada y el supervisor decide', async () => {
    ahora = a('16:00');
    await vigilancia.revisar();
    avisos = [];
    await vigilancia.alLlegar(10, 'Juan Pérez', { id: 99, registradaEn: a('17:05') });
    expect(repo.filas[0].entradaId).toBe(99);
    expect(repo.eventos.find((e) => e.tipo === 'falta')!.datos).toMatchObject({
      llegoEn: a('17:05').toISOString(),
      retardoMin: 185,
    });
    expect(avisos).toEqual([
      {
        usuarioIds: [5],
        mensaje: 'Juan Pérez · POETAS: llegó 3 h 05 min tarde (tenía falta). ¿Aceptas la asistencia?',
      },
    ]);
  });

  it('con entrada (aunque sea un poco antes) no hay avisos; tampoco en su día de descanso', async () => {
    repo.entradas.push({ usuarioId: 10, en: a('13:50') });
    ahora = a('16:00');
    await vigilancia.revisar();
    expect(avisos).toEqual([]);

    repo.entradas = [];
    // Un día sí, uno no desde el 1 de octubre: el 20 descansa.
    repo.turnos[0].patron = { ...DIARIO_8, dias: { tipo: 'ciclo', trabaja: 1, descansa: 1 } };
    await vigilancia.revisar();
    expect(avisos).toEqual([]);
    expect(repo.eventos).toEqual([]);
  });

  it('si cubre otro sitio ese día, su turno propio queda en pausa (sin avisos ni falta)', async () => {
    repo.turnos[0].pausas = [{ desde: '2026-10-20', hasta: '2026-10-20' }];
    ahora = a('16:00');
    await vigilancia.revisar();
    expect(avisos).toEqual([]);
    expect(repo.eventos).toEqual([]);
  });
});
