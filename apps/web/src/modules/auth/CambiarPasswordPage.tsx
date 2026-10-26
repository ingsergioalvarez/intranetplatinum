import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Check, KeyRound } from 'lucide-react';
import { cambiarPasswordSchema, type CambiarPasswordInput } from '@platinum/shared';
import { ApiError } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { authService } from '../../core/auth/AuthService';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { Button, FormField, PasswordInput, toast } from '../../components/ui';
import { AuthLayout, FormAlert } from './AuthLayout';

type Campos = {
  actual: string;
  nueva: string;
  confirmar: string;
};
type FieldErrors = Partial<Record<keyof Campos, string>>;

/**
 * Cambio de contraseña propio (F1-11). Obligatorio cuando el usuario entra con una
 * contraseña temporal (D-012); en ese caso no vuelve a pedir la temporal (ya la comprobó
 * al entrar) y define directamente su nueva contraseña con dos campos y reglas visibles.
 */
export function CambiarPasswordPage() {
  const obligatorio = useAuthStore((s) => s.user?.debeCambiarPassword ?? false);
  const navigate = useNavigate();
  const [form, setForm] = useState<Campos>({ actual: '', nueva: '', confirmar: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const cambiar = useMutation({
    mutationFn: (input: CambiarPasswordInput) => authService.cambiarPassword(input),
    onSuccess: () => {
      toast.success('Contraseña actualizada');
      navigate('/', { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors);
    },
  });

  const onChange = (campo: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setFieldErrors((errs) => ({ ...errs, [campo]: undefined }));
    if (cambiar.isError) cambiar.reset();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input: CambiarPasswordInput = obligatorio
      ? { nueva: form.nueva }
      : { actual: form.actual, nueva: form.nueva };

    const parsed = cambiarPasswordSchema.safeParse(input);
    const errores: FieldErrors = parsed.success ? {} : erroresDeCampos(parsed.error);
    if (!obligatorio && !form.actual.trim()) {
      errores.actual = 'Escribe tu contraseña actual';
    }
    if (!form.confirmar) {
      errores.confirmar = 'Confirma tu nueva contraseña';
    } else if (form.confirmar !== form.nueva) {
      errores.confirmar = 'Las contraseñas no coinciden';
    }
    if (Object.keys(errores).length > 0) return setFieldErrors(errores);
    cambiar.mutate(input);
  };

  const errorGeneral =
    cambiar.isError && !(cambiar.error instanceof ApiError && Object.keys(cambiar.error.fieldErrors).length);

  const cumpleLongitud = form.nueva.length >= 10;
  const cumpleLetra = /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(form.nueva);
  const cumpleNumero = /\d/.test(form.nueva);

  return (
    <AuthLayout
      title={obligatorio ? 'Crea tu contraseña' : 'Cambiar contraseña'}
      subtitle={
        obligatorio
          ? 'Entraste con una contraseña temporal. Por seguridad, define una nueva para continuar.'
          : 'Al cambiarla se cerrará tu sesión en los demás dispositivos.'
      }
      footer={
        obligatorio ? (
          <button
            type="button"
            className="font-medium text-slate-500 underline-offset-2 hover:underline"
            onClick={() => void authService.logout()}
          >
            Cerrar sesión
          </button>
        ) : (
          <Link to="/" className="font-medium text-slate-500 underline-offset-2 hover:underline">
            Cancelar
          </Link>
        )
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {errorGeneral && (
          <FormAlert>
            {cambiar.error instanceof ApiError
              ? cambiar.error.message
              : 'No se pudo cambiar la contraseña. Intenta de nuevo.'}
          </FormAlert>
        )}

        {!obligatorio && (
          <FormField label="Contraseña actual" error={fieldErrors.actual}>
            <PasswordInput
              name="actual"
              autoComplete="current-password"
              value={form.actual}
              onChange={onChange('actual')}
              autoFocus
            />
          </FormField>
        )}

        <div>
          <FormField label="Nueva contraseña" error={fieldErrors.nueva}>
            <PasswordInput
              name="nueva"
              autoComplete="new-password"
              value={form.nueva}
              onChange={onChange('nueva')}
              autoFocus={obligatorio}
            />
          </FormField>
          <ul className="mt-2.5 space-y-1.5 text-xs">
            <li
              className={`flex items-center gap-1.5 transition-colors ${
                cumpleLongitud ? 'font-medium text-emerald-600' : 'text-slate-500'
              }`}
            >
              <Check className={`size-3.5 ${cumpleLongitud ? 'text-emerald-600' : 'text-slate-300'}`} />
              Mínimo 10 caracteres
            </li>
            <li
              className={`flex items-center gap-1.5 transition-colors ${
                cumpleLetra ? 'font-medium text-emerald-600' : 'text-slate-500'
              }`}
            >
              <Check className={`size-3.5 ${cumpleLetra ? 'text-emerald-600' : 'text-slate-300'}`} />
              Al menos una letra
            </li>
            <li
              className={`flex items-center gap-1.5 transition-colors ${
                cumpleNumero ? 'font-medium text-emerald-600' : 'text-slate-500'
              }`}
            >
              <Check className={`size-3.5 ${cumpleNumero ? 'text-emerald-600' : 'text-slate-300'}`} />
              Al menos un número
            </li>
          </ul>
        </div>

        <FormField label="Confirmar nueva contraseña" error={fieldErrors.confirmar}>
          <PasswordInput
            name="confirmar"
            autoComplete="new-password"
            value={form.confirmar}
            onChange={onChange('confirmar')}
          />
        </FormField>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={cambiar.isPending}
          icon={<KeyRound className="size-4" />}
        >
          Guardar contraseña
        </Button>
      </form>
    </AuthLayout>
  );
}
