import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus } from 'lucide-react';
import {
  MAX_ACCESOS_CLIENTE,
  accesoClienteNuevoSchema,
  type AccesoClienteCreado,
  type AccesoClienteData,
  type ClienteDetalle,
} from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { formatFechaHora } from '../../core/format/fechas';
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
  Select,
  Spinner,
  cn,
  toast,
} from '../../components/ui';
import { PasswordTemporalModal } from '../usuarios/PasswordTemporalModal';
import { clientesService } from './clientes.service';

/**
 * Usuarios del cliente con acceso a la intranet (A-29): máximo 2, ven lo mismo desde su cuenta.
 * Solo el administrador los da de alta; se le entrega la contraseña temporal para mandarla.
 */
export function AccesosClienteCard({ cliente, puedeEditar }: { cliente: ClienteDetalle; puedeEditar: boolean }) {
  const [agregando, setAgregando] = useState(false);
  const [creado, setCreado] = useState<AccesoClienteCreado | null>(null);
  const activos = cliente.accesos.filter((a) => a.activo);
  const lleno = activos.length >= MAX_ACCESOS_CLIENTE;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="size-4 text-slate-400" />
            Acceso a la intranet
          </span>
        }
        subtitle={`${activos.length} de ${MAX_ACCESOS_CLIENTE} usuarios`}
        actions={
          puedeEditar && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="size-4" />}
              disabled={lleno}
              onClick={() => setAgregando(true)}
            >
              Crear acceso
            </Button>
          )
        }
      />
      {cliente.accesos.length === 0 ? (
        <EmptyState
          title="Sin acceso"
          description="Crea el acceso para que el cliente vea sus sitios, guardias y reportes."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {cliente.accesos.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{a.nombre}</p>
                <p className="truncate text-sm text-slate-500">{a.email}</p>
                <p className="text-xs text-slate-500">
                  {a.ultimoAcceso ? `Último acceso ${formatFechaHora(a.ultimoAcceso)}` : 'Aún no ha entrado'}
                </p>
              </div>
              {!a.activo ? (
                <Badge tone="neutral">De baja</Badge>
              ) : a.debeCambiarPassword ? (
                <Badge tone="warning">Contraseña temporal</Badge>
              ) : (
                <Badge tone="success">Activo</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      {agregando && (
        <AccesoModal
          cliente={cliente}
          onClose={() => setAgregando(false)}
          onCreado={(r) => {
            setAgregando(false);
            if (r.passwordTemporal) setCreado(r);
            else toast.success('Usuario ligado al cliente');
          }}
        />
      )}
      <PasswordTemporalModal
        titulo="Acceso del cliente creado"
        resultado={
          creado?.passwordTemporal
            ? { usuario: creado.acceso, passwordTemporal: creado.passwordTemporal }
            : null
        }
        onClose={() => setCreado(null)}
      />
    </Card>
  );
}

function AccesoModal({
  cliente,
  onClose,
  onCreado,
}: {
  cliente: ClienteDetalle;
  onClose: () => void;
  onCreado: (r: AccesoClienteCreado) => void;
}) {
  const qc = useQueryClient();
  const disponibles = useQuery({
    queryKey: [...clientesService.keys.all, 'accesos-disponibles', cliente.id],
    queryFn: () => clientesService.accesosDisponibles(cliente.id),
  });
  const lista = disponibles.data ?? [];
  const [modo, setModo] = useState<'existente' | 'nuevo' | null>(null);
  // Con usuarios cliente libres se ofrece elegirlos; si no hay, solo crear uno nuevo.
  const modoActual = modo ?? (lista.length > 0 ? 'existente' : 'nuevo');
  const [elegido, setElegido] = useState('');
  const [errorElegido, setErrorElegido] = useState<string | undefined>();
  const [confirmar, setConfirmar] = useState<AccesoClienteData | null>(null);
  const form = useForm({ nombre: '', email: '' });

  const crear = useMutation({
    mutationFn: (data: AccesoClienteData) => clientesService.crearAcceso(cliente.id, data),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: clientesService.keys.all });
      onCreado(r);
    },
    onError: (e) => {
      setConfirmar(null);
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });
  const { errors, bind } = form;

  const onSubmit = () => {
    if (modoActual === 'existente') {
      if (!elegido) return setErrorElegido('Elige un usuario');
      setErrorElegido(undefined);
      return setConfirmar({ usuarioId: Number(elegido) });
    }
    const data = form.validar(accesoClienteNuevoSchema);
    if (data) setConfirmar(data);
  };

  const quien = confirmar
    ? 'usuarioId' in confirmar
      ? lista.find((u) => u.id === confirmar.usuarioId)
      : confirmar
    : null;

  return (
    <FormModal
      title="Crear acceso del cliente"
      description={cliente.nombreComercial}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Continuar"
      loading={crear.isPending}
      dirty={form.cambiado || !!elegido}
      size="sm"
    >
      {disponibles.isPending ? (
        <div className="flex justify-center py-6 text-brand-600">
          <Spinner className="size-6" />
        </div>
      ) : (
        <>
          {lista.length > 0 && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
              {(['existente', 'nuevo'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  className={cn(
                    'rounded-lg px-3 py-2',
                    modoActual === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600',
                  )}
                >
                  {m === 'existente' ? 'Elegir de la lista' : 'Crear nuevo'}
                </button>
              ))}
            </div>
          )}

          {modoActual === 'existente' ? (
            <FormField
              label="Usuario cliente"
              required
              error={errorElegido}
              hint="Solo aparecen usuarios con rol Cliente que aún no tienen un cliente asignado."
            >
              <Select
                value={elegido}
                onChange={(e) => setElegido(e.target.value)}
                placeholder="Elige un usuario"
                options={lista.map((u) => ({ value: String(u.id), label: `${u.nombre} · ${u.email}` }))}
              />
            </FormField>
          ) : (
            <>
              <FormField label="Nombre" required error={errors.nombre}>
                <Input {...bind('nombre')} autoFocus />
              </FormField>
              <FormField
                label="Correo"
                required
                error={errors.email}
                hint="Con este correo entra y también recibe los avisos de reportes. Se crea con una contraseña temporal."
              >
                <Input {...bind('email')} type="email" inputMode="email" autoCapitalize="none" />
              </FormField>
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmar !== null}
        title="¿Dar acceso a este cliente?"
        confirmLabel="Sí, dar acceso"
        loading={crear.isPending}
        onCancel={() => setConfirmar(null)}
        onConfirm={() => confirmar && crear.mutate(confirmar)}
        description={
          quien && (
            <div className="space-y-2">
              <p>
                <strong>{quien.nombre}</strong> · {quien.email}
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Ese correo quedará ligado a <strong>{cliente.nombreComercial}</strong>.
                </li>
                <li>Verá los sitios, guardias y reportes de este cliente, y nada de otros.</li>
                <li>Recibirá los avisos de reportes de este cliente.</li>
                <li>
                  {confirmar && 'usuarioId' in confirmar
                    ? 'Ya existe: conserva su contraseña.'
                    : 'Se creará su usuario con una contraseña temporal que tú le mandas.'}
                </li>
              </ul>
            </div>
          )
        }
      />
    </FormModal>
  );
}
