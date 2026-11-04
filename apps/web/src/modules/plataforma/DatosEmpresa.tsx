import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ZONAS_HORARIAS, empresaCreateSchema, type Empresa } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { Button, FormField, Input, Select, toast } from '../../components/ui';
import { plataformaService } from './plataforma.service';

/** Título de grupo dentro del formulario (ocupa toda la fila). */
const Grupo = ({ children }: { children: string }) => (
  <h2 className="col-span-full -mb-1 mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
);

/** Pestaña Datos: nombre y zona horaria obligatorios; el resto es opcional. */
export function DatosEmpresa({ empresa }: { empresa: Empresa }) {
  const qc = useQueryClient();
  const form = useForm({
    nombre: empresa.nombre,
    razonSocial: empresa.razonSocial ?? '',
    rfc: empresa.rfc ?? '',
    calle: empresa.calle ?? '',
    calle2: empresa.calle2 ?? '',
    codigoPostal: empresa.codigoPostal ?? '',
    ciudad: empresa.ciudad ?? '',
    estado: empresa.estado ?? '',
    pais: empresa.pais ?? '',
    telefono: empresa.telefono ?? '',
    email: empresa.email ?? '',
    sitioWeb: empresa.sitioWeb ?? '',
    zonaHoraria: empresa.zonaHoraria,
    moneda: empresa.moneda,
  });
  const { errors, bind } = form;

  // Si la empresa tiene una zona que no está en la lista corta, se conserva como opción.
  const zonas: { value: string; label: string }[] = ZONAS_HORARIAS.map((z) => ({ value: z.valor, label: z.etiqueta }));
  if (!zonas.some((z) => z.value === empresa.zonaHoraria)) {
    zonas.push({ value: empresa.zonaHoraria, label: empresa.zonaHoraria });
  }

  const guardar = useMutation({
    mutationFn: (datos: ReturnType<typeof empresaCreateSchema.parse>) => plataformaService.actualizar(empresa.id, datos),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: plataformaService.keys.all });
      toast.success('Datos guardados');
    },
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });

  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const datos = form.validar(empresaCreateSchema, { ...form.values, moneda: form.values.moneda || undefined });
    if (datos) guardar.mutate(datos);
  };

  return (
    <form onSubmit={enviar} noValidate>
      {/* Celular: una columna. Tableta: dos. Escritorio: 12 columnas para que quepa sin deslizar. */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <FormField label="Nombre de la empresa" required error={errors.nombre}>
            <Input {...bind('nombre')} maxLength={120} />
          </FormField>
        </div>
        <div className="lg:col-span-3">
          <FormField label="Razón social" error={errors.razonSocial}>
            <Input {...bind('razonSocial')} maxLength={160} />
          </FormField>
        </div>
        <div className="lg:col-span-2">
          <FormField label="RFC" error={errors.rfc}>
            <Input {...bind('rfc')} maxLength={13} className="uppercase" />
          </FormField>
        </div>
        <div className="lg:col-span-3">
          <FormField label="Zona horaria" required error={errors.zonaHoraria}>
            <Select {...bind('zonaHoraria')} options={zonas} />
          </FormField>
        </div>
        <div className="lg:col-span-1">
          <FormField label="Moneda" error={errors.moneda}>
            <Input {...bind('moneda')} maxLength={3} className="uppercase" />
          </FormField>
        </div>

        <Grupo>Dirección</Grupo>
        <div className="lg:col-span-4">
          <FormField label="Calle" error={errors.calle}>
            <Input {...bind('calle')} maxLength={160} />
          </FormField>
        </div>
        <div className="lg:col-span-4">
          <FormField label="Calle 2" error={errors.calle2}>
            <Input {...bind('calle2')} maxLength={160} />
          </FormField>
        </div>
        <div className="lg:col-span-4">
          <FormField label="Ciudad" error={errors.ciudad}>
            <Input {...bind('ciudad')} maxLength={80} />
          </FormField>
        </div>
        <div className="lg:col-span-4">
          <FormField label="Estado" error={errors.estado}>
            <Input {...bind('estado')} maxLength={80} />
          </FormField>
        </div>
        <div className="lg:col-span-4">
          <FormField label="País" error={errors.pais}>
            <Input {...bind('pais')} maxLength={80} />
          </FormField>
        </div>
        <div className="lg:col-span-4">
          <FormField label="C.P." error={errors.codigoPostal}>
            <Input {...bind('codigoPostal')} maxLength={10} />
          </FormField>
        </div>

        <Grupo>Contacto</Grupo>
        <div className="lg:col-span-3">
          <FormField label="Teléfono" error={errors.telefono}>
            <Input {...bind('telefono')} type="tel" maxLength={30} />
          </FormField>
        </div>
        <div className="lg:col-span-4">
          <FormField label="Correo electrónico" error={errors.email}>
            <Input {...bind('email')} type="email" maxLength={160} />
          </FormField>
        </div>
        <div className="lg:col-span-5">
          <FormField label="Sitio web" error={errors.sitioWeb}>
            <Input {...bind('sitioWeb')} maxLength={200} placeholder="https://" />
          </FormField>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="submit" loading={guardar.isPending} disabled={!form.cambiado}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
