import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, RotateCcw, Search, UserMinus, UsersRound } from 'lucide-react';
import { ROLES, grupoSchema, type Grupo } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { useDebounced } from '../../core/hooks/useDebounced';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  FormField,
  FormModal,
  Input,
  Select,
  Spinner,
  Textarea,
  cn,
  toast,
} from '../../components/ui';
import { usuariosService } from '../usuarios/usuarios.service';
import { gruposService } from './grupos.service';

type Estado = 'activos' | 'baja' | 'todos';

/** Grupos de guardias (F2-06): a un grupo se le asignan sitios y todos sus integrantes los ven. */
export function GruposPage() {
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<Estado>('activos');
  /** undefined = cerrado, null = alta. */
  const [editando, setEditando] = useState<Grupo | null | undefined>(undefined);
  const q = useDebounced(busqueda.trim());

  const grupos = useQuery({
    queryKey: gruposService.keys.list(estado, q),
    queryFn: () => gruposService.list(estado, q || undefined),
  });

  return (
    <>
      <PageHeader
        title="Grupos de guardias"
        subtitle="Asigna sitios a un grupo y todos sus integrantes los verán"
        actions={
          <Button icon={<UsersRound className="size-4" />} onClick={() => setEditando(null)}>
            Nuevo grupo
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-[1fr_auto] gap-3 md:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Buscar grupo"
            aria-label="Buscar grupos"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          aria-label="Filtrar por vigencia"
          options={[
            { value: 'activos', label: 'Activos' },
            { value: 'baja', label: 'De baja' },
            { value: 'todos', label: 'Todos' },
          ]}
          value={estado}
          onChange={(e) => setEstado(e.target.value as Estado)}
        />
      </div>

      {grupos.isPending ? (
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : !grupos.data?.length ? (
        <Card>
          <EmptyState
            icon={<UsersRound className="size-10" />}
            title={q || estado !== 'activos' ? 'Sin resultados' : 'Aún no hay grupos'}
            description={
              q || estado !== 'activos'
                ? undefined
                : 'Crea grupos (p. ej. "Nocturno Zona Norte" o "Eventos") para asignarles sitios.'
            }
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {grupos.data.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => setEditando(g)}
                className={cn(
                  'h-full w-full rounded-xl border bg-white p-4 text-left shadow-sm hover:border-slate-300',
                  g.deletedAt ? 'border-dashed border-slate-200 opacity-70' : 'border-slate-200',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{g.nombre}</p>
                  {g.deletedAt ? (
                    <Badge>De baja</Badge>
                  ) : (
                    <Badge tone={g.asignacionesVigentes ? 'success' : 'neutral'}>
                      <MapPin className="mr-1 size-3" />
                      {g.asignacionesVigentes} {g.asignacionesVigentes === 1 ? 'sitio' : 'sitios'}
                    </Badge>
                  )}
                </div>
                {g.descripcion && <p className="mt-0.5 text-sm text-slate-500">{g.descripcion}</p>}
                <p className="mt-2 text-sm text-slate-700">
                  {g.integrantes.length} {g.integrantes.length === 1 ? 'integrante' : 'integrantes'}
                  {g.integrantes.length > 0 && (
                    <span className="text-slate-500">
                      :{' '}
                      {g.integrantes
                        .slice(0, 3)
                        .map((i) => i.nombre)
                        .join(', ')}
                      {g.integrantes.length > 3 && ` y ${g.integrantes.length - 3} más`}
                    </span>
                  )}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editando !== undefined && (
        <GrupoModal key={editando?.id ?? 'nuevo'} grupo={editando} onClose={() => setEditando(undefined)} />
      )}
    </>
  );
}

function GrupoModal({ grupo, onClose }: { grupo: Grupo | null; onClose: () => void }) {
  const qc = useQueryClient();
  const esNuevo = grupo === null;
  const deBaja = !!grupo?.deletedAt;
  const [confirmar, setConfirmar] = useState<'baja' | 'reactivar' | null>(null);
  const [filtro, setFiltro] = useState('');
  const form = useForm({ nombre: grupo?.nombre ?? '', descripcion: grupo?.descripcion ?? '' });
  const inicial = useMemo(() => new Set(grupo?.integrantes.map((i) => i.id) ?? []), [grupo]);
  const [integrantes, setIntegrantes] = useState<Set<number>>(inicial);
  const cambioIntegrantes =
    integrantes.size !== inicial.size || [...integrantes].some((id) => !inicial.has(id));

  const guardias = useQuery({
    queryKey: usuariosService.keys.list({ rol: ROLES.GUARDIA, estado: 'activos', limit: 100 }),
    queryFn: () => usuariosService.list({ rol: ROLES.GUARDIA, estado: 'activos', limit: 100 }),
  });
  const visibles = (guardias.data?.items ?? []).filter((g) =>
    `${g.nombre} ${g.email}`.toLowerCase().includes(filtro.trim().toLowerCase()),
  );

  const refrescar = () => qc.invalidateQueries({ queryKey: gruposService.keys.all });

  const guardar = useMutation({
    mutationFn: async (datos: ReturnType<typeof grupoSchema.parse>) => {
      const ids = [...integrantes];
      if (esNuevo) return gruposService.crear({ ...datos, usuarioIds: ids });
      if (form.cambiado) await gruposService.actualizar(grupo.id, datos);
      if (cambioIntegrantes) await gruposService.integrantes(grupo.id, ids);
      return null;
    },
    onSuccess: () => {
      void refrescar();
      onClose();
      toast.success(esNuevo ? 'Grupo creado' : 'Grupo actualizado');
    },
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });

  const accion = useMutation({
    mutationFn: (a: 'baja' | 'reactivar') =>
      a === 'baja' ? gruposService.baja(grupo!.id) : gruposService.reactivar(grupo!.id),
    onSuccess: (_r, a) => {
      void refrescar();
      void qc.invalidateQueries({ queryKey: ['sitios'] });
      onClose();
      toast.success(a === 'baja' ? 'Grupo dado de baja' : 'Grupo reactivado');
    },
    onError: (e) => {
      setConfirmar(null);
      toast.error(mensajeDeError(e));
    },
  });

  const alternar = (id: number) =>
    setIntegrantes((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const { errors, bind } = form;
  const cambiado = form.cambiado || cambioIntegrantes;

  return (
    <>
      <FormModal
        title={esNuevo ? 'Nuevo grupo' : grupo.nombre}
        description={deBaja ? 'Grupo dado de baja' : `${integrantes.size} integrantes seleccionados`}
        onClose={onClose}
        onSubmit={() => {
          const datos = form.validar(grupoSchema);
          if (datos) guardar.mutate(datos);
        }}
        submitLabel={esNuevo ? 'Crear grupo' : 'Guardar cambios'}
        loading={guardar.isPending}
        dirty={cambiado}
        submitDisabled={!esNuevo && !cambiado}
        readOnly={deBaja}
        secondaryAction={
          !esNuevo &&
          (deBaja ? (
            <Button
              variant="secondary"
              icon={<RotateCcw className="size-4" />}
              onClick={() => setConfirmar('reactivar')}
            >
              Reactivar
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="text-red-700 hover:bg-red-50"
              icon={<UserMinus className="size-4" />}
              onClick={() => setConfirmar('baja')}
            >
              Dar de baja
            </Button>
          ))
        }
      >
        <FormField label="Nombre del grupo" required error={errors.nombre}>
          <Input
            {...bind('nombre')}
            placeholder="Ej. Nocturno Zona Norte"
            maxLength={80}
            autoFocus={esNuevo}
          />
        </FormField>
        <FormField label="Descripción" error={errors.descripcion}>
          <Textarea {...bind('descripcion')} rows={2} maxLength={255} />
        </FormField>

        <div className="rounded-xl border border-slate-200">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-medium text-slate-800">Integrantes ({integrantes.size})</p>
            <Input
              type="search"
              aria-label="Buscar guardia"
              placeholder="Buscar guardia"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="h-9 max-w-44 text-sm"
            />
          </div>
          {guardias.isPending ? (
            <div className="flex justify-center py-6 text-brand-600">
              <Spinner className="size-5" />
            </div>
          ) : visibles.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">
              {guardias.data?.items.length
                ? 'Sin coincidencias.'
                : 'No hay guardias activos. Créalos en Usuarios.'}
            </p>
          ) : (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto px-3">
              {visibles.map((g) => (
                <li key={g.id}>
                  <Checkbox
                    checked={integrantes.has(g.id)}
                    onChange={() => alternar(g.id)}
                    label={g.nombre}
                    description={g.email}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </FormModal>

      {grupo && (
        <ConfirmDialog
          open={confirmar !== null}
          title={confirmar === 'baja' ? 'Dar de baja el grupo' : 'Reactivar grupo'}
          description={
            confirmar === 'baja'
              ? `Se terminarán hoy las ${grupo.asignacionesVigentes} asignaciones de sitios de "${grupo.nombre}" y sus integrantes dejarán de verlos.`
              : `"${grupo.nombre}" volverá a estar disponible. Sus sitios deben asignarse de nuevo.`
          }
          confirmLabel={confirmar === 'baja' ? 'Dar de baja' : 'Reactivar'}
          variant={confirmar === 'baja' ? 'danger' : 'primary'}
          loading={accion.isPending}
          onConfirm={() => confirmar && accion.mutate(confirmar)}
          onCancel={() => setConfirmar(null)}
        />
      )}
    </>
  );
}
