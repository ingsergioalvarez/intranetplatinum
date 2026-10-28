import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, type PayloadPush } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import { createPushModule } from '../src/modules/push';
import {
  PushRepository,
  type NuevaSuscripcion,
  type SuscripcionRow,
} from '../src/modules/push/push.repository';
import { PushService, type EnviadorPush } from '../src/modules/push/push.service';

class MemoriaPush extends PushRepository {
  filas: (SuscripcionRow & { userAgent?: string | null })[] = [];
  private id = 0;

  async guardar(usuarioId: number, s: NuevaSuscripcion) {
    const i = this.filas.findIndex((f) => f.endpoint === s.endpoint);
    if (i >= 0) this.filas[i] = { ...this.filas[i], usuarioId, p256dh: s.p256dh, auth: s.auth };
    else this.filas.push({ id: ++this.id, usuarioId, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, userAgent: s.userAgent });
  }
  async quitar(usuarioId: number, endpoint: string) {
    this.filas = this.filas.filter((f) => !(f.endpoint === endpoint && f.usuarioId === usuarioId));
  }
  async quitarPorId(id: number) {
    this.filas = this.filas.filter((f) => f.id !== id);
  }
  async deUsuarios(ids: number[]) {
    return this.filas.filter((f) => ids.includes(f.usuarioId));
  }
}

const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p256dh-de-prueba', auth: 'auth-de-prueba' } };

let repo: MemoriaPush;
let enviados: { endpoint: string; payload: PayloadPush }[];
let respuesta: 'ok' | 'expirada' | Error;
let service: PushService;

const enviador: EnviadorPush = {
  async enviar(s, payload) {
    if (respuesta instanceof Error) throw respuesta;
    enviados.push({ endpoint: s.endpoint, payload: JSON.parse(payload) });
    return respuesta;
  },
};

beforeEach(() => {
  repo = new MemoriaPush();
  enviados = [];
  respuesta = 'ok';
  service = new PushService(repo, enviador, 'clave-publica');
});

describe('push: enviar avisos al celular (A-20)', () => {
  it('manda el aviso a todos los celulares del usuario, con título por tipo y la pantalla a abrir', async () => {
    await service.suscribir(10, SUB);
    await service.suscribir(10, { ...SUB, endpoint: 'https://fcm.googleapis.com/fcm/send/otro' });
    await service.suscribir(11, { ...SUB, endpoint: 'https://fcm.googleapis.com/fcm/send/ajeno' });
    await service.enviar([10, 10], { tipo: 'horas_extra', mensaje: 'POETAS: Marca tu salida', ruta: '/marcar' });
    expect(enviados).toHaveLength(2);
    expect(enviados[0].payload).toEqual({
      titulo: 'Horas extra',
      cuerpo: 'POETAS: Marca tu salida',
      ruta: '/marcar',
      tipo: 'horas_extra',
    });
  });

  it('un aviso de reporte abre el reporte; sin ruta abre el inicio; el texto se recorta', async () => {
    await service.suscribir(10, SUB);
    await service.enviar([10], { tipo: 'reporte_nuevo', mensaje: 'x'.repeat(300), reporteId: 42 });
    await service.enviar([10], { tipo: 'retardo', mensaje: 'Llegó tarde' });
    expect(enviados[0].payload.ruta).toBe('/reportes/42');
    expect(enviados[0].payload.cuerpo).toHaveLength(160);
    expect(enviados[1].payload.ruta).toBe('/');
  });

  it('si el celular ya no existe se borra su suscripción; los demás siguen recibiendo', async () => {
    await service.suscribir(10, SUB);
    respuesta = 'expirada';
    await service.enviar([10], { tipo: 'retardo', mensaje: 'a' });
    expect(repo.filas).toEqual([]);
  });

  it('un fallo al mandar no rompe nada ni borra la suscripción', async () => {
    await service.suscribir(10, SUB);
    respuesta = new Error('sin red');
    await expect(service.enviar([10], { tipo: 'retardo', mensaje: 'a' })).resolves.toBeUndefined();
    expect(repo.filas).toHaveLength(1);
  });

  it('sin claves en el servidor el push está apagado y no manda nada', async () => {
    const apagado = new PushService(repo, null, null);
    await apagado.suscribir(10, SUB);
    await apagado.enviar([10], { tipo: 'retardo', mensaje: 'a' });
    expect(enviados).toEqual([]);
    expect(apagado.clave()).toEqual({ publicKey: null });
  });

  it('el mismo celular que entra con otro usuario pasa a ese usuario', async () => {
    await service.suscribir(10, SUB);
    await service.suscribir(11, SUB);
    expect(repo.filas).toHaveLength(1);
    expect(repo.filas[0].usuarioId).toBe(11);
  });
});

describe('push: rutas', () => {
  const token = (id: number) =>
    `Bearer ${signAccessToken({ id, email: 'x@x.mx', rol: ROLES.GUARDIA, permisos: PERMISOS_POR_ROL[ROLES.GUARDIA] })}`;
  const app = () => createApp([createPushModule({ service })]);

  it('exige sesión', async () => {
    expect((await request(app()).get('/api/push/clave')).status).toBe(401);
    expect((await request(app()).post('/api/push/suscripciones').send(SUB)).status).toBe(401);
  });

  it('da la clave pública, guarda y quita la suscripción del propio usuario', async () => {
    const clave = await request(app()).get('/api/push/clave').set('Authorization', token(10));
    expect(clave.body.data).toEqual({ publicKey: 'clave-publica' });

    const alta = await request(app()).post('/api/push/suscripciones').set('Authorization', token(10)).set('User-Agent', 'Chrome Android').send(SUB);
    expect(alta.status).toBe(204);
    expect(repo.filas).toMatchObject([{ usuarioId: 10, endpoint: SUB.endpoint, userAgent: 'Chrome Android' }]);

    // Otro usuario no puede quitar la suscripción de este.
    await request(app()).delete('/api/push/suscripciones').set('Authorization', token(11)).send({ endpoint: SUB.endpoint });
    expect(repo.filas).toHaveLength(1);
    const baja = await request(app()).delete('/api/push/suscripciones').set('Authorization', token(10)).send({ endpoint: SUB.endpoint });
    expect(baja.status).toBe(204);
    expect(repo.filas).toEqual([]);
  });

  it('rechaza una suscripción inválida', async () => {
    const res = await request(app()).post('/api/push/suscripciones').set('Authorization', token(10)).send({ endpoint: 'no-es-url', keys: {} });
    expect(res.status).toBe(400);
  });
});
