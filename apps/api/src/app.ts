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

  for (const mod of modules) {
    app.use(`/api/${mod.basePath}`, mod.router);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
