import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { TIPO_INFORME_LABEL } from '@platinum/shared';
import { Spinner, cn } from '../../components/ui';
import { ApiError } from '../../core/api';
import { formatFecha, formatFechaHora } from '../../core/format/fechas';
import { informesService } from './informes.service';

/**
 * Verificación pública de un reporte de asistencia (la abre el QR del PDF). Sin sesión: solo dice si el
 * folio existe, si el código coincide y sus totales; no muestra nombres ni detalle.
 */
export function VerificarInformePage() {
  const folio = useParams().folio ?? '';
  const codigo = useSearchParams()[0].get('c') ?? undefined;
  const q = useQuery({
    queryKey: ['informes', 'verificar', folio, codigo],
    queryFn: () => informesService.verificar(folio, codigo),
    retry: false,
  });

  const v = q.data;
  const noExiste = q.error instanceof ApiError && q.error.status === 404;
  const falso = v?.codigoValido === false;
  const reemplazado = v && !v.vigente;

  const estado = q.isPending
    ? null
    : noExiste || falso
      ? { tono: 'rojo', icono: ShieldX, titulo: noExiste ? 'No existe un reporte con ese folio' : 'El código no coincide', texto: noExiste ? 'Revisa el folio o solicita el documento original a Platinum Agency.' : 'El folio existe, pero el código impreso no corresponde: el documento puede haber sido alterado.' }
      : q.isError || !v
        ? { tono: 'rojo', icono: ShieldX, titulo: 'No se pudo verificar', texto: 'Intenta de nuevo en unos minutos.' }
        : reemplazado
          ? { tono: 'ambar', icono: ShieldAlert, titulo: 'Auténtico, pero reemplazado', texto: `Este reporte fue sustituido por ${v.reemplazadoPor}. Consulta el folio vigente.` }
          : { tono: 'verde', icono: BadgeCheck, titulo: 'Reporte auténtico y vigente', texto: v.codigoValido ? 'El folio y el código de verificación coinciden con el registro.' : 'El folio existe. Para confirmar el código, abre el enlace del QR del documento.' };

  const colores = {
    verde: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    ambar: 'bg-amber-50 text-amber-900 ring-amber-200',
    rojo: 'bg-red-50 text-red-900 ring-red-200',
  } as const;

  return (
    <div className="min-h-dvh bg-slate-100">
      <header className="bg-brand-900 px-4 py-4 text-white">
        <div className="mx-auto max-w-md">
          <p className="text-lg font-bold tracking-widest">PLATINUM AGENCY</p>
          <p className="text-[10px] tracking-[0.25em] text-brand-200">SEGURIDAD FÍSICA INTRAMUROS</p>
        </div>
      </header>
      <main className="mx-auto max-w-md space-y-4 px-4 py-6 pb-safe">
        <h1 className="text-xl font-bold text-slate-900">Verificación de reporte de asistencia</h1>
        <p className="font-mono text-sm text-slate-600">{folio}</p>

        {q.isPending ? (
          <div className="flex justify-center py-10 text-brand-600">
            <Spinner className="size-7" />
          </div>
        ) : (
          estado && (
            <div className={cn('flex items-start gap-3 rounded-2xl p-4 ring-1 ring-inset', colores[estado.tono as keyof typeof colores])} role="status">
              <estado.icono className="mt-0.5 size-7 shrink-0" />
              <div>
                <p className="font-semibold">{estado.titulo}</p>
                <p className="text-sm opacity-90">{estado.texto}</p>
              </div>
            </div>
          )
        )}

        {v && !falso && (
          <dl className="space-y-3 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
            {[
              ['Tipo', TIPO_INFORME_LABEL[v.tipo]],
              ['Periodo', `${formatFecha(v.desde)} – ${formatFecha(v.hasta)}`],
              ['Emitido', formatFechaHora(v.emitidoEn)],
              ['Días programados', v.resumen.programados],
              ['Días trabajados', v.resumen.trabajados],
              ['Faltas', v.resumen.faltas],
              ['Retardos', v.resumen.retardos],
            ].map(([k, val]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-900">{val}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-xs text-slate-500">
          Esta página solo confirma que el documento fue emitido por Platinum Agency y sus totales. El detalle es de uso interno.
        </p>
      </main>
    </div>
  );
}
