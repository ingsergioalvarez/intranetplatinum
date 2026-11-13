import { getPrisma } from '../../core/data/prisma';

export interface CorreoGuardado {
  host: string;
  puerto: number;
  cifrado: string;
  usuario: string;
  passwordCifrada: string | null;
  remitenteNombre: string;
  remitenteCorreo: string;
  activo: boolean;
  updatedAt: Date;
}

export type CorreoParaGuardar = Omit<CorreoGuardado, 'updatedAt'>;

export abstract class CorreoRepository {
  abstract obtener(): Promise<CorreoGuardado | null>;
  abstract guardar(datos: CorreoParaGuardar, actorId: number): Promise<CorreoGuardado>;
}

const FILA = 1;

export class PrismaCorreoRepository extends CorreoRepository {
  async obtener() {
    return getPrisma().configuracionCorreo.findUnique({ where: { id: FILA } });
  }

  async guardar(datos: CorreoParaGuardar, actorId: number) {
    return getPrisma().configuracionCorreo.upsert({
      where: { id: FILA },
      create: { id: FILA, ...datos, actualizadoPor: actorId },
      update: { ...datos, actualizadoPor: actorId },
    });
  }
}
