import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './core/api';
import { router } from './app/router';
import { authService } from './core/auth/AuthService';
import { Toaster } from './components/ui';
import './index.css';

// iOS ignora user-scalable=no: se bloquea el pellizco de zoom de la página (A-23).
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Recupera la sesión con la cookie de refresh antes de decidir si mostrar el login.
void authService.restore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
