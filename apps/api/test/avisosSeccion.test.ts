import { describe, expect, it } from 'vitest';
import type { Aviso } from '@platinum/shared';
import { avisosDeLaSeccion, destinoDeAviso, ofreceVer, seccionDeAviso } from '../../web/src/components/layout/avisosSeccion';
import { grupoDe, horaRelativa } from '../../web/src/components/layout/tiempoAviso';

/** Menú de un supervisor (las rutas que cuentan para las burbujas). */
const RUTAS = ['/', '/asistencia', '/reportes', '/reportes-cliente', '/clientes', '/usuarios', '/bitacora-c2'];

let n = 0;
const aviso = (extra: Partial<Aviso> = {}): Aviso => ({
  id: ++n,
  tipo: 'asignacion',
  titulo: 'Aviso',
  mensaje: 'Algo pasó',
  reporteId: null,
  ruta: null,
  leido: false,
  createdAt: '2026-11-13T15:00:00.000Z',
  ...extra,
});

describe('a qué sección pertenece un aviso (A-57, A-85)', () => {
  it('los de un reporte van a Reportes; los demás, al botón más específico cuya ruta empieza la del aviso', () => {
    expect(seccionDeAviso(aviso({ reporteId: 4, tipo: 'reporte_nuevo' }), RUTAS)).toBe('/reportes');
    expect(seccionDeAviso(aviso({ ruta: '/asistencia/guardias/4?vista=bitacora' }), RUTAS)).toBe('/asistencia');
    expect(seccionDeAviso(aviso({ ruta: '/usuarios' }), RUTAS)).toBe('/usuarios');
    expect(seccionDeAviso(aviso({ ruta: '/reportes-cliente' }), RUTAS)).toBe('/reportes-cliente');
  });

  it('sin pantalla propia (sin ruta o solo el Inicio), solo cuentan en la campanita', () => {
    expect(seccionDeAviso(aviso({ ruta: null }), RUTAS)).toBeNull();
    expect(seccionDeAviso(aviso({ ruta: '/' }), RUTAS)).toBeNull();
    expect(seccionDeAviso(aviso({ ruta: '/algo-que-no-existe' }), RUTAS)).toBeNull();
  });
});

describe('qué avisos explican la burbuja de la sección (A-85)', () => {
  it('solo en la pantalla principal de la sección, y solo los sin leer, los más nuevos primero', () => {
    const viejo = aviso({ ruta: '/usuarios', createdAt: '2026-11-13T10:00:00.000Z', titulo: 'Viejo' });
    const nuevo = aviso({ ruta: '/usuarios', createdAt: '2026-11-13T16:00:00.000Z', titulo: 'Nuevo' });
    const leido = aviso({ ruta: '/usuarios', leido: true });
    const deOtra = aviso({ ruta: '/asistencia' });
    const todos = [viejo, leido, nuevo, deOtra];
    expect(avisosDeLaSeccion(todos, RUTAS, '/usuarios').map((a) => a.titulo)).toEqual(['Nuevo', 'Viejo']);
    expect(avisosDeLaSeccion(todos, RUTAS, '/asistencia')).toEqual([deOtra]);
    // En una subpantalla, o fuera de las secciones del menú, no sale nada.
    expect(avisosDeLaSeccion(todos, RUTAS, '/usuarios/12')).toEqual([]);
    expect(avisosDeLaSeccion(todos, RUTAS, '/')).toEqual([]);
    expect(avisosDeLaSeccion(todos, RUTAS, '/ayuda')).toEqual([]);
  });

  it('coincide con lo que cuenta la burbuja: los mismos avisos sin leer de esa sección', () => {
    const items = [
      aviso({ ruta: '/asistencia/incidencias' }),
      aviso({ ruta: '/asistencia/emergencias' }),
      aviso({ reporteId: 9, tipo: 'reporte_nuevo' }),
      aviso({ ruta: '/asistencia', leido: true }),
    ];
    const burbuja = (to: string) => items.filter((a) => !a.leido && seccionDeAviso(a, RUTAS) === to).length;
    expect(avisosDeLaSeccion(items, RUTAS, '/asistencia')).toHaveLength(burbuja('/asistencia'));
    expect(avisosDeLaSeccion(items, RUTAS, '/reportes')).toHaveLength(burbuja('/reportes'));
  });

  it('en la misma fecha, el id mayor (más reciente) va primero', () => {
    const a = aviso({ ruta: '/usuarios' });
    const b = aviso({ ruta: '/usuarios' });
    expect(avisosDeLaSeccion([a, b], RUTAS, '/usuarios').map((x) => x.id)).toEqual([b.id, a.id]);
  });
});

describe('"Ver" lleva a donde dice el aviso (A-85)', () => {
  it('el reporte, o la pantalla del aviso (con su detalle)', () => {
    expect(destinoDeAviso({ reporteId: 7, ruta: '/reportes' })).toBe('/reportes/7');
    expect(destinoDeAviso({ reporteId: null, ruta: '/asistencia/guardias/4?vista=bitacora&cat=incidencias' })).toBe(
      '/asistencia/guardias/4?vista=bitacora&cat=incidencias',
    );
    expect(destinoDeAviso({ reporteId: null, ruta: null })).toBeNull();
  });

  it('solo se ofrece si es otra pantalla: si ya estás ahí, solo "Entendido"', () => {
    // Estás en Usuarios y el aviso apunta a Usuarios: no hay a dónde ir.
    expect(ofreceVer({ reporteId: null, ruta: '/usuarios' }, '/usuarios')).toBe(false);
    // Aunque traiga un filtro en la dirección, sigue siendo la misma pantalla.
    expect(ofreceVer({ reporteId: null, ruta: '/usuarios?q=luis' }, '/usuarios')).toBe(false);
    expect(ofreceVer({ reporteId: null, ruta: '/asistencia/incidencias?id=4' }, '/asistencia')).toBe(true);
    expect(ofreceVer({ reporteId: 3, ruta: null }, '/reportes')).toBe(true);
    expect(ofreceVer({ reporteId: null, ruta: null }, '/usuarios')).toBe(false);
  });
});

describe('hora de los avisos', () => {
  const ahora = new Date('2026-11-13T18:00:00');
  it('relativa si es de hoy; la hora si es de ayer; la fecha si es más vieja', () => {
    expect(horaRelativa('2026-11-13T17:59:30', ahora)).toBe('ahora');
    expect(horaRelativa('2026-11-13T17:40:00', ahora)).toBe('hace 20 min');
    expect(horaRelativa('2026-11-13T15:00:00', ahora)).toBe('hace 3 h');
    expect(grupoDe('2026-11-12T20:00:00', ahora)).toBe('Ayer');
    expect(grupoDe('2026-11-01T20:00:00', ahora)).toBe('Anteriores');
  });
});
