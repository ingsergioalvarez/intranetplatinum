import { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../auth/authStore';
import { ApiClient } from './ApiClient';
import { ApiError } from './ApiError';

export { ApiClient } from './ApiClient';
export { ApiError, mensajeDeError } from './ApiError';
export { CrudService, type ListParams } from './CrudService';

/** Instancia única del cliente HTTP. El refresh de sesión lo conecta `core/auth/AuthService`. */
export const api = new ApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? '/api',
  getAccessToken: () => useAuthStore.getState().accessToken,
  onUnauthorized: () => useAuthStore.getState().clear(),
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // No reintentar errores de negocio (4xx); sí fallas de red / 5xx.
      retry: (count, error) =>
        count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});
