import { beforeEach, describe, expect, it } from 'vitest';
import type { Aviso, PrioridadReporte, ReglasAviso } from '@platinum/shared';
import { resolverDestino } from '@platinum/shared';
import { AvisosRepository, type NuevoAviso } from '../src/modules/avisos/avisos.repository';
import { NotificadorAvisos } from '../src/modules/avisos/notificador';

class MemoryAvisos extends AvisosRepository {
  avisos: (NuevoAviso & { usuarioId: number })[] = [];
  correos: number[] = [];
  reglas: ReglasAviso = { porDefecto: 'supervisor', porPrioridad: {} };
  falla = false;

  async crear(ids: number[], aviso: NuevoAviso) {
    if (this.falla) throw new Error('BD caída');
    for (const usuarioId of ids) this.avisos.push({ usuarioId, ...aviso });
  }
  async listar(): Promise<Aviso[]> {
    return [];
  }
  async contarNoLeidos() {
    return 0;
  }
  async marcarLeido() {
    return true;
  }
  async marcarTodos() {}
  async supervisores() {
    return [1, 2]; // admin y supervisor
  }
  async reglasDelCliente() {
    return this.reglas;
  }
  async encolarCorreosCliente(reporteId: number) {
    this.correos.push(reporteId);
    return 1;
  }
  destinatarios() {
    return this.avisos.map((a) => a.usuarioId).sort();
  }
}

const reporte = (prioridad: PrioridadReporte = 'media') => ({
  id: 10,
  folio: 'PLT-2026-000010',
  titulo: 'Cámara sin imagen',
  prioridad,
  sitio: { id: 1, nombre: 'Acceso' },
  cliente: { id: 1, nombreComercial: 'Plaza' },
  creadoPor: { id: 3, nombre: 'Gabriel' },
});

let repo: MemoryAvisos;
let notificador: NotificadorAvisos;

beforeEach(() => {
  repo = new MemoryAvisos();
  notificador = new NotificadorAvisos(repo);
});

describe('reglas de aviso (D-016)', () => {
  it('la excepción por prioridad gana a la regla por defecto', () => {
    const reglas: ReglasAviso = { porDefecto: 'supervisor', porPrioridad: { critica: 'ambos' } };
    expect(resolverDestino(reglas, 'media')).toBe('supervisor');
    expect(resolverDestino(reglas, 'critica')).toBe('ambos');
  });

  it('solo supervisor: avisa en la app a supervisores, sin correo al cliente', async () => {
    await notificador.reporteCreado(reporte(), 3);
    expect(repo.destinatarios()).toEqual([1, 2]);
    expect(repo.avisos[0]).toMatchObject({ tipo: 'reporte_nuevo', reporteId: 10 });
    expect(repo.avisos[0].mensaje).toContain('PLT-2026-000010');
    expect(repo.correos).toEqual([]);
  });

  it('solo cliente: encola correos y no avisa a supervisores', async () => {
    repo.reglas = { porDefecto: 'cliente', porPrioridad: {} };
    await notificador.reporteCreado(reporte(), 3);
    expect(repo.avisos).toEqual([]);
    expect(repo.correos).toEqual([10]);
  });

  it('ambos por prioridad crítica', async () => {
    repo.reglas = { porDefecto: 'supervisor', porPrioridad: { critica: 'ambos' } };
    await notificador.reporteCreado(reporte('critica'), 3);
    expect(repo.destinatarios()).toEqual([1, 2]);
    expect(repo.correos).toEqual([10]);
  });

  it('quien crea el reporte no se avisa a sí mismo', async () => {
    await notificador.reporteCreado(reporte(), 2);
    expect(repo.destinatarios()).toEqual([1]);
  });
});

describe('avisos de seguimiento', () => {
  it('cambio de estatus avisa a quien reportó', async () => {
    await notificador.estatusCambiado(reporte(), 'en_proceso', 2);
    expect(repo.avisos).toEqual([
      expect.objectContaining({
        usuarioId: 3,
        tipo: 'reporte_estatus',
        mensaje: expect.stringContaining('En proceso'),
      }),
    ]);
  });

  it('comentario del guardia avisa a supervisores; del supervisor, al guardia', async () => {
    await notificador.comentarioAgregado(reporte(), 3, 'Gabriel');
    expect(repo.destinatarios()).toEqual([1, 2]);
    repo.avisos = [];
    await notificador.comentarioAgregado(reporte(), 2, 'Sofía');
    expect(repo.destinatarios()).toEqual([1, 3]);
  });

  it('un fallo al avisar no rompe la operación del reporte', async () => {
    repo.falla = true;
    await expect(notificador.reporteCreado(reporte(), 3)).resolves.toBeUndefined();
  });
});
