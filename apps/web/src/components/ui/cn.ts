import { clsx, type ClassValue } from 'clsx';

/** Une clases condicionales. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
