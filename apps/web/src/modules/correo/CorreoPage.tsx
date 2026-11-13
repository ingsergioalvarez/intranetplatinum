import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX, Mail, Send } from 'lucide-react';
import {
  CIFRADOS_CORREO,
  CIFRADOS_CORREO_ETIQUETA,
  PUERTO_POR_CIFRADO,
  correoConfigSchema,
  type CifradoCorreo,
  type CorreoConfig,
  type ResultadoPruebaCorreo,
} from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  EmptyState,
  FormField,
  Input,
  PasswordInput,
  Select,
  Spinner,
  toast,
} from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { formatFechaHora } from '../../core/format/fechas';
import { correoService } from './correo.service';

/** Correo saliente (SMTP), A-87: los datos del servidor se escriben aquí, sin tocar el servidor. Solo el super admin. */
export function CorreoPage() {
  const q = useQuery({ queryKey: correoService.keys.config, queryFn: correoService.obtener });

  return (
    <>
      <PageHeader
        title="Correo (SMTP)"
        subtitle="Desde aquí sale el correo de la intranet (recuperar contraseña, avisos)."
      />
      {q.isPending ? (
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : q.isError ? (
        <EmptyState title="No se pudo cargar" description="Revisa tu conexión e intenta de nuevo." />
      ) : (
        <FormularioCorreo key={q.data.actualizadoEn ?? 'nuevo'} config={q.data} />
      )}
    </>
  );
}

const inicialDe = (c: CorreoConfig) => ({
  host: c.host,
  puerto: String(c.puerto),
  cifrado: c.cifrado as string,
  usuario: c.usuario,
  password: '',
  remitenteNombre: c.remitenteNombre,
  remitenteCorreo: c.remitenteCorreo,
  activo: c.activo,
  para: '',
});

function FormularioCorreo({ config }: { config: CorreoConfig }) {
  const qc = useQueryClient();
  const f = useForm(inicialDe(config));
  const [resultado, setResultado] = useState<ResultadoPruebaCorreo | null>(null);
  const v = f.values;

  /** Lo que se manda al servidor: los mismos datos del formulario, con el puerto como número. */
  const datos = () => ({
    host: v.host,
    puerto: v.puerto.trim() === '' ? undefined : Number(v.puerto),
    cifrado: v.cifrado,
    usuario: v.usuario,
    password: v.password,
    remitenteNombre: v.remitenteNombre,
    remitenteCorreo: v.remitenteCorreo,
    activo: v.activo,
  });

  const guardar = useMutation({
    mutationFn: correoService.guardar,
    onSuccess: (guardado) => {
      qc.setQueryData(correoService.keys.config, guardado);
      toast.success(guardado.activo ? 'Correo guardado y activado' : 'Correo guardado (apagado)');
    },
    onError: (e) => {
      if (!f.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });

  const probar = useMutation({
    mutationFn: correoService.probar,
    onSuccess: setResultado,
    onError: (e) => setResultado({ enviado: false, detalle: mensajeDeError(e) }),
  });

  const enviarGuardar = () => {
    const ok = f.validar(correoConfigSchema, datos());
    if (ok) guardar.mutate(ok);
  };

  const enviarPrueba = () => {
    setResultado(null);
    const cfg = f.validar(correoConfigSchema, datos());
    if (!cfg) return toast.error('Completa los datos del servidor para probar');
    if (!v.para.trim()) return f.setErrors((e) => ({ ...e, para: 'Escribe a qué correo se envía la prueba' }));
    probar.mutate({ para: v.para, config: cfg });
  };

  const cambiarCifrado = (nuevo: string) => {
    // Si el puerto era el habitual del cifrado anterior, se sugiere el del nuevo.
    const habitual = PUERTO_POR_CIFRADO[v.cifrado as CifradoCorreo];
    f.set('cifrado', nuevo);
    if (Number(v.puerto) === habitual) f.set('puerto', String(PUERTO_POR_CIFRADO[nuevo as CifradoCorreo]));
  };

  const sinCambios = !f.cambiado && !v.password;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">Estado:</span>
        {config.activo ? (
          <Badge tone="success">Activo</Badge>
        ) : config.configurado ? (
          <Badge tone="warning">Guardado, apagado</Badge>
        ) : (
          <Badge tone="neutral">Sin configurar</Badge>
        )}
        {config.actualizadoEn && (
          <span className="text-sm text-slate-500">Última vez: {formatFechaHora(config.actualizadoEn)}</span>
        )}
      </div>
      {!config.activo && (
        <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          Mientras el correo no esté activo, la app no envía correos y todo lo demás funciona igual.
        </p>
      )}

      <Card>
        <CardHeader title="Servidor de correo" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Servidor (host)" error={f.errors.host} required className="sm:col-span-2">
            <Input {...f.bind('host')} placeholder="smtp.ejemplo.com" autoCapitalize="none" autoCorrect="off" />
          </FormField>
          <FormField label="Puerto" error={f.errors.puerto} required>
            <Input {...f.bind('puerto')} inputMode="numeric" placeholder="587" />
          </FormField>
          <FormField label="Cifrado" error={f.errors.cifrado} required className="sm:col-span-3">
            <Select
              value={v.cifrado}
              onChange={(e) => cambiarCifrado(e.target.value)}
              options={CIFRADOS_CORREO.map((c) => ({ value: c, label: CIFRADOS_CORREO_ETIQUETA[c] }))}
            />
          </FormField>
          <FormField
            label="Usuario"
            error={f.errors.usuario}
            hint="Déjalo vacío si el servidor no pide usuario."
            className="sm:col-span-3"
          >
            <Input {...f.bind('usuario')} placeholder="notificaciones@tuempresa.mx" autoCapitalize="none" autoCorrect="off" />
          </FormField>
          <FormField
            label="Contraseña"
            error={f.errors.password}
            hint={
              config.tienePassword
                ? 'Hay una guardada (cifrada). Déjala vacía para no cambiarla.'
                : 'Se guarda cifrada y no se vuelve a mostrar.'
            }
            className="sm:col-span-3"
          >
            <PasswordInput {...f.bind('password')} autoComplete="new-password" placeholder={config.tienePassword ? '••••••••••••' : ''} />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Remitente" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Nombre que se verá" error={f.errors.remitenteNombre} required>
            <Input {...f.bind('remitenteNombre')} placeholder="Grupo Platinum" />
          </FormField>
          <FormField label="Correo del remitente" error={f.errors.remitenteCorreo} required>
            <Input {...f.bind('remitenteCorreo')} type="email" placeholder="no-responder@tuempresa.mx" autoCapitalize="none" />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Probar" />
        <CardBody className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <FormField label="Enviar prueba a" error={f.errors.para} className="flex-1">
              <Input {...f.bind('para')} type="email" placeholder="tucorreo@tuempresa.mx" autoCapitalize="none" />
            </FormField>
            <Button variant="secondary" icon={<Send className="size-4" />} loading={probar.isPending} onClick={enviarPrueba}>
              Enviar prueba
            </Button>
          </div>
          <p className="text-sm text-slate-500">Usa los datos que ves arriba, aunque todavía no los hayas guardado.</p>
          {resultado && (
            <div
              role="status"
              className={
                resultado.enviado
                  ? 'flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900'
                  : 'flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-900'
              }
            >
              {resultado.enviado ? <CircleCheck className="mt-0.5 size-5 shrink-0" /> : <CircleX className="mt-0.5 size-5 shrink-0" />}
              <span>{resultado.enviado ? resultado.detalle : `No se pudo: ${resultado.detalle}`}</span>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <Checkbox
            {...f.bindCheck('activo')}
            label="Activar correo"
            description="Apagado, la app guarda los datos pero no envía nada."
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={sinCambios}
              onClick={() => {
                // Volver a lo guardado.
                f.setErrors({});
                Object.entries(inicialDe(config)).forEach(([k, val]) => f.set(k as keyof ReturnType<typeof inicialDe>, val as never));
                setResultado(null);
              }}
            >
              Cancelar
            </Button>
            <Button icon={<Mail className="size-4" />} loading={guardar.isPending} disabled={sinCambios} onClick={enviarGuardar}>
              Guardar
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
