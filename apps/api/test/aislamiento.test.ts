import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MODELOS_CON_EMPRESA,
  MODELOS_SIN_EMPRESA,
  prepararArgs,
  type ContextoAislamiento,
} from '../src/core/empresa/aislamiento';

const empresa = (empresaId: number): ContextoAislamiento => ({ global: false, empresaId });
const global: ContextoAislamiento = { global: true, empresaId: null };
const sinContexto: ContextoAislamiento = { global: false, empresaId: null };

describe('el vigilante: toda tabla decide si lleva empresa', () => {
  const esquema = readFileSync(path.resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
  const bloques = [...esquema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map((m) => ({ nombre: m[1]!, cuerpo: m[2]! }));
  const conCampo = bloques.filter((b) => /^\s+empresaId\s+Int/m.test(b.cuerpo)).map((b) => b.nombre);

  it('el esquema tiene las tablas que se esperan', () => {
    expect(bloques.length).toBe(MODELOS_CON_EMPRESA.size + Object.keys(MODELOS_SIN_EMPRESA).length);
  });

  it('cada tabla está en una lista o en la otra, y en ninguna de las dos a la vez', () => {
    for (const { nombre } of bloques) {
      const con = MODELOS_CON_EMPRESA.has(nombre);
      const sin = nombre in MODELOS_SIN_EMPRESA;
      expect(con || sin, `${nombre}: falta decidir si lleva empresa (agregarla a MODELOS_CON_EMPRESA o a MODELOS_SIN_EMPRESA)`).toBe(true);
      expect(con && sin, `${nombre} está en las dos listas`).toBe(false);
    }
  });

  it('toda tabla de MODELOS_CON_EMPRESA tiene de verdad la columna empresa_id', () => {
    for (const nombre of MODELOS_CON_EMPRESA) {
      expect(conCampo, `${nombre} está en la lista pero su modelo no tiene empresaId`).toContain(nombre);
    }
  });

  it('ninguna tabla tiene empresaId sin estar protegida (salvo empresa_modulos, que es de la plataforma)', () => {
    for (const nombre of conCampo) {
      if (nombre === 'EmpresaModulo') continue;
      expect(MODELOS_CON_EMPRESA.has(nombre), `${nombre} tiene empresaId pero no está protegida`).toBe(true);
    }
  });

  it('todas llevan índice por empresa (consultas rápidas) y llave a empresas', () => {
    for (const nombre of MODELOS_CON_EMPRESA) {
      const cuerpo = bloques.find((b) => b.nombre === nombre)!.cuerpo;
      expect(cuerpo, `${nombre}: falta @@index([empresaId])`).toMatch(/@@index\(\[empresaId\]\)/);
      expect(cuerpo, `${nombre}: falta la relación con Empresa`).toMatch(/Empresa\??\s+@relation\(fields: \[empresaId\]/);
    }
  });
});

describe('prepararArgs: lecturas', () => {
  it('agrega la empresa a toda lectura, aunque no traiga condiciones', () => {
    for (const op of ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']) {
      expect(prepararArgs('Cliente', op, undefined, empresa(3))).toEqual({ where: { empresaId: 3 } });
    }
  });

  it('suma la empresa a las condiciones existentes sin perderlas', () => {
    expect(prepararArgs('Cliente', 'findMany', { where: { deletedAt: null, OR: [{ a: 1 }] }, take: 5 }, empresa(3))).toEqual({
      where: { deletedAt: null, OR: [{ a: 1 }], empresaId: 3 },
      take: 5,
    });
  });

  it('la empresa de la sesión manda sobre una que venga en la consulta (no se puede pedir otra)', () => {
    expect(prepararArgs('Cliente', 'findMany', { where: { empresaId: 99 } }, empresa(3))).toEqual({ where: { empresaId: 3 } });
  });

  it('buscar por llave única también se limita a la empresa', () => {
    expect(prepararArgs('Usuario', 'findUnique', { where: { id: 7 } }, empresa(2))).toEqual({ where: { id: 7, empresaId: 2 } });
    expect(prepararArgs('Ausencia', 'findUnique', { where: { usuarioId_fecha: { usuarioId: 1, fecha: 'x' } } }, empresa(2))).toEqual({
      where: { usuarioId_fecha: { usuarioId: 1, fecha: 'x' }, empresaId: 2 },
    });
  });

  it('no modifica los argumentos originales', () => {
    const original = { where: { id: 1 } };
    prepararArgs('Cliente', 'findMany', original, empresa(3));
    expect(original).toEqual({ where: { id: 1 } });
  });
});

describe('prepararArgs: modificaciones', () => {
  it('actualizar y borrar solo alcanzan registros de la empresa', () => {
    for (const op of ['update', 'updateMany', 'delete', 'deleteMany']) {
      expect(prepararArgs('Sitio', op, { where: { id: 4 }, data: { nombre: 'x' } }, empresa(5))).toMatchObject({
        where: { id: 4, empresaId: 5 },
      });
    }
  });

  it('nadie puede mover un registro a otra empresa', () => {
    expect(() => prepararArgs('Sitio', 'update', { where: { id: 4 }, data: { empresaId: 6 } }, empresa(5))).toThrowError(/otra empresa/);
    expect(() => prepararArgs('Sitio', 'updateMany', { where: {}, data: { empresa: { connect: { id: 6 } } } }, empresa(5))).toThrowError(
      /otra empresa/,
    );
    expect(() => prepararArgs('Sitio', 'upsert', { where: { id: 1 }, create: { empresaId: 5 }, update: { empresaId: 6 } }, empresa(5))).toThrowError(
      /otra empresa/,
    );
  });

  it('actualizar sin tocar la empresa es válido (también con empresaId indefinido)', () => {
    expect(() => prepararArgs('Sitio', 'update', { where: { id: 4 }, data: { nombre: 'x', empresaId: undefined } }, empresa(5))).not.toThrow();
  });
});

describe('prepararArgs: altas', () => {
  it('acepta un alta con la empresa de la sesión, por llave o conectando la empresa', () => {
    expect(() => prepararArgs('Cliente', 'create', { data: { empresaId: 3, nombre: 'x' } }, empresa(3))).not.toThrow();
    expect(() => prepararArgs('Cliente', 'create', { data: { empresa: { connect: { id: 3 } } } }, empresa(3))).not.toThrow();
  });

  it('rechaza un alta con otra empresa, o sin empresa', () => {
    expect(() => prepararArgs('Cliente', 'create', { data: { empresaId: 4 } }, empresa(3))).toThrowError(/otra empresa/);
    expect(() => prepararArgs('Cliente', 'create', { data: { empresa: { connect: { id: 4 } } } }, empresa(3))).toThrowError(/otra empresa/);
    expect(() => prepararArgs('Cliente', 'create', { data: { nombre: 'x' } }, empresa(3))).toThrowError(/otra empresa/);
  });

  it('en altas múltiples revisa cada registro', () => {
    expect(() => prepararArgs('Aviso', 'createMany', { data: [{ empresaId: 3 }, { empresaId: 3 }] }, empresa(3))).not.toThrow();
    expect(() => prepararArgs('Aviso', 'createMany', { data: [{ empresaId: 3 }, { empresaId: 9 }] }, empresa(3))).toThrowError(/otra empresa/);
    expect(() => prepararArgs('Aviso', 'createMany', { data: { empresaId: 9 } }, empresa(3))).toThrowError(/otra empresa/);
  });

  it('un upsert se limita a la empresa al buscar y deja pasar lo que crea si trae la empresa correcta', () => {
    expect(prepararArgs('SuscripcionPush', 'upsert', { where: { id: 1 }, create: { empresaId: 3, x: 1 }, update: {} }, empresa(3))).toEqual({
      where: { id: 1, empresaId: 3 },
      create: { empresaId: 3, x: 1 },
      update: {},
    });
  });

  it('un upsert sobre una tabla con empresa exige la empresa al crear', () => {
    expect(() => prepararArgs('SuscripcionPush', 'upsert', { where: { id: 1 }, create: { endpointHash: 'a' }, update: {} }, empresa(3))).toThrowError(
      /otra empresa/,
    );
    expect(() => prepararArgs('SuscripcionPush', 'upsert', { where: { id: 1 }, create: { empresaId: 3 }, update: {} }, empresa(3))).not.toThrow();
  });

  it('la auditoría admite eventos sin empresa (plataforma o anónimos)', () => {
    expect(() => prepararArgs('Auditoria', 'create', { data: { empresaId: null, accion: 'x' } }, empresa(3))).not.toThrow();
    expect(() => prepararArgs('Cliente', 'create', { data: { empresaId: null } }, empresa(3))).toThrowError(/otra empresa/);
  });
});

describe('prepararArgs: contexto', () => {
  it('sin empresa en el contexto se niega: nunca asume una (falla cerrada)', () => {
    expect(() => prepararArgs('Cliente', 'findMany', {}, sinContexto)).toThrowError(/Vuelve a iniciar sesión/);
    expect(() => prepararArgs('Cliente', 'create', { data: { empresaId: 1 } }, sinContexto)).toThrowError(/Vuelve a iniciar sesión/);
  });

  it('en una operación declarada global (plataforma, login) no filtra ni valida', () => {
    const args = { where: { email: 'a@a.mx' } };
    expect(prepararArgs('Usuario', 'findUnique', args, global)).toBe(args);
    expect(() => prepararArgs('Usuario', 'create', { data: { empresaId: 99 } }, global)).not.toThrow();
  });

  it('las tablas sin empresa (roles, permisos, tokens, empresas) no se tocan', () => {
    for (const modelo of Object.keys(MODELOS_SIN_EMPRESA)) {
      const args = { where: { id: 1 } };
      expect(prepararArgs(modelo, 'findMany', args, empresa(3))).toBe(args);
      expect(prepararArgs(modelo, 'findMany', args, sinContexto)).toBe(args);
    }
  });
});
