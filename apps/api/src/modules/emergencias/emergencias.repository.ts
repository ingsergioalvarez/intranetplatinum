import { ROLES, type Emergencia, type EstadoEmergencia, type ResultadoEmergencia, type TipoEmergencia } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { asignadaA } from '../clientes/clientes.repository';

export interface NuevaEmergencia {
  usuarioId: number;
  sitioId: number | null;
  lat?: number;
  lng?: number;
  precisionM?: number;
  bateria?: number;
}

export type EmergenciaRow = Omit<Emergencia, 'createdAt' | 'acusadaEn' | 'cerradaEn'> & {
  createdAt: Date;
  acusadaEn: Date | null;
  cerradaEn: Date | null;
};

export interface SitioDeGuardia {
  id: number;
  nombre: string;
  supervisorId: number | null;
}

/** Acceso a datos del botón de pánico (A-60). */
export abstract class EmergenciasRepository {
  abstract crear(d: NuevaEmergencia): Promise<EmergenciaRow>;
  abstract findById(id: number): Promise<EmergenciaRow | null>;
  /** Activa de ese usuario, si tiene una. */
  abstract activaDe(usuarioId: number): Promise<EmergenciaRow | null>;
  abstract listar(soloActivas: boolean, limite: number): Promise<EmergenciaRow[]>;
  abstract acusar(id: number, porId: number, por: string, en: Date): Promise<void>;
  abstract fijarTipo(id: number, tipo: TipoEmergencia): Promise<void>;
  abstract cerrar(
    id: number,
    c: { cerradaEn: Date; cerradaPor: string; resultado: ResultadoEmergencia; nota: string | null },
  ): Promise<void>;
  /** Activas sin acuse que llevan tiempo sin respuesta y toca repetir la alerta. */
  abstract porEscalar(creadasAntes: Date, escaladasAntes: Date): Promise<EmergenciaRow[]>;
  abstract marcarEscalada(id: number, en: Date): Promise<void>;
  /** Sitio donde está asignado hoy el guardia (y su supervisor). */
  abstract sitioDe(usuarioId: number, hoy: string): Promise<SitioDeGuardia | null>;
  abstract admins(): Promise<number[]>;
  abstract supervisores(): Promise<number[]>;
  abstract nombreDe(usuarioId: number): Promise<string | null>;
}

const select = {
  id: true,
  estado: true,
  tipo: true,
  lat: true,
  lng: true,
  precisionM: true,
  bateria: true,
  createdAt: true,
  acusadaPor: true,
  acusadaEn: true,
  escaladas: true,
  cerradaEn: true,
  cerradaPor: true,
  resultado: true,
  nota: true,
  usuario: { select: { id: true, nombre: true, telefono: true, rol: { select: { clave: true } } } },
  sitio: { select: { id: true, nombre: true } },
} as const;

type Fila = {
  id: number;
  estado: string;
  tipo: string | null;
  lat: { toNumber(): number } | null;
  lng: { toNumber(): number } | null;
  precisionM: number | null;
  bateria: number | null;
  createdAt: Date;
  acusadaPor: string | null;
  acusadaEn: Date | null;
  escaladas: number;
  cerradaEn: Date | null;
  cerradaPor: string | null;
  resultado: string | null;
  nota: string | null;
  usuario: { id: number; nombre: string; telefono: string | null; rol: { clave: string } };
  sitio: { id: number; nombre: string } | null;
};

const aRow = ({ usuario, lat, lng, ...r }: Fila): EmergenciaRow => ({
  ...r,
  estado: r.estado as EstadoEmergencia,
  tipo: r.tipo as TipoEmergencia | null,
  resultado: r.resultado as ResultadoEmergencia | null,
  lat: lat?.toNumber() ?? null,
  lng: lng?.toNumber() ?? null,
  usuario: { id: usuario.id, nombre: usuario.nombre, telefono: usuario.telefono, rol: usuario.rol.clave },
});

const usuariosDeRol = async (rol: string) =>
  (
    await getPrisma().usuario.findMany({
      where: { activo: true, deletedAt: null, rol: { clave: rol } },
      select: { id: true },
    })
  ).map((u) => u.id);

export class PrismaEmergenciasRepository extends EmergenciasRepository {
  async crear(d: NuevaEmergencia) {
    const r = await getPrisma().emergencia.create({ data: d, select });
    return aRow(r);
  }

  async findById(id: number) {
    const r = await getPrisma().emergencia.findUnique({ where: { id }, select });
    return r && aRow(r);
  }

  async activaDe(usuarioId: number) {
    const r = await getPrisma().emergencia.findFirst({
      where: { usuarioId, estado: 'activa' },
      orderBy: { createdAt: 'desc' },
      select,
    });
    return r && aRow(r);
  }

  async listar(soloActivas: boolean, limite: number) {
    const rows = await getPrisma().emergencia.findMany({
      where: soloActivas ? { estado: 'activa' } : {},
      orderBy: { createdAt: 'desc' },
      take: limite,
      select,
    });
    return rows.map(aRow);
  }

  async acusar(id: number, porId: number, por: string, en: Date) {
    await getPrisma().emergencia.update({ where: { id }, data: { acusadaPorId: porId, acusadaPor: por, acusadaEn: en } });
  }

  async fijarTipo(id: number, tipo: TipoEmergencia) {
    await getPrisma().emergencia.update({ where: { id }, data: { tipo } });
  }

  async cerrar(id: number, c: { cerradaEn: Date; cerradaPor: string; resultado: ResultadoEmergencia; nota: string | null }) {
    await getPrisma().emergencia.update({
      where: { id },
      data: { estado: 'cerrada', ...c, nota: c.nota?.slice(0, 255) ?? null },
    });
  }

  async porEscalar(creadasAntes: Date, escaladasAntes: Date) {
    const rows = await getPrisma().emergencia.findMany({
      where: {
        estado: 'activa',
        acusadaEn: null,
        createdAt: { lte: creadasAntes },
        OR: [{ escaladaEn: null }, { escaladaEn: { lte: escaladasAntes } }],
      },
      select,
    });
    return rows.map(aRow);
  }

  async marcarEscalada(id: number, en: Date) {
    await getPrisma().emergencia.update({ where: { id }, data: { escaladas: { increment: 1 }, escaladaEn: en } });
  }

  async sitioDe(usuarioId: number, hoy: string) {
    const a = await getPrisma().sitioGuardia.findFirst({
      where: { ...asignadaA(usuarioId, hoy), sitio: { deletedAt: null } },
      orderBy: { desde: 'desc' },
      select: { sitio: { select: { id: true, nombre: true, supervisorId: true } } },
    });
    return a?.sitio ?? null;
  }

  admins() {
    return usuariosDeRol(ROLES.ADMIN);
  }

  supervisores() {
    return usuariosDeRol(ROLES.SUPERVISOR);
  }

  async nombreDe(usuarioId: number) {
    return (await getPrisma().usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } }))?.nombre ?? null;
  }
}
