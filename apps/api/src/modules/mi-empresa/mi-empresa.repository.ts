import { getPrisma } from '../../core/data/prisma';
import { sinFiltroDeEmpresa } from '../../core';

export class MiEmpresaRepository {
  /** `empresas` es global (no lleva empresa_id); se lee sin filtro. */
  findEmpresa(id: number) {
    return sinFiltroDeEmpresa(() => getPrisma().empresa.findUnique({ where: { id } }));
  }
}
