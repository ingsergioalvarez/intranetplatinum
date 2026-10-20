import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { PERMISOS_POR_ROL, distanciaMetros, type MiSitio, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import { createAsistenciaModule } from '../src/modules/asistencia';
import {
  AsistenciaRepository,
  type MarcacionRow,
  type NuevaMarcacion,
} from '../src/modules/asistencia/asistencia.repository';

const NOMBRES: Record<number, string> = { 10: 'Juan Pérez', 11: 'Rosa Gil', 12: 'Luis Mora', 13: 'Ana Ruiz' };
const guardia = (id: number) => ({ id, nombre: NOMBRES[id], email: `u${id}@x.mx` });

class MemoryAsistenciaRepository extends AsistenciaRepository {
  marcas: MarcacionRow[] = [];
  constructor(
    private readonly sitios: Map<number, { nombre: string; lat: number | null; lng: number | null }>,
    private readonly reloj: () => Date,
  ) {
    super();
  }
  async findByIdCliente(idCliente: string) {
    return this.marcas.find((m) => m.idCliente === idCliente) ?? null;
  }
  async ultimaJornada(usuarioId: number) {
    const entrada = this.marcas.filter((m) => m.usuarioId === usuarioId && m.tipo === 'entrada').at(-1);
    return entrada ? this.marcas.filter((m) => m.id === entrada.id || m.entradaId === entrada.id) : [];
  }
  async jornadasEntre(usuarioId: number, desde: Date, hasta: Date) {
    const ids = this.marcas
      .filter((m) => m.usuarioId === usuarioId && m.tipo === 'entrada')
      .filter((m) => m.registradaEn >= desde && m.registradaEn < hasta)
      .map((m) => m.id);
    return this.marcas.filter(
      (m) => ids.includes(m.id) || (m.entradaId !== null && ids.includes(m.entradaId)),
    );
  }
  async coordenadasSitio(sitioId: number) {
    const s = this.sitios.get(sitioId);
    return s && s.lat !== null && s.lng !== null ? { lat: s.lat, lng: s.lng } : null;
  }
  async crear({ sitioId, ip: _ip, userAgent: _ua, ...data }: NuevaMarcacion) {
    const sitio = sitioId ? { id: sitioId, nombre: this.sitios.get(sitioId)!.nombre } : null;
    const marca: MarcacionRow = { ...data, id: this.marcas.length + 1, sitio, registradaEn: this.reloj() };
    this.marcas.push(marca);
    return marca;
  }
  async jornadasDeTodos(desde: Date, hasta: Date) {
    const ids = this.marcas
      .filter((m) => m.tipo === 'entrada' && m.registradaEn >= desde && m.registradaEn < hasta)
      .map((m) => m.id);
    return this.marcas
      .filter((m) => ids.includes(m.id) || (m.entradaId !== null && ids.includes(m.entradaId)))
      .map((m) => ({ ...m, usuario: guardia(m.usuarioId) }));
  }
  async guardiasAsignados() {
    return Object.entries(ASIGNACIONES)
      .filter(([, sitios]) => sitios.length > 0)
      .map(([id, [sitioId]]) => ({
        guardia: guardia(Number(id)),
        sitio: { id: sitioId, nombre: SITIOS.get(sitioId)!.nombre },
      }));
  }
  async findGuardia(usuarioId: number) {
    return NOMBRES[usuarioId] ? guardia(usuarioId) : null;
  }
}

// Plaza Norte (con coordenadas), Hotel Sur (a ~1.1 km) y Bodega (sin coordenadas).
const PLAZA = { lat: 19.4326, lng: -99.1332 };
const SITIOS = new Map([
  [1, { nombre: 'Plaza Norte', ...PLAZA }],
  [2, { nombre: 'Hotel Sur', lat: 19.4226, lng: -99.1332 }],
  [3, { nombre: 'Bodega', lat: null, lng: null }],
]);

const miSitio = (id: number): MiSitio => {
  const s = SITIOS.get(id)!;
  return {
    asignacionId: id * 10,
    tipo: 'fija',
    grupo: null,
    turno: null,
    horaInicio: null,
    horaFin: null,
    desde: '2026-10-01',
    hasta: null,
    sitio: { id, nombre: s.nombre, direccion: null, referencias: null, lat: s.lat, lng: s.lng },
    cliente: { id: 1, nombreComercial: 'Cliente Demo' },
  };
};

// Guardia 10 → Plaza Norte y Hotel Sur; 11 → Bodega; 12 → sin sitios; 13 → Plaza Norte (no marca).
const ASIGNACIONES: Record<number, number[]> = { 10: [1, 2], 11: [3], 12: [], 13: [1] };

let app: Express;
let repo: MemoryAsistenciaRepository;
let ahora: Date;

const token = (id: number, rol: Rol = 'guardia') =>
  `Bearer ${signAccessToken({ id, email: `u${id}@x.mx`, rol, permisos: PERMISOS_POR_ROL[rol] })}`;

let n = 0;
const marca = (tipo: string, punto = PLAZA, precisionM = 15, extra: Record<string, unknown> = {}) => ({
  idCliente: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  tipo,
  ...punto,
  precisionM,
  ...extra,
});

const marcar = (usuarioId: number, body: Record<string, unknown>) =>
  request(app).post('/api/asistencia/marcas').set('Authorization', token(usuarioId)).send(body);

const avanzar = (horas: number) => {
  ahora = new Date(ahora.getTime() + horas * 3_600_000);
};

beforeEach(() => {
  ahora = new Date('2026-10-20T13:00:00.000Z'); // 07:00 en CDMX
  repo = new MemoryAsistenciaRepository(SITIOS, () => ahora);
  app = createApp([
    createAsistenciaModule({
      repo,
      misSitios: async (usuarioId) => (ASIGNACIONES[usuarioId] ?? []).map(miSitio),
      ahora: () => ahora,
      hoy: () => '2026-10-20',
    }),
  ]);
});

describe('asistencia: permisos y validación', () => {
  it('solo quien tiene el permiso de marcar (guardia); el supervisor no', async () => {
    const res = await request(app).get('/api/asistencia/estado').set('Authorization', token(5, 'supervisor'));
    expect(res.status).toBe(403);
  });

  it('el GPS es obligatorio', async () => {
    const res = await marcar(10, { idCliente: marca('entrada').idCliente, tipo: 'entrada', precisionM: 10 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(['lat', 'lng']);
  });
});

describe('asistencia: jornada completa', () => {
  it('sin marcas solo permite la entrada y lista sus sitios', async () => {
    const res = await request(app).get('/api/asistencia/estado').set('Authorization', token(10));
    expect(res.body.data).toMatchObject({ jornada: null, permitidas: ['entrada'] });
    expect(res.body.data.sitios.map((s: { nombre: string }) => s.nombre)).toEqual([
      'Plaza Norte',
      'Hotel Sur',
    ]);
  });

  it('entrada → comida → salida, con la hora del servidor y el sitio más cercano', async () => {
    const entrada = await marcar(10, marca('entrada', { lat: 19.4327, lng: -99.1333 }));
    expect(entrada.status).toBe(201);
    expect(entrada.body.data).toMatchObject({
      tipo: 'entrada',
      sitio: { id: 1, nombre: 'Plaza Norte' },
      registradaEn: '2026-10-20T13:00:00.000Z',
      alertas: [],
    });
    expect(entrada.body.data.distanciaM).toBeLessThan(20);

    let estado = await request(app).get('/api/asistencia/estado').set('Authorization', token(10));
    expect(estado.body.data.permitidas).toEqual(['inicio_comida', 'salida']);

    avanzar(5);
    expect((await marcar(10, marca('inicio_comida'))).status).toBe(201);
    avanzar(1);
    expect((await marcar(10, marca('fin_comida'))).status).toBe(201);
    avanzar(2);
    const salida = await marcar(10, marca('salida'));
    expect(salida.body.data.sitio.nombre).toBe('Plaza Norte');

    estado = await request(app).get('/api/asistencia/estado').set('Authorization', token(10));
    expect(estado.body.data.permitidas).toEqual(['entrada']);
    expect(estado.body.data.jornada).toMatchObject({
      sitio: { nombre: 'Plaza Norte' },
      inicioComida: { tipo: 'inicio_comida' },
      finComida: { tipo: 'fin_comida' },
      salida: { tipo: 'salida', registradaEn: '2026-10-20T21:00:00.000Z' },
    });
  });

  it('elige el sitio asignado más cercano', async () => {
    const res = await marcar(10, marca('entrada', { lat: 19.4227, lng: -99.1332 }));
    expect(res.body.data.sitio.nombre).toBe('Hotel Sur');
  });

  it('la salida se permite aunque no cierre la comida', async () => {
    await marcar(10, marca('entrada'));
    await marcar(10, marca('inicio_comida'));
    expect((await marcar(10, marca('salida'))).status).toBe(201);
  });
});

describe('asistencia: orden de las marcas', () => {
  it('no permite marcas fuera de orden', async () => {
    const sinEntrada = await marcar(10, marca('salida'));
    expect(sinEntrada.status).toBe(409);
    expect(sinEntrada.body.error).toMatchObject({
      code: 'MARCA_FUERA_DE_ORDEN',
      message: 'Primero registra tu entrada.',
    });

    await marcar(10, marca('entrada'));
    expect((await marcar(10, marca('entrada'))).body.error.code).toBe('MARCA_FUERA_DE_ORDEN');
    expect((await marcar(10, marca('fin_comida'))).body.error.message).toBe(
      'Primero registra el inicio de tu comida.',
    );
  });

  it('reenviar la misma marca no la duplica', async () => {
    const body = marca('entrada');
    const a = await marcar(10, body);
    const b = await marcar(10, body);
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(repo.marcas).toHaveLength(1);
  });

  it('una entrada sin salida deja de estar abierta pasadas 30 h', async () => {
    await marcar(10, marca('entrada'));
    avanzar(29);
    expect((await marcar(10, marca('entrada'))).status).toBe(409);
    avanzar(2);
    expect((await marcar(10, marca('entrada'))).status).toBe(201);
  });
});

describe('asistencia: alertas (se registra igual)', () => {
  it('fuera de 100 m y GPS impreciso', async () => {
    const lejos = { lat: PLAZA.lat + 0.002, lng: PLAZA.lng }; // ~220 m
    const res = await marcar(10, marca('entrada', lejos, 250));
    expect(res.status).toBe(201);
    expect(res.body.data.distanciaM).toBe(distanciaMetros(lejos, PLAZA));
    expect(res.body.data.alertas).toEqual(['fuera_de_rango', 'gps_impreciso']);
  });

  it('sitio sin coordenadas', async () => {
    const res = await marcar(11, marca('entrada'));
    expect(res.body.data).toMatchObject({
      sitio: { nombre: 'Bodega' },
      distanciaM: null,
      alertas: ['sitio_sin_ubicacion'],
    });
  });

  it('sin sitio asignado no puede marcar', async () => {
    const res = await marcar(12, marca('entrada'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SIN_SITIO');
  });
});

describe('asistencia: mis marcas', () => {
  it('agrupa por jornada y filtra por mes (zona del negocio)', async () => {
    ahora = new Date('2026-09-30T13:00:00.000Z');
    await marcar(10, marca('entrada'));
    avanzar(8);
    await marcar(10, marca('salida'));
    ahora = new Date('2026-10-20T13:00:00.000Z');
    await marcar(10, marca('entrada', PLAZA, 500));

    const oct = await request(app).get('/api/asistencia/mias?mes=2026-10').set('Authorization', token(10));
    expect(oct.body.data).toHaveLength(1);
    expect(oct.body.data[0]).toMatchObject({ salida: null, alertas: ['gps_impreciso'] });

    const sep = await request(app).get('/api/asistencia/mias?mes=2026-09').set('Authorization', token(10));
    expect(sep.body.data[0]).toMatchObject({ entrada: { tipo: 'entrada' }, salida: { tipo: 'salida' } });

    expect(
      (await request(app).get('/api/asistencia/mias?mes=2026-13').set('Authorization', token(10))).status,
    ).toBe(400);
  });

  it('cada guardia ve solo sus marcas', async () => {
    await marcar(10, marca('entrada'));
    const otro = await request(app).get('/api/asistencia/mias?mes=2026-10').set('Authorization', token(11));
    expect(otro.body.data).toEqual([]);
  });
});

describe('asistencia: vista de admin / supervisor (AS1-07)', () => {
  const ver = (path: string, rol: Rol = 'supervisor') =>
    request(app).get(`/api/asistencia/${path}`).set('Authorization', token(5, rol));
  const nombres = (res: request.Response) =>
    res.body.data.items.map((f: { guardia: { nombre: string } }) => f.guardia.nombre);

  beforeEach(async () => {
    await marcar(10, marca('entrada')); // 07:00 CDMX
    await marcar(11, marca('entrada')); // Bodega: sitio sin ubicación
    avanzar(8);
    await marcar(10, marca('salida', PLAZA, 300)); // GPS impreciso
  });

  it('supervisor y admin ven la asistencia; el guardia no', async () => {
    expect((await ver('dia?fecha=2026-10-20')).status).toBe(200);
    expect((await ver('dia?fecha=2026-10-20', 'admin')).status).toBe(200);
    expect((await ver('dia?fecha=2026-10-20', 'guardia')).status).toBe(403);
    expect((await ver('guardias/10?mes=2026-10', 'guardia')).status).toBe(403);
  });

  it('una fila por guardia con su jornada, más los asignados que no han marcado', async () => {
    const res = await ver('dia?fecha=2026-10-20');
    expect(nombres(res)).toEqual(['Ana Ruiz', 'Juan Pérez', 'Rosa Gil']);
    const [ana, juan, rosa] = res.body.data.items;
    expect(ana).toMatchObject({ sitio: { nombre: 'Plaza Norte' }, jornada: null });
    expect(juan.jornada).toMatchObject({
      entrada: { tipo: 'entrada' },
      salida: { tipo: 'salida' },
      alertas: ['gps_impreciso'],
    });
    expect(rosa).toMatchObject({ sitio: { nombre: 'Bodega' }, jornada: { salida: null } });
  });

  it('la jornada cuenta en el día de su entrada (zona del negocio)', async () => {
    const res = await ver('dia?fecha=2026-10-21');
    // Nadie entró el 21: solo aparecen los asignados, sin marcas.
    expect(res.body.data.items.every((f: { jornada: unknown }) => f.jornada === null)).toBe(true);
  });

  it('busca por guardia o sitio y filtra solo con alerta', async () => {
    expect(nombres(await ver('dia?fecha=2026-10-20&q=bodega'))).toEqual(['Rosa Gil']);
    expect(nombres(await ver('dia?fecha=2026-10-20&q=juan'))).toEqual(['Juan Pérez']);
    expect(nombres(await ver('dia?fecha=2026-10-20&soloAlertas=true'))).toEqual(['Juan Pérez', 'Rosa Gil']);
  });

  it('pagina las filas', async () => {
    const res = await ver('dia?fecha=2026-10-20&page=2&limit=2');
    expect(res.body.data).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(nombres(res)).toEqual(['Rosa Gil']);
  });

  it('ficha del guardia: sus jornadas del mes', async () => {
    const res = await ver('guardias/10?mes=2026-10');
    expect(res.body.data.guardia).toMatchObject({ id: 10, nombre: 'Juan Pérez' });
    expect(res.body.data.jornadas).toHaveLength(1);
    expect((await ver('guardias/99?mes=2026-10')).status).toBe(404);
  });

  it('no hay forma de editar ni borrar marcas', async () => {
    const id = repo.marcas[0].id;
    for (const metodo of ['patch', 'put', 'delete'] as const) {
      const res = await request(app)
        [metodo](`/api/asistencia/marcas/${id}`)
        .set('Authorization', token(1, 'admin'));
      expect(res.status).toBe(404);
    }
  });

  it('valida la fecha', async () => {
    expect((await ver('dia?fecha=20-10-2026')).status).toBe(400);
  });
});
