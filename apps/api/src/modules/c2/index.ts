import { Router, type Request, type Response } from 'express';
import {
  PERMISOS,
  c2HistorialQuerySchema,
  c2TableroQuerySchema,
  type C2HistorialQuery,
  type C2TableroQuery,
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

  historial = async (req: Request, res: Response) =>
    this.ok(res, await this.service.historial(this.query<C2HistorialQuery>(req), await this.alcanceDe(this.currentUser(req))));
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
  router.get('/historial', requirePermission(PERMISOS.C2_VER), validate({ query: c2HistorialQuerySchema }), c.historial);
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
