import { cn } from './cn';

interface SwitchProps {
  checked: boolean;
  onChange: (valor: boolean) => void;
  /** Nombre accesible: qué enciende o apaga. */
  label: string;
  disabled?: boolean;
  className?: string;
}

/** Interruptor encendido/apagado. */
export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-brand-700' : 'bg-slate-300',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  );
}
