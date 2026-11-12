import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISOS_POR_ROL, ROLES, TIPS, tipPorId, type PayloadPush, type Rol } from '@platinum/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/core';
import { createPushModule } from '../src/modules/push';
import {
  PushRepository,
  type NuevaSuscripcion,
  type SuscripcionRow,
  type TelefonoRow,
} from '../src/modules/push/push.repository';
import { turnoDeTip } from '../src/modules/push/tips';
import { PushService, type EnviadorPush } from '../src/modules/push/push.service';

const NOMBRES: Record<number, string> = { 10: 'Juan Pérez', 11: 'Sofía Ramos', 12: 'Cris Cliente' };
const ROL_DE: Record<number, Rol> = { 10: ROLES.GUARDIA, 11: ROLES.SUPERVISOR, 12: ROLES.CLIENTE };

interface Fila {
  id: number;
  usuarioId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  /** Perfil rápido de esa cuenta en este celular; null = solo mientras tenga la sesión abierta. */
  dispositivoId: number | null;
}

/** Perfiles rápidos revocados (un perfil quitado deja de contar). */
const revocados = new Set<number>();

class MemoriaPush extends PushRepository {
  filas: Fila[] = [];
  reservados = new Set<string>();
  private id = 0;

  private vigente = (f: Fila) => f.dispositivoId === null || !revocados.has(f.dispositivoId);

  async guardar(usuarioId: number, s: NuevaSuscripcion, dispositivoId: number | null = null) {
    const i = this.filas.findIndex((f) => f.endpoint === s.endpoint && f.usuarioId === usuarioId);
    if (i >= 0) this.filas[i] = { ...this.filas[i], p256dh: s.p256dh, auth: s.auth, dispositivoId };
    else this.filas.push({ id: ++this.id, usuarioId, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, userAgent: s.userAgent, dispositivoId });
    // Las demás cuentas sin perfil rápido vigente en este celular se sueltan.
    this.filas = this.filas.filter((f) => f.endpoint !== s.endpoint || f.usuarioId === usuarioId || (f.dispositivoId !== null && !revocados.has(f.dispositivoId)));
  }
  async quitar(usuarioId: number, endpoint: string) {
    this.filas = this.filas.filter((f) => !(f.endpoint === endpoint && f.usuarioId === usuarioId));
  }
  async quitarPorId(id: number) {
    this.filas = this.filas.filter((f) => f.id !== id);
  }
  async deUsuarios(ids: number[]): Promise<SuscripcionRow[]> {
    return this.filas
      .filter((f) => ids.includes(f.usuarioId) && this.vigente(f))
      .map((f) => ({
        id: f.id,
        usuarioId: f.usuarioId,
        nombre: NOMBRES[f.usuarioId],
        endpoint: f.endpoint,
        p256dh: f.p256dh,
        auth: f.auth,
        compartida: new Set(this.filas.filter((g) => g.endpoint === f.endpoint && this.vigente(g)).map((g) => g.usuarioId)).size > 1,
      }));
  }
  async telefonos(): Promise<TelefonoRow[]> {
    const por = new Map<string, TelefonoRow>();
    for (const f of this.filas.filter((g) => this.vigente(g))) {
      const rol = ROL_DE[f.usuarioId];
      const t = por.get(f.endpoint);
      if (!t) por.set(f.endpoint, { id: f.id, endpoint: f.endpoint, p256dh: f.p256dh, auth: f.auth, roles: [rol] });
      else if (!t.roles.includes(rol)) t.roles.push(rol);
    }
    return [...por.values()];
  }
  async reservarTip(slot: string) {
    if (this.reservados.has(slot)) return false;
    this.reservados.add(slot);
    return true;
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
  revocados.clear();
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

  it('usa el título propio del aviso (A-22) y, si no trae, el genérico del tipo', async () => {
    await service.suscribir(10, SUB);
    await service.enviar([10], { tipo: 'asignacion', titulo: 'Ya no supervisas un sitio', mensaje: 'Ya no supervisas poetas 7' });
    await service.enviar([10], { tipo: 'asignacion', titulo: '   ', mensaje: 'Sin título útil' });
    await service.enviar([10], { tipo: 'asignacion', mensaje: 'Sin título' });
    expect(enviados.map((e) => e.payload.titulo)).toEqual([
      'Ya no supervisas un sitio',
      'Tu sitio y horario',
      'Tu sitio y horario',
    ]);
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

  it('el mismo celular que entra con otro usuario pasa a ese usuario si el anterior no lo tenía guardado', async () => {
    await service.suscribir(10, SUB);
    await service.suscribir(11, SUB);
    expect(repo.filas).toHaveLength(1);
    expect(repo.filas[0].usuarioId).toBe(11);
  });
});

describe('push: celular con varias cuentas guardadas (A-77)', () => {
  const guardado = (id: number) => ({ ...SUB, dispositivoId: id });

  it('con perfil rápido las dos cuentas siguen ligadas al celular, aunque entre otra', async () => {
    await service.suscribir(10, guardado(1));
    await service.suscribir(11, guardado(2));
    expect(repo.filas.map((f) => f.usuarioId).sort()).toEqual([10, 11]);
  });

  it('en un celular compartido el aviso dice "para NOMBRE" y no enseña el contenido', async () => {
    await service.suscribir(10, guardado(1));
    await service.suscribir(11, guardado(2));
    await service.enviar([10], { tipo: 'retardo', mensaje: 'Juan llegó tarde a POETAS 7', ruta: '/asistencia' });
    expect(enviados).toHaveLength(1);
    expect(enviados[0].payload).toEqual({
      titulo: 'Platinum · para Juan',
      cuerpo: 'Tienes un aviso nuevo',
      ruta: '/asistencia',
      tipo: 'retardo',
      para: 10,
    });
    expect(JSON.stringify(enviados[0].payload)).not.toContain('POETAS');
  });

  it('cada cuenta recibe lo suyo en el mismo celular, sin mezclar', async () => {
    await service.suscribir(10, guardado(1));
    await service.suscribir(11, guardado(2));
    await service.enviar([10, 11], { tipo: 'retardo', mensaje: 'x' });
    expect(enviados.map((e) => e.payload.para).sort()).toEqual([10, 11]);
    expect(enviados.map((e) => e.payload.titulo).sort()).toEqual(['Platinum · para Juan', 'Platinum · para Sofía']);
  });

  it('una emergencia conserva su título para que se note, pero tampoco enseña los datos', async () => {
    await service.suscribir(10, guardado(1));
    await service.suscribir(11, guardado(2));
    await service.enviar([11], { tipo: 'emergencia', titulo: 'EMERGENCIA', mensaje: 'Juan pidió ayuda en POETAS 7', urgente: true });
    expect(enviados[0].payload.titulo).toBe('EMERGENCIA · para Sofía');
    expect(enviados[0].payload.cuerpo).toBe('Abre la app para ver los datos de la alerta');
    expect(enviados[0].payload.urgente).toBe(true);
    expect(enviados[0].payload.para).toBe(11);
  });

  it('con una sola cuenta nada cambia: contenido completo y sin "para"', async () => {
    await service.suscribir(10, guardado(1));
    await service.enviar([10], { tipo: 'horas_extra', mensaje: 'POETAS: Marca tu salida', ruta: '/marcar' });
    expect(enviados[0].payload).toEqual({ titulo: 'Horas extra', cuerpo: 'POETAS: Marca tu salida', ruta: '/marcar', tipo: 'horas_extra' });
  });

  it('quitar el perfil rápido de una cuenta deja de mandarle avisos ahí y el celular deja de ser compartido', async () => {
    await service.suscribir(10, guardado(1));
    await service.suscribir(11, guardado(2));
    revocados.add(1);
    await service.enviar([10, 11], { tipo: 'retardo', mensaje: 'Contenido visible' });
    expect(enviados).toHaveLength(1);
    expect(enviados[0].payload).toMatchObject({ cuerpo: 'Contenido visible' });
    expect(enviados[0].payload.para).toBeUndefined();
  });

  it('una cuenta sin perfil rápido que cierra sesión (se quita) deja de recibir; la guardada sigue', async () => {
    await service.suscribir(10, guardado(1));
    await service.suscribir(11, SUB); // sin perfil guardado: solo con sesión abierta
    expect(repo.filas.map((f) => f.usuarioId)).toEqual([10, 11]);
    await service.quitar(11, { endpoint: SUB.endpoint });
    expect(repo.filas.map((f) => f.usuarioId)).toEqual([10]);
  });

  it('una cuenta sin perfil guardado se suelta cuando otra entra en el mismo celular', async () => {
    await service.suscribir(10, SUB); // sin perfil guardado
    await service.suscribir(11, guardado(2));
    expect(repo.filas.map((f) => f.usuarioId)).toEqual([11]);
  });
});

describe('push: tips (A-78)', () => {
  // Martes 2026-11-10 10:30 y viernes 2026-11-13 10:30 en CDMX (UTC-6).
  const MARTES = new Date('2026-11-10T16:30:00.000Z');
  const VIERNES = new Date('2026-11-13T16:30:00.000Z');
  const guardado = (id: number) => ({ ...SUB, dispositivoId: id });

  it('solo toca martes y viernes entre 10:30 y la 1 de la tarde (hora del negocio)', () => {
    const z = 'America/Mexico_City';
    expect(turnoDeTip(MARTES, z)?.slot).toBe('2026-11-10');
    expect(turnoDeTip(VIERNES, z)?.slot).toBe('2026-11-13');
    expect(turnoDeTip(new Date('2026-11-10T16:29:00.000Z'), z)).toBeNull(); // 10:29
    expect(turnoDeTip(new Date('2026-11-10T18:59:00.000Z'), z)?.slot).toBe('2026-11-10'); // 12:59
    expect(turnoDeTip(new Date('2026-11-10T19:00:00.000Z'), z)).toBeNull(); // 13:00
    expect(turnoDeTip(new Date('2026-11-11T16:30:00.000Z'), z)).toBeNull(); // miércoles
    expect(turnoDeTip(new Date('2026-11-14T16:30:00.000Z'), z)).toBeNull(); // sábado
  });

  it('el índice avanza dos por semana, sin repetir de un envío al siguiente', () => {
    const z = 'America/Mexico_City';
    const a = turnoDeTip(MARTES, z)!.indice;
    expect(turnoDeTip(VIERNES, z)!.indice).toBe(a + 1);
    expect(turnoDeTip(new Date('2026-11-17T16:30:00.000Z'), z)!.indice).toBe(a + 2);
  });

  it('un celular con dos cuentas recibe un solo tip, de los que le sirven a sus roles', async () => {
    await service.suscribir(10, guardado(1));
    await service.suscribir(11, guardado(2));
    expect(await service.enviarTips(MARTES)).toBe(1);
    expect(enviados).toHaveLength(1);
    const id = new URL(enviados[0].payload.ruta, 'http://x').searchParams.get('tip')!;
    const tip = tipPorId(id)!;
    expect(tip.roles === undefined || tip.roles.some((r) => r === ROLES.GUARDIA || r === ROLES.SUPERVISOR)).toBe(true);
    expect(enviados[0].payload).toMatchObject({ titulo: 'Platinum · Tip', cuerpo: tip.titulo, tipo: 'tip' });
    expect(enviados[0].payload.para).toBeUndefined();
  });

  it('al cliente solo le llegan tips de cliente o para todos', async () => {
    await service.suscribir(12, SUB);
    for (let semana = 0; semana < 8; semana++) {
      enviados.length = 0;
      repo.reservados.clear();
      await service.enviarTips(new Date(MARTES.getTime() + semana * 7 * 86_400_000));
      const tip = tipPorId(new URL(enviados[0].payload.ruta, 'http://x').searchParams.get('tip')!)!;
      expect(!tip.roles || tip.roles.includes(ROLES.CLIENTE)).toBe(true);
    }
  });

  it('no se manda dos veces el mismo día aunque el servidor se reinicie', async () => {
    await service.suscribir(10, SUB);
    expect(await service.enviarTips(MARTES)).toBe(1);
    expect(await service.enviarTips(new Date(MARTES.getTime() + 60_000))).toBe(0);
    expect(enviados).toHaveLength(1);
    expect(await service.enviarTips(VIERNES)).toBe(1);
  });

  it('fuera de horario no manda nada ni reserva el turno', async () => {
    await service.suscribir(10, SUB);
    expect(await service.enviarTips(new Date('2026-11-10T14:00:00.000Z'))).toBe(0); // 8:00
    expect(repo.reservados.size).toBe(0);
  });

  it('sin claves en el servidor no manda tips', async () => {
    const apagado = new PushService(repo, null, null);
    await apagado.suscribir(10, SUB);
    expect(await apagado.enviarTips(MARTES)).toBe(0);
  });

  it('todos los tips tienen id único y texto, y cada rol tiene varios', () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
    for (const t of TIPS) {
      expect(t.titulo.length).toBeGreaterThan(5);
      expect(t.texto.length).toBeGreaterThan(30);
    }
    for (const rol of Object.values(ROLES)) {
      expect(TIPS.filter((t) => t.roles?.includes(rol)).length).toBeGreaterThanOrEqual(4);
    }
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
