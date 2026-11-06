import { tituloDeAviso, type Aviso } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { firmarArchivo } from '../../core';

/** Avisos en la app (la campanita). */
export abstract class AvisosRepository {
  abstract listar(usuarioId: number, limite: number): Promise<Aviso[]>;
  abstract contarNoLeidos(usuarioId: number): Promise<number>;
  /** Devuelve false si el aviso no existe o es de otro usuario. */
  abstract marcarLeido(id: number, usuarioId: number): Promise<boolean>;
  abstract marcarTodos(usuarioId: number): Promise<void>;
}

export class PrismaAvisosRepository extends AvisosRepository {
  async listar(usuarioId: number, limite: number): Promise<Aviso[]> {
    const rows = await getPrisma().aviso.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: {
        id: true,
        tipo: true,
        titulo: true,
        mensaje: true,
        ruta: true,
        fotoClave: true,
        leidoEn: true,
        atendidoEn: true,
        atendidoPor: true,
        resultado: true,
        createdAt: true,
      },
    });
    return rows.map(({ leidoEn, createdAt, fotoClave, titulo, atendidoEn, atendidoPor, resultado, ...a }) => ({
      ...a,
      titulo: tituloDeAviso(a.tipo, titulo),
      foto: fotoClave ? firmarArchivo(fotoClave) : null,
      leido: leidoEn !== null,
      atendido: atendidoEn ? { por: atendidoPor, en: atendidoEn.toISOString(), resultado: resultado ?? 'Atendido' } : null,
      createdAt: createdAt.toISOString(),
    }));
  }

  contarNoLeidos(usuarioId: number) {
    return getPrisma().aviso.count({ where: { usuarioId, leidoEn: null } });
  }

  async marcarLeido(id: number, usuarioId: number) {
    const { count } = await getPrisma().aviso.updateMany({
      where: { id, usuarioId },
      data: { leidoEn: new Date() },
    });
    return count > 0;
  }

  async marcarTodos(usuarioId: number) {
    await getPrisma().aviso.updateMany({
      where: { usuarioId, leidoEn: null },
      data: { leidoEn: new Date() },
    });
  }
}
