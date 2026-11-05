import {
  telefonoDeContacto,
  type ContactoTelefono,
  type Emergencia,
  type EstadoEmergencia,
  type ResultadoEmergencia,
  type TipoEmergencia,
} from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { adminsActivos, cadenaDe, rhDeLaEmpresa } from '../avisos/cadena';
import { asignadaA } from '../clientes/clientes.repository';
import { empresaActual } from '../../core/empresa/contexto';

export interface NuevaEmergencia {
  usuarioId: number;
  sitioId: number | null;
  lat?: number;
  lng?: number;
  precisionM?: number;
  bateria?: number;
}

export type EmergenciaRow = Omit<Emergencia, 'createdAt' | 'acusadaEn' | 'cerradaEn' | 'supervisor' | 'paraMi'> & {
  /** A quiénes se avisó (A-65). */
  destinatarios: number[];
  /** La lanzó el super admin. */
  lanzadaPorSuper: boolean;
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
  abstract crear(d: NuevaEmergencia, destinatarios: number[]): Promise<EmergenciaRow>;
  abstract guardarDestinatarios(id: number, ids: number[]): Promise<void>;
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
  /** Jefes por encima de la persona, del más cercano al más lejano (DC-017). */
  abstract cadenaDe(personaId: number): Promise<number[]>;
  /** Personas con el permiso "Recibe las emergencias de la empresa". */
  abstract rh(): Promise<number[]>;
  /** Admins activos: último recurso. */
  abstract admins(): Promise<number[]>;
  abstract nombreDe(usuarioId: number): Promise<string | null>;
  /** Nombre y teléfono al que se le llama (personal, o el de contacto de la empresa). */
  abstract contactoDe(usuarioId: number): Promise<ContactoTelefono | null>;
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
  destinatarios: true,
  usuario: {
    select: { id: true, nombre: true, telefono: true, telefonoPersonal: true, esSuperAdmin: true, rol: { select: { clave: true } } },
  },
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
  destinatarios: unknown;
  usuario: {
    id: number;
    nombre: string;
    telefono: string | null;
    telefonoPersonal: string | null;
    esSuperAdmin: boolean;
    rol: { clave: string };
  };
  sitio: { id: number; nombre: string } | null;
};

const aRow = ({ usuario, lat, lng, destinatarios, ...r }: Fila): EmergenciaRow => ({
  ...r,
  destinatarios: Array.isArray(destinatarios) ? (destinatarios as number[]) : [],
  lanzadaPorSuper: usuario.esSuperAdmin,
  estado: r.estado as EstadoEmergencia,
  tipo: r.tipo as TipoEmergencia | null,
  resultado: r.resultado as ResultadoEmergencia | null,
  lat: lat?.toNumber() ?? null,
  lng: lng?.toNumber() ?? null,
  usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol.clave, ...telefonoDeContacto(usuario) },
});

export class PrismaEmergenciasRepository extends EmergenciasRepository {
  async crear(d: NuevaEmergencia, destinatarios: number[]) {
    const r = await getPrisma().emergencia.create({ data: { empresaId: empresaActual(), ...d, destinatarios }, select });
    return aRow(r);
  }

  async guardarDestinatarios(id: number, ids: number[]) {
    await getPrisma().emergencia.update({ where: { id }, data: { destinatarios: ids } });
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

  cadenaDe(personaId: number) {
    return cadenaDe(personaId);
  }

  rh() {
    return rhDeLaEmpresa();
  }

  admins() {
    return adminsActivos();
  }

  async nombreDe(usuarioId: number) {
    return (await getPrisma().usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } }))?.nombre ?? null;
  }

  async contactoDe(usuarioId: number) {
    const u = await getPrisma().usuario.findUnique({
      where: { id: usuarioId },
      select: { nombre: true, telefono: true, telefonoPersonal: true },
    });
    return u && { nombre: u.nombre, ...telefonoDeContacto(u) };
  }
}
