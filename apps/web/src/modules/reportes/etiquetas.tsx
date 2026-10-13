import { Tag } from 'lucide-react';
import {
  ESTATUS_REPORTE_LABEL,
  PRIORIDAD_REPORTE_LABEL,
  type EstatusReporte,
  type PrioridadReporte,
} from '@platinum/shared';
import { Badge, type BadgeTone } from '../../components/ui';
import { ICONOS_CATEGORIA } from './categoriaIconos';

const TONO_ESTATUS: Record<EstatusReporte, BadgeTone> = {
  abierto: 'info',
  notificado: 'brand',
  en_proceso: 'warning',
  resuelto: 'success',
  cerrado: 'neutral',
};

const TONO_PRIORIDAD: Record<PrioridadReporte, BadgeTone> = {
  baja: 'neutral',
  media: 'info',
  alta: 'warning',
  critica: 'danger',
};

export function EstatusBadge({ estatus }: { estatus: EstatusReporte }) {
  return <Badge tone={TONO_ESTATUS[estatus]}>{ESTATUS_REPORTE_LABEL[estatus]}</Badge>;
}

export function PrioridadBadge({ prioridad }: { prioridad: PrioridadReporte }) {
  return <Badge tone={TONO_PRIORIDAD[prioridad]}>{PRIORIDAD_REPORTE_LABEL[prioridad]}</Badge>;
}

export function IconoCategoria({ icono, className }: { icono: string | null; className?: string }) {
  const Icono = (icono && ICONOS_CATEGORIA[icono]?.icono) || Tag;
  return <Icono className={className} />;
}
