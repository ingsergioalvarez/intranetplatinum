import {
  ESTADO_COBERTURA_LABEL,
  SITUACION_GUARDIA_LABEL,
  type CoberturaSitio,
  type TurnoCobertura,
  type TurnoDiaCobertura,
} from '@platinum/shared';
import { Shuffle } from 'lucide-react';
import { Badge, Button, Modal } from '../../components/ui';
import { ESTILO_ESTADO, diaLargo } from './estados';

const MOTIVO: Record<NonNullable<TurnoDiaCobertura['motivo']>, string> = {
  sin_asignar: 'Nadie tiene este turno asignado ese día.',
  ausente: 'El guardia no se ha presentado.',
  falta: 'El guardia faltó a su turno.',
};

export interface PedirCobertura {
  turno: TurnoCobertura;
  fecha: string;
  /** Guardia al que se cubre (el que faltó o no se ha presentado). */
  cubreA: { id: number; nombre: string } | null;
}

/** Detalle de un día (AS6-02): quién cubre cada turno y, si hay un hueco, dónde asignar a alguien (AS6-04). */
export function DiaCoberturaModal({
  data,
  fecha,
  hoy,
  onCubrir,
  onClose,
}: {
  data: CoberturaSitio;
  fecha: string;
  hoy: string;
  onCubrir: (p: PedirCobertura) => void;
  onClose: () => void;
}) {
  const turnos = data.dias.find((d) => d.fecha === fecha)?.turnos ?? [];
  return (
    <Modal open onClose={onClose} title={diaLargo(fecha)} description={data.sitio.nombre}>
      {turnos.length === 0 ? (
        <p className="text-sm text-slate-500">Este sitio no tiene turnos ese día.</p>
      ) : (
        <ul className="space-y-3">
          {turnos.map((t) => {
            const turno = data.turnos.find((x) => x.clave === t.clave)!;
            const falla = t.guardias.find((g) => g.origen === 'turno' && (g.situacion === 'falta' || g.situacion === 'ausente'));
            return (
              <li key={t.clave} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{turno.etiqueta}</span>
                  <Badge tone={ESTILO_ESTADO[t.estado].tono}>{ESTADO_COBERTURA_LABEL[t.estado]}</Badge>
                </div>
                {t.motivo && <p className="mt-1 text-sm text-red-700">{MOTIVO[t.motivo]}</p>}
                {t.guardias.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {t.guardias.map((g) => (
                      <li key={`${g.id}-${g.origen}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-slate-800">{g.nombre}</span>
                        <span className="text-slate-500">{SITUACION_GUARDIA_LABEL[g.situacion]}</span>
                        {g.origen === 'cobertura' && <Badge tone="brand">Cobertura</Badge>}
                        {g.extra && <Badge tone="warning">Horas extra</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
                {t.estado === 'sin_cubrir' && fecha >= hoy && (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    icon={<Shuffle className="size-4" />}
                    onClick={() => onCubrir({ turno, fecha, cubreA: falla ? { id: falla.id, nombre: falla.nombre } : null })}
                  >
                    Asignar quién cubre
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
