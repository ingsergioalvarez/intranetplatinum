import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import { PERMISOS_POR_ROL, ROLES } from '@platinum/shared';
import { createApp } from '../src/app';
import {
  authenticate,
  conEmpresa,
  empresaActual,
  empresaOpcional,
  esContextoGlobal,
  paraCadaEmpresa,
  signAccessToken,
  sinFiltroDeEmpresa,
  verifyAccessToken,
  type AppModule,
} from '../src/core';

describe('contexto de empresa', () => {
  it('sin contexto no hay empresa y pedirla se niega (nunca se asume una)', () => {
    expect(empresaOpcional()).toBeNull();
    expect(esContextoGlobal()).toBe(false);
    expect(() => empresaActual()).toThrowError(/Vuelve a iniciar sesión/);
  });

  it('conEmpresa fija la empresa, también después de un await', async () => {
    const r = await conEmpresa(7, async () => {
      await new Promise((ok) => setTimeout(ok, 5));
      return empresaActual();
    });
    expect(r).toBe(7);
    expect(empresaOpcional()).toBeNull();
  });

  it('sinFiltroDeEmpresa marca la operación como global y sin empresa', () => {
    sinFiltroDeEmpresa(() => {
      expect(esContextoGlobal()).toBe(true);
      expect(empresaOpcional()).toBeNull();
      expect(() => empresaActual()).toThrow();
    });
  });

  it('un contexto dentro de otro manda el más interno, y al salir se restablece el de afuera', () => {
    conEmpresa(1, () => {
      sinFiltroDeEmpresa(() => expect(esContextoGlobal()).toBe(true));
      conEmpresa(2, () => expect(empresaActual()).toBe(2));
      expect(empresaActual()).toBe(1);
      expect(esContextoGlobal()).toBe(false);
    });
  });

  it('una consulta "perezosa" (como las de Prisma) se ejecuta DENTRO del contexto aunque se espere afuera', async () => {
    // Imita a Prisma: no hace nada hasta que alguien llama a .then().
    const perezosa = () => ({
      then: (ok: (v: unknown) => unknown) => Promise.resolve(empresaOpcional()).then(ok),
    });
    expect(await conEmpresa(4, () => perezosa())).toBe(4);
    expect(await sinFiltroDeEmpresa(() => perezosa())).toBeNull();
    // Y la empresa de afuera no se contamina.
    const afuera = await conEmpresa(9, async () => (await sinFiltroDeEmpresa(() => perezosa())) ?? empresaActual());
    expect(afuera).toBe(9);
  });

  it('operaciones simultáneas de empresas distintas no se mezclan', async () => {
    const lento = (empresa: number, ms: number) =>
      conEmpresa(empresa, async () => {
        await new Promise((ok) => setTimeout(ok, ms));
        return empresaActual();
      });
    const r = await Promise.all([lento(1, 20), lento(2, 5), lento(3, 10), lento(4, 1)]);
    expect(r).toEqual([1, 2, 3, 4]);
  });
});

describe('paraCadaEmpresa (tareas sin petición)', () => {
  it('corre el trabajo una vez por empresa, cada una en su contexto', async () => {
    const vistas: number[] = [];
    const errores = await paraCadaEmpresa([1, 2, 3], async (id) => {
      await new Promise((ok) => setTimeout(ok, 3 - id));
      vistas.push(empresaActual());
      expect(empresaActual()).toBe(id);
    });
    expect(errores).toEqual([]);
    expect(vistas).toEqual([1, 2, 3]);
    expect(empresaOpcional()).toBeNull();
  });

  it('si una empresa falla, las demás siguen y el error se devuelve', async () => {
    const hechas: number[] = [];
    const errores = await paraCadaEmpresa([1, 2, 3], async (id) => {
      if (id === 2) throw new Error('falló la 2');
      hechas.push(id);
    });
    expect(hechas).toEqual([1, 3]);
    expect(errores).toHaveLength(1);
    expect(errores[0]).toMatchObject({ empresaId: 2 });
    expect((errores[0]!.error as Error).message).toBe('falló la 2');
  });

  it('sin empresas no hace nada', async () => {
    expect(await paraCadaEmpresa([], async () => { throw new Error('no debe correr'); })).toEqual([]);
  });
});

describe('la empresa en el token', () => {
  const base = { id: 1, email: 'a@a.mx', rol: ROLES.ADMIN, permisos: PERMISOS_POR_ROL[ROLES.ADMIN] };

  it('el token lleva la empresa y se recupera al verificarlo', () => {
    expect(verifyAccessToken(signAccessToken({ ...base, empresaId: 7 })).empresaId).toBe(7);
  });

  it('un token sin empresa (anterior a C-08) se recupera como null', () => {
    expect(verifyAccessToken(signAccessToken(base)).empresaId).toBeNull();
    expect(verifyAccessToken(signAccessToken({ ...base, empresaId: null })).empresaId).toBeNull();
  });
});

describe('authenticate fija la empresa de la petición', () => {
  const router = Router();
  router.get('/', authenticate, async (_req, res) => {
    await new Promise((ok) => setTimeout(ok, Math.random() * 10));
    res.json({ ok: true, data: { empresa: empresaOpcional() } });
  });
  const modulo: AppModule = { name: 'ctx', basePath: 'ctx', router };
  const app = createApp([modulo]);

  const llamar = (empresaId?: number) =>
    request(app)
      .get('/api/ctx')
      .set('Authorization', `Bearer ${signAccessToken({ id: 1, email: 'a@a.mx', rol: ROLES.ADMIN, permisos: [], empresaId })}`);

  it('el código que corre después de authenticate ve la empresa del token', async () => {
    expect((await llamar(5)).body.data.empresa).toBe(5);
  });

  it('con un token sin empresa no hay contexto', async () => {
    expect((await llamar()).body.data.empresa).toBeNull();
  });

  it('peticiones simultáneas de empresas distintas no se mezclan', async () => {
    const r = await Promise.all([1, 2, 3, 4, 5, 6].map((e) => llamar(e)));
    expect(r.map((x) => x.body.data.empresa)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
