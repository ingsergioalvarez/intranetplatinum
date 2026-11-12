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

/** Una persona a la que se puede llamar por una emergencia, con todos sus números (el de la empresa y el personal). */
export interface ContactoEmergencia {
  nombre: string;
  cargo: 'guardia' | 'supervisor' | 'admin';
  telefonos: { numero: string; etiqueta: EtiquetaTelefono }[];
}

/**
 * Lo que el C2 registra sobre una emergencia que sigue activa (A-81). "Estamos atendiendo" es aparte (`acusar`). No
 * cierran la emergencia: cerrarla es de supervisor y admin.
 */
export const RESPUESTAS_C2_SOS = ['llamamos_ok', 'llamamos_sin_respuesta', 'avisamos_supervisor', 'apoyo_externo', 'otro'] as const;
export type RespuestaC2Sos = (typeof RESPUESTAS_C2_SOS)[number];
export const RESPUESTA_C2_SOS_LABEL: Record<RespuestaC2Sos, string> = {
  llamamos_ok: 'Llamamos al guardia: contesta y está bien',
  llamamos_sin_respuesta: 'Llamamos al guardia: no contesta',
  avisamos_supervisor: 'Avisamos al supervisor',
  apoyo_externo: 'Pedimos apoyo externo (policía, ambulancia u otro)',
  otro: 'Otro',
};

export const emergenciaRespuestaSchema = z
  .object({
    tipo: z.enum(RESPUESTAS_C2_SOS, 'Elige la respuesta'),
    /** Apoyo externo: a quién se pidió (obligatorio) y el número al que se llamó (opcional: a veces es solo 911). */
    institucion: z.string().trim().max(120, 'Máximo 120 caracteres').optional(),
    telefono: z.string().trim().max(30, 'Máximo 30 caracteres').optional(),
    /** Otro: qué se hizo (obligatorio). */
    texto: z.string().trim().max(300, 'Máximo 300 caracteres').optional(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === 'apoyo_externo' && !v.institucion) {
      ctx.addIssue({ code: 'custom', path: ['institucion'], message: 'Escribe a quién se pidió apoyo' });
    }
    if (v.tipo === 'otro' && !v.texto) {
      ctx.addIssue({ code: 'custom', path: ['texto'], message: 'Escribe qué se hizo' });
    }
  });
export type EmergenciaRespuestaInput = z.infer<typeof emergenciaRespuestaSchema>;

/** La frase que queda en la bitácora y en el aviso: ya trae la institución y el número si los hay. */
export function textoRespuestaC2(v: EmergenciaRespuestaInput): string {
  switch (v.tipo) {
    case 'apoyo_externo':
      return `Pedimos apoyo externo: ${v.institucion}${v.telefono ? ` · ${v.telefono}` : ''}`;
    case 'otro':
      return v.texto ?? '';
    default:
      return RESPUESTA_C2_SOS_LABEL[v.tipo];
  }
}

/** Una cosa que se hizo sobre una emergencia activa (lo que ve quien la consulta, con la hora). */
export interface RespuestaSos {
  id: number;
  texto: string;
  por: string | null;
  en: string;
}

export interface Emergencia {
  id: number;
  estado: EstadoEmergencia;
  /** Quien la lanzó. */
  usuario: { id: number; nombre: string; rol: string; telefono: string | null; telefonoEtiqueta: EtiquetaTelefono | null };
  /** Se le avisó a quien consulta (A-65): solo entonces le salta la alerta a pantalla completa. */
  paraMi?: boolean;
  /** Solo en la alerta propia del guardia: a quién llamar (su supervisor del sitio). */
  supervisor?: ContactoTelefono | null;
  /**
   * A quién llamar, con todos sus números (A-61): quien la lanzó y el supervisor del sitio; el C2 ve también a los
   * admin. No incluye a quien consulta. Solo viene en las listas de quien la recibe.
   */
  contactos?: ContactoEmergencia[];
  /** Lo que ya se hizo: quién la atiende y lo que registró el C2, con la hora (A-81). */
  respuestas?: RespuestaSos[];
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
