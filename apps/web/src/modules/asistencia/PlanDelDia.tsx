import { Route } from 'lucide-react';
import { horaLegible, type PlanGuardia } from '@platinum/shared';
import { cuando, hora24 } from '../casos/formato';

/**
 * "Plan de hoy" (AS6-08): lo que dejó el supervisor cuando el guardia sigue en el sitio porque su
 * relevo no llegó. Así sabe desde el inicio hasta cuándo cubre y cuándo se presenta de nuevo.
 */
export function PlanDelDia({ plan }: { plan: PlanGuardia }) {
  const lineas: string[] = [];
  if (plan.decision === 'en_camino') {
    lineas.push('Tu relevo viene en camino. Quédate en tu puesto; si cambia el plan tu supervisor te avisa.');
  } else if (plan.decision === 'otro_cubre') {
    lineas.push('Va a llegar otro guardia a cubrir. Entrégale el puesto y marca tu salida.');
  } else {
    if (plan.cubreHasta) lineas.push(`Cubres este turno hasta las ${horaLegible(hora24(plan.cubreHasta))}`);
    if (plan.siguiente === 'normal') {
      lineas.push(
        plan.limiteExtra
          ? `Tu siguiente turno empieza ${cuando(plan.limiteExtra)} y lo trabajas normal: marca tu salida y luego tu entrada. Sin falta ni retardo.`
          : 'Tus horas extra terminan cuando marques tu salida.',
      );
    } else if (plan.siguiente === 'descansa') {
      lineas.push(plan.vuelveA ? `Después descansas. Te presentas ${cuando(plan.vuelveA)}.` : 'Después descansas.');
    }
  }
  return (
    <div className="flex gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900 ring-1 ring-brand-200 ring-inset">
      <Route className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">Plan de hoy</p>
        {lineas.map((l) => (
          <p key={l}>{l}</p>
        ))}
        {plan.nota && <p className="text-brand-800">Nota de tu supervisor: {plan.nota}</p>}
        {plan.decision === 'no_llegara' && (
          <p className="text-xs text-brand-800">Tus horas extra se aprueban con este plan.</p>
        )}
      </div>
    </div>
  );
}
