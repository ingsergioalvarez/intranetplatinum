import type { Request, Response } from 'express';
import type {
  AccesoClienteData,
  ClienteCreateData,
  ClienteFiltro,
  ContactoData,
  IdParam,
  ReglasAviso,
  SitioData,
} from '@platinum/shared';
import { BaseController } from '../../core';
import type { ClienteUpdateData } from './clientes.repository';
import type { ClientesService } from './clientes.service';

type ContactoParams = { id: number; contactoId: number };
type SitioParams = { id: number; sitioId: number };

export class ClientesController extends BaseController {
  constructor(private readonly service: ClientesService) {
    super();
  }

  list = async (req: Request, res: Response) =>
    this.paginated(res, await this.service.list(this.query<ClienteFiltro>(req)));

  get = async (req: Request, res: Response) =>
    this.ok(res, await this.service.getDetalle(this.params<IdParam>(req).id));

  create = async (req: Request, res: Response) =>
    this.created(res, await this.service.crear(this.body<ClienteCreateData>(req), this.accionCtx(req)));

  update = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.actualizar(
        this.params<IdParam>(req).id,
        this.body<ClienteUpdateData>(req),
        this.accionCtx(req),
      ),
    );

  baja = async (req: Request, res: Response) => {
    await this.service.darDeBaja(this.params<IdParam>(req).id, this.accionCtx(req));
    return this.noContent(res);
  };

  reactivar = async (req: Request, res: Response) => {
    await this.service.reactivar(this.params<IdParam>(req).id, this.accionCtx(req));
    return this.noContent(res);
  };

  reglasAviso = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.actualizarReglasAviso(
        this.params<IdParam>(req).id,
        this.body<ReglasAviso>(req),
        this.accionCtx(req),
      ),
    );

  // ----- Acceso del cliente -----

  createAcceso = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.crearAcceso(
        this.params<IdParam>(req).id,
        this.body<AccesoClienteData>(req),
        this.accionCtx(req),
      ),
    );

  accesosDisponibles = async (_req: Request, res: Response) =>
    this.ok(res, await this.service.listarClientesDisponibles());

  // ----- Contactos -----

  createContacto = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.crearContacto(
        this.params<IdParam>(req).id,
        this.body<ContactoData>(req),
        this.accionCtx(req),
      ),
    );

  updateContacto = async (req: Request, res: Response) => {
    const { id, contactoId } = this.params<ContactoParams>(req);
    return this.ok(
      res,
      await this.service.actualizarContacto(
        id,
        contactoId,
        this.body<ContactoData>(req),
        this.accionCtx(req),
      ),
    );
  };

  deleteContacto = async (req: Request, res: Response) => {
    const { id, contactoId } = this.params<ContactoParams>(req);
    await this.service.eliminarContacto(id, contactoId, this.accionCtx(req));
    return this.noContent(res);
  };

  // ----- Sitios -----

  createSitio = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.crearSitio(
        this.params<IdParam>(req).id,
        this.body<SitioData>(req),
        this.accionCtx(req),
      ),
    );

  updateSitio = async (req: Request, res: Response) => {
    const { id, sitioId } = this.params<SitioParams>(req);
    return this.ok(
      res,
      await this.service.actualizarSitio(id, sitioId, this.body<SitioData>(req), this.accionCtx(req)),
    );
  };

  bajaSitio = async (req: Request, res: Response) => {
    const { id, sitioId } = this.params<SitioParams>(req);
    await this.service.darDeBajaSitio(id, sitioId, this.accionCtx(req));
    return this.noContent(res);
  };

  reactivarSitio = async (req: Request, res: Response) => {
    const { id, sitioId } = this.params<SitioParams>(req);
    await this.service.reactivarSitio(id, sitioId, this.accionCtx(req));
    return this.noContent(res);
  };
}
