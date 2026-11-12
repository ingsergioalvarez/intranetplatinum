import { describe, expect, it } from 'vitest';
import type { FilaAsistencia, Emergencia, EstadoTurno, Jornada } from '@platinum/shared';
import { C2Repository, type EpisodioRow } from '../src/modules/c2/c2.repository';
import { C2Service } from '../src/modules/c2/c2.service';
import { agruparPorCliente, calcularSitio, type SitioBase } from '../src/modules/c2/estado';
import type { AvisoUsuario } from '../src/modules/avisos/avisar';
import type { AuthUser } from '../src/core';

const AHORA = new Date('2026-11-12T18:00:00.000Z');
const min = (n: number) => new Date(AHORA.getTime() + n * 60_000).toISOString();

const sitio = (id: number, nombre = `Sitio ${id}`, cliente = { id: 1, nombre: 'Cliente 1' }): SitioBase => ({
  id,
  nombre,
  cliente,
  supervisor: { nombre: 'Pedro', telefono: '5500000000', telefonoEtiqueta: 'empresa' },
});

const guardia = (id: number) => ({ id, nombre: `Guardia ${id}`, email: `g${id}@x.com`, foto: `/foto/${id}`, fotoAprobada: true });

/** Guardia que ya checó y sigue en el sitio. */
const presente = (id: number, sitioId: number, entradaMin = -60, salidaMin = 600): FilaAsistencia => ({
  guardia: guardia(id),
  sitio: { id: sitioId, nombre: `Sitio ${sitioId}` },
  jornada: {
    entrada: { id: id * 10, registradaEn: min(entradaMin) },
    salida: null,
    programada: { entrada: min(entradaMin), salida: min(salidaMin) },
  } as unknown as Jornada,
});

/** Guardia que debía entrar hace `desdeMin` minutos y no ha checado. */
const sinChecar = (id: number, sitioId: number, desdeMin: number, estado: EstadoTurno, horas = 12): FilaAsistencia => ({
  guardia: guardia(id),
  sitio: { id: sitioId, nombre: `Sitio ${sitioId}` },
  jornada: null,
  turno: { entrada: min(-desdeMin), estado, horas },
});

describe('calcularSitio (A-61)', () => {
  it('cubierto: hay un guardia en el sitio', () => {
    const r = calcularSitio(sitio(1), [presente(1, 1)], AHORA);
    expect(r.estado).toBe('cubierto');
    expect(r.guardias).toHaveLength(1);
    expect(r.guardias[0]).toMatchObject({ presente: true, foto: '/foto/1', fotoAprobada: true });
  });

  it('solo: el turno empezó hace más de 15 min y nadie checó, desde la hora del turno', () => {
    const r = calcularSitio(sitio(1), [sinChecar(1, 1, 37, 'no_se_presento')], AHORA);
    expect(r.estado).toBe('solo');
    expect(r.desde).toBe(min(-37));
    expect(r.guardias[0]).toMatchObject({ presente: false, nombre: 'Guardia 1' });
  });

  it('por llegar: dentro de los primeros 15 min todavía no es "solo"', () => {
    expect(calcularSitio(sitio(1), [sinChecar(1, 1, 8, 'por_llegar')], AHORA).estado).toBe('por_llegar');
  });

  it('parcial: debían estar dos y falta uno', () => {
    const r = calcularSitio(sitio(1), [presente(1, 1), sinChecar(2, 1, 40, 'no_se_presento')], AHORA);
    expect(r.estado).toBe('parcial');
    expect(r.desde).toBe(min(-40));
  });

  it('sin turno: nadie debe estar ahora (turno futuro o ya terminado)', () => {
    const futuro = sinChecar(1, 1, -120, 'por_entrar');
    const terminado = sinChecar(2, 1, 13 * 60, 'falta', 12);
    expect(calcularSitio(sitio(1), [futuro, terminado], AHORA).estado).toBe('sin_turno');
    expect(calcularSitio(sitio(1), [], AHORA).estado).toBe('sin_turno');
  });

  it('un turno de noche que empezó ayer sigue contando después de medianoche', () => {
    const r = calcularSitio(sitio(1), [sinChecar(1, 1, 6 * 60, 'falta', 12)], AHORA);
    expect(r.estado).toBe('solo');
  });

  it('quien ya salió o se le olvidó checar la salida mucho después de su turno no cuenta como presente', () => {
    const salio = presente(1, 1);
    (salio.jornada as { salida: unknown }).salida = { id: 99 };
    expect(calcularSitio(sitio(1), [salio], AHORA).estado).toBe('sin_turno');
    const olvido = presente(2, 1, -900, -180);
    expect(calcularSitio(sitio(1), [olvido], AHORA).estado).toBe('sin_turno');
  });

  it('solo cuenta las filas de su sitio', () => {
    expect(calcularSitio(sitio(2), [presente(1, 1)], AHORA).estado).toBe('sin_turno');
  });

  it('el retardo no importa al C2: llegar tarde pero ya estar ahí es cubierto', () => {
    const tarde = presente(1, 1, -50);
    (tarde.jornada as { retardoMin: number }).retardoMin = 50;
    expect(calcularSitio(sitio(1), [tarde], AHORA).estado).toBe('cubierto');
  });
});

describe('agruparPorCliente', () => {
  it('el cliente toma el peor estado y los peores van primero', () => {
    const a = { cliente: { id: 1, nombre: 'Bravo' }, sitio: calcularSitio(sitio(1), [presente(1, 1)], AHORA) };
    const b = { cliente: { id: 2, nombre: 'Alfa' }, sitio: calcularSitio(sitio(2), [presente(2, 2)], AHORA) };
    const c = { cliente: { id: 1, nombre: 'Bravo' }, sitio: calcularSitio(sitio(3), [sinChecar(3, 3, 40, 'no_se_presento')], AHORA) };
    const r = agruparPorCliente([a, b, c]);
    expect(r.map((x) => x.nombre)).toEqual(['Bravo', 'Alfa']);
    expect(r[0]).toMatchObject({ estado: 'solo', solos: 1 });
    expect(r[0].sitios.map((s) => s.id)).toEqual([3, 1]);
  });
});

class MemoriaC2 extends C2Repository {
  abiertos: { id: number; sitioId: number; inicio: Date }[] = [];
  cerrados: { id: number; fin: Date; cubierto: boolean }[] = [];
  historico: EpisodioRow[] = [];
  siguiente = 1;
  constructor(public lista: SitioBase[]) {
    super();
  }
  async sitios() {
    return this.lista;
  }
  async usuariosC2() {
    return [900];
  }
  async episodiosAbiertos() {
    return this.abiertos;
  }
  async abrirEpisodio(sitioId: number, inicio: Date) {
    const id = this.siguiente++;
    this.abiertos.push({ id, sitioId, inicio });
    return id;
  }
  async cerrarEpisodio(id: number, fin: Date, cubierto: boolean) {
    this.cerrados.push({ id, fin, cubierto });
    this.abiertos = this.abiertos.filter((a) => a.id !== id);
  }
  async episodios() {
    return this.historico;
  }
}

const usuario = { id: 900, rol: 'c2' } as unknown as AuthUser;
const sinEmergencias = async () => ({ items: [] as Emergencia[], activas: 0 });

function servicio(repo: MemoriaC2, filas: FilaAsistencia[], avisos: { ids: number[]; aviso: AvisoUsuario }[] = [], emergencias = sinEmergencias) {
  return new C2Service(
    repo,
    async () => filas,
    emergencias,
    async (ids, aviso) => void avisos.push({ ids, aviso }),
    () => AHORA,
  );
}

const Q = { page: 1, limit: 25, problema: false, agrupar: false } as const;

describe('C2Service.tablero', () => {
  const dosClientes = () =>
    new MemoriaC2([sitio(1, 'Torre Norte', { id: 1, nombre: 'Torre' }), sitio(2, 'Plaza', { id: 2, nombre: 'Plaza' })]);

  it('vista normal: una fila por sitio, lo peor primero, con los conteos de todos los sitios', async () => {
    const filas = [sinChecar(1, 1, 40, 'no_se_presento'), presente(2, 2)];
    const t = await servicio(dosClientes(), filas).tablero(Q, usuario);
    expect(t.resumen).toMatchObject({ sitios: 2, solos: 1, parciales: 0, sos: 0 });
    expect(t.sitiosSolos).toEqual([1]);
    expect(t.clientes).toEqual([]);
    expect(t.sitios.map((f) => `${f.cliente.nombre}/${f.sitio.nombre}/${f.sitio.estado}`)).toEqual(['Torre/Torre Norte/solo', 'Plaza/Plaza/cubierto']);
    expect(t.total).toBe(2);
  });

  it('pagina por sitios y busca por sitio, cliente o guardia', async () => {
    const filas = [sinChecar(1, 1, 40, 'no_se_presento'), presente(2, 2)];
    const s = () => servicio(dosClientes(), filas);
    expect((await s().tablero({ ...Q, q: 'guardia 2' }, usuario)).sitios.map((f) => f.sitio.id)).toEqual([2]);
    expect((await s().tablero({ ...Q, q: 'torre' }, usuario)).sitios.map((f) => f.sitio.id)).toEqual([1]);
    const hoja1 = await s().tablero({ ...Q, limit: 25 }, usuario);
    expect(hoja1.sitios).toHaveLength(2);
    const hoja2 = await s().tablero({ ...Q, page: 2 }, usuario);
    expect(hoja2.sitios).toEqual([]);
    expect(hoja2.total).toBe(2);
  });

  it('"Con problema" deja solos, parciales, por llegar y SOS; tocar un estado deja solo ese', async () => {
    const repo = new MemoriaC2([sitio(1), sitio(2), sitio(3), sitio(4)]);
    const filas = [sinChecar(1, 1, 40, 'no_se_presento'), presente(2, 2), sinChecar(3, 3, 8, 'por_llegar')];
    const s = () => servicio(repo, filas);
    expect((await s().tablero({ ...Q, problema: true }, usuario)).sitios.map((f) => f.sitio.estado)).toEqual(['solo', 'por_llegar']);
    expect((await s().tablero({ ...Q, estado: 'cubierto' }, usuario)).sitios.map((f) => f.sitio.id)).toEqual([2]);
    expect((await s().tablero({ ...Q, estado: 'sin_turno' }, usuario)).sitios.map((f) => f.sitio.id)).toEqual([4]);
    // Los conteos no cambian con el filtro.
    expect((await s().tablero({ ...Q, problema: true }, usuario)).resumen.sitios).toBe(4);
  });

  it('agrupado: pagina por clientes, el peor primero, con todos sus sitios', async () => {
    const repo = new MemoriaC2([
      sitio(1, 'Norte', { id: 1, nombre: 'Torre' }),
      sitio(2, 'Sur', { id: 1, nombre: 'Torre' }),
      sitio(3, 'Matriz', { id: 2, nombre: 'Banco' }),
    ]);
    const filas = [sinChecar(1, 1, 40, 'no_se_presento'), presente(2, 2), presente(3, 3)];
    const t = await servicio(repo, filas).tablero({ ...Q, agrupar: true }, usuario);
    expect(t.sitios).toEqual([]);
    expect(t.clientes.map((c) => c.nombre)).toEqual(['Torre', 'Banco']);
    expect(t.clientes[0].sitios.map((x) => x.estado)).toEqual(['solo', 'cubierto']);
    expect(t.total).toBe(2);
    const chica = await servicio(repo, filas).tablero({ ...Q, agrupar: true, limit: 25, page: 2 }, usuario);
    expect(chica.clientes).toEqual([]);
  });

  it('una emergencia activa en un sitio lo pone en SOS y sube arriba', async () => {
    const repo = new MemoriaC2([sitio(1), sitio(2, 'Sitio 2', { id: 2, nombre: 'Cliente 2' })]);
    const sos = { id: 5, sitio: { id: 2, nombre: 'Sitio 2' } } as unknown as Emergencia;
    const t = await servicio(repo, [presente(1, 1), presente(2, 2)], [], async () => ({ items: [sos], activas: 1 })).tablero(Q, usuario);
    expect(t.sitios[0].sitio).toMatchObject({ id: 2, estado: 'sos' });
    expect(t.resumen.sos).toBe(1);
    expect(t.emergencias).toHaveLength(1);
  });

  it('un admin de cartera solo ve los sitios de su alcance', async () => {
    const repo = new MemoriaC2([sitio(1), sitio(2)]);
    const t = await servicio(repo, []).tablero(Q, usuario, { sitioIds: new Set([2]), guardiaIds: new Set() });
    expect(t.resumen.sitios).toBe(1);
    expect(t.sitios.map((f) => f.sitio.id)).toEqual([2]);
  });
});

describe('C2Service.vigilar', () => {
  it('abre el episodio y avisa una sola vez al C2 cuando el sitio se queda solo', async () => {
    const repo = new MemoriaC2([sitio(1, 'Torre Norte')]);
    const avisos: { ids: number[]; aviso: AvisoUsuario }[] = [];
    const s = servicio(repo, [sinChecar(1, 1, 37, 'no_se_presento')], avisos);
    await s.vigilar();
    await s.vigilar();
    expect(repo.abiertos).toHaveLength(1);
    expect(repo.abiertos[0].inicio.toISOString()).toBe(min(-37));
    expect(avisos).toHaveLength(1);
    expect(avisos[0].ids).toEqual([900]);
    expect(avisos[0].aviso).toMatchObject({ tipo: 'c2_sitio', titulo: 'Sitio sin guardia', urgente: true });
    expect(avisos[0].aviso.mensaje).toContain('Torre Norte');
  });

  it('al llegar alguien cierra el episodio y avisa que ya hay guardia', async () => {
    const repo = new MemoriaC2([sitio(1)]);
    repo.abiertos = [{ id: 7, sitioId: 1, inicio: new Date(min(-40)) }];
    const avisos: { ids: number[]; aviso: AvisoUsuario }[] = [];
    await servicio(repo, [presente(1, 1)], avisos).vigilar();
    expect(repo.cerrados).toEqual([{ id: 7, fin: AHORA, cubierto: true }]);
    expect(avisos[0].aviso).toMatchObject({ titulo: 'Sitio con guardia' });
    expect(avisos[0].aviso.urgente).toBeFalsy();
  });

  it('si el turno acabó sin que llegara nadie, cierra sin avisar que hay guardia', async () => {
    const repo = new MemoriaC2([sitio(1)]);
    repo.abiertos = [{ id: 7, sitioId: 1, inicio: new Date(min(-800)) }];
    const avisos: { ids: number[]; aviso: AvisoUsuario }[] = [];
    await servicio(repo, [], avisos).vigilar();
    expect(repo.cerrados).toEqual([{ id: 7, fin: AHORA, cubierto: false }]);
    expect(avisos).toHaveLength(0);
  });

  it('el retardo o la salida no generan avisos para el C2', async () => {
    const repo = new MemoriaC2([sitio(1)]);
    const avisos: { ids: number[]; aviso: AvisoUsuario }[] = [];
    await servicio(repo, [presente(1, 1, -50)], avisos).vigilar();
    expect(avisos).toHaveLength(0);
    expect(repo.abiertos).toHaveLength(0);
  });
});

describe('C2Service.historial', () => {
  it('suma los minutos sin guardia del día, con el episodio abierto hasta ahora', async () => {
    const repo = new MemoriaC2([]);
    const base = { sitio: { id: 1, nombre: 'Torre' }, cliente: { id: 1, nombre: 'Cliente' } };
    repo.historico = [
      { id: 1, ...base, inicio: new Date(min(-120)), fin: new Date(min(-90)), cubierto: true },
      { id: 2, ...base, inicio: new Date(min(-40)), fin: null, cubierto: null },
    ];
    const h = await servicio(repo, []).historial({ fecha: '2026-11-12' });
    expect(h.items.map((i) => i.minutos)).toEqual([30, 40]);
    expect(h.totalMinutos).toBe(70);
  });
});
