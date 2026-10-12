import { Construction } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, EmptyState } from '../../components/ui';

/** Página temporal para módulos aún no construidos; indica la tarea del PLAN que los cubre. */
export function PendientePage({ title, tareas }: { title: string; tareas: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon={<Construction className="size-10" />}
          title="Módulo en construcción"
          description={`Se implementa en las tareas ${tareas} del plan de trabajo.`}
        />
      </Card>
    </>
  );
}

export function NotFoundPage() {
  return <EmptyState title="Página no encontrada" description="La dirección no existe o fue movida." />;
}
