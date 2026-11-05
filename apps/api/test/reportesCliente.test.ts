import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type OpcionesReporteCliente, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken, type AuthUser } from '../src/core';
import { createReportesClienteModule } from '../src/modules/reportes-cliente';
import {
  ReportesClienteRepository,
  type AtencionReporteCliente,
  type NuevoReporteCliente,
  type ReporteClienteRow,
  type SitioDeCliente,
  type VisibilidadReporteCliente,
} from '../src/modules/reportes-cliente/reportesCliente.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

const HOY = '2026-11-03';
const NOMBRES: Record<number, string> = { 1: 'Admin Ada', 2: 'Admin Beto', 3: 'Super Sara', 5: 'Sofía Sup', 6: 'Pedro Sup', 10: 'Juan Pérez', 11: 'Ana Ruiz', 20: 'Cris Cliente', 21: 'Dora Cliente' };

/** Sitios: 100 y 101 de Acme (cliente 1); 102 de Beta (cliente 2); 103 de Acme sin supervisor; 104 de otro cliente sin supervisor. */
const SITIOS: Record<number, { nombre: string; clienteId: number; supervisorId: number | null }> = {
  100: { nombre: 'Torre Norte', clienteId: 1, supervisorId: 5 },
  101: { nombre: 'Bodega Sur', clienteId: 1, supervisorId: 6 },
  102: { nombre: 'Plaza Beta', clienteId: 2, supervisorId: 6 },
  103: { nombre: 'Anexo Acme', clienteId: 1, supervisorId: null },
  104: { nombre: 'Huérfano', clienteId: 3, supervisorId: null },
};
const CLIENTES: Record<number, string> = { 1: 'Acme', 2: 'Beta', 3: 'Otro SA' };
/** Guardias de cada sitio. */
const GUARDIAS: Record<number, number[]> = { 100: [10], 101: [11], 102: [11], 103: [], 104: [] };

class Memoria extends ReportesClienteRepository {
  filas: (ReporteClienteRow & { supervisorId: number | null })[] = [];
  async crear(d: NuevoReporteCliente) {
    const s = SITIOS[d.sitioId];
    const f = {
      id: this.filas.length + 1,
      tipo: d.tipo,
      urgente: d.urgente,
      asunto: d.asunto,
      descripcion: d.descripcion,
      estatus: 'abierto' as const,
      createdAt: new Date('2026-11-03T16:00:00.000Z'),
      sitio: { id: d.sitioId, nombre: s.nombre },
      cliente: { id: d.clienteId, nombreComercial: CLIENTES[d.clienteId] },
      guardia: d.guardiaId ? { id: d.guardiaId, nombre: NOMBRES[d.guardiaId] } : null,
      creadoPor: { id: d.creadoPorId, nombre: NOMBRES[d.creadoPorId] },
      atendidoEn: null,
      atendidoPor: null,
      respuesta: null,
      supervisorId: s.supervisorId,
    };
    this.filas.push(f);
    return f;
  }
  private visibles(v: VisibilidadReporteCliente) {
    return this.filas.filter((f) => {
      if (v.tipo === 'todos') return true;
      if (v.tipo === 'supervisor') return f.supervisorId === v.usuarioId;
      return f.cliente.id === v.clienteId;
    });
  }
  async findById(id: number, v: VisibilidadReporteCliente) {
    return this.visibles(v).find((f) => f.id === id) ?? null;
  }
  async listar(v: VisibilidadReporteCliente) {
    return this.visibles(v);
  }
  async atender(id: number, a: AtencionReporteCliente) {
    Object.assign(this.filas.find((f) => f.id === id)!, a);
  }
  async opciones(clienteId: number): Promise<OpcionesReporteCliente> {
    return {
      sitios: Object.entries(SITIOS)
        .filter(([, s]) => s.clienteId === clienteId)
        .map(([id, s]) => ({
          id: Number(id),
          nombre: s.nombre,
          guardias: (GUARDIAS[Number(id)] ?? []).map((g) => ({ id: g, nombre: NOMBRES[g] })),
        })),
    };
  }
  async sitioDelCliente(sitioId: number, clienteId: number): Promise<SitioDeCliente | null> {
    const s = SITIOS[sitioId];
    return s && s.clienteId === clienteId ? { id: sitioId, nombre: s.nombre, supervisorId: s.supervisorId } : null;
  }
  async guardiaReciente(sitioId: number, guardiaId: number) {
    return (GUARDIAS[sitioId] ?? []).includes(guardiaId) ? { id: guardiaId, nombre: NOMBRES[guardiaId] } : null;
  }
  async adminsDe() {
    return [1, 2];
  }
  async superAdmins() {
    return [3];
  }
  async nombreDe(id: number) {
    return NOMBRES[id] ?? null;
  }
}

interface AvisoRegistrado {
  usuarioIds: number[];
  titulo?: string;
  mensaje: string;
  ruta?: string | null;
  entidad?: string;
  urgente?: boolean;
}

let repo: Memoria;
let audit: MemoryAuditLogger;
let avisos: AvisoRegistrado[];
let atendidos: string[];
let app: ReturnType<typeof createApp>;

const token = (u: Partial<AuthUser> & { id: number; rol: Rol }) =>
  `Bearer ${signAccessToken({ email: 'x@x.mx', permisos: PERMISOS_POR_ROL[u.rol], ...u })}`;
const como = (u: Partial<AuthUser> & { id: number; rol: Rol }) => ({
  get: (url = '') => request(app).get(`/api/reportes-cliente${url}`).set('Authorization', token(u)),
  post: (url: string, body: object = {}) =>
    request(app).post(`/api/reportes-cliente${url}`).set('Authorization', token(u)).send(body),
});
const cliente = () => como({ id: 20, rol: ROLES.CLIENTE, clienteId: 1 });
const otroDelCliente = () => como({ id: 21, rol: ROLES.CLIENTE, clienteId: 1 });
const clienteBeta = () => como({ id: 22, rol: ROLES.CLIENTE, clienteId: 2 });
const sup = (id = 5) => como({ id, rol: ROLES.SUPERVISOR });
const adminAda = () => como({ id: 1, rol: ROLES.ADMIN });
const adminBeto = () => como({ id: 2, rol: ROLES.ADMIN });
const superAdmin = () => como({ id: 3, rol: ROLES.ADMIN, esSuperAdmin: true });
const guardia = () => como({ id: 10, rol: ROLES.GUARDIA });

const delServicio = { tipo: 'servicio', sitioId: 100, asunto: 'Llegan tarde seguido', descripcion: 'Desde hace una semana el relevo llega tarde' };
const deGuardia = { ...delServicio, tipo: 'guardia', guardiaId: 10, asunto: 'Trato descortés' };

beforeEach(() => {
  repo = new Memoria();
  audit = new MemoryAuditLogger();
  avisos = [];
  atendidos = [];
  app = createApp([
    createReportesClienteModule({
      repo,
      audit,
      avisar: async (usuarioIds, a) =>
        void avisos.push({
          usuarioIds,
          titulo: a.titulo,
          mensaje: a.mensaje,
          ruta: a.ruta,
          entidad: a.entidad && `${a.entidad.tipo}:${a.entidad.id}`,
          urgente: a.urgente,
        }),
      atencion: {
        atender: async (e, a) => void atendidos.push(`${e.tipo}:${e.id}:${a.resultado}`),
        reabrir: async () => undefined,
      },
      hoy: () => HOY,
      ahora: () => new Date('2026-11-03T17:00:00.000Z'),
    }),
  ]);
});

describe('reportes del cliente (A-59)', () => {
  describe('levantar un reporte', () => {
    it('sobre el servicio: queda abierto, se audita y avisa solo al supervisor del sitio', async () => {
      const res = await cliente().post('', delServicio);
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ tipo: 'servicio', estatus: 'abierto', urgente: false, guardia: null, sitio: { id: 100 } });
      expect(audit.acciones()).toContain('reportes_cliente.crear');
      expect(avisos).toHaveLength(1);
      expect(avisos[0]).toMatchObject({ usuarioIds: [5], titulo: 'Reporte de un cliente', ruta: '/reportes-cliente', entidad: 'reporte_cliente:1', urgente: false });
      expect(avisos[0].mensaje).toContain('Torre Norte');
    });

    it('urgente: avisa al supervisor y a los admin al momento, con alerta urgente', async () => {
      await cliente().post('', { ...delServicio, urgente: true });
      expect(avisos).toHaveLength(1);
      expect(avisos[0].usuarioIds.sort()).toEqual([1, 2, 5]);
      expect(avisos[0]).toMatchObject({ titulo: 'Reporte URGENTE de un cliente', urgente: true });
    });

    it('sobre un guardia: lo nombra en el aviso y el guardia nunca recibe nada', async () => {
      const res = await cliente().post('', { ...deGuardia, urgente: true });
      expect(res.status).toBe(201);
      expect(res.body.data.guardia).toEqual({ id: 10, nombre: 'Juan Pérez' });
      expect(avisos[0].mensaje).toContain('sobre Juan Pérez');
      expect(avisos.flatMap((a) => a.usuarioIds)).not.toContain(10);
    });

    it('sobre un guardia exige elegir cuál, y que sea de ese sitio', async () => {
      const sinGuardia = await cliente().post('', { ...deGuardia, guardiaId: undefined });
      expect(sinGuardia.status).toBe(400);
      expect(sinGuardia.body.error.details[0].path).toBe('guardiaId');
      const deOtroSitio = await cliente().post('', { ...deGuardia, guardiaId: 11 });
      expect(deOtroSitio.status).toBe(400);
      expect(avisos).toHaveLength(0);
    });

    it('sobre el servicio ignora el guardia que mande', async () => {
      const res = await cliente().post('', { ...delServicio, guardiaId: 10 });
      expect(res.body.data.guardia).toBeNull();
    });

    it('solo en sitios de su empresa', async () => {
      const res = await cliente().post('', { ...delServicio, sitioId: 102 });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].path).toBe('sitioId');
    });

    it('si el sitio no tiene supervisor avisa a los admin', async () => {
      await cliente().post('', { ...delServicio, sitioId: 103 });
      expect(avisos[0].usuarioIds).toEqual([1, 2]);
      await como({ id: 23, rol: ROLES.CLIENTE, clienteId: 3 }).post('', { ...delServicio, sitioId: 104 });
      expect(avisos[1].usuarioIds).toEqual([1, 2]);
    });

    it('valida el asunto y la descripción', async () => {
      const res = await cliente().post('', { ...delServicio, asunto: 'hola', descripcion: 'corto' });
      expect(res.status).toBe(400);
    });

    it('solo el cliente levanta reportes: ni guardia, ni supervisor, ni admin', async () => {
      for (const quien of [guardia(), sup(), adminAda()]) {
        expect((await quien.post('', delServicio)).status).toBe(403);
      }
      expect(repo.filas).toHaveLength(0);
    });
  });

  describe('opciones del formulario', () => {
    it('el cliente ve sus sitios con los guardias de cada uno', async () => {
      const res = await cliente().get('/opciones');
      expect(res.status).toBe(200);
      expect(res.body.data.sitios.map((s: { id: number }) => s.id).sort()).toEqual([100, 101, 103]);
      expect(res.body.data.sitios.find((s: { id: number }) => s.id === 100).guardias).toEqual([{ id: 10, nombre: 'Juan Pérez' }]);
    });

    it('nadie más las pide', async () => {
      expect((await sup().get('/opciones')).status).toBe(403);
      expect((await guardia().get('/opciones')).status).toBe(403);
    });
  });

  describe('quién ve cuáles', () => {
    beforeEach(async () => {
      await cliente().post('', delServicio); // 1: Acme, sitio 100 (sup 5)
      await cliente().post('', { ...delServicio, sitioId: 101, asunto: 'Sitio de Pedro' }); // 2: Acme, sitio 101 (sup 6)
      await clienteBeta().post('', { ...delServicio, sitioId: 102, asunto: 'Reporte de Beta' }); // 3: Beta, sitio 102 (sup 6)
    });

    it('el cliente ve los de su empresa (también los que levantó otra persona de ella)', async () => {
      const res = await otroDelCliente().get();
      expect(res.body.data.items.map((r: { id: number }) => r.id).sort()).toEqual([1, 2]);
    });

    it('el supervisor, solo los de sus sitios', async () => {
      expect((await sup(5).get()).body.data.items.map((r: { id: number }) => r.id)).toEqual([1]);
      expect((await sup(6).get()).body.data.items.map((r: { id: number }) => r.id).sort()).toEqual([2, 3]);
    });

    it('el admin ve todos los de la empresa', async () => {
      expect((await adminAda().get()).body.data.items.map((r: { id: number }) => r.id).sort()).toEqual([1, 2, 3]);
      expect((await adminBeto().get()).body.data.items.map((r: { id: number }) => r.id).sort()).toEqual([1, 2, 3]);
    });

    it('el super admin ve todos', async () => {
      expect((await superAdmin().get()).body.data.items).toHaveLength(3);
    });

    it('el guardia no tiene acceso', async () => {
      expect((await guardia().get()).status).toBe(403);
    });

    it('lista los urgentes pendientes primero y cuenta los pendientes', async () => {
      await cliente().post('', { ...delServicio, urgente: true, asunto: 'Urgente de Acme' }); // 4
      await sup(5).post('/1/atender', { estatus: 'resuelto', respuesta: 'Ya se habló con el relevo' });
      const res = await adminAda().get();
      expect(res.body.data.items.map((r: { id: number }) => r.id)).toEqual([4, 2, 3, 1]);
      expect(res.body.data.pendientes).toBe(3);
    });
  });

  describe('atenderlo', () => {
    beforeEach(async () => {
      await cliente().post('', deGuardia); // 1: sitio 100, sup 5
      avisos = [];
    });

    it('el supervisor lo toma a revisión: avisa a quien lo levantó y actualiza el aviso del equipo', async () => {
      const res = await sup(5).post('/1/atender', { estatus: 'en_revision' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ estatus: 'en_revision', atendidoPor: 'Sofía Sup' });
      expect(avisos).toEqual([expect.objectContaining({ usuarioIds: [20], titulo: 'Tu reporte está en revisión' })]);
      expect(atendidos).toEqual(['reporte_cliente:1:En revisión']);
      expect(audit.acciones()).toContain('reportes_cliente.en_revision');
    });

    it('resolverlo exige decir qué se hizo, que ve el cliente', async () => {
      expect((await sup(5).post('/1/atender', { estatus: 'resuelto' })).status).toBe(400);
      const res = await adminAda().post('/1/atender', { estatus: 'resuelto', respuesta: 'Se cambió al guardia del turno' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ estatus: 'resuelto', respuesta: 'Se cambió al guardia del turno', atendidoPor: 'Admin Ada' });
      expect(avisos[0]).toMatchObject({ usuarioIds: [20], titulo: 'Tu reporte fue resuelto' });
      expect(avisos[0].mensaje).toContain('Se cambió al guardia del turno');
      // El cliente lo ve en su lista con la respuesta.
      expect((await cliente().get()).body.data.items[0]).toMatchObject({ estatus: 'resuelto', respuesta: 'Se cambió al guardia del turno' });
    });

    it('uno resuelto ya no se toca, y no se toma a revisión dos veces', async () => {
      await sup(5).post('/1/atender', { estatus: 'en_revision' });
      expect((await sup(5).post('/1/atender', { estatus: 'en_revision' })).status).toBe(409);
      await sup(5).post('/1/atender', { estatus: 'resuelto', respuesta: 'Listo, ya quedó' });
      expect((await sup(5).post('/1/atender', { estatus: 'resuelto', respuesta: 'Otra vez' })).status).toBe(409);
    });

    it('un supervisor ajeno lo ve como si no existiera', async () => {
      expect((await sup(6).post('/1/atender', { estatus: 'en_revision' })).status).toBe(404);
      expect(repo.filas[0].estatus).toBe('abierto');
    });

    it('el super admin atiende cualquiera', async () => {
      expect((await superAdmin().post('/1/atender', { estatus: 'en_revision' })).status).toBe(200);
    });

    it('ni el cliente ni el guardia lo atienden', async () => {
      expect((await cliente().post('/1/atender', { estatus: 'en_revision' })).status).toBe(403);
      expect((await guardia().post('/1/atender', { estatus: 'en_revision' })).status).toBe(403);
    });

    it('no avisa a quien lo atiende si fue quien lo levantó', async () => {
      // Un cliente nunca atiende, pero el aviso nunca se manda a quien hace la acción.
      await adminAda().post('/1/atender', { estatus: 'en_revision' });
      expect(avisos.flatMap((a) => a.usuarioIds)).not.toContain(1);
    });
  });
});
