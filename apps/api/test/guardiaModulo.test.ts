import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express, { Router, type Response } from 'express';
import { ROLES, PERMISOS_POR_ROL } from '@platinum/shared';
import { LectorModulos, authenticate, empresaActual, signAccessToken, type AppModule } from '../src/core';

class Lector extends LectorModulos {
  constructor(private datos: Record<number, string[]>) {
    super();
  }
  async encendidos(empresaId: number) {
    return new Set(this.datos[empresaId] ?? []);
  }
}

// Un módulo de juguete que responde la empresa con la que se atendió la petición.
function modulo(clave: 'turnos' | 'ausencias'): AppModule {
  const router = Router();
  router.get('/', authenticate, (_req, res) => res.json({ ok: true, data: { empresa: empresaActual() } }));
  return { name: clave, basePath: clave, router, modulo: clave };
}

const token = (empresaId: number, extra: object = {}) =>
  signAccessToken({
    id: 1,
    email: 'a@x.mx',
    rol: ROLES.ADMIN,
    permisos: [...PERMISOS_POR_ROL[ROLES.ADMIN]],
    empresaId,
    ...extra,
  });

describe('guardia de módulo (C-09)', () => {
  it('bloquea con 403 MODULO_APAGADO, deja pasar si está encendido y sin sesión responde 401', async () => {
    const { guardiaDeModulo } = await import('../src/core');
    const lector = new Lector({ 1: ['turnos'], 2: [] });
    const app = express();
    app.use('/turnos', guardiaDeModulo('turnos', lector));
    app.use('/turnos', modulo('turnos').router);
    app.use((err: { status?: number; code?: string; message: string }, _req: unknown, res: Response, _next: unknown) =>
      res.status(err.status ?? 500).json({ ok: false, error: { code: err.code, message: err.message } }),
    );

    const ok = await request(app).get('/turnos').set('Authorization', `Bearer ${token(1)}`);
    expect(ok.status).toBe(200);

    const apagado = await request(app).get('/turnos').set('Authorization', `Bearer ${token(2)}`);
    expect(apagado.status).toBe(403);
    expect(apagado.body.error.code).toBe('MODULO_APAGADO');

    expect((await request(app).get('/turnos')).status).toBe(401);
    expect((await request(app).get('/turnos').set('Authorization', 'Bearer basura')).status).toBe(401);
  });

  it('solo el super admin puede elegir otra empresa con la cabecera', async () => {
    const { guardiaDeModulo } = await import('../src/core');
    const lector = new Lector({ 1: ['turnos'], 2: [] });
    const app = express();
    app.use('/turnos', guardiaDeModulo('turnos', lector));
    app.use('/turnos', modulo('turnos').router);
    app.use((err: { status?: number; code?: string; message: string }, _req: unknown, res: Response, _next: unknown) =>
      res.status(err.status ?? 500).json({ ok: false, error: { code: err.code, message: err.message } }),
    );

    // Super admin de la empresa 1 entrando a la 2 (sin módulos): se le aplica la 2.
    const sup = await request(app).get('/turnos').set('Authorization', `Bearer ${token(1, { esSuperAdmin: true })}`).set('X-Empresa-Id', '2');
    expect(sup.status).toBe(403);
    // Super admin entrando a la 1 desde la 2: trabaja en la 1.
    const sup1 = await request(app).get('/turnos').set('Authorization', `Bearer ${token(2, { esSuperAdmin: true })}`).set('X-Empresa-Id', '1');
    expect(sup1.status).toBe(200);
    expect(sup1.body.data.empresa).toBe(1);
    // Un admin común no puede: la cabecera se ignora y sigue en su empresa.
    const admin = await request(app).get('/turnos').set('Authorization', `Bearer ${token(2)}`).set('X-Empresa-Id', '1');
    expect(admin.status).toBe(403);
  });
});
