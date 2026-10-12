import { z } from 'zod';

try {
  process.loadEnvFile();
} catch {
  // Sin archivo .env: se usan las variables del sistema.
}

const DEV_SECRET = 'dev-secret-cambiar-en-produccion-000000';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  APP_URL: z.string().default('http://localhost:5173'),
  // Opcional hasta conectar MySQL en la otra máquina (D-008).
  DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32).default(DEV_SECRET),
  JWT_REFRESH_SECRET: z.string().min(32).default(DEV_SECRET),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().default(7),
  PASSWORD_RESET_EXPIRES_MIN: z.coerce.number().int().default(30),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Platinum Agency <no-reply@platinum.example>'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOADS_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[env] Variables de entorno inválidas:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';

if (isProduction && (env.JWT_ACCESS_SECRET === DEV_SECRET || env.JWT_REFRESH_SECRET === DEV_SECRET)) {
  console.error('[env] Define JWT_ACCESS_SECRET y JWT_REFRESH_SECRET en producción.');
  process.exit(1);
}
