import { ROLES, type Rol } from './roles';

/**
 * Catálogo de permisos (C-11, DC-019). Clave = `<modulo>.<accion>`.
 *
 * Los permisos del catálogo editable (`CATALOGO_PERMISOS`) son los que el admin verá agrupados en la pantalla de Roles y
 * permisos. Los "heredados" (clientes y catálogos) siguen existiendo porque las rutas de hoy los piden; no se muestran
 * ahí y se reemplazan o se borran con las sedes (C-12 y C-13).
 */
export const PERMISOS = {
  // Personas
  USUARIOS_VER: 'usuarios.ver',
  USUARIOS_CREAR: 'usuarios.crear',
  USUARIOS_EDITAR: 'usuarios.editar',
  USUARIOS_BAJA: 'usuarios.baja',
  // Áreas
  AREAS_VER: 'areas.ver',
  AREAS_ADMINISTRAR: 'areas.administrar',
  // Asistencia
  ASISTENCIA_MARCAR: 'asistencia.marcar',
  ASISTENCIA_VER: 'asistencia.ver',
  ASISTENCIA_ROSTROS: 'asistencia.rostros',
  /** Decidir retardos, mandar a casa, confirmar faltas, justificar y cerrar jornadas. */
  ASISTENCIA_DECIDIR: 'asistencia.decidir',
  /** Lo delicado: revertir una decisión ya tomada y borrar rostros. Por defecto, solo el admin. */
  ASISTENCIA_ADMINISTRAR: 'asistencia.administrar',
  // Ausencias
  AUSENCIAS_PEDIR: 'ausencias.pedir',
  AUSENCIAS_RESOLVER: 'ausencias.resolver',
  // Horas extra
  HORAS_EXTRA_SOLICITAR: 'horas_extra.solicitar',
  HORAS_EXTRA_RESOLVER: 'horas_extra.resolver',
  // Cambios de turno
  CAMBIOS_PEDIR: 'cambios.pedir',
  CAMBIOS_RESOLVER: 'cambios.resolver',
  // Turnos y horarios
  TURNOS_ADMINISTRAR: 'turnos.administrar',
  HORARIOS_VER: 'horarios.ver',
  HORARIOS_EDITAR: 'horarios.editar',
  // Bitácora
  BITACORA_VER: 'bitacora.ver',
  BITACORA_ANOTAR: 'bitacora.anotar',
  // Reporte de asistencia
  INFORMES_VER: 'informes.ver',
  // Emergencias
  EMERGENCIAS_LANZAR: 'emergencias.lanzar',
  /** RH: recibe las emergencias de toda la empresa (C-10 paso 5, DC-017). Se da a personas concretas. */
  EMERGENCIAS_RECIBIR: 'emergencias.recibir',
  EMERGENCIAS_ATENDER: 'emergencias.atender',
  // Grupos
  GRUPOS_ADMINISTRAR: 'grupos.administrar',
  // Auditoría
  AUDITORIA_VER: 'auditoria.ver',
  // Alcance
  /** Ver a toda la empresa sin importar el área (C-10). Se da a personas concretas. */
  ALCANCE_EMPRESA: 'alcance.empresa',
  // Roles
  ROLES_ADMINISTRAR: 'roles.administrar',
  // Cobertura (se rehace sobre personas y turnos con el calendario, C-13)
  COBERTURA_PEDIR: 'cobertura.pedir',
  COBERTURA_ASIGNAR: 'cobertura.asignar',
  COBERTURA_VER: 'cobertura.ver',

  // ----- Heredados de Platinum: no están en la pantalla de roles; se van con las sedes -----
  CLIENTES_VER: 'clientes.ver',
  CLIENTES_CREAR: 'clientes.crear',
  CLIENTES_EDITAR: 'clientes.editar',
  CLIENTES_BAJA: 'clientes.baja',
  CATALOGOS_ADMINISTRAR: 'catalogos.administrar',
} as const;

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS];

const P = PERMISOS;

/** Grupos de la pantalla de Roles y permisos, en el orden en que se muestran. */
export const GRUPOS_PERMISOS = [
  { clave: 'personas', nombre: 'Personas' },
  { clave: 'areas', nombre: 'Áreas' },
  { clave: 'asistencia', nombre: 'Asistencia' },
  { clave: 'ausencias', nombre: 'Ausencias' },
  { clave: 'horas_extra', nombre: 'Horas extra' },
  { clave: 'cambios', nombre: 'Cambios de turno' },
  { clave: 'turnos', nombre: 'Turnos y horarios' },
  { clave: 'bitacora', nombre: 'Bitácora' },
  { clave: 'informes', nombre: 'Reporte de asistencia' },
  { clave: 'emergencias', nombre: 'Emergencias' },
  { clave: 'cobertura', nombre: 'Cobertura' },
  { clave: 'otros', nombre: 'Grupos, auditoría y roles' },
] as const;
export type GrupoPermiso = (typeof GRUPOS_PERMISOS)[number]['clave'];

export interface PermisoDeCatalogo {
  clave: Permiso;
  descripcion: string;
  grupo: GrupoPermiso;
}

/** Los permisos que el admin puede dar o quitar a cada rol (los heredados no entran). */
export const CATALOGO_PERMISOS: readonly PermisoDeCatalogo[] = [
  { clave: P.USUARIOS_VER, descripcion: 'Ver usuarios', grupo: 'personas' },
  { clave: P.USUARIOS_CREAR, descripcion: 'Crear usuarios', grupo: 'personas' },
  { clave: P.USUARIOS_EDITAR, descripcion: 'Editar usuarios y asignar roles', grupo: 'personas' },
  { clave: P.USUARIOS_BAJA, descripcion: 'Dar de baja o reactivar usuarios', grupo: 'personas' },
  { clave: P.AREAS_VER, descripcion: 'Ver las áreas y sus personas', grupo: 'areas' },
  { clave: P.AREAS_ADMINISTRAR, descripcion: 'Crear y editar áreas, y designar jefes y supervisores', grupo: 'areas' },
  { clave: P.ASISTENCIA_MARCAR, descripcion: 'Marcar su propia entrada, comida y salida', grupo: 'asistencia' },
  { clave: P.ASISTENCIA_VER, descripcion: 'Ver la asistencia de las personas de su alcance', grupo: 'asistencia' },
  { clave: P.ASISTENCIA_ROSTROS, descripcion: 'Registrar y revisar los rostros', grupo: 'asistencia' },
  { clave: P.ASISTENCIA_DECIDIR, descripcion: 'Decidir retardos, confirmar faltas, justificar y cerrar jornadas', grupo: 'asistencia' },
  { clave: P.ASISTENCIA_ADMINISTRAR, descripcion: 'Revertir decisiones ya tomadas, borrar rostros y quitar asignaciones que ya empezaron', grupo: 'asistencia' },
  { clave: P.AUSENCIAS_PEDIR, descripcion: 'Pedir una ausencia', grupo: 'ausencias' },
  { clave: P.AUSENCIAS_RESOLVER, descripcion: 'Aprobar o rechazar ausencias', grupo: 'ausencias' },
  { clave: P.HORAS_EXTRA_SOLICITAR, descripcion: 'Solicitar horas extra', grupo: 'horas_extra' },
  { clave: P.HORAS_EXTRA_RESOLVER, descripcion: 'Aprobar, rechazar o capturar horas extra', grupo: 'horas_extra' },
  { clave: P.CAMBIOS_PEDIR, descripcion: 'Pedir un cambio de turno', grupo: 'cambios' },
  { clave: P.CAMBIOS_RESOLVER, descripcion: 'Aprobar o rechazar cambios de turno', grupo: 'cambios' },
  { clave: P.TURNOS_ADMINISTRAR, descripcion: 'Administrar el catálogo de turnos', grupo: 'turnos' },
  { clave: P.HORARIOS_VER, descripcion: 'Ver los horarios', grupo: 'turnos' },
  { clave: P.HORARIOS_EDITAR, descripcion: 'Asignar y cambiar horarios', grupo: 'turnos' },
  { clave: P.BITACORA_VER, descripcion: 'Ver la bitácora (la propia, o la de su alcance)', grupo: 'bitacora' },
  { clave: P.BITACORA_ANOTAR, descripcion: 'Anotar y justificar en la bitácora', grupo: 'bitacora' },
  { clave: P.INFORMES_VER, descripcion: 'Ver y emitir el reporte de asistencia', grupo: 'informes' },
  { clave: P.EMERGENCIAS_LANZAR, descripcion: 'Lanzar una emergencia (SOS)', grupo: 'emergencias' },
  { clave: P.EMERGENCIAS_RECIBIR, descripcion: 'Recibe las emergencias de toda la empresa (RH)', grupo: 'emergencias' },
  { clave: P.EMERGENCIAS_ATENDER, descripcion: 'Atender y cerrar emergencias', grupo: 'emergencias' },
  { clave: P.COBERTURA_PEDIR, descripcion: 'Pedir cubrir a alguien', grupo: 'cobertura' },
  { clave: P.COBERTURA_ASIGNAR, descripcion: 'Asignar quién cubre', grupo: 'cobertura' },
  { clave: P.COBERTURA_VER, descripcion: 'Ver la cobertura', grupo: 'cobertura' },
  { clave: P.GRUPOS_ADMINISTRAR, descripcion: 'Administrar grupos de personas', grupo: 'otros' },
  { clave: P.AUDITORIA_VER, descripcion: 'Ver la auditoría', grupo: 'otros' },
  { clave: P.ALCANCE_EMPRESA, descripcion: 'Ver a todas las personas de la empresa, sin importar su área', grupo: 'otros' },
  { clave: P.ROLES_ADMINISTRAR, descripcion: 'Administrar roles y dar permisos a personas', grupo: 'otros' },
];

const DESCRIPCIONES_HEREDADAS: Record<string, string> = {
  [P.CLIENTES_VER]: 'Ver clientes',
  [P.CLIENTES_CREAR]: 'Crear clientes',
  [P.CLIENTES_EDITAR]: 'Editar clientes y sitios',
  [P.CLIENTES_BAJA]: 'Dar de baja clientes',
  [P.CATALOGOS_ADMINISTRAR]: 'Administrar catálogos (turnos)',
};

export const PERMISO_DESCRIPCIONES = {
  ...Object.fromEntries(CATALOGO_PERMISOS.map((p) => [p.clave, p.descripcion])),
  ...DESCRIPCIONES_HEREDADAS,
} as Record<Permiso, string>;

/** Lo operativo que hoy hacen el jefe y el supervisor (el supervisor, además, no marca su propia asistencia). */
const MANDO: Permiso[] = [
  P.USUARIOS_VER,
  P.ASISTENCIA_VER,
  P.ASISTENCIA_ROSTROS,
  P.ASISTENCIA_DECIDIR,
  P.AUSENCIAS_PEDIR,
  P.AUSENCIAS_RESOLVER,
  P.HORAS_EXTRA_RESOLVER,
  P.CAMBIOS_PEDIR,
  P.CAMBIOS_RESOLVER,
  P.TURNOS_ADMINISTRAR,
  P.HORARIOS_VER,
  P.HORARIOS_EDITAR,
  P.BITACORA_VER,
  P.BITACORA_ANOTAR,
  P.INFORMES_VER,
  P.EMERGENCIAS_LANZAR,
  P.EMERGENCIAS_ATENDER,
  P.COBERTURA_PEDIR,
  P.COBERTURA_ASIGNAR,
  P.COBERTURA_VER,
  P.GRUPOS_ADMINISTRAR,
  // Heredados: las rutas de turnos, sitios y clientes todavía los piden.
  P.CLIENTES_VER,
  P.CLIENTES_CREAR,
  P.CLIENTES_EDITAR,
  P.CLIENTES_BAJA,
  P.CATALOGOS_ADMINISTRAR,
];

/**
 * Permisos de cada rol de partida (DC-019). El admin tiene todos y siempre incluye "Roles". Supervisor y Jefe son
 * iguales (el jefe, además, marca su propia asistencia) y se recortan desde la pantalla de roles. El colaborador
 * tiene lo que necesita por lógica mientras se define su pantalla.
 */
export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  [ROLES.ADMIN]: Object.values(PERMISOS),
  [ROLES.SUPERVISOR]: [...MANDO],
  [ROLES.JEFE]: [...MANDO, P.ASISTENCIA_MARCAR],
  [ROLES.COLABORADOR]: [
    P.ASISTENCIA_MARCAR,
    P.AUSENCIAS_PEDIR,
    P.CAMBIOS_PEDIR,
    P.COBERTURA_PEDIR,
    P.EMERGENCIAS_LANZAR,
    P.BITACORA_VER,
    P.HORAS_EXTRA_SOLICITAR,
  ],
};

export const ROL_DESCRIPCIONES: Record<Rol, string> = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.JEFE]: 'Jefe',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.COLABORADOR]: 'Colaborador',
};
