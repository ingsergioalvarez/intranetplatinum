import { describe, expect, it } from 'vitest';
import { MENU_POR_ROL, PERMISOS_POR_ROL, ROLES, type Rol } from '@platinum/shared';
import { navItems, ordenarMenu, type NavItem } from '../../web/src/components/layout/navItems';

/** Lo que ve cada rol: la misma regla que usa el menú de la app (permiso, rol y super admin). */
const visibles = (rol: Rol): NavItem[] =>
  navItems.filter(
    (i) =>
      (!i.permiso || PERMISOS_POR_ROL[rol].includes(i.permiso)) &&
      (!i.roles || i.roles.includes(rol)) &&
      // El super admin es un admin con marca: se prueba como tal.
      (!i.superAdmin || rol === ROLES.ADMIN),
  );

const rutas = (items: NavItem[]) => items.map((i) => i.to);

describe('menú por rol (A-83)', () => {
  it('cada rol tiene su plan, sin rutas repetidas', () => {
    for (const rol of Object.values(ROLES)) {
      const plan = MENU_POR_ROL[rol];
      const todas = [...plan.barra, ...plan.mas.flatMap((g) => g.rutas)];
      expect(new Set(todas).size, `rutas repetidas en ${rol}`).toBe(todas.length);
      expect(plan.barra.length, `la barra de ${rol} es muy larga`).toBeLessThanOrEqual(5);
    }
  });

  it('ninguna opción del menú se queda sin lugar: lo que ve cada rol está en su plan', () => {
    for (const rol of Object.values(ROLES)) {
      const menu = ordenarMenu(rol, visibles(rol));
      // Un grupo sin título son opciones que el plan no menciona: hay que ubicarlas.
      expect(menu.grupos.filter((g) => g.titulo === '').flatMap((g) => rutas(g.items)), `sin lugar en ${rol}`).toEqual([]);
      expect(new Set(rutas(menu.todos))).toEqual(new Set(rutas(visibles(rol))));
    }
  });

  it('supervisor: lo de uso diario abajo y Bitácora C2 en "Más"', () => {
    const m = ordenarMenu(ROLES.SUPERVISOR, visibles(ROLES.SUPERVISOR));
    expect(m.barra.map((i) => i.label)).toEqual(['Inicio', 'Asistencia', 'Reportes', 'Quejas']);
    expect(m.grupos.map((g) => g.titulo)).toEqual(['Operación', 'Administración', 'Consulta']);
    expect(m.grupos[0].items.map((i) => i.label)).toEqual(['Clientes', 'Grupos', 'Turnos']);
    expect(m.grupos[2].items.map((i) => i.label)).toEqual(['Bitácora C2', 'Privacidad']);
  });

  it('admin: Inicio, Asistencia, Reportes y Clientes abajo; C2 y Quejas en "Seguimiento"', () => {
    const m = ordenarMenu(ROLES.ADMIN, visibles(ROLES.ADMIN));
    expect(m.barra.map((i) => i.label)).toEqual(['Inicio', 'Asistencia', 'Reportes', 'Clientes']);
    expect(m.grupos[0]).toMatchObject({ titulo: 'Seguimiento' });
    expect(m.grupos[0].items.map((i) => i.label)).toEqual(['C2', 'Quejas']);
    // El admin no ve la "Bitácora C2" del supervisor: la lee dentro de C2.
    expect(rutas(m.todos)).not.toContain('/bitacora-c2');
  });

  it('C2, guardia y cliente no tienen "Más": todo va en la barra', () => {
    expect(ordenarMenu(ROLES.C2, visibles(ROLES.C2)).barra.map((i) => i.label)).toEqual(['C2', 'Reportes']);
    expect(ordenarMenu(ROLES.GUARDIA, visibles(ROLES.GUARDIA)).barra.map((i) => i.label)).toEqual(['Checador', 'Mis sitios', 'Ausencias', 'Reportes']);
    for (const rol of [ROLES.C2, ROLES.GUARDIA, ROLES.CLIENTE]) {
      expect(ordenarMenu(rol, visibles(rol)).grupos, rol).toEqual([]);
    }
  });

  it('una opción nueva que el plan no menciona va al final, sin perderse', () => {
    const nueva: NavItem = { ...navItems[0], label: 'Nueva', to: '/nueva' };
    const m = ordenarMenu(ROLES.SUPERVISOR, [...visibles(ROLES.SUPERVISOR), nueva]);
    expect(m.todos.at(-1)).toBe(nueva);
    expect(m.grupos.at(-1)).toMatchObject({ titulo: '' });
  });
});
