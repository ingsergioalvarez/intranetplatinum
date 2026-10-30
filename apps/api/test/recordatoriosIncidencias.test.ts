import { beforeEach, describe, expect, it } from 'vitest';
import {
  RecordatorioIncidencias,
  RecordatoriosIncidenciasRepository,
  type PendienteRow,
} from '../src/modules/bitacora/recordatorios';
import type { AvisoUsuario } from '../src/modules/avisos/avisar';

class Memoria extends RecordatoriosIncidenciasRepository {
  filas: PendienteRow[] = [];
  avisados: { usuarioId: number; titulo: string; en: Date }[] = [];
  async pendientes() {
    return this.filas;
  }
  async revisoresDe({ guardiaId }: { sitioId: number | null; guardiaId: number }) {
    return guardiaId === 10 ? [5] : [6];
  }
  async admins() {
    return [1];
  }
  async yaAvisado(usuarioId: number, titulo: string, desde: Date) {
    return this.avisados.some((a) => a.usuarioId === usuarioId && a.titulo === titulo && a.en >= desde);
  }
}

let repo: Memoria;
let avisos: { usuarioIds: number[]; aviso: AvisoUsuario }[];
let ahora: Date;
let recordatorio: RecordatorioIncidencias;

/** Hora de CDMX (UTC-6) del 2026-10-21. */
const cdmx = (hhmm: string) => new Date(`2026-10-21T${String(Number(hhmm.slice(0, 2)) + 6).padStart(2, '0')}:${hhmm.slice(3)}:00.000Z`);

beforeEach(() => {
  repo = new Memoria();
  avisos = [];
  ahora = cdmx('07:00');
  recordatorio = new RecordatorioIncidencias(
    repo,
    async (usuarioIds, aviso) => {
      avisos.push({ usuarioIds, aviso });
      for (const u of usuarioIds) repo.avisados.push({ usuarioId: u, titulo: aviso.titulo!, en: ahora });
    },
    () => ahora,
  );
});

describe('recordatorios de incidencias sin atender (A-51)', () => {
  it('antes de las 8:00 no avisa; a las 8:00 un solo aviso por supervisor con el total', async () => {
    repo.filas = [
      { usuarioId: 10, sitioId: 1, ocurrioEn: cdmx('06:00') },
      { usuarioId: 10, sitioId: 1, ocurrioEn: cdmx('06:30') },
      { usuarioId: 11, sitioId: 2, ocurrioEn: cdmx('06:30') },
    ];
    await recordatorio.revisar();
    expect(avisos).toEqual([]);

    ahora = cdmx('08:01');
    await recordatorio.revisar();
    await recordatorio.revisar();
    expect(avisos.map((a) => [a.usuarioIds, a.aviso.mensaje])).toEqual([
      [[5], expect.stringContaining('Tienes 2 incidencias')],
      [[6], expect.stringContaining('Tienes 1 incidencia')],
    ]);
  });

  it('vuelve a recordar a las 14:00 mientras siga sin atender, y deja de hacerlo cuando ya no hay pendientes', async () => {
    repo.filas = [{ usuarioId: 10, sitioId: 1, ocurrioEn: cdmx('06:00') }];
    ahora = cdmx('08:01');
    await recordatorio.revisar();
    ahora = cdmx('13:00');
    await recordatorio.revisar();
    expect(avisos).toHaveLength(1);
    ahora = cdmx('14:02');
    await recordatorio.revisar();
    expect(avisos).toHaveLength(2);
    repo.filas = [];
    ahora = cdmx('15:00');
    await recordatorio.revisar();
    expect(avisos).toHaveLength(2);
  });

  it('con más de 24 h sin atender avisa también al admin, una vez al día', async () => {
    repo.filas = [{ usuarioId: 10, sitioId: 1, ocurrioEn: new Date(cdmx('07:00').getTime() - 25 * 3_600_000) }];
    ahora = cdmx('08:01');
    await recordatorio.revisar();
    ahora = cdmx('14:01');
    await recordatorio.revisar();
    const admin = avisos.filter((a) => a.usuarioIds[0] === 1);
    expect(admin).toHaveLength(1);
    expect(admin[0].aviso.titulo).toBe('Incidencias sin atender más de 24 h');
    // Si es reciente, el admin no se entera.
    avisos = [];
    repo.avisados = [];
    repo.filas = [{ usuarioId: 10, sitioId: 1, ocurrioEn: cdmx('07:00') }];
    ahora = cdmx('08:01');
    await recordatorio.revisar();
    expect(avisos.some((a) => a.usuarioIds[0] === 1)).toBe(false);
  });
});
