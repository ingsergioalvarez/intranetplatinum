import { beforeEach, describe, expect, it } from 'vitest';
import type { TipoMarcacion } from '@platinum/shared';
import type { MarcacionGuardiaRow } from '../src/modules/asistencia/asistencia.repository';
import { ComidasRepository, RecordatoriosComida } from '../src/modules/asistencia/comidas';
import type { EventoNuevo } from '../src/modules/bitacora/registrar';

/** 2026-10-20 a las 08:00 en CDMX = 14:00 UTC. */
const a = (hhmm: string, dia = 20) => new Date(`2026-10-${dia}T${hhmm}:00.000Z`);

class MemoryComidasRepository extends ComidasRepository {
  marcas: MarcacionGuardiaRow[] = [];
  enviados = new Set<string>();
  async jornadasDesde() {
    return this.marcas;
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

let repo: MemoryComidasRepository;
let avisos: { usuarioIds: number[]; mensaje: string }[];
let bitacora: EventoNuevo[];
let ahora: Date;
let recordatorios: RecordatoriosComida;

/** Marca de Juan en POETAS; la entrada lleva el horario (12 h desde las 8:00 por omisión). */
function marca(id: number, tipo: TipoMarcacion, en: Date, horas = 12): MarcacionGuardiaRow {
  return {
    id,
    idCliente: `c-${id}`,
    usuarioId: 10,
    entradaId: tipo === 'entrada' ? null : 1,
    tipo,
    registradaEn: en,
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
    programadaEntrada: tipo === 'entrada' ? a('14:00') : null,
    programadaSalida: tipo === 'entrada' ? new Date(a('14:00').getTime() + horas * 3_600_000) : null,
    usuario: { id: 10, nombre: 'Juan', email: 'juan@x.mx' },
  };
}

beforeEach(() => {
  repo = new MemoryComidasRepository();
  avisos = [];
  bitacora = [];
  recordatorios = new RecordatoriosComida(
    repo,
    async (usuarioIds, { mensaje }) => void avisos.push({ usuarioIds, mensaje }),
    async (e) => void bitacora.push(e),
    () => ahora,
  );
});

describe('recordatorios de comida (DA-47)', () => {
  it('a la mitad del turno, si no ha comido, se le recuerda una vez', async () => {
    repo.marcas = [marca(1, 'entrada', a('14:00'))];
    ahora = a('19:59');
    await recordatorios.revisar();
    expect(avisos).toEqual([]);
    ahora = a('20:00'); // 2:00 p.m.: mitad de 12 h
    await recordatorios.revisar();
    await recordatorios.revisar();
    expect(avisos).toEqual([
      {
        usuarioIds: [10],
        mensaje: 'Aún no registras tu comida. Cuando salgas a comer, regístrala en el checador',
      },
    ]);
  });

  it('hora vencida: al guardia a los 60 min y al supervisor a los 90 (con bitácora), una sola vez', async () => {
    repo.marcas = [marca(1, 'entrada', a('14:00')), marca(2, 'inicio_comida', a('19:00'))];
    ahora = a('20:00');
    await recordatorios.revisar();
    expect(avisos).toEqual([
      {
        usuarioIds: [10],
        mensaje: 'Ya pasó tu hora de comida (saliste a las 1:00 p.m.): registra tu regreso',
      },
    ]);
    ahora = a('20:30');
    await recordatorios.revisar();
    await recordatorios.revisar();
    expect(avisos.slice(1)).toEqual([
      { usuarioIds: [5], mensaje: 'Juan · POETAS: no ha checado su regreso de comida (1 h 30 min)' },
    ]);
    expect(bitacora.map((e) => e.tipo)).toEqual(['comida_sin_cierre']);
  });

  it('al terminar el turno sin comida: aviso al supervisor y bitácora; 24 h cuenta dos comidas', async () => {
    repo.marcas = [
      marca(1, 'entrada', a('14:00'), 24),
      marca(2, 'inicio_comida', a('19:00')),
      marca(3, 'fin_comida', a('19:40')),
      marca(4, 'salida', a('14:00', 21)),
    ];
    ahora = a('14:05', 21);
    await recordatorios.revisar();
    expect(avisos).toEqual([
      { usuarioIds: [5], mensaje: 'Juan · POETAS: no registró su comida (1 de 2) en su turno' },
    ]);
    expect(bitacora[0]).toMatchObject({ tipo: 'sin_comida', usuarioIds: [10] });
  });
});
