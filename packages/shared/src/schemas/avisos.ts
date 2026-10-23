import { z } from 'zod';
import { PRIORIDAD_REPORTE, type PrioridadReporte } from '../constants/reportes';

// ---------- Reglas de aviso por cliente (F3-09, D-016) ----------

export const DESTINOS_AVISO = ['supervisor', 'cliente', 'ambos'] as const;
export type DestinoAviso = (typeof DESTINOS_AVISO)[number];

export const DESTINO_AVISO_LABEL: Record<DestinoAviso, string> = {
  supervisor: 'Solo supervisor',
  cliente: 'Solo cliente',
  ambos: 'Supervisor y cliente',
};

export interface ReglasAviso {
  porDefecto: DestinoAviso;
  /** Excepciones por prioridad; si falta, aplica `porDefecto`. */
  porPrioridad: Partial<Record<PrioridadReporte, DestinoAviso>>;
}

export const reglasAvisoSchema = z.object({
  porDefecto: z.enum(DESTINOS_AVISO, 'Elige a quién se avisa'),
  porPrioridad: z
    .object(
      Object.fromEntries(PRIORIDAD_REPORTE.map((p) => [p, z.enum(DESTINOS_AVISO).nullish()])) as Record<
        PrioridadReporte,
        z.ZodOptional<z.ZodNullable<z.ZodEnum<{ [K in DestinoAviso]: K }>>>
      >,
    )
    .default({}),
});

export type ReglasAvisoInput = z.input<typeof reglasAvisoSchema>;

/** A quién se avisa de un reporte de esta prioridad. */
export function resolverDestino(reglas: ReglasAviso, prioridad: PrioridadReporte): DestinoAviso {
  return reglas.porPrioridad[prioridad] ?? reglas.porDefecto;
}

export const avisaASupervisor = (d: DestinoAviso) => d === 'supervisor' || d === 'ambos';
export const avisaACliente = (d: DestinoAviso) => d === 'cliente' || d === 'ambos';

// ---------- Avisos en la app (F3-10) ----------

export const TIPOS_AVISO = [
  'reporte_nuevo',
  'reporte_estatus',
  'reporte_comentario',
  // Asistencia (A-17)
  'rostro_pendiente',
  'rostro_suplantacion',
  'rostro_duplicado',
  'rostro_pantalla',
  'rostro_reto',
  // Para el guardia (DA-34) y retardo para supervisores (DA-33)
  'rostro_aprobado',
  'rostro_rechazado',
  'cuenta_intento',
  'asignacion',
  'grupo',
  'retardo',
  'marca_alerta',
] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
  reporteId: number | null;
  /** Pantalla a la que lleva el aviso (avisos que no son de un reporte). */
  ruta?: string | null;
  /** Miniatura de la foto de evidencia (incidencias de rostro), URL firmada. */
  foto?: string | null;
  leido: boolean;
  createdAt: string;
}

export interface BandejaAvisos {
  items: Aviso[];
  noLeidos: number;
}
