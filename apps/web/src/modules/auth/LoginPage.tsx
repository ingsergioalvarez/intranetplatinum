import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { PERMISOS_POR_ROL, ROLES, type Rol } from '@platinum/shared';
import { useAuthStore } from '../../core/auth/authStore';
import { Button, Card, CardBody } from '../../components/ui';

/**
 * Placeholder de login. El formulario real con la API se implementa en F1-03.
 * En desarrollo permite entrar con una sesión de demostración para revisar el layout.
 */
export function LoginPage() {
  const { user, setSession } = useAuthStore();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';

  if (user) return <Navigate to={from} replace />;

  const demo = (rol: Rol) => {
    setSession(
      { id: 0, nombre: `Demo ${rol}`, email: `${rol}@demo.local`, rol, permisos: PERMISOS_POR_ROL[rol] },
      'demo-token',
    );
    navigate(from, { replace: true });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-900 px-4">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-6 p-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <ShieldCheck className="size-10 text-brand-700" />
            <h1 className="text-xl font-bold">Platinum Intranet</h1>
            <p className="text-sm text-slate-500">El inicio de sesión se habilita en la tarea F1-03.</p>
          </div>
          {import.meta.env.DEV && (
            <div className="space-y-2">
              <p className="text-center text-xs font-medium uppercase tracking-wide text-slate-400">
                Sesión demo (solo desarrollo)
              </p>
              {(Object.values(ROLES) as Rol[]).map((rol) => (
                <Button key={rol} variant="secondary" fullWidth onClick={() => demo(rol)}>
                  Entrar como {rol}
                </Button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
