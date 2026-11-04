import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Lock } from 'lucide-react';
import {
  CLAVES_OPCIONALES,
  GRUPO_MODULO_LABEL,
  MODULOS,
  MODULOS_NUCLEO,
  alApagar,
  alEncender,
  moduloDe,
  type Empresa,
  type EstadoModulos,
  type GrupoModulo,
} from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { Button, ConfirmDialog, Modal, Spinner, Switch, toast } from '../../components/ui';
import { plataformaService } from './plataforma.service';

const nombres = (claves: string[]) => claves.map((c) => moduloDe(c)?.nombre ?? c).join(', ');

/** Pestaña Módulos: lo siempre incluido y los interruptores de lo opcional, con sus dependencias (C-07). */
export function ModulosEmpresa({ empresa }: { empresa: Empresa }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: plataformaService.keys.modulos(empresa.id),
    queryFn: () => plataformaService.modulos(empresa.id),
  });
  /** Copia con los cambios sin guardar; null = igual a lo guardado. */
  const [local, setLocal] = useState<EstadoModulos | null>(null);
  /** Encender algo que necesita otros módulos apagados: se pregunta si se encienden juntos. */
  const [pregunta, setPregunta] = useState<{ clave: string; tambien: string[] } | null>(null);
  /** Apagar algo que otros módulos encendidos necesitan: se explica por qué no se puede. */
  const [bloqueo, setBloqueo] = useState<{ clave: string; usan: string[] } | null>(null);

  const guardado = q.data?.modulos;
  const estado = local ?? guardado;

  const guardar = useMutation({
    mutationFn: (cambios: Record<string, boolean>) => plataformaService.guardarModulos(empresa.id, cambios),
    onSuccess: () => {
      setLocal(null);
      void qc.invalidateQueries({ queryKey: plataformaService.keys.all });
      toast.success('Módulos actualizados');
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  if (q.isPending || !estado || !guardado) {
    return (
      <div className="flex justify-center py-10 text-brand-600">
        <Spinner className="size-7" />
      </div>
    );
  }

  const cambios = Object.fromEntries(
    CLAVES_OPCIONALES.filter((c) => estado[c] !== guardado[c]).map((c) => [c, estado[c]]),
  );
  const hayCambios = Object.keys(cambios).length > 0;

  const poner = (valores: Record<string, boolean>) => setLocal({ ...estado, ...valores });

  const alternar = (clave: string, encender: boolean) => {
    if (encender) {
      const faltan = alEncender(estado, clave);
      if (faltan.length) setPregunta({ clave, tambien: faltan });
      else poner({ [clave]: true });
      return;
    }
    const usan = alApagar(estado, clave);
    if (usan.length) setBloqueo({ clave, usan });
    else poner({ [clave]: false });
  };

  const grupo = (g: GrupoModulo) => MODULOS.filter((m) => m.grupo === g);

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0" />
        Aquí se decide qué módulos tiene {empresa.nombre}. Por ahora solo se registran: el menú y las pantallas todavía no cambian
        según estos interruptores.
      </p>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{GRUPO_MODULO_LABEL.nucleo}</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {MODULOS_NUCLEO.map((m) => (
            <li key={m.clave} className="flex items-start gap-3 px-4 py-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{m.nombre}</p>
                <p className="text-sm text-slate-500">{m.descripcion}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {(['general', 'seguridad'] as const).map((g) => (
        <section key={g}>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">{GRUPO_MODULO_LABEL[g]}</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {grupo(g).map((m) => {
              const clave = m.clave as keyof EstadoModulos;
              const necesita = m.dependeDe;
              const loUsan = MODULOS.filter((x) => (x.dependeDe as readonly string[]).includes(m.clave)).map((x) => x.clave);
              return (
                <li key={m.clave} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{m.nombre}</p>
                    <p className="text-sm text-slate-500">{m.descripcion}</p>
                    {necesita.length > 0 && <p className="mt-0.5 text-xs text-slate-500">Necesita: {nombres([...necesita])}</p>}
                    {loUsan.length > 0 && <p className="mt-0.5 text-xs text-slate-500">Lo necesitan: {nombres(loUsan)}</p>}
                    {'nota' in m && m.nota && <p className="mt-0.5 text-xs text-amber-700">{m.nota}</p>}
                  </div>
                  <Switch
                    checked={estado[clave]}
                    onChange={(v) => alternar(m.clave, v)}
                    label={`${m.nombre}: ${estado[clave] ? 'encendido' : 'apagado'}`}
                    className="mt-0.5"
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={!hayCambios} onClick={() => setLocal(null)}>
          Descartar cambios
        </Button>
        <Button loading={guardar.isPending} disabled={!hayCambios} onClick={() => guardar.mutate(cambios)}>
          Guardar cambios
        </Button>
      </div>

      <ConfirmDialog
        open={pregunta !== null}
        title={`Para encender "${pregunta ? moduloDe(pregunta.clave)?.nombre : ''}"`}
        description={`Necesita también: ${pregunta ? nombres(pregunta.tambien) : ''}. ¿Encenderlos juntos?`}
        confirmLabel={`Encender ${pregunta ? pregunta.tambien.length + 1 : ''}`}
        variant="primary"
        onConfirm={() => {
          if (pregunta) poner(Object.fromEntries([pregunta.clave, ...pregunta.tambien].map((c) => [c, true])));
          setPregunta(null);
        }}
        onCancel={() => setPregunta(null)}
      />

      <Modal
        open={bloqueo !== null}
        onClose={() => setBloqueo(null)}
        size="sm"
        title="No se puede apagar"
        footer={<Button onClick={() => setBloqueo(null)}>Entendido</Button>}
      >
        {bloqueo && (
          <p className="text-sm text-slate-700">
            {moduloDe(bloqueo.clave)?.nombre} la usan {nombres(bloqueo.usan)}. Apágalos primero.
          </p>
        )}
      </Modal>
    </div>
  );
}
