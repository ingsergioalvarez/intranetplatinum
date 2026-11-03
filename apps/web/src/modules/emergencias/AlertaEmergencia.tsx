import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Phone, Siren } from 'lucide-react';
import { TIPO_EMERGENCIA_LABEL, type Emergencia } from '@platinum/shared';
import { Button, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { formatFechaHora } from '../../core/format/fechas';
import { emergenciasService, enlaceMapa } from './emergencias.service';
import { detenerSirena, iniciarSirena } from './sirena';

/**
 * Alerta de emergencia a pantalla completa (A-60) para supervisor y admin: aparece sobre lo que estén haciendo
 * mientras haya una alerta que nadie ha recibido, y exige "Voy en camino". Se consulta cada 8 segundos y además
 * llega como push urgente aunque la app esté cerrada.
 */
export function AlertaEmergencia() {
  const activas = useQuery({
    queryKey: emergenciasService.keys.activas,
    queryFn: () => emergenciasService.lista('activas'),
    refetchInterval: 8000,
  });
  const sinAcuse = (activas.data?.items ?? []).filter((e) => !e.acusadaEn);
  const e = sinAcuse[0];

  const hay = !!e;
  const [sinSonido, setSinSonido] = useState(false);
  // Suena la sirena y vibra mientras la alerta siga sin recibirse. Si el navegador bloquea el audio se avisa
  // y el primer toque en la alerta lo activa.
  useEffect(() => {
    if (!hay) return;
    setSinSonido(!iniciarSirena());
    const id = setInterval(() => navigator.vibrate?.([400, 200, 400]), 2500);
    const reintento = setInterval(() => setSinSonido(!iniciarSirena()), 3000);
    return () => {
      clearInterval(id);
      clearInterval(reintento);
      detenerSirena();
    };
  }, [hay]);

  if (!e) return null;
  return createPortal(
    <Tarjeta emergencia={e} otras={sinAcuse.length - 1} sinSonido={sinSonido} onToque={() => setSinSonido(!iniciarSirena())} />,
    document.body,
  );
}

function Tarjeta({
  emergencia: e,
  otras,
  sinSonido,
  onToque,
}: {
  emergencia: Emergencia;
  otras: number;
  sinSonido: boolean;
  onToque: () => void;
}) {
  const qc = useQueryClient();
  const acusar = useMutation({
    mutationFn: () => emergenciasService.acusar(e.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: emergenciasService.keys.all });
      void qc.invalidateQueries({ queryKey: ['avisos'] });
    },
    onError: (err) => toast.error(mensajeDeError(err)),
  });
  const mapa = enlaceMapa(e);
  return (
    <div role="alertdialog" aria-modal="true" aria-label="Emergencia" onPointerDown={onToque} className="fixed inset-0 z-[80] grid place-items-center bg-red-700/95 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-3 text-red-700">
          <Siren className="size-9 shrink-0 animate-pulse" />
          <h2 className="text-2xl font-extrabold">EMERGENCIA</h2>
        </div>
        <div className="space-y-1">
          <p className="text-lg font-bold text-slate-900">{e.usuario.nombre}</p>
          <p className="text-sm text-slate-700">
            {e.sitio ? `En ${e.sitio.nombre}` : 'Sin sitio asignado'} · {formatFechaHora(e.createdAt)}
          </p>
          {e.tipo && <p className="text-sm font-semibold text-red-700">{TIPO_EMERGENCIA_LABEL[e.tipo]}</p>}
          {e.escaladas > 0 && <p className="text-sm font-semibold text-red-700">Nadie la ha recibido: se repitió la alerta.</p>}
          {e.bateria != null && <p className="text-xs text-slate-500">Batería del celular: {e.bateria}%</p>}
          {otras > 0 && <p className="text-xs text-slate-500">Hay {otras} alerta(s) más sin recibir.</p>}
        </div>
        {sinSonido && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-200 ring-inset">
            El navegador tiene el sonido bloqueado: toca la pantalla para activar la sirena.
          </p>
        )}
        <Button className="h-14 w-full text-lg" loading={acusar.isPending} onClick={() => acusar.mutate()}>
          Voy en camino
        </Button>
        <div className="grid grid-cols-2 gap-2">
          {e.usuario.telefono ? (
            <a
              href={`tel:${e.usuario.telefono}`}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-100 text-sm font-medium text-slate-800"
            >
              <Phone className="size-4" /> Llamar a {e.usuario.nombre.split(' ')[0]}
              {e.usuario.telefonoEtiqueta && (
                <span className="text-xs font-normal text-slate-500">
                  ({e.usuario.telefonoEtiqueta === 'personal' ? 'personal' : 'empresa'})
                </span>
              )}
            </a>
          ) : (
            <span className="flex h-11 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
              Sin teléfono
            </span>
          )}
          {mapa ? (
            <a
              href={mapa}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-100 text-sm font-medium text-slate-800"
            >
              <MapPin className="size-4" /> Ver mapa
            </a>
          ) : (
            <span className="flex h-11 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
              Sin ubicación
            </span>
          )}
        </div>
        <Link to="/asistencia/emergencias" className="block text-center text-sm font-medium text-slate-500 underline">
          Ver todas las emergencias
        </Link>
      </div>
    </div>
  );
}
