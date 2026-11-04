import {
  ROLES,
  type EmpresaAdministrador,
  type EmpresaCreate,
  type EmpresaFiltro,
  type EmpresaUpdate,
} from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';

/** Empresa tal como se guarda. */
export interface EmpresaFila {
  id: number;
  nombre: string;
  razonSocial: string | null;
  rfc: string | null;
  calle: string | null;
  calle2: string | null;
  codigoPostal: string | null;
  ciudad: string | null;
  estado: string | null;
  pais: string | null;
  telefono: string | null;
  email: string | null;
  sitioWeb: string | null;
  zonaHoraria: string;
  moneda: string;
  colorModo: string;
  colorPrincipal: string | null;
  colorAcento: string | null;
  logoClave: string | null;
  activa: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmpresaConConteos extends EmpresaFila {
  modulosActivos: number;
  administradores: number;
}

/** Lo que se puede cambiar de una empresa: sus datos, su marca, su estado y su ícono. */
export type ActualizacionEmpresa = EmpresaUpdate & {
  colorModo?: string;
  colorPrincipal?: string | null;
  colorAcento?: string | null;
  activa?: boolean;
  logoClave?: string | null;
};

export interface AdministradorNuevo {
  empresaId: number;
  nombre: string;
  email: string;
  telefono: string | null;
  passwordHash: string;
}

/** Acceso a datos de la plataforma: empresas, sus módulos y sus administradores (C-07). */
export abstract class PlataformaRepository {
  abstract list(filtro: EmpresaFiltro): Promise<EmpresaConConteos[]>;
  abstract findById(id: number): Promise<EmpresaFila | null>;
  abstract create(data: EmpresaCreate): Promise<EmpresaFila>;
  abstract update(id: number, data: ActualizacionEmpresa): Promise<EmpresaFila>;
  /** Claves de los módulos opcionales encendidos. */
  abstract modulosEncendidos(empresaId: number): Promise<string[]>;
  /** Guarda el estado de los módulos indicados (los demás no se tocan). */
  abstract guardarModulos(empresaId: number, estado: Record<string, boolean>): Promise<void>;
  abstract administradores(empresaId: number): Promise<EmpresaAdministrador[]>;
  abstract emailExiste(email: string): Promise<boolean>;
  abstract crearAdministrador(data: AdministradorNuevo): Promise<EmpresaAdministrador>;
  /** Empresa a la que pertenece el usuario (null si es de la plataforma). */
  abstract empresaDe(usuarioId: number): Promise<number | null>;
}

const SELECT_ADMIN = {
  id: true,
  nombre: true,
  email: true,
  telefono: true,
  activo: true,
  esSuperAdmin: true,
  ultimoAcceso: true,
} as const;

const aAdministrador = (u: {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  esSuperAdmin: boolean;
  ultimoAcceso: Date | null;
}): EmpresaAdministrador => ({ ...u, ultimoAcceso: u.ultimoAcceso?.toISOString() ?? null });

export class PrismaPlataformaRepository extends PlataformaRepository {
  async list({ q, estado }: EmpresaFiltro) {
    const filas = await getPrisma().empresa.findMany({
      where: {
        ...(estado === 'activas' ? { activa: true } : estado === 'inactivas' ? { activa: false } : {}),
        ...(q ? { nombre: { contains: q } } : {}),
      },
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: {
            modulos: { where: { encendido: true } },
            usuarios: { where: { rol: { clave: ROLES.ADMIN }, deletedAt: null, activo: true } },
          },
        },
      },
    });
    return filas.map(({ _count, ...f }) => ({ ...f, modulosActivos: _count.modulos, administradores: _count.usuarios }));
  }

  findById(id: number) {
    return getPrisma().empresa.findUnique({ where: { id } });
  }

  create(data: EmpresaCreate) {
    return getPrisma().empresa.create({ data });
  }

  update(id: number, data: ActualizacionEmpresa) {
    return getPrisma().empresa.update({ where: { id }, data });
  }

  async modulosEncendidos(empresaId: number) {
    const filas = await getPrisma().empresaModulo.findMany({ where: { empresaId, encendido: true }, select: { modulo: true } });
    return filas.map((f) => f.modulo);
  }

  async guardarModulos(empresaId: number, estado: Record<string, boolean>) {
    const prisma = getPrisma();
    await prisma.$transaction(
      Object.entries(estado).map(([modulo, encendido]) =>
        prisma.empresaModulo.upsert({
          where: { empresaId_modulo: { empresaId, modulo } },
          update: { encendido },
          create: { empresaId, modulo, encendido },
        }),
      ),
    );
  }

  async administradores(empresaId: number) {
    const filas = await getPrisma().usuario.findMany({
      where: { empresaId, rol: { clave: ROLES.ADMIN }, deletedAt: null },
      orderBy: { nombre: 'asc' },
      select: SELECT_ADMIN,
    });
    return filas.map(aAdministrador);
  }

  async emailExiste(email: string) {
    return !!(await getPrisma().usuario.findUnique({ where: { email }, select: { id: true } }));
  }

  async crearAdministrador({ empresaId, nombre, email, telefono, passwordHash }: AdministradorNuevo) {
    const u = await getPrisma().usuario.create({
      data: {
        nombre,
        email,
        telefono,
        passwordHash,
        debeCambiarPassword: true,
        rol: { connect: { clave: ROLES.ADMIN } },
        empresa: { connect: { id: empresaId } },
      },
      select: SELECT_ADMIN,
    });
    return aAdministrador(u);
  }

  async empresaDe(usuarioId: number) {
    const u = await getPrisma().usuario.findUnique({ where: { id: usuarioId }, select: { empresaId: true } });
    return u?.empresaId ?? null;
  }
}
