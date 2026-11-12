import { ROLES, type Rol } from './roles';

/** Catálogo de permisos granulares. Clave = `<modulo>.<accion>`. */
export const PERMISOS = {
  USUARIOS_VER: 'usuarios.ver',
  USUARIOS_CREAR: 'usuarios.crear',
  USUARIOS_EDITAR: 'usuarios.editar',
  USUARIOS_BAJA: 'usuarios.baja',
  CLIENTES_VER: 'clientes.ver',
  CLIENTES_CREAR: 'clientes.crear',
  CLIENTES_EDITAR: 'clientes.editar',
  CLIENTES_BAJA: 'clientes.baja',
  REPORTES_VER_TODOS: 'reportes.ver_todos',
  REPORTES_VER_PROPIOS: 'reportes.ver_propios',
  REPORTES_CREAR: 'reportes.crear',
  REPORTES_SEGUIMIENTO: 'reportes.seguimiento',
  REPORTES_NOTIFICAR: 'reportes.notificar',
  REPORTES_ESTATUS: 'reportes.estatus',
  CATALOGOS_ADMINISTRAR: 'catalogos.administrar',
  GRUPOS_ADMINISTRAR: 'grupos.administrar',
  AUDITORIA_VER: 'auditoria.ver',
  ASISTENCIA_MARCAR: 'asistencia.marcar',
  ASISTENCIA_VER: 'asistencia.ver',
  ASISTENCIA_ROSTROS: 'asistencia.rostros',
  C2_VER: 'c2.ver',
  C2_ACTUAR: 'c2.actuar',
} as const;

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS];

export const PERMISO_DESCRIPCIONES: Record<Permiso, string> = {
  'usuarios.ver': 'Ver usuarios',
  'usuarios.crear': 'Crear usuarios',
  'usuarios.editar': 'Editar usuarios y asignar roles',
  'usuarios.baja': 'Dar de baja / reactivar usuarios',
  'clientes.ver': 'Ver clientes',
  'clientes.crear': 'Crear clientes',
  'clientes.editar': 'Editar clientes, contactos y sitios',
  'clientes.baja': 'Dar de baja clientes',
  'reportes.ver_todos': 'Ver todos los reportes',
  'reportes.ver_propios': 'Ver reportes de sus sitios / cliente',
  'reportes.crear': 'Crear reportes',
  'reportes.seguimiento': 'Agregar seguimiento a reportes',
  'reportes.notificar': 'Notificar reportes al cliente',
  'reportes.estatus': 'Cambiar el estatus de reportes',
  'catalogos.administrar': 'Administrar categorías y catálogos',
  'grupos.administrar': 'Administrar grupos de guardias',
  'auditoria.ver': 'Ver bitácora de auditoría',
  'asistencia.marcar': 'Marcar entrada, comida y salida',
  'asistencia.ver': 'Ver las marcas de asistencia de todos los guardias',
  'asistencia.rostros': 'Registrar el rostro de los guardias',
  'c2.ver': 'Ver la pantalla de monitoreo del C2',
  'c2.actuar': 'Anotar, avisar al supervisor y reportar desde la pantalla del C2',
};

const P = PERMISOS;

/** Permisos por rol (matriz del PLAN §5). El rol admin tiene todos. */
export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  [ROLES.ADMIN]: Object.values(PERMISOS),
  [ROLES.SUPERVISOR]: [
    P.USUARIOS_VER,
    P.CLIENTES_VER,
    P.CLIENTES_CREAR,
    P.CLIENTES_EDITAR,
    P.CLIENTES_BAJA,
    P.REPORTES_VER_TODOS,
    P.REPORTES_VER_PROPIOS,
    P.REPORTES_CREAR,
    P.REPORTES_SEGUIMIENTO,
    P.REPORTES_NOTIFICAR,
    P.REPORTES_ESTATUS,
    P.CATALOGOS_ADMINISTRAR,
    P.GRUPOS_ADMINISTRAR,
    P.ASISTENCIA_VER,
    P.ASISTENCIA_ROSTROS,
  ],
  [ROLES.GUARDIA]: [P.REPORTES_VER_PROPIOS, P.REPORTES_CREAR, P.REPORTES_SEGUIMIENTO, P.ASISTENCIA_MARCAR],
  [ROLES.CLIENTE]: [P.REPORTES_VER_PROPIOS, P.REPORTES_SEGUIMIENTO, P.ASISTENCIA_VER],
  // El C2 levanta reportes (internos: solo los ven supervisor y admin) y ve los que levantó (A-80).
  [ROLES.C2]: [P.C2_VER, P.C2_ACTUAR, P.REPORTES_VER_PROPIOS, P.REPORTES_CREAR, P.REPORTES_SEGUIMIENTO],
};

export const ROL_DESCRIPCIONES: Record<Rol, string> = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.GUARDIA]: 'Guardia',
  [ROLES.CLIENTE]: 'Cliente',
  [ROLES.C2]: 'Operador C2',
};
