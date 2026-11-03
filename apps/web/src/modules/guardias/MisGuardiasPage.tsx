import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import type { FilaAsistencia, GuardiaDeMiSitio } from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Card, CardHeader, EmptyState, Spinner, type BadgeTone } from '../../components/ui';
import { formatFecha, hoyLocal } from '../../core/format/fechas';
import { asistenciaService } from '../asistencia/asistencia.service';
import { describirAsignacion } from '../clientes/asignaciones';
import { Avatar } from '../clientes/AsignarTurnoModal';
import { sitiosService } from '../clientes/clientes.service';

/** Cómo está hoy un guardia del sitio, con palabras neutras (el cliente no ve retardos ni faltas). */
function estadoDeHoy(g: GuardiaDeMiSitio, fila: FilaAsistencia | undefined, hoy: string): { texto: string; tono: BadgeTone } {
  if (g.programada) return { texto: `Empieza el ${formatFecha(g.desde)}`, tono: 'info' };
  if (g.cobertura && g.hasta && g.hasta < hoy) return { texto: 'Cobertura terminada', tono: 'neutral' };
  if (fila?.jornada) {
    return fila.jornada.salida
      ? { texto: 'Turno cumplido hoy', tono: 'neutral' }
      : { texto: 'En servicio', tono: 'success' };
  }
  if (fila?.turno) {
    return fila.turno.estado === 'por_entrar'
      ? { texto: 'Por llegar', tono: 'info' }
      : { texto: 'Aún sin entrada', tono: 'warning' };
  }
  return { texto: 'Descansa hoy', tono: 'neutral' };
}

/**
 * Mis guardias (A-38, portal del cliente): los guardias asignados a los sitios de su empresa —vigentes,
 * próximos y los que cubren— con nombre, foto aprobada, horario y cómo está hoy. Sin datos de contacto ni
 * alertas internas.
 */
export function MisGuardiasPage() {
  const hoy = hoyLocal();
  const sitios = useQuery({ queryKey: sitiosService.keys.misGuardias, queryFn: sitiosService.misGuardias, refetchInterval: 60_000 });
  const params = { fecha: hoy, page: 1, limit: 1000 };
  const dia = useQuery({
    queryKey: asistenciaService.keys.dia(params),
    queryFn: () => asistenciaService.dia(params),
    refetchInterval: 60_000,
  });
  const filaDe = (id: number) => dia.data?.items.find((f) => f.guardia.id === id);

  return (
    <>
      <PageHeader title="Mis guardias" subtitle="Los guardias asignados a tus sitios y cómo están hoy" />
      {sitios.isPending ? (
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : sitios.isError ? (
        <EmptyState title="No se pudo cargar" description="Revisa tu conexión e intenta de nuevo." />
      ) : sitios.data.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="size-10" />} title="Sin sitios" description="Aún no hay sitios de tu empresa." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sitios.data.map((s) => (
            <Card key={s.id}>
              <CardHeader
                title={s.nombre}
                subtitle={s.guardias.length === 1 ? '1 guardia' : `${s.guardias.length} guardias`}
              />
              {s.guardias.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-slate-500">Este sitio aún no tiene guardias asignados.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {s.guardias.map((g) => {
                    const est = estadoDeHoy(g, filaDe(g.id), hoy);
                    return (
                      <li key={`${g.id}-${g.cobertura}`} className="flex items-start gap-3 px-4 py-3">
                        <Avatar foto={g.foto} nombre={g.nombre} />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold break-words text-slate-900">{g.nombre}</span>
                            {g.nuevo && <Badge tone="brand">Nuevo</Badge>}
                            {g.cobertura && <Badge tone="warning">Cobertura</Badge>}
                          </p>
                          <p className="text-sm text-slate-600">{describirAsignacion(g)}</p>
                          {g.grupo && <p className="text-xs text-slate-500">Grupo {g.grupo}</p>}
                        </div>
                        <Badge tone={est.tono}>{est.texto}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
