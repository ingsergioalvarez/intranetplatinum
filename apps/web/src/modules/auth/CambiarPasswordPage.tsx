import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { cambiarPasswordSchema, type CambiarPasswordInput } from '@platinum/shared';
import { ApiError } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { authService } from '../../core/auth/AuthService';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { Button, FormField, PasswordInput, toast } from '../../components/ui';
import { AuthLayout, FormAlert } from './AuthLayout';

type Campos = CambiarPasswordInput & { confirmar: string };
type FieldErrors = Partial<Record<keyof Campos, string>>;

/**
 * Cambio de contraseña propio (F1-11). Obligatorio cuando el usuario entra con una
 * contraseña temporal (D-012); en ese caso no puede usar el resto de la app hasta cambiarla.
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
    const { confirmar, ...input } = form;
    const parsed = cambiarPasswordSchema.safeParse(input);
    const errores: FieldErrors = parsed.success ? {} : erroresDeCampos(parsed.error);
    if (confirmar !== form.nueva) errores.confirmar = 'Las contraseñas no coinciden';
    if (!parsed.success || errores.confirmar) return setFieldErrors(errores);
    cambiar.mutate(parsed.data);
  };

  const errorGeneral =
    cambiar.isError && !(cambiar.error instanceof ApiError && Object.keys(cambiar.error.fieldErrors).length);

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

        <FormField
          label={obligatorio ? 'Contraseña temporal' : 'Contraseña actual'}
          error={fieldErrors.actual}
        >
          <PasswordInput
            name="actual"
            autoComplete="current-password"
            value={form.actual}
            onChange={onChange('actual')}
            autoFocus
          />
        </FormField>

        <FormField
          label="Nueva contraseña"
          error={fieldErrors.nueva}
          hint="Mínimo 10 caracteres, con letras y números."
        >
          <PasswordInput
            name="nueva"
            autoComplete="new-password"
            value={form.nueva}
            onChange={onChange('nueva')}
          />
        </FormField>

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
