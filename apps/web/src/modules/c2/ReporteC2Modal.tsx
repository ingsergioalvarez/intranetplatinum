import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MAX_FOTOS_REPORTE, PRIORIDAD_REPORTE, PRIORIDAD_REPORTE_LABEL, reporteCreateSchema, type PrioridadReporte } from '@platinum/shared';
import { FormField, FormModal, Input, PhotoUploader, Select, Textarea, toast, type SelectOption } from '../../components/ui';
import { ApiError, mensajeDeError } from '../../core/api';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { categoriasService, reportesService } from '../reportes/reportes.service';
import { c2Service } from './c2.service';

/**
 * Reporte del C2 sobre un sitio (A-80). El sitio ya viene fijo (el icono estaba en su fila): no hay nada que buscar. No
 * lleva ubicación ni GPS porque el C2 no está en el sitio. Lo ven supervisor y admin; nunca el cliente.
 */
export function ReporteC2Modal({ sitio, onClose }: { sitio: { id: number; nombre: string; cliente: string }; onClose: () => void }) {
  const queryClient = useQueryClient();
  const categorias = useQuery({ queryKey: categoriasService.keys.arbol(false), queryFn: () => categoriasService.arbol(false) });
  const [categoriaId, setCategoriaId] = useState('');
  const [prioridad, setPrioridad] = useState<PrioridadReporte>('media');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});

  // Una categoría con subcategorías se elige por la subcategoría ("Seguridad › Acceso sin guardia").
  const opciones = useMemo<SelectOption[]>(
    () =>
      (categorias.data ?? []).flatMap((c) =>
        c.hijas.length ? c.hijas.map((h) => ({ value: h.id, label: `${c.nombre} › ${h.nombre}` })) : [{ value: c.id, label: c.nombre }],
      ),
    [categorias.data],
  );

  const quitarError = (campo: string) => setErrores((e) => ({ ...e, [campo]: undefined }));

  const crear = useMutation({
    mutationFn: () => reportesService.crear({ sitioId: sitio.id, categoriaId: Number(categoriaId), prioridad, titulo, descripcion }, fotos),
    onSuccess: (r) => {
      toast.success(`Reporte ${r.folio} levantado`);
      void queryClient.invalidateQueries({ queryKey: reportesService.keys.all });
      void queryClient.invalidateQueries({ queryKey: c2Service.keys.all });
      onClose();
    },
    onError: (e) => {
      const campos = e instanceof ApiError ? e.fieldErrors : {};
      if (Object.keys(campos).length) setErrores(campos);
      else toast.error(mensajeDeError(e));
    },
  });

  const enviar = () => {
    const r = reporteCreateSchema.safeParse({ sitioId: sitio.id, categoriaId, prioridad, titulo, descripcion });
    const faltan = r.success ? {} : erroresDeCampos(r.error);
    if (fotos.length === 0) faltan.fotos = 'Agrega al menos una foto (puede ser una captura de la cámara)';
    if (Object.keys(faltan).length) return setErrores(faltan);
    crear.mutate();
  };

  return (
    <FormModal
      title="Reporte del C2"
      description={`${sitio.cliente} · ${sitio.nombre}`}
      onClose={onClose}
      onSubmit={enviar}
      submitLabel="Levantar reporte"
      loading={crear.isPending}
      dirty={titulo !== '' || descripcion !== '' || fotos.length > 0}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Categoría" required error={errores.categoriaId}>
          <Select
            value={categoriaId}
            onChange={(e) => {
              setCategoriaId(e.target.value);
              quitarError('categoriaId');
            }}
            options={opciones}
            placeholder={categorias.isPending ? 'Cargando…' : 'Elige la categoría'}
          />
        </FormField>
        <FormField label="Prioridad" required error={errores.prioridad}>
          <Select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as PrioridadReporte)}
            options={PRIORIDAD_REPORTE.map((p) => ({ value: p, label: PRIORIDAD_REPORTE_LABEL[p] }))}
          />
        </FormField>
      </div>
      <FormField label="Título" required error={errores.titulo}>
        <Input
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            quitarError('titulo');
          }}
          maxLength={150}
          placeholder="Por ejemplo: sitio sin guardia desde las 8:00"
        />
      </FormField>
      <FormField label="¿Qué pasa?" required error={errores.descripcion}>
        <Textarea
          value={descripcion}
          onChange={(e) => {
            setDescripcion(e.target.value);
            quitarError('descripcion');
          }}
          rows={4}
          maxLength={2000}
          placeholder="Describe lo que ves, desde cuándo y si hay riesgo."
        />
      </FormField>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-slate-700">
          Fotos <span className="text-red-600">*</span> <span className="font-normal text-slate-500">(hasta {MAX_FOTOS_REPORTE})</span>
        </p>
        <PhotoUploader
          value={fotos}
          onChange={(f) => {
            setFotos(f);
            quitarError('fotos');
          }}
          max={MAX_FOTOS_REPORTE}
          error={errores.fotos}
        />
      </div>
    </FormModal>
  );
}
