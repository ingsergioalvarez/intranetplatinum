/* eslint-disable @typescript-eslint/no-explicit-any -- recorre la estructura interna del router de Express */
import { describe, expect, it } from 'vitest';
import { PERMISOS, PERMISOS_POR_ROL, ROLES, type Rol } from '@platinum/shared';
import { modules } from '../src/modules';

/**
 * C-11 parte 2: las rutas deciden por permiso, no por el nombre del rol. Esta prueba recorre las rutas reales de cada
 * módulo (el middleware se etiqueta con lo que pide) y comprueba dos cosas:
 *  1. Ninguna ruta decide por el nombre del rol, salvo las de administración de la plataforma (solo admin).
 *  2. Cada permiso que se pide lo tienen, entre los roles que no son admin, exactamente los roles que podían entrar a
 *     esa ruta antes de C-11 (las diferencias acordadas están marcadas).
 */

type Guardia = { roles?: Rol[]; permisos?: string[] };
interface RutaInfo {
  modulo: string;
  ruta: string;
  guardias: Guardia[];
}

function rutasDe(modulo: string, router: { stack: any[] }): RutaInfo[] {
  const usados: Guardia[] = [];
  const rutas: RutaInfo[] = [];
  for (const capa of router.stack) {
    if (capa.route) {
      const propias = (capa.route.stack as any[]).map((l) => l.handle as Guardia).filter((h) => h.roles || h.permisos);
      for (const metodo of Object.keys(capa.route.methods)) {
        rutas.push({ modulo, ruta: `${metodo.toUpperCase()} ${capa.route.path}`, guardias: [...usados, ...propias] });
      }
    } else if (typeof capa.handle === 'function') {
      const g = capa.handle as Guardia;
      if (g.roles || g.permisos) usados.push(g);
    }
  }
  return rutas;
}

const todasLasRutas = modules.flatMap((m) => rutasDe(m.name, m.router as unknown as { stack: any[] }));

const sinAdmin = (permiso: string): Rol[] =>
  (Object.values(ROLES) as Rol[]).filter((r) => r !== ROLES.ADMIN && (PERMISOS_POR_ROL[r] as string[]).includes(permiso));

const P = PERMISOS;
const MANDO: Rol[] = [ROLES.JEFE, ROLES.SUPERVISOR];
const TODOS: Rol[] = [ROLES.JEFE, ROLES.SUPERVISOR, ROLES.COLABORADOR];

/** módulo → permiso → roles (sin contar al admin, que tiene todo) que podían entrar a esas rutas antes de C-11. */
const ANTES: [string, string, Rol[], string?][] = [
  ['areas', P.AREAS_VER, []],
  ['areas', P.AREAS_ADMINISTRAR, []],
  ['asistencia', P.ASISTENCIA_VER, MANDO],
  ['asistencia', P.ASISTENCIA_DECIDIR, MANDO],
  ['asistencia', P.ASISTENCIA_ADMINISTRAR, []],
  ['asistencia', P.ASISTENCIA_ROSTROS, MANDO],
  ['ausencias', P.AUSENCIAS_PEDIR, TODOS],
  // Acordado: antes solo el admin resolvía; ahora también el jefe y el supervisor (los avisos de ausencias les llegan).
  ['ausencias', P.AUSENCIAS_RESOLVER, MANDO, 'acordado: antes solo el admin'],
  ['bitacora', P.BITACORA_VER, MANDO],
  ['bitacora', P.BITACORA_ANOTAR, MANDO],
  ['bitacora', P.ASISTENCIA_ADMINISTRAR, []],
  ['cambios-turno', P.CAMBIOS_PEDIR, TODOS],
  ['cambios-turno', P.CAMBIOS_RESOLVER, MANDO],
  // "No puedo quedarme" era solo del colaborador; ahora la pide quien tenga el permiso (jefe y supervisor también).
  ['casos-cobertura', P.COBERTURA_PEDIR, TODOS, 'ampliado: antes solo el colaborador'],
  ['casos-cobertura', P.COBERTURA_ASIGNAR, MANDO],
  ['cobertura', P.COBERTURA_VER, MANDO],
  ['coberturas', P.COBERTURA_ASIGNAR, MANDO],
  ['solicitudes-cobertura', P.COBERTURA_ASIGNAR, MANDO],
  ['emergencias', P.EMERGENCIAS_LANZAR, TODOS],
  ['emergencias', P.EMERGENCIAS_ATENDER, MANDO],
  ['horarios', P.HORARIOS_VER, MANDO],
  ['horas-extra', P.HORAS_EXTRA_SOLICITAR, [ROLES.COLABORADOR]],
  ['horas-extra', P.HORAS_EXTRA_RESOLVER, MANDO],
  ['informes', P.INFORMES_VER, MANDO],
  ['sitios', P.HORARIOS_EDITAR, MANDO],
  ['sitios', P.HORARIOS_VER, MANDO],
  ['turnos', P.TURNOS_ADMINISTRAR, MANDO],
];

describe('rutas por permiso (C-11 parte 2)', () => {
  it('se encontraron las rutas de los módulos', () => {
    expect(todasLasRutas.length).toBeGreaterThan(100);
  });

  it('ninguna ruta decide por el nombre del rol, salvo la administración de la plataforma (solo admin)', () => {
    const porRol = todasLasRutas.filter((r) => r.guardias.some((g) => g.roles));
    for (const r of porRol) {
      expect(['admin', 'auth'], `${r.modulo} ${r.ruta} todavía decide por rol`).toContain(r.modulo);
      for (const g of r.guardias.filter((x) => x.roles)) expect(g.roles, `${r.modulo} ${r.ruta}`).toEqual([ROLES.ADMIN]);
    }
  });

  for (const [modulo, permiso, roles, nota] of ANTES) {
    it(`${modulo}: pide ${permiso}${nota ? ` (${nota})` : ''} y lo tienen los mismos roles que podían entrar`, () => {
      const rutas = todasLasRutas.filter((r) => r.modulo === modulo);
      expect(rutas.some((r) => r.guardias.some((g) => g.permisos?.includes(permiso))), `ninguna ruta de ${modulo} pide ${permiso}`).toBe(true);
      expect(new Set(sinAdmin(permiso))).toEqual(new Set(roles));
    });
  }
});
