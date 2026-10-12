import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan variables del sistema.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // MySQL en otra máquina (D-008). `generate` funciona sin URL; migrate/seed la requieren.
    url: process.env.DATABASE_URL ?? 'mysql://usuario:password@localhost:3306/platinum_intranet',
  },
});
