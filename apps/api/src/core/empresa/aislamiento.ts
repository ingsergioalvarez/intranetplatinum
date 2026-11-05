import { Prisma } from '../../generated/prisma/client';
import { HttpError } from '../errors/HttpError';
import { empresaOpcional, esContextoGlobal } from './contexto';

/**
 * Aislamiento de datos por empresa (C-08, DC-014). Una sola regla, aplicada a TODA consulta de las tablas con
 * `empresa_id`, en lugar de acordarse de filtrar en cada repositorio:
 *   - lecturas y modificaciones: se limitan a la empresa de la sesión;
 *   - altas: deben traer la empresa de la sesión (nunca otra);
 *   - nadie puede mover un registro de una empresa a otra;
 *   - sin empresa en el contexto se niega (falla cerrada), salvo operaciones declaradas `sinFiltroDeEmpresa`.
 * Las tablas sin empresa (roles, permisos, tokens de sesión, empresas) no se tocan. La prueba "vigilante" verifica que
 * esta lista coincida con `schema.prisma`.
 */
export const MODELOS_CON_EMPRESA: ReadonlySet<string> = new Set([
  'Usuario',
  'Area',
  'Auditoria',
  'Cliente',
  'ClienteContacto',
  'Sitio',
  'SitioGuardia',
  'GrupoGuardias',
  'GrupoIntegrante',
  'CategoriaReporte',
  'FolioReporte',
  'Reporte',
  'ReporteSeguimiento',
  'ReporteEvidencia',
  'ReporteCliente',
  'Notificacion',
  'ClienteReglaAviso',
  'Aviso',
  'SuscripcionPush',
  'Marcacion',
  'RostroGuardia',
  'IncidenciaRostro',
  'Turno',
  'EventoBitacora',
  'ComentarioBitacora',
  'TurnoDia',
  'Cobertura',
  'AvisoEnviado',
  'InformeAsistencia',
  'CambioTurno',
  'PausaTurno',
  'CasoCobertura',
  'HoraExtra',
  'MedidaDisciplinaria',
  'DispositivoUsuario',
  'SolicitudCobertura',
  'Ausencia',
  'Emergencia',
]);

/**
 * Tablas que NO llevan empresa, cada una por una razón. Toda tabla del esquema debe estar en una lista o en la otra:
 * la prueba "vigilante" falla si alguien agrega una tabla y se olvida de decidir.
 */
export const MODELOS_SIN_EMPRESA: Readonly<Record<string, string>> = {
  Rol: 'Catálogo global de roles; por empresa llega con C-11',
  Permiso: 'Catálogo global de permisos',
  RolPermiso: 'Relación global rol-permiso; por empresa llega con C-11',
  Empresa: 'Es la propia empresa',
  EmpresaModulo: 'Pertenece a una empresa por su propia llave; solo la toca la plataforma',
  RefreshToken: 'Se busca por el hash del token, antes de saber la empresa',
  PasswordReset: 'Se busca por el hash del token, antes de saber la empresa',
};

/** Tablas donde `empresa_id` puede ser null (eventos de plataforma o anónimos). Solo la auditoría. */
export const MODELOS_CON_EMPRESA_OPCIONAL: ReadonlySet<string> = new Set(['Auditoria']);

const CON_FILTRO = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);
const ALTAS = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);

const noCoincide = () =>
  new HttpError(403, 'EMPRESA_NO_COINCIDE', 'La operación intenta usar datos de otra empresa');

type Args = Record<string, unknown>;
type Registro = Record<string, unknown> | undefined | null;

/** Empresa que trae un registro a crear: `empresaId` o `empresa: { connect: { id } }`. */
const empresaDe = (d: Registro): number | null | undefined => {
  if (!d) return undefined;
  if ('empresaId' in d) return d.empresaId as number | null | undefined;
  const conectada = (d.empresa as { connect?: { id?: number } } | undefined)?.connect?.id;
  return conectada;
};

const mueveDeEmpresa = (d: Registro) => !!d && (d.empresaId !== undefined || d.empresa !== undefined);

function validarAlta(model: string, d: Registro, empresaId: number) {
  const trae = empresaDe(d);
  if (trae === null && MODELOS_CON_EMPRESA_OPCIONAL.has(model)) return;
  if (trae !== empresaId) throw noCoincide();
}

export interface ContextoAislamiento {
  /** La operación se declaró fuera de cualquier empresa (plataforma, inicio de sesión): sin filtro. */
  global: boolean;
  empresaId: number | null;
}

/**
 * Devuelve los argumentos de la consulta ya acotados a la empresa del contexto, o lanza si la operación no es válida.
 * Es una función pura: la extensión de Prisma solo la llama.
 */
export function prepararArgs(model: string, operation: string, args: unknown, ctx: ContextoAislamiento): unknown {
  if (!MODELOS_CON_EMPRESA.has(model) || ctx.global) return args;
  if (ctx.empresaId === null) throw new HttpError(401, 'SIN_EMPRESA', 'Vuelve a iniciar sesión');
  const empresaId = ctx.empresaId;
  const a: Args = { ...((args as Args | undefined) ?? {}) };

  if (CON_FILTRO.has(operation)) {
    // La condición de empresa se suma (Y) a cualquier otra, y la de la sesión manda sobre la que venga.
    a.where = { ...((a.where as Args | undefined) ?? {}), empresaId };
  }

  if (ALTAS.has(operation)) {
    if (operation === 'upsert') {
      validarAlta(model, a.create as Registro, empresaId);
    } else {
      const data = a.data as Registro | Registro[];
      for (const d of Array.isArray(data) ? data : [data]) validarAlta(model, d, empresaId);
    }
  }

  if (operation === 'update' || operation === 'updateMany' || operation === 'updateManyAndReturn') {
    if (mueveDeEmpresa(a.data as Registro)) throw noCoincide();
  }
  if (operation === 'upsert' && mueveDeEmpresa(a.update as Registro)) throw noCoincide();

  return a;
}

/** Extensión de Prisma: aplica `prepararArgs` a todas las consultas con la empresa del contexto de la petición. */
export const extensionEmpresa = Prisma.defineExtension({
  name: 'aislamiento-por-empresa',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        return query(
          prepararArgs(model, operation, args, { global: esContextoGlobal(), empresaId: empresaOpcional() }) as typeof args,
        );
      },
    },
  },
});
