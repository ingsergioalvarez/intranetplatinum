/**
 * Seed idempotente: permisos, roles de partida de cada empresa y usuario administrador inicial. No pisa lo que el admin
 * haya editado en los roles (C-11).
 * Uso: `npm run db:seed -w @platinum/api` (requiere DATABASE_URL).
 */
import bcrypt from 'bcryptjs';
import {
  CLAVES_OPCIONALES,
  MODULOS_INICIALES_COMUNICALO,
  PERMISO_DESCRIPCIONES,
  ROLES,
} from '@platinum/shared';
import { createPrismaClient } from '../src/core/data/prisma';
import { sembrarRolesDeEmpresa } from '../src/core/empresa/rolesBase';

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
  // 1. Permisos: se agregan los que falten. Los NUEVOS se otorgan a los roles de partida según sus valores de partida;
  // lo que el admin haya quitado o dado a un rol (C-11) no se toca.
  const existentes = new Set((await prisma.permiso.findMany({ select: { clave: true } })).map((p) => p.clave));
  const nuevos: string[] = [];
  for (const [clave, descripcion] of Object.entries(PERMISO_DESCRIPCIONES)) {
    await prisma.permiso.upsert({
      where: { clave },
      update: { descripcion },
      create: { clave, descripcion },
    });
    if (!existentes.has(clave)) nuevos.push(clave);
  }
  const permisos = await prisma.permiso.findMany();

  // 2. Roles de cada empresa: los de partida se crean si faltan (con sus permisos de partida) y nunca se pisan.
  // El admin siempre conserva todos los permisos (no se puede quedar sin poder administrar).
  const empresas = await prisma.empresa.findMany({ select: { id: true } });
  for (const { id: empresaId } of empresas) await sembrarRolesDeEmpresa(prisma, empresaId, nuevos);

  // 3. Administrador inicial (solo si no existe)
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@platinum.local';
  const password = process.env.SEED_ADMIN_PASSWORD;
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (!existe) {
    if (!password || password.length < 10) {
      throw new Error('Define SEED_ADMIN_PASSWORD (mínimo 10 caracteres) para crear el administrador.');
    }
    const admin = await prisma.rol.findFirstOrThrow({ where: { empresaId: 1, clave: ROLES.ADMIN } });
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

  console.log(`[seed] OK — ${permisos.length} permisos (${nuevos.length} nuevos), ${Object.values(ROLES).length} roles de partida en ${empresas.length} empresa(s)`);
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
