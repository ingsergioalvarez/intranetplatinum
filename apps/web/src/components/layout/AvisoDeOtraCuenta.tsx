import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../../core/auth/AuthService';
import { useAuthStore } from '../../core/auth/authStore';

/** Solo se cambia de cuenta una vez por apertura de la app: si la persona entra con otra, se deja pasar. */
let cambioHecho = false;

/**
 * Celular compartido (A-77): la notificación trae `?para=<id de la cuenta>`. Si la sesión abierta es de esa cuenta, el
 * parámetro se quita y se ve el aviso. Si es de otra, se cierra esa sesión y la app pide entrar con la cuenta del
 * aviso (con su PIN), y después abre el aviso. Sin sesión, la pantalla de entrada ya hace lo mismo.
 */
export function AvisoDeOtraCuenta() {
  const user = useAuthStore((s) => s.user);
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const para = Number(params.get('para'));
    if (!para || !user) return;
    if (user.id !== para && !cambioHecho) {
      cambioHecho = true;
      // Al quedar sin sesión, la ruta protegida manda a la entrada conservando este destino (con `para`).
      void authService.cambiarDeCuenta();
      return;
    }
    params.delete('para');
    const resto = params.toString();
    navigate({ pathname, search: resto ? `?${resto}` : '' }, { replace: true });
  }, [user, pathname, search, navigate]);

  return null;
}
