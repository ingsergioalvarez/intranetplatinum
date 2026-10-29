import { beforeEach, describe, expect, it } from 'vitest';
import type { MarcacionGuardiaRow } from '../src/modules/asistencia/asistencia.repository';
import { SitioSoloRepository, type EnviadoACasa } from '../src/modules/asistencia/sitioSolo';
import { RecordatorioSitioSolo } from '../src/modules/asistencia/sitioSolo';
import type { EventoNuevo } from '../src/modules/bitacora/registrar';

/** 2026-10-20 a las 08:00 en CDMX = 14:00 UTC. */
const a = (hhmm: string) => new Date(`2026-10-20T${hhmm}:00.000Z`);

class MemorySitioSoloRepository extends SitioSoloRepository {
  casos: EnviadoACasa[] = [];
  marcas: MarcacionGuardiaRow[] = [];
  enviados = new Set<string>();
  consultas: { desde: Date; hasta: Date }[] = [];
  async enviadosACasa(desde: Date, hasta: Date) {
    this.consultas.push({ desde, hasta });
    return this.casos.filter((c) => c.decididoEn >= desde && c.decididoEn <= hasta);
  }
  async jornadasDesde() {
    return this.marcas;
  }
  async marcarEnviado(clave: string) {
    if (this.enviados.has(clave)) return false;
    this.enviados.add(clave);
    return true;
  }
  async revisoresDe() {
    return [5, 6];
  }
}

let repo: MemorySitioSoloRepository;
let avisos: { usuarioIds: number[]; titulo?: string; mensaje: string; ruta?: string | null }[];
let bitacora: EventoNuevo[];
let ahora: Date;
let recordatorio: RecordatorioSitioSolo;

/** Entrada abierta de un guardia en POETAS. */
function entrada(id: number, usuarioId: number): MarcacionGuardiaRow {
  return {
    id,
    idCliente: `c-${id}`,
    usuarioId,
    entradaId: null,
    tipo: 'entrada',
    registradaEn: a('14:00'),
    sitio: { id: 1, nombre: 'POETAS' },
    lat: 0,
    lng: 0,
    precisionM: 10,
    distanciaM: null,
    alertas: [],
    fotoClave: null,
    rostroId: null,
    rostroDistancia: null,
    rostroIntentos: null,
    programadaEntrada: a('14:00'),
    programadaSalida: new Date(a('14:00').getTime() + 12 * 3_600_000),
    usuario: { id: usuarioId, nombre: `G${usuarioId}`, email: `g${usuarioId}@x.mx` },
  };
}

const casoDeJuan = (decididoEn: Date): EnviadoACasa => ({
  eventoId: 7,
  guardiaId: 10,
  guardiaNombre: 'Juan',
  sitioId: 1,
  sitioNombre: 'POETAS',
  decididoEn,
});

beforeEach(() => {
  repo = new MemorySitioSoloRepository();
  avisos = [];
  bitacora = [];
  recordatorio = new RecordatorioSitioSolo(
    repo,
    async (usuarioIds, { titulo, mensaje, ruta }) => void avisos.push({ usuarioIds, titulo, mensaje, ruta }),
    async (e) => void bitacora.push(e),
    () => ahora,
  );
});

describe('recordatorio de sitio sin guardia (A-26)', () => {
  it('a los 30 min, si nadie llegó, avisa una sola vez con ruta al calendario del sitio y deja bitácora', async () => {
    repo.casos = [casoDeJuan(a('15:00'))];
    ahora = a('15:29');
    await recordatorio.revisar();
    expect(avisos).toEqual([]);

    ahora = a('15:30');
    await recordatorio.revisar();
    await recordatorio.revisar();
    expect(avisos).toEqual([
      {
        usuarioIds: [5, 6],
        titulo: 'El sitio sigue sin guardia',
        mensaje: 'POETAS: pasaron 30 min desde que mandaron a casa a Juan y no hay ningún guardia en el sitio',
        ruta: '/asistencia/calendario?sitio=1',
      },
    ]);
    expect(bitacora).toMatchObject([{ tipo: 'cobertura', usuarioIds: [10], sitioId: 1 }]);
  });

  it('si ya llegó alguien al sitio, no recuerda', async () => {
    repo.casos = [casoDeJuan(a('15:00'))];
    repo.marcas = [entrada(1, 11)];
    ahora = a('15:40');
    await recordatorio.revisar();
    expect(avisos).toEqual([]);
    expect(bitacora).toEqual([]);
  });

  it('no recuerda mucho después (más de 6 h)', async () => {
    repo.casos = [casoDeJuan(a('15:00'))];
    ahora = a('21:30');
    await recordatorio.revisar();
    expect(avisos).toEqual([]);
  });
});
