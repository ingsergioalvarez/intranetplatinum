/**
 * Seed idempotente: roles, permisos, matriz rol-permiso y usuario administrador inicial.
 * Uso: `npm run db:seed -w @platinum/api` (requiere DATABASE_URL).
 */
import bcrypt from 'bcryptjs';
import {
  CLAVES_OPCIONALES,
  MODULOS_INICIALES_COMUNICALO,
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
        // Pertenece a Comunicalo, la empresa 1 (C-07).
        empresaId: 1,
        // El primer administrador de una instalación nueva es el super admin (A-65).
        esSuperAdmin: !(await prisma.usuario.findFirst({ where: { esSuperAdmin: true }, select: { id: true } })),
      },
    });
    console.log(`[seed] Administrador creado: ${email}`);
  } else {
    console.log(`[seed] Administrador ya existe: ${email}`);
  }

  // 4. Comunicalo (empresa 1, C-07): la primera vez arranca con los módulos iniciales (DC-015) y el resto apagado.
  // Si ya tiene filas no se toca: lo que el super admin haya cambiado se respeta.
  const comunicalo = await prisma.empresa.findUnique({
    where: { id: 1 },
    select: { _count: { select: { modulos: true } } },
  });
  if (comunicalo && comunicalo._count.modulos === 0) {
    await prisma.empresaModulo.createMany({
      data: CLAVES_OPCIONALES.map((modulo) => ({ empresaId: 1, modulo, encendido: MODULOS_INICIALES_COMUNICALO.includes(modulo) })),
    });
    console.log(`[seed] Comunicalo: ${MODULOS_INICIALES_COMUNICALO.length} módulos opcionales encendidos`);
  }

  console.log(`[seed] OK — ${permisos.length} permisos, ${Object.values(ROLES).length} roles`);
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
