import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/client';
import { env } from '../../config/env';

let client: PrismaClient | undefined;

/**
 * Convierte `mysql://user:pass@host:port/db?opciones` a la configuración del adaptador MariaDB/MySQL.
 * Opciones: `connection_limit`, `allowPublicKeyRetrieval=true` (MySQL 8 con caching_sha2_password
 * sin SSL; usar solo en local: en servidores remotos conviene SSL).
 */
export function parseDatabaseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectionLimit: Number(u.searchParams.get('connection_limit') ?? 10),
    allowPublicKeyRetrieval: u.searchParams.get('allowPublicKeyRetrieval') === 'true',
  };
}

export function createPrismaClient(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaMariaDb(parseDatabaseUrl(url)) });
}

/**
 * Cliente Prisma compartido, creado al primer uso.
 * Lanza un error claro si aún no hay `DATABASE_URL` (MySQL en otra máquina, D-008).
 */
export function getPrisma(): PrismaClient {
  if (!client) {
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada. Revisa apps/api/.env (ver D-008).');
    }
    client = createPrismaClient(env.DATABASE_URL);
  }
  return client;
}

export async function disconnectPrisma() {
  await client?.$disconnect();
  client = undefined;
}
