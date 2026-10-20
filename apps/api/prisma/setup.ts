/**
 * Constructor de la BD local (F0-10): deja lista una PC nueva para trabajar en el proyecto.
 *
 * 1. Crea `apps/api/.env` (secretos JWT aleatorios) y `apps/web/.env` desde los `.env.example` si faltan.
 * 2. Crea la base de datos de `DATABASE_URL` si no existe (utf8mb4).
 * 3. Aplica las migraciones (`prisma migrate deploy`) y el seed (roles, permisos, admin, categorías).
 *
 * Uso (desde la raíz, después de `npm install`):
 *   npm run db:setup -- --url "mysql://root:CLAVE@localhost:3306/platinum_intranet?allowPublicKeyRetrieval=true"
 *   npm run db:setup                 # usa la DATABASE_URL que ya está en apps/api/.env
 *   npm run db:setup -- --reset      # borra y recrea la BD (solo servidores locales)
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import * as mariadb from 'mariadb';
import { parseDatabaseUrl } from '../src/core/data/prisma';

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = resolve(apiDir, '../web');
const apiEnv = resolve(apiDir, '.env');

const { values: args } = parseArgs({
  options: {
    url: { type: 'string' },
    reset: { type: 'boolean', default: false },
  },
});

const log = (msg: string) => console.log(`[setup] ${msg}`);
function fallar(msg: string): never {
  console.error(`[setup] ERROR: ${msg}`);
  process.exit(1);
}

const secreto = () => randomBytes(48).toString('base64url');

/** Reemplaza `CLAVE=...` en el contenido de un .env, o la agrega al final. */
function setVar(contenido: string, clave: string, valor: string): string {
  const linea = `${clave}=${valor}`;
  const re = new RegExp(`^${clave}=.*$`, 'gm');
  return re.test(contenido) ? contenido.replace(re, () => linea) : `${contenido.trimEnd()}\n${linea}\n`;
}

// 1. Archivos .env
if (!existsSync(resolve(webDir, '.env')) && existsSync(resolve(webDir, '.env.example'))) {
  copyFileSync(resolve(webDir, '.env.example'), resolve(webDir, '.env'));
  log('Creado apps/web/.env');
}

let contenido: string;
if (existsSync(apiEnv)) {
  contenido = readFileSync(apiEnv, 'utf8');
} else {
  contenido = readFileSync(resolve(apiDir, '.env.example'), 'utf8');
  contenido = setVar(contenido, 'JWT_ACCESS_SECRET', secreto());
  contenido = setVar(contenido, 'JWT_REFRESH_SECRET', secreto());
  log('Creado apps/api/.env con secretos JWT aleatorios');
}
if (args.url) contenido = setVar(contenido, 'DATABASE_URL', args.url);

let vars = parseEnv(contenido);
let passwordGenerada: string | undefined;
if (!vars.SEED_ADMIN_PASSWORD) {
  passwordGenerada = randomBytes(9).toString('base64url');
  contenido = setVar(contenido, 'SEED_ADMIN_PASSWORD', passwordGenerada);
}
writeFileSync(apiEnv, contenido);
vars = parseEnv(contenido);

const url = vars.DATABASE_URL;
if (!url || url.includes('@HOST:')) {
  fallar(
    'Falta DATABASE_URL. Edita apps/api/.env o ejecuta:\n' +
      '  npm run db:setup -- --url "mysql://root:CLAVE@localhost:3306/platinum_intranet?allowPublicKeyRetrieval=true"',
  );
}

// 2. Base de datos
const db = parseDatabaseUrl(url);
if (!/^[\w$]+$/.test(db.database)) fallar(`Nombre de base de datos no válido: "${db.database}"`);
const esLocal = ['localhost', '127.0.0.1', '::1'].includes(db.host);

let conn: mariadb.Connection | undefined;
try {
  conn = await mariadb.createConnection({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    allowPublicKeyRetrieval: db.allowPublicKeyRetrieval,
  });
  if (args.reset) {
    if (!esLocal) fallar(`--reset solo se permite en un MySQL local (host actual: ${db.host}).`);
    await conn.query(`DROP DATABASE IF EXISTS \`${db.database}\``);
    log(`Base "${db.database}" borrada (--reset)`);
  }
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  log(`Base "${db.database}" lista en ${db.host}:${db.port}`);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  const pista = /RSA public key/i.test(msg)
    ? '\nAgrega ?allowPublicKeyRetrieval=true al final de DATABASE_URL.'
    : /ECONNREFUSED/i.test(msg)
      ? '\n¿Está encendido MySQL? (servicio MySQL80 en Windows)'
      : /denied/i.test(msg)
        ? '\nRevisa usuario/contraseña, o crea la BD a mano con un usuario que tenga permiso CREATE.'
        : '';
  fallar(`No se pudo conectar a MySQL: ${msg}${pista}`);
} finally {
  await conn?.end();
}

// 3. Migraciones y seed (con las variables del .env recién escrito)
function correr(comando: string) {
  log(`> ${comando}`);
  const r = spawnSync(comando, {
    cwd: apiDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...vars },
  });
  if (r.status !== 0) fallar(`Falló "${comando}"`);
}

correr('npx prisma migrate deploy');
correr('npx prisma db seed');

log('Listo. Arranca la app con `npm run dev` y entra en http://localhost:5173');
log(`Administrador: ${vars.SEED_ADMIN_EMAIL ?? 'admin@platinum.local'}`);
if (passwordGenerada)
  log(`Contraseña generada (guardada en apps/api/.env como SEED_ADMIN_PASSWORD): ${passwordGenerada}`);
