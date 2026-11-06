import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Lock, Save, Trash2 } from 'lucide-react';
import {
  ALCANCES,
  ALCANCE_LABEL,
  CATALOGO_PERMISOS,
  GRUPOS_PERMISOS,
  ROLES,
  rolUpdateSchema,
  type AlcanceRol,
  type Permiso,
  type RolEmpresa,
} from '@platinum/shared';
import { ApiError, mensajeDeError } from '../../core/api';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  Select,
  Spinner,
  toast,
} from '../../components/ui';
import { rolesService } from './roles.service';

const ALCANCE_EXPLICACION: Record<AlcanceRol, string> = {
  empresa: 'Ve y maneja a todas las personas de la empresa, sin importar su área.',
  area_subareas: 'Ve y maneja a las personas de su área (o las que encabeza) y las de todas sus subáreas.',
  area: 'Ve y maneja únicamente a las personas de su propia área (sin subáreas).',
  propio: 'Solo ve y realiza acciones sobre sí misma o sí mismo.',
};

const opcionesAlcance = ALCANCES.map((a) => ({ value: a, label: ALCANCE_LABEL[a] }));

export function RolDetallePage() {
  const { id } = useParams<{ id: string }>();
  const rolId = Number(id);
  const detalle = useQuery({
    queryKey: rolesService.keys.detail(rolId),
    queryFn: () => rolesService.getById(rolId),
    enabled: Number.isInteger(rolId) && rolId > 0,
  });

  if (detalle.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (detalle.isError || !detalle.data) {
    return (
      <Card>
        <EmptyState
          title="No se encontró el rol"
          description="Es posible que haya sido eliminado o no pertenezca a tu empresa."
          action={
            <Link to="/roles">
              <Button variant="secondary">Volver a Roles y permisos</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return <RolEditor key={`${detalle.data.id}-${detalle.data.nombre}-${detalle.data.alcance}-${detalle.data.permisos.join(',')}`} rol={detalle.data} />;
}

function RolEditor({ rol }: { rol: RolEmpresa }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const esAdmin = rol.clave === ROLES.ADMIN;

  const [nombre, setNombre] = useState(rol.nombre);
  const [alcance, setAlcance] = useState<AlcanceRol>(rol.alcance);
  const [permisos, setPermisos] = useState<Set<Permiso>>(() => new Set(rol.permisos));
  const [fieldErrors, setFieldErrors] = useState<{ nombre?: string; alcance?: string }>({});
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  const permisosIniciales = useMemo(() => [...rol.permisos].sort().join(','), [rol.permisos]);
  const permisosActuales = useMemo(() => [...permisos].sort().join(','), [permisos]);
  const cambiado =
    !esAdmin && (nombre.trim() !== rol.nombre || alcance !== rol.alcance || permisosActuales !== permisosIniciales);

  const guardar = useMutation({
    mutationFn: () =>
      rolesService.actualizar(rol.id, {
        nombre: nombre.trim(),
        alcance,
        permisos: [...permisos],
      }),
    onSuccess: (actualizado) => {
      qc.setQueryData(rolesService.keys.detail(rol.id), actualizado);
      void qc.invalidateQueries({ queryKey: rolesService.keys.all });
      void qc.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Cambios del rol guardados');
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        setFieldErrors(e.fieldErrors);
      } else {
        toast.error(mensajeDeError(e));
      }
    },
  });

  const eliminar = useMutation({
    mutationFn: () => rolesService.eliminar(rol.id),
    onSuccess: () => {
      setConfirmarBorrar(false);
      void qc.invalidateQueries({ queryKey: rolesService.keys.all });
      toast.success(`Rol "${rol.nombre}" eliminado`);
      navigate('/roles');
    },
    onError: (e) => {
      setConfirmarBorrar(false);
      toast.error(mensajeDeError(e));
    },
  });

  const onGuardar = () => {
    const parsed = rolUpdateSchema.safeParse({
      nombre,
      alcance,
      permisos: [...permisos],
    });
    if (!parsed.success) {
      setFieldErrors(erroresDeCampos(parsed.error));
      return;
    }
    guardar.mutate();
  };

  const alternarPermiso = (clave: Permiso) => {
    if (esAdmin) return;
    setPermisos((prev) => {
      const copia = new Set(prev);
      if (copia.has(clave)) copia.delete(clave);
      else copia.add(clave);
      return copia;
    });
  };

  const alternarGrupo = (clavesGrupo: Permiso[]) => {
    if (esAdmin) return;
    const todosMarcados = clavesGrupo.every((c) => permisos.has(c));
    setPermisos((prev) => {
      const copia = new Set(prev);
      for (const c of clavesGrupo) {
        if (todosMarcados) copia.delete(c);
        else copia.add(c);
      }
      return copia;
    });
  };

  const etiquetaTipo = esAdmin ? 'Base · fijo' : rol.esBase ? 'Base' : 'Creado por ti';
  const tonoTipo = esAdmin ? ('brand' as const) : rol.esBase ? ('neutral' as const) : ('success' as const);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/roles"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Roles y permisos
        </Link>

        <PageHeader
          title={rol.nombre}
          subtitle={`${rol.personas} ${rol.personas === 1 ? 'persona tiene' : 'personas tienen'} este rol`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tonoTipo}>{etiquetaTipo}</Badge>
              {!rol.esBase && (
                <Button
                  variant="ghost"
                  className="text-red-700 hover:bg-red-50"
                  icon={<Trash2 className="size-4" />}
                  disabled={rol.personas > 0}
                  title={rol.personas > 0 ? 'No se puede eliminar mientras tenga personas asignadas' : undefined}
                  onClick={() => setConfirmarBorrar(true)}
                >
                  Eliminar rol
                </Button>
              )}
              {!esAdmin && (
                <Button
                  icon={<Save className="size-4" />}
                  onClick={onGuardar}
                  loading={guardar.isPending}
                  disabled={!cambiado}
                >
                  Guardar cambios
                </Button>
              )}
            </div>
          }
        />
      </div>

      {esAdmin && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/70 p-4 text-sm text-slate-800">
          <Lock className="mt-0.5 size-4 shrink-0 text-brand-700" />
          <div>
            <p className="font-semibold text-slate-900">El rol Administrador es fijo</p>
            <p className="mt-0.5 text-slate-600">
              Conserva siempre todos los permisos del sistema y alcance sobre toda la empresa para evitar que te quedes sin acceso.
            </p>
          </div>
        </div>
      )}

      {!rol.esBase && rol.personas > 0 && (
        <p className="text-xs text-slate-500">
          Para eliminar este rol, primero cambia de rol a las {rol.personas} {rol.personas === 1 ? 'persona que lo tiene' : 'personas que lo tienen'}.
        </p>
      )}

      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Nombre del rol"
            required
            error={fieldErrors.nombre}
            hint={rol.esBase && !esAdmin ? 'Puedes renombrarlo para tu empresa; seguirá siendo un rol base.' : undefined}
          >
            <Input
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setFieldErrors((prev) => ({ ...prev, nombre: undefined }));
              }}
              disabled={esAdmin}
              autoComplete="off"
            />
          </FormField>

          <FormField
            label="Alcance (a quiénes puede ver y manejar)"
            required
            error={fieldErrors.alcance}
            hint={ALCANCE_EXPLICACION[alcance]}
          >
            <Select
              options={opcionesAlcance}
              value={alcance}
              onChange={(e) => setAlcance(e.target.value as AlcanceRol)}
              disabled={esAdmin}
            />
          </FormField>
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
          <h2 className="text-base font-semibold text-slate-900">
            Permisos del rol ({permisos.size} de {CATALOGO_PERMISOS.length} activos)
          </h2>
          <p className="text-xs text-slate-500">
            Los cambios se aplican cuando cada persona renueva su acceso (unos minutos).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {GRUPOS_PERMISOS.map((grupo) => {
            const delGrupo = CATALOGO_PERMISOS.filter((p) => p.grupo === grupo.clave);
            const clavesGrupo = delGrupo.map((p) => p.clave);
            const activos = clavesGrupo.filter((c) => permisos.has(c)).length;
            const todosMarcados = activos === clavesGrupo.length;

            return (
              <Card key={grupo.clave} className="flex flex-col">
                <CardHeader
                  title={grupo.nombre}
                  actions={
                    <div className="flex items-center gap-2">
                      <Badge tone={activos > 0 ? 'brand' : 'neutral'}>
                        {activos}/{clavesGrupo.length}
                      </Badge>
                      {!esAdmin && (
                        <button
                          type="button"
                          onClick={() => alternarGrupo(clavesGrupo)}
                          className="text-xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
                        >
                          {todosMarcados ? 'Ninguno' : 'Todos'}
                        </button>
                      )}
                    </div>
                  }
                />
                <div className="divide-y divide-slate-100 px-4 py-2">
                  {delGrupo.map((p) => (
                    <Checkbox
                      key={p.clave}
                      label={p.descripcion}
                      checked={permisos.has(p.clave)}
                      onChange={() => alternarPermiso(p.clave)}
                      disabled={esAdmin}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={confirmarBorrar}
        loading={eliminar.isPending}
        title="Eliminar rol"
        description={`Se eliminará el rol "${rol.nombre}" de tu empresa. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar rol"
        variant="danger"
        onCancel={() => setConfirmarBorrar(false)}
        onConfirm={() => eliminar.mutate()}
      />
    </div>
  );
}

