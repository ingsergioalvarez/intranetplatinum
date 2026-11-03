import { z } from 'zod';
import { notaSchema } from './medidas';
import type { ContactoTelefono, EtiquetaTelefono } from './usuarios';

/**
 * Botón de pánico (A-60): el guardia, el supervisor o el admin mantienen presionado el botón SOS y se avisa de
 * inmediato (con ubicación y hora del servidor) a quien debe atenderlo. Si nadie la acusa a tiempo, se escala.
 */
export const TIPOS_EMERGENCIA = ['agresion', 'intruso', 'medica', 'incendio', 'otro'] as const;
export type TipoEmergencia = (typeof TIPOS_EMERGENCIA)[number];
export const TIPO_EMERGENCIA_LABEL: Record<TipoEmergencia, string> = {
  agresion: 'Agresión o robo',
  intruso: 'Intruso',
  medica: 'Emergencia médica',
  incendio: 'Incendio',
  otro: 'Otro',
};

export const ESTADOS_EMERGENCIA = ['activa', 'cerrada'] as const;
export type EstadoEmergencia = (typeof ESTADOS_EMERGENCIA)[number];

export const RESULTADOS_EMERGENCIA = ['atendida', 'falsa_alarma', 'otro'] as const;
export type ResultadoEmergencia = (typeof RESULTADOS_EMERGENCIA)[number];
export const RESULTADO_EMERGENCIA_LABEL: Record<ResultadoEmergencia, string> = {
  atendida: 'Atendida',
  falsa_alarma: 'Falsa alarma',
  otro: 'Otro',
};

/** Segundos que se mantiene presionado el botón, y segundos sin acuse antes de escalar (y repetir). */
export const SEGUNDOS_PRESIONAR_SOS = 2;
export const SEGUNDOS_ESCALAR_EMERGENCIA = 60;

export const emergenciaCreateSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  /** Precisión del GPS en metros. */
  precisionM: z.number().min(0).max(100000).optional(),
  /** Batería del celular (0–100). */
  bateria: z.number().min(0).max(100).optional(),
});
export type EmergenciaCreateInput = z.infer<typeof emergenciaCreateSchema>;

export const emergenciaTipoSchema = z.object({ tipo: z.enum(TIPOS_EMERGENCIA, 'Elige el tipo') });
export type EmergenciaTipoInput = z.infer<typeof emergenciaTipoSchema>;

export const emergenciaCerrarSchema = z
  .object({
    resultado: z.enum(RESULTADOS_EMERGENCIA, 'Elige cómo terminó'),
    nota: notaSchema,
  })
  .superRefine((v, ctx) => {
    if (v.resultado === 'otro' && !v.nota?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['nota'], message: 'Escribe qué pasó' });
    }
  });
export type EmergenciaCerrarInput = z.infer<typeof emergenciaCerrarSchema>;

export interface Emergencia {
  id: number;
  estado: EstadoEmergencia;
  /** Quien la lanzó. */
  usuario: { id: number; nombre: string; rol: string; telefono: string | null; telefonoEtiqueta: EtiquetaTelefono | null };
  /** Solo en la alerta propia del guardia: a quién llamar (su supervisor del sitio). */
  supervisor?: ContactoTelefono | null;
  sitio: { id: number; nombre: string } | null;
  tipo: TipoEmergencia | null;
  lat: number | null;
  lng: number | null;
  precisionM: number | null;
  bateria: number | null;
  /** Hora del servidor. */
  createdAt: string;
  /** Quién la recibió ("Voy en camino") y cuándo. */
  acusadaPor: string | null;
  acusadaEn: string | null;
  /** Veces que se repitió la alerta por falta de acuse. */
  escaladas: number;
  cerradaEn: string | null;
  cerradaPor: string | null;
  resultado: ResultadoEmergencia | null;
  nota: string | null;
}

export interface EmergenciasLista {
  items: Emergencia[];
  activas: number;
}
