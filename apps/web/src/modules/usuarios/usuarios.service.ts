import type { Usuario, UsuarioConPassword, UsuarioCreate, UsuarioUpdate } from '@platinum/shared';
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
}

export const usuariosService = new UsuariosService(api, '/usuarios');
