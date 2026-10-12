import type { ApiResponse } from '@platinum/shared';
import { ApiError } from './ApiError';

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Evita el reintento con refresh (lo usan las propias rutas de auth). */
  skipAuthRefresh?: boolean;
}

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken: () => string | null;
  /** Intenta renovar la sesión; devuelve true si lo logró. */
  refreshSession?: () => Promise<boolean>;
  onUnauthorized?: () => void;
}

/**
 * Cliente HTTP único de la app. Agrega el token, envía cookies (refresh token httpOnly),
 * desenvuelve `{ ok, data }` y convierte errores a `ApiError`.
 */
export class ApiClient {
  private refreshing: Promise<boolean> | null = null;

  constructor(private readonly config: ApiClientConfig) {}

  /** Permite conectar el refresh de sesión después de crear la instancia (lo hace `AuthService`). */
  setRefreshSession(fn: () => Promise<boolean>) {
    this.config.refreshSession = fn;
  }

  get<T>(path: string, opts?: Omit<RequestOptions, 'body'>) {
    return this.request<T>('GET', path, opts);
  }

  post<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return this.request<T>('POST', path, { ...opts, body });
  }

  put<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return this.request<T>('PUT', path, { ...opts, body });
  }

  patch<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return this.request<T>('PATCH', path, { ...opts, body });
  }

  delete<T = void>(path: string, opts?: RequestOptions) {
    return this.request<T>('DELETE', path, opts);
  }

  /** Envío multipart (fotos de evidencia). */
  upload<T>(path: string, form: FormData, opts?: Omit<RequestOptions, 'body'>) {
    return this.request<T>('POST', path, { ...opts, body: form });
  }

  private buildUrl(path: string, query?: Query) {
    const url = `${this.config.baseUrl}${path}`;
    if (!query) return url;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }

  private async request<T>(
    method: string,
    path: string,
    opts: RequestOptions = {},
    retried = false,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = this.config.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let body: BodyInit | undefined;
    if (opts.body instanceof FormData) {
      body = opts.body;
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }

    let res: Response;
    try {
      res = await fetch(this.buildUrl(path, opts.query), {
        method,
        headers,
        body,
        signal: opts.signal,
        credentials: 'include',
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw ApiError.network();
    }

    if (res.status === 401 && !retried && !opts.skipAuthRefresh && this.config.refreshSession) {
      if (await this.refreshOnce()) return this.request<T>(method, path, opts, true);
      this.config.onUnauthorized?.();
    }

    if (res.status === 204) return undefined as T;

    const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
    if (!res.ok || !json?.ok) throw ApiError.fromBody(res.status, json?.error);
    return json.data as T;
  }

  /** Varias peticiones con 401 simultáneo comparten un solo refresh. */
  private refreshOnce() {
    this.refreshing ??= this.config.refreshSession!().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }
}
