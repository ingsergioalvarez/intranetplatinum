import { Check, X } from 'lucide-react';

/** Persona de perfil (mirando a la derecha) con el teléfono en la mano. */
function Persona({ bien }: { bien: boolean }) {
  const color = bien ? '#059669' : '#dc2626';
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-full" aria-hidden="true">
      {/* Cuerpo y cabeza */}
      <circle cx="40" cy="30" r="16" fill="#e2e8f0" stroke="#334155" strokeWidth="2.5" />
      <circle cx="49" cy="27" r="2" fill="#334155" />
      <path d="M40 46 L40 100 M24 120 L40 100 L56 120" stroke="#334155" strokeWidth="3" fill="none" />
      {bien ? (
        <>
          {/* Brazo extendido: teléfono frente a los ojos */}
          <path d="M40 56 L70 44 L86 32" stroke="#334155" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="86" y="16" width="9" height="22" rx="2" fill={color} />
          <path d="M51 27 L85 27" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
        </>
      ) : (
        <>
          {/* Brazo abajo: teléfono a la altura del pecho apuntando hacia arriba */}
          <path d="M40 56 L58 74 L72 76" stroke="#334155" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="72" y="70" width="9" height="22" rx="2" fill={color} transform="rotate(-55 76 81)" />
          <path d="M72 74 L50 33" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
        </>
      )}
    </svg>
  );
}

/**
 * Cómo sostener el teléfono (DA-44): frente a la cara, a la altura de los ojos; no abajo
 * apuntando hacia arriba.
 */
export function GuiaTelefono() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[true, false].map((bien) => (
        <figure
          key={String(bien)}
          className={
            bien
              ? 'rounded-xl bg-emerald-50 p-2 ring-1 ring-emerald-200 ring-inset'
              : 'rounded-xl bg-red-50 p-2 ring-1 ring-red-200 ring-inset'
          }
        >
          <Persona bien={bien} />
          <figcaption
            className={
              bien
                ? 'flex items-center justify-center gap-1 text-center text-sm font-semibold text-emerald-800'
                : 'flex items-center justify-center gap-1 text-center text-sm font-semibold text-red-800'
            }
          >
            {bien ? <Check className="size-4 shrink-0" /> : <X className="size-4 shrink-0" />}
            {bien ? 'A la altura de tus ojos' : 'Abajo, no'}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
