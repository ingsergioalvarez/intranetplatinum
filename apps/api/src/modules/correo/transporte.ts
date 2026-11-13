import nodemailer from 'nodemailer';
import type { CifradoCorreo } from '@platinum/shared';

/** Datos listos para conectarse al servidor de correo (la contraseña ya descifrada). */
export interface ConexionCorreo {
  host: string;
  puerto: number;
  cifrado: CifradoCorreo;
  usuario: string;
  password: string | null;
  remitenteNombre: string;
  remitenteCorreo: string;
}

export interface MensajeCorreo {
  para: string;
  asunto: string;
  texto: string;
}

/** Envía un correo con la conexión dada. Lanza el error del servidor si no pudo (se traduce en el servicio). */
export type EnviarPorSmtp = (conexion: ConexionCorreo, mensaje: MensajeCorreo) => Promise<void>;

export const enviarPorSmtp: EnviarPorSmtp = async (c, m) => {
  const transporte = nodemailer.createTransport({
    host: c.host,
    port: c.puerto,
    secure: c.cifrado === 'ssl',
    requireTLS: c.cifrado === 'starttls',
    ignoreTLS: c.cifrado === 'ninguno',
    auth: c.usuario ? { user: c.usuario, pass: c.password ?? '' } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await transporte.sendMail({
      from: { name: c.remitenteNombre, address: c.remitenteCorreo },
      to: m.para,
      subject: m.asunto,
      text: m.texto,
    });
  } finally {
    transporte.close();
  }
};

/** Traduce el error de nodemailer a algo que el super admin entienda. */
export function explicarErrorCorreo(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  if (e.code === 'EAUTH' || e.responseCode === 535) return 'El servidor rechazó el usuario o la contraseña.';
  if (e.code === 'ENOTFOUND' || e.code === 'EDNS') return 'No se encontró el servidor. Revisa que el nombre esté bien escrito.';
  if (e.code === 'ECONNREFUSED') return 'El servidor no aceptó la conexión. Revisa el puerto y el cifrado.';
  if (e.code === 'ETIMEDOUT' || (e.code === 'ESOCKET' && /timeout/i.test(e.message ?? ''))) {
    return 'El servidor no respondió a tiempo. Revisa el nombre, el puerto y que el servidor tenga salida a internet.';
  }
  if (e.code === 'ECONNECTION' || e.code === 'ESOCKET') return 'No se pudo establecer la conexión segura. Prueba con otro cifrado o puerto.';
  if (e.code === 'EENVELOPE' || (e.responseCode && e.responseCode >= 500)) {
    return `El servidor no aceptó el correo (${e.responseCode ?? e.code}). Revisa que el remitente sea de un dominio permitido.`;
  }
  return 'No se pudo enviar el correo. Revisa los datos del servidor.';
}
