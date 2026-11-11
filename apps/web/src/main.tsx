import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './core/api';
import { router } from './app/router';
import { authService } from './core/auth/AuthService';
import { Toaster } from './components/ui';
import { ExigirInstalacion } from './components/layout/ExigirInstalacion';
import { iniciarInstalacion } from './core/pwa/instalacion';
import { instalarManejoDeFotos } from './core/ui/fotosRotas';
import './index.css';

// iOS ignora user-scalable=no: se bloquea el pellizco de zoom de la página (A-23).
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Fotos con enlace caducado o archivo faltante: se renuevan o se muestra una silueta (A-53).
instalarManejoDeFotos();

// La instalación de la app se pide en celulares y tabletas (A-70): se escucha desde ya porque el navegador avisa una sola vez.
iniciarInstalacion();

// Recupera la sesión con la cookie de refresh antes de decidir si mostrar el login.
void authService.restore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ExigirInstalacion />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
