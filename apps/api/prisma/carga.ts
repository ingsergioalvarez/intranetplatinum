/**
 * Datos ficticios para la prueba de carga (A-62). SOLO para la base aparte `platinum-carga`: crea 5 admin,
 * 30 supervisores, 240 guardias y 25 usuarios de cliente, con 5 clientes, 30 sitios y cada guardia asignado
 * a un sitio. Todos con el correo `carga_*@carga.local` y la misma contraseña.
 * Uso (dentro del contenedor de la prueba): `npx tsx prisma/carga.ts`
 */
import bcrypt from 'bcryptjs';
import { ROLES } from '@platinum/shared';
import { createPrismaClient } from '../src/core/data/prisma';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[carga] Falta DATABASE_URL');
  process.exit(1);
}
if (!url.includes('platinum_carga')) {
  console.error('[carga] Esta no es la base de la prueba de carga (debe llamarse platinum_carga). Me detengo.');
  process.exit(1);
}

const PASSWORD = 'Carga2026xx';
const N = { admin: 5, supervisor: 30, guardia: 240, cliente: 25, clientes: 5, sitios: 30 };

const prisma = createPrismaClient(url);

async function main() {
  if ((await prisma.usuario.count({ where: { email: { startsWith: 'carga_' } } })) > 0) {
    console.log('[carga] Ya hay datos de carga; no se duplican.');
    return;
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const rol = async (clave: string) => (await prisma.rol.findUniqueOrThrow({ where: { clave } })).id;
  const [rAdmin, rSup, rGuardia, rCliente] = await Promise.all([
    rol(ROLES.ADMIN),
    rol(ROLES.SUPERVISOR),
    rol(ROLES.GUARDIA),
    rol(ROLES.CLIENTE),
  ]);
  const usuario = (nombre: string, email: string, rolId: number, extra: object = {}) =>
    prisma.usuario.create({
      data: { nombre, email, passwordHash, rolId, telefono: '5550000000', debeCambiarPassword: false, ...extra },
    });

  for (let i = 1; i <= N.admin; i++) await usuario(`Carga Admin ${i}`, `carga_admin${i}@carga.local`, rAdmin);

  const supervisores: number[] = [];
  for (let i = 1; i <= N.supervisor; i++) {
    supervisores.push((await usuario(`Carga Supervisor ${i}`, `carga_sup${i}@carga.local`, rSup)).id);
  }

  const turno = await prisma.turno.create({
    data: { nombre: 'Carga 12h', horas: 12, horaEntrada: '07:00', diasTipo: 'diario' },
  });
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);

  const clientes: number[] = [];
  for (let i = 1; i <= N.clientes; i++) {
    const c = await prisma.cliente.create({
      data: { razonSocial: `Carga Cliente ${i} SA`, nombreComercial: `Carga Cliente ${i}` },
    });
    clientes.push(c.id);
    for (let k = 1; k <= N.cliente / N.clientes; k++) {
      await usuario(`Carga Cliente ${i}-${k}`, `carga_cli${i}_${k}@carga.local`, rCliente, { clienteId: c.id });
    }
  }

  const sitios: number[] = [];
  for (let i = 0; i < N.sitios; i++) {
    const s = await prisma.sitio.create({
      data: {
        clienteId: clientes[i % clientes.length],
        nombre: `Carga Sitio ${i + 1}`,
        lat: 19.4326,
        lng: -99.1332,
        radioM: 150,
        supervisorId: supervisores[i % supervisores.length],
      },
    });
    sitios.push(s.id);
  }

  for (let i = 1; i <= N.guardia; i++) {
    const g = await usuario(`Carga Guardia ${i}`, `carga_g${i}@carga.local`, rGuardia);
    await prisma.sitioGuardia.create({
      data: {
        sitioId: sitios[(i - 1) % sitios.length],
        usuarioId: g.id,
        turnoId: turno.id,
        horas: 12,
        diasTipo: 'diario',
        tipo: 'fija',
        horaInicio: '07:00',
        desde: hoy,
      },
    });
  }
  console.log(
    `[carga] Listo: ${N.admin} admin, ${N.supervisor} supervisores, ${N.guardia} guardias, ${N.cliente} usuarios de cliente, ${N.sitios} sitios.`,
  );
}

main()
  .catch((e) => {
    console.error('[carga] Error:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
