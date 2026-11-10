import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import { AVISO_PRIVACIDAD_VERSION, PERMISOS_POR_ROL, ROLES, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { authenticate, signAccessToken, type AuthUser } from '../src/core';
import { requireAvisoAceptado } from '../src/modules/privacidad/aceptado';
import { createPrivacidadModule } from '../src/modules/privacidad';
import {
  PrivacidadRepository,
  type AceptacionFila,
  type NuevaAceptacion,
} from '../src/modules/privacidad/privacidad.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const NOMBRES: Record<number, string> = { 10: 'Juan Pérez', 11: 'Ana Ruiz', 12: 'Luis Soto', 13: 'Eva Gil' };
/** Guardias de cada admin: 1 (Ada) tiene 10, 11 y 12; 2 (Beto) tiene 13. */
const DUENO: Record<number, number> = { 10: 1, 11: 1, 12: 1, 13: 2 };

class Memoria extends PrivacidadRepository {
  aceptaciones: (NuevaAceptacion & { aceptadaEn: Date })[] = [];
  avisoPendiente = new Set<number>();
  async ultimaAceptacion(usuarioId: number) {
    return this.ultima(usuarioId);
  }
  private ultima(usuarioId: number): AceptacionFila | null {
    const filas = this.aceptaciones.filter((a) => a.usuarioId === usuarioId);
    return filas.length ? filas[filas.length - 1] : null;
  }
  async aceptar(d: NuevaAceptacion) {
    if (this.aceptaciones.some((a) => a.usuarioId === d.usuarioId && a.version === d.version)) return;
    this.aceptaciones.push({ ...d, aceptadaEn: new Date('2026-11-09T18:00:00.000Z') });
  }
  async guardias(cartera: number | undefined) {
    return Object.keys(NOMBRES)
      .map(Number)
      .filter((id) => cartera === undefined || DUENO[id] === cartera)
      .map((id) => ({ id, nombre: NOMBRES[id] }));
  }
  async ultimasAceptaciones(ids: number[]) {
    const m = new Map<number, AceptacionFila>();
    for (const id of ids) {
      const a = this.ultima(id);
      if (a) m.set(id, a);
    }
    return m;
  }
  async hayAvisoPendiente(usuarioId: number) {
    return this.avisoPendiente.has(usuarioId);
  }
  async adminsDe({ guardiaId }: { guardiaId?: number | null }) {
    return guardiaId && DUENO[guardiaId] ? [DUENO[guardiaId]] : [];
  }
  async nombreDe(id: number) {
    return NOMBRES[id] ?? null;
  }
}

interface AvisoRegistrado {
  usuarioIds: number[];
  titulo?: string;
  mensaje: string;
  ruta?: string | null;
  entidad?: { tipo: string; id: number };
}

let repo: Memoria;
let audit: MemoryAuditLogger;
let avisos: AvisoRegistrado[];
let atendidos: { entidad: { tipo: string; id: number }; resultado: string }[];
let app: ReturnType<typeof createApp>;

const token = (u: Partial<AuthUser> & { id: number; rol: Rol }) =>
  `Bearer ${signAccessToken({ email: 'x@x.mx', permisos: PERMISOS_POR_ROL[u.rol], ...u })}`;
const como = (u: Partial<AuthUser> & { id: number; rol: Rol }) => ({
  get: (url = '') => request(app).get(`/api/privacidad${url}`).set('Authorization', token(u)),
  post: (url: string, body: object = {}) =>
    request(app).post(`/api/privacidad${url}`).set('Authorization', token(u)).send(body),
});
const guardia = (id = 10) => como({ id, rol: ROLES.GUARDIA });
const adminAda = () => como({ id: 1, rol: ROLES.ADMIN });
const adminBeto = () => como({ id: 2, rol: ROLES.ADMIN });
const superAdmin = () => como({ id: 3, rol: ROLES.ADMIN, esSuperAdmin: true });
const sup = () => como({ id: 5, rol: ROLES.SUPERVISOR, propietarioId: 1 });
const cliente = () => como({ id: 20, rol: ROLES.CLIENTE, clienteId: 1 });

beforeEach(() => {
  repo = new Memoria();
  audit = new MemoryAuditLogger();
  avisos = [];
  atendidos = [];
  app = createApp([
    createPrivacidadModule({
      repo,
      audit,
      avisar: async (usuarioIds, a) =>
        void avisos.push({ usuarioIds, titulo: a.titulo, mensaje: a.mensaje, ruta: a.ruta, entidad: a.entidad }),
      atencion: {
        atender: async (entidad, a) => void atendidos.push({ entidad, resultado: a.resultado }),
        reabrir: async () => undefined,
      },
    }),
  ]);
});

describe('GET /privacidad/estado', () => {
  it('un guardia que nunca aceptó: no ha aceptado y se le deja un aviso a él y a su admin', async () => {
    const res = await guardia().get('/estado');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      versionVigente: AVISO_PRIVACIDAD_VERSION,
      aceptada: false,
      vigente: false,
      versionAceptada: null,
      aceptadaEn: null,
    });
    expect(avisos).toHaveLength(2);
    expect(avisos[0]).toMatchObject({ usuarioIds: [10], ruta: '/marcar', entidad: { tipo: 'aviso_privacidad', id: 10 } });
    expect(avisos[1]).toMatchObject({ usuarioIds: [1], ruta: '/privacidad', entidad: { tipo: 'aviso_privacidad', id: 10 } });
    expect(avisos[1].mensaje).toContain('Juan Pérez');
  });

  it('no repite el aviso si ya hay uno sin atender', async () => {
    repo.avisoPendiente.add(10);
    await guardia().get('/estado');
    expect(avisos).toHaveLength(0);
  });

  it('quien ya aceptó la versión vigente: todo en regla y sin avisos', async () => {
    await guardia().post('/aceptar', { version: AVISO_PRIVACIDAD_VERSION });
    avisos.length = 0;
    const res = await guardia().get('/estado');
    expect(res.body.data).toMatchObject({ aceptada: true, vigente: true, versionAceptada: AVISO_PRIVACIDAD_VERSION });
    expect(avisos).toHaveLength(0);
  });

  it('quien aceptó una versión anterior: sigue pudiendo checar pero debe aceptar la nueva', async () => {
    repo.aceptaciones.push({ usuarioId: 10, version: 'v-vieja', aceptadaEn: new Date('2026-01-01T00:00:00.000Z') });
    const res = await guardia().get('/estado');
    expect(res.body.data).toMatchObject({ aceptada: true, vigente: false, versionAceptada: 'v-vieja' });
    expect(avisos).toHaveLength(0);
  });

  it('solo para quien puede checar', async () => {
    expect((await cliente().get('/estado')).status).toBe(403);
  });

  it('sin sesión: 401', async () => {
    expect((await request(app).get('/api/privacidad/estado')).status).toBe(401);
  });
});

describe('POST /privacidad/aceptar', () => {
  it('guarda la aceptación con IP y dispositivo, la audita y marca atendidos los avisos', async () => {
    const res = await request(app)
      .post('/api/privacidad/aceptar')
      .set('Authorization', token({ id: 10, rol: ROLES.GUARDIA }))
      .set('User-Agent', 'Pruebas/1.0')
      .send({ version: AVISO_PRIVACIDAD_VERSION });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ aceptada: true, vigente: true });
    expect(res.body.data.aceptadaEn).toBe('2026-11-09T18:00:00.000Z');
    expect(repo.aceptaciones).toHaveLength(1);
    expect(repo.aceptaciones[0]).toMatchObject({ usuarioId: 10, version: AVISO_PRIVACIDAD_VERSION, userAgent: 'Pruebas/1.0' });
    expect(audit.acciones()).toEqual(['privacidad.aceptar']);
    expect(atendidos).toEqual([{ entidad: { tipo: 'aviso_privacidad', id: 10 }, resultado: 'Aceptó el aviso de privacidad' }]);
  });

  it('aceptar dos veces la misma versión no duplica', async () => {
    await guardia().post('/aceptar', { version: AVISO_PRIVACIDAD_VERSION });
    await guardia().post('/aceptar', { version: AVISO_PRIVACIDAD_VERSION });
    expect(repo.aceptaciones).toHaveLength(1);
  });

  it('si la versión cambió mientras leía: 409 y no guarda nada', async () => {
    const res = await guardia().post('/aceptar', { version: 'otra-version' });
    expect(res.status).toBe(409);
    expect(repo.aceptaciones).toHaveLength(0);
    expect(atendidos).toHaveLength(0);
  });

  it('sin versión: 400', async () => {
    expect((await guardia().post('/aceptar', {})).status).toBe(400);
  });

  it('solo para quien puede checar', async () => {
    expect((await cliente().post('/aceptar', { version: AVISO_PRIVACIDAD_VERSION })).status).toBe(403);
  });
});

describe('GET /privacidad/guardias', () => {
  beforeEach(() => {
    repo.aceptaciones.push(
      { usuarioId: 10, version: AVISO_PRIVACIDAD_VERSION, aceptadaEn: new Date('2026-11-09T17:00:00.000Z') },
      { usuarioId: 11, version: 'v-vieja', aceptadaEn: new Date('2026-10-01T17:00:00.000Z') },
    );
  });

  it('el admin ve solo los guardias de su cartera, con los pendientes primero', async () => {
    const res = await adminAda().get('/guardias');
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((g: { id: number }) => g.id)).toEqual([11, 12, 10]);
    expect(res.body.data).toMatchObject({ versionVigente: AVISO_PRIVACIDAD_VERSION, sinAceptar: 1, pendientes: 2 });
    expect(res.body.data.items[2]).toMatchObject({ id: 10, aceptada: true, vigente: true });
    expect(res.body.data.items[0]).toMatchObject({ id: 11, aceptada: true, vigente: false, versionAceptada: 'v-vieja' });
    expect(res.body.data.items[1]).toMatchObject({ id: 12, aceptada: false, vigente: false });
  });

  it('otro admin no ve los guardias de Ada', async () => {
    const res = await adminBeto().get('/guardias');
    expect(res.body.data.items.map((g: { id: number }) => g.id)).toEqual([13]);
  });

  it('el super admin los ve todos', async () => {
    const res = await superAdmin().get('/guardias');
    expect(res.body.data.items).toHaveLength(4);
  });

  it('el supervisor ve la cartera de su admin', async () => {
    const res = await sup().get('/guardias');
    expect(res.body.data.items.map((g: { id: number }) => g.id)).toEqual([11, 12, 10]);
  });

  it('el filtro "pendientes" quita a quien ya aceptó la versión vigente', async () => {
    const res = await adminAda().get('/guardias?filtro=pendientes');
    expect(res.body.data.items.map((g: { id: number }) => g.id)).toEqual([11, 12]);
    expect(res.body.data.pendientes).toBe(2);
  });

  it('guardia y cliente no entran', async () => {
    expect((await guardia().get('/guardias')).status).toBe(403);
    expect((await cliente().get('/guardias')).status).toBe(403);
  });
});

describe('candado del servidor (requireAvisoAceptado)', () => {
  const montar = (aceptado: boolean) => {
    const router = Router();
    router.use(authenticate);
    router.post('/checar', requireAvisoAceptado(async () => aceptado), (_req, res) => {
      res.json({ ok: true, data: 'checado' });
    });
    return createApp([{ name: 'prueba', basePath: 'prueba', router }]);
  };

  it('sin aceptar: 403 con código propio', async () => {
    const res = await request(montar(false))
      .post('/api/prueba/checar')
      .set('Authorization', token({ id: 10, rol: ROLES.GUARDIA }));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PRIVACY_NOTICE_REQUIRED');
  });

  it('con el aviso aceptado: pasa', async () => {
    const res = await request(montar(true))
      .post('/api/prueba/checar')
      .set('Authorization', token({ id: 10, rol: ROLES.GUARDIA }));
    expect(res.status).toBe(200);
  });

  it('sin sesión: 401', async () => {
    expect((await request(montar(true)).post('/api/prueba/checar')).status).toBe(401);
  });
});
