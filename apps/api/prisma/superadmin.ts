/**
 * Asigna el super admin (A-65). Es la ÚNICA forma de dar ese rol: no existe en la app ni en la API.
 * Marca a esa cuenta y le pasa todo lo que todavía no tiene dueño (usuarios, clientes y grupos), que es lo que
 * había antes de las carteras. Se puede repetir sin problema.
 * Uso: `npm run db:superadmin -w @platinum/api -- correo@dominio.mx`
 * En el servidor: `docker compose exec api npx tsx prisma/superadmin.ts correo@dominio.mx`
 */
import { createPrismaClient } from '../src/core/data/prisma';

try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usa el entorno (contenedor)
}

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.DATABASE_URL;
if (!email || !url) {
  console.error('[superadmin] Uso: tsx prisma/superadmin.ts correo@dominio.mx (y DATABASE_URL en el entorno)');
  process.exit(1);
}

const prisma = createPrismaClient(url);

async function main() {
  const u = await prisma.usuario.findUnique({ where: { email }, include: { rol: true } });
  if (!u) throw new Error(`No existe ningún usuario con el correo ${email}`);
  if (u.rol.clave !== 'admin') throw new Error(`${email} no es administrador: el super admin debe ser admin`);
  if (u.deletedAt || !u.activo) throw new Error(`${email} está dado de baja`);

  await prisma.usuario.update({ where: { id: u.id }, data: { esSuperAdmin: true, propietarioId: null } });
  // Lo que no tenía dueño pasa al super admin (excepto él mismo).
  const usuarios = await prisma.usuario.updateMany({
    where: { propietarioId: null, id: { not: u.id } },
    data: { propietarioId: u.id },
  });
  const clientes = await prisma.cliente.updateMany({ where: { propietarioId: null }, data: { propietarioId: u.id } });
  const grupos = await prisma.grupoGuardias.updateMany({ where: { propietarioId: null }, data: { propietarioId: u.id } });
  console.log(
    `[superadmin] ${u.nombre} (${email}) es super admin. Le pasaron ${usuarios.count} usuarios, ${clientes.count} clientes y ${grupos.count} grupos sin dueño.`,
  );
}

main()
  .catch((e) => {
    console.error('[superadmin]', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
