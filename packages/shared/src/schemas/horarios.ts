import { z } from 'zod';
import { fechaSchema } from './comunes';
import { sumarDiasFecha } from './turnos';

/** Horario en PDF (A-55): máximo de días por descarga. */
export const DIAS_MAX_HORARIO = 62;

const dias = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;

/**
 * Descargar el horario de guardias en PDF (A-55): rango de fechas y, opcionalmente, qué guardias
 * (ids separados por coma) o qué sitio. Sin guardias ni sitio, todos los de su alcance.
 */
export const horarioPdfQuerySchema = z
  .object({
    desde: fechaSchema,
    hasta: fechaSchema,
    guardias: z
      .string()
      .regex(/^\d+(,\d+){0,99}$/, 'Guardias inválidos')
      .optional(),
    sitioId: z.coerce.number().int().positive().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.hasta < v.desde) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser antes de la inicial' });
    } else if (dias(v.desde, v.hasta) > DIAS_MAX_HORARIO) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: `Máximo ${DIAS_MAX_HORARIO} días por horario` });
    }
  });
export type HorarioPdfQuery = z.infer<typeof horarioPdfQuerySchema>;

/** Atajos de rango (lunes a domingo): esta semana, la próxima y este mes. `hoy` es `AAAA-MM-DD`. */
export function atajosHorario(hoy: string): Record<'estaSemana' | 'proximaSemana' | 'esteMes', [string, string]> {
  const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0 = domingo
  const lunes = sumarDiasFecha(hoy, -((dia + 6) % 7));
  const [a, m] = hoy.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    estaSemana: [lunes, sumarDiasFecha(lunes, 6)],
    proximaSemana: [sumarDiasFecha(lunes, 7), sumarDiasFecha(lunes, 13)],
    esteMes: [`${a}-${p(m)}-01`, `${a}-${p(m)}-${p(ultimo)}`],
  };
}
