import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { cifrarSecreto, descifrarSecreto, signAccessToken } from '../src/core';
import { createCorreoModule } from '../src/modules/correo';
import { CorreoRepository, type CorreoGuardado, type CorreoParaGuardar } from '../src/modules/correo/correo.repository';
import { CorreoService } from '../src/modules/correo/correo.service';
import type { ConexionCorreo, MensajeCorreo } from '../src/modules/correo/transporte';
import { MemoryAuditLogger } from './helpers/memoryAudit';

class Memoria extends CorreoRepository {
  fila: CorreoGuardado | null = null;
  async obtener() {
    return this.fila;
  }
  async guardar(d: CorreoParaGuardar) {
    this.fila = { ...d, updatedAt: new Date('2026-11-15T10:00:00Z') };
    return this.fila;
  }
}

const token = (id: number, rol: Rol, extra: { esSuperAdmin?: boolean } = {}) =>
  `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol, permisos: PERMISOS_POR_ROL[rol], ...extra })}`;
const SUPER = token(1, ROLES.ADMIN, { esSuperAdmin: true });

const config = {
  host: 'smtp.ejemplo.com',
  puerto: 587,
  cifrado: 'starttls',
  usuario: 'notificaciones@platinum.mx',
  password: 'S3cretaLarga',
  remitenteNombre: 'Grupo Platinum',
  remitenteCorreo: 'no-responder@platinum.mx',
  activo: true,
};

describe('cifrado de secretos (A-87)', () => {
  it('se descifra con el mismo secreto y no con otro', () => {
    const c = cifrarSecreto('hola', 'x'.repeat(40));
    expect(c).not.toContain('hola');
    expect(descifrarSecreto(c, 'x'.repeat(40))).toBe('hola');
    expect(descifrarSecreto(c, 'y'.repeat(40))).toBeNull();
    expect(descifrarSecreto('basura')).toBeNull();
  });

  it('cada cifrado es distinto aunque el texto sea el mismo', () => {
    expect(cifrarSecreto('igual')).not.toBe(cifrarSecreto('igual'));
  });
});

describe('correo saliente (A-87)', () => {
  let repo: Memoria;
  let audit: MemoryAuditLogger;
  let enviados: { conexion: ConexionCorreo; mensaje: MensajeCorreo }[];
  let fallo: unknown;
  let app: ReturnType<typeof createApp>;

  const enviarSmtp = async (conexion: ConexionCorreo, mensaje: MensajeCorreo) => {
    if (fallo) throw fallo;
    enviados.push({ conexion, mensaje });
  };

  beforeEach(() => {
    repo = new Memoria();
    audit = new MemoryAuditLogger();
    enviados = [];
    fallo = undefined;
    app = createApp([createCorreoModule({ repo, audit, enviarSmtp })]);
  });

  it('solo el super admin entra', async () => {
    for (const t of [token(2, ROLES.ADMIN), token(3, ROLES.SUPERVISOR), token(4, ROLES.GUARDIA), token(5, ROLES.CLIENTE)]) {
      expect((await request(app).get('/api/correo').set('Authorization', t)).status).toBe(403);
      expect((await request(app).put('/api/correo').set('Authorization', t).send(config)).status).toBe(403);
      expect(
        (await request(app).post('/api/correo/prueba').set('Authorization', t).send({ para: 'a@b.mx', config })).status,
      ).toBe(403);
    }
    expect((await request(app).get('/api/correo')).status).toBe(401);
    expect(repo.fila).toBeNull();
  });

  it('sin configurar devuelve una ficha vacía y apagada', async () => {
    const r = await request(app).get('/api/correo').set('Authorization', SUPER);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ configurado: false, activo: false, tienePassword: false, puerto: 587, cifrado: 'starttls' });
  });

  it('guarda cifrando la contraseña y nunca la devuelve ni la audita', async () => {
    const r = await request(app).put('/api/correo').set('Authorization', SUPER).send(config);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ configurado: true, activo: true, tienePassword: true, host: 'smtp.ejemplo.com' });
    expect(JSON.stringify(r.body)).not.toContain('S3cretaLarga');
    expect(repo.fila?.passwordCifrada).toBeTruthy();
    expect(repo.fila?.passwordCifrada).not.toContain('S3cretaLarga');
    expect(descifrarSecreto(repo.fila!.passwordCifrada!)).toBe('S3cretaLarga');
    const ev = audit.eventos.find((e) => e.accion === 'correo.configurar');
    expect(ev?.datos).toMatchObject({ passwordCambiada: true, activo: true });
    expect(JSON.stringify(audit.eventos)).not.toContain('S3cretaLarga');
    const g = await request(app).get('/api/correo').set('Authorization', SUPER);
    expect(JSON.stringify(g.body)).not.toContain('passwordCifrada');
    expect(g.body.data.tienePassword).toBe(true);
  });

  it('con la contraseña vacía conserva la guardada', async () => {
    await request(app).put('/api/correo').set('Authorization', SUPER).send(config);
    const antes = repo.fila!.passwordCifrada;
    const r = await request(app)
      .put('/api/correo')
      .set('Authorization', SUPER)
      .send({ ...config, password: '', host: 'otro.ejemplo.com' });
    expect(r.status).toBe(200);
    expect(repo.fila?.host).toBe('otro.ejemplo.com');
    expect(repo.fila?.passwordCifrada).toBe(antes);
    expect(audit.eventos.filter((e) => e.accion === 'correo.configurar')[1].datos).toMatchObject({ passwordCambiada: false });
  });

  it('no se puede activar sin contraseña si el servidor pide usuario, pero sí guardar apagado', async () => {
    const sinPass = { ...config, password: undefined };
    const activar = await request(app).put('/api/correo').set('Authorization', SUPER).send(sinPass);
    expect(activar.status).toBe(400);
    expect(activar.body.error.details[0].path).toBe('password');
    expect(repo.fila).toBeNull();
    const apagado = await request(app).put('/api/correo').set('Authorization', SUPER).send({ ...sinPass, activo: false });
    expect(apagado.status).toBe(200);
    expect(apagado.body.data).toMatchObject({ activo: false, tienePassword: false });
    // Un servidor sin usuario (relay interno) sí puede activarse sin contraseña.
    const relay = await request(app).put('/api/correo').set('Authorization', SUPER).send({ ...sinPass, usuario: '' });
    expect(relay.status).toBe(200);
  });

  it('valida los campos', async () => {
    const r = await request(app)
      .put('/api/correo')
      .set('Authorization', SUPER)
      .send({ ...config, host: '', puerto: 70000, cifrado: 'raro', remitenteCorreo: 'no-es-correo' });
    expect(r.status).toBe(400);
    expect(r.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['host', 'puerto', 'cifrado', 'remitenteCorreo']),
    );
  });

  it('la prueba usa los datos del formulario aunque no estén guardados', async () => {
    const r = await request(app).post('/api/correo/prueba').set('Authorization', SUPER).send({ para: 'Yo@Platinum.mx', config });
    expect(r.status).toBe(200);
    expect(r.body.data.enviado).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].conexion).toMatchObject({ host: 'smtp.ejemplo.com', puerto: 587, password: 'S3cretaLarga' });
    expect(enviados[0].mensaje.para).toBe('yo@platinum.mx');
    expect(repo.fila).toBeNull();
    expect(audit.acciones()).toContain('correo.prueba');
  });

  it('la prueba con la contraseña vacía usa la guardada; si no hay, lo dice', async () => {
    const sinPass = { ...config, password: '' };
    const antes = await request(app).post('/api/correo/prueba').set('Authorization', SUPER).send({ para: 'a@b.mx', config: sinPass });
    expect(antes.body.data).toMatchObject({ enviado: false, detalle: 'Escribe la contraseña para probar.' });
    expect(enviados).toHaveLength(0);
    await request(app).put('/api/correo').set('Authorization', SUPER).send(config);
    const despues = await request(app).post('/api/correo/prueba').set('Authorization', SUPER).send({ para: 'a@b.mx', config: sinPass });
    expect(despues.body.data.enviado).toBe(true);
    expect(enviados[0].conexion.password).toBe('S3cretaLarga');
  });

  it('un error del servidor se explica en palabras claras', async () => {
    const casos: [unknown, RegExp][] = [
      [{ code: 'EAUTH' }, /usuario o la contraseña/],
      [{ code: 'ENOTFOUND' }, /No se encontró el servidor/],
      [{ code: 'ECONNREFUSED' }, /puerto y el cifrado/],
      [{ code: 'ETIMEDOUT' }, /no respondió a tiempo/],
      [new Error('algo raro'), /No se pudo enviar/],
    ];
    for (const [err, texto] of casos) {
      fallo = err;
      const r = await request(app).post('/api/correo/prueba').set('Authorization', SUPER).send({ para: 'a@b.mx', config });
      expect(r.status).toBe(200);
      expect(r.body.data.enviado).toBe(false);
      expect(r.body.data.detalle).toMatch(texto);
    }
  });

  it('enviarCorreo no hace nada (ni falla) si está sin configurar o apagado, y envía si está activo', async () => {
    const servicio = new CorreoService(repo, audit, enviarSmtp);
    const m = { para: 'a@b.mx', asunto: 'Hola', texto: 'Texto' };
    expect(await servicio.enviarCorreo(m)).toMatchObject({ enviado: false });
    await request(app).put('/api/correo').set('Authorization', SUPER).send({ ...config, activo: false });
    expect(await servicio.enviarCorreo(m)).toMatchObject({ enviado: false });
    expect(enviados).toHaveLength(0);
    await request(app).put('/api/correo').set('Authorization', SUPER).send(config);
    expect(await servicio.enviarCorreo(m)).toMatchObject({ enviado: true });
    expect(enviados[0].conexion.password).toBe('S3cretaLarga');
    fallo = { code: 'EAUTH' };
    expect(await servicio.enviarCorreo(m)).toMatchObject({ enviado: false });
  });
});
