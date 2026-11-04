import { z } from 'zod';
import { CLAVES_OPCIONALES, problemasDeModulos, type EstadoModulos } from '../constants/modulos';
import { esColorHex } from '../lib/paleta';

/** Zonas horarias de México y algunas cercanas, para el selector. La API acepta cualquier zona válida. */
export const ZONAS_HORARIAS = [
  { valor: 'America/Mexico_City', etiqueta: 'Centro de México (Ciudad de México)' },
  { valor: 'America/Cancun', etiqueta: 'Sureste (Quintana Roo)' },
  { valor: 'America/Merida', etiqueta: 'Centro (Yucatán)' },
  { valor: 'America/Monterrey', etiqueta: 'Centro (Monterrey)' },
  { valor: 'America/Chihuahua', etiqueta: 'Chihuahua' },
  { valor: 'America/Mazatlan', etiqueta: 'Pacífico (Sinaloa, Nayarit, BCS)' },
  { valor: 'America/Hermosillo', etiqueta: 'Sonora' },
  { valor: 'America/Tijuana', etiqueta: 'Noroeste (Baja California)' },
] as const;

export const ZONA_HORARIA_DEFECTO = 'America/Mexico_City';
export const MONEDA_DEFECTO = 'MXN';

const zonaValida = (zona: string) => {
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
};

/** Texto opcional: vacío o solo espacios se guarda como null. */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullish();

const colorHex = z
  .string()
  .trim()
  .refine(esColorHex, 'Color inválido (usa el formato #RRGGBB)')
  .transform((v) => v.toLowerCase());

/** Datos de la empresa. Sin defaults: el esquema de edición se deriva con `.partial()` (ver CLAUDE.md). */
const empresaBaseSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre de la empresa').max(120),
  razonSocial: textoOpcional(160),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v || null)
    .pipe(z.string().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, 'RFC inválido').nullable())
    .nullish(),
  calle: textoOpcional(160),
  calle2: textoOpcional(160),
  codigoPostal: textoOpcional(10),
  ciudad: textoOpcional(80),
  estado: textoOpcional(80),
  pais: textoOpcional(80),
  telefono: textoOpcional(30),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => v || null)
    .pipe(z.email('Correo inválido').max(160).nullable())
    .nullish(),
  sitioWeb: textoOpcional(200),
  zonaHoraria: z.string().trim().refine(zonaValida, 'Zona horaria inválida'),
  moneda: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Usa el código de 3 letras (por ejemplo, MXN)')
    .optional(),
});

export const empresaCreateSchema = empresaBaseSchema;
export type EmpresaCreate = z.infer<typeof empresaCreateSchema>;

export const empresaUpdateSchema = empresaBaseSchema.partial();
export type EmpresaUpdate = z.infer<typeof empresaUpdateSchema>;

/**
 * De dónde vienen los colores de la empresa (C-14): la paleta de Gestión Comunicalo, el ícono que subió, o los
 * que eligió a mano. Lo personalizado no se pisa al subir otro ícono.
 */
export const COLOR_MODOS = ['defecto', 'logo', 'personalizado'] as const;
export type ColorModo = (typeof COLOR_MODOS)[number];

/**
 * Colores de la empresa. En modo `defecto` no se guardan colores. Sin `colorModo` se deduce: con color es
 * `personalizado` y sin color es `defecto`.
 */
export const empresaMarcaSchema = z
  .object({
    colorModo: z.enum(COLOR_MODOS).optional(),
    colorPrincipal: colorHex.nullish(),
    colorAcento: colorHex.nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.colorModo && v.colorModo !== 'defecto' && !v.colorPrincipal) {
      ctx.addIssue({ code: 'custom', path: ['colorPrincipal'], message: 'Elige el color principal' });
    }
  })
  .transform((v) => {
    const modo: ColorModo = v.colorModo ?? (v.colorPrincipal || v.colorAcento ? 'personalizado' : 'defecto');
    return modo === 'defecto'
      ? { colorModo: modo, colorPrincipal: null, colorAcento: null }
      : { colorModo: modo, colorPrincipal: v.colorPrincipal ?? null, colorAcento: v.colorAcento ?? null };
  });
export type EmpresaMarca = z.infer<typeof empresaMarcaSchema>;

/** Estado deseado de los módulos opcionales (solo los que se quieren cambiar). */
export const empresaModulosSchema = z
  .object({ modulos: z.record(z.string(), z.boolean()) })
  .superRefine(({ modulos }, ctx) => {
    for (const clave of Object.keys(modulos)) {
      if (!(CLAVES_OPCIONALES as string[]).includes(clave)) {
        ctx.addIssue({ code: 'custom', path: ['modulos', clave], message: 'Módulo inválido o que no se puede apagar' });
      }
    }
  });
export type EmpresaModulosInput = z.infer<typeof empresaModulosSchema>;

export const empresaAdminCreateSchema = z.object({
  nombre: z.string().trim().min(3, 'Escribe el nombre completo').max(120),
  email: z.string().trim().toLowerCase().pipe(z.email('Correo inválido').max(160)),
  telefono: textoOpcional(30),
});
export type EmpresaAdminCreate = z.infer<typeof empresaAdminCreateSchema>;

export const empresaFiltroSchema = z.object({
  q: z.string().trim().max(100).optional(),
  estado: z.enum(['activas', 'inactivas', 'todas']).default('activas'),
});
export type EmpresaFiltro = z.infer<typeof empresaFiltroSchema>;

/** Empresa tal como la expone la API (fechas en ISO). */
export interface Empresa {
  id: number;
  nombre: string;
  razonSocial: string | null;
  rfc: string | null;
  calle: string | null;
  calle2: string | null;
  codigoPostal: string | null;
  ciudad: string | null;
  estado: string | null;
  pais: string | null;
  telefono: string | null;
  email: string | null;
  sitioWeb: string | null;
  zonaHoraria: string;
  moneda: string;
  colorModo: ColorModo;
  colorPrincipal: string | null;
  colorAcento: string | null;
  /** URL firmada del ícono; null = se usan las iniciales. */
  logoUrl: string | null;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmpresaResumen {
  id: number;
  nombre: string;
  activa: boolean;
  /** La empresa a la que pertenece quien consulta (★). */
  esMiEmpresa: boolean;
  modulosActivos: number;
  modulosOpcionales: number;
  administradores: number;
}

export interface EmpresaAdministrador {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  /** Su cuenta no se puede reiniciar ni dar de baja desde aquí (A-65). */
  esSuperAdmin: boolean;
  ultimoAcceso: string | null;
}

/** Texto de cada problema de un estado de módulos, para devolver al usuario. */
export function mensajesProblemasModulos(estado: Partial<EstadoModulos> & Record<string, boolean | undefined>): string[] {
  return problemasDeModulos(estado).map((p) => `"${p.modulo}" necesita: ${p.requiere.join(', ')}`);
}
