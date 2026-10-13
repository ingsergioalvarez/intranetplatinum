import {
  Armchair,
  Building2,
  Cctv,
  CircleHelp,
  Flame,
  House,
  KeyRound,
  Lightbulb,
  Plug,
  ShieldAlert,
  Trash2,
  Droplets,
  Car,
  type LucideIcon,
} from 'lucide-react';

/** Íconos disponibles para categorías (clave guardada en BD → componente). */
export const ICONOS_CATEGORIA: Record<string, { icono: LucideIcon; label: string }> = {
  lightbulb: { icono: Lightbulb, label: 'Foco' },
  cctv: { icono: Cctv, label: 'Cámara' },
  house: { icono: House, label: 'Caseta' },
  armchair: { icono: Armchair, label: 'Mobiliario' },
  'building-2': { icono: Building2, label: 'Edificio' },
  'shield-alert': { icono: ShieldAlert, label: 'Seguridad' },
  'key-round': { icono: KeyRound, label: 'Accesos' },
  plug: { icono: Plug, label: 'Eléctrico' },
  droplets: { icono: Droplets, label: 'Agua' },
  flame: { icono: Flame, label: 'Fuego / gas' },
  car: { icono: Car, label: 'Estacionamiento' },
  'trash-2': { icono: Trash2, label: 'Limpieza' },
  'circle-help': { icono: CircleHelp, label: 'Otro' },
};

/** "Iluminación › Lámpara fundida". */
export const nombreCategoria = (c: { nombre: string; padre: string | null }) =>
  c.padre ? `${c.padre} › ${c.nombre}` : c.nombre;
