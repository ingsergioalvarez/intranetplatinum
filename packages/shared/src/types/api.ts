export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
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
  timestamp: string;
}
