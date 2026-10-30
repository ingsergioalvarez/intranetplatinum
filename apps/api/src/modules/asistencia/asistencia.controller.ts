import type { Request, Response } from 'express';
import type {
  AsistenciaDiaQuery,
  CerrarJornadaBody,
  DecidirRetardoInput,
  ConclusionIncidencia,
  IdParam,
  IncidenciaCreateInput,
  IncidenciasQuery,
  MarcacionCreateData,
  RostroRegistroInput,
} from '@platinum/shared';
import { MOTIVO_SALIDA_SIN_MARCAR_LABEL, ROLES, textoMotivoLista } from '@platinum/shared';
import { BaseController, requestContext } from '../../core';
import type { AlcanceFn } from '../sitios/alcance';
import { fichaParaCliente, filaParaCliente } from './vista-cliente';
import type { ArchivoSubido } from './asistencia.service';
import type { AsistenciaService } from './asistencia.service';

export class AsistenciaController extends BaseController {
  constructor(
    private readonly service: AsistenciaService,
    /** Qué sitios y guardias ve quien consulta (supervisor: solo los suyos, DA-45). */
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  private alcance(req: Request) {
    return this.alcanceDe(this.currentUser(req));
  }

  estado = async (req: Request, res: Response) => {
    return this.ok(res, await this.service.estado(this.currentUser(req).id));
  };

  /** Comida: JSON. Entrada y salida: multipart con `foto` (AS1-08). */
  marcar = async (req: Request, res: Response) => {
    const marca = await this.service.marcar(
      this.currentUser(req).id,
      this.body<MarcacionCreateData>(req),
      req.file,
      requestContext(req),
    );
    return this.created(res, marca);
  };

  /** Verificación en vivo del titular mientras la cámara está abierta (DA-28). */
  verificarRostro = async (req: Request, res: Response) => {
    const { descriptor, conLentes } = this.body<{ descriptor: number[]; conLentes?: boolean }>(req);
    const resultado = await this.service.verificarRostro(this.currentUser(req).id, descriptor, conLentes);
    return this.ok(res, { resultado });
  };

  /** La cámara reporta un intento rechazado: pantalla, no es el titular o gesto no completado. */
  reportarIncidencia = async (req: Request, res: Response) => {
    await this.service.reportarIncidencia(
      this.currentUser(req).id,
      this.body<IncidenciaCreateInput>(req),
      req.file,
      requestContext(req),
    );
    return this.noContent(res);
  };

  incidencias = async (req: Request, res: Response) => {
    return this.paginated(
      res,
      await this.service.incidencias(this.query<IncidenciasQuery>(req), await this.alcance(req)),
    );
  };

  incidencia = async (req: Request, res: Response) => {
    return this.ok(res, await this.service.incidencia(this.params<IdParam>(req).id, await this.alcance(req)));
  };

  revisarIncidencia = async (req: Request, res: Response) => {
    return this.ok(
      res,
      await this.service.revisarIncidencia(
        this.params<IdParam>(req).id,
        this.body<{ conclusion: ConclusionIncidencia; nota?: string }>(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );
  };

  mias = async (req: Request, res: Response) => {
    const { mes } = this.query<{ mes: string }>(req);
    return this.ok(res, await this.service.misJornadas(this.currentUser(req).id, mes));
  };

  /** Tablero del día para admin y supervisor (DA-51). */
  tablero = async (req: Request, res: Response) => {
    return this.ok(res, await this.service.tablero(await this.alcance(req)));
  };

  /** Admin o supervisor cierran la jornada de un guardia que no pudo checar su salida (DA-49). */
  cerrarJornada = async (req: Request, res: Response) => {
    const { categoria, nota, salidaEn, medida } = this.body<CerrarJornadaBody>(req);
    return this.ok(
      res,
      await this.service.cerrarJornada(
        this.params<IdParam>(req).id,
        { motivo: textoMotivoLista(MOTIVO_SALIDA_SIN_MARCAR_LABEL[categoria], nota), salidaEn, medida },
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );
  };

  /** Aceptar el retardo o mandar al guardia a casa (A-25). */
  decidirRetardo = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.decidirRetardo(
        this.params<IdParam>(req).id,
        this.body<DecidirRetardoInput>(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  private esCliente(req: Request) {
    return this.currentUser(req).rol === ROLES.CLIENTE;
  }

  dia = async (req: Request, res: Response) => {
    const r = await this.service.dia(this.query<AsistenciaDiaQuery>(req), await this.alcance(req));
    // El cliente no recibe biometría (DA-48).
    return this.paginated(res, this.esCliente(req) ? { ...r, items: r.items.map(filaParaCliente) } : r);
  };

  guardia = async (req: Request, res: Response) => {
    const { mes } = this.query<{ mes: string }>(req);
    const alcance = await this.alcance(req);
    const ficha = await this.service.guardia(this.params<IdParam>(req).id, mes, alcance);
    return this.ok(res, this.esCliente(req) ? fichaParaCliente(ficha, alcance) : ficha);
  };

  rostro = async (req: Request, res: Response) => {
    return this.ok(res, await this.service.rostro(this.params<IdParam>(req).id, await this.alcance(req)));
  };

  eliminarRostro = async (req: Request, res: Response) => {
    await this.service.eliminarRostro(this.params<IdParam>(req).id, this.accionCtx(req));
    return this.noContent(res);
  };

  registrarRostro = async (req: Request, res: Response) => {
    const rostro = await this.service.registrarRostro(
      this.params<IdParam>(req).id,
      this.body<RostroRegistroInput>(req),
      req.files as ArchivoSubido[] | undefined,
      this.accionCtx(req),
      await this.alcance(req),
    );
    return this.created(res, rostro);
  };

  /** El guardia registra su propio rostro la primera vez (pendiente de revisión). */
  autoregistrarRostro = async (req: Request, res: Response) => {
    const rostro = await this.service.autoregistrarRostro(
      this.currentUser(req).id,
      this.body<RostroRegistroInput>(req),
      req.files as ArchivoSubido[] | undefined,
      requestContext(req),
    );
    return this.created(res, rostro);
  };

  rostrosPendientes = async (req: Request, res: Response) => {
    return this.ok(res, await this.service.rostrosPendientes(await this.alcance(req)));
  };

  aprobarRostro = async (req: Request, res: Response) => {
    return this.ok(
      res,
      await this.service.aprobarRostro(
        this.params<IdParam>(req).id,
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );
  };

  rechazarRostro = async (req: Request, res: Response) => {
    const { motivo } = this.body<{ motivo: string }>(req);
    return this.ok(
      res,
      await this.service.rechazarRostro(
        this.params<IdParam>(req).id,
        motivo,
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );
  };
}
