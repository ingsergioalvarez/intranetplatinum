import {
  ROLES,
  type CarteraArbol,
  type PersonaCartera,
  type ResultadoTransferencia,
  type ResumenCarteras,
  type TransferirCarteraInput,
} from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, hoyISO, type AccionCtx } from '../../core';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type { CarterasRepository, DatosCartera } from './carteras.repository';

const persona = (u: DatosCartera['usuarios'][number]): PersonaCartera => ({
  id: u.id,
  nombre: u.nombre,
  rol: u.rol,
  activo: u.activo,
});

/**
 * Carteras de los admin (A-65): solo el super admin las ve y las pasa de un admin a otro. Al pasar un supervisor se
 * puede llevar también "lo que tiene detrás" (sus guardias, y los clientes y sitios que supervisa); al pasar un
 * cliente, sus accesos. Los avisos que seguían sin atender viajan con lo que se pasa.
 */
export class CarterasService extends BaseService {
  constructor(
    private readonly repo: CarterasRepository,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly hoy: () => string = () => hoyISO(),
  ) {
    super();
  }

  resumen(): Promise<ResumenCarteras> {
    return this.repo.resumen();
  }

  /** La cartera de un admin (o la de "sin asignar", con `null`) armada para elegir qué pasar. */
  async arbol(propietarioId: number | null): Promise<CarteraArbol> {
    const d = await this.repo.cartera(propietarioId, this.hoy());
    if (!d) throw HttpError.notFound('Administrador no encontrado');
    const guardiasDe = (sitioIds: Set<number>) => {
      const ids = new Set(d.asignaciones.filter((a) => sitioIds.has(a.sitioId)).map((a) => a.guardiaId));
      return d.usuarios.filter((u) => ids.has(u.id) && u.rol === ROLES.GUARDIA).map(persona);
    };
    const supervisores = d.usuarios
      .filter((u) => u.rol === ROLES.SUPERVISOR)
      .map((s) => {
        const sitios = d.sitios.filter((x) => x.supervisorId === s.id);
        const clienteIds = new Set(sitios.map((x) => x.clienteId));
        return {
          ...persona(s),
          guardias: guardiasDe(new Set(sitios.map((x) => x.id))),
          clientes: d.clientes.filter((c) => clienteIds.has(c.id)),
        };
      });
    const clientes = d.clientes.map((c) => ({
      ...c,
      sitios: d.sitios.filter((s) => s.clienteId === c.id).map(({ id, nombre }) => ({ id, nombre })),
      accesos: d.usuarios.filter((u) => u.clienteId === c.id).map(persona),
    }));
    const deCliente = new Set(d.clientes.map((c) => c.id));
    return {
      propietario: d.propietario,
      supervisores,
      clientes,
      guardias: d.usuarios.filter((u) => u.rol === ROLES.GUARDIA).map(persona),
      otros: d.usuarios
        .filter((u) => u.rol !== ROLES.SUPERVISOR && u.rol !== ROLES.GUARDIA && !(u.clienteId && deCliente.has(u.clienteId)))
        .map(persona),
      grupos: d.grupos,
      totales: { usuarios: d.usuarios.length, clientes: d.clientes.length, sitios: d.sitios.length, grupos: d.grupos.length },
    };
  }

  /**
   * Pasa lo elegido (o toda la cartera) del admin de origen al de destino. El destino debe ser un admin activo, o
   * `null` para dejarlo sin asignar. Se hace completo o no se hace; queda en la auditoría y se les avisa.
   */
  async transferir(input: TransferirCarteraInput, ctx: AccionCtx): Promise<ResultadoTransferencia> {
    const destino = input.destinoId === null ? null : await this.repo.admin(input.destinoId);
    if (input.destinoId !== null && (!destino || !destino.activo)) {
      throw HttpError.badRequest('Datos inválidos', [{ path: 'destinoId', message: 'Elige un administrador activo' }]);
    }
    const origen = await this.repo.cartera(input.origenId, this.hoy());
    if (!origen) throw HttpError.notFound('Administrador no encontrado');

    const usuarios = new Set(input.usuarioIds);
    const clientes = new Set(input.clienteIds);
    const grupos = new Set(input.grupoIds);
    if (input.todo) {
      origen.usuarios.forEach((u) => usuarios.add(u.id));
      origen.clientes.forEach((c) => clientes.add(c.id));
      origen.grupos.forEach((g) => grupos.add(g.id));
    }
    // Todo lo elegido debe ser de la cartera de origen: no se puede mover lo de otro.
    const suyos = {
      usuarios: new Set(origen.usuarios.map((u) => u.id)),
      clientes: new Set(origen.clientes.map((c) => c.id)),
      grupos: new Set(origen.grupos.map((g) => g.id)),
    };
    const fuera =
      [...usuarios].some((id) => !suyos.usuarios.has(id)) ||
      [...clientes].some((id) => !suyos.clientes.has(id)) ||
      [...grupos].some((id) => !suyos.grupos.has(id));
    if (fuera) throw HttpError.badRequest('Algo de lo elegido no es de la cartera de origen');

    if (input.cadena) this.completarCadena(origen, usuarios, clientes);

    if (usuarios.size + clientes.size + grupos.size === 0) throw HttpError.badRequest('No hay nada que pasar');
    await this.repo.mover({
      usuarioIds: [...usuarios],
      clienteIds: [...clientes],
      grupoIds: [...grupos],
      destinoId: input.destinoId,
    });

    const guardiaIds = origen.usuarios.filter((u) => usuarios.has(u.id) && u.rol === ROLES.GUARDIA).map((u) => u.id);
    const sitioIds = origen.sitios.filter((s) => clientes.has(s.clienteId)).map((s) => s.id);
    const avisos =
      input.destinoId === null
        ? 0
        : await this.repo.moverAvisosPendientes({
            desde: input.origenId,
            hacia: input.destinoId,
            guardiaIds,
            sitioIds,
          });

    const resultado = { usuarios: usuarios.size, clientes: clientes.size, grupos: grupos.size, avisos };
    await this.audit.registrarAccion(ctx, 'carteras.transferir', 'usuarios', input.origenId ?? 0, {
      origenId: input.origenId,
      destinoId: input.destinoId,
      usuarioIds: [...usuarios],
      clienteIds: [...clientes],
      grupoIds: [...grupos],
      avisos,
    });

    const resumen = `${resultado.usuarios} usuarios, ${resultado.clientes} clientes y ${resultado.grupos} grupos`;
    if (destino) {
      await this.avisar([destino.id], {
        tipo: 'asignacion',
        titulo: 'Te pasaron una cartera',
        mensaje: `Ahora administras ${resumen}${avisos ? ` y ${avisos} avisos pendientes` : ''}. Revisa Usuarios y Clientes`,
        ruta: '/usuarios',
      });
    }
    if (origen.propietario?.activo && origen.propietario.id !== ctx.actorId) {
      await this.avisar([origen.propietario.id], {
        tipo: 'asignacion',
        titulo: 'Cambió tu cartera',
        mensaje: `Se pasaron ${resumen} a ${destino ? destino.nombre : 'sin asignar'}`,
        ruta: '/usuarios',
      });
    }
    return resultado;
  }

  /**
   * Lo que viaja junto: de cada supervisor, sus guardias y los clientes (con sus sitios) que supervisa; de cada
   * cliente, los usuarios con acceso. Solo lo que es de la misma cartera.
   */
  private completarCadena(d: DatosCartera, usuarios: Set<number>, clientes: Set<number>) {
    for (const u of d.usuarios.filter((x) => usuarios.has(x.id) && x.rol === ROLES.SUPERVISOR)) {
      const sitios = d.sitios.filter((s) => s.supervisorId === u.id);
      sitios.forEach((s) => clientes.add(s.clienteId));
      const sitioIds = new Set(sitios.map((s) => s.id));
      const delSupervisor = new Set(d.asignaciones.filter((a) => sitioIds.has(a.sitioId)).map((a) => a.guardiaId));
      d.usuarios.filter((x) => x.rol === ROLES.GUARDIA && delSupervisor.has(x.id)).forEach((g) => usuarios.add(g.id));
    }
    for (const u of d.usuarios) if (u.clienteId && clientes.has(u.clienteId)) usuarios.add(u.id);
  }
}
