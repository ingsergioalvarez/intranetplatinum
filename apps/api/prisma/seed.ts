/**
 * Seed idempotente: roles, permisos, matriz rol-permiso y usuario administrador inicial.
 * Uso: `npm run db:seed -w @platinum/api` (requiere DATABASE_URL).
 */
import bcrypt from 'bcryptjs';
import {
  PERMISO_DESCRIPCIONES,
  PERMISOS_POR_ROL,
  ROL_DESCRIPCIONES,
  ROLES,
  type Rol,
} from '@platinum/shared';
import { createPrismaClient } from '../src/core/data/prisma';

try {
  process.loadEnvFile();
} catch {
  // Sin .env
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[seed] Falta DATABASE_URL en apps/api/.env');
  process.exit(1);
}

const prisma = createPrismaClient(url);

/** Catálogo inicial (A-11): el admin puede agregar más desde la app. */
const CATEGORIAS_INICIALES: { nombre: string; icono: string; hijas: string[] }[] = [
  {
    nombre: 'Iluminación',
    icono: 'lightbulb',
    hijas: ['Lámpara fundida', 'Luminaria dañada', 'Área sin luz'],
  },
  {
    nombre: 'Cámaras',
    icono: 'cctv',
    hijas: ['Cámara sin imagen', 'Cámara dañada o movida', 'Grabador (DVR/NVR) con falla'],
  },
  {
    nombre: 'Casetas',
    icono: 'house',
    hijas: ['Daño en caseta', 'Falta de insumos', 'Falla eléctrica en caseta'],
  },
  {
    nombre: 'Mobiliario / Escritorios',
    icono: 'armchair',
    hijas: ['Escritorio dañado', 'Silla dañada', 'Mobiliario faltante'],
  },
  {
    nombre: 'Daño al inmueble',
    icono: 'building-2',
    hijas: ['Filtración o humedad', 'Vidrio roto', 'Pintura o grafiti', 'Puerta o cerradura dañada'],
  },
  {
    nombre: 'Seguridad',
    icono: 'shield-alert',
    hijas: ['Acceso no autorizado', 'Objeto sospechoso', 'Riña o incidente con personas'],
  },
  { nombre: 'Otro', icono: 'circle-help', hijas: [] },
];

async function main() {
  // 1. Permisos
  for (const [clave, descripcion] of Object.entries(PERMISO_DESCRIPCIONES)) {
    await prisma.permiso.upsert({
      where: { clave },
      update: { descripcion },
      create: { clave, descripcion },
    });
  }
  const permisos = await prisma.permiso.findMany();
  const permisoId = new Map(permisos.map((p) => [p.clave, p.id]));

  // 2. Roles + matriz rol-permiso (se resincroniza en cada ejecución)
  for (const clave of Object.values(ROLES) as Rol[]) {
    const rol = await prisma.rol.upsert({
      where: { clave },
      update: { nombre: ROL_DESCRIPCIONES[clave] },
      create: { clave, nombre: ROL_DESCRIPCIONES[clave] },
    });
    await prisma.rolPermiso.deleteMany({ where: { rolId: rol.id } });
    await prisma.rolPermiso.createMany({
      data: PERMISOS_POR_ROL[clave].map((p) => ({ rolId: rol.id, permisoId: permisoId.get(p)! })),
    });
  }

  // 3. Administrador inicial (solo si no existe)
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@platinum.local';
  const password = process.env.SEED_ADMIN_PASSWORD;
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (!existe) {
    if (!password || password.length < 10) {
      throw new Error('Define SEED_ADMIN_PASSWORD (mínimo 10 caracteres) para crear el administrador.');
    }
    const admin = await prisma.rol.findUniqueOrThrow({ where: { clave: ROLES.ADMIN } });
    await prisma.usuario.create({
      data: {
        nombre: 'Administrador',
        email,
        passwordHash: await bcrypt.hash(password, 12),
        rolId: admin.id,
      },
    });
    console.log(`[seed] Administrador creado: ${email}`);
  } else {
    console.log(`[seed] Administrador ya existe: ${email}`);
  }

  // 4. Catálogo inicial de categorías de reporte (F3-01). Solo agrega las que falten.
  let nuevas = 0;
  for (const [orden, { nombre, icono, hijas }] of CATEGORIAS_INICIALES.entries()) {
    let padre = await prisma.categoriaReporte.findFirst({ where: { nombre, padreId: null } });
    if (!padre) {
      padre = await prisma.categoriaReporte.create({ data: { nombre, icono, orden: orden * 10 } });
      nuevas++;
    }
    for (const [i, hija] of hijas.entries()) {
      const existe = await prisma.categoriaReporte.findFirst({ where: { nombre: hija, padreId: padre.id } });
      if (!existe) {
        await prisma.categoriaReporte.create({ data: { nombre: hija, padreId: padre.id, orden: i * 10 } });
        nuevas++;
      }
    }
  }
  console.log(`[seed] Categorías de reporte: ${nuevas} nuevas`);

  console.log(`[seed] OK — ${permisos.length} permisos, ${Object.values(ROLES).length} roles`);
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
