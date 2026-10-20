import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler, notFoundHandler, type AppModule } from './core';
import { modules as defaultModules } from './modules';

export function createApp(modules: AppModule[] = defaultModules) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.APP_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Raíz: confirma que la API está en línea y orienta a quien la abre en el navegador.
  app.get(['/', '/api'], (_req, res) => {
    res.json({
      ok: true,
      data: {
        servicio: 'API Platinum Intranet',
        estado: 'en línea',
        salud: '/api/health',
        modulos: modules.map((m) => `/api/${m.basePath}`),
        web: env.APP_URL,
      },
    });
  });

  for (const mod of modules) {
    app.use(`/api/${mod.basePath}`, mod.router);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
