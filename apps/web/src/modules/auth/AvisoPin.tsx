import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { Button } from '../../components/ui';
import { useAuthStore } from '../../core/auth/authStore';
import { alCambiarPerfiles, avisoPinOculto, ocultarAvisoPin, perfilDeUsuario } from '../../core/auth/perfiles';

/**
 * "Entra más rápido" (A-40): a quien tiene su perfil guardado en este celular y no tiene PIN le ofrece
 * crearlo. "Ahora no" lo oculta hasta que cierre su sesión; siempre se puede crear después en Acceso rápido.
 * Se actualiza solo al crear o quitar el PIN.
 */
export function AvisoPin() {
  const user = useAuthStore((s) => s.user);
  const [, rerender] = useState(0);
  useEffect(() => alCambiarPerfiles(() => rerender((n) => n + 1)), []);
  if (!user || user.debeCambiarPassword) return null;
  const perfil = perfilDeUsuario(user.id);
  if (!perfil || perfil.tienePin || avisoPinOculto(user.id)) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 p-3 ring-1 ring-brand-100 ring-inset">
      <LockKeyhole className="size-5 shrink-0 text-brand-700" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-brand-900">Entra más rápido</p>
        <p className="text-brand-800">Crea un PIN de 4 dígitos para entrar con tu nombre.</p>
      </div>
      <div className="flex gap-2">
        <Link to="/acceso-rapido?crear=1">
          <Button size="sm">Crear PIN</Button>
        </Link>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => ocultarAvisoPin(user.id)}
        >
          Ahora no
        </Button>
      </div>
    </div>
  );
}
