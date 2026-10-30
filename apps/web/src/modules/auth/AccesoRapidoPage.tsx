import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Smartphone, Trash2 } from 'lucide-react';
import { definirPinSchema, pinSchema, type DispositivoUsuarioVista } from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  FormField,
  FormModal,
  Input,
  PasswordInput,
  Spinner,
  toast,
} from '../../components/ui';
import { ApiError, mensajeDeError } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { actualizarPerfil, perfilDeUsuario, quitarPerfil } from '../../core/auth/perfiles';
import { formatFechaHora } from '../../core/format/fechas';
import { dispositivosService } from './dispositivos.service';

/**
 * Acceso rápido del guardia (A-40): PIN de 4 dígitos de este celular y celulares guardados.
 * El perfil se guarda solo al entrar con contraseña; aquí se crea el PIN y se quita lo que ya no sirva.
 */
export function AccesoRapidoPage() {
  const user = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [version, setVersion] = useState(0);
  const [pinAbierto, setPinAbierto] = useState(params.get('crear') === '1');
  const [quitando, setQuitando] = useState<DispositivoUsuarioVista | null>(null);
  const [quitandoPin, setQuitandoPin] = useState(false);

  // Se vuelve a leer la tarjeta local tras cada cambio (version).
  void version;
  const perfil = perfilDeUsuario(user.id);

  const lista = useQuery({ queryKey: dispositivosService.keys.mios, queryFn: dispositivosService.mios });

  // Sincroniza con el servidor: el PIN y el bloqueo mandan; si este celular ya no existe allá, se limpia aquí.
  useEffect(() => {
    if (!lista.data || !perfil) return;
    const este = lista.data.find((d) => d.id === perfil.dispositivoId);
    if (!este) {
      quitarPerfil(user.id);
      setVersion((v) => v + 1);
    } else if (este.tienePin !== perfil.tienePin || este.bloqueado !== perfil.bloqueado) {
      actualizarPerfil(user.id, { tienePin: este.tienePin, bloqueado: este.bloqueado });
      setVersion((v) => v + 1);
    }
  }, [lista.data, perfil, user.id]);

  const esteId = perfil?.dispositivoId ?? null;
  const este = lista.data?.find((d) => d.id === esteId);

  const refrescar = () => {
    setVersion((v) => v + 1);
    void qc.invalidateQueries({ queryKey: dispositivosService.keys.mios });
  };

  const quitarPin = useMutation({
    mutationFn: () => dispositivosService.quitarPin(esteId!),
    onSuccess: () => {
      actualizarPerfil(user.id, { tienePin: false, bloqueado: false });
      toast.success('PIN quitado: ahora entrarás con tu contraseña');
      setQuitandoPin(false);
      refrescar();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const quitar = useMutation({
    mutationFn: (d: DispositivoUsuarioVista) => dispositivosService.quitarMio(d.id),
    onSuccess: (_r, d) => {
      if (d.id === esteId) quitarPerfil(user.id);
      toast.success(d.id === esteId ? 'Este celular ya no recuerda tu perfil' : 'Celular quitado');
      setQuitando(null);
      refrescar();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const cerrarPin = () => {
    setPinAbierto(false);
    if (params.has('crear')) setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader title="Acceso rápido" subtitle="Entra con tu nombre y un PIN de 4 dígitos." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="PIN de este celular" />
          <div className="space-y-3 px-4 pb-4">
            {!perfil || !esteId ? (
              <p className="text-sm text-slate-600">
                Este celular aún no tiene tu perfil guardado. Cierra sesión y vuelve a entrar con tu contraseña:
                se guarda solo.
              </p>
            ) : (
              <>
                <p className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  Estado:
                  {este?.bloqueado ? (
                    <Badge tone="danger">Bloqueado</Badge>
                  ) : perfil.tienePin ? (
                    <Badge tone="success">Activo</Badge>
                  ) : (
                    <Badge tone="neutral">Sin PIN</Badge>
                  )}
                </p>
                {este?.bloqueado && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Se escribió mal el PIN 5 veces. Se libera solo al entrar con tu contraseña.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setPinAbierto(true)}>{perfil.tienePin ? 'Cambiar PIN' : 'Crear PIN'}</Button>
                  {perfil.tienePin && (
                    <Button variant="secondary" onClick={() => setQuitandoPin(true)}>
                      Quitar PIN
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  El PIN solo funciona en este celular. Sin PIN, tu tarjeta pide la contraseña.
                </p>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Celulares guardados" subtitle="Donde tu perfil aparece al entrar" />
          {lista.isPending ? (
            <div className="flex justify-center py-8 text-brand-600">
              <Spinner className="size-6" />
            </div>
          ) : lista.isError ? (
            <EmptyState title="No se pudo cargar" description="Revisa tu conexión." />
          ) : lista.data.length === 0 ? (
            <EmptyState icon={<Smartphone className="size-10" />} title="Ninguno" description="Aún no hay celulares guardados." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {lista.data.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <Smartphone className="size-5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-slate-900">
                      {d.etiqueta}
                      {d.id === esteId && <Badge tone="brand">Este celular</Badge>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {d.tienePin ? (d.bloqueado ? 'PIN bloqueado' : 'Con PIN') : 'Sin PIN'}
                      {d.ultimoUso && ` · Último uso ${formatFechaHora(d.ultimoUso)}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="size-4" />}
                    aria-label={`Quitar ${d.etiqueta}`}
                    onClick={() => setQuitando(d)}
                  >
                    <span className="hidden sm:inline">Quitar</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {pinAbierto && esteId && (
        <PinModal
          dispositivoId={esteId}
          cambia={!!perfil?.tienePin}
          onClose={cerrarPin}
          onGuardado={() => {
            actualizarPerfil(user.id, { tienePin: true, bloqueado: false });
            refrescar();
            cerrarPin();
          }}
        />
      )}
      <ConfirmDialog
        open={quitandoPin}
        title="Quitar el PIN"
        description="En este celular volverás a entrar con tu contraseña."
        confirmLabel="Quitar PIN"
        variant="danger"
        loading={quitarPin.isPending}
        onConfirm={() => quitarPin.mutate()}
        onCancel={() => setQuitandoPin(false)}
      />
      <ConfirmDialog
        open={!!quitando}
        title="Quitar este celular"
        description={
          quitando?.id === esteId
            ? 'Este celular dejará de recordar tu perfil. Para volver a entrar usarás tu correo y contraseña.'
            : `Se quitará "${quitando?.etiqueta}". En ese celular tendrán que entrar con correo y contraseña.`
        }
        confirmLabel="Quitar"
        variant="danger"
        loading={quitar.isPending}
        onConfirm={() => quitando && quitar.mutate(quitando)}
        onCancel={() => setQuitando(null)}
      />
    </>
  );
}

/** Crear o cambiar el PIN: 4 dígitos escritos dos veces y la contraseña. */
export function PinModal({
  dispositivoId,
  cambia,
  onClose,
  onGuardado,
}: {
  dispositivoId: number;
  cambia: boolean;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [pin, setPin] = useState('');
  const [repetir, setRepetir] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<Partial<Record<'pin' | 'repetir' | 'password', string>>>({});

  const guardar = useMutation({
    mutationFn: () => dispositivosService.definirPin(dispositivoId, { pin, password }),
    onSuccess: () => {
      toast.success(cambia ? 'PIN cambiado' : 'PIN creado: ya puedes entrar con él');
      onGuardado();
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrores(e.fieldErrors);
      else toast.error(mensajeDeError(e));
    },
  });

  const soloDigitos = (v: string) => v.replace(/\D/g, '').slice(0, 4);

  const onSubmit = () => {
    const nuevos: typeof errores = {};
    const p = pinSchema.safeParse(pin);
    if (!p.success) nuevos.pin = p.error.issues[0].message;
    else if (repetir !== pin) nuevos.repetir = 'Los PIN no coinciden';
    const d = definirPinSchema.safeParse({ pin, password });
    if (!d.success && !nuevos.pin) nuevos.password = d.error.issues.find((i) => i.path[0] === 'password')?.message;
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;
    guardar.mutate();
  };

  return (
    <FormModal
      title={cambia ? 'Cambiar PIN' : 'Crear PIN'}
      description="Son 4 dígitos. Solo sirve en este celular."
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Guardar PIN"
      loading={guardar.isPending}
      dirty={!!pin || !!repetir || !!password}
      size="sm"
    >
      <FormField label="PIN nuevo" required error={errores.pin}>
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(soloDigitos(e.target.value))}
          autoFocus
        />
      </FormField>
      <FormField label="Repite el PIN" required error={errores.repetir}>
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={repetir}
          onChange={(e) => setRepetir(soloDigitos(e.target.value))}
        />
      </FormField>
      <FormField label="Tu contraseña" required error={errores.password} hint="Para confirmar que eres tú.">
        <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </FormField>
    </FormModal>
  );
}
