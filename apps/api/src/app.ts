import express from 'express';
import type { ApiResponse, HealthStatus } from '@platinum/shared';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const body: ApiResponse<HealthStatus> = {
      ok: true,
      data: { status: 'ok', service: 'platinum-api', timestamp: new Date().toISOString() },
    };
    res.json(body);
  });

  return app;
}
