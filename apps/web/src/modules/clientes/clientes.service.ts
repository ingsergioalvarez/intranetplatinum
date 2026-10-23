import type {
  Asignacion,
  AsignacionCreate,
  AsignacionUpdate,
  AsignarTurnoInput,
  ClienteCreate,
  ClienteDetalle,
  ClienteResumen,
  ClienteUpdate,
  Contacto,
  GuardiaDisponible,
  ContactoInput,
  MiSitio,
  ReglasAviso,
  ReglasAvisoInput,
  Sitio,
  SitioInput,
  SupervisorOpcion,
} from '@platinum/shared';
import { api, CrudService } from '../../core/api';

class ClientesService extends CrudService<ClienteResumen, ClienteCreate, ClienteUpdate> {
  /** Ficha completa: datos, contactos y sitios. */
  detalle(id: number) {
    return this.api.get<ClienteDetalle>(`${this.resource}/${id}`);
  }

  reglasAviso(clienteId: number, reglas: ReglasAvisoInput) {
    return this.api.put<ReglasAviso>(`${this.resource}/${clienteId}/avisos`, reglas);
  }

  crearContacto(clienteId: number, data: ContactoInput) {
    return this.api.post<Contacto>(`${this.resource}/${clienteId}/contactos`, data);
  }

  actualizarContacto(clienteId: number, id: number, data: ContactoInput) {
    return this.api.put<Contacto>(`${this.resource}/${clienteId}/contactos/${id}`, data);
  }

  eliminarContacto(clienteId: number, id: number) {
    return this.api.delete(`${this.resource}/${clienteId}/contactos/${id}`);
  }

  crearSitio(clienteId: number, data: SitioInput) {
    return this.api.post<Sitio>(`${this.resource}/${clienteId}/sitios`, data);
  }

  actualizarSitio(clienteId: number, id: number, data: SitioInput) {
    return this.api.put<Sitio>(`${this.resource}/${clienteId}/sitios/${id}`, data);
  }

  bajaSitio(clienteId: number, id: number) {
    return this.api.patch<void>(`${this.resource}/${clienteId}/sitios/${id}/baja`);
  }

  reactivarSitio(clienteId: number, id: number) {
    return this.api.patch<void>(`${this.resource}/${clienteId}/sitios/${id}/reactivar`);
  }
}

export const clientesService = new ClientesService(api, '/clientes');

/** Asignación de guardias a sitios y sitios del guardia en sesión. */
export const sitiosService = {
  keys: {
    all: ['sitios'] as const,
    guardias: (sitioId: number, historial: boolean) => ['sitios', sitioId, 'guardias', historial] as const,
    mios: ['sitios', 'mios'] as const,
    disponibles: ['sitios', 'guardias-disponibles'] as const,
    supervisores: ['sitios', 'supervisores'] as const,
  },
  asignaciones: (sitioId: number, historial = false) =>
    api.get<Asignacion[]>(`/sitios/${sitioId}/guardias`, { query: { historial } }),
  asignar: (sitioId: number, data: AsignacionCreate) =>
    api.post<Asignacion>(`/sitios/${sitioId}/guardias`, data),
  actualizarAsignacion: (sitioId: number, id: number, data: AsignacionUpdate) =>
    api.patch<Asignacion>(`/sitios/${sitioId}/guardias/${id}`, data),
  /** Cancela una asignación que aún no empieza. */
  cancelarAsignacion: (sitioId: number, id: number) => api.delete(`/sitios/${sitioId}/guardias/${id}`),
  /** Asigna un turno del catálogo a varios guardias y/o grupos (DA-37). */
  asignarTurno: (sitioId: number, data: AsignarTurnoInput) =>
    api.post<Asignacion[]>(`/sitios/${sitioId}/turnos`, data),
  /** Guardias activos con su foto y lo que ya tienen asignado. */
  guardiasDisponibles: () => api.get<GuardiaDisponible[]>('/sitios/guardias-disponibles'),
  mios: () => api.get<MiSitio[]>('/sitios/mios'),
  /** Supervisores que se pueden asignar a un sitio (DA-45). */
  supervisores: () => api.get<SupervisorOpcion[]>('/sitios/supervisores'),
  asignarSupervisor: (sitioId: number, supervisorId: number | null) =>
    api.put<void>(`/sitios/${sitioId}/supervisor`, { supervisorId }),
};
