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
  /** Ver a toda la empresa sin importar el área (C-10). Se da a personas concretas; la pantalla para darlo llega con C-11. */
  ALCANCE_EMPRESA: 'alcance.empresa',
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
  'alcance.empresa': 'Ver a todas las personas de la empresa, sin importar su área',
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
  // Jefe (C-10): lo operativo, igual que el supervisor, más marcar su propia asistencia. Crear, editar y dar de baja usuarios,
  // la auditoría y ver a toda la empresa quedan para el admin hasta C-11.
  [ROLES.JEFE]: [
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
    P.ASISTENCIA_MARCAR,
  ],
  [ROLES.GUARDIA]: [P.REPORTES_VER_PROPIOS, P.REPORTES_CREAR, P.REPORTES_SEGUIMIENTO, P.ASISTENCIA_MARCAR],
  [ROLES.CLIENTE]: [P.REPORTES_VER_PROPIOS, P.REPORTES_SEGUIMIENTO, P.ASISTENCIA_VER],
};

export const ROL_DESCRIPCIONES: Record<Rol, string> = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.JEFE]: 'Jefe',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.GUARDIA]: 'Colaborador',
  [ROLES.CLIENTE]: 'Cliente',
};
