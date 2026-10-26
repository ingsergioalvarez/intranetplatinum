import type { EventoNuevo } from '../src/modules/bitacora/registrar';
import { sinAlcance } from '../src/modules/sitios/alcance';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  PERMISOS_POR_ROL,
  type ConclusionIncidencia,
  TIPOS_CON_FOTO,
  distanciaMetros,
  type MiSitio,
  type Rol,
  type TipoMarcacion,
} from '@platinum/shared';
import { createApp } from '../src/app';
import { StorageService, signAccessToken } from '../src/core';
import { createAsistenciaModule } from '../src/modules/asistencia';
import {
  AsistenciaRepository,
  type FiltroIncidencias,
  type IncidenciaRow,
  type MarcacionRow,
  type NuevaIncidencia,
  type AvisoAsistencia,
  type NuevaMarcacion,
  type NuevoRostro,
  type RostroRow,
} from '../src/modules/asistencia/asistencia.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const NOMBRES: Record<number, string> = { 10: 'Juan Pérez', 11: 'Rosa Gil', 12: 'Luis Mora', 13: 'Ana Ruiz' };
const guardia = (id: number) => ({ id, nombre: NOMBRES[id], email: `u${id}@x.mx` });

class MemoryAsistenciaRepository extends AsistenciaRepository {
  marcas: MarcacionRow[] = [];
  rostros: (RostroRow & { reemplazadoEn: Date | null })[] = [];
  avisos: (AvisoAsistencia & { usuarioIds: number[] })[] = [];
  constructor(
    private readonly sitios: Map<
      number,
      { nombre: string; lat: number | null; lng: number | null; radioM?: number }
    >,
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
    return s && s.lat !== null && s.lng !== null ? { lat: s.lat, lng: s.lng, radioM: s.radioM ?? 100 } : null;
  }
  async nombreSitio(sitioId: number) {
    return this.sitios.get(sitioId)?.nombre ?? null;
  }
  async crear({ sitioId, ip: _ip, userAgent: _ua, ...data }: NuevaMarcacion) {
    const sitio = sitioId ? { id: sitioId, nombre: this.sitios.get(sitioId)!.nombre } : null;
    const marca: MarcacionRow = {
      ...data,
      fotoClave: data.fotoClave ?? null,
      rostroId: data.rostroId ?? null,
      rostroDistancia: data.rostroDistancia ?? null,
      rostroIntentos: data.rostroIntentos ?? null,
      programadaEntrada: data.programadaEntrada ?? null,
      programadaSalida: data.programadaSalida ?? null,
      id: this.marcas.length + 1,
      sitio,
      registradaEn: data.registradaEn ?? this.reloj(),
    };
    this.marcas.push(marca);
    return marca;
  }
  async findMarca(id: number) {
    return this.marcas.find((m) => m.id === id) ?? null;
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
        horaInicio: HORARIOS[sitioId]?.horaInicio ?? null,
        horas: HORARIOS[sitioId]?.horas ?? null,
      }));
  }
  async findGuardia(usuarioId: number) {
    return NOMBRES[usuarioId] ? guardia(usuarioId) : null;
  }
  async rostroActual(usuarioId: number) {
    return this.rostros.filter((r) => r.usuarioId === usuarioId && !r.reemplazadoEn).at(-1) ?? null;
  }
  async rostrosDeOtros(usuarioId: number) {
    return this.rostros
      .filter((r) => r.usuarioId !== usuarioId && !r.reemplazadoEn && r.estado !== 'rechazado')
      .map((r) => ({
        usuario: { id: r.usuarioId, nombre: NOMBRES[r.usuarioId] },
        descriptores: r.descriptores,
      }));
  }
  async findUsuarioRostro(id: number) {
    if (id === 5)
      return { id, nombre: 'Supervisora', rol: 'supervisor' as Rol, activo: true, deletedAt: null };
    return NOMBRES[id]
      ? { id, nombre: NOMBRES[id], rol: 'guardia' as Rol, activo: true, deletedAt: null }
      : null;
  }
  async eliminarRostros(usuarioId: number) {
    const fotos = this.rostros.filter((r) => r.usuarioId === usuarioId).flatMap((r) => r.fotos);
    this.rostros = this.rostros.filter((r) => r.usuarioId !== usuarioId);
    return fotos;
  }
  async guardarRostro({ registradoPorId, revisadoPorId, revisadoEn, ...data }: NuevoRostro) {
    for (const r of this.rostros)
      if (r.usuarioId === data.usuarioId && !r.reemplazadoEn) r.reemplazadoEn = this.reloj();
    const rostro = {
      ...data,
      id: this.rostros.length + 100,
      createdAt: this.reloj(),
      registradoPor: registradoPorId === 5 ? 'Supervisora' : NOMBRES[registradoPorId],
      revisadoPor: revisadoPorId ? 'Supervisora' : null,
      revisadoEn: revisadoEn ?? null,
      motivoRechazo: null,
      reemplazadoEn: null,
    };
    this.rostros.push(rostro);
    return rostro;
  }
  async revisarRostro(
    rostroId: number,
    {
      estado,
      motivoRechazo,
    }: { estado: 'aprobado' | 'rechazado'; revisadoPorId: number; motivoRechazo: string | null },
  ) {
    const r = this.rostros.find((x) => x.id === rostroId)!;
    Object.assign(r, { estado, motivoRechazo, revisadoPor: 'Supervisora', revisadoEn: this.reloj() });
    return r;
  }
  async rostrosPendientes() {
    return this.rostros
      .filter((r) => r.estado === 'pendiente' && !r.reemplazadoEn)
      .map((rostro) => ({ guardia: guardia(rostro.usuarioId), rostro }));
  }
  async revisoresDe() {
    return [1, 5];
  }
  async avisar(usuarioIds: number[], aviso: AvisoAsistencia) {
    this.avisos.push({ ...aviso, usuarioIds });
  }
  incidenciasGuardadas: (NuevaIncidencia & {
    id: number;
    createdAt: Date;
    revisadaPorId: number | null;
    revisadaEn: Date | null;
    conclusion: ConclusionIncidencia | null;
    nota: string | null;
  })[] = [];
  async estadosRostros(ids: number[]) {
    return new Map(
      this.rostros
        .filter((r) => ids.includes(r.id))
        .map((r) => [r.id, { estado: r.estado, revisadoEn: r.revisadoEn }] as const),
    );
  }
  private incidenciaRow(i: MemoryAsistenciaRepository['incidenciasGuardadas'][number]): IncidenciaRow {
    const rostro = this.rostros.filter((r) => r.usuarioId === i.usuarioId && !r.reemplazadoEn).at(-1);
    return {
      id: i.id,
      usuario: guardia(i.usuarioId),
      motivo: i.motivo,
      tipoMarca: i.tipoMarca,
      fotoClave: i.fotoClave,
      rostroRegistrado: rostro?.fotoClave ?? null,
      rostroDe: i.rostroDeId ? { id: i.rostroDeId, nombre: NOMBRES[i.rostroDeId] } : null,
      sitio: i.sitioId ? { id: i.sitioId, nombre: SITIOS.get(i.sitioId)!.nombre } : null,
      createdAt: i.createdAt,
      revisadaPor: i.revisadaPorId ? 'Supervisora' : null,
      revisadaEn: i.revisadaEn,
      conclusion: i.conclusion,
      nota: i.nota,
    };
  }
  async crearIncidencia(data: NuevaIncidencia) {
    const id = this.incidenciasGuardadas.length + 1;
    this.incidenciasGuardadas.push({
      ...data,
      id,
      createdAt: this.reloj(),
      revisadaPorId: null,
      revisadaEn: null,
      conclusion: null,
      nota: null,
    });
    return id;
  }
  async incidencias({ revisadas, conclusion, q, guardiaId, skip, take }: FiltroIncidencias) {
    const filas = this.incidenciasGuardadas
      .map((i) => this.incidenciaRow(i))
      .filter((i) => (i.revisadaEn !== null) === revisadas)
      .filter((i) => !revisadas || !conclusion || i.conclusion === conclusion)
      .filter((i) => !guardiaId || i.usuario.id === guardiaId)
      .filter(
        (i) =>
          !q ||
          [i.usuario.nombre, i.usuario.email, i.sitio?.nombre].some((t) =>
            t?.toLowerCase().includes(q.toLowerCase()),
          ),
      )
      .reverse();
    return { items: filas.slice(skip, skip + take), total: filas.length };
  }
  async findIncidencia(id: number) {
    const i = this.incidenciasGuardadas.find((x) => x.id === id);
    return i ? this.incidenciaRow(i) : null;
  }
  async revisarIncidencia(
    id: number,
    data: { revisadaPorId: number; conclusion: ConclusionIncidencia; nota: string | null },
  ) {
    const i = this.incidenciasGuardadas.find((x) => x.id === id)!;
    Object.assign(i, { ...data, revisadaEn: this.reloj() });
    return this.incidenciaRow(i);
  }
}

class MemoryStorage extends StorageService {
  archivos = new Map<string, Buffer>();
  async guardar(contenido: Buffer, mime: string, carpeta: string) {
    const clave = this.nuevaClave(carpeta, mime);
    this.archivos.set(clave, contenido);
    return clave;
  }
  async leer() {
    return null;
  }
  async eliminar(clave: string) {
    this.archivos.delete(clave);
  }
}

// Plaza Norte (con coordenadas), Hotel Sur (a ~1.1 km) y Bodega (sin coordenadas).
const PLAZA = { lat: 19.4326, lng: -99.1332 };
const SITIOS = new Map<number, { nombre: string; lat: number | null; lng: number | null; radioM?: number }>([
  [1, { nombre: 'Plaza Norte', ...PLAZA }],
  [2, { nombre: 'Hotel Sur', lat: 19.4226, lng: -99.1332 }],
  [3, { nombre: 'Bodega', lat: null, lng: null }],
]);

/** Horario de la asignación por sitio (vacío salvo en las pruebas de horario). */
let HORARIOS: Record<
  number,
  Partial<Pick<MiSitio, 'turno' | 'horaInicio' | 'horaFin' | 'horas' | 'dias'>>
> = {};

const miSitio = (id: number): MiSitio => {
  const s = SITIOS.get(id)!;
  return {
    asignacionId: id * 10,
    tipo: 'fija',
    grupo: null,
    turno: HORARIOS[id]?.turno ?? null,
    horaInicio: HORARIOS[id]?.horaInicio ?? null,
    horaFin: HORARIOS[id]?.horaFin ?? null,
    horas: HORARIOS[id]?.horas ?? null,
    dias: HORARIOS[id]?.dias ?? null,
    desde: '2026-10-01',
    hasta: null,
    sitio: {
      id,
      nombre: s.nombre,
      direccion: null,
      referencias: null,
      lat: s.lat,
      lng: s.lng,
      radioM: s.radioM ?? 100,
    },
    cliente: { id: 1, nombreComercial: 'Cliente Demo' },
  };
};

// Guardia 10 → Plaza Norte y Hotel Sur; 11 → Bodega; 12 → sin sitios; 13 → Plaza Norte (no marca).
const ASIGNACIONES: Record<number, number[]> = { 10: [1, 2], 11: [3], 12: [], 13: [1] };

// Vectores faciales de prueba: Juan registrado (0.1), Juan hoy (0.12, distancia ≈ 0.23), otra persona (0.3).
const vector = (v: number) => Array.from({ length: 128 }, () => v);
const CARA_JUAN = vector(0.1);
const CARA_JUAN_HOY = vector(0.12);
const CARA_OTRO = vector(0.3);
/** Cara de cada guardia al marcar (cada uno la suya, para no confundirse con otro guardia). */
const CARA_DE: Record<number, number[]> = {
  10: CARA_JUAN_HOY,
  11: vector(0.505),
  12: vector(0.7),
  13: vector(0.9),
};
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);

let app: Express;
let repo: MemoryAsistenciaRepository;
let storage: MemoryStorage;
let audit: MemoryAuditLogger;
let bitacora: EventoNuevo[];
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

/** Comida: JSON. Entrada/salida: multipart con foto y vector facial (por defecto, el de Juan). */
function marcar(
  usuarioId: number,
  body: Record<string, unknown>,
  { foto = true, descriptor = CARA_DE[usuarioId] }: { foto?: boolean; descriptor?: number[] | null } = {},
) {
  const req = request(app).post('/api/asistencia/marcas').set('Authorization', token(usuarioId));
  if (!TIPOS_CON_FOTO.includes(body.tipo as TipoMarcacion)) return req.send(body);
  const campos = { ...body, ...(descriptor && { descriptor: JSON.stringify(descriptor) }) };
  for (const [k, v] of Object.entries(campos)) if (v !== undefined) req.field(k, String(v));
  return foto ? req.attach('foto', JPEG, { filename: 'foto.jpg', contentType: 'image/jpeg' }) : req;
}

/** Registro de rostro (multipart con una foto por muestra): en persona por supervisor o autoregistro. */
function conFotos(req: request.Test, descriptores: number[][], fotos = descriptores.length) {
  req.field('descriptores', JSON.stringify(descriptores));
  for (let i = 0; i < fotos; i++)
    req.attach('fotos', JPEG, { filename: `f${i}.jpg`, contentType: 'image/jpeg' });
  return req;
}
const registrar = (
  usuarioId: number,
  descriptores: number[][],
  { rol = 'supervisor' as Rol, fotos = descriptores.length } = {},
) =>
  conFotos(
    request(app).post(`/api/asistencia/rostros/${usuarioId}`).set('Authorization', token(5, rol)),
    descriptores,
    fotos,
  );
const autoregistrar = (usuarioId: number, descriptores: number[][]) =>
  conFotos(
    request(app).post('/api/asistencia/mi-rostro').set('Authorization', token(usuarioId)),
    descriptores,
  );
const revisar = (usuarioId: number, accion: 'aprobar' | 'rechazar', motivo?: string) =>
  request(app)
    .post(`/api/asistencia/rostros/${usuarioId}/${accion}`)
    .set('Authorization', token(5, 'supervisor'))
    .send(motivo ? { motivo } : {});

const avanzar = (horas: number) => {
  ahora = new Date(ahora.getTime() + horas * 3_600_000);
};

beforeEach(() => {
  bitacora = [];
  HORARIOS = {};
  ahora = new Date('2026-10-20T13:00:00.000Z'); // 07:00 en CDMX
  repo = new MemoryAsistenciaRepository(SITIOS, () => ahora);
  storage = new MemoryStorage();
  audit = new MemoryAuditLogger();
  // Juan (10) tiene rostro registrado; Rosa (11) no.
  const fotoJuan = 'rostros/2026/10/00000000-0000-4000-8000-000000000099.jpg';
  repo.rostros.push({
    id: 99,
    usuarioId: 10,
    estado: 'aprobado',
    autoregistro: false,
    descriptores: [CARA_JUAN, vector(0.11), vector(0.09)],
    fotoClave: fotoJuan,
    fotos: [fotoJuan],
    createdAt: ahora,
    registradoPor: 'Supervisora',
    revisadoPor: 'Supervisora',
    revisadoEn: ahora,
    motivoRechazo: null,
    reemplazadoEn: null,
  });
  app = createApp([
    createAsistenciaModule({
      repo,
      misSitios: async (usuarioId) => (ASIGNACIONES[usuarioId] ?? []).map(miSitio),
      storage,
      audit,
      ahora: () => ahora,
      hoy: () => '2026-10-20',
      bitacora: async (e) => void bitacora.push(e),
      alcance: sinAlcance,
      llegada: async () => undefined,
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
    expect(estado.body.data.permitidas).toEqual(['inicio_comida']);

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
      inicioComida: { tipo: 'inicio_comida', foto: null },
      finComida: { tipo: 'fin_comida' },
      salida: { tipo: 'salida', registradaEn: '2026-10-20T21:00:00.000Z' },
    });
  });

  it('elige el sitio asignado más cercano', async () => {
    const res = await marcar(10, marca('entrada', { lat: 19.4227, lng: -99.1332 }));
    expect(res.body.data.sitio.nombre).toBe('Hotel Sur');
  });

  it('no permite checar salida hasta completar las horas de comida', async () => {
    await marcar(10, marca('entrada'));
    const intentoSalidaDirecta = await marcar(10, marca('salida'));
    expect(intentoSalidaDirecta.status).toBe(409);
    expect(intentoSalidaDirecta.body.error.message).toBe(
      'Debes registrar tus horas de comida antes de checar tu salida.',
    );

    await marcar(10, marca('inicio_comida'));
    const intentoSalidaEnComida = await marcar(10, marca('salida'));
    expect(intentoSalidaEnComida.status).toBe(409);
    expect(intentoSalidaEnComida.body.error.message).toBe(
      'Debes registrar tus horas de comida antes de checar tu salida.',
    );

    await marcar(10, marca('fin_comida'));
    const salidaOk = await marcar(10, marca('salida'));
    expect(salidaOk.status).toBe(201);
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

describe('asistencia: GPS obligatorio en entrada y salida (DA-36)', () => {
  const lejos = { lat: PLAZA.lat + 0.002, lng: PLAZA.lng }; // ~220 m

  afterEach(() => {
    SITIOS.get(1)!.radioM = undefined;
  });

  it('fuera del rango no se registra la entrada y queda en auditoría', async () => {
    const res = await marcar(10, marca('entrada', lejos));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'FUERA_DE_RANGO',
      message: 'Estás a 222 m de Plaza Norte. Acércate al sitio (máximo 100 m) para registrar tu entrada.',
    });
    expect(repo.marcas).toHaveLength(0);
    expect(storage.archivos.size).toBe(0);
    expect(audit.eventos.at(-1)).toMatchObject({
      accion: 'asistencia.intento_fuera_de_rango',
      datos: { tipo: 'entrada', distanciaM: distanciaMetros(lejos, PLAZA), radioM: 100 },
    });
  });

  it('con señal GPS débil tampoco (hay que reintentar)', async () => {
    const res = await marcar(10, marca('entrada', PLAZA, 250));
    expect(res.body.error).toMatchObject({
      code: 'GPS_IMPRECISO',
      message: 'La señal de tu GPS es débil (±250 m). Sal a un lugar abierto e intenta de nuevo.',
    });
  });

  it('la salida también exige estar en el sitio; la comida no', async () => {
    await marcar(10, marca('entrada'));
    const comida = await marcar(10, marca('inicio_comida', lejos, 250));
    expect(comida.status).toBe(201);
    expect(comida.body.data.alertas).toEqual(['fuera_de_rango', 'gps_impreciso']);
    await marcar(10, marca('fin_comida'));
    const salida = await marcar(10, marca('salida', lejos));
    expect(salida.body.error.message).toBe(
      'Estás a 222 m de Plaza Norte. Acércate al sitio (máximo 100 m) para registrar tu salida.',
    );
    // La comida fuera del sitio avisa al supervisor.
    expect(repo.avisos.filter((a) => a.tipo === 'marca_alerta')).toEqual([
      expect.objectContaining({
        usuarioIds: [1, 5],
        ruta: '/asistencia/guardias/10?vista=bitacora&cat=incidencias',
        mensaje: 'Juan Pérez · Inicio de comida en Plaza Norte: fuera del sitio (222 m)',
      }),
    ]);
  });

  it('cada sitio puede tener su propio radio (sitios grandes)', async () => {
    SITIOS.get(1)!.radioM = 300;
    const res = await marcar(10, marca('entrada', lejos));
    expect(res.status).toBe(201);
    expect(res.body.data.alertas).toEqual([]);
  });

  it('sitio sin coordenadas', async () => {
    const res = await marcar(11, marca('entrada'));
    expect(res.body.data).toMatchObject({ sitio: { nombre: 'Bodega' }, distanciaM: null });
    expect(res.body.data.alertas).toContain('sitio_sin_ubicacion');
  });

  it('sin sitio asignado no puede marcar', async () => {
    const res = await marcar(12, marca('entrada'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SIN_SITIO');
  });
});

describe('asistencia: foto y reconocimiento facial (AS1-08)', () => {
  it('entrada y salida exigen foto; la comida no', async () => {
    const sinFoto = await marcar(10, marca('entrada'), { foto: false });
    expect(sinFoto.status).toBe(400);
    expect(sinFoto.body.error.details[0].path).toBe('foto');

    expect((await marcar(10, marca('entrada'))).status).toBe(201);
    expect((await marcar(10, marca('inicio_comida'))).status).toBe(201);
  });

  it('rostro que coincide: guarda la foto y el resultado', async () => {
    const res = await marcar(10, marca('entrada'));
    expect(res.body.data.alertas).toEqual([]);
    expect(res.body.data.rostro).toEqual({ distancia: expect.any(Number), intentos: 1 });
    expect(repo.marcas[0].rostroId).toBe(99);
    expect(res.body.data.rostro.distancia).toBeLessThan(0.5);
    expect(res.body.data.foto).toMatch(/^\/api\/archivos\/asistencia\/.+\?exp=\d+&sig=/);
    expect(storage.archivos.size).toBe(1);
  });

  it('no coincide: se rechaza siempre, sin guardar nada (ya no se registra con alerta)', async () => {
    for (const intento of [1, 2, 3, 4]) {
      const res = await marcar(10, marca('entrada', PLAZA, 15, { intento }), { descriptor: CARA_OTRO });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ROSTRO_NO_COINCIDE');
    }
    expect(repo.marcas).toHaveLength(0);
    expect(storage.archivos.size).toBe(0);
  });

  it('si no se pudo leer el rostro cuenta como no coincide', async () => {
    const res = await marcar(10, marca('entrada'), { descriptor: null });
    expect(res.status).toBe(422);
  });

  it('sin rostro registrado: se registra con alerta y foto (opción a)', async () => {
    const res = await marcar(11, marca('entrada'));
    expect(res.status).toBe(201);
    expect(res.body.data.alertas).toEqual(['sitio_sin_ubicacion', 'sin_rostro_registrado']);
    expect(res.body.data.rostro).toEqual({ distancia: null, intentos: 1 });
  });
});

describe('asistencia: registro de rostro (AS1-02)', () => {
  const ROSA = [vector(0.5), vector(0.51), vector(0.49)];

  it('supervisor registra el rostro y queda guardado y consultable', async () => {
    const res = await registrar(11, ROSA);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ registradoPor: 'Supervisora', muestras: 3, estado: 'aprobado' });
    expect(res.body.data.fotos).toHaveLength(3);
    expect(res.body.data.fotoUrl).toMatch(/^\/api\/archivos\/rostros\//);
    expect(audit.acciones()).toContain('asistencia.registrar_rostro');

    const consulta = await request(app)
      .get('/api/asistencia/rostros/11')
      .set('Authorization', token(5, 'supervisor'));
    expect(consulta.body.data.muestras).toBe(3);

    // Ya registrada, Rosa marca sin alerta de rostro.
    const entrada = await marcar(11, marca('entrada'), { descriptor: vector(0.505) });
    expect(entrada.body.data.alertas).not.toContain('sin_rostro_registrado');
    expect(entrada.body.data.alertas).not.toContain('rostro_no_coincide');
  });

  it('volver a registrar reemplaza el rostro anterior (se conserva el historial)', async () => {
    await registrar(11, ROSA);
    await registrar(11, [vector(0.55), vector(0.56), vector(0.54)]);
    expect(repo.rostros.filter((r) => r.usuarioId === 11)).toHaveLength(2);
    expect((await repo.rostroActual(11))!.descriptores[0][0]).toBe(0.55);
  });

  it('un guardia no puede registrar rostros; tampoco sin rostro registrado', async () => {
    expect((await registrar(11, ROSA, { rol: 'guardia' })).status).toBe(403);
    const sinRostro = await request(app)
      .get('/api/asistencia/rostros/11')
      .set('Authorization', token(5, 'supervisor'));
    expect(sinRostro.body.data).toBeNull();
  });

  it('valida cantidad de fotos, foto de referencia y que sean de la misma persona', async () => {
    expect((await registrar(11, ROSA.slice(0, 2))).status).toBe(400);
    expect((await registrar(11, ROSA, { fotos: 0 })).body.error.details[0].path).toBe('fotos');
    expect((await registrar(11, ROSA, { fotos: 2 })).status).toBe(400);
    const mezcla = await registrar(11, [vector(0.5), vector(0.51), CARA_JUAN]);
    expect(mezcla.status).toBe(400);
    expect(mezcla.body.error.message).toBe('Las fotos no parecen de la misma persona');
  });

  it('detecta una cara ya registrada en otra cuenta', async () => {
    const res = await registrar(11, [vector(0.1), vector(0.105), vector(0.095)]);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Este rostro ya está registrado para Juan Pérez');
    expect(storage.archivos.size).toBe(0);
  });

  it('solo el admin elimina rostros; el guardia queda sin rostro y sus marcas conservan su foto', async () => {
    const entrada = await marcar(10, marca('entrada'));
    const borrar = (rol: Rol) =>
      request(app).delete('/api/asistencia/rostros/10').set('Authorization', token(1, rol));

    expect((await borrar('supervisor')).status).toBe(403);
    expect((await borrar('admin')).status).toBe(204);
    expect(await repo.rostroActual(10)).toBeNull();
    expect(audit.acciones()).toContain('asistencia.eliminar_rostro');
    expect(repo.marcas.find((m) => m.id === entrada.body.data.id)!.fotoClave).not.toBeNull();
    expect((await borrar('admin')).status).toBe(404);

    avanzar(4);
    await marcar(10, marca('inicio_comida'));
    await marcar(10, marca('fin_comida'));
    avanzar(5);
    const salida = await marcar(10, marca('salida'));
    expect(salida.body.data.alertas).toContain('sin_rostro_registrado');
  });

  it('solo se registra el rostro de guardias', async () => {
    expect((await registrar(5, ROSA)).status).toBe(400);
    expect((await registrar(77, ROSA)).status).toBe(404);
  });
});

describe('asistencia: mis marcas', () => {
  it('agrupa por jornada y filtra por mes (zona del negocio)', async () => {
    ahora = new Date('2026-09-30T13:00:00.000Z');
    await marcar(10, marca('entrada'));
    await marcar(10, marca('inicio_comida'));
    await marcar(10, marca('fin_comida'));
    avanzar(8);
    await marcar(10, marca('salida'));
    ahora = new Date('2026-10-20T13:00:00.000Z');
    await marcar(10, marca('entrada'));
    await marcar(10, marca('inicio_comida', PLAZA, 500));

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
    await marcar(11, marca('entrada')); // Bodega: sitio sin ubicación y sin rostro registrado
    avanzar(8);
    await marcar(10, marca('inicio_comida', PLAZA, 300)); // GPS impreciso
    await marcar(10, marca('fin_comida'));
    await marcar(10, marca('salida'));
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

  it('ficha del guardia: sus jornadas del mes y su rostro registrado', async () => {
    const res = await ver('guardias/10?mes=2026-10');
    expect(res.body.data.guardia).toMatchObject({ id: 10, nombre: 'Juan Pérez' });
    expect(res.body.data.rostro).toMatchObject({ muestras: 3, registradoPor: 'Supervisora' });
    expect(res.body.data.jornadas).toHaveLength(1);
    expect(res.body.data.jornadas[0].entrada.foto).toMatch(/^\/api\/archivos\/asistencia\//);
    expect((await ver('guardias/11?mes=2026-10')).body.data.rostro).toBeNull();
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

describe('asistencia: autoregistro y revisión del rostro', () => {
  const ROSA = [vector(0.5), vector(0.51), vector(0.49)];
  const ROSA_HOY = vector(0.505);
  const estado = (id: number) => request(app).get('/api/asistencia/estado').set('Authorization', token(id));

  it('el guardia se registra solo: queda pendiente, avisa a revisores y ya puede marcar con alerta', async () => {
    expect((await estado(11)).body.data.rostro).toEqual({ estado: 'sin_registro', motivoRechazo: null });

    const res = await autoregistrar(11, ROSA);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      estado: 'pendiente',
      autoregistro: true,
      registradoPor: 'Rosa Gil',
    });
    expect(repo.avisos).toContainEqual(
      expect.objectContaining({ tipo: 'rostro_pendiente', ruta: '/asistencia/rostros', usuarioIds: [1, 5] }),
    );
    expect((await estado(11)).body.data.rostro.estado).toBe('pendiente');

    const entrada = await marcar(11, marca('entrada'), { descriptor: ROSA_HOY });
    expect(entrada.status).toBe(201);
    expect(entrada.body.data.alertas).toContain('rostro_pendiente');
    expect(entrada.body.data.alertas).not.toContain('sin_rostro_registrado');

    // Solo una vez.
    expect((await autoregistrar(11, ROSA)).body.error.message).toBe('Tu rostro ya está en revisión');
  });

  it('supervisor ve los pendientes y aprueba: ya no hay alerta', async () => {
    await autoregistrar(11, ROSA);
    const pendientes = await request(app)
      .get('/api/asistencia/rostros/pendientes')
      .set('Authorization', token(5, 'supervisor'));
    expect(pendientes.body.data).toMatchObject([{ guardia: { id: 11 }, rostro: { estado: 'pendiente' } }]);
    expect(pendientes.body.data[0].rostro.fotos).toHaveLength(3);

    const ok = await revisar(11, 'aprobar');
    expect(ok.body.data).toMatchObject({ estado: 'aprobado', revisadoPor: 'Supervisora' });
    expect(audit.acciones()).toContain('asistencia.aprobar_rostro');
    const entrada = await marcar(11, marca('entrada'), { descriptor: ROSA_HOY });
    expect(entrada.body.data.alertas).not.toContain('rostro_pendiente');
    expect((await revisar(11, 'aprobar')).status).toBe(409);
  });

  it('rechazado: no se usa para comparar y el guardia puede registrarse de nuevo', async () => {
    await autoregistrar(11, ROSA);
    expect((await revisar(11, 'rechazar')).status).toBe(400);
    const res = await revisar(11, 'rechazar', 'La foto está borrosa');
    expect(res.body.data).toMatchObject({ estado: 'rechazado', motivoRechazo: 'La foto está borrosa' });
    expect((await estado(11)).body.data.rostro).toEqual({
      estado: 'rechazado',
      motivoRechazo: 'La foto está borrosa',
    });

    const entrada = await marcar(11, marca('entrada'), { descriptor: ROSA_HOY });
    expect(entrada.body.data.alertas).toContain('sin_rostro_registrado');
    expect((await autoregistrar(11, ROSA)).status).toBe(201);
  });

  it('el guardia no puede revisar rostros', async () => {
    await autoregistrar(11, ROSA);
    const res = await request(app).post('/api/asistencia/rostros/11/aprobar').set('Authorization', token(10));
    expect(res.status).toBe(403);
  });
});

describe('asistencia: el rostro de otro guardia (1 a N)', () => {
  it('marcar con la cara de otro guardia se bloquea, crea la incidencia con foto, avisa y audita', async () => {
    // Rosa (sin rostro) intenta marcar con la cara de Juan.
    const res = await marcar(11, marca('entrada'), { descriptor: CARA_JUAN_HOY });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'ROSTRO_DE_OTRO',
      message: 'El rostro frente a la cámara no corresponde al titular de esta cuenta',
    });
    expect(repo.marcas).toHaveLength(0);
    const [foto] = [...storage.archivos.keys()];
    expect(foto).toMatch(/^intentos\//);
    expect(repo.incidenciasGuardadas[0]).toMatchObject({
      usuarioId: 11,
      motivo: 'rostro_de_otro',
      tipoMarca: 'entrada',
      rostroDeId: 10,
      sitioId: 3,
      fotoClave: foto,
    });
    const evento = audit.eventos.find((e) => e.accion === 'asistencia.incidencia_rostro')!;
    expect(evento.datos).toMatchObject({
      motivo: 'rostro_de_otro',
      rostroDe: { id: 10, nombre: 'Juan Pérez' },
    });
    expect(repo.avisos[0]).toMatchObject({
      tipo: 'rostro_suplantacion',
      ruta: '/asistencia/incidencias?id=1',
      mensaje: 'Rosa Gil · Entrada: el rostro corresponde a Juan Pérez',
      fotoClave: foto,
    });
  });

  it('también se bloquea aunque el titular tenga rostro, si la cara se parece más al otro', async () => {
    await autoregistrar(11, [vector(0.5), vector(0.51), vector(0.49)]);
    expect((await marcar(10, marca('entrada'), { descriptor: vector(0.5) })).body.error.code).toBe(
      'ROSTRO_DE_OTRO',
    );
  });

  it('autoregistrarse con una cara ya registrada (aunque esté pendiente) se rechaza, avisa y queda como incidencia', async () => {
    const res = await autoregistrar(11, [CARA_JUAN, vector(0.105), vector(0.095)]);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Este rostro ya está registrado para Juan Pérez');
    expect(repo.avisos[0]).toMatchObject({
      tipo: 'rostro_duplicado',
      mensaje: 'Rosa Gil intentó registrar un rostro que ya está registrado para Juan Pérez',
    });
    expect(repo.incidenciasGuardadas[0]).toMatchObject({ motivo: 'registro_duplicado', tipoMarca: null });
    expect(audit.acciones()).toContain('asistencia.incidencia_rostro');

    // Rostro pendiente de Rosa: Ana no puede registrar esa misma cara.
    await autoregistrar(11, [vector(0.5), vector(0.51), vector(0.49)]);
    expect((await autoregistrar(13, [vector(0.5), vector(0.505), vector(0.495)])).body.error.message).toBe(
      'Este rostro ya está registrado para Rosa Gil',
    );
  });
});

describe('asistencia: verificación en vivo del titular (DA-28)', () => {
  const verificar = (usuarioId: number, descriptor: number[]) =>
    request(app)
      .post('/api/asistencia/verificar-rostro')
      .set('Authorization', token(usuarioId))
      .send({ descriptor });

  it('titular, dudoso, no titular y sin rostro; no guarda nada', async () => {
    const resultado = async (id: number, d: number[]) => (await verificar(id, d)).body.data.resultado;
    expect(await resultado(10, CARA_JUAN_HOY)).toBe('titular');
    expect(await resultado(10, vector(0.16))).toBe('dudoso'); // ≈ 0.57
    expect(await resultado(10, CARA_OTRO)).toBe('no_titular');
    expect(await resultado(11, vector(0.5))).toBe('sin_rostro');
    // Sin rostro propio, pero la cara es de otro guardia registrado.
    expect(await resultado(11, CARA_JUAN_HOY)).toBe('no_titular');
    expect(repo.marcas).toHaveLength(0);
    expect(storage.archivos.size).toBe(0);
    expect(audit.eventos).toHaveLength(0);
  });

  it('solo el guardia (permiso de marcar) y con un vector válido', async () => {
    const sup = await request(app)
      .post('/api/asistencia/verificar-rostro')
      .set('Authorization', token(5, 'supervisor'))
      .send({ descriptor: CARA_JUAN });
    expect(sup.status).toBe(403);
    expect((await verificar(10, [0.1, 0.2])).status).toBe(400);
  });
});

describe('asistencia: incidencias de rostro (DA-31)', () => {
  const reportar = (
    usuarioId: number,
    motivo: string,
    { descriptor, tipo = 'entrada' }: { descriptor?: number[]; tipo?: string } = {},
  ) => {
    const req = request(app)
      .post('/api/asistencia/incidencias')
      .set('Authorization', token(usuarioId))
      .field('tipo', tipo)
      .field('motivo', motivo);
    if (descriptor) req.field('descriptor', JSON.stringify(descriptor));
    return req.attach('foto', JPEG, { filename: 'foto.jpg', contentType: 'image/jpeg' });
  };
  /** Avisos a supervisores y admin (no los del propio guardia). */
  const revisores = () => repo.avisos.filter((a) => a.usuarioIds.includes(5));
  const sup = (path: string) =>
    request(app).get(`/api/asistencia${path}`).set('Authorization', token(5, 'supervisor'));

  it('cara desconocida: guarda la foto, crea la incidencia y avisa una sola vez cada 2 minutos', async () => {
    expect((await reportar(10, 'no_titular', { descriptor: CARA_OTRO })).status).toBe(204);
    expect([...storage.archivos.keys()][0]).toMatch(/^intentos\//);
    expect(repo.incidenciasGuardadas[0]).toMatchObject({
      motivo: 'no_titular',
      rostroDeId: null,
      sitioId: 1,
    });
    expect(revisores()).toEqual([
      expect.objectContaining({
        tipo: 'rostro_suplantacion',
        ruta: '/asistencia/incidencias?id=1',
        mensaje: 'Juan Pérez · Entrada: el rostro no corresponde al titular',
      }),
    ]);

    await reportar(10, 'no_titular', { descriptor: CARA_OTRO });
    expect(revisores()).toHaveLength(1);
    avanzar(0.05); // 3 minutos
    await reportar(10, 'no_titular', { descriptor: CARA_OTRO, tipo: 'salida' });
    expect(revisores()).toHaveLength(2);
  });

  it('cara de otro guardia: queda como "rostro de otro" y dice de quién es', async () => {
    await reportar(11, 'no_titular', { descriptor: CARA_JUAN_HOY });
    expect(repo.incidenciasGuardadas[0]).toMatchObject({ motivo: 'rostro_de_otro', rostroDeId: 10 });
    expect(revisores()[0].mensaje).toBe('Rosa Gil · Entrada: el rostro corresponde a Juan Pérez');
  });

  it('si la cara sí es del titular (o es dudosa) no se reporta nada; "no titular" exige el vector', async () => {
    expect((await reportar(10, 'no_titular', { descriptor: CARA_JUAN_HOY })).status).toBe(204);
    await reportar(10, 'no_titular', { descriptor: vector(0.16) });
    expect(revisores()).toHaveLength(0);
    expect(storage.archivos.size).toBe(0);
    expect((await reportar(10, 'no_titular')).status).toBe(400);
  });

  it('pantalla y gesto no completado: cada uno con su aviso', async () => {
    await reportar(10, 'pantalla');
    await reportar(10, 'reto_fallido');
    expect(revisores().map((a) => [a.tipo, a.mensaje])).toEqual([
      ['rostro_pantalla', 'Juan Pérez · Entrada: parece una pantalla o foto frente a la cámara'],
      ['rostro_reto', 'Juan Pérez · Entrada: no completó el gesto pedido'],
    ]);
  });

  it('supervisor lista, filtra, ve el detalle con la foto y el rostro registrado, y la marca revisada', async () => {
    await reportar(10, 'pantalla');
    await reportar(11, 'no_titular', { descriptor: CARA_JUAN_HOY });

    const lista = await sup('/incidencias');
    expect(lista.body.data.total).toBe(2);
    expect(lista.body.data.items.map((i: { motivo: string }) => i.motivo)).toEqual([
      'rostro_de_otro',
      'pantalla',
    ]);
    expect((await sup('/incidencias?q=bodega')).body.data.items).toHaveLength(1);
    expect((await sup('/incidencias?guardiaId=10')).body.data.items).toHaveLength(1);

    const detalle = (await sup('/incidencias/1')).body.data;
    expect(detalle).toMatchObject({
      guardia: { id: 10, nombre: 'Juan Pérez' },
      motivo: 'pantalla',
      tipoMarca: 'entrada',
      sitio: { id: 1, nombre: 'Plaza Norte' },
      revisadaEn: null,
    });
    expect(detalle.foto).toMatch(/^\/api\/archivos\/intentos\/.+\?exp=\d+&sig=/);
    expect(detalle.rostroRegistrado).toMatch(/^\/api\/archivos\/rostros\//);

    const revisar = () =>
      request(app)
        .post('/api/asistencia/incidencias/1/revisar')
        .set('Authorization', token(5, 'supervisor'))
        .send({ conclusion: 'falsa_alarma', nota: 'Era una prueba' });
    const ok = await revisar();
    expect(ok.body.data).toMatchObject({
      revisadaPor: 'Supervisora',
      conclusion: 'falsa_alarma',
      nota: 'Era una prueba',
    });
    expect((await revisar()).status).toBe(409);
    expect((await sup('/incidencias')).body.data.total).toBe(1);
    expect((await sup('/incidencias?estado=revisadas')).body.data.items[0].id).toBe(1);
    expect((await sup('/incidencias?estado=revisadas&conclusion=confirmada')).body.data.items).toHaveLength(
      0,
    );
    const sinConclusion = await request(app)
      .post('/api/asistencia/incidencias/2/revisar')
      .set('Authorization', token(5, 'supervisor'))
      .send({});
    expect(sinConclusion.status).toBe(400);
    expect(audit.acciones()).toContain('asistencia.revisar_incidencia');
  });

  it('el guardia no ve ni revisa incidencias; el supervisor no las reporta', async () => {
    const guardia = await request(app).get('/api/asistencia/incidencias').set('Authorization', token(10));
    expect(guardia.status).toBe(403);
    const reporte = await request(app)
      .post('/api/asistencia/incidencias')
      .set('Authorization', token(5, 'supervisor'))
      .field('tipo', 'entrada')
      .field('motivo', 'pantalla');
    expect(reporte.status).toBe(403);
    expect((await sup('/incidencias/99')).status).toBe(404);
  });
});

describe('asistencia: avisos al guardia (DA-34)', () => {
  const ROSA = [vector(0.5), vector(0.51), vector(0.49)];
  const delGuardia = (id: number) =>
    repo.avisos.filter((a) => a.usuarioIds.length === 1 && a.usuarioIds[0] === id);

  it('rostro aprobado o rechazado (con el motivo)', async () => {
    await autoregistrar(11, ROSA);
    await revisar(11, 'rechazar', 'La foto está borrosa');
    expect(delGuardia(11).at(-1)).toMatchObject({
      tipo: 'rostro_rechazado',
      ruta: '/marcar',
      mensaje:
        'Tu rostro fue rechazado: La foto está borrosa. Vuelve a registrarlo la próxima vez que cheques',
    });
    await autoregistrar(11, ROSA);
    await revisar(11, 'aprobar');
    expect(delGuardia(11).at(-1)).toMatchObject({ tipo: 'rostro_aprobado' });
  });

  it('intento de marcar con su cuenta: pantalla o rostro de otra persona, no gesto fallido', async () => {
    const reportar = (motivo: string, descriptor?: number[]) => {
      const req = request(app)
        .post('/api/asistencia/incidencias')
        .set('Authorization', token(10))
        .field('tipo', 'entrada')
        .field('motivo', motivo);
      if (descriptor) req.field('descriptor', JSON.stringify(descriptor));
      return req.attach('foto', JPEG, { filename: 'foto.jpg', contentType: 'image/jpeg' });
    };
    await reportar('reto_fallido');
    expect(delGuardia(10)).toHaveLength(0);
    await reportar('pantalla');
    expect(delGuardia(10)[0]).toMatchObject({ tipo: 'cuenta_intento', ruta: '/marcar' });
    await reportar('no_titular', CARA_OTRO);
    expect(delGuardia(10)).toHaveLength(2);
  });
});

describe('asistencia: horario del turno, retardo y salida anticipada (DA-32, DA-33)', () => {
  const ROSA = [vector(0.5), vector(0.51), vector(0.49)];
  const mias = (id: number) =>
    request(app).get('/api/asistencia/mias?mes=2026-10').set('Authorization', token(id));
  const retardos = () => repo.avisos.filter((a) => a.tipo === 'retardo');

  it('guarda entrada y salida programadas (24 h) y no marca retardo dentro de la tolerancia', async () => {
    HORARIOS = { 1: { turno: '24x24', horaInicio: '07:00', horaFin: '07:00' } };
    avanzar(10 / 60); // 07:10
    const res = await marcar(10, marca('entrada'));
    expect(res.body.data.alertas).toEqual([]);
    expect(repo.marcas[0].programadaEntrada?.toISOString()).toBe('2026-10-20T13:00:00.000Z');
    expect(repo.marcas[0].programadaSalida?.toISOString()).toBe('2026-10-21T13:00:00.000Z');
    const [j] = (await mias(10)).body.data;
    expect(j).toMatchObject({
      programada: { entrada: '2026-10-20T13:00:00.000Z', salida: '2026-10-21T13:00:00.000Z' },
      retardoMin: 10,
      salidaAnticipadaMin: null,
    });
    expect(retardos()).toHaveLength(0);
  });

  it('retardo desde el minuto 11; el aviso al supervisor solo pasados 15 min', async () => {
    HORARIOS = { 1: { turno: '24x24', horaInicio: '07:00', horaFin: '07:00' } };
    avanzar(12 / 60); // 07:12: retardo, sin aviso
    expect((await marcar(10, marca('entrada'))).body.data.alertas).toEqual(['retardo']);
    expect(retardos()).toHaveLength(0);

    avanzar(6);
    await marcar(10, marca('inicio_comida'));
    await marcar(10, marca('fin_comida'));
    avanzar(12);
    await marcar(10, marca('inicio_comida'));
    await marcar(10, marca('fin_comida'));
    avanzar(6); // otra jornada, al día siguiente 07:37
    avanzar(25 / 60);
    await marcar(10, marca('salida'));
    await marcar(10, marca('entrada'));
    expect(retardos()).toEqual([
      expect.objectContaining({
        usuarioIds: [1, 5],
        ruta: '/asistencia/guardias/10?vista=bitacora&cat=incidencias',
        mensaje: 'Juan Pérez · Plaza Norte: llegó 37 min tarde (debía entrar a las 7:00 a.m.)',
      }),
    ]);
    // En la bitácora quedan los dos retardos, también el que no avisó (DA-41).
    expect(bitacora.filter((e) => e.tipo === 'retardo').map((e) => e.detalle)).toEqual([
      'Llegó 12 min tarde a Plaza Norte (debía entrar a las 7:00 a.m.)',
      'Llegó 37 min tarde a Plaza Norte (debía entrar a las 7:00 a.m.)',
    ]);
    expect(bitacora[0]).toMatchObject({ usuarioIds: [10], marcacionId: repo.marcas[0].id, sitioId: 1 });
  });

  it('turno de noche de 12 h: la entrada cercana a medianoche toma el día correcto', async () => {
    HORARIOS = { 1: { turno: '12x12', horaInicio: '20:00', horaFin: '08:00' } };
    ahora = new Date('2026-10-21T01:55:00.000Z'); // 19:55 del 20 en CDMX
    await marcar(10, marca('entrada'));
    expect(repo.marcas[0].programadaEntrada?.toISOString()).toBe('2026-10-21T02:00:00.000Z');
    expect(repo.marcas[0].programadaSalida?.toISOString()).toBe('2026-10-21T14:00:00.000Z');
  });

  it('salida anticipada: más de 10 min antes de la hora programada', async () => {
    HORARIOS = { 1: { turno: '12x12', horaInicio: '07:00', horaFin: '19:00' } };
    await marcar(10, marca('entrada'));
    await marcar(10, marca('inicio_comida'));
    await marcar(10, marca('fin_comida'));
    avanzar(11.5); // 18:30
    expect((await marcar(10, marca('salida'))).body.data.alertas).toEqual(['salida_anticipada']);
    expect(repo.avisos.find((a) => a.tipo === 'marca_alerta')?.mensaje).toBe(
      'Juan Pérez · Salida en Plaza Norte: salió 30 min antes de su hora',
    );
    expect(bitacora).toEqual([
      expect.objectContaining({ tipo: 'salida_anticipada', detalle: 'Salió 30 min antes en Plaza Norte' }),
    ]);
    expect((await mias(10)).body.data[0].salidaAnticipadaMin).toBe(30);
  });

  it('turno del catálogo con horas libres (10 h): la salida programada es entrada + 10 h', async () => {
    HORARIOS = { 1: { horas: 10, horaInicio: '07:00', horaFin: '17:00', dias: { tipo: 'diario' } } };
    await marcar(10, marca('entrada'));
    expect(repo.marcas[0].programadaSalida?.toISOString()).toBe('2026-10-20T23:00:00.000Z');
  });

  it('"No traigo lentes": la marca lleva alerta para el supervisor (DA-44)', async () => {
    const res = await marcar(10, marca('entrada', PLAZA, 15, { sinLentes: true }));
    expect(res.status).toBe(201);
    expect(res.body.data.alertas).toEqual(['sin_lentes_declarado']);
    await marcar(10, marca('inicio_comida'));
    await marcar(10, marca('fin_comida'));
    avanzar(1);
    expect((await marcar(10, marca('salida', PLAZA, 15, { sinLentes: false }))).body.data.alertas).toEqual(
      [],
    );
  });

  it('con dos sitios, la entrada es en el del turno que le toca a esa hora (TC-11)', async () => {
    const HOTEL = { lat: 19.4226, lng: -99.1332 };
    HORARIOS = {
      1: { horas: 12, horaInicio: '07:00', horaFin: '19:00', dias: { tipo: 'diario' } },
      2: { horas: 12, horaInicio: '19:00', horaFin: '07:00', dias: { tipo: 'diario' } },
    };
    // 7:00 a.m.: le toca Plaza Norte; desde el hotel no puede checar ahí.
    const temprano = await marcar(10, marca('entrada', HOTEL));
    expect(temprano.status).toBe(409);
    expect(temprano.body.error.code).toBe('FUERA_DE_RANGO');
    // 7:00 p.m.: le toca el hotel.
    avanzar(12);
    const noche = await marcar(10, marca('entrada', HOTEL));
    expect(noche.status).toBe(201);
    expect(noche.body.data.sitio.nombre).toBe('Hotel Sur');
  });

  it('turno actual (desde 30 min antes) y próximo turno para el guardia (DA-40)', async () => {
    HORARIOS = { 1: { horas: 12, horaInicio: '07:00', horaFin: '19:00', dias: { tipo: 'diario' } } };
    const estado = () => request(app).get('/api/asistencia/estado').set('Authorization', token(10));
    avanzar(-0.25); // 6:45: ya sale "tu turno empieza"
    expect((await estado()).body.data).toMatchObject({
      turnoActual: {
        sitio: { nombre: 'Plaza Norte' },
        entrada: '2026-10-20T13:00:00.000Z',
        salida: '2026-10-21T01:00:00.000Z',
      },
      proximoTurno: null,
    });
    avanzar(13); // 7:45 p.m.: ya terminó; el próximo es mañana a las 7:00
    expect((await estado()).body.data).toMatchObject({
      turnoActual: null,
      proximoTurno: { entrada: '2026-10-21T13:00:00.000Z' },
    });
  });

  it('dos comidas en turnos de 24 h; una en turnos de 12 h (DA-47)', async () => {
    HORARIOS = { 1: { horas: 24, horaInicio: '07:00', horaFin: '07:00', dias: { tipo: 'diario' } } };
    await marcar(10, marca('entrada'));
    for (const tipo of ['inicio_comida', 'fin_comida', 'inicio_comida', 'fin_comida']) {
      avanzar(1);
      expect((await marcar(10, marca(tipo))).status).toBe(201);
    }
    avanzar(1);
    expect((await marcar(10, marca('inicio_comida'))).status).toBe(409);
    const [j] = (await request(app).get('/api/asistencia/mias?mes=2026-10').set('Authorization', token(10)))
      .body.data;
    expect(j).toMatchObject({ comidasPermitidas: 2 });
    expect(j.comidas).toHaveLength(2);
  });

  it('para checar salida hay que iniciar y terminar la comida, aunque sea en segundos (DA-47)', async () => {
    HORARIOS = { 1: { horas: 12, horaInicio: '07:00', horaFin: '19:00', dias: { tipo: 'diario' } } };
    await marcar(10, marca('entrada'));
    // Sin comida: no puede salir; solo puede iniciarla.
    avanzar(1);
    const sinComida = await marcar(10, marca('salida'));
    expect(sinComida.status).toBe(409);
    expect(sinComida.body.error.message).toBe(
      'Debes registrar tus horas de comida antes de checar tu salida.',
    );
    // Con la comida abierta tampoco: debe terminarla.
    await marcar(10, marca('inicio_comida'));
    expect((await marcar(10, marca('salida'))).status).toBe(409);
    const estado = await request(app).get('/api/asistencia/estado').set('Authorization', token(10));
    expect(estado.body.data.permitidas).toEqual(['fin_comida']);
    // Terminada la comida, ya puede salir.
    await marcar(10, marca('fin_comida'));
    expect((await marcar(10, marca('salida'))).status).toBe(201);
  });

  it('turno de 24 h: debe hacer las dos comidas antes de salir (DA-47)', async () => {
    HORARIOS = { 1: { horas: 24, horaInicio: '07:00', horaFin: '07:00', dias: { tipo: 'diario' } } };
    await marcar(10, marca('entrada'));
    await marcar(10, marca('inicio_comida'));
    await marcar(10, marca('fin_comida'));
    // Una de dos: aún no puede salir.
    expect((await marcar(10, marca('salida'))).status).toBe(409);
    await marcar(10, marca('inicio_comida'));
    await marcar(10, marca('fin_comida'));
    expect((await marcar(10, marca('salida'))).status).toBe(201);
  });

  describe('cerrar la jornada de un guardia que no pudo checar su salida (DA-49)', () => {
    const cerrar = (id: number, body: object, usuarioId = 5, rol = 'supervisor') =>
      request(app)
        .post(`/api/asistencia/jornadas/${id}/cerrar`)
        .set('Authorization', token(usuarioId, rol as 'supervisor'))
        .send(body);

    it('el supervisor registra la salida con motivo; queda marcada, en bitácora, y se avisa al guardia', async () => {
      HORARIOS = { 1: { horas: 12, horaInicio: '07:00', horaFin: '19:00', dias: { tipo: 'diario' } } };
      await marcar(10, marca('entrada'));
      const entradaId = repo.marcas[0].id;
      avanzar(14); // ya pasó la hora de salida programada (7 p.m.)

      const res = await cerrar(entradaId, { motivo: 'Se le descompuso el teléfono' });
      expect(res.status).toBe(204);

      const salida = repo.marcas.at(-1)!;
      expect(salida).toMatchObject({
        tipo: 'salida',
        usuarioId: 10,
        entradaId,
        alertas: ['cerrada_por_supervisor'],
      });
      // Sin hora indicada: la salida programada (7:00 p.m. CDMX = 01:00 UTC del día siguiente).
      expect(salida.registradaEn.toISOString()).toBe('2026-10-21T01:00:00.000Z');
      expect(bitacora.at(-1)).toMatchObject({ tipo: 'jornada_cerrada', usuarioIds: [10], actorId: 5 });
      expect(bitacora.at(-1)!.detalle).toContain('Se le descompuso el teléfono');
      expect(audit.acciones()).toContain('asistencia.cerrar_jornada');
      expect(repo.avisos.at(-1)).toMatchObject({ usuarioIds: [10], tipo: 'marca_alerta' });

      // El guardia ya puede checar su siguiente entrada, y no se puede cerrar dos veces.
      const estado = await request(app).get('/api/asistencia/estado').set('Authorization', token(10));
      expect(estado.body.data.permitidas).toEqual(['entrada']);
      expect((await cerrar(entradaId, { motivo: 'Otra vez' })).status).toBe(409);
    });

    it('motivo obligatorio, hora válida y solo admin o supervisor', async () => {
      await marcar(10, marca('entrada'));
      const entradaId = repo.marcas[0].id;
      avanzar(2);
      expect((await cerrar(entradaId, { motivo: '' })).status).toBe(400);
      // Antes de su entrada o en el futuro.
      const antes = await cerrar(entradaId, { motivo: 'Prueba', salidaEn: '2026-10-20T10:00:00.000Z' });
      expect(antes.status).toBe(400);
      expect(antes.body.error.details[0].path).toBe('salidaEn');
      expect(
        (await cerrar(entradaId, { motivo: 'Prueba', salidaEn: '2026-10-22T10:00:00.000Z' })).status,
      ).toBe(400);
      // El guardia no puede cerrarse la jornada solo.
      expect((await cerrar(entradaId, { motivo: 'Prueba' }, 10, 'guardia')).status).toBe(403);
      // Una checada que no es entrada no es una jornada.
      expect((await cerrar(9999, { motivo: 'Prueba' })).status).toBe(404);
      // El admin sí, con la hora indicada.
      const ok = await cerrar(
        entradaId,
        { motivo: 'Cierre por prueba', salidaEn: '2026-10-20T14:30:00.000Z' },
        1,
        'admin',
      );
      expect(ok.status).toBe(204);
      expect(repo.marcas.at(-1)!.registradaEn.toISOString()).toBe('2026-10-20T14:30:00.000Z');
    });
  });

  describe('tablero del día para admin y supervisor (DA-51)', () => {
    const tablero = (id = 5, rol = 'supervisor') =>
      request(app)
        .get('/api/asistencia/tablero')
        .set('Authorization', token(id, rol as 'supervisor'));
    const ORDEN = ['sin_llegar', 'sin_salida', 'comida_abierta'];
    /** [clase, guardia] ordenado por clase y guardia (los empates se ordenan por nombre). */
    const resumen = async () =>
      (await tablero()).body.data.items
        .map((i: { clase: string; fila: { guardia: { id: number } } }) => [i.clase, i.fila.guardia.id])
        .sort(
          (x: [string, number], y: [string, number]) =>
            ORDEN.indexOf(x[0]) - ORDEN.indexOf(y[0]) || x[1] - y[1],
        );

    it('quién no llegó, jornadas que ya debieron cerrarse y comidas sin cierre', async () => {
      HORARIOS = { 1: { horas: 12, horaInicio: '07:00', horaFin: '19:00', dias: { tipo: 'diario' } } };
      // 7:20: Juan (10) y el guardia 13 debían entrar a las 7:00 y no han checado.
      avanzar(20 / 60);
      expect(await resumen()).toEqual([
        ['sin_llegar', 10],
        ['sin_llegar', 13],
      ]);

      // Juan llega: solo falta el 13. Más tarde sale a comer y no regresa en más de 1 h.
      await marcar(10, marca('entrada'));
      expect(await resumen()).toEqual([['sin_llegar', 13]]);
      avanzar(3);
      await marcar(10, marca('inicio_comida'));
      avanzar(0.9);
      expect((await resumen()).filter(([c]: string[]) => c === 'comida_abierta')).toEqual([]);
      avanzar(0.3);
      expect(await resumen()).toEqual([
        ['sin_llegar', 13],
        ['comida_abierta', 10],
      ]);

      // Regresa de comer; pasada su salida programada (7:00 p.m.) más la tolerancia, queda sin cerrar.
      await marcar(10, marca('fin_comida'));
      expect((await resumen()).map(([c]: string[]) => c)).toEqual(['sin_llegar']);
      avanzar(8);
      expect(await resumen()).toEqual([
        ['sin_llegar', 13],
        ['sin_salida', 10],
      ]);

      // Un supervisor le cierra la jornada: ya no aparece.
      await request(app)
        .post(`/api/asistencia/jornadas/${repo.marcas[0].id}/cerrar`)
        .set('Authorization', token(5, 'supervisor'))
        .send({ motivo: 'Se olvidó de checar' });
      expect(await resumen()).toEqual([['sin_llegar', 13]]);
    });

    it('solo admin y supervisor; el guardia no', async () => {
      expect((await tablero(10, 'guardia')).status).toBe(403);
      expect((await tablero(1, 'admin')).status).toBe(200);
    });
  });

  it('turno de 12 h: solo una comida', async () => {
    HORARIOS = { 1: { horas: 12, horaInicio: '07:00', horaFin: '19:00', dias: { tipo: 'diario' } } };
    await marcar(10, marca('entrada'));
    avanzar(1);
    await marcar(10, marca('inicio_comida'));
    avanzar(1);
    await marcar(10, marca('fin_comida'));
    avanzar(1);
    expect((await marcar(10, marca('inicio_comida'))).status).toBe(409);
  });

  it('sin horario en la asignación no hay programada ni retardo', async () => {
    avanzar(5);
    await marcar(10, marca('entrada'));
    expect(repo.marcas[0].programadaEntrada).toBeNull();
    expect((await mias(10)).body.data[0]).toMatchObject({ programada: null, retardoMin: null });
  });

  it('"rostro pendiente" se muestra según su estado actual (AS1-14)', async () => {
    await autoregistrar(11, ROSA);
    await marcar(11, marca('entrada'), { descriptor: vector(0.505) });
    expect((await mias(11)).body.data[0].alertas).toContain('rostro_pendiente');

    await revisar(11, 'aprobar');
    const [aprobada] = (await mias(11)).body.data;
    expect(aprobada.alertas).not.toContain('rostro_pendiente');
    expect(aprobada.entrada.rostroAprobadoEn).toBe(ahora.toISOString());
  });

  it('si el rostro con el que marcó se rechaza, la alerta pasa a "rostro rechazado"', async () => {
    await autoregistrar(11, ROSA);
    await marcar(11, marca('entrada'), { descriptor: vector(0.505) });
    await revisar(11, 'rechazar', 'No es la persona');
    const [j] = (await mias(11)).body.data;
    expect(j.alertas).toContain('rostro_rechazado');
    expect(j.alertas).not.toContain('rostro_pendiente');
  });
});

describe('asistencia: avisos con lógica, por umbral o por patrón (DA-33)', () => {
  const avisos = (tipo: string) => repo.avisos.filter((a) => a.tipo === tipo).map((a) => a.mensaje);
  /** Un turno de 12 h (07:00 a 19:00): entra `tarde` min después y sale `antes` min antes. */
  async function turno(tarde: number, antes: number) {
    const inicio = new Date(ahora);
    ahora = new Date(inicio.getTime() + tarde * 60_000);
    await marcar(10, marca('entrada'));
    ahora = new Date(inicio.getTime() + 6 * 3_600_000);
    await marcar(10, marca('inicio_comida'));
    ahora = new Date(inicio.getTime() + 7 * 3_600_000);
    await marcar(10, marca('fin_comida'));
    ahora = new Date(inicio.getTime() + (12 * 60 - antes) * 60_000);
    await marcar(10, marca('salida'));
    ahora = new Date(inicio.getTime() + 24 * 3_600_000); // mismo horario al día siguiente
  }

  beforeEach(() => {
    HORARIOS = { 1: { turno: '12x12', horaInicio: '07:00', horaFin: '19:00' } };
  });

  it('salir 10 min antes avisa; salir pocos minutos antes no', async () => {
    await turno(0, 5);
    expect(avisos('marca_alerta')).toEqual([]);
    await turno(0, 10);
    expect(avisos('marca_alerta')).toEqual([
      'Juan Pérez · Salida en Plaza Norte: salió 10 min antes de su hora',
    ]);
  });

  it('3 turnos seguidos saliendo al menos 3 min antes: un solo aviso de patrón', async () => {
    await turno(0, 4);
    await turno(0, 2); // rompe la racha
    await turno(0, 3);
    await turno(0, 5);
    expect(avisos('marca_alerta')).toEqual([]);
    await turno(0, 4);
    expect(avisos('marca_alerta')).toEqual([
      'Juan Pérez · Plaza Norte: lleva 3 turnos seguidos saliendo antes de su hora (−3 min, −5 min, −4 min)',
    ]);
    await turno(0, 6); // misma racha: no se repite
    expect(avisos('marca_alerta')).toHaveLength(1);
  });

  it('3 retardos seguidos, aunque sean menores: aviso de patrón (reemplaza al individual)', async () => {
    await turno(12, 0);
    await turno(13, 0);
    expect(avisos('retardo')).toEqual([]);
    await turno(20, 0);
    expect(avisos('retardo')).toEqual([
      'Juan Pérez · Plaza Norte: lleva 3 turnos seguidos llegando tarde (+12 min, +13 min, +20 min)',
    ]);
  });
});

describe('asistencia: marcas hechas sin conexión (AS2-02, AS2-04)', () => {
  const hora = (min: number) => new Date(ahora.getTime() + min * 60_000).toISOString();

  it('la marca entra con la hora que estimó el celular y queda marcada "sin conexión"', async () => {
    ahora = new Date('2026-10-20T14:30:00.000Z'); // llega 90 min después de lo que checó
    const capturada = hora(-90);
    const res = await marcar(10, marca('entrada', PLAZA, 15, { capturadaEn: capturada, horaCelular: capturada }));
    expect(res.status).toBe(201);
    expect(res.body.data.registradaEn).toBe(capturada);
    expect(res.body.data.alertas).toContain('enviada_sin_conexion');
    expect(res.body.data.alertas).not.toContain('hora_desfasada');
    expect(repo.marcas[0]).toMatchObject({ recibidaEn: ahora, desfaseSeg: 0 });
  });

  it('no acepta una hora en el futuro: usa la de recepción', async () => {
    const futura = hora(60);
    const res = await marcar(10, marca('entrada', PLAZA, 15, { capturadaEn: futura }));
    expect(res.body.data.registradaEn).toBe(ahora.toISOString());
  });

  it('si el reloj del celular no coincide con el corregido, alerta de hora desfasada', async () => {
    const res = await marcar(
      10,
      marca('entrada', PLAZA, 15, { capturadaEn: hora(-10), horaCelular: hora(-10 + 60) }),
    );
    expect(res.body.data.alertas).toEqual(expect.arrayContaining(['enviada_sin_conexion', 'hora_desfasada']));
    expect((repo.marcas[0] as unknown as { desfaseSeg: number }).desfaseSeg).toBe(3600);
  });

  it('en línea, un reloj desfasado también se alerta', async () => {
    const res = await marcar(10, marca('entrada', PLAZA, 15, { horaCelular: hora(-30) }));
    expect(res.body.data.alertas).toEqual(['hora_desfasada']);
  });

  it('más de 72 h para llegar: se marca como sospechosa', async () => {
    const res = await marcar(10, marca('entrada', PLAZA, 15, { capturadaEn: hora(-73 * 60) }));
    expect(res.body.data.alertas).toContain('hora_desfasada');
  });

  it('sin conexión, estar lejos o con GPS débil se registra con alerta en vez de rechazarse', async () => {
    const lejos = { lat: PLAZA.lat + 0.002, lng: PLAZA.lng };
    const res = await marcar(10, marca('entrada', lejos, 250, { capturadaEn: hora(-5) }));
    expect(res.status).toBe(201);
    expect(res.body.data.alertas).toEqual(
      expect.arrayContaining(['enviada_sin_conexion', 'fuera_de_rango', 'gps_impreciso']),
    );
  });

  it('sin conexión, un rostro que no coincide se registra con alerta (y en línea se rechaza)', async () => {
    const otro = CARA_DE[11] ?? CARA_DE[10].map((x) => x + 1);
    const enLinea = await marcar(10, marca('entrada'), { descriptor: otro });
    expect(enLinea.status).toBeGreaterThanOrEqual(409);
    const sinConexion = await marcar(10, marca('entrada', PLAZA, 15, { capturadaEn: hora(-5) }), {
      descriptor: otro,
    });
    expect(sinConexion.status).toBe(201);
    expect(sinConexion.body.data.alertas).toContain('rostro_no_coincide');
  });

  it('reenviar la misma marca no la duplica', async () => {
    const b = marca('entrada', PLAZA, 15, { capturadaEn: hora(-5) });
    await marcar(10, b);
    const otra = await marcar(10, b);
    expect(otra.status).toBe(201);
    expect(repo.marcas).toHaveLength(1);
  });
});
