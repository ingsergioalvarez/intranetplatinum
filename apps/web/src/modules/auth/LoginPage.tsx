import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import { loginSchema, type LoginInput } from '@platinum/shared';
import { ApiError } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { authService } from '../../core/auth/AuthService';
import { FullScreenSpinner } from '../../core/auth/ProtectedRoute';
import { Button, FormField, Input, PasswordInput } from '../../components/ui';
import { AuthLayout, FormAlert } from './AuthLayout';
import { erroresDeCampos } from '../../core/forms/fieldErrors';

type FieldErrors = Partial<Record<keyof LoginInput, string>>;

/** Mensaje general según el código del backend; los de validación van por campo. */
function mensajeDeError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado. Intenta de nuevo.';
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
    case 'ACCOUNT_LOCKED':
    case 'USER_INACTIVE':
    case 'TOO_MANY_REQUESTS':
    case 'NETWORK_ERROR':
      return error.message;
    default:
      return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }
}

export function LoginPage() {
  const { user, restoring } = useAuthStore();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';

  const [form, setForm] = useState<LoginInput>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const login = useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: () => navigate(from, { replace: true }),
    onError: (error) => {
      if (error instanceof ApiError && error.isValidation) setFieldErrors(error.fieldErrors);
    },
  });

  if (restoring) return <FullScreenSpinner />;
  if (user) return <Navigate to={from} replace />;

  const onChange = (campo: keyof LoginInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setFieldErrors((errs) => ({ ...errs, [campo]: undefined }));
    if (login.isError) login.reset();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) return setFieldErrors(erroresDeCampos(parsed.error));
    login.mutate(parsed.data);
  };

  const errorGeneral = login.isError && !(login.error instanceof ApiError && login.error.isValidation);
  const bloqueada = login.error instanceof ApiError && login.error.code === 'ACCOUNT_LOCKED';

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Entra con tu correo y contraseña."
      footer="¿Problemas para entrar? Contacta a tu supervisor o al administrador."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {errorGeneral && (
          <FormAlert
            tone={bloqueada ? 'warning' : 'error'}
            icon={bloqueada ? <LockKeyhole className="size-4" /> : undefined}
          >
            {mensajeDeError(login.error)}
          </FormAlert>
        )}

        <FormField label="Correo" error={fieldErrors.email}>
          <Input
            type="email"
            name="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="tu@correo.com"
            value={form.email}
            onChange={onChange('email')}
            autoFocus
          />
        </FormField>

        <FormField label="Contraseña" error={fieldErrors.password}>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            value={form.password}
            onChange={onChange('password')}
          />
        </FormField>

        <Button type="submit" size="lg" fullWidth loading={login.isPending}>
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
