import type {
  CifradoCorreo,
  CorreoConfig,
  CorreoConfigInput,
  CorreoPruebaInput,
  ResultadoPruebaCorreo,
} from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, cifrarSecreto, descifrarSecreto, type AccionCtx } from '../../core';
import type { CorreoGuardado, CorreoRepository } from './correo.repository';
import {
  enviarPorSmtp,
  explicarErrorCorreo,
  type ConexionCorreo,
  type EnviarPorSmtp,
  type MensajeCorreo,
} from './transporte';

const VACIA: CorreoConfig = {
  configurado: false,
  host: '',
  puerto: 587,
  cifrado: 'starttls',
  usuario: '',
  tienePassword: false,
  remitenteNombre: 'Platinum Agency',
  remitenteCorreo: '',
  activo: false,
  actualizadoEn: null,
};

const vista = (g: CorreoGuardado): CorreoConfig => ({
  configurado: true,
  host: g.host,
  puerto: g.puerto,
  cifrado: g.cifrado as CifradoCorreo,
  usuario: g.usuario,
  tienePassword: !!g.passwordCifrada,
  remitenteNombre: g.remitenteNombre,
  remitenteCorreo: g.remitenteCorreo,
  activo: g.activo,
  actualizadoEn: g.updatedAt.toISOString(),
});

/** Correo saliente (A-87). La configuración vive en la base; sin ella (o apagada) la app no envía nada y sigue igual. */
export class CorreoService extends BaseService {
  constructor(
    private readonly repo: CorreoRepository,
    private readonly audit: AuditLogger,
    private readonly enviarSmtp: EnviarPorSmtp = enviarPorSmtp,
  ) {
    super();
  }

  async obtener(): Promise<CorreoConfig> {
    const g = await this.repo.obtener();
    return g ? vista(g) : VACIA;
  }

  async guardar(input: CorreoConfigInput, ctx: AccionCtx): Promise<CorreoConfig> {
    const actual = await this.repo.obtener();
    const nueva = input.password?.trim();
    const passwordCifrada = nueva ? cifrarSecreto(nueva) : (actual?.passwordCifrada ?? null);
    // Activar solo tiene sentido si, cuando el servidor pide usuario, ya hay contraseña.
    if (input.activo && input.usuario && !passwordCifrada) {
      throw HttpError.badRequest('Escribe la contraseña antes de activar el correo', [
        { path: 'password', message: 'Escribe la contraseña' },
      ]);
    }
    const guardado = await this.repo.guardar(
      {
        host: input.host,
        puerto: input.puerto,
        cifrado: input.cifrado,
        usuario: input.usuario,
        passwordCifrada,
        remitenteNombre: input.remitenteNombre,
        remitenteCorreo: input.remitenteCorreo,
        activo: input.activo,
      },
      ctx.actorId,
    );
    // La contraseña nunca va a la auditoría: solo se anota si se cambió.
    await this.audit.registrarAccion(ctx, 'correo.configurar', 'configuracion_correo', 1, {
      host: input.host,
      puerto: input.puerto,
      cifrado: input.cifrado,
      usuario: input.usuario,
      remitenteCorreo: input.remitenteCorreo,
      activo: input.activo,
      passwordCambiada: !!nueva,
    });
    return vista(guardado);
  }

  /** Envía una prueba con los datos del formulario (si dejó la contraseña vacía, con la guardada). */
  async probar(input: CorreoPruebaInput, ctx: AccionCtx): Promise<ResultadoPruebaCorreo> {
    const c = input.config;
    let password = c.password?.trim() || null;
    if (!password && c.usuario) {
      const guardada = (await this.repo.obtener())?.passwordCifrada;
      password = guardada ? descifrarSecreto(guardada) : null;
      if (!password) {
        return {
          enviado: false,
          detalle: guardada
            ? 'No se pudo leer la contraseña guardada. Escríbela de nuevo.'
            : 'Escribe la contraseña para probar.',
        };
      }
    }
    const resultado = await this.enviar(
      {
        host: c.host,
        puerto: c.puerto,
        cifrado: c.cifrado,
        usuario: c.usuario,
        password,
        remitenteNombre: c.remitenteNombre,
        remitenteCorreo: c.remitenteCorreo,
      },
      {
        para: input.para,
        asunto: 'Prueba de correo · Platinum Agency',
        texto: 'Si lees esto, el correo de la intranet de Platinum Agency está bien configurado. No tienes que responder.',
      },
    );
    await this.audit.registrarAccion(ctx, 'correo.prueba', 'configuracion_correo', 1, {
      para: input.para,
      enviado: resultado.enviado,
    });
    return resultado;
  }

  /**
   * Envía un correo con la configuración guardada: es lo que usarán las funciones que lo necesiten (recuperar contraseña,
   * avisos). Sin configurar o apagado devuelve `enviado: false` sin error: la app sigue igual.
   */
  async enviarCorreo(mensaje: MensajeCorreo): Promise<ResultadoPruebaCorreo> {
    const g = await this.repo.obtener();
    if (!g || !g.activo) return { enviado: false, detalle: 'El correo no está activado.' };
    const password = g.passwordCifrada ? descifrarSecreto(g.passwordCifrada) : null;
    if (g.usuario && !password) return { enviado: false, detalle: 'No se pudo leer la contraseña guardada.' };
    return this.enviar(
      {
        host: g.host,
        puerto: g.puerto,
        cifrado: g.cifrado as CifradoCorreo,
        usuario: g.usuario,
        password,
        remitenteNombre: g.remitenteNombre,
        remitenteCorreo: g.remitenteCorreo,
      },
      mensaje,
    );
  }

  private async enviar(conexion: ConexionCorreo, mensaje: MensajeCorreo): Promise<ResultadoPruebaCorreo> {
    try {
      await this.enviarSmtp(conexion, mensaje);
      return { enviado: true, detalle: `Correo enviado a ${mensaje.para}. Revisa su bandeja (y el spam).` };
    } catch (err) {
      this.log('No se pudo enviar el correo', { code: (err as { code?: string }).code });
      return { enviado: false, detalle: explicarErrorCorreo(err) };
    }
  }
}
