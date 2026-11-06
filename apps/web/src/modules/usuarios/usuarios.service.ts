import type { Permiso, Usuario, UsuarioConPassword, UsuarioCreate, UsuarioUpdate } from '@platinum/shared';
import { api, CrudService } from '../../core/api';

class UsuariosService extends CrudService<Usuario, UsuarioCreate, UsuarioUpdate> {
  /** Alta: devuelve la contraseña temporal, que solo se muestra una vez (D-012). */
  crear(data: UsuarioCreate) {
    return this.api.post<UsuarioConPassword>(this.resource, data);
  }

  /** Genera una contraseña temporal nueva y cierra las sesiones del usuario. */
  resetPassword(id: number) {
    return this.api.post<UsuarioConPassword>(`${this.resource}/${id}/reset-password`);
  }

  /** Guarda los permisos individuales adicionales de una persona (C-11 parte 5). */
  fijarPermisos(id: number, permisos: Permiso[]) {
    return this.api.put<Usuario>(`${this.resource}/${id}/permisos`, { permisos });
  }
}

export const usuariosService = new UsuariosService(api, '/usuarios');
