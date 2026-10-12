import type { HealthStatus } from '@platinum/shared';
import { BaseService } from '../../core';

export class HealthService extends BaseService {
  constructor(private readonly version: string) {
    super();
  }

  getStatus(): HealthStatus {
    return {
      status: 'ok',
      service: 'platinum-api',
      version: this.version,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
