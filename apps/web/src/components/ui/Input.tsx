import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

const fieldBase =
  'block w-full rounded-lg border bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:bg-slate-100 disabled:text-slate-500';

const stateClass = (invalid?: boolean) =>
  invalid ? 'border-red-500 focus:border-red-500' : 'border-slate-300 focus:border-brand-500';

interface InvalidProp {
  invalid?: boolean;
}

// text-base (16px) evita que iOS haga zoom al enfocar el campo.
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & InvalidProp>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(fieldBase, 'h-11', stateClass(invalid), className)}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & InvalidProp
>(function Textarea({ className, invalid, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(fieldBase, 'py-2.5', stateClass(invalid), className)}
      {...rest}
    />
  );
});

export interface SelectOption {
  value: string | number;
  label: string;
}

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & InvalidProp & { options: SelectOption[]; placeholder?: string }
>(function Select({ className, invalid, options, placeholder, ...rest }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(fieldBase, 'h-11 pr-8', stateClass(invalid), className)}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});
