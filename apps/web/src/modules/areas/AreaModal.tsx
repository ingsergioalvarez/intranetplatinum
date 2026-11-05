import { useMutation, useQueryClient } from '@tanstack/react-query';
import { areaCreateSchema, type Area } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { FormField, FormModal, Input, Select, toast } from '../../components/ui';
import { areasService } from './areas.service';

const SIN_PADRE = '';

/** Ids del área y de todas sus subáreas: no se ofrecen como "área superior" al mover (no puede quedar dentro de sí misma). */
function conDescendientes(areas: Area[], id: number): Set<number> {
  const ids = new Set([id]);
  let crecio = true;
  while (crecio) {
    crecio = false;
    for (const a of areas) {
      if (a.padreId !== null && ids.has(a.padreId) && !ids.has(a.id)) {
        ids.add(a.id);
        crecio = true;
      }
    }
  }
  return ids;
}

/**
 * Crear un área o subárea, o renombrar / mover una existente (`area`). El jefe se elige aparte, desde la ficha del área,
 * entre las personas de la empresa.
 */
export function AreaModal({
  area,
  padreInicial,
  areas,
  onClose,
  onListo,
}: {
  area: Area | null;
  /** Al crear una subárea, el área superior ya elegida. */
  padreInicial?: number | null;
  areas: Area[];
  onClose: () => void;
  onListo: (area: Area) => void;
}) {
  const qc = useQueryClient();
  const esNueva = area === null;
  const form = useForm({
    nombre: area?.nombre ?? '',
    padreId: area?.padreId != null ? String(area.padreId) : padreInicial != null ? String(padreInicial) : SIN_PADRE,
  });
  const { errors, bind } = form;
  const excluidas = area ? conDescendientes(areas, area.id) : new Set<number>();
  const opciones = [
    { value: SIN_PADRE, label: 'Ninguna (primer nivel)' },
    ...areas.filter((a) => !excluidas.has(a.id)).map((a) => ({ value: String(a.id), label: a.nombreCompleto })),
  ];

  const guardar = useMutation({
    mutationFn: ({ nombre, padreId }: { nombre: string; padreId: number | null }) =>
      esNueva ? areasService.crear({ nombre, padreId }) : areasService.actualizar(area.id, { nombre, padreId }),
    onSuccess: (guardada) => {
      void qc.invalidateQueries({ queryKey: areasService.keys.all });
      toast.success(esNueva ? 'Área creada' : 'Área actualizada');
      onListo(guardada);
    },
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });

  return (
    <FormModal
      title={esNueva ? (padreInicial ? 'Nueva subárea' : 'Nueva área') : 'Editar área'}
      description={esNueva ? 'Las áreas pueden tener subáreas sin límite de niveles.' : area.nombreCompleto}
      onClose={onClose}
      onSubmit={() => {
        const datos = form.validar(areaCreateSchema.pick({ nombre: true }));
        if (datos) guardar.mutate({ nombre: datos.nombre, padreId: form.values.padreId ? Number(form.values.padreId) : null });
      }}
      submitLabel={esNueva ? 'Crear' : 'Guardar'}
      loading={guardar.isPending}
      dirty={form.cambiado}
    >
      <FormField label="Área superior" error={errors.padreId}>
        <Select {...bind('padreId')} options={opciones} />
      </FormField>
      <FormField label="Nombre" required error={errors.nombre}>
        <Input {...bind('nombre')} placeholder="Ej. Recursos Humanos" maxLength={100} autoFocus autoComplete="off" />
      </FormField>
    </FormModal>
  );
}
