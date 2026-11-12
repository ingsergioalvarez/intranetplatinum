import { Router, type Request, type Response } from 'express';
import {
  PERMISOS,
  avisoSupervisorC2Schema,
  c2BitacoraQuerySchema,
  c2TableroQuerySchema,
  notaC2Schema,
  sitioC2ParamSchema,
  type AvisoSupervisorC2Input,
  type C2BitacoraQuery,
  type C2TableroQuery,
  type NotaC2Input,
} from '@platinum/shared';
import {
  BaseController,
  LocalStorageService,
  PrismaAuditLogger,
  authenticate,
  requirePermission,
  validate,
  type AppModule,
} from '../../core';
import { PrismaAsistenciaRepository } from '../asistencia/asistencia.repository';
import { AsistenciaService } from '../asistencia/asistencia.service';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { crearServicioEmergencias } from '../emergencias';
import { PrismaSitiosRepository } from '../sitios/sitios.repository';
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { C2Repository, PrismaC2Repository } from './c2.repository';
import { C2Service, type DiaDeAsistencia, type EmergenciasDelC2 } from './c2.service';

class C2Controller extends BaseController {
  constructor(
    private readonly service: C2Service,
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  tablero = async (req: Request, res: Response) => {
    const user = this.currentUser(req);
    return this.ok(res, await this.service.tablero(this.query<C2TableroQuery>(req), user, await this.alcanceDe(user)));
  };

  actividad = async (req: Request, res: Response) =>
    this.ok(res, await this.service.actividad(await this.alcanceDe(this.currentUser(req))));

  notas = async (req: Request, res: Response) =>
    this.ok(res, await this.service.notasDelDia(await this.alcanceDe(this.currentUser(req))));

  bitacora = async (req: Request, res: Response) =>
    this.ok(res, await this.service.bitacora(this.query<C2BitacoraQuery>(req), await this.alcanceDe(this.currentUser(req))));

  nota = async (req: Request, res: Response) => {
    const user = this.currentUser(req);
    await this.service.nota(this.params<{ sitioId: number }>(req).sitioId, this.body<NotaC2Input>(req), user, await this.alcanceDe(user));
    return this.created(res, { ok: true });
  };

  avisar = async (req: Request, res: Response) => {
    const user = this.currentUser(req);
    const r = await this.service.avisarSupervisor(
      this.params<{ sitioId: number }>(req).sitioId,
      this.body<AvisoSupervisorC2Input>(req),
      user,
      await this.alcanceDe(user),
    );
    return this.ok(res, r);
  };
}

export interface C2Deps {
  repo?: C2Repository;
  dia?: DiaDeAsistencia;
  emergencias?: EmergenciasDelC2;
  avisar?: AvisarUsuarios;
  alcance?: AlcanceFn;
  ahora?: () => Date;
}

/** El servicio con sus dependencias reales (lo usan las rutas y la vigilancia). */
export function crearServicioC2({
  repo = new PrismaC2Repository(),
  dia = diaDeAsistenciaConPrisma(),
  emergencias = (activas, user) => crearServicioEmergencias().listar(activas, user),
  avisar = avisarConPrisma,
  ahora,
}: C2Deps = {}) {
  return new C2Service(repo, dia, emergencias, avisar, ahora);
}

/** Asistencia del día de todos los guardias, sin límite de cartera. */
function diaDeAsistenciaConPrisma(): DiaDeAsistencia {
  const asistencia = new AsistenciaService(
    new PrismaAsistenciaRepository(),
    (usuarioId, hoy) => new PrismaSitiosRepository().misSitios(usuarioId, hoy),
    new LocalStorageService(),
    new PrismaAuditLogger(),
  );
  return async (fecha) => (await asistencia.dia({ fecha, page: 1, limit: 100_000 }, null)).items;
}

/**
 * Monitoreo del C2 (A-61): tabla de clientes y sitios con quién está y quién falta, y el historial de sitios solos.
 * Es de solo lectura. El C2 ve todos los sitios; un admin, los de su cartera.
 */
export function createC2Module(deps: C2Deps = {}): AppModule {
  const c = new C2Controller(crearServicioC2(deps), deps.alcance ?? alcanceConPrisma);
  const router = Router();
  router.use(authenticate);
  router.get('/tablero', requirePermission(PERMISOS.C2_VER), validate({ query: c2TableroQuerySchema }), c.tablero);
  // La bitácora y la actividad del C2 también las lee el supervisor (de sus sitios): solo lectura (A-82).
  const leerBitacora = requirePermission(PERMISOS.C2_BITACORA);
  router.get('/bitacora', leerBitacora, validate({ query: c2BitacoraQuerySchema }), c.bitacora);
  router.get('/actividad', leerBitacora, c.actividad);
  router.get('/notas', leerBitacora, c.notas);
  // Acciones del C2 sobre un sitio: quedan en la bitácora con quién las hizo.
  const actuar = requirePermission(PERMISOS.C2_ACTUAR);
  router.post('/sitios/:sitioId/nota', actuar, validate({ params: sitioC2ParamSchema, body: notaC2Schema }), c.nota);
  router.post('/sitios/:sitioId/avisar', actuar, validate({ params: sitioC2ParamSchema, body: avisoSupervisorC2Schema }), c.avisar);
  return { name: 'c2', basePath: 'c2', router };
}

export const c2Module = createC2Module();

/** Vigilancia (cada minuto): abre y cierra los episodios de sitios solos y avisa al C2. No se encima con la anterior. */
export function iniciarVigilanciaC2() {
  const servicio = crearServicioC2();
  let corriendo = false;
  const revisar = async () => {
    if (corriendo) return;
    corriendo = true;
    try {
      await servicio.vigilar();
    } catch (err) {
      console.error('[c2] Falló la revisión de sitios solos', err);
    } finally {
      corriendo = false;
    }
  };
  void revisar();
  return setInterval(() => void revisar(), 60_000);
}
