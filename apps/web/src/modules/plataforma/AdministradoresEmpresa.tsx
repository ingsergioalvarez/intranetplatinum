import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, UserPlus } from 'lucide-react';
import { empresaAdminCreateSchema, type Empresa, type EmpresaAdministrador, type UsuarioConPassword } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { formatFechaHora } from '../../core/format/fechas';
import { Badge, Button, ConfirmDialog, DataTable, FormField, FormModal, Input, toast, type Column } from '../../components/ui';
import { PasswordTemporalModal } from '../usuarios/PasswordTemporalModal';
import { usuariosService } from '../usuarios/usuarios.service';
import { plataformaService } from './plataforma.service';

type Entrega = { usuario: Pick<EmpresaAdministrador, 'nombre' | 'email'>; passwordTemporal: string };

/** Pestaña Administradores: los que administran la empresa. Se crean con contraseña temporal (C-07). */
export function AdministradoresEmpresa({ empresa }: { empresa: Empresa }) {
  const qc = useQueryClient();
  const [nuevo, setNuevo] = useState(false);
  const [entrega, setEntrega] = useState<{ titulo: string; datos: Entrega } | null>(null);
  const [reiniciar, setReiniciar] = useState<EmpresaAdministrador | null>(null);

  const lista = useQuery({
    queryKey: plataformaService.keys.administradores(empresa.id),
    queryFn: () => plataformaService.administradores(empresa.id),
  });

  const refrescar = () => void qc.invalidateQueries({ queryKey: plataformaService.keys.all });

  const reinicio = useMutation({
    mutationFn: (a: EmpresaAdministrador) => usuariosService.resetPassword(a.id),
    onSuccess: (r: UsuarioConPassword) => {
      setEntrega({ titulo: 'Contraseña temporal nueva', datos: r });
      setReiniciar(null);
    },
    onError: (e) => {
      setReiniciar(null);
      toast.error(mensajeDeError(e));
    },
  });

  const columnas: Column<EmpresaAdministrador>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      mobile: 'title',
      render: (a) => (
        <span className="inline-flex flex-wrap items-center gap-2 font-medium text-slate-900">
          {a.nombre}
          {a.esSuperAdmin && <Badge tone="brand">Super admin</Badge>}
        </span>
      ),
    },
    { key: 'email', header: 'Correo', mobile: 'subtitle', render: (a) => a.email },
    {
      key: 'estado',
      header: 'Estado',
      render: (a) => <Badge tone={a.activo ? 'success' : 'neutral'}>{a.activo ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'acceso',
      header: 'Último acceso',
      render: (a) => (a.ultimoAcceso ? formatFechaHora(a.ultimoAcceso) : 'Nunca'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Administradores de {empresa.nombre}</h2>
          <p className="text-sm text-slate-500">Reciben una contraseña temporal que cambian al entrar.</p>
        </div>
        <Button icon={<UserPlus className="size-4" />} disabled={!empresa.activa} onClick={() => setNuevo(true)}>
          Nuevo administrador
        </Button>
      </div>

      <DataTable
        columns={columnas}
        rows={lista.data ?? []}
        rowKey={(a) => a.id}
        loading={lista.isPending}
        emptyTitle="Esta empresa aún no tiene administradores"
        emptyDescription="Crea el primero para que pueda entrar a configurarla."
        actions={(a) =>
          a.esSuperAdmin ? null : (
            <Button
              variant="ghost"
              size="sm"
              icon={<KeyRound className="size-4" />}
              aria-label={`Restablecer contraseña de ${a.nombre}`}
              onClick={() => setReiniciar(a)}
            >
              <span className="hidden sm:inline">Restablecer clave</span>
            </Button>
          )
        }
      />

      {nuevo && (
        <NuevoAdministradorModal
          empresa={empresa}
          onClose={() => setNuevo(false)}
          onCreado={(datos) => {
            refrescar();
            setNuevo(false);
            setEntrega({ titulo: 'Acceso creado', datos });
          }}
        />
      )}

      <ConfirmDialog
        open={reiniciar !== null}
        title="¿Restablecer la contraseña?"
        description={`Se generará una contraseña temporal para ${reiniciar?.nombre ?? ''} y se cerrarán sus sesiones abiertas.`}
        confirmLabel="Restablecer"
        loading={reinicio.isPending}
        onConfirm={() => reiniciar && reinicio.mutate(reiniciar)}
        onCancel={() => setReiniciar(null)}
      />

      <PasswordTemporalModal resultado={entrega?.datos ?? null} titulo={entrega?.titulo ?? ''} onClose={() => setEntrega(null)} />
    </div>
  );
}

function NuevoAdministradorModal({
  empresa,
  onClose,
  onCreado,
}: {
  empresa: Empresa;
  onClose: () => void;
  onCreado: (datos: Entrega) => void;
}) {
  const form = useForm({ nombre: '', email: '', telefono: '' });
  const { errors, bind } = form;

  const crear = useMutation({
    mutationFn: (datos: ReturnType<typeof empresaAdminCreateSchema.parse>) => plataformaService.crearAdministrador(empresa.id, datos),
    onSuccess: (r) => onCreado(r),
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });

  return (
    <FormModal
      title={`Nuevo administrador de ${empresa.nombre}`}
      description="Se crea con una contraseña temporal que deberá cambiar al entrar."
      onClose={onClose}
      onSubmit={() => {
        const datos = form.validar(empresaAdminCreateSchema);
        if (datos) crear.mutate(datos);
      }}
      submitLabel="Crear administrador"
      loading={crear.isPending}
      dirty={form.cambiado}
    >
      <FormField label="Nombre completo" required error={errors.nombre}>
        <Input {...bind('nombre')} maxLength={120} autoFocus />
      </FormField>
      <FormField label="Correo" required error={errors.email}>
        <Input {...bind('email')} type="email" maxLength={160} />
      </FormField>
      <FormField label="Teléfono" error={errors.telefono}>
        <Input {...bind('telefono')} type="tel" maxLength={30} />
      </FormField>
    </FormModal>
  );
}
