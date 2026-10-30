import { useCallback, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, EllipsisVertical, LockKeyhole, Plus } from 'lucide-react';
import { loginSchema, type LoginInput } from '@platinum/shared';
import { ApiError, api } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { authService } from '../../core/auth/AuthService';
import {
  actualizarPerfil,
  perfilesGuardados,
  quitarPerfil,
  type PerfilRapido,
} from '../../core/auth/perfiles';
import { FullScreenSpinner } from '../../core/auth/ProtectedRoute';
import { Button, ConfirmDialog, FormField, Input, PasswordInput } from '../../components/ui';
import { AuthLayout, FormAlert } from './AuthLayout';
import { PerfilAvatar } from './PerfilAvatar';
import { PinPad } from './PinPad';
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
    case 'PIN_INVALID':
    case 'PIN_BLOCKED':
    case 'DEVICE_INVALID':
      return error.message;
    default:
      return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }
}

/** tarjetas: perfiles guardados; pin: teclado; password: perfil elegido sin PIN; formulario: correo y contraseña. */
type Modo = 'tarjetas' | 'pin' | 'password' | 'formulario';

/**
 * Entrada (F1-xx, A-40): si el celular recuerda a guardias, muestra sus tarjetas (iniciales y nombre);
 * tocar una pide el PIN de 4 dígitos, o la contraseña si no tiene PIN. "Usar otro perfil" abre el formulario.
 */
export function LoginPage() {
  const { user, restoring } = useAuthStore();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';

  const [perfiles, setPerfiles] = useState<PerfilRapido[]>(() => perfilesGuardados());
  const [modo, setModo] = useState<Modo>(perfiles.length ? 'tarjetas' : 'formulario');
  const [elegido, setElegido] = useState<PerfilRapido | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<PerfilRapido | null>(null);

  const [form, setForm] = useState<LoginInput>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pin, setPin] = useState('');
  const [errorPin, setErrorPin] = useState<string | null>(null);

  const refrescar = useCallback(() => {
    const lista = perfilesGuardados();
    setPerfiles(lista);
    return lista;
  }, []);

  const login = useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: () => navigate(from, { replace: true }),
    onError: (error) => {
      if (error instanceof ApiError && error.isValidation) setFieldErrors(error.fieldErrors);
    },
  });

  const conPin = useMutation({
    mutationFn: ({ perfil, codigo }: { perfil: PerfilRapido; codigo: string }) =>
      authService.loginConPin(perfil, codigo),
    onSuccess: () => navigate(from, { replace: true }),
    onError: (error, { perfil }) => {
      setPin('');
      if (error instanceof ApiError && error.code === 'PIN_BLOCKED') {
        actualizarPerfil(perfil.usuarioId, { bloqueado: true });
        setElegido({ ...perfil, bloqueado: true });
        refrescar();
        setAviso(error.message);
        irAPassword(perfil);
      } else if (error instanceof ApiError && error.code === 'DEVICE_INVALID') {
        // El perfil ya no existe en el servidor (lo quitó el admin o el propio guardia): se limpia aquí.
        quitarPerfil(perfil.usuarioId);
        const lista = refrescar();
        setAviso(error.message);
        setElegido(null);
        setModo(lista.length ? 'tarjetas' : 'formulario');
      } else {
        setErrorPin(mensajeDeError(error));
      }
    },
  });

  if (restoring) return <FullScreenSpinner />;
  if (user) return <Navigate to={from} replace />;

  function irAPassword(perfil: PerfilRapido) {
    setForm({ email: perfil.email, password: '' });
    setFieldErrors({});
    login.reset();
    setModo('password');
  }

  const elegir = (perfil: PerfilRapido) => {
    setElegido(perfil);
    setAviso(null);
    setErrorPin(null);
    setPin('');
    conPin.reset();
    if (perfil.tienePin && !perfil.bloqueado) setModo('pin');
    else {
      if (perfil.bloqueado) setAviso('Tu PIN se bloqueó. Entra con tu contraseña para volver a usarlo.');
      irAPassword(perfil);
    }
  };

  const volver = () => {
    setElegido(null);
    setAviso(null);
    setErrorPin(null);
    setPin('');
    login.reset();
    setModo(refrescar().length ? 'tarjetas' : 'formulario');
  };

  const otroPerfil = () => {
    setElegido(null);
    setAviso(null);
    setForm({ email: '', password: '' });
    setFieldErrors({});
    login.reset();
    setModo('formulario');
  };

  const quitarTarjeta = async () => {
    const perfil = quitando;
    if (!perfil) return;
    // La clave del celular se cancela también en el servidor; si no hay red, al menos se borra de aquí.
    await api.post('/auth/perfil-rapido/quitar', { token: perfil.token }, { skipAuthRefresh: true }).catch(() => undefined);
    quitarPerfil(perfil.usuarioId);
    setQuitando(null);
    if (!refrescar().length) setModo('formulario');
  };

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

  const alertas = (
    <>
      {aviso && !errorGeneral && (
        <FormAlert tone="warning" icon={<LockKeyhole className="size-4" />}>
          {aviso}
        </FormAlert>
      )}
      {errorGeneral && (
        <FormAlert
          tone={bloqueada ? 'warning' : 'error'}
          icon={bloqueada ? <LockKeyhole className="size-4" /> : undefined}
        >
          {mensajeDeError(login.error)}
        </FormAlert>
      )}
    </>
  );

  if (modo === 'tarjetas') {
    return (
      <AuthLayout
        title="¿Quién va a entrar?"
        subtitle="Toca tu nombre."
        footer="¿Problemas para entrar? Contacta a tu supervisor o al administrador."
      >
        <div className="space-y-3">
          {aviso && (
            <FormAlert tone="warning" icon={<LockKeyhole className="size-4" />}>
              {aviso}
            </FormAlert>
          )}
          <ul className="space-y-3">
            {perfiles.map((p) => (
              <li key={p.usuarioId} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => elegir(p)}
                  className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-xs active:bg-slate-50"
                >
                  <PerfilAvatar nombre={p.nombre} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base leading-tight font-semibold break-words text-slate-900">
                      {p.nombre}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {p.bloqueado ? 'PIN bloqueado: usa tu contraseña' : p.tienePin ? 'Entra con tu PIN' : 'Entra con tu contraseña'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuitando(p)}
                  aria-label={`Quitar a ${p.nombre} de este dispositivo`}
                  className="flex w-10 shrink-0 items-center justify-center rounded-2xl text-slate-500 active:bg-slate-100"
                >
                  <EllipsisVertical className="size-5" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" size="lg" fullWidth icon={<Plus className="size-4" />} onClick={otroPerfil}>
            Usar otro perfil
          </Button>
        </div>
        <ConfirmDialog
          open={!!quitando}
          title="Quitar de este dispositivo"
          description={
            <>
              Se quitará a <strong>{quitando?.nombre}</strong> de este celular. Para volver a entrar tendrá que
              usar su correo y contraseña.
            </>
          }
          confirmLabel="Quitar"
          variant="danger"
          onConfirm={() => void quitarTarjeta()}
          onCancel={() => setQuitando(null)}
        />
      </AuthLayout>
    );
  }

  if (modo === 'pin' && elegido) {
    return (
      <AuthLayout title="Escribe tu PIN">
        <div className="space-y-5 text-center">
          <button
            type="button"
            onClick={volver}
            className="flex items-center gap-1 text-sm font-medium text-slate-500"
          >
            <ArrowLeft className="size-4" /> Cambiar de perfil
          </button>
          <div className="flex flex-col items-center gap-2">
            <PerfilAvatar nombre={elegido.nombre} className="size-16 text-xl" />
            <p className="text-base font-semibold break-words text-slate-900">{elegido.nombre}</p>
          </div>
          {errorPin && (
            <FormAlert tone="error">{errorPin}</FormAlert>
          )}
          <PinPad
            valor={pin}
            onChange={(v) => {
              setPin(v);
              setErrorPin(null);
            }}
            onCompleto={(codigo) => conPin.mutate({ perfil: elegido, codigo })}
            deshabilitado={conPin.isPending}
            error={!!errorPin}
          />
          <button
            type="button"
            onClick={() => irAPassword(elegido)}
            className="text-sm font-medium text-brand-700"
          >
            Entrar con mi contraseña
          </button>
        </div>
      </AuthLayout>
    );
  }

  const conPerfil = modo === 'password' && elegido;
  return (
    <AuthLayout
      title={conPerfil ? 'Escribe tu contraseña' : 'Iniciar sesión'}
      subtitle={conPerfil ? undefined : 'Entra con tu correo y contraseña.'}
      footer="¿Problemas para entrar? Contacta a tu supervisor o al administrador."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {perfiles.length > 0 && (
          <button type="button" onClick={volver} className="flex items-center gap-1 text-sm font-medium text-slate-500">
            <ArrowLeft className="size-4" /> {conPerfil ? 'Cambiar de perfil' : 'Volver a los perfiles'}
          </button>
        )}
        {alertas}

        {conPerfil ? (
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <PerfilAvatar nombre={elegido.nombre} />
            <div className="min-w-0">
              <p className="text-base leading-tight font-semibold break-words text-slate-900">{elegido.nombre}</p>
              <p className="truncate text-xs text-slate-500">{elegido.email}</p>
            </div>
          </div>
        ) : (
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
        )}

        <FormField label="Contraseña" error={fieldErrors.password}>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            value={form.password}
            onChange={onChange('password')}
            autoFocus={!!conPerfil}
          />
        </FormField>

        <Button type="submit" size="lg" fullWidth loading={login.isPending}>
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
