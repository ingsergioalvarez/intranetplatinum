import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  PERMISOS_POR_ROL,
  ROLES,
  type EmpresaAdministrador,
  type EmpresaCreate,
  type EmpresaFiltro,
  type Rol,
} from '@platinum/shared';
import { createApp } from '../src/app';
import { StorageService, signAccessToken } from '../src/core';
import { createPlataformaModule } from '../src/modules/plataforma';
import {
  PlataformaRepository,
  type AdministradorNuevo,
  type EmpresaConConteos,
  type EmpresaFila,
} from '../src/modules/plataforma/plataforma.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

// ---------- Dobles en memoria ----------
const base = (id: number, nombre: string): EmpresaFila => ({
  id,
  nombre,
  razonSocial: null,
  rfc: null,
  calle: null,
  calle2: null,
  codigoPostal: null,
  ciudad: null,
  estado: null,
  pais: null,
  telefono: null,
  email: null,
  sitioWeb: null,
  zonaHoraria: 'America/Mexico_City',
  moneda: 'MXN',
  colorModo: 'defecto',
  colorPrincipal: null,
  colorAcento: null,
  logoClave: null,
  activa: true,
  createdAt: new Date('2026-11-04T10:00:00Z'),
  updatedAt: new Date('2026-11-04T10:00:00Z'),
});

class Memoria extends PlataformaRepository {
  empresas: EmpresaFila[] = [base(1, 'Comunicalo')];
  modulos = new Map<number, Map<string, boolean>>();
  admins: (EmpresaAdministrador & { empresaId: number; passwordHash?: string })[] = [
    {
      id: 1,
      empresaId: 1,
      nombre: 'Super Ada',
      email: 'ada@comunicalo.mx',
      telefono: null,
      activo: true,
      esSuperAdmin: true,
      ultimoAcceso: null,
    },
  ];
  /** A qué empresa pertenece cada usuario de prueba. */
  pertenece: Record<number, number | null> = { 1: 1, 2: 1 };
  siguiente = 10;

  async list({ q, estado }: EmpresaFiltro): Promise<EmpresaConConteos[]> {
    return this.empresas
      .filter((e) => (estado === 'activas' ? e.activa : estado === 'inactivas' ? !e.activa : true))
      .filter((e) => !q || e.nombre.toLowerCase().includes(q.toLowerCase()))
      .map((e) => ({
        ...e,
        modulosActivos: [...(this.modulos.get(e.id)?.values() ?? [])].filter(Boolean).length,
        administradores: this.admins.filter((a) => a.empresaId === e.id && a.activo).length,
      }));
  }
  async findById(id: number) {
    // Copia, como hace la base real: lo leído no cambia cuando luego se actualiza.
    const e = this.empresas.find((x) => x.id === id);
    return e ? { ...e } : null;
  }
  async create(data: EmpresaCreate) {
    const fila: EmpresaFila = { ...base(this.siguiente++, data.nombre), ...(data as Partial<EmpresaFila>), moneda: data.moneda ?? 'MXN' };
    this.empresas.push(fila);
    return fila;
  }
  async update(id: number, data: Partial<EmpresaFila>) {
    const fila = this.empresas.find((e) => e.id === id)!;
    Object.assign(fila, data);
    return fila;
  }
  async modulosEncendidos(id: number) {
    return [...(this.modulos.get(id) ?? [])].filter(([, v]) => v).map(([k]) => k);
  }
  async guardarModulos(id: number, estado: Record<string, boolean>) {
    const m = this.modulos.get(id) ?? new Map();
    for (const [k, v] of Object.entries(estado)) m.set(k, v);
    this.modulos.set(id, m);
  }
  async administradores(id: number) {
    return this.admins.filter((a) => a.empresaId === id).map(({ empresaId: _e, passwordHash: _p, ...a }) => a);
  }
  async emailExiste(email: string) {
    return this.admins.some((a) => a.email === email);
  }
  async crearAdministrador({ empresaId, nombre, email, telefono, passwordHash }: AdministradorNuevo) {
    const a = {
      id: this.siguiente++,
      empresaId,
      nombre,
      email,
      telefono,
      activo: true,
      esSuperAdmin: false,
      ultimoAcceso: null,
      passwordHash,
    };
    this.admins.push(a);
    const { empresaId: _e, passwordHash: _p, ...pub } = a;
    return pub;
  }
  async empresaDe(usuarioId: number) {
    return this.pertenece[usuarioId] ?? null;
  }
}

class AlmacenMemoria extends StorageService {
  archivos = new Map<string, { contenido: Buffer; mime: string }>();
  async guardar(contenido: Buffer, mime: string, carpeta: string) {
    const clave = this.nuevaClave(carpeta, mime);
    this.archivos.set(clave, { contenido, mime });
    return clave;
  }
  async leer() {
    return null;
  }
  async eliminar(clave: string) {
    this.archivos.delete(clave);
  }
}

// ---------- Utilidades ----------
const token = (id: number, rol: Rol, extra: { esSuperAdmin?: boolean } = {}) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol], ...extra })}`;
const SUPER = token(1, ROLES.ADMIN, { esSuperAdmin: true });
const ADMIN = token(3, ROLES.ADMIN);
const GUARDIA = token(4, ROLES.COLABORADOR);

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const SVG_OK = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#0b3263"/></svg>');
const SVG_SCRIPT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const SVG_EVENTO = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect onload="x()" width="1" height="1"/></svg>');
const SVG_EXTERNO = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>');

let repo: Memoria;
let audit: MemoryAuditLogger;
let almacen: AlmacenMemoria;
let app: ReturnType<typeof createApp>;

const api = (t = SUPER) => ({
  get: (u: string) => request(app).get(`/api/plataforma${u}`).set('Authorization', t),
  post: (u: string, b: object = {}) => request(app).post(`/api/plataforma${u}`).set('Authorization', t).send(b),
  patch: (u: string, b: object = {}) => request(app).patch(`/api/plataforma${u}`).set('Authorization', t).send(b),
  put: (u: string, b: object = {}) => request(app).put(`/api/plataforma${u}`).set('Authorization', t).send(b),
  del: (u: string) => request(app).delete(`/api/plataforma${u}`).set('Authorization', t),
});

const nuevaEmpresa = async (nombre = 'Acme') =>
  (await api().post('/empresas', { nombre, zonaHoraria: 'America/Mexico_City' })).body.data as { id: number };

beforeEach(() => {
  repo = new Memoria();
  audit = new MemoryAuditLogger();
  almacen = new AlmacenMemoria();
  app = createApp([createPlataformaModule({ repo, audit, storage: almacen })]);
});

describe('acceso', () => {
  it('pide sesión', async () => {
    expect((await request(app).get('/api/plataforma/empresas')).status).toBe(401);
  });

  it('solo el super admin entra: ni un admin de empresa ni un guardia', async () => {
    expect((await api(ADMIN).get('/empresas')).status).toBe(403);
    expect((await api(GUARDIA).get('/empresas')).status).toBe(403);
    expect((await api(SUPER).get('/empresas')).status).toBe(200);
  });
});

describe('empresas', () => {
  it('se crea con solo nombre y zona horaria, y la moneda queda en MXN', async () => {
    const r = await api().post('/empresas', { nombre: 'Acme', zonaHoraria: 'America/Cancun' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ nombre: 'Acme', zonaHoraria: 'America/Cancun', moneda: 'MXN', activa: true, logoUrl: null });
    expect(audit.acciones()).toContain('plataforma.empresa_crear');
  });

  it('rechaza una empresa sin zona horaria o con zona inválida', async () => {
    expect((await api().post('/empresas', { nombre: 'Acme' })).status).toBe(400);
    expect((await api().post('/empresas', { nombre: 'Acme', zonaHoraria: 'Marte/Olimpo' })).status).toBe(400);
  });

  it('la lista marca la empresa de quien consulta y cuenta módulos y administradores', async () => {
    const acme = await nuevaEmpresa();
    await api().put(`/empresas/${acme.id}/modulos`, { modulos: { ausencias: true } });
    const r = await api().get('/empresas');
    expect(r.status).toBe(200);
    const comunicalo = r.body.data.find((e: { nombre: string }) => e.nombre === 'Comunicalo');
    const otra = r.body.data.find((e: { nombre: string }) => e.nombre === 'Acme');
    expect(comunicalo).toMatchObject({ esMiEmpresa: true, administradores: 1 });
    expect(otra).toMatchObject({ esMiEmpresa: false, modulosActivos: 1, modulosOpcionales: 10, administradores: 0 });
  });

  it('filtra por estado y por nombre', async () => {
    const acme = await nuevaEmpresa('Acme');
    await api().patch(`/empresas/${acme.id}/baja`);
    expect((await api().get('/empresas')).body.data.map((e: { nombre: string }) => e.nombre)).toEqual(['Comunicalo']);
    expect((await api().get('/empresas?estado=inactivas')).body.data.map((e: { nombre: string }) => e.nombre)).toEqual(['Acme']);
    expect((await api().get('/empresas?estado=todas&q=acm')).body.data).toHaveLength(1);
  });

  it('edita solo lo que cambia y lo audita; sin cambios no audita', async () => {
    const { id } = await nuevaEmpresa();
    const r = await api().patch(`/empresas/${id}`, { nombre: 'Acme SA', telefono: '5512345678' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ nombre: 'Acme SA', telefono: '5512345678', zonaHoraria: 'America/Mexico_City', moneda: 'MXN' });
    const editar = audit.eventos.filter((e) => e.accion === 'plataforma.empresa_editar');
    expect(editar).toHaveLength(1);
    expect(editar[0]?.datos).toMatchObject({ antes: { nombre: 'Acme' }, despues: { nombre: 'Acme SA' } });

    await api().patch(`/empresas/${id}`, { nombre: 'Acme SA' });
    expect(audit.eventos.filter((e) => e.accion === 'plataforma.empresa_editar')).toHaveLength(1);
  });

  it('responde 404 si la empresa no existe', async () => {
    expect((await api().get('/empresas/999')).status).toBe(404);
    expect((await api().patch('/empresas/999', { nombre: 'X1' })).status).toBe(404);
  });

  it('se desactiva y se reactiva, pero no la propia empresa', async () => {
    const { id } = await nuevaEmpresa();
    expect((await api().patch(`/empresas/${id}/baja`)).body.data.activa).toBe(false);
    expect((await api().patch(`/empresas/${id}/reactivar`)).body.data.activa).toBe(true);
    const propia = await api().patch('/empresas/1/baja');
    expect(propia.status).toBe(409);
    expect(repo.empresas[0]?.activa).toBe(true);
    expect(audit.acciones()).toEqual(expect.arrayContaining(['plataforma.empresa_desactivar', 'plataforma.empresa_reactivar']));
  });
});

describe('marca', () => {
  it('guarda los colores en minúsculas y se puede volver a la paleta por defecto', async () => {
    const { id } = await nuevaEmpresa();
    const r = await api().patch(`/empresas/${id}/marca`, { colorPrincipal: '#0B3263', colorAcento: '#00CCFC' });
    expect(r.body.data).toMatchObject({ colorModo: 'personalizado', colorPrincipal: '#0b3263', colorAcento: '#00ccfc' });
    const vuelta = await api().patch(`/empresas/${id}/marca`, { colorPrincipal: null, colorAcento: null });
    expect(vuelta.body.data).toMatchObject({ colorModo: 'defecto', colorPrincipal: null, colorAcento: null });
    expect(audit.acciones().filter((a) => a === 'plataforma.empresa_marca')).toHaveLength(2);
  });

  it('rechaza colores inválidos', async () => {
    const { id } = await nuevaEmpresa();
    expect((await api().patch(`/empresas/${id}/marca`, { colorPrincipal: 'azul' })).status).toBe(400);
    expect((await api().patch(`/empresas/${id}/marca`, { colorPrincipal: '#abc' })).status).toBe(400);
  });

  it('una empresa nueva usa la paleta por defecto', async () => {
    const { id } = await nuevaEmpresa();
    expect((await api().get(`/empresas/${id}`)).body.data).toMatchObject({ colorModo: 'defecto', colorPrincipal: null, colorAcento: null });
  });

  it('guarda los colores tomados del ícono con su modo', async () => {
    const { id } = await nuevaEmpresa();
    const r = await api().patch(`/empresas/${id}/marca`, { colorModo: 'logo', colorPrincipal: '#1f6fd0', colorAcento: null });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ colorModo: 'logo', colorPrincipal: '#1f6fd0', colorAcento: null });
  });

  it('en modo por defecto no guarda colores aunque lleguen', async () => {
    const { id } = await nuevaEmpresa();
    await api().patch(`/empresas/${id}/marca`, { colorModo: 'personalizado', colorPrincipal: '#1f6fd0' });
    const r = await api().patch(`/empresas/${id}/marca`, { colorModo: 'defecto', colorPrincipal: '#ff0000' });
    expect(r.body.data).toMatchObject({ colorModo: 'defecto', colorPrincipal: null, colorAcento: null });
  });

  it('pide el color principal cuando el modo no es el de por defecto', async () => {
    const { id } = await nuevaEmpresa();
    expect((await api().patch(`/empresas/${id}/marca`, { colorModo: 'logo' })).status).toBe(400);
    expect((await api().patch(`/empresas/${id}/marca`, { colorModo: 'inventado' })).status).toBe(400);
  });

  it('quitar el ícono restablece los colores si venían de él, y respeta los personalizados', async () => {
    const SUBIR = (id: number) =>
      request(app).post(`/api/plataforma/empresas/${id}/logo`).set('Authorization', SUPER).attach('logo', PNG, { filename: 'l.png', contentType: 'image/png' });

    const delLogo = await nuevaEmpresa('Del logo');
    await SUBIR(delLogo.id);
    await api().patch(`/empresas/${delLogo.id}/marca`, { colorModo: 'logo', colorPrincipal: '#1f6fd0', colorAcento: '#ff8800' });
    const restablecida = await api().del(`/empresas/${delLogo.id}/logo`);
    expect(restablecida.body.data).toMatchObject({ logoUrl: null, colorModo: 'defecto', colorPrincipal: null, colorAcento: null });

    const propia = await nuevaEmpresa('Propia');
    await SUBIR(propia.id);
    await api().patch(`/empresas/${propia.id}/marca`, { colorModo: 'personalizado', colorPrincipal: '#1f6fd0' });
    const conservada = await api().del(`/empresas/${propia.id}/logo`);
    expect(conservada.body.data).toMatchObject({ logoUrl: null, colorModo: 'personalizado', colorPrincipal: '#1f6fd0' });
  });
});

describe('módulos', () => {
  it('una empresa nueva empieza con todo lo opcional apagado', async () => {
    const { id } = await nuevaEmpresa();
    const r = await api().get(`/empresas/${id}/modulos`);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body.data.modulos)).toHaveLength(10);
    expect(Object.values(r.body.data.modulos).every((v) => v === false)).toBe(true);
  });

  it('enciende y apaga módulos y lo audita con antes y después', async () => {
    const { id } = await nuevaEmpresa();
    const r = await api().put(`/empresas/${id}/modulos`, { modulos: { ausencias: true, grupos: true } });
    expect(r.status).toBe(200);
    expect(r.body.data.modulos).toMatchObject({ ausencias: true, grupos: true, horas_extra: false });
    await api().put(`/empresas/${id}/modulos`, { modulos: { grupos: false } });
    expect((await api().get(`/empresas/${id}/modulos`)).body.data.modulos).toMatchObject({ ausencias: true, grupos: false });
    const cambios = audit.eventos.filter((e) => e.accion === 'plataforma.modulos_cambiar');
    expect(cambios).toHaveLength(2);
    expect(cambios[1]?.datos).toMatchObject({ antes: { grupos: true }, despues: { grupos: false } });
  });

  it('no deja encender un módulo sin lo que necesita y no guarda nada', async () => {
    const { id } = await nuevaEmpresa();
    const r = await api().put(`/empresas/${id}/modulos`, { modulos: { horas_extra: true } });
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body.error.details)).toContain('cobertura');
    expect(Object.values((await api().get(`/empresas/${id}/modulos`)).body.data.modulos).some(Boolean)).toBe(false);
  });

  it('enciende un módulo junto con su dependencia en la misma petición', async () => {
    const { id } = await nuevaEmpresa();
    const r = await api().put(`/empresas/${id}/modulos`, { modulos: { horas_extra: true, cobertura: true } });
    expect(r.status).toBe(200);
    expect(r.body.data.modulos).toMatchObject({ horas_extra: true, cobertura: true });
  });

  it('no deja apagar lo que otro módulo encendido necesita, salvo que se apaguen juntos', async () => {
    const { id } = await nuevaEmpresa();
    await api().put(`/empresas/${id}/modulos`, { modulos: { horas_extra: true, cambios_turno: true, cobertura: true } });
    expect((await api().put(`/empresas/${id}/modulos`, { modulos: { cobertura: false } })).status).toBe(409);
    expect((await api().get(`/empresas/${id}/modulos`)).body.data.modulos.cobertura).toBe(true);
    const juntos = await api().put(`/empresas/${id}/modulos`, {
      modulos: { cobertura: false, horas_extra: false, cambios_turno: false },
    });
    expect(juntos.status).toBe(200);
    expect(juntos.body.data.modulos).toMatchObject({ cobertura: false, horas_extra: false, cambios_turno: false });
  });

  it('no deja tocar el núcleo ni módulos que no existen', async () => {
    const { id } = await nuevaEmpresa();
    expect((await api().put(`/empresas/${id}/modulos`, { modulos: { biometria: false } })).status).toBe(400);
    expect((await api().put(`/empresas/${id}/modulos`, { modulos: { inventado: true } })).status).toBe(400);
  });

  it('pedir lo que ya está así no cambia ni audita nada', async () => {
    const { id } = await nuevaEmpresa();
    const r = await api().put(`/empresas/${id}/modulos`, { modulos: { ausencias: false } });
    expect(r.status).toBe(200);
    expect(audit.acciones()).not.toContain('plataforma.modulos_cambiar');
  });
});

describe('administradores', () => {
  it('se crea con contraseña temporal que no se guarda en claro', async () => {
    const { id } = await nuevaEmpresa();
    const r = await api().post(`/empresas/${id}/administradores`, { nombre: 'Ana Pérez', email: 'Ana@Acme.MX', telefono: '5512345678' });
    expect(r.status).toBe(201);
    expect(r.body.data.usuario).toMatchObject({ nombre: 'Ana Pérez', email: 'ana@acme.mx', activo: true, esSuperAdmin: false });
    expect(r.body.data.usuario.passwordHash).toBeUndefined();
    const temporal = r.body.data.passwordTemporal as string;
    expect(temporal.length).toBeGreaterThanOrEqual(10);
    const guardado = repo.admins.find((a) => a.email === 'ana@acme.mx')!;
    expect(guardado.passwordHash).not.toBe(temporal);
    expect(await bcrypt.compare(temporal, guardado.passwordHash!)).toBe(true);
    expect(audit.acciones()).toContain('plataforma.administrador_crear');
    expect(((await api().get(`/empresas/${id}/administradores`)).body.data as unknown[]).length).toBe(1);
  });

  it('rechaza un correo repetido, datos inválidos y una empresa desactivada', async () => {
    const { id } = await nuevaEmpresa();
    const repetido = await api().post(`/empresas/${id}/administradores`, { nombre: 'Ada Lovelace', email: 'ada@comunicalo.mx' });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.details[0].path).toBe('email');
    expect((await api().post(`/empresas/${id}/administradores`, { nombre: 'Ana Pérez', email: 'no-es-correo' })).status).toBe(400);
    await api().patch(`/empresas/${id}/baja`);
    expect((await api().post(`/empresas/${id}/administradores`, { nombre: 'Ana Pérez', email: 'ana@acme.mx' })).status).toBe(409);
  });

  it('la lista de administradores de Comunicalo muestra al super admin marcado', async () => {
    const r = await api().get('/empresas/1/administradores');
    expect(r.body.data).toEqual([expect.objectContaining({ nombre: 'Super Ada', esSuperAdmin: true })]);
  });
});

describe('ícono de la empresa', () => {
  const subir = (id: number, contenido: Buffer, nombre: string, tipo: string) =>
    request(app).post(`/api/plataforma/empresas/${id}/logo`).set('Authorization', SUPER).attach('logo', contenido, { filename: nombre, contentType: tipo });

  it('acepta un PNG y un SVG limpio, y devuelve su dirección firmada', async () => {
    const { id } = await nuevaEmpresa();
    const png = await subir(id, PNG, 'logo.png', 'image/png');
    expect(png.status).toBe(200);
    expect(png.body.data.logoUrl).toMatch(/^\/api\/archivos\/empresas\/.+\.png\?exp=\d+&sig=/);
    const svg = await subir(id, SVG_OK, 'logo.svg', 'image/svg+xml');
    expect(svg.status).toBe(200);
    expect(svg.body.data.logoUrl).toMatch(/\.svg\?exp=/);
    expect(almacen.archivos.size).toBe(1);
  });

  it('acepta un SVG que empieza con BOM (lo guardan así algunos editores)', async () => {
    const { id } = await nuevaEmpresa();
    const conBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), SVG_OK]);
    expect((await subir(id, conBom, 'logo.svg', 'image/svg+xml')).status).toBe(200);
  });

  it('rechaza un SVG con scripts, eventos o recursos externos', async () => {
    const { id } = await nuevaEmpresa();
    for (const malo of [SVG_SCRIPT, SVG_EVENTO, SVG_EXTERNO]) {
      const r = await subir(id, malo, 'logo.svg', 'image/svg+xml');
      expect(r.status).toBe(400);
    }
    expect(almacen.archivos.size).toBe(0);
  });

  it('no confía en lo que declara el navegador', async () => {
    const { id } = await nuevaEmpresa();
    expect((await subir(id, Buffer.from('esto no es una imagen, solo texto largo'), 'logo.png', 'image/png')).status).toBe(400);
    expect((await subir(id, SVG_OK, 'logo.gif', 'image/gif')).status).toBe(400);
  });

  it('pide un archivo', async () => {
    const { id } = await nuevaEmpresa();
    expect((await request(app).post(`/api/plataforma/empresas/${id}/logo`).set('Authorization', SUPER)).status).toBe(400);
  });

  it('se quita y la empresa vuelve a usar iniciales', async () => {
    const { id } = await nuevaEmpresa();
    await subir(id, PNG, 'logo.png', 'image/png');
    const r = await api().del(`/empresas/${id}/logo`);
    expect(r.body.data.logoUrl).toBeNull();
    expect(almacen.archivos.size).toBe(0);
    expect(audit.acciones()).toEqual(expect.arrayContaining(['plataforma.logo_cambiar', 'plataforma.logo_quitar']));
  });
});
