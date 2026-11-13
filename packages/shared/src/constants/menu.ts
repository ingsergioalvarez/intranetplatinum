import { ROLES, type Rol } from './roles';

/**
 * Menú de cada rol (A-83). `barra` va en la barra de abajo del celular (hasta 4; si el rol tiene 5 o menos opciones, van
 * todas) y lo demás, en "Más", ordenado de más a menos frecuente y con títulos. La barra de escritorio sigue el mismo
 * orden. Las rutas son las de `navItems`; lo que el rol no puede ver se omite solo y una opción nueva que no esté aquí
 * va al final de "Más".
 */
export interface MenuRol {
  barra: readonly string[];
  mas: readonly { titulo: string; rutas: readonly string[] }[];
}

export const MENU_POR_ROL: Record<Rol, MenuRol> = {
  [ROLES.ADMIN]: {
    barra: ['/', '/asistencia', '/reportes', '/clientes'],
    mas: [
      { titulo: 'Seguimiento', rutas: ['/c2', '/reportes-cliente'] },
      { titulo: 'Operación', rutas: ['/grupos', '/catalogos/turnos'] },
      { titulo: 'Administración', rutas: ['/usuarios', '/carteras', '/correo', '/catalogos/categorias'] },
      { titulo: 'Consulta', rutas: ['/privacidad'] },
    ],
  },
  [ROLES.SUPERVISOR]: {
    barra: ['/', '/asistencia', '/reportes', '/reportes-cliente'],
    mas: [
      { titulo: 'Operación', rutas: ['/clientes', '/grupos', '/catalogos/turnos'] },
      { titulo: 'Administración', rutas: ['/usuarios', '/catalogos/categorias'] },
      { titulo: 'Consulta', rutas: ['/bitacora-c2', '/privacidad'] },
    ],
  },
  [ROLES.GUARDIA]: { barra: ['/marcar', '/mis-sitios', '/mis-ausencias', '/reportes'], mas: [] },
  [ROLES.CLIENTE]: { barra: ['/', '/guardias', '/reportes', '/reportes-cliente', '/asistencia'], mas: [] },
  [ROLES.C2]: { barra: ['/c2', '/reportes'], mas: [] },
};
