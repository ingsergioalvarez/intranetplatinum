import { Router } from 'express';
import { z } from 'zod';
import {
  ROLES,
  cambiarPasswordSchema,
  definirPinSchema,
  idParamSchema,
  loginSchema,
  pendientesPerfilesSchema,
  perfilRapidoSchema,
  quitarPerfilSchema,
} from '@platinum/shared';
import { env } from '../../config/env';
import {
  AuditLogger,
  PrismaAuditLogger,
  authenticate,
  authenticateAllowingTemporaryPassword,
  requireRoles,
  rateLimit,
  validate,
  type AppModule,
} from '../../core';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { AuthController } from './auth.controller';
import { AuthRepository, PrismaAuthRepository } from './auth.repository';
import { AuthService, type AuthPolicy } from './auth.service';
import { responsablesDeGuardiaConPrisma, type ResponsablesDeGuardia } from './responsables';

interface AuthModuleDeps {
  repo?: AuthRepository;
  audit?: AuditLogger;
  policy?: AuthPolicy;
  /** Intentos de login por IP cada 15 min (además del bloqueo por cuenta). */
  loginRateLimit?: number;
  /** Avisos cuando se bloquea la cuenta de un guardia (A-86). */
  avisar?: AvisarUsuarios;
  responsables?: ResponsablesDeGuardia;
}

/** Fábrica del módulo para poder inyectar repositorios en memoria en las pruebas. */
export function createAuthModule({
  repo = new PrismaAuthRepository(),
  audit = new PrismaAuditLogger(),
  policy,
  loginRateLimit = env.LOGIN_RATE_LIMIT,
  avisar = avisarConPrisma,
  responsables = responsablesDeGuardiaConPrisma,
}: AuthModuleDeps = {}): AppModule {
  const controller = new AuthController(new AuthService(repo, audit, policy, avisar, responsables));

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
  // Perfiles rápidos de guardias (A-40): entrar con la tarjeta y el PIN de este celular.
  router.post(
    '/perfil-rapido',
    rateLimit({
      windowMin: 15,
      max: loginRateLimit,
      message: 'Demasiados intentos. Espera unos minutos.',
    }),
    validate({ body: perfilRapidoSchema }),
    controller.perfilRapido,
  );
  // Burbuja roja de las tarjetas (A-58): solo devuelve cuántos avisos sin leer tiene cada una.
  router.post(
    '/perfiles/pendientes',
    rateLimit({ windowMin: 15, max: loginRateLimit }),
    validate({ body: pendientesPerfilesSchema }),
    controller.pendientesPerfiles,
  );
  router.post(
    '/perfil-rapido/quitar',
    rateLimit({ windowMin: 15, max: loginRateLimit }),
    validate({ body: quitarPerfilSchema }),
    controller.quitarPerfilRapido,
  );
  // Cualquier usuario con sesión maneja sus propios celulares.
  const guardia = [authenticate];
  router.post('/dispositivos', ...guardia, controller.guardarMiDispositivo);
  router.get('/dispositivos', ...guardia, controller.misDispositivos);
  router.put('/dispositivos/:id/pin', ...guardia, validate({ params: idParamSchema, body: definirPinSchema }), controller.definirPin);
  router.delete('/dispositivos/:id/pin', ...guardia, validate({ params: idParamSchema }), controller.quitarPin);
  router.delete('/dispositivos/:id', ...guardia, validate({ params: idParamSchema }), controller.quitarMiDispositivo);
  // Solo el admin ve y quita los celulares de un guardia.
  const admin = [authenticate, requireRoles(ROLES.ADMIN)];
  const usuarioParam = z.object({ usuarioId: idParamSchema.shape.id });
  router.get('/usuarios/:usuarioId/dispositivos', ...admin, validate({ params: usuarioParam }), controller.dispositivosDe);
  router.delete('/usuarios/:usuarioId/dispositivos', ...admin, validate({ params: usuarioParam }), controller.quitarTodosDe);
  router.delete(
    '/usuarios/:usuarioId/dispositivos/:id',
    ...admin,
    validate({ params: usuarioParam.extend({ id: idParamSchema.shape.id }) }),
    controller.quitarDispositivoDe,
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
