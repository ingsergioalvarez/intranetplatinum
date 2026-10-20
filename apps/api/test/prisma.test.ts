import { describe, expect, it, vi } from 'vitest';
import { PERMISOS, PERMISOS_POR_ROL, PERMISO_DESCRIPCIONES, ROLES } from '@platinum/shared';
import { getPrisma, parseDatabaseUrl } from '../src/core/data/prisma';

// Independiente del .env de cada máquina: simula que no hay DATABASE_URL.
vi.mock('../src/config/env', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/config/env')>();
  return { ...mod, env: { ...mod.env, DATABASE_URL: undefined } };
});

describe('capa de datos (sin BD)', () => {
  it('parseDatabaseUrl interpreta la URL de MySQL', () => {
    expect(parseDatabaseUrl('mysql://plat%40user:p%40ss@10.0.0.5:3307/platinum?connection_limit=5')).toEqual({
      host: '10.0.0.5',
      port: 3307,
      user: 'plat@user',
      password: 'p@ss',
      database: 'platinum',
      connectionLimit: 5,
      allowPublicKeyRetrieval: false,
    });
    expect(
      parseDatabaseUrl('mysql://u:p@localhost/db?allowPublicKeyRetrieval=true').allowPublicKeyRetrieval,
    ).toBe(true);
  });

  it('usa el puerto 3306 por defecto', () => {
    expect(parseDatabaseUrl('mysql://u:p@db/platinum').port).toBe(3306);
  });

  it('getPrisma falla con mensaje claro si no hay DATABASE_URL', () => {
    expect(() => getPrisma()).toThrow(/DATABASE_URL/);
  });
});

describe('catálogo de permisos (datos del seed)', () => {
  it('cada permiso tiene descripción', () => {
    for (const p of Object.values(PERMISOS)) expect(PERMISO_DESCRIPCIONES[p]).toBeTruthy();
  });

  it('admin tiene todos los permisos; guardia y cliente no administran usuarios', () => {
    expect(PERMISOS_POR_ROL[ROLES.ADMIN]).toHaveLength(Object.values(PERMISOS).length);
    expect(PERMISOS_POR_ROL[ROLES.GUARDIA]).not.toContain(PERMISOS.USUARIOS_CREAR);
    expect(PERMISOS_POR_ROL[ROLES.CLIENTE]).not.toContain(PERMISOS.REPORTES_CREAR);
  });
});
