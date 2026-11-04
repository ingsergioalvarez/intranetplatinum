import type {
  Empresa,
  EmpresaAdminCreate,
  EmpresaAdministrador,
  EmpresaCreate,
  EmpresaMarca,
  EmpresaResumen,
  EmpresaUpdate,
  EstadoModulos,
} from '@platinum/shared';
import { api } from '../../core/api';

export type EstadoEmpresas = 'activas' | 'inactivas' | 'todas';

/** Plataforma (C-07): empresas, su marca, sus módulos y sus administradores. Solo el super admin. */
export const plataformaService = {
  keys: {
    all: ['plataforma'] as const,
    empresas: (estado: EstadoEmpresas, q: string) => ['plataforma', 'empresas', estado, q] as const,
    empresa: (id: number) => ['plataforma', 'empresa', id] as const,
    modulos: (id: number) => ['plataforma', 'empresa', id, 'modulos'] as const,
    administradores: (id: number) => ['plataforma', 'empresa', id, 'administradores'] as const,
  },
  listar: (estado: EstadoEmpresas, q?: string) =>
    api.get<EmpresaResumen[]>('/plataforma/empresas', { query: { estado, q } }),
  obtener: (id: number) => api.get<Empresa>(`/plataforma/empresas/${id}`),
  crear: (data: EmpresaCreate) => api.post<Empresa>('/plataforma/empresas', data),
  actualizar: (id: number, data: EmpresaUpdate) => api.patch<Empresa>(`/plataforma/empresas/${id}`, data),
  marca: (id: number, data: EmpresaMarca) => api.patch<Empresa>(`/plataforma/empresas/${id}/marca`, data),
  subirLogo: (id: number, archivo: File) => {
    const form = new FormData();
    form.append('logo', archivo);
    return api.upload<Empresa>(`/plataforma/empresas/${id}/logo`, form);
  },
  quitarLogo: (id: number) => api.delete<Empresa>(`/plataforma/empresas/${id}/logo`),
  desactivar: (id: number) => api.patch<Empresa>(`/plataforma/empresas/${id}/baja`),
  reactivar: (id: number) => api.patch<Empresa>(`/plataforma/empresas/${id}/reactivar`),
  modulos: (id: number) => api.get<{ modulos: EstadoModulos }>(`/plataforma/empresas/${id}/modulos`),
  guardarModulos: (id: number, modulos: Record<string, boolean>) =>
    api.put<{ modulos: EstadoModulos }>(`/plataforma/empresas/${id}/modulos`, { modulos }),
  administradores: (id: number) => api.get<EmpresaAdministrador[]>(`/plataforma/empresas/${id}/administradores`),
  crearAdministrador: (id: number, data: EmpresaAdminCreate) =>
    api.post<{ usuario: EmpresaAdministrador; passwordTemporal: string }>(
      `/plataforma/empresas/${id}/administradores`,
      data,
    ),
};
