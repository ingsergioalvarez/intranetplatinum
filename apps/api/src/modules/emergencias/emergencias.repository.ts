import {
  ROLES,
  telefonoDeContacto,
  type ContactoTelefono,
  type Emergencia,
  type EstadoEmergencia,
  type ResultadoEmergencia,
  type TipoEmergencia,
} from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { adminsDe, type ContextoDueno } from '../avisos/duenos';
import { asignadaA } from '../clientes/clientes.repository';

export interface NuevaEmergencia {
  usuarioId: number;
  sitioId: number | null;
  lat?: number;
  lng?: number;
  precisionM?: number;
  bateria?: number;
}

export type EmergenciaRow = Omit<Emergencia, 'createdAt' | 'acusadaEn' | 'cerradaEn' | 'supervisor' | 'paraMi' | 'contactos'> & {
  /** Supervisor del sitio donde ocurrió (para mostrar su teléfono). */
  sitioSupervisorId: number | null;
  /** A quiénes se avisó (A-65). */
  destinatarios: number[];
  /** La lanzó el super admin. */
  lanzadaPorSuper: boolean;
  createdAt: Date;
  acusadaEn: Date | null;
  cerradaEn: Date | null;
};

/** Datos para llamar a una persona. */
export interface PersonaContacto {
  id: number;
  nombre: string;
  rol: string;
  telefono: string | null;
  telefonoPersonal: string | null;
}

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
  /** Admin dueño del guardia o del cliente del sitio (A-65). */
  abstract adminsDe(contexto: ContextoDueno): Promise<number[]>;
  /** Admin activo que es dueño de este usuario, o null (A-65). */
  abstract propietarioDe(usuarioId: number): Promise<number | null>;
  /** Supervisores que son de la cartera de este admin. */
  abstract supervisoresDe(adminId: number): Promise<number[]>;
  abstract superAdmins(): Promise<number[]>;
  abstract todosAdmins(): Promise<number[]>;
  abstract nombreDe(usuarioId: number): Promise<string | null>;
  /** Nombre y teléfono al que se le llama (personal, o el de contacto de la empresa). */
  abstract contactoDe(usuarioId: number): Promise<ContactoTelefono | null>;
  /** Cuentas activas del C2: reciben toda emergencia (A-61). */
  abstract usuariosC2(): Promise<number[]>;
  /** Nombre, rol y los dos teléfonos de cada persona. */
  abstract personasDe(ids: number[]): Promise<PersonaContacto[]>;
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
  sitio: { select: { id: true, nombre: true, supervisorId: true } },
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
  sitio: { id: number; nombre: string; supervisorId: number | null } | null;
};

const aRow = ({ usuario, lat, lng, destinatarios, sitio, ...r }: Fila): EmergenciaRow => ({
  ...r,
  sitio: sitio && { id: sitio.id, nombre: sitio.nombre },
  sitioSupervisorId: sitio?.supervisorId ?? null,
  destinatarios: Array.isArray(destinatarios) ? (destinatarios as number[]) : [],
  lanzadaPorSuper: usuario.esSuperAdmin,
  estado: r.estado as EstadoEmergencia,
  tipo: r.tipo as TipoEmergencia | null,
  resultado: r.resultado as ResultadoEmergencia | null,
  lat: lat?.toNumber() ?? null,
  lng: lng?.toNumber() ?? null,
  usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol.clave, ...telefonoDeContacto(usuario) },
});

const usuariosDeRol = async (rol: string) =>
  (
    await getPrisma().usuario.findMany({
      where: { activo: true, deletedAt: null, rol: { clave: rol } },
      select: { id: true },
    })
  ).map((u) => u.id);

export class PrismaEmergenciasRepository extends EmergenciasRepository {
  async crear(d: NuevaEmergencia, destinatarios: number[]) {
    const r = await getPrisma().emergencia.create({ data: { ...d, destinatarios }, select });
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

  adminsDe(contexto: ContextoDueno) {
    return adminsDe(contexto);
  }

  async propietarioDe(usuarioId: number) {
    const u = await getPrisma().usuario.findUnique({
      where: { id: usuarioId },
      select: { propietario: { select: { id: true, activo: true, deletedAt: true } } },
    });
    return u?.propietario && u.propietario.activo && !u.propietario.deletedAt ? u.propietario.id : null;
  }

  async supervisoresDe(adminId: number) {
    const rows = await getPrisma().usuario.findMany({
      where: { propietarioId: adminId, activo: true, deletedAt: null, rol: { clave: ROLES.SUPERVISOR } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async superAdmins() {
    const rows = await getPrisma().usuario.findMany({
      where: { esSuperAdmin: true, activo: true, deletedAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  todosAdmins() {
    return usuariosDeRol(ROLES.ADMIN);
  }

  async nombreDe(usuarioId: number) {
    return (await getPrisma().usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } }))?.nombre ?? null;
  }

  usuariosC2() {
    return usuariosDeRol(ROLES.C2);
  }

  async personasDe(ids: number[]) {
    if (ids.length === 0) return [];
    const rows = await getPrisma().usuario.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, telefono: true, telefonoPersonal: true, rol: { select: { clave: true } } },
    });
    return rows.map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol.clave, telefono: u.telefono, telefonoPersonal: u.telefonoPersonal }));
  }

  async contactoDe(usuarioId: number) {
    const u = await getPrisma().usuario.findUnique({
      where: { id: usuarioId },
      select: { nombre: true, telefono: true, telefonoPersonal: true },
    });
    return u && { nombre: u.nombre, ...telefonoDeContacto(u) };
  }
}
