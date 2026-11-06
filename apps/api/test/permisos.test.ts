import { describe, expect, it } from 'vitest';
import {
  CATALOGO_PERMISOS,
  GRUPOS_PERMISOS,
  PERMISOS,
  PERMISOS_POR_ROL,
  PERMISO_DESCRIPCIONES,
  ROLES,
  type Permiso,
} from '@platinum/shared';

const todos = Object.values(PERMISOS) as Permiso[];
const P = PERMISOS;

/** Lo que cada rol podía hacer antes de C-11 (Parte 1). Ningún rol debe perder nada de esto. */
const ANTES = {
  [ROLES.SUPERVISOR]: [
    P.USUARIOS_VER, P.CLIENTES_VER, P.CLIENTES_CREAR, P.CLIENTES_EDITAR, P.CLIENTES_BAJA,
    P.CATALOGOS_ADMINISTRAR, P.GRUPOS_ADMINISTRAR, P.ASISTENCIA_VER, P.ASISTENCIA_ROSTROS,
  ],
  [ROLES.JEFE]: [
    P.USUARIOS_VER, P.CLIENTES_VER, P.CLIENTES_CREAR, P.CLIENTES_EDITAR, P.CLIENTES_BAJA,
    P.CATALOGOS_ADMINISTRAR, P.GRUPOS_ADMINISTRAR, P.ASISTENCIA_VER, P.ASISTENCIA_ROSTROS, P.ASISTENCIA_MARCAR,
  ],
  [ROLES.GUARDIA]: [P.ASISTENCIA_MARCAR],
} as const;

describe('catálogo de permisos (C-11, DC-019)', () => {
  it('cada permiso del catálogo es único, tiene descripción y un grupo que existe', () => {
    const claves = CATALOGO_PERMISOS.map((p) => p.clave);
    expect(new Set(claves).size).toBe(claves.length);
    const grupos = new Set<string>(GRUPOS_PERMISOS.map((g) => g.clave));
    for (const p of CATALOGO_PERMISOS) {
      expect(p.descripcion.length).toBeGreaterThan(5);
      expect(grupos.has(p.grupo)).toBe(true);
    }
  });

  it('el catálogo editable tiene 33 permisos y los heredados de Platinum quedan fuera', () => {
    expect(CATALOGO_PERMISOS).toHaveLength(33);
    const claves = new Set<string>(CATALOGO_PERMISOS.map((p) => p.clave));
    for (const heredado of [P.CLIENTES_VER, P.CLIENTES_CREAR, P.CLIENTES_EDITAR, P.CLIENTES_BAJA, P.CATALOGOS_ADMINISTRAR]) {
      expect(claves.has(heredado)).toBe(false);
    }
    // Todo lo demás de PERMISOS sí está en el catálogo.
    expect(todos.length - 5).toBe(CATALOGO_PERMISOS.length);
  });

  it('todos los permisos tienen descripción y ningún grupo está vacío', () => {
    for (const p of todos) expect(PERMISO_DESCRIPCIONES[p]).toBeTruthy();
    for (const g of GRUPOS_PERMISOS) expect(CATALOGO_PERMISOS.some((p) => p.grupo === g.clave)).toBe(true);
  });
});

describe('permisos de cada rol de partida', () => {
  it('el admin tiene todos, incluido el de administrar roles', () => {
    expect(new Set(PERMISOS_POR_ROL[ROLES.ADMIN])).toEqual(new Set(todos));
    expect(PERMISOS_POR_ROL[ROLES.ADMIN]).toContain(P.ROLES_ADMINISTRAR);
  });

  it('ningún rol pierde nada de lo que podía hacer antes', () => {
    for (const [rol, antes] of Object.entries(ANTES)) {
      const ahora = new Set<Permiso>(PERMISOS_POR_ROL[rol as keyof typeof ANTES]);
      for (const p of antes) expect(ahora.has(p), `${rol} perdió ${p}`).toBe(true);
    }
  });

  it('el jefe es igual que el supervisor y además marca su propia asistencia', () => {
    const sup = new Set(PERMISOS_POR_ROL[ROLES.SUPERVISOR]);
    const jefe = new Set(PERMISOS_POR_ROL[ROLES.JEFE]);
    expect(sup.has(P.ASISTENCIA_MARCAR)).toBe(false);
    expect(jefe.has(P.ASISTENCIA_MARCAR)).toBe(true);
    jefe.delete(P.ASISTENCIA_MARCAR);
    expect(jefe).toEqual(sup);
  });

  it('el colaborador tiene lo que necesita por lógica y nada de mando', () => {
    expect(new Set(PERMISOS_POR_ROL[ROLES.GUARDIA])).toEqual(
      new Set([
        P.ASISTENCIA_MARCAR,
        P.AUSENCIAS_PEDIR,
        P.CAMBIOS_PEDIR,
        P.COBERTURA_PEDIR,
        P.EMERGENCIAS_LANZAR,
        P.BITACORA_VER,
        P.HORAS_EXTRA_SOLICITAR,
      ]),
    );
  });

  it('lo delicado es solo del admin por defecto', () => {
    const soloAdmin = [
      P.AREAS_VER,
      P.AREAS_ADMINISTRAR,
      P.ASISTENCIA_ADMINISTRAR,
      P.AUDITORIA_VER,
      P.ROLES_ADMINISTRAR,
      P.ALCANCE_EMPRESA,
      P.EMERGENCIAS_RECIBIR,
      P.USUARIOS_CREAR,
      P.USUARIOS_EDITAR,
      P.USUARIOS_BAJA,
    ];
    for (const rol of [ROLES.JEFE, ROLES.SUPERVISOR, ROLES.GUARDIA]) {
      for (const p of soloAdmin) expect(PERMISOS_POR_ROL[rol], `${rol} no debe tener ${p}`).not.toContain(p);
    }
  });

  it('cada permiso de cada rol existe en el catálogo', () => {
    const validos = new Set<string>(todos);
    for (const lista of Object.values(PERMISOS_POR_ROL)) for (const p of lista) expect(validos.has(p)).toBe(true);
  });
});
