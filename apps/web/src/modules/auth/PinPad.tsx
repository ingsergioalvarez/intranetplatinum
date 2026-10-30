import { useEffect } from 'react';
import { Delete } from 'lucide-react';
import { cn } from '../../components/ui';

const LARGO = 4;

/**
 * Teclado numérico para el PIN (A-40): 4 puntos y botones grandes para el pulgar. Al completar los
 * 4 dígitos avisa con `onCompleto`; también acepta el teclado físico.
 */
export function PinPad({
  valor,
  onChange,
  onCompleto,
  deshabilitado = false,
  error = false,
}: {
  valor: string;
  onChange: (pin: string) => void;
  onCompleto: (pin: string) => void;
  deshabilitado?: boolean;
  error?: boolean;
}) {
  const agregar = (d: string) => {
    if (deshabilitado || valor.length >= LARGO) return;
    const nuevo = valor + d;
    onChange(nuevo);
    if (nuevo.length === LARGO) onCompleto(nuevo);
  };
  const borrar = () => !deshabilitado && onChange(valor.slice(0, -1));

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (deshabilitado) return;
      if (/^\d$/.test(e.key)) {
        if (valor.length >= LARGO) return;
        const nuevo = valor + e.key;
        onChange(nuevo);
        if (nuevo.length === LARGO) onCompleto(nuevo);
      } else if (e.key === 'Backspace') onChange(valor.slice(0, -1));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [valor, deshabilitado, onChange, onCompleto]);

  return (
    <div className="mx-auto w-full max-w-[16rem]">
      <div
        className={cn('mb-6 flex justify-center gap-4', error && 'animate-pulse')}
        role="img"
        aria-label={`${valor.length} de ${LARGO} dígitos`}
      >
        {Array.from({ length: LARGO }, (_, i) => (
          <span
            key={i}
            className={cn(
              'size-4 rounded-full border-2 transition-colors',
              error
                ? 'border-red-500 bg-red-500'
                : i < valor.length
                  ? 'border-brand-700 bg-brand-700'
                  : 'border-slate-300 bg-transparent',
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Tecla key={d} onClick={() => agregar(d)} disabled={deshabilitado}>
            {d}
          </Tecla>
        ))}
        <span />
        <Tecla onClick={() => agregar('0')} disabled={deshabilitado}>
          0
        </Tecla>
        <Tecla onClick={borrar} disabled={deshabilitado || valor.length === 0} etiqueta="Borrar">
          <Delete className="mx-auto size-6" />
        </Tecla>
      </div>
    </div>
  );
}

function Tecla({
  children,
  onClick,
  disabled,
  etiqueta,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  etiqueta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      className="h-16 rounded-2xl bg-slate-100 text-2xl font-semibold text-slate-900 transition-colors active:bg-slate-200 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
