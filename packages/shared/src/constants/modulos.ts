/**
 * Catálogo de módulos de producto (C-06/C-07, ver docs/MODULOS.md). Es la fuente única: la API valida con él
 * qué puede encender una empresa y la web lo usa para armar la pantalla. No vive en la base para que no se desalinee.
 *
 * - `nucleo`: siempre encendido, no se puede apagar.
 * - `general` y `seguridad`: opcionales; cada empresa los enciende o apaga.
 * - `dependeDe`: solo las dependencias fuertes confirmadas en C-06. Las demás se revisan al cablear los
 *   módulos (C-09); no se declaran aquí para no imponer reglas que todavía no existen.
 */
export const GRUPOS_MODULO = ['nucleo', 'general', 'seguridad'] as const;
export type GrupoModulo = (typeof GRUPOS_MODULO)[number];

export const GRUPO_MODULO_LABEL: Record<GrupoModulo, string> = {
  nucleo: 'Siempre incluidos',
  general: 'Generales',
  seguridad: 'De seguridad privada',
};

export interface ModuloDef {
  readonly clave: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly grupo: GrupoModulo;
  readonly dependeDe: readonly string[];
  /** Aclaración que se muestra junto al módulo. */
  readonly nota?: string;
}

export const MODULOS = [
  // Núcleo
  {
    clave: 'plataforma',
    nombre: 'Plataforma y acceso',
    descripcion: 'Entrar al sistema, usuarios, roles y registro de quién hizo qué.',
    grupo: 'nucleo',
    dependeDe: [],
  },
  {
    clave: 'avisos',
    nombre: 'Avisos y campanita',
    descripcion: 'Avisos dentro del sistema y notificaciones al celular.',
    grupo: 'nucleo',
    dependeDe: [],
  },
  {
    clave: 'biometria',
    nombre: 'Biometría y marcación',
    descripcion: 'Registro del rostro, checador con rostro e incidencias de rostro.',
    grupo: 'nucleo',
    dependeDe: [],
  },
  {
    clave: 'estructura',
    nombre: 'Estructura mínima',
    descripcion: 'Lugares de trabajo y a quién se asigna cada uno.',
    grupo: 'nucleo',
    dependeDe: [],
  },
  {
    clave: 'administracion',
    nombre: 'Administración',
    descripcion: 'Borrado definitivo acotado de usuarios, sitios y clientes.',
    grupo: 'nucleo',
    dependeDe: [],
  },
  // Generales
  {
    clave: 'turnos',
    nombre: 'Turnos y horarios',
    descripcion: 'Plantillas de turno, asignación de horarios y horario en PDF.',
    grupo: 'general',
    dependeDe: [],
  },
  {
    clave: 'ausencias',
    nombre: 'Ausencias',
    descripcion: 'Vacaciones, incapacidades y permisos que no cuentan como falta.',
    grupo: 'general',
    dependeDe: [],
  },
  {
    clave: 'horas_extra',
    nombre: 'Horas extra',
    descripcion: 'Solicitud, aprobación y reporte de horas extra.',
    grupo: 'general',
    dependeDe: ['cobertura'],
  },
  {
    clave: 'cambios_turno',
    nombre: 'Cambios de turno',
    descripcion: 'Intercambio de turnos entre personas con aprobación.',
    grupo: 'general',
    dependeDe: ['cobertura'],
  },
  {
    clave: 'reporte_asistencia',
    nombre: 'Reporte de asistencia',
    descripcion: 'Reporte oficial en PDF y Excel con folio y código QR.',
    grupo: 'general',
    dependeDe: [],
  },
  {
    clave: 'grupos',
    nombre: 'Grupos (equipos)',
    descripcion: 'Agrupar personas para asignarles horarios o lugares juntos.',
    grupo: 'general',
    dependeDe: [],
  },
  {
    clave: 'bitacora',
    nombre: 'Bitácora',
    descripcion: 'Diario de la jornada de cada persona, con eventos y comentarios.',
    grupo: 'general',
    dependeDe: [],
  },
  {
    clave: 'emergencias',
    nombre: 'Emergencias (SOS)',
    descripcion: 'Botón para pedir ayuda: avisa a jefes y contactos de emergencia.',
    grupo: 'general',
    dependeDe: [],
  },
  // De seguridad privada
  {
    clave: 'clientes',
    nombre: 'Clientes y portal del cliente',
    descripcion: 'Empresas clientes con sus sitios y su acceso para ver la asistencia.',
    grupo: 'seguridad',
    dependeDe: [],
    nota: 'Hoy los lugares de trabajo dependen de un cliente; apagarlo tendrá efecto cuando se separen (C-10).',
  },
  {
    clave: 'reportes',
    nombre: 'Reportes de incidentes',
    descripcion: 'Reportes con fotos y seguimiento, con sus categorías.',
    grupo: 'seguridad',
    dependeDe: [],
  },
  {
    clave: 'quejas',
    nombre: 'Quejas del cliente',
    descripcion: 'Quejas del cliente sobre el servicio o sobre una persona.',
    grupo: 'seguridad',
    dependeDe: [],
  },
  {
    clave: 'cobertura',
    nombre: 'Cobertura de relevos',
    descripcion: 'Buscar quién cubra un puesto cuando alguien no llega.',
    grupo: 'seguridad',
    dependeDe: [],
  },
] as const satisfies readonly ModuloDef[];

export type ModuloClave = (typeof MODULOS)[number]['clave'];
export type ModuloOpcionalClave = Extract<(typeof MODULOS)[number], { grupo: 'general' | 'seguridad' }>['clave'];

/** Estado de los módulos opcionales de una empresa: clave → encendido. */
export type EstadoModulos = Record<ModuloOpcionalClave, boolean>;

export const MODULOS_NUCLEO: readonly ModuloDef[] = MODULOS.filter((m) => m.grupo === 'nucleo');
export const MODULOS_OPCIONALES: readonly ModuloDef[] = MODULOS.filter((m) => m.grupo !== 'nucleo');
export const CLAVES_OPCIONALES = MODULOS_OPCIONALES.map((m) => m.clave) as ModuloOpcionalClave[];

/**
 * Módulos opcionales con los que arranca Comunicalo, la empresa 1 (DC-015): Bitácora y SOS por decisión del usuario, y
 * Turnos y horarios y Reporte de asistencia como primeros agregados. Una empresa nueva arranca sin ninguno.
 */
export const MODULOS_INICIALES_COMUNICALO: readonly ModuloOpcionalClave[] = ['bitacora', 'emergencias', 'turnos', 'reporte_asistencia'];

export const moduloDe = (clave: string): ModuloDef | undefined => MODULOS.find((m) => m.clave === clave);
export const esModuloOpcional = (clave: string): clave is ModuloOpcionalClave => CLAVES_OPCIONALES.some((c) => c === clave);

/** Todo lo que `clave` necesita, directa o indirectamente (sin incluirse). */
export function dependenciasDe(clave: string): string[] {
  const vistos = new Set<string>();
  const pendientes = [...(moduloDe(clave)?.dependeDe ?? [])];
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    pendientes.push(...(moduloDe(actual)?.dependeDe ?? []));
  }
  return [...vistos];
}

/** Todo lo que necesita a `clave`, directa o indirectamente (sin incluirse). */
export function dependientesDe(clave: string): string[] {
  return MODULOS.filter((m) => m.clave !== clave && dependenciasDe(m.clave).includes(clave)).map((m) => m.clave);
}

/** Estado con todos los módulos opcionales apagados salvo los de `encendidos`. */
export function estadoDesde(encendidos: Iterable<string>): EstadoModulos {
  const on = new Set(encendidos);
  return Object.fromEntries(CLAVES_OPCIONALES.map((c) => [c, on.has(c)])) as EstadoModulos;
}

export const estadoTodoEncendido = (): EstadoModulos => estadoDesde(CLAVES_OPCIONALES);
export const estadoTodoApagado = (): EstadoModulos => estadoDesde([]);

export interface ProblemaModulo {
  modulo: string;
  /** Dependencias apagadas que necesita. */
  requiere: string[];
}

/** Módulos encendidos a los que les falta algo que necesitan. Vacío = el estado es válido. */
export function problemasDeModulos(estado: Partial<Record<string, boolean>>): ProblemaModulo[] {
  return CLAVES_OPCIONALES.filter((c) => estado[c]).flatMap((c) => {
    const faltan = dependenciasDe(c).filter((d) => esModuloOpcional(d) && !estado[d]);
    return faltan.length ? [{ modulo: c, requiere: faltan }] : [];
  });
}

/** Qué más hay que encender para poder encender `clave` (lo que necesita y aún está apagado). */
export function alEncender(estado: Partial<Record<string, boolean>>, clave: string): string[] {
  return dependenciasDe(clave).filter((d) => esModuloOpcional(d) && !estado[d]);
}

/** Qué módulos encendidos impiden apagar `clave` (los que la necesitan). Vacío = se puede apagar. */
export function alApagar(estado: Partial<Record<string, boolean>>, clave: string): string[] {
  return dependientesDe(clave).filter((d) => estado[d]);
}
