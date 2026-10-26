import type {
  EstadoAsistencia,
  Jornada,
  Marcacion,
  AsistenciaGuardia,
  ConclusionIncidencia,
  CerrarJornadaInput,
  TableroAsistencia,
  DecisionFalta,
  EventoBitacora,
  IncidenciasDeGuardia,
  FilaAsistencia,
  IncidenciaRostro,
  MarcacionCreate,
  Paginated,
  ResultadoVerificacion,
  RostroPendiente,
  RostroRegistro,
} from '@platinum/shared';
import { api, type ListParams } from '../../core/api';

export const asistenciaService = {
  keys: {
    all: ['asistencia'] as const,
    estado: ['asistencia', 'estado'] as const,
    mias: (mes: string) => ['asistencia', 'mias', mes] as const,
    dia: (params: ListParams) => ['asistencia', 'dia', params] as const,
    guardia: (id: number, mes: string) => ['asistencia', 'guardia', id, mes] as const,
    rostro: (id: number) => ['asistencia', 'rostro', id] as const,
    pendientes: ['asistencia', 'rostros-pendientes'] as const,
    incidencias: (params: ListParams) => ['asistencia', 'incidencias', params] as const,
    incidencia: (id: number) => ['asistencia', 'incidencia', id] as const,
    tablero: ['asistencia', 'tablero'] as const,
    bitacora: (id: number, mes: string) => ['asistencia', 'bitacora', id, mes] as const,
    incidenciasPorGuardia: (mes: string) => ['asistencia', 'incidencias-guardias', mes] as const,
    incidenciasMes: (params: ListParams) => ['asistencia', 'incidencias-mes', params] as const,
  },
  estado: () => api.get<EstadoAsistencia>('/asistencia/estado'),
  /** Verificación en vivo del titular con la cámara abierta (DA-28). */
  verificarRostro: (descriptor: number[]) =>
    api
      .post<{ resultado: ResultadoVerificacion }>('/asistencia/verificar-rostro', { descriptor })
      .then((r) => r.resultado),
  /** Intento rechazado en la cámara (pantalla, no es el titular, gesto): foto y aviso al supervisor. */
  reportarIncidencia: (form: FormData) => api.upload<void>('/asistencia/incidencias', form),
  /** Comida (sin foto). */
  marcar: (data: MarcacionCreate) => api.post<Marcacion>('/asistencia/marcas', data),
  /** Entrada y salida: multipart con `foto` y `descriptor` (AS1-08). */
  marcarConFoto: (form: FormData) => api.upload<Marcacion>('/asistencia/marcas', form),
  mias: (mes: string) => api.get<Jornada[]>('/asistencia/mias', { query: { mes } }),
  /** Admin / supervisor (solo lectura): una fila por guardia del día. */
  dia: (params: ListParams) => api.get<Paginated<FilaAsistencia>>('/asistencia/dia', { query: params }),
  guardia: (id: number, mes: string) =>
    api.get<AsistenciaGuardia>(`/asistencia/guardias/${id}`, { query: { mes } }),
  /** Rostro registrado de un guardia (AS1-02). */
  rostro: (id: number) => api.get<RostroRegistro | null>(`/asistencia/rostros/${id}`),
  /** Solo admin: borra el rostro (y su historial) del guardia. */
  eliminarRostro: (id: number) => api.delete(`/asistencia/rostros/${id}`),
  registrarRostro: (id: number, form: FormData) =>
    api.upload<RostroRegistro>(`/asistencia/rostros/${id}`, form),
  /** El guardia registra su propio rostro la primera vez (queda pendiente de revisión). */
  autoregistrarRostro: (form: FormData) => api.upload<RostroRegistro>('/asistencia/mi-rostro', form),
  rostrosPendientes: () => api.get<RostroPendiente[]>('/asistencia/rostros/pendientes'),
  aprobarRostro: (id: number) => api.post<RostroRegistro>(`/asistencia/rostros/${id}/aprobar`),
  rechazarRostro: (id: number, motivo: string) =>
    api.post<RostroRegistro>(`/asistencia/rostros/${id}/rechazar`, { motivo }),
  /** Incidencias de rostro: intentos rechazados con su foto (DA-31). */
  incidencias: (params: ListParams) =>
    api.get<Paginated<IncidenciaRostro>>('/asistencia/incidencias', { query: params }),
  incidencia: (id: number) => api.get<IncidenciaRostro>(`/asistencia/incidencias/${id}`),
  revisarIncidencia: (id: number, conclusion: ConclusionIncidencia, nota: string) =>
    api.post<IncidenciaRostro>(`/asistencia/incidencias/${id}/revisar`, {
      conclusion,
      ...(nota && { nota }),
    }),
  /** Bitácora del guardia (DA-41): solo admin y supervisor. */
  bitacora: (id: number, mes: string) =>
    api.get<EventoBitacora[]>(`/bitacora/guardias/${id}`, { query: { mes } }),
  /** Incidencias del mes (DA-42): una fila por guardia, o todas con filtros. */
  incidenciasPorGuardia: (mes: string) =>
    api.get<IncidenciasDeGuardia[]>('/bitacora/incidencias/guardias', { query: { mes } }),
  incidenciasMes: (params: ListParams) =>
    api.get<Paginated<EventoBitacora>>('/bitacora/incidencias', { query: params }),
  comentarEvento: (id: number, texto: string) =>
    api.post<EventoBitacora>(`/bitacora/eventos/${id}/comentarios`, { texto }),
  /** Falta con llegada tarde: aceptar la asistencia o dejar la falta (DA-45). */
  /** Tablero del día para admin y supervisor (DA-51). */
  tablero: () => api.get<TableroAsistencia>('/asistencia/tablero'),
  /** Cerrar la jornada de un guardia que no pudo checar su salida (DA-49). */
  cerrarJornada: (entradaId: number, data: CerrarJornadaInput) =>
    api.post<void>(`/asistencia/jornadas/${entradaId}/cerrar`, data),
  decidirFalta: (id: number, decision: DecisionFalta) =>
    api.post<EventoBitacora>(`/bitacora/eventos/${id}/decidir`, { decision }),
  justificarEvento: (id: number, motivo: string) =>
    api.post<EventoBitacora>(`/bitacora/eventos/${id}/justificar`, { motivo }),
};
