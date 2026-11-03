import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import { createCarterasModule } from '../src/modules/carteras';
import {
  CarterasRepository,
  type AdminCartera,
  type DatosCartera,
  type MovimientoCartera,
} from '../src/modules/carteras/carteras.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const HOY = '2026-11-04';

type U = DatosCartera['usuarios'][number] & { propietarioId: number | null };

class Memoria extends CarterasRepository {
  admins: AdminCartera[] = [
    { id: 1, nombre: 'Super Ada', activo: true, esSuperAdmin: true },
    { id: 10, nombre: 'Admin A', activo: true, esSuperAdmin: false },
    { id: 11, nombre: 'Admin B', activo: true, esSuperAdmin: false },
    { id: 12, nombre: 'Admin Baja', activo: false, esSuperAdmin: false },
  ];
  /** Cartera del admin 10: supervisor 20 (sitio 100 de Cliente Uno), guardias 21 y 22 en ese sitio, guardia 23 suelto. */
  usuarios: U[] = [
    { id: 20, nombre: 'Sup Uno', rol: 'supervisor', activo: true, clienteId: null, propietarioId: 10 },
    { id: 21, nombre: 'Guardia 21', rol: 'guardia', activo: true, clienteId: null, propietarioId: 10 },
    { id: 22, nombre: 'Guardia 22', rol: 'guardia', activo: true, clienteId: null, propietarioId: 10 },
    { id: 23, nombre: 'Guardia suelto', rol: 'guardia', activo: true, clienteId: null, propietarioId: 10 },
    { id: 24, nombre: 'Acceso Cliente Uno', rol: 'cliente', activo: true, clienteId: 50, propietarioId: 10 },
    { id: 30, nombre: 'Guardia de B', rol: 'guardia', activo: true, clienteId: null, propietarioId: 11 },
    { id: 40, nombre: 'Guardia sin dueño', rol: 'guardia', activo: true, clienteId: null, propietarioId: null },
  ];
  clientes = [
    { id: 50, nombre: 'Cliente Uno', propietarioId: 10 as number | null },
    { id: 51, nombre: 'Cliente de B', propietarioId: 11 as number | null },
  ];
  grupos = [{ id: 60, nombre: 'Grupo A', integrantes: 2, propietarioId: 10 as number | null }];
  sitios = [
    { id: 100, nombre: 'Sitio Uno', clienteId: 50, supervisorId: 20 },
    { id: 101, nombre: 'Sitio de B', clienteId: 51, supervisorId: null },
  ];
  asignaciones = [
    { sitioId: 100, guardiaId: 21 },
    { sitioId: 100, guardiaId: 22 },
  ];
  movidos: MovimientoCartera[] = [];
  avisosMovidos: { desde: number | null; hacia: number; guardiaIds: number[]; sitioIds: number[] }[] = [];

  async resumen() {
    return {
      admins: this.admins.map((a) => ({
        ...a,
        usuarios: this.usuarios.filter((u) => u.propietarioId === a.id).length,
        clientes: this.clientes.filter((c) => c.propietarioId === a.id).length,
        grupos: this.grupos.filter((g) => g.propietarioId === a.id).length,
      })),
      sinAsignar: {
        usuarios: this.usuarios.filter((u) => u.propietarioId === null).length,
        clientes: this.clientes.filter((c) => c.propietarioId === null).length,
        grupos: this.grupos.filter((g) => g.propietarioId === null).length,
      },
    };
  }
  async cartera(propietarioId: number | null) {
    let propietario: DatosCartera['propietario'] = null;
    if (propietarioId !== null) {
      const a = this.admins.find((x) => x.id === propietarioId);
      if (!a) return null;
      propietario = { id: a.id, nombre: a.nombre, activo: a.activo };
    }
    const clientes = this.clientes.filter((c) => c.propietarioId === propietarioId);
    const sitios = this.sitios.filter((s) => clientes.some((c) => c.id === s.clienteId));
    return {
      propietario,
      usuarios: this.usuarios.filter((u) => u.propietarioId === propietarioId).map(({ propietarioId: _p, ...u }) => u),
      clientes: clientes.map(({ id, nombre }) => ({ id, nombre })),
      grupos: this.grupos.filter((g) => g.propietarioId === propietarioId).map(({ propietarioId: _p, ...g }) => g),
      sitios,
      asignaciones: this.asignaciones.filter((a) => sitios.some((s) => s.id === a.sitioId)),
    };
  }
  async admin(id: number) {
    return this.admins.find((a) => a.id === id) ?? null;
  }
  async mover(m: MovimientoCartera) {
    this.movidos.push(m);
    this.usuarios.filter((u) => m.usuarioIds.includes(u.id)).forEach((u) => (u.propietarioId = m.destinoId));
    this.clientes.filter((c) => m.clienteIds.includes(c.id)).forEach((c) => (c.propietarioId = m.destinoId));
    this.grupos.filter((g) => m.grupoIds.includes(g.id)).forEach((g) => (g.propietarioId = m.destinoId));
  }
  async moverAvisosPendientes(d: { desde: number | null; hacia: number; guardiaIds: number[]; sitioIds: number[] }) {
    this.avisosMovidos.push(d);
    return 7;
  }
}

let repo: Memoria;
let audit: MemoryAuditLogger;
let avisos: { usuarioIds: number[]; titulo?: string; mensaje: string }[];
let app: ReturnType<typeof createApp>;

const token = (id: number, rol: Rol, extra: { esSuperAdmin?: boolean } = {}) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol], ...extra })}`;
const como = (t: string) => ({
  get: (u = '') => request(app).get(`/api/carteras${u}`).set('Authorization', t),
  post: (u: string, b: object = {}) => request(app).post(`/api/carteras${u}`).set('Authorization', t).send(b),
});
const SUPER = token(1, ROLES.ADMIN, { esSuperAdmin: true });

beforeEach(() => {
  repo = new Memoria();
  audit = new MemoryAuditLogger();
  avisos = [];
  app = createApp([
    createCarterasModule({
      repo,
      audit,
      hoy: () => HOY,
      avisar: async (usuarioIds, a) => void avisos.push({ usuarioIds, titulo: a.titulo, mensaje: a.mensaje }),
    }),
  ]);
});

describe('carteras: quién puede (A-65)', () => {
  it('solo el super admin; un admin normal, un supervisor y un guardia no', async () => {
    for (const t of [token(10, ROLES.ADMIN), token(5, ROLES.SUPERVISOR), token(21, ROLES.GUARDIA)]) {
      expect((await como(t).get()).status).toBe(403);
      expect((await como(t).get('/10')).status).toBe(403);
      expect((await como(t).post('/transferir', { origenId: 10, destinoId: 11, todo: true })).status).toBe(403);
    }
    expect((await como(SUPER).get()).status).toBe(200);
  });
});

describe('carteras: ver (A-65)', () => {
  it('el resumen cuenta lo de cada admin y lo sin asignar', async () => {
    const { admins, sinAsignar } = (await como(SUPER).get()).body.data;
    expect(admins.find((a: { id: number }) => a.id === 10)).toMatchObject({ usuarios: 5, clientes: 1, grupos: 1 });
    expect(admins.find((a: { id: number }) => a.id === 12)).toMatchObject({ activo: false, usuarios: 0 });
    expect(sinAsignar).toEqual({ usuarios: 1, clientes: 0, grupos: 0 });
  });

  it('la cartera de un admin sale armada: supervisor con lo que tiene detrás, clientes con sitios y accesos', async () => {
    const a = (await como(SUPER).get('/10')).body.data;
    expect(a.propietario).toMatchObject({ id: 10, nombre: 'Admin A' });
    expect(a.supervisores).toHaveLength(1);
    expect(a.supervisores[0]).toMatchObject({
      nombre: 'Sup Uno',
      guardias: [{ id: 21 }, { id: 22 }],
      clientes: [{ id: 50, nombre: 'Cliente Uno' }],
    });
    expect(a.clientes[0]).toMatchObject({ nombre: 'Cliente Uno', sitios: [{ nombre: 'Sitio Uno' }], accesos: [{ id: 24 }] });
    expect(a.guardias.map((g: { id: number }) => g.id)).toEqual([21, 22, 23]);
    expect(a.otros).toEqual([]);
    expect(a.totales).toEqual({ usuarios: 5, clientes: 1, sitios: 1, grupos: 1 });
  });

  it('lo sin asignar y un admin que no existe', async () => {
    expect((await como(SUPER).get('/sin-asignar')).body.data).toMatchObject({
      propietario: null,
      guardias: [{ id: 40 }],
    });
    expect((await como(SUPER).get('/99')).status).toBe(404);
    expect((await como(SUPER).get('/abc')).status).toBe(400);
  });
});

describe('carteras: transferir (A-65)', () => {
  const pasar = (b: object) => como(SUPER).post('/transferir', { origenId: 10, destinoId: 11, ...b });

  it('toda la cartera a otro admin, de un paso', async () => {
    const r = await pasar({ todo: true });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ usuarios: 5, clientes: 1, grupos: 1, avisos: 7 });
    expect(repo.usuarios.filter((u) => u.propietarioId === 10)).toEqual([]);
    expect(repo.clientes[0].propietarioId).toBe(11);
    expect(repo.grupos[0].propietarioId).toBe(11);
    // Los avisos pendientes de esos guardias y sitios viajan con la cartera.
    expect(repo.avisosMovidos).toEqual([{ desde: 10, hacia: 11, guardiaIds: [21, 22, 23], sitioIds: [100] }]);
    expect(audit.acciones()).toContain('carteras.transferir');
  });

  it('un supervisor se lleva lo que tiene detrás: sus guardias, sus clientes con sitios y los accesos', async () => {
    const r = await pasar({ usuarioIds: [20] });
    expect(r.body.data).toMatchObject({ usuarios: 4, clientes: 1 });
    const de = (id: number) => repo.usuarios.find((u) => u.id === id)!.propietarioId;
    expect([de(20), de(21), de(22), de(24)]).toEqual([11, 11, 11, 11]);
    // El guardia suelto no era de ese supervisor: se queda.
    expect(de(23)).toBe(10);
    expect(repo.clientes[0].propietarioId).toBe(11);
    expect(repo.avisosMovidos[0]).toMatchObject({ guardiaIds: [21, 22], sitioIds: [100] });
  });

  it('o solo al supervisor, sin su cadena', async () => {
    const r = await pasar({ usuarioIds: [20], cadena: false });
    expect(r.body.data).toMatchObject({ usuarios: 1, clientes: 0 });
    expect(repo.usuarios.find((u) => u.id === 21)!.propietarioId).toBe(10);
  });

  it('un cliente se lleva sus accesos; un guardia suelto se mueve solo', async () => {
    await pasar({ clienteIds: [50] });
    expect(repo.usuarios.find((u) => u.id === 24)!.propietarioId).toBe(11);
    expect(repo.usuarios.find((u) => u.id === 21)!.propietarioId).toBe(10);
    await como(SUPER).post('/transferir', { origenId: 10, destinoId: 11, usuarioIds: [23] });
    expect(repo.usuarios.find((u) => u.id === 23)!.propietarioId).toBe(11);
  });

  it('puede pasar a un admin activo o dejarlo sin asignar, nunca a uno dado de baja', async () => {
    expect((await pasar({ todo: true, destinoId: 12 })).status).toBe(400);
    expect((await pasar({ todo: true, destinoId: 99 })).status).toBe(400);
    const r = await pasar({ usuarioIds: [23], destinoId: null });
    expect(r.status).toBe(200);
    expect(r.body.data.avisos).toBe(0);
    expect(repo.usuarios.find((u) => u.id === 23)!.propietarioId).toBeNull();
    expect(repo.avisosMovidos).toEqual([]);
  });

  it('se puede pasar de un admin de baja y de lo sin asignar, siempre a uno activo', async () => {
    repo.usuarios.find((u) => u.id === 30)!.propietarioId = 12;
    const deBaja = await como(SUPER).post('/transferir', { origenId: 12, destinoId: 10, todo: true });
    expect(deBaja.body.data.usuarios).toBe(1);
    const sin = await como(SUPER).post('/transferir', { origenId: null, destinoId: 10, todo: true });
    expect(sin.body.data.usuarios).toBe(1);
    expect(repo.usuarios.find((u) => u.id === 40)!.propietarioId).toBe(10);
    expect(repo.avisosMovidos.at(-1)).toMatchObject({ desde: null, hacia: 10, guardiaIds: [40] });
  });

  it('no deja mover lo que no es de la cartera de origen, ni nada vacío, ni al mismo admin', async () => {
    expect((await pasar({ usuarioIds: [30] })).status).toBe(400);
    expect((await pasar({ clienteIds: [51] })).status).toBe(400);
    expect((await pasar({})).status).toBe(400);
    expect((await pasar({ todo: true, destinoId: 10 })).status).toBe(400);
    expect(repo.movidos).toEqual([]);
  });

  it('les avisa al admin que recibe y al que pierde', async () => {
    await pasar({ todo: true });
    expect(avisos.find((a) => a.titulo === 'Te pasaron una cartera')?.usuarioIds).toEqual([11]);
    expect(avisos.find((a) => a.titulo === 'Cambió tu cartera')?.usuarioIds).toEqual([10]);
    expect(avisos[0].mensaje).toContain('5 usuarios, 1 clientes y 1 grupos');
  });
});
