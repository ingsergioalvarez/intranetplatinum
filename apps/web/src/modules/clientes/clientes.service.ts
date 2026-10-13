import type {
  Asignacion,
  AsignacionCreate,
  AsignacionUpdate,
  ClienteCreate,
  ClienteDetalle,
  ClienteResumen,
  ClienteUpdate,
  Contacto,
  ContactoInput,
  MiSitio,
  ReglasAviso,
  ReglasAvisoInput,
  Sitio,
  SitioInput,
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
  },
  asignaciones: (sitioId: number, historial = false) =>
    api.get<Asignacion[]>(`/sitios/${sitioId}/guardias`, { query: { historial } }),
  asignar: (sitioId: number, data: AsignacionCreate) =>
    api.post<Asignacion>(`/sitios/${sitioId}/guardias`, data),
  actualizarAsignacion: (sitioId: number, id: number, data: AsignacionUpdate) =>
    api.patch<Asignacion>(`/sitios/${sitioId}/guardias/${id}`, data),
  mios: () => api.get<MiSitio[]>('/sitios/mios'),
};
