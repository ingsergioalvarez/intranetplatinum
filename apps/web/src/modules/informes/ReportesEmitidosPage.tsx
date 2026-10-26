import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FilePlus2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, Card } from '../../components/ui';
import { NuevoInformeModal } from './NuevoInformeModal';
import { TablaInformes } from './TablaInformes';

/** Reportes de asistencia emitidos (DA-52): tabla de solo lectura con Ver / PDF / Excel. */
export function ReportesEmitidosPage() {
  const [nuevo, setNuevo] = useState(false);
  return (
    <>
      <Link
        to="/asistencia"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> Asistencia
      </Link>
      <PageHeader
        title="Reportes emitidos"
        subtitle="Reportes oficiales de asistencia. No se editan: si algo cambia se emite uno nuevo."
        actions={
          <Button icon={<FilePlus2 className="size-4" />} onClick={() => setNuevo(true)}>
            Nuevo reporte
          </Button>
        }
      />
      <Card>
        <TablaInformes />
      </Card>
      {nuevo && <NuevoInformeModal onClose={() => setNuevo(false)} />}
    </>
  );
}
