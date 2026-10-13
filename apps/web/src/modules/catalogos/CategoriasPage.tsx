import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { categoriaCreateSchema, type Categoria, type CategoriaNodo } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  FormField,
  FormModal,
  Input,
  Select,
  Spinner,
  cn,
  toast,
} from '../../components/ui';
import { ICONOS_CATEGORIA } from '../reportes/categoriaIconos';
import { IconoCategoria } from '../reportes/etiquetas';
import { categoriasService } from '../reportes/reportes.service';

type Editando = { categoria: Categoria | null; padreId: number | null };

const iconoOptions = Object.entries(ICONOS_CATEGORIA).map(([value, { label }]) => ({ value, label }));

/** Catálogo de categorías de reporte (F3-01): el admin agrega tipos de incidencia sin código. */
export function CategoriasPage() {
  const [editando, setEditando] = useState<Editando | null>(null);
  const arbol = useQuery({
    queryKey: categoriasService.keys.arbol(true),
    queryFn: () => categoriasService.arbol(true),
  });

  return (
    <>
      <PageHeader
        title="Categorías de reporte"
        subtitle="Tipos de incidencia que eligen los guardias"
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => setEditando({ categoria: null, padreId: null })}
          >
            Nueva categoría
          </Button>
        }
      />

      {arbol.isPending ? (
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : !arbol.data?.length ? (
        <Card>
          <EmptyState title="Sin categorías" description="Crea la primera con “Nueva categoría”." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {arbol.data.map((p) => (
            <Card key={p.id} className={cn(!p.activo && 'opacity-60')}>
              <button
                type="button"
                onClick={() => setEditando({ categoria: p, padreId: null })}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <IconoCategoria icono={p.icono} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{p.nombre}</span>
                  <span className="text-xs text-slate-500">
                    {p.hijas.length} {p.hijas.length === 1 ? 'subcategoría' : 'subcategorías'} · orden{' '}
                    {p.orden}
                  </span>
                </span>
                {!p.activo && <Badge>Inactiva</Badge>}
              </button>
              <ul className="divide-y divide-slate-100">
                {p.hijas.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => setEditando({ categoria: h, padreId: p.id })}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50',
                        !h.activo && 'text-slate-400',
                      )}
                    >
                      <span className="truncate">{h.nombre}</span>
                      {!h.activo && <Badge>Inactiva</Badge>}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => setEditando({ categoria: null, padreId: p.id })}
                    className="flex w-full items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-slate-50"
                  >
                    <Plus className="size-4" /> Agregar subcategoría
                  </button>
                </li>
              </ul>
            </Card>
          ))}
        </div>
      )}

      {editando && (
        <CategoriaModal
          key={editando.categoria?.id ?? `nueva-${editando.padreId}`}
          {...editando}
          principales={arbol.data ?? []}
          onClose={() => setEditando(null)}
        />
      )}
    </>
  );
}

function CategoriaModal({
  categoria,
  padreId,
  principales,
  onClose,
}: Editando & { principales: CategoriaNodo[]; onClose: () => void }) {
  const qc = useQueryClient();
  const esNueva = categoria === null;
  const esPrincipal = (categoria?.padreId ?? padreId) === null;
  const tieneHijas = principales.some((p) => p.id === categoria?.id && p.hijas.length > 0);
  const form = useForm({
    nombre: categoria?.nombre ?? '',
    icono: categoria?.icono ?? '',
    orden: String(categoria?.orden ?? 0),
    padreId: String(categoria?.padreId ?? padreId ?? ''),
    activo: categoria?.activo ?? true,
  });

  const guardar = useMutation({
    mutationFn: (datos: ReturnType<typeof categoriaCreateSchema.parse>) =>
      esNueva
        ? categoriasService.crear(datos)
        : categoriasService.actualizar(categoria.id, { ...datos, activo: form.values.activo }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: categoriasService.keys.all });
      onClose();
      toast.success(esNueva ? 'Categoría creada' : 'Categoría actualizada');
    },
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });

  const { errors, bind, bindCheck } = form;
  const otrasPrincipales = principales.filter((p) => p.id !== categoria?.id);

  return (
    <FormModal
      title={esNueva ? (esPrincipal ? 'Nueva categoría' : 'Nueva subcategoría') : categoria.nombre}
      onClose={onClose}
      onSubmit={() => {
        const datos = form.validar(categoriaCreateSchema, {
          ...form.values,
          padreId: form.values.padreId || null,
        });
        if (datos) guardar.mutate(datos);
      }}
      submitLabel={esNueva ? 'Crear' : 'Guardar cambios'}
      loading={guardar.isPending}
      dirty={form.cambiado}
      submitDisabled={!esNueva && !form.cambiado}
    >
      <FormField label="Nombre" required error={errors.nombre}>
        <Input {...bind('nombre')} autoFocus={esNueva} maxLength={80} />
      </FormField>
      {!tieneHijas && (
        <FormField label="Pertenece a" error={errors.padreId} hint="Vacío = categoría principal.">
          <Select
            {...bind('padreId')}
            options={otrasPrincipales.map((p) => ({ value: p.id, label: p.nombre }))}
            placeholder="— Categoría principal —"
          />
        </FormField>
      )}
      <div className="grid grid-cols-2 gap-3">
        {!form.values.padreId && (
          <FormField label="Ícono" error={errors.icono}>
            <Select {...bind('icono')} options={iconoOptions} placeholder="Sin ícono" />
          </FormField>
        )}
        <FormField label="Orden" error={errors.orden} hint="Menor aparece primero.">
          <Input {...bind('orden')} type="number" inputMode="numeric" min={0} max={999} />
        </FormField>
      </div>
      {!esNueva && (
        <Checkbox
          {...bindCheck('activo')}
          label="Activa"
          description="Las inactivas ya no aparecen al crear reportes; los reportes existentes las conservan."
        />
      )}
    </FormModal>
  );
}
