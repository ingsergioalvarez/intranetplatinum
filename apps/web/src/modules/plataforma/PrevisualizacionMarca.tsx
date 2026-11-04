import { useState } from 'react';
import { Bell, ClipboardCheck, House, Menu, Users } from 'lucide-react';
import type { PaletaGenerada } from '@platinum/shared';
import { cn } from '../../components/ui';
import { EmpresaAvatar, TarjetaEmpresa } from './EmpresaAvatar';

const VISTAS = [
  ['principal', 'Pantalla principal'],
  ['celular', 'Celular'],
  ['reporte', 'Reporte (PDF)'],
] as const;
type Vista = (typeof VISTAS)[number][0];

/** Nuestra marca: siempre igual, nunca toma los colores de la empresa. */
function MarcaProducto({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img src="/favicon.svg" alt="" className="size-7 shrink-0" />
      <span className="truncate text-sm font-semibold tracking-tight">
        <span className="text-platinum-300">gestión</span> <span className="text-acento-400">comunícalo.</span>
      </span>
    </div>
  );
}

interface Props {
  nombre: string;
  logoUrl: string | null;
  paleta: PaletaGenerada;
}

/** Cómo se verá la marca de la empresa en la pantalla principal, en el celular y en un reporte. */
export function PrevisualizacionMarca({ nombre, logoUrl, paleta }: Props) {
  const [vista, setVista] = useState<Vista>('principal');
  const { brand, acento } = paleta;

  const tarjeta = (compacta?: boolean) => (
    <TarjetaEmpresa nombre={nombre} logoUrl={logoUrl} colorPrincipal={brand['700']} acento={acento['400']} compacta={compacta} />
  );

  return (
    <div>
      <div role="tablist" aria-label="Vista previa" className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1 sm:inline-flex">
        {VISTAS.map(([clave, etiqueta]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={vista === clave}
            onClick={() => setVista(clave)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium sm:flex-none',
              vista === clave ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {vista === 'principal' && (
        <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 sm:grid-cols-[230px_1fr]">
          <div style={{ backgroundColor: brand['900'] }} className="p-4 text-white">
            <MarcaProducto />
            <div className="mt-3">{tarjeta()}</div>
            <div className="mt-4 space-y-1">
              <div style={{ backgroundColor: brand['700'] }} className="rounded-lg px-3 py-2 text-sm font-medium">
                Inicio
              </div>
              <div style={{ color: brand['100'] }} className="px-3 py-2 text-sm">
                Asistencia
              </div>
              <div style={{ color: brand['100'] }} className="px-3 py-2 text-sm">
                Usuarios
              </div>
            </div>
          </div>
          <div className="space-y-3 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">Hola, Ana</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['0', 'Sin llegar'],
                ['12', 'Marcaron hoy'],
                ['1', 'Por revisar'],
              ].map(([n, t]) => (
                <div key={t} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-lg font-bold text-slate-900">{n}</p>
                  <p className="text-xs text-slate-500">{t}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span style={{ backgroundColor: brand['700'] }} className="rounded-lg px-4 py-2 text-sm font-medium text-white">
                Botón principal
              </span>
              <span style={{ color: brand['700'] }} className="text-sm font-medium">
                Enlace
              </span>
              <span
                style={{ backgroundColor: brand['50'], color: brand['700'], borderColor: brand['200'] }}
                className="rounded-full border px-2 py-0.5 text-xs font-medium"
              >
                Etiqueta
              </span>
              <span style={{ backgroundColor: acento['400'] }} className="size-2.5 rounded-full" aria-label="Acento" />
            </div>
          </div>
        </div>
      )}

      {vista === 'celular' && (
        <div className="mx-auto w-[290px] overflow-hidden rounded-[28px] border-4 border-slate-800 bg-slate-50 shadow-md">
          <div style={{ backgroundColor: brand['900'] }} className="px-3 pb-2.5 pt-3 text-white">
            <div className="flex items-center justify-between">
              <MarcaProducto />
              <Bell className="size-5 text-white/80" aria-hidden="true" />
            </div>
            <div className="mt-2">{tarjeta(true)}</div>
          </div>
          <div className="h-44 space-y-2 p-3">
            <p className="text-sm font-semibold text-slate-900">Hola, Ana</p>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-lg font-bold text-slate-900">12</p>
              <p className="text-xs text-slate-500">Marcaron hoy</p>
            </div>
            <span style={{ backgroundColor: brand['700'] }} className="inline-block rounded-lg px-3 py-1.5 text-xs font-medium text-white">
              Ver asistencia
            </span>
          </div>
          <div className="flex justify-around border-t border-slate-200 bg-white py-2">
            {[House, ClipboardCheck, Users, Menu].map((Icono, i) => (
              <span
                key={i}
                style={i === 0 ? { backgroundColor: brand['700'], color: '#fff' } : undefined}
                className={cn('flex size-9 items-center justify-center rounded-lg', i !== 0 && 'text-slate-500')}
              >
                <Icono className="size-5" aria-hidden="true" />
              </span>
            ))}
          </div>
        </div>
      )}

      {vista === 'reporte' && (
        <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <EmpresaAvatar nombre={nombre} logoUrl={logoUrl} color={brand['700']} className="size-11" />
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">{nombre}</p>
                <p className="text-xs text-slate-500">Reporte de asistencia · 1 al 15 de noviembre</p>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-slate-500">
              <p>Folio</p>
              <p className="font-mono text-slate-700">R-2026-0042</p>
            </div>
          </div>
          <div style={{ backgroundColor: brand['700'] }} className="mt-4 h-1 rounded-full" />
          <table className="mt-3 w-full text-left text-xs">
            <thead>
              <tr style={{ backgroundColor: brand['700'] }} className="text-white">
                <th className="px-2 py-1.5 font-medium">Colaborador</th>
                <th className="px-2 py-1.5 font-medium">Horas</th>
                <th className="px-2 py-1.5 font-medium">Retardos</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {[
                ['Ana Pérez', '88 h', '0'],
                ['Luis Gómez', '84 h', '2'],
                ['María Ruiz', '90 h', '1'],
              ].map(([n, h, r]) => (
                <tr key={n} className="border-b border-slate-100">
                  <td className="px-2 py-1.5">{n}</td>
                  <td className="px-2 py-1.5">{h}</td>
                  <td className="px-2 py-1.5">{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <img src="/favicon.svg" alt="" className="size-4" />
            Generado con Gestión Comunicalo
          </div>
        </div>
      )}
    </div>
  );
}
