import { describe, expect, it } from 'vitest';
import {
  CLAVES_OPCIONALES,
  MODULOS,
  MODULOS_NUCLEO,
  alApagar,
  alEncender,
  contraste,
  dependenciasDe,
  dependientesDe,
  empresaCreateSchema,
  empresaMarcaSchema,
  empresaModulosSchema,
  empresaUpdateSchema,
  esColorHex,
  estadoDesde,
  estadoTodoApagado,
  estadoTodoEncendido,
  generarPaleta,
  problemasDeModulos,
} from '@platinum/shared';

describe('catálogo de módulos', () => {
  it('tiene claves únicas y dependencias que existen', () => {
    const claves = MODULOS.map((m) => m.clave);
    expect(new Set(claves).size).toBe(claves.length);
    for (const m of MODULOS) for (const d of m.dependeDe) expect(claves).toContain(d);
  });

  it('el núcleo no depende de nada ni se puede apagar', () => {
    expect(MODULOS_NUCLEO.length).toBe(5);
    for (const m of MODULOS_NUCLEO) expect(m.dependeDe).toEqual([]);
    for (const m of MODULOS_NUCLEO) expect(CLAVES_OPCIONALES as string[]).not.toContain(m.clave);
  });

  it('no hay ciclos de dependencias', () => {
    for (const m of MODULOS) expect(dependenciasDe(m.clave)).not.toContain(m.clave);
  });

  it('horas extra y cambios de turno necesitan cobertura', () => {
    expect(dependenciasDe('horas_extra')).toEqual(['cobertura']);
    expect(dependientesDe('cobertura').sort()).toEqual(['cambios_turno', 'horas_extra']);
  });

  it('encender pide lo que falta y apagar lo bloquean quienes lo usan', () => {
    const apagado = estadoTodoApagado();
    expect(alEncender(apagado, 'horas_extra')).toEqual(['cobertura']);
    expect(alEncender(estadoDesde(['cobertura']), 'horas_extra')).toEqual([]);

    const todo = estadoTodoEncendido();
    expect(alApagar(todo, 'cobertura').sort()).toEqual(['cambios_turno', 'horas_extra']);
    expect(alApagar({ ...todo, horas_extra: false, cambios_turno: false }, 'cobertura')).toEqual([]);
  });

  it('detecta un estado inválido', () => {
    expect(problemasDeModulos(estadoTodoEncendido())).toEqual([]);
    expect(problemasDeModulos(estadoDesde(['horas_extra']))).toEqual([{ modulo: 'horas_extra', requiere: ['cobertura'] }]);
  });
});

describe('paleta de la empresa', () => {
  it('el principal queda como brand-700 si ya se lee con texto blanco', () => {
    const p = generarPaleta('#0B3263');
    expect(p.brand['700']).toBe('#0b3263');
    expect(p.ajustado).toBe(false);
    expect(p.contraste).toBeGreaterThanOrEqual(4.5);
  });

  it('un color claro se oscurece lo necesario para cumplir el contraste', () => {
    const p = generarPaleta('#ffd000');
    expect(p.ajustado).toBe(true);
    expect(contraste(p.brand['700'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('el menú (900 y 950) siempre es oscuro y la escala va de claro a oscuro', () => {
    for (const color of ['#0b3263', '#ffd000', '#00aa55', '#ff3366']) {
      const p = generarPaleta(color);
      expect(contraste(p.brand['900'], '#ffffff')).toBeGreaterThan(10);
      expect(contraste(p.brand['950'], '#ffffff')).toBeGreaterThan(contraste(p.brand['900'], '#ffffff'));
      expect(contraste(p.brand['50'], '#ffffff')).toBeLessThan(contraste(p.brand['700'], '#ffffff'));
    }
  });

  it('el acento elegido se respeta tal cual', () => {
    expect(generarPaleta('#0b3263', '#00CCFC').acento['400']).toBe('#00ccfc');
  });

  it('valida colores hexadecimales', () => {
    expect(esColorHex('#0b3263')).toBe(true);
    expect(esColorHex('0b3263')).toBe(false);
    expect(esColorHex('#fff')).toBe(false);
  });
});

describe('esquemas de empresa', () => {
  it('pide solo nombre y zona horaria', () => {
    const r = empresaCreateSchema.safeParse({ nombre: 'Acme', zonaHoraria: 'America/Mexico_City' });
    expect(r.success).toBe(true);
    expect(empresaCreateSchema.safeParse({ nombre: 'A', zonaHoraria: 'America/Mexico_City' }).success).toBe(false);
    expect(empresaCreateSchema.safeParse({ nombre: 'Acme' }).success).toBe(false);
    expect(empresaCreateSchema.safeParse({ nombre: 'Acme', zonaHoraria: 'Marte/Olimpo' }).success).toBe(false);
  });

  it('limpia los textos vacíos y valida RFC, correo y moneda', () => {
    const r = empresaCreateSchema.parse({
      nombre: 'Acme',
      zonaHoraria: 'America/Cancun',
      telefono: '   ',
      rfc: 'abc010203xy1',
      email: 'Info@Acme.MX',
      moneda: 'mxn',
    });
    expect(r.telefono).toBeNull();
    expect(r.rfc).toBe('ABC010203XY1');
    expect(r.email).toBe('info@acme.mx');
    expect(r.moneda).toBe('MXN');
    expect(empresaCreateSchema.safeParse({ nombre: 'Acme', zonaHoraria: 'America/Cancun', rfc: '123' }).success).toBe(false);
    expect(empresaCreateSchema.safeParse({ nombre: 'Acme', zonaHoraria: 'America/Cancun', moneda: 'PESOS' }).success).toBe(false);
  });

  it('la edición parcial no aplica valores por defecto', () => {
    expect(empresaUpdateSchema.parse({ nombre: 'Nuevo nombre' })).toEqual({ nombre: 'Nuevo nombre' });
  });

  it('la marca acepta colores hex o null y rechaza otra cosa', () => {
    expect(empresaMarcaSchema.parse({ colorPrincipal: '#0B3263', colorAcento: null })).toEqual({
      colorModo: 'personalizado',
      colorPrincipal: '#0b3263',
      colorAcento: null,
    });
    expect(empresaMarcaSchema.safeParse({ colorPrincipal: 'azul' }).success).toBe(false);
  });

  it('deduce el modo de color: sin colores es por defecto, y el modo por defecto borra los colores', () => {
    expect(empresaMarcaSchema.parse({})).toEqual({ colorModo: 'defecto', colorPrincipal: null, colorAcento: null });
    expect(empresaMarcaSchema.parse({ colorModo: 'defecto', colorPrincipal: '#ff0000' })).toEqual({
      colorModo: 'defecto',
      colorPrincipal: null,
      colorAcento: null,
    });
    expect(empresaMarcaSchema.parse({ colorModo: 'logo', colorPrincipal: '#ff0000' }).colorModo).toBe('logo');
    expect(empresaMarcaSchema.safeParse({ colorModo: 'personalizado' }).success).toBe(false);
  });

  it('solo deja cambiar módulos opcionales', () => {
    expect(empresaModulosSchema.safeParse({ modulos: { ausencias: true } }).success).toBe(true);
    expect(empresaModulosSchema.safeParse({ modulos: { biometria: false } }).success).toBe(false);
    expect(empresaModulosSchema.safeParse({ modulos: { inventado: true } }).success).toBe(false);
  });
});
