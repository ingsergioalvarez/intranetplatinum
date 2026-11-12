import { describe, expect, it, beforeEach } from 'vitest';
import { PassThrough } from 'node:stream';
import {
  PERMISOS_POR_ROL,
  ROLES,
  TRANSICIONES_ESTATUS,
  type EstatusReporte,
  type Paginated,
  type PaginationQuery,
  type ReporteResumen,
  type Rol,
} from '@platinum/shared';
import {
  HttpError,
  StorageService,
  claveValida,
  detectarImagen,
  firmarArchivo,
  inicioDelDia,
  verificarFirma,
  type AuthUser,
} from '../src/core';
import { armarArbol } from '../src/modules/categorias/categorias.service';
import {
  ReportesRepository,
  type FotoNueva,
  type NuevoSeguimiento,
  type ReporteDetalleRow,
  type ReporteFiltroData,
  type RestriccionSitio,
  type Visibilidad,
  whereVisibilidad,
} from '../src/modules/reportes/reportes.repository';
import { ReportesService } from '../src/modules/reportes/reportes.service';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(10)]);
const HEIC = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic'), Buffer.alloc(10)]);

describe('utilidades de archivos', () => {
  it('detecta imágenes por firma de bytes, no por el tipo declarado', () => {
    expect(detectarImagen(JPEG)).toBe('image/jpeg');
    expect(detectarImagen(PNG)).toBe('image/png');
    expect(detectarImagen(WEBP)).toBe('image/webp');
    expect(detectarImagen(HEIC)).toBe('image/heic');
    expect(detectarImagen(Buffer.from('<?php echo "hola"; ?> texto'))).toBeNull();
    expect(detectarImagen(Buffer.from('GIF89a......'))).toBeNull();
  });

  it('firma enlaces que caducan y no se pueden alterar', () => {
    const ahora = Date.UTC(2026, 9, 13, 12);
    const url = firmarArchivo('reportes/2026/10/abc-123.jpg', 60, ahora);
    const { searchParams } = new URL(url, 'http://x');
    const exp = Number(searchParams.get('exp'));
    const sig = searchParams.get('sig')!;
    expect(verificarFirma('reportes/2026/10/abc-123.jpg', exp, sig, ahora)).toBe(true);
    expect(verificarFirma('reportes/2026/10/otra-999.jpg', exp, sig, ahora)).toBe(false);
    expect(verificarFirma('reportes/2026/10/abc-123.jpg', exp + 1, sig, ahora)).toBe(false);
    expect(verificarFirma('reportes/2026/10/abc-123.jpg', exp, sig, ahora + 61 * 60_000)).toBe(false);
  });

  it('solo acepta claves de archivo seguras', () => {
    expect(claveValida('reportes/2026/10/0f8e-1a2b.jpg')).toBe(true);
    expect(claveValida('../etc/passwd')).toBe(false);
    expect(claveValida('reportes/../../secreto.jpg')).toBe(false);
    expect(claveValida('/absoluta/abc.jpg')).toBe(false);
  });

  it('inicio del día en la zona del negocio', () => {
    // CDMX es UTC-6: el día 13 empieza a las 06:00 UTC.
    expect(inicioDelDia('2026-10-13', 'America/Mexico_City').toISOString()).toBe('2026-10-13T06:00:00.000Z');
    expect(inicioDelDia('2026-10-13', 'UTC').toISOString()).toBe('2026-10-13T00:00:00.000Z');
  });
});

describe('categorías', () => {
  it('arma el árbol de 2 niveles y omite huérfanas', () => {
    const c = (id: number, padreId: number | null) => ({
      id,
      padreId,
      nombre: `C${id}`,
      icono: null,
      orden: 0,
      activo: true,
    });
    const arbol = armarArbol([c(1, null), c(2, 1), c(3, 1), c(4, null), c(5, 99)]);
    expect(arbol.map((n) => [n.id, n.hijas.map((h) => h.id)])).toEqual([
      [1, [2, 3]],
      [4, []],
    ]);
  });

  it('las transiciones nunca vuelven a "abierto" ni ponen "notificado" a mano', () => {
    for (const destinos of Object.values(TRANSICIONES_ESTATUS)) {
      expect(destinos).not.toContain('abierto');
      expect(destinos).not.toContain('notificado');
    }
  });
});

// ---------- Servicio de reportes con dobles ----------
class MemoryStorage extends StorageService {
  archivos = new Map<string, Buffer>();
  async guardar(contenido: Buffer, mime: string, carpeta: string) {
    const clave = this.nuevaClave(carpeta, mime);
    this.archivos.set(clave, contenido);
    return clave;
  }
  async leer(clave: string) {
    const b = this.archivos.get(clave);
    return b ? { stream: new PassThrough().end(b) as unknown as PassThrough, tamano: b.length } : null;
  }
  async eliminar(clave: string) {
    this.archivos.delete(clave);
  }
}

class MemoryReportesRepository extends ReportesRepository {
  falla = false;
  estatus: EstatusReporte = 'abierto';
  creados: FotoNueva[][] = [];
  seguimientos: NuevoSeguimiento[] = [];
  visibleParaGuardia = true;
  /** Admin dueño del cliente del reporte (A-66). */
  duenoDelCliente = 7;
  /** Seguimientos que devuelve el detalle (con el rol de quien escribió cada uno). */
  seguimientosDetalle: ReporteDetalleRow['seguimientos'] = [];

  async crear(_d: unknown, fotos: FotoNueva[]) {
    if (this.falla) throw new Error('BD caída');
    this.creados.push(fotos);
    return { id: 1, folio: 'PLT-2026-000001' };
  }
  override async findPaged(
    _filtro: ReporteFiltroData,
    _visibilidad: Visibilidad,
    _pag: PaginationQuery,
  ): Promise<Paginated<ReporteResumen>> {
    return { items: [], total: 0, page: 1, limit: 20 };
  }
  async findDetalle(): Promise<ReporteDetalleRow> {
    return {
      id: 1,
      folio: 'PLT-2026-000001',
      titulo: 'Lámpara',
      prioridad: 'alta',
      estatus: this.estatus,
      createdAt: new Date().toISOString(),
      cerradoEn: null,
      sitio: { id: 1, nombre: 'Acceso' },
      cliente: { id: 1, nombreComercial: 'Plaza' },
      categoria: { id: 2, nombre: 'Lámpara fundida', padre: 'Iluminación' },
      creadoPor: { id: 3, nombre: 'Gabriel' },
      creadoPorRol: ROLES.SUPERVISOR,
      totalFotos: 1,
      descripcion: 'No enciende',
      ubicacionDetalle: null,
      lat: null,
      lng: null,
      evidencias: [
        {
          id: 1,
          archivo: 'reportes/2026/10/aa-11.jpg',
          mime: 'image/jpeg',
          tamano: 10,
          createdAt: new Date(),
          subidaPor: { id: 3, nombre: 'G' },
        },
      ],
      seguimientos: this.seguimientosDetalle,
    };
  }
  async puedeVer(_id: number, v: Visibilidad) {
    return (
      v.tipo === 'todos' ||
      (v.tipo === 'guardia' && this.visibleParaGuardia) ||
      (v.tipo === 'cliente' && v.clienteId === 1) ||
      (v.tipo === 'cartera' && v.propietarioId === this.duenoDelCliente)
    );
  }
  async agregarSeguimiento(_id: number, s: NuevoSeguimiento) {
    if (this.falla) throw new Error('BD caída');
    this.seguimientos.push(s);
    return 1;
  }
  async sitioParaReportar(_id: number, filtro: RestriccionSitio) {
    return filtro?.tipo === 'guardia' && filtro.usuarioId === 99 ? null : { id: 1, clienteId: 1 };
  }
  async sitiosReportables() {
    return [];
  }
  async categoriaActiva(id: number) {
    return id !== 404;
  }
}

const usuario = (id: number, rol: Rol, extra: Partial<AuthUser> = {}): AuthUser => ({
  id,
  email: `u${id}@x`,
  rol,
  permisos: PERMISOS_POR_ROL[rol],
  ...extra,
});
const GUARDIA = usuario(3, ROLES.GUARDIA);
/** El supervisor de estas pruebas es del admin 7, dueño del cliente de los reportes. */
const SUPERVISOR = usuario(2, ROLES.SUPERVISOR, { propietarioId: 7 });
const SUPER_ADMIN = usuario(1, ROLES.ADMIN, { esSuperAdmin: true });
const CLIENTE: AuthUser = { ...usuario(5, ROLES.CLIENTE), clienteId: 1 };
const datos = {
  sitioId: 1,
  categoriaId: 2,
  prioridad: 'alta' as const,
  titulo: 'Lámpara fundida',
  descripcion: 'No enciende desde anoche',
};
const foto = (b = JPEG) => ({ buffer: b, size: b.length });

let repo: MemoryReportesRepository;
let storage: MemoryStorage;
let service: ReportesService;

beforeEach(() => {
  repo = new MemoryReportesRepository();
  storage = new MemoryStorage();
  service = new ReportesService(repo, storage, () => '2026-10-13');
});

const codigo = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'OK';
  } catch (e) {
    return e instanceof HttpError ? `${e.status}` : 'ERROR';
  }
};

describe('alta de reporte', () => {
  it('exige fotos válidas, categoría activa y sitio asignado', async () => {
    expect(await codigo(service.crear(GUARDIA, datos, []))).toBe('400');
    expect(await codigo(service.crear(GUARDIA, datos, [foto(Buffer.from('texto plano no imagen'))]))).toBe(
      '400',
    );
    expect(await codigo(service.crear(GUARDIA, { ...datos, categoriaId: 404 }, [foto()]))).toBe('400');
    expect(await codigo(service.crear(usuario(99, ROLES.GUARDIA), datos, [foto()]))).toBe('400');
    expect(storage.archivos.size).toBe(0);
  });

  it('guarda las fotos y devuelve el detalle con URLs firmadas', async () => {
    const r = await service.crear(GUARDIA, datos, [foto(), foto(PNG)]);
    expect(r.folio).toBe('PLT-2026-000001');
    expect(r.evidencias[0].url).toMatch(/^\/api\/archivos\/reportes\/.*\?exp=\d+&sig=/);
    expect(repo.creados[0].map((f) => f.mime)).toEqual(['image/jpeg', 'image/png']);
    expect(storage.archivos.size).toBe(2);
  });

  it('si falla la BD, borra las fotos ya guardadas', async () => {
    repo.falla = true;
    expect(await codigo(service.crear(GUARDIA, datos, [foto(), foto()]))).toBe('ERROR');
    expect(storage.archivos.size).toBe(0);
  });
});

describe('visibilidad y seguimiento', () => {
  it('guardia sin acceso al sitio y cliente de otra empresa reciben 404', async () => {
    repo.visibleParaGuardia = false;
    const OTRO_CLIENTE: AuthUser = { ...usuario(6, ROLES.CLIENTE), clienteId: 99 };
    expect(await codigo(service.detalle(GUARDIA, 1))).toBe('404');
    expect(await codigo(service.detalle(OTRO_CLIENTE, 1))).toBe('404');
    expect(await codigo(service.detalle(CLIENTE, 1))).toBe('OK');
    expect(await codigo(service.detalle(SUPERVISOR, 1))).toBe('OK');
  });

  it('acciones según rol', async () => {
    expect((await service.detalle(GUARDIA, 1)).acciones).toEqual({ comentar: true, estatusPermitidos: [] });
    expect((await service.detalle(SUPERVISOR, 1)).acciones.estatusPermitidos).toEqual(
      TRANSICIONES_ESTATUS.abierto,
    );
  });

  it('guardia comenta; solo supervisor cambia estatus y con transición válida', async () => {
    expect(await codigo(service.agregarSeguimiento(GUARDIA, 1, {}, []))).toBe('400');
    expect(
      await codigo(service.agregarSeguimiento(GUARDIA, 1, { comentario: 'Sigue igual' }, [foto()])),
    ).toBe('OK');
    expect(await codigo(service.agregarSeguimiento(GUARDIA, 1, { estatus: 'en_proceso' }, []))).toBe('403');
    expect(await codigo(service.agregarSeguimiento(SUPERVISOR, 1, { estatus: 'notificado' }, []))).toBe(
      '400',
    );
    expect(await codigo(service.agregarSeguimiento(SUPERVISOR, 1, { estatus: 'en_proceso' }, []))).toBe('OK');
    expect(repo.seguimientos.at(-1)).toMatchObject({
      estatusAnterior: 'abierto',
      estatusNuevo: 'en_proceso',
    });
  });

  it('el cliente comenta con hasta 5 fotos; guardia y supervisor, hasta 10 (A-67)', async () => {
    const fotos = (n: number) => Array.from({ length: n }, () => foto());
    expect(await codigo(service.agregarSeguimiento(CLIENTE, 1, { comentario: 'Más evidencia' }, fotos(5)))).toBe('OK');
    expect(await codigo(service.agregarSeguimiento(CLIENTE, 1, { comentario: 'Demasiadas' }, fotos(6)))).toBe('400');
    expect(await codigo(service.agregarSeguimiento(GUARDIA, 1, { comentario: 'Diez' }, fotos(10)))).toBe('OK');
    expect(await codigo(service.agregarSeguimiento(GUARDIA, 1, { comentario: 'Once' }, fotos(11)))).toBe('400');
    expect(await codigo(service.agregarSeguimiento(SUPERVISOR, 1, { comentario: 'Diez' }, fotos(10)))).toBe('OK');
  });

  it('mismo estatus actual no cuenta como cambio', async () => {
    await service.agregarSeguimiento(SUPERVISOR, 1, { estatus: 'abierto', comentario: 'Revisado' }, []);
    expect(repo.seguimientos.at(-1)).toMatchObject({ estatusAnterior: null, estatusNuevo: null });
  });

  it('permite filtrar por creadoPorId', async () => {
    let capturado: ReporteFiltroData | null = null;
    repo.findPaged = async (f: ReporteFiltroData) => {
      capturado = f;
      return { items: [], total: 0, page: 1, limit: 20 };
    };
    await service.list(SUPERVISOR, { page: 1, limit: 20, creadoPorId: 5 });
    expect(capturado).toMatchObject({ creadoPorId: 5 });
  });

  it('el detalle dice el rol de quien levantó el reporte y de quien escribió cada comentario', async () => {
    repo.seguimientosDetalle = [
      {
        id: 1,
        usuario: { id: 5, nombre: 'Cliente Uno', rol: ROLES.CLIENTE },
        comentario: 'Se ve peor en la noche',
        estatusAnterior: null,
        estatusNuevo: null,
        createdAt: new Date('2026-10-13T10:00:00Z'),
        evidencias: [],
      },
      {
        id: 2,
        usuario: { id: 2, nombre: 'Sara', rol: ROLES.SUPERVISOR },
        comentario: 'Ya lo atiendo',
        estatusAnterior: 'abierto',
        estatusNuevo: 'en_proceso',
        createdAt: new Date('2026-10-13T11:00:00Z'),
        evidencias: [],
      },
    ];
    const d = await service.detalle(CLIENTE, 1);
    expect(d.creadoPorRol).toBe(ROLES.SUPERVISOR);
    expect(d.seguimientos.map((s) => s.usuario.rol)).toEqual([ROLES.CLIENTE, ROLES.SUPERVISOR]);
  });

  it('el cliente, sin pedir "solo los míos", ve la lista de los reportes de su empresa y de ninguna otra', async () => {
    let filtroCapturado: ReporteFiltroData | null = null;
    let visibilidadCapturada: unknown = null;
    repo.findPaged = async (f: ReporteFiltroData, v: unknown) => {
      filtroCapturado = f;
      visibilidadCapturada = v;
      return { items: [], total: 0, page: 1, limit: 20 };
    };
    await service.list(CLIENTE, { page: 1, limit: 20 });
    expect(visibilidadCapturada).toEqual({ tipo: 'cliente', clienteId: 1 });
    expect(filtroCapturado).not.toHaveProperty('creadoPorId');
  });

  it('el cliente puede ver los reportes de su empresa y comentar en seguimiento', async () => {
    // El cliente puede consultar el detalle de su reporte
    const detalle = await service.detalle(CLIENTE, 1);
    expect(detalle.folio).toBe('PLT-2026-000001');
    expect(detalle.acciones.comentar).toBe(true);
    expect(detalle.acciones.estatusPermitidos).toEqual([]);

    // El cliente puede agregar un comentario de seguimiento
    await service.agregarSeguimiento(CLIENTE, 1, { comentario: 'Confirmamos que ya quedó atendido' }, []);
    expect(repo.seguimientos.at(-1)).toMatchObject({
      usuarioId: CLIENTE.id,
      comentario: 'Confirmamos que ya quedó atendido',
      estatusNuevo: null,
    });

    // El cliente no tiene permiso para cambiar estatus (403)
    expect(await codigo(service.agregarSeguimiento(CLIENTE, 1, { estatus: 'cerrado' }, []))).toBe('403');
  });
});

describe('reportes: cada admin ve los de su cartera (A-66)', () => {
  const adminDe = (id: number) => usuario(id, ROLES.ADMIN);

  it('el admin dueño del cliente y su supervisor ven el reporte; otro admin, no; el super admin sí', async () => {
    expect(await codigo(service.detalle(adminDe(7), 1))).toBe('OK');
    expect(await codigo(service.detalle(SUPERVISOR, 1))).toBe('OK');
    expect(await codigo(service.detalle(adminDe(8), 1))).toBe('404');
    expect(await codigo(service.detalle(usuario(3, ROLES.SUPERVISOR, { propietarioId: 8 }), 1))).toBe('404');
    expect(await codigo(service.detalle(SUPER_ADMIN, 1))).toBe('OK');
  });

  it('la lista se acota al dueño del cliente; el super admin no tiene límite', async () => {
    const visibilidades: unknown[] = [];
    repo.findPaged = async (_f: ReporteFiltroData, v: Visibilidad) => {
      visibilidades.push(v);
      return { items: [], total: 0, page: 1, limit: 20 };
    };
    await service.list(adminDe(7), { page: 1, limit: 20 });
    await service.list(SUPERVISOR, { page: 1, limit: 20 });
    await service.list(SUPER_ADMIN, { page: 1, limit: 20 });
    expect(visibilidades).toEqual([
      { tipo: 'cartera', propietarioId: 7 },
      { tipo: 'cartera', propietarioId: 7 },
      { tipo: 'todos' },
    ]);
  });

  it('un admin solo puede reportar en sitios de sus clientes', async () => {
    const restricciones: unknown[] = [];
    repo.sitioParaReportar = async (_id: number, f: RestriccionSitio) => {
      restricciones.push(f);
      return { id: 1, clienteId: 1 };
    };
    await service.crear(adminDe(7), datos, [foto()]);
    await service.crear(SUPER_ADMIN, datos, [foto()]);
    expect(restricciones).toEqual([{ tipo: 'cartera', propietarioId: 7 }, null]);
  });
});

describe('reportes del C2 (A-80)', () => {
  const C2 = usuario(90, ROLES.C2);
  const eventos: Parameters<NonNullable<ConstructorParameters<typeof ReportesService>[4]>>[0][] = [];

  it('puede reportar sobre cualquier sitio (sin límite de asignación) y ve solo los que levantó', async () => {
    const vistas: unknown[] = [];
    const restricciones: unknown[] = [];
    repo.puedeVer = async (_id, v) => (vistas.push(v), true);
    repo.sitioParaReportar = async (_id, filtro) => (restricciones.push(filtro), { id: 7, clienteId: 1 });
    const svc = new ReportesService(repo, storage, () => '2026-10-13', undefined, async (e) => void eventos.push(e));
    const r = await svc.crear(C2, { ...datos, sitioId: 7 }, [foto()]);
    expect(r.id).toBe(1);
    expect(restricciones).toEqual([null]);
    expect(vistas.at(-1)).toEqual({ tipo: 'propios', usuarioId: 90 });
  });

  it('el reporte queda en la bitácora del C2 con quién lo levantó; el de un guardia no', async () => {
    eventos.length = 0;
    repo.puedeVer = async () => true;
    const svc = new ReportesService(repo, storage, () => '2026-10-13', undefined, async (e) => void eventos.push(e));
    await svc.crear(C2, { ...datos, sitioId: 7 }, [foto()]);
    expect(eventos).toEqual([
      {
        tipo: 'reporte',
        sitioId: 7,
        detalle: 'PLT-2026-000001 · Lámpara fundida',
        usuarioId: 90,
        entidad: { tipo: 'reporte', id: 1 },
      },
    ]);
    eventos.length = 0;
    await svc.crear(GUARDIA, datos, [foto()]);
    expect(eventos).toEqual([]);
  });

  it('el C2 necesita poder ver sus reportes: sin ese permiso no ve ninguno', async () => {
    const vistas: unknown[] = [];
    repo.puedeVer = async (_id, v) => (vistas.push(v), false);
    const sinPermiso = { ...C2, permisos: [] };
    await codigo(service.detalle(sinPermiso, 1));
    expect(vistas.at(-1)).toEqual({ tipo: 'ninguno' });
  });

  it('el cliente y los guardias no ven los reportes que levanta el C2; supervisor y admin, sí', () => {
    const sinC2 = { creadoPor: { rol: { clave: { not: ROLES.C2 } } } };
    expect(whereVisibilidad({ tipo: 'cliente', clienteId: 1 })).toEqual({ clienteId: 1, ...sinC2 });
    expect(whereVisibilidad({ tipo: 'guardia', usuarioId: 3, hoy: '2026-10-13' })).toMatchObject(sinC2);
    expect(whereVisibilidad({ tipo: 'todos' })).toEqual({});
    expect(whereVisibilidad({ tipo: 'cartera', propietarioId: 7 })).toEqual({ cliente: { propietarioId: 7 } });
    expect(whereVisibilidad({ tipo: 'propios', usuarioId: 90 })).toEqual({ creadoPorId: 90 });
  });
});
