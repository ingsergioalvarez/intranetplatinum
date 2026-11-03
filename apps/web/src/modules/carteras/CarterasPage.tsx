import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, Briefcase, TriangleAlert } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, EmptyState, Spinner } from '../../components/ui';
import { carterasService } from './carteras.service';
import { TransferirCarteraModal } from './TransferirCarteraModal';

/** Carteras de los admin (A-65): cuánto tiene cada uno y pasarla de uno a otro. Solo el super admin. */
export function CarterasPage() {
  const resumen = useQuery({ queryKey: carterasService.keys.resumen, queryFn: carterasService.resumen });
  const [pasando, setPasando] = useState<{ id: number | null; nombre: string } | null>(null);
  const sin = resumen.data?.sinAsignar;
  const haySin = !!sin && sin.usuarios + sin.clientes + sin.grupos > 0;

  return (
    <>
      <PageHeader
        title="Carteras"
        subtitle="Lo que ve y administra cada administrador. Tú ves todo."
      />
      {resumen.isPending ? (
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : resumen.isError ? (
        <EmptyState title="No se pudo cargar" description="Revisa tu conexión e intenta de nuevo." />
      ) : (
        <div className="space-y-3">
          {haySin && (
            <Card className="border-amber-300 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-amber-900">
                  <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Sin asignar</p>
                    <p className="text-sm">
                      {sin!.usuarios} usuarios, {sin!.clientes} clientes y {sin!.grupos} grupos no tienen administrador:
                      solo tú los ves y siguen funcionando. Asígnalos para que alguien los atienda.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    to="/usuarios?sinAsignar=1"
                    className="inline-flex h-11 items-center rounded-lg bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset"
                  >
                    Ver usuarios
                  </Link>
                  <Button icon={<ArrowRightLeft className="size-4" />} onClick={() => setPasando({ id: null, nombre: 'sin asignar' })}>
                    Asignar
                  </Button>
                </div>
              </div>
            </Card>
          )}
          <ul className="space-y-3">
            {resumen.data.admins.map((a) => (
              <li key={a.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Briefcase className="size-4 text-slate-400" />
                        <p className="font-semibold text-slate-900">{a.nombre}</p>
                        {a.esSuperAdmin && <Badge tone="brand">Super admin</Badge>}
                        {!a.activo && <Badge tone="neutral">De baja</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {a.usuarios} usuarios · {a.clientes} clientes · {a.grupos} grupos
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      icon={<ArrowRightLeft className="size-4" />}
                      disabled={a.usuarios + a.clientes + a.grupos === 0}
                      onClick={() => setPasando({ id: a.id, nombre: a.nombre })}
                    >
                      Pasar cartera
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
      {pasando && (
        <TransferirCarteraModal
          origenId={pasando.id}
          origenNombre={pasando.nombre}
          onClose={() => setPasando(null)}
          onListo={() => setPasando(null)}
        />
      )}
    </>
  );
}
