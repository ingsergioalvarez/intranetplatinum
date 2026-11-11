import { z } from 'zod';
import { idCoerce } from './comunes';

// ---------- Reportes del cliente sobre el servicio o un guardia (A-59) ----------

export const TIPOS_REPORTE_CLIENTE = ['servicio', 'guardia'] as const;
export type TipoReporteCliente = (typeof TIPOS_REPORTE_CLIENTE)[number];

export const TIPO_REPORTE_CLIENTE_LABEL: Record<TipoReporteCliente, string> = {
  servicio: 'Sobre el servicio',
  guardia: 'Sobre un guardia',
};

/** Fotos que el cliente puede adjuntar a un reporte (A-67). Solo imágenes. */
export const MAX_FOTOS_REPORTE_CLIENTE = 5;

export const ESTATUS_REPORTE_CLIENTE = ['abierto', 'en_revision', 'resuelto'] as const;
export type EstatusReporteCliente = (typeof ESTATUS_REPORTE_CLIENTE)[number];

export const ESTATUS_REPORTE_CLIENTE_LABEL: Record<EstatusReporteCliente, string> = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
};

/** El cliente levanta su reporte. Sobre un guardia, hay que elegir cuál. */
export const reporteClienteCreateSchema = z
  .object({
    tipo: z.enum(TIPOS_REPORTE_CLIENTE, 'Elige de qué trata el reporte'),
    sitioId: idCoerce('Elige el sitio'),
    guardiaId: z.coerce.number().int().positive().nullish(),
    // Con fotos el reporte llega como formulario (multipart) y el booleano viaja como texto.
    urgente: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean().default(false)),
    asunto: z.string().trim().min(5, 'Escribe un asunto (mín. 5 caracteres)').max(150),
    descripcion: z.string().trim().min(10, 'Cuéntanos más (mín. 10 caracteres)').max(2000),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === 'guardia' && !v.guardiaId) {
      ctx.addIssue({ code: 'custom', path: ['guardiaId'], message: 'Elige al guardia' });
    }
  });
export type ReporteClienteCreateInput = z.input<typeof reporteClienteCreateSchema>;
export type ReporteClienteCreateData = z.output<typeof reporteClienteCreateSchema>;

/** Supervisor o admin: lo toma a revisión o lo resuelve (con la respuesta que verá el cliente). */
export const atenderReporteClienteSchema = z
  .object({
    estatus: z.enum(['en_revision', 'resuelto'], 'Elige qué hacer con el reporte'),
    respuesta: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
  })
  .superRefine((v, ctx) => {
    if (v.estatus === 'resuelto' && (v.respuesta?.length ?? 0) < 5) {
      ctx.addIssue({ code: 'custom', path: ['respuesta'], message: 'Escribe qué se hizo (mín. 5 caracteres)' });
    }
  });
export type AtenderReporteClienteInput = z.input<typeof atenderReporteClienteSchema>;
export type AtenderReporteClienteData = z.output<typeof atenderReporteClienteSchema>;

export interface ReporteCliente {
  id: number;
  tipo: TipoReporteCliente;
  urgente: boolean;
  asunto: string;
  descripcion: string;
  estatus: EstatusReporteCliente;
  createdAt: string;
  sitio: { id: number; nombre: string };
  cliente: { id: number; nombreComercial: string };
  /** Solo en los reportes sobre un guardia. */
  guardia: { id: number; nombre: string } | null;
  creadoPor: { id: number; nombre: string };
  atendidoEn: string | null;
  atendidoPor: string | null;
  /** Lo que se le contesta al cliente. */
  respuesta: string | null;
  /** Fotos que adjuntó el cliente (URL firmada, de la más vieja a la más nueva). */
  fotos: { id: number; url: string }[];
}

export interface ReportesClienteLista {
  items: ReporteCliente[];
  /** Los que siguen sin resolver. */
  pendientes: number;
}

/** Lo que el cliente puede elegir al reportar: sus sitios y los guardias de cada uno hoy. */
export interface OpcionesReporteCliente {
  sitios: { id: number; nombre: string; guardias: { id: number; nombre: string }[] }[];
}
