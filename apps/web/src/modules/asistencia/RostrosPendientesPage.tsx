import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ScanFace } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, EmptyState, Spinner } from '../../components/ui';
import { asistenciaService } from './asistencia.service';
import { RevisionRostro } from './RevisionRostro';

/** Rostros que los guardias registraron ellos mismos y esperan revisión (supervisor/admin). */
export function RostrosPendientesPage() {
  const pendientes = useQuery({
    queryKey: asistenciaService.keys.pendientes,
    queryFn: asistenciaService.rostrosPendientes,
  });

  return (
    <>
      <Link
        to="/asistencia"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> Asistencia
      </Link>
      <PageHeader
        title="Rostros por revisar"
        subtitle="Revisa que las fotos sean de la persona y que se vean bien"
      />

      {pendientes.isPending ? (
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : pendientes.isError ? (
        <EmptyState title="No se pudieron cargar los rostros" description="Revisa tu conexión." />
      ) : pendientes.data.length === 0 ? (
        <EmptyState
          icon={<ScanFace className="size-10" />}
          title="Nada por revisar"
          description="Cuando un guardia registre su rostro aparecerá aquí."
        />
      ) : (
        <div className="grid max-w-4xl gap-3 md:grid-cols-2">
          {pendientes.data.map(({ guardia, rostro }) => (
            <Card key={rostro.id} className="space-y-3 p-4">
              <div>
                <p className="font-semibold text-slate-900">{guardia.nombre}</p>
                <p className="text-sm text-slate-500">{guardia.email}</p>
              </div>
              <RevisionRostro guardia={guardia} rostro={rostro} puedeRevisar />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
