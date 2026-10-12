import { Router } from 'express';
import { authenticate, type AppModule } from '../../core';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

const controller = new HealthController(new HealthService(process.env.npm_package_version ?? '0.1.0'));

const router = Router();
router.get('/', controller.status);
router.get('/me', authenticate, controller.me);

export const healthModule: AppModule = {
  name: 'health',
  basePath: 'health',
  router,
};
