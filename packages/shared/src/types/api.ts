export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface HealthStatus {
  status: 'ok';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}
