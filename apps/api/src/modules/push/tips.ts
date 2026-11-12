/**
 * Cuándo toca mandar un tip (A-78): dos por semana, martes y viernes desde las 10:30 (hora del negocio). Si el servidor
 * estaba apagado a esa hora, se manda al volver, hasta antes de la 1 de la tarde.
 */
export interface TurnoDeTip {
  /** `AAAA-MM-DD` del envío: es la llave que impide repetirlo. */
  slot: string;
  /** Cuántos envíos van desde el 5 de enero de 2026: elige el tip de cada celular. */
  indice: number;
}

const DIAS_DE_ENVIO = ['Tue', 'Fri'];
const DESDE_MIN = 10 * 60 + 30;
const HASTA_MIN = 13 * 60;
const LUNES_BASE = Date.UTC(2026, 0, 5);
const MS_DIA = 86_400_000;

export function turnoDeTip(ahora: Date, timeZone: string): TurnoDeTip | null {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(ahora)
      .map((p) => [p.type, p.value]),
  );
  if (!DIAS_DE_ENVIO.includes(partes.weekday)) return null;
  const minutos = Number(partes.hour) * 60 + Number(partes.minute);
  if (minutos < DESDE_MIN || minutos >= HASTA_MIN) return null;
  const dia = Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day));
  const semanas = Math.floor((dia - LUNES_BASE) / (7 * MS_DIA));
  return {
    slot: `${partes.year}-${partes.month}-${partes.day}`,
    indice: semanas * 2 + (partes.weekday === 'Fri' ? 1 : 0),
  };
}
