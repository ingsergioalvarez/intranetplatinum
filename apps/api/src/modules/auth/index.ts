import { Router } from 'express';
import { cambiarPasswordSchema, loginSchema } from '@platinum/shared';
import {
  AuditLogger,
  PrismaAuditLogger,
  authenticateAllowingTemporaryPassword,
  rateLimit,
  validate,
  type AppModule,
} from '../../core';
import { AuthController } from './auth.controller';
import { AuthRepository, PrismaAuthRepository } from './auth.repository';
import { AuthService, type AuthPolicy } from './auth.service';

interface AuthModuleDeps {
  repo?: AuthRepository;
  audit?: AuditLogger;
  policy?: AuthPolicy;
  /** Intentos de login por IP cada 15 min (además del bloqueo por cuenta). */
  loginRateLimit?: number;
}

/** Fábrica del módulo para poder inyectar repositorios en memoria en las pruebas. */
export function createAuthModule({
  repo = new PrismaAuthRepository(),
  audit = new PrismaAuditLogger(),
  policy,
  loginRateLimit = 30,
}: AuthModuleDeps = {}): AppModule {
  const controller = new AuthController(new AuthService(repo, audit, policy));

  const router = Router();
  router.post(
    '/login',
    rateLimit({
      windowMin: 15,
      max: loginRateLimit,
      message: 'Demasiados intentos de inicio de sesión. Espera unos minutos.',
    }),
    validate({ body: loginSchema }),
    controller.login,
  );
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.post(
    '/cambiar-password',
    authenticateAllowingTemporaryPassword,
    rateLimit({ windowMin: 15, max: loginRateLimit }),
    validate({ body: cambiarPasswordSchema }),
    controller.cambiarPassword,
  );

  return { name: 'auth', basePath: 'auth', router };
}

export const authModule = createAuthModule();
