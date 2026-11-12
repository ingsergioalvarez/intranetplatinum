import { ROLES, telefonoDeContacto } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import type { SitioBase } from './estado';

export interface EpisodioRow {
  id: number;
  sitio: { id: number; nombre: string };
  cliente: { id: number; nombre: string };
  inicio: Date;
  fin: Date | null;
  cubierto: boolean | null;
}

/** Datos del monitoreo del C2 (A-61). */
export abstract class C2Repository {
  /** Sitios activos de clientes activos, con su cliente y supervisor. */
  abstract sitios(): Promise<SitioBase[]>;
  /** Cuentas activas con rol C2: a quienes les llegan los avisos de sitios solos. */
  abstract usuariosC2(): Promise<number[]>;
  abstract episodiosAbiertos(): Promise<{ id: number; sitioId: number; inicio: Date }[]>;
  abstract abrirEpisodio(sitioId: number, inicio: Date): Promise<number>;
  abstract cerrarEpisodio(id: number, fin: Date, cubierto: boolean): Promise<void>;
  /** Episodios que se traslapan con el rango (los abiertos incluidos). */
  abstract episodios(desde: Date, hasta: Date): Promise<EpisodioRow[]>;
}

export class PrismaC2Repository extends C2Repository {
  async sitios(): Promise<SitioBase[]> {
    const rows = await getPrisma().sitio.findMany({
      where: { deletedAt: null, cliente: { deletedAt: null, estatus: 'activo' } },
      select: {
        id: true,
        nombre: true,
        cliente: { select: { id: true, nombreComercial: true } },
        supervisor: { select: { nombre: true, telefono: true, telefonoPersonal: true } },
      },
    });
    return rows.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      cliente: { id: s.cliente.id, nombre: s.cliente.nombreComercial },
      supervisor: s.supervisor ? { nombre: s.supervisor.nombre, ...telefonoDeContacto(s.supervisor) } : null,
    }));
  }

  async usuariosC2() {
    const rows = await getPrisma().usuario.findMany({
      where: { activo: true, deletedAt: null, rol: { clave: ROLES.C2 } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async episodiosAbiertos() {
    return getPrisma().sitioSoloEpisodio.findMany({ where: { fin: null }, select: { id: true, sitioId: true, inicio: true } });
  }

  async abrirEpisodio(sitioId: number, inicio: Date) {
    return (await getPrisma().sitioSoloEpisodio.create({ data: { sitioId, inicio }, select: { id: true } })).id;
  }

  async cerrarEpisodio(id: number, fin: Date, cubierto: boolean) {
    await getPrisma().sitioSoloEpisodio.update({ where: { id }, data: { fin, cubierto } });
  }

  async episodios(desde: Date, hasta: Date): Promise<EpisodioRow[]> {
    const rows = await getPrisma().sitioSoloEpisodio.findMany({
      where: { inicio: { lt: hasta }, OR: [{ fin: null }, { fin: { gt: desde } }] },
      orderBy: { inicio: 'asc' },
      select: {
        id: true,
        inicio: true,
        fin: true,
        cubierto: true,
        sitio: { select: { id: true, nombre: true, cliente: { select: { id: true, nombreComercial: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      sitio: { id: r.sitio.id, nombre: r.sitio.nombre },
      cliente: { id: r.sitio.cliente.id, nombre: r.sitio.cliente.nombreComercial },
      inicio: r.inicio,
      fin: r.fin,
      cubierto: r.cubierto,
    }));
  }
}
