import { Phone } from 'lucide-react';
import type { ContactoEmergencia } from '@platinum/shared';
import { cn } from '../../components/ui';

const CARGO: Record<ContactoEmergencia['cargo'], string> = { guardia: 'Guardia', supervisor: 'Supervisor', admin: 'Administrador' };

/**
 * A quién llamar por una emergencia (A-61): cada persona con TODOS sus números (el personal y el de la empresa), uno
 * por botón, para que quien la recibe elija a cuál marcar.
 */
export function Llamadas({ contactos, className }: { contactos: ContactoEmergencia[] | undefined; className?: string }) {
  if (!contactos?.length) return null;
  return (
    <ul className={cn('grid grid-cols-1 gap-2', className)} aria-label="A quién llamar">
      {contactos.map((c) => (
        <li key={`${c.cargo}:${c.nombre}`} className="rounded-lg bg-white/70 p-2 ring-1 ring-slate-200 ring-inset">
          <p className="text-xs font-semibold text-slate-600">
            {CARGO[c.cargo]} · <span className="text-slate-900">{c.nombre}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {c.telefonos.map((t) => (
              <a
                key={t.numero}
                href={`tel:${t.numero}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-medium text-slate-800 hover:bg-slate-200"
                aria-label={`Llamar a ${c.nombre} (${t.etiqueta === 'personal' ? 'personal' : 'empresa'}) al ${t.numero}`}
              >
                <Phone className="size-4" aria-hidden /> {t.numero}
                <span className="text-xs font-normal text-slate-500">{t.etiqueta === 'personal' ? 'personal' : 'empresa'}</span>
              </a>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
