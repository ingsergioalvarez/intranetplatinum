import { z } from 'zod';

// ---------- Aviso de privacidad por el uso del rostro (A-68) ----------

/** El guardia acepta el aviso: debe mandar la versión que leyó (si cambió mientras tanto, se rechaza). */
export const aceptarAvisoSchema = z.object({
  version: z.string().trim().min(1, 'Falta la versión del aviso').max(40),
});
export type AceptarAvisoInput = z.input<typeof aceptarAvisoSchema>;
export type AceptarAvisoData = z.output<typeof aceptarAvisoSchema>;

/** Cómo está el guardia con el aviso. */
export interface EstadoAvisoPrivacidad {
  /** Versión del texto que se pide hoy. */
  versionVigente: string;
  /** Aceptó alguna versión alguna vez. Sin esto no puede checar. */
  aceptada: boolean;
  /** Aceptó la versión vigente. Si no, se le muestra la ventana (y si nunca aceptó, no puede checar). */
  vigente: boolean;
  versionAceptada: string | null;
  aceptadaEn: string | null;
}

export type FiltroAvisoPrivacidad = 'todos' | 'pendientes';

export interface GuardiaAvisoPrivacidad {
  id: number;
  nombre: string;
  /** Aceptó alguna versión. */
  aceptada: boolean;
  /** Aceptó la versión vigente. */
  vigente: boolean;
  versionAceptada: string | null;
  aceptadaEn: string | null;
}

export interface AvisoPrivacidadLista {
  versionVigente: string;
  items: GuardiaAvisoPrivacidad[];
  /** Guardias que nunca han aceptado (no pueden checar). */
  sinAceptar: number;
  /** Guardias que no han aceptado la versión vigente (incluye los que nunca aceptaron). */
  pendientes: number;
}
