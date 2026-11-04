import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ZONAS_HORARIAS, ZONA_HORARIA_DEFECTO, empresaCreateSchema } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { FormField, FormModal, Input, Select, toast } from '../../components/ui';
import { plataformaService } from './plataforma.service';

/** Alta de empresa: nombre y zona horaria. Empieza solo con lo siempre incluido; los módulos se encienden después. */
export function NuevaEmpresaModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const form = useForm({ nombre: '', zonaHoraria: ZONA_HORARIA_DEFECTO as string });
  const { errors, bind } = form;

  const crear = useMutation({
    mutationFn: (datos: ReturnType<typeof empresaCreateSchema.parse>) => plataformaService.crear(datos),
    onSuccess: (empresa) => {
      void qc.invalidateQueries({ queryKey: plataformaService.keys.all });
      toast.success('Empresa creada');
      onClose();
      navigate(`/plataforma/empresas/${empresa.id}`);
    },
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });

  return (
    <FormModal
      title="Nueva empresa"
      description="Empieza solo con lo siempre incluido. Los módulos los enciendes después."
      onClose={onClose}
      onSubmit={() => {
        const datos = form.validar(empresaCreateSchema);
        if (datos) crear.mutate(datos);
      }}
      submitLabel="Crear empresa"
      loading={crear.isPending}
      dirty={form.cambiado}
    >
      <FormField label="Nombre de la empresa" required error={errors.nombre}>
        <Input {...bind('nombre')} placeholder="Ej. Mi empresa" maxLength={120} autoFocus />
      </FormField>
      <FormField label="Zona horaria" required error={errors.zonaHoraria}>
        <Select {...bind('zonaHoraria')} options={ZONAS_HORARIAS.map((z) => ({ value: z.valor, label: z.etiqueta }))} />
      </FormField>
    </FormModal>
  );
}
