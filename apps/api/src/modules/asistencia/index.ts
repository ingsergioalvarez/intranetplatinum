import { Router } from 'express';
import {
  MUESTRAS_ROSTRO_MAX,
  PERMISOS,
  ROLES,
  asistenciaDiaQuerySchema,
  cerrarJornadaSchema,
  decidirRetardoSchema,
  idParamSchema,
  incidenciaCreateSchema,
  incidenciasQuerySchema,
  marcacionCreateSchema,
  misMarcasQuerySchema,
  rechazoRostroSchema,
  revisarIncidenciaSchema,
  rostroRegistroSchema,
  verificacionRostroSchema,
} from '@platinum/shared';
import {
  AuditLogger,
  LocalStorageService,
  PrismaAuditLogger,
  StorageService,
  authenticate,
  paraCadaEmpresa,
  requirePermission,
  requireRoles,
  uploadImages,
  validate,
  type AppModule,
} from '../../core';
import { getPrisma } from '../../core/data/prisma';
import { bitacoraConPrisma, type RegistrarBitacora } from '../bitacora/registrar';
import { avisarConPrisma } from '../avisos/avisar';
import { atencionConPrisma, type AvisosAtencion } from '../avisos/atencion';
import { crearServicioEmergencias } from '../emergencias';
import { crearServicioSolicitudes } from '../solicitudes-cobertura';
import type { SolicitudesPuerto } from '../solicitudes-cobertura/solicitudes.service';
import { medidasConPrisma, type MedidasPuerto } from '../medidas/medidas';
import { PrismaRecordatoriosIncidenciasRepository, RecordatorioIncidencias } from '../bitacora/recordatorios';
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { crearServicioCasos } from '../casos-cobertura';
import { crearAvisosHuecos } from '../cobertura';
import { crearServicioHorasExtra } from '../horas-extra';
import { sinHorasExtra, type HorasExtraPuerto } from '../horas-extra/puerto';
import { PrismaSitiosRepository } from '../sitios/sitios.repository';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaRepository, PrismaAsistenciaRepository } from './asistencia.repository';
import { AsistenciaService, type LlegadaFn, type MisSitiosFn } from './asistencia.service';
import { VigilanciaTurnos } from './vigilancia';
import { RecordatoriosComida } from './comidas';
import { RecordatorioSitioSolo } from './sitioSolo';
import {
  PrismaComidasRepository,
  PrismaSitioSoloRepository,
  PrismaVigilanciaRepository,
} from './vigilancia.repository';

interface AsistenciaModuleDeps {
  repo?: AsistenciaRepository;
  misSitios?: MisSitiosFn;
  storage?: StorageService;
  audit?: AuditLogger;
  ahora?: () => Date;
  hoy?: () => string;
  bitacora?: RegistrarBitacora;
  alcance?: AlcanceFn;
  llegada?: LlegadaFn;
  /** Horas extra (AS5); en pruebas, sin ellas. */
  extras?: HorasExtraPuerto;
  /** Medidas disciplinarias (A-49); en pruebas, sin ellas. */
  medidas?: MedidasPuerto;
  /** Avisos que se actualizan al atenderse (A-54); en pruebas, sin ellos. */
  atencion?: AvisosAtencion;
  /** Solicitudes de cobertura (A-39); en pruebas, sin ellas. */
  solicitudes?: SolicitudesPuerto;
}

/**
 * Control de asistencia (A-17): el guardia marca y consulta las suyas; admin/supervisor
 * consultan todas y registran rostros.
 */
export function createAsistenciaModule({
  repo = new PrismaAsistenciaRepository(),
  misSitios = (usuarioId, hoy) => new PrismaSitiosRepository().misSitios(usuarioId, hoy),
  storage = new LocalStorageService(),
  audit = new PrismaAuditLogger(),
  ahora,
  hoy,
  bitacora = bitacoraConPrisma,
  alcance = alcanceConPrisma,
  llegada = (usuarioId, guardia, entrada) =>
    new VigilanciaTurnos(new PrismaVigilanciaRepository(), avisarConPrisma).alLlegar(
      usuarioId,
      guardia,
      entrada,
    ),
  extras = sinHorasExtra,
  medidas = medidasConPrisma,
  atencion = atencionConPrisma,
  solicitudes = crearServicioSolicitudes(),
}: AsistenciaModuleDeps = {}): AppModule {
  const c = new AsistenciaController(
    new AsistenciaService(repo, misSitios, storage, audit, ahora, hoy, bitacora, llegada, extras, medidas, atencion, solicitudes),
    alcance,
  );
  const marcar = requirePermission(PERMISOS.ASISTENCIA_MARCAR);
  const ver = requirePermission(PERMISOS.ASISTENCIA_VER);
  const rostros = requirePermission(PERMISOS.ASISTENCIA_ROSTROS);
  // Una sola foto; en peticiones JSON (comida) multer no hace nada.
  const foto = uploadImages.single('foto');
  // Fotos del registro de rostro (una por muestra).
  const fotosRostro = uploadImages.array('fotos', MUESTRAS_ROSTRO_MAX);

  const router = Router();
  router.use(authenticate);
  // Guardia
  router.get('/estado', marcar, c.estado);
  router.post('/marcas', marcar, foto, validate({ body: marcacionCreateSchema }), c.marcar);
  // Verificación en vivo del titular con la cámara abierta (DA-28) e intentos rechazados (DA-31).
  router.post('/verificar-rostro', marcar, validate({ body: verificacionRostroSchema }), c.verificarRostro);
  router.post('/incidencias', marcar, foto, validate({ body: incidenciaCreateSchema }), c.reportarIncidencia);
  router.get('/mias', marcar, validate({ query: misMarcasQuerySchema }), c.mias);
  // Primer registro de su rostro, una sola vez (queda pendiente de revisión).
  router.post(
    '/mi-rostro',
    marcar,
    fotosRostro,
    validate({ body: rostroRegistroSchema }),
    c.autoregistrarRostro,
  );
  // Admin / supervisor: solo lectura (DA-08)
  router.get('/dia', ver, validate({ query: asistenciaDiaQuerySchema }), c.dia);
  router.get(
    '/guardias/:id',
    ver,
    validate({ params: idParamSchema, query: misMarcasQuerySchema }),
    c.guardia,
  );
  // Tablero del día (DA-51): quién no llegó, jornadas sin cerrar, comidas sin cierre.
  router.get('/tablero', requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.JEFE), ver, c.tablero);
  // Cerrar la jornada de un guardia que no pudo checar su salida (DA-49).
  router.post(
    '/jornadas/:id/cerrar',
    requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.JEFE),
    ver,
    validate({ params: idParamSchema, body: cerrarJornadaSchema }),
    c.cerrarJornada,
  );
  // Ante un retardo: aceptarlo o mandar al guardia a casa (A-25). Justificar sigue en la bitácora.
  router.post(
    '/retardos/:id/decidir',
    requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.JEFE),
    ver,
    validate({ params: idParamSchema, body: decidirRetardoSchema }),
    c.decidirRetardo,
  );
  // Rostros de los guardias (AS1-02): revisión del autoregistro y registro en persona.
  router.get('/rostros/pendientes', rostros, c.rostrosPendientes);
  router.get('/rostros/:id', rostros, validate({ params: idParamSchema }), c.rostro);
  router.post(
    '/rostros/:id',
    rostros,
    fotosRostro,
    validate({ params: idParamSchema, body: rostroRegistroSchema }),
    c.registrarRostro,
  );
  // Incidencias de rostro: intentos rechazados con su foto (DA-31).
  router.get('/incidencias', rostros, validate({ query: incidenciasQuerySchema }), c.incidencias);
  router.get('/incidencias/:id', rostros, validate({ params: idParamSchema }), c.incidencia);
  router.post(
    '/incidencias/:id/revisar',
    rostros,
    validate({ params: idParamSchema, body: revisarIncidenciaSchema }),
    c.revisarIncidencia,
  );
  router.post('/rostros/:id/aprobar', rostros, validate({ params: idParamSchema }), c.aprobarRostro);
  router.post(
    '/rostros/:id/rechazar',
    rostros,
    validate({ params: idParamSchema, body: rechazoRostroSchema }),
    c.rechazarRostro,
  );

  // Borrar rostros: solo el admin (no el supervisor).
  router.delete(
    '/rostros/:id',
    requireRoles(ROLES.ADMIN),
    validate({ params: idParamSchema }),
    c.eliminarRostro,
  );

  return { name: 'asistencia', basePath: 'asistencia', router };
}

export const asistenciaModule = createAsistenciaModule({ extras: crearServicioHorasExtra() });

/**
 * Revisa cada minuto los turnos que empezaron sin entrada (DA-45): avisos y faltas; y las comidas
 * (DA-47). Una revisión no
 * empieza si la anterior sigue corriendo. Sin petición no hay empresa de la sesión: se recorre cada empresa activa
 * por separado y, si una falla, las demás siguen (C-08).
 */
export function iniciarVigilanciaTurnos() {
  const vigilancia = new VigilanciaTurnos(new PrismaVigilanciaRepository(), avisarConPrisma);
  const comidas = new RecordatoriosComida(new PrismaComidasRepository(), avisarConPrisma, bitacoraConPrisma);
  const horasExtra = crearServicioHorasExtra();
  const huecos = crearAvisosHuecos();
  const casos = crearServicioCasos();
  const sitioSolo = new RecordatorioSitioSolo(new PrismaSitioSoloRepository(), avisarConPrisma, bitacoraConPrisma);
  const incidencias = new RecordatorioIncidencias(new PrismaRecordatoriosIncidenciasRepository(), avisarConPrisma);
  const solicitudes = crearServicioSolicitudes();
  const emergencias = crearServicioEmergencias();
  let corriendo = false;
  const revisarEmpresa = async () => {
    await vigilancia.revisar();
    await comidas.revisar();
    await horasExtra.revisar();
    await huecos.revisar();
    await casos.revisar();
    await sitioSolo.revisar();
    await incidencias.revisar();
    await solicitudes.recordar();
    await emergencias.escalar();
  };
  const revisar = async () => {
    if (corriendo) return;
    corriendo = true;
    try {
      const empresas = await getPrisma().empresa.findMany({ where: { activa: true }, select: { id: true } });
      const errores = await paraCadaEmpresa(
        empresas.map((e) => e.id),
        revisarEmpresa,
      );
      for (const { empresaId, error } of errores) {
        console.error(`[vigilancia] Falló la revisión de turnos (empresa ${empresaId})`, error);
      }
    } catch (err) {
      console.error('[vigilancia] Falló la revisión de turnos', err);
    } finally {
      corriendo = false;
    }
  };
  void revisar();
  return setInterval(() => void revisar(), 60_000);
}
