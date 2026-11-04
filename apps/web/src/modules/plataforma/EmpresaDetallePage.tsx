import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Power, RotateCcw } from 'lucide-react';
import { mensajeDeError } from '../../core/api';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Spinner, cn, toast } from '../../components/ui';
import { AdministradoresEmpresa } from './AdministradoresEmpresa';
import { DatosEmpresa } from './DatosEmpresa';
import { EmpresaAvatar } from './EmpresaAvatar';
import { MarcaEmpresa } from './MarcaEmpresa';
import { ModulosEmpresa } from './ModulosEmpresa';
import { plataformaService } from './plataforma.service';

const PESTANAS = [
  ['datos', 'Datos'],
  ['marca', 'Marca'],
  ['modulos', 'Módulos'],
  ['administradores', 'Administradores'],
] as const;
type Pestana = (typeof PESTANAS)[number][0];

/** Una empresa de la plataforma: datos, marca, módulos y administradores (C-07). */
export function EmpresaDetallePage() {
  const id = Number(useParams().id);
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [confirmar, setConfirmar] = useState<'desactivar' | 'reactivar' | null>(null);

  const empresa = useQuery({
    queryKey: plataformaService.keys.empresa(id),
    queryFn: () => plataformaService.obtener(id),
    enabled: Number.isInteger(id),
  });

  const accion = useMutation({
    mutationFn: (a: 'desactivar' | 'reactivar') =>
      a === 'desactivar' ? plataformaService.desactivar(id) : plataformaService.reactivar(id),
    onSuccess: (_r, a) => {
      void qc.invalidateQueries({ queryKey: plataformaService.keys.all });
      setConfirmar(null);
      toast.success(a === 'desactivar' ? 'Empresa desactivada' : 'Empresa reactivada');
    },
    onError: (e) => {
      setConfirmar(null);
      toast.error(mensajeDeError(e));
    },
  });

  if (empresa.isPending) {
    return (
      <div className="flex justify-center py-16 text-brand-600">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (!empresa.data) {
    return <EmptyState title="Empresa no encontrada" description="Puede que ya no exista o que no tengas acceso." />;
  }

  const e = empresa.data;
  const pedida = params.get('pestana');
  const pestana: Pestana = PESTANAS.some(([k]) => k === pedida) ? (pedida as Pestana) : 'datos';

  return (
    <>
      <Link to="/plataforma/empresas" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
        <ChevronLeft className="size-4" /> Empresas
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <EmpresaAvatar nombre={e.nombre} logoUrl={e.logoUrl} color={e.colorPrincipal} className="size-12" />
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-xl font-bold text-slate-900 md:text-2xl">
              {e.nombre}
            </h1>
            <Badge tone={e.activa ? 'success' : 'neutral'}>{e.activa ? 'Activa' : 'Inactiva'}</Badge>
          </div>
        </div>
        {e.activa ? (
          <Button
            variant="ghost"
            className="text-red-700 hover:bg-red-50"
            icon={<Power className="size-4" />}
            onClick={() => setConfirmar('desactivar')}
          >
            Desactivar
          </Button>
        ) : (
          <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => setConfirmar('reactivar')}>
            Reactivar
          </Button>
        )}
      </div>

      <div role="tablist" aria-label="Secciones de la empresa" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
        {PESTANAS.map(([clave, etiqueta]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={pestana === clave}
            onClick={() => setParams(clave === 'datos' ? {} : { pestana: clave }, { replace: true })}
            className={cn(
              'flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium sm:flex-none sm:px-5',
              pestana === clave ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <Card>
        <div className="p-4 md:p-6">
          {pestana === 'datos' && <DatosEmpresa empresa={e} />}
          {pestana === 'marca' && <MarcaEmpresa empresa={e} />}
          {pestana === 'modulos' && <ModulosEmpresa empresa={e} />}
          {pestana === 'administradores' && <AdministradoresEmpresa empresa={e} />}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmar !== null}
        title={confirmar === 'desactivar' ? '¿Desactivar la empresa?' : '¿Reactivar la empresa?'}
        description={
          confirmar === 'desactivar'
            ? `${e.nombre} quedará inactiva. No se borra nada: sus datos, módulos y administradores se conservan y se puede reactivar.`
            : `${e.nombre} volverá a estar activa.`
        }
        confirmLabel={confirmar === 'desactivar' ? 'Desactivar' : 'Reactivar'}
        variant={confirmar === 'desactivar' ? 'danger' : 'primary'}
        loading={accion.isPending}
        onConfirm={() => confirmar && accion.mutate(confirmar)}
        onCancel={() => setConfirmar(null)}
      />
    </>
  );
}
