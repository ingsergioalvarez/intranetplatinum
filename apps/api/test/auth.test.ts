import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { PERMISOS_POR_ROL, ROLES } from '@platinum/shared';
import { createApp } from '../src/app';
import { healthModule } from '../src/modules/health';
import { createAuthModule } from '../src/modules/auth';
import { REFRESH_COOKIE } from '../src/modules/auth/auth.controller';
import {
  AuthRepository,
  type DispositivoRow,
  type NuevoRefreshToken,
  type RefreshTokenRecord,
  type UsuarioAuth,
} from '../src/modules/auth/auth.repository';
import { MemoryAuditLogger } from './helpers/memoryAudit';

// ---------- Dobles en memoria ----------
class MemoryAuthRepository extends AuthRepository {
  usuarios: UsuarioAuth[] = [];
  tokens: (RefreshTokenRecord & { tokenHash: string })[] = [];

  async findUsuarioByEmail(email: string) {
    return this.usuarios.find((u) => u.email === email) ?? null;
  }
  async findUsuarioById(id: number) {
    return this.usuarios.find((u) => u.id === id) ?? null;
  }
  async registrarIntentoFallido(id: number, intentos: number, bloqueadoHasta: Date | null) {
    Object.assign(
      this.usuarios.find((u) => u.id === id)!,
      { intentosFallidos: intentos, bloqueadoHasta },
    );
  }
  async registrarAccesoExitoso(id: number) {
    Object.assign(
      this.usuarios.find((u) => u.id === id)!,
      { intentosFallidos: 0, bloqueadoHasta: null },
    );
  }
  async actualizarPassword(id: number, passwordHash: string) {
    Object.assign(
      this.usuarios.find((u) => u.id === id)!,
      { passwordHash, debeCambiarPassword: false },
    );
  }
  async crearRefreshToken(data: NuevoRefreshToken) {
    this.tokens.push({ id: this.tokens.length + 1, revocadoEn: null, ...data });
  }
  async findRefreshToken(tokenHash: string) {
    return this.tokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }
  async rotarRefreshToken(id: number, nuevo: NuevoRefreshToken) {
    const t = this.tokens.find((x) => x.id === id)!;
    if (t.revocadoEn) return false;
    t.revocadoEn = new Date();
    await this.crearRefreshToken(nuevo);
    return true;
  }
  async revocarRefreshToken(id: number) {
    const t = this.tokens.find((x) => x.id === id)!;
    t.revocadoEn ??= new Date();
  }
  async revocarRefreshTokensDeUsuario(usuarioId: number) {
    for (const t of this.tokens) if (t.usuarioId === usuarioId) t.revocadoEn ??= new Date();
  }

  dispositivos: (DispositivoRow & { tokenHash: string })[] = [];
  async crearDispositivo(data: { usuarioId: number; tokenHash: string; etiqueta: string }) {
    const d = {
      id: this.dispositivos.length + 1,
      pinHash: null,
      intentosFallidos: 0,
      bloqueadoEn: null,
      ultimoUso: new Date(),
      revocadoEn: null,
      createdAt: new Date(),
      ...data,
    };
    this.dispositivos.push(d);
    return d;
  }
  async findDispositivoPorToken(tokenHash: string) {
    return this.dispositivos.find((d) => d.tokenHash === tokenHash) ?? null;
  }
  async findDispositivo(id: number) {
    return this.dispositivos.find((d) => d.id === id) ?? null;
  }
  async dispositivosDe(usuarioId: number) {
    return this.dispositivos.filter((d) => d.usuarioId === usuarioId && !d.revocadoEn);
  }
  async registrarUsoDispositivo(id: number) {
    Object.assign(this.dispositivos.find((d) => d.id === id)!, { ultimoUso: new Date(), intentosFallidos: 0, bloqueadoEn: null });
  }
  async registrarFalloPin(id: number, intentos: number, bloqueadoEn: Date | null) {
    Object.assign(this.dispositivos.find((d) => d.id === id)!, { intentosFallidos: intentos, bloqueadoEn });
  }
  async guardarPin(id: number, pinHash: string | null) {
    Object.assign(this.dispositivos.find((d) => d.id === id)!, { pinHash, intentosFallidos: 0, bloqueadoEn: null });
  }
  async revocarDispositivo(id: number) {
    this.dispositivos.find((d) => d.id === id)!.revocadoEn ??= new Date();
  }
  async revocarDispositivosDeUsuario(usuarioId: number) {
    const vigentes = this.dispositivos.filter((d) => d.usuarioId === usuarioId && !d.revocadoEn);
    for (const d of vigentes) d.revocadoEn = new Date();
    return vigentes.length;
  }
}

// ---------- Utilidades ----------
const PASSWORD = 'Secreta-123';
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
});

function usuario(over: Partial<UsuarioAuth> = {}): UsuarioAuth {
  return {
    id: 1,
    nombre: 'Ana Guardia',
    email: 'ana@platinum.local',
    passwordHash,
    activo: true,
    debeCambiarPassword: false,
    deletedAt: null,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    rol: ROLES.GUARDIA,
    permisos: PERMISOS_POR_ROL[ROLES.GUARDIA],
    ...over,
  };
}

/** Valor de la cookie del refresh token en la respuesta ('' si se borró). */
function refreshCookie(res: request.Response): string | undefined {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const c = raw.find((x) => x.startsWith(`${REFRESH_COOKIE}=`));
  return c?.split(';')[0].slice(REFRESH_COOKIE.length + 1);
}

let repo: MemoryAuthRepository;
let audit: MemoryAuditLogger;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  repo = new MemoryAuthRepository();
  audit = new MemoryAuditLogger();
  repo.usuarios.push(usuario());
  app = createApp([
    healthModule,
    createAuthModule({
      repo,
      audit,
      policy: { maxIntentos: 5, bloqueoMin: 15, refreshDias: 7 },
      loginRateLimit: 100,
    }),
  ]);
});

const login = (email = 'ana@platinum.local', password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password });

// ---------- Pruebas ----------
describe('POST /api/auth/login', () => {
  it('con credenciales correctas devuelve usuario, access token y cookie httpOnly', async () => {
    const res = await login('  ANA@platinum.local ');

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: 1, email: 'ana@platinum.local', rol: 'guardia' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();

    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Path=\/api\/auth/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(repo.tokens).toHaveLength(1);
    expect(repo.tokens[0].tokenHash).not.toBe(refreshCookie(res));
    expect(audit.acciones()).toEqual(['auth.login', 'auth.dispositivo_guardado']);

    const me = await request(app)
      .get('/api/health/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ id: 1, rol: 'guardia' });
  });

  it('con contraseña incorrecta responde 401 genérico y cuenta el intento', async () => {
    const res = await login(undefined, 'mala');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(repo.usuarios[0].intentosFallidos).toBe(1);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('con correo inexistente responde el mismo 401 y lo audita sin usuario', async () => {
    const res = await login('nadie@platinum.local');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(audit.eventos[0]).toMatchObject({ accion: 'auth.login_fallido', datos: { motivo: 'no_existe' } });
    expect(audit.eventos[0].usuarioId).toBeUndefined();
  });

  it('bloquea la cuenta al 5.º intento fallido, aun con la contraseña correcta después', async () => {
    for (let i = 0; i < 4; i++) expect((await login(undefined, 'mala')).status).toBe(401);
    const quinto = await login(undefined, 'mala');
    expect(quinto.status).toBe(423);
    expect(quinto.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(audit.acciones()).toContain('auth.cuenta_bloqueada');

    const correcta = await login();
    expect(correcta.status).toBe(423);
  });

  it('un login correcto reinicia los intentos fallidos', async () => {
    await login(undefined, 'mala');
    await login(undefined, 'mala');
    expect((await login()).status).toBe(200);
    expect(repo.usuarios[0].intentosFallidos).toBe(0);
  });

  it('permite entrar cuando el bloqueo ya expiró', async () => {
    repo.usuarios[0].bloqueadoHasta = new Date(Date.now() - 1000);
    expect((await login()).status).toBe(200);
  });

  it('rechaza con 403 a un usuario dado de baja', async () => {
    repo.usuarios[0].activo = false;
    const res = await login();
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USER_INACTIVE');
  });

  it('valida el body (correo inválido → 400)', async () => {
    const res = await login('no-es-correo');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('limita los intentos por IP (429)', async () => {
    app = createApp([createAuthModule({ repo, audit, loginRateLimit: 2 })]);
    await login(undefined, 'mala');
    await login(undefined, 'mala');
    const res = await login();
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('POST /api/auth/refresh', () => {
  it('rota el refresh token y entrega un nuevo access token', async () => {
    const cookie1 = refreshCookie(await login())!;
    const res = await request(app).post('/api/auth/refresh').set('Cookie', `${REFRESH_COOKIE}=${cookie1}`);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('ana@platinum.local');
    const cookie2 = refreshCookie(res)!;
    expect(cookie2).toBeTruthy();
    expect(cookie2).not.toBe(cookie1);
    expect(repo.tokens[0].revocadoEn).not.toBeNull();
    expect(repo.tokens[1].revocadoEn).toBeNull();
  });

  it('sin cookie responde 401 REFRESH_INVALID', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_INVALID');
  });

  it('reutilizar un token ya rotado cierra todas las sesiones del usuario', async () => {
    const cookie1 = refreshCookie(await login())!;
    const rot = await request(app).post('/api/auth/refresh').set('Cookie', `${REFRESH_COOKIE}=${cookie1}`);
    const cookie2 = refreshCookie(rot)!;
    repo.tokens[0].revocadoEn = new Date(Date.now() - 60_000); // fuera de la gracia entre pestañas

    const reuso = await request(app).post('/api/auth/refresh').set('Cookie', `${REFRESH_COOKIE}=${cookie1}`);
    expect(reuso.status).toBe(401);
    expect(audit.acciones()).toContain('auth.refresh_reutilizado');

    const legitimo = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${cookie2}`);
    expect(legitimo.status).toBe(401);
  });

  it('una carrera entre pestañas (reuso inmediato) no cierra las demás sesiones', async () => {
    const cookie1 = refreshCookie(await login())!;
    const rot = await request(app).post('/api/auth/refresh').set('Cookie', `${REFRESH_COOKIE}=${cookie1}`);
    const cookie2 = refreshCookie(rot)!;

    expect(
      (await request(app).post('/api/auth/refresh').set('Cookie', `${REFRESH_COOKIE}=${cookie1}`)).status,
    ).toBe(401);
    expect(
      (await request(app).post('/api/auth/refresh').set('Cookie', `${REFRESH_COOKIE}=${cookie2}`)).status,
    ).toBe(200);
  });

  it('rechaza el refresh de un token expirado', async () => {
    const cookie = refreshCookie(await login())!;
    repo.tokens[0].expiraEn = new Date(Date.now() - 1000);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', `${REFRESH_COOKIE}=${cookie}`);
    expect(res.status).toBe(401);
  });

  it('si el usuario fue dado de baja, el refresh falla y revoca sus tokens', async () => {
    const cookie = refreshCookie(await login())!;
    repo.usuarios[0].deletedAt = new Date();
    const res = await request(app).post('/api/auth/refresh').set('Cookie', `${REFRESH_COOKIE}=${cookie}`);
    expect(res.status).toBe(401);
    expect(repo.tokens.every((t) => t.revocadoEn)).toBe(true);
  });
});

describe('POST /api/auth/logout', () => {
  it('revoca el refresh token, borra la cookie y lo audita', async () => {
    const cookie = refreshCookie(await login())!;
    const res = await request(app).post('/api/auth/logout').set('Cookie', `${REFRESH_COOKIE}=${cookie}`);

    expect(res.status).toBe(204);
    expect(refreshCookie(res)).toBe('');
    expect(repo.tokens[0].revocadoEn).not.toBeNull();
    expect(audit.acciones()).toContain('auth.logout');

    const despues = await request(app).post('/api/auth/refresh').set('Cookie', `${REFRESH_COOKIE}=${cookie}`);
    expect(despues.status).toBe(401);
  });

  it('es idempotente sin cookie', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });
});

describe('POST /api/auth/cambiar-password', () => {
  const NUEVA = 'NuevaClave-2026';
  const cambiar = (token: string, body: object) =>
    request(app).post('/api/auth/cambiar-password').set('Authorization', `Bearer ${token}`).send(body);

  it('con contraseña temporal: el login avisa y la API bloquea todo menos el cambio', async () => {
    repo.usuarios[0].debeCambiarPassword = true;
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.data.user.debeCambiarPassword).toBe(true);
    const token = res.body.data.accessToken;

    const me = await request(app).get('/api/health/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(403);
    expect(me.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    // Con contraseña temporal no es necesario enviar la actual (D-012).
    const cambio = await cambiar(token, { nueva: NUEVA });
    expect(cambio.status).toBe(200);
    expect(cambio.body.data.user.debeCambiarPassword).toBe(false);
    expect(refreshCookie(cambio)).toBeTruthy();
    expect(repo.usuarios[0].debeCambiarPassword).toBe(false);
    expect(audit.acciones()).toContain('auth.cambiar_password');

    const me2 = await request(app)
      .get('/api/health/me')
      .set('Authorization', `Bearer ${cambio.body.data.accessToken}`);
    expect(me2.status).toBe(200);
  });

  it('con contraseña temporal: rechaza si la nueva contraseña es igual a la temporal', async () => {
    repo.usuarios[0].debeCambiarPassword = true;
    const res = await login();
    const token = res.body.data.accessToken;
    const cambio = await cambiar(token, { nueva: PASSWORD });
    expect(cambio.status).toBe(400);
    expect(cambio.body.error.details).toEqual([
      { path: 'nueva', message: 'La nueva contraseña debe ser distinta a la actual' },
    ]);
  });

  it('cambio voluntario: rechaza si no se envía la contraseña actual', async () => {
    const { body } = await login();
    const res = await cambiar(body.data.accessToken, { nueva: NUEVA });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: 'actual', message: 'Escribe tu contraseña actual' },
    ]);
  });

  it('cierra las demás sesiones y la nueva contraseña funciona', async () => {
    const otraSesion = refreshCookie(await login())!;
    const { body } = await login();
    expect((await cambiar(body.data.accessToken, { actual: PASSWORD, nueva: NUEVA })).status).toBe(200);

    const refreshViejo = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${otraSesion}`);
    expect(refreshViejo.status).toBe(401);
    expect((await login(undefined, PASSWORD)).status).toBe(401);
    expect((await login(undefined, NUEVA)).status).toBe(200);
  });

  it('rechaza contraseña actual incorrecta con error en el campo', async () => {
    const { body } = await login();
    const res = await cambiar(body.data.accessToken, { actual: 'otra-cosa-1', nueva: NUEVA });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: 'actual', message: 'La contraseña actual no es correcta' },
    ]);
  });

  it('aplica la regla de contraseña (10+ caracteres, letras y números, distinta)', async () => {
    const { body } = await login();
    const t = body.data.accessToken;
    expect((await cambiar(t, { actual: PASSWORD, nueva: 'corta1' })).status).toBe(400);
    expect((await cambiar(t, { actual: PASSWORD, nueva: 'sinnumerosaqui' })).status).toBe(400);
    expect((await cambiar(t, { actual: PASSWORD, nueva: PASSWORD })).status).toBe(400);
  });

  it('sin token responde 401', async () => {
    expect((await request(app).post('/api/auth/cambiar-password').send({})).status).toBe(401);
  });
});

// ---------- Perfiles rápidos (A-40) ----------
// El PIN se guarda con bcrypt (costo 12): con el equipo ocupado cada comprobación tarda más.
describe('perfiles rápidos de guardias (A-40)', { timeout: 30_000 }, () => {
  const entrar = async (extra: object = {}, email = 'ana@platinum.local') =>
    request(app).post('/api/auth/login').send({ email, password: PASSWORD, ...extra });
  const conToken = (r: request.Response) => ({ Authorization: `Bearer ${r.body.data.accessToken}` });
  const pinPor = (token: string, pin: string) => request(app).post('/api/auth/perfil-rapido').send({ token, pin });
  const definir = (r: request.Response, id: number, pin = '1234', password = PASSWORD) =>
    request(app).put(`/api/auth/dispositivos/${id}/pin`).set(conToken(r)).send({ pin, password });

  it('al entrar un guardia, el celular se guarda solo y devuelve su clave una vez', async () => {
    const r = await entrar();
    expect(r.body.data.dispositivo).toMatchObject({ id: 1, tienePin: false, token: expect.any(String) });
    expect(repo.dispositivos[0].tokenHash).not.toBe(r.body.data.dispositivo.token);
    // Con su clave, el mismo celular no crea otro ni la devuelve de nuevo.
    const otra = await entrar({ dispositivoToken: r.body.data.dispositivo.token });
    expect(otra.body.data.dispositivo).toEqual({ id: 1, tienePin: false });
    expect(repo.dispositivos).toHaveLength(1);
    // Una clave que no es suya o inventada: crea un celular nuevo.
    expect((await entrar({ dispositivoToken: 'inventada' })).body.data.dispositivo.token).toBeDefined();
    expect(repo.dispositivos).toHaveLength(2);
  });

  it('solo los guardias: admin, supervisor y cliente no guardan perfil', async () => {
    repo.usuarios.push(usuario({ id: 2, email: 'admin@platinum.local', rol: ROLES.ADMIN, permisos: PERMISOS_POR_ROL[ROLES.ADMIN] }));
    const r = await entrar({}, 'admin@platinum.local');
    expect(r.body.data.dispositivo).toBeUndefined();
    expect(repo.dispositivos).toHaveLength(0);
  });

  it('crear el PIN pide la contraseña y 4 dígitos; con él se entra con la tarjeta', async () => {
    const r = await entrar();
    const { id, token } = r.body.data.dispositivo;
    expect((await definir(r, id, '12', PASSWORD)).status).toBe(400);
    expect((await definir(r, id, '1234', 'mala-contraseña')).status).toBe(400);
    expect((await definir(r, id)).status).toBe(204);

    const res = await pinPor(token, '1234');
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: 1, rol: 'guardia' });
    expect(res.body.data.dispositivo).toEqual({ id: 1, tienePin: true });
    expect(refreshCookie(res)).toBeTruthy();
    expect(audit.acciones()).toContain('auth.login_pin');
  });

  it('PIN incorrecto: cuenta intentos y al 5.º bloquea hasta entrar con contraseña', async () => {
    const r = await entrar();
    const { id, token } = r.body.data.dispositivo;
    await definir(r, id);
    const primero = await pinPor(token, '0000');
    expect(primero.status).toBe(401);
    expect(primero.body.error).toMatchObject({ code: 'PIN_INVALID', details: { intentosRestantes: 4 } });
    for (let i = 0; i < 3; i++) await pinPor(token, '0000');
    const quinto = await pinPor(token, '0000');
    expect(quinto.status).toBe(423);
    expect(quinto.body.error.code).toBe('PIN_BLOCKED');
    // Bloqueado: ni el PIN bueno entra.
    expect((await pinPor(token, '1234')).status).toBe(423);
    // Entrar con la contraseña lo libera.
    await entrar({ dispositivoToken: token });
    expect((await pinPor(token, '1234')).status).toBe(200);
  });

  it('un PIN correcto reinicia los intentos fallidos', async () => {
    const r = await entrar();
    const { id, token } = r.body.data.dispositivo;
    await definir(r, id);
    await pinPor(token, '0000');
    await pinPor(token, '0000');
    expect((await pinPor(token, '1234')).status).toBe(200);
    expect(repo.dispositivos[0].intentosFallidos).toBe(0);
  });

  it('sin PIN, con clave inventada, quitado o con el usuario de baja: DEVICE_INVALID o PIN_NOT_SET', async () => {
    const r = await entrar();
    const { id, token } = r.body.data.dispositivo;
    expect((await pinPor(token, '1234')).body.error.code).toBe('PIN_NOT_SET');
    expect((await pinPor('inventada', '1234')).body.error.code).toBe('DEVICE_INVALID');
    await definir(r, id);
    const quitado = await request(app).delete(`/api/auth/dispositivos/${id}`).set(conToken(r));
    expect(quitado.status).toBe(204);
    expect((await pinPor(token, '1234')).body.error.code).toBe('DEVICE_INVALID');

    const r2 = await entrar();
    await definir(r2, r2.body.data.dispositivo.id);
    repo.usuarios[0].activo = false;
    expect((await pinPor(r2.body.data.dispositivo.token, '1234')).body.error.code).toBe('DEVICE_INVALID');
    expect(repo.dispositivos[1].revocadoEn).not.toBeNull();
  });

  it('el guardia lista sus celulares, quita su PIN y no toca los de otro', async () => {
    const r = await entrar();
    const { id } = r.body.data.dispositivo;
    await definir(r, id);
    const lista = await request(app).get('/api/auth/dispositivos').set(conToken(r));
    expect(lista.body.data).toEqual([
      expect.objectContaining({ id, tienePin: true, bloqueado: false, etiqueta: expect.any(String) }),
    ]);
    expect((await request(app).delete(`/api/auth/dispositivos/${id}/pin`).set(conToken(r))).status).toBe(204);
    expect((await request(app).get('/api/auth/dispositivos').set(conToken(r))).body.data[0].tienePin).toBe(false);

    repo.usuarios.push(usuario({ id: 3, email: 'otro@platinum.local' }));
    const otro = await entrar({}, 'otro@platinum.local');
    const ajeno = otro.body.data.dispositivo.id;
    expect((await request(app).delete(`/api/auth/dispositivos/${ajeno}`).set(conToken(r))).status).toBe(404);
    expect((await definir(r, ajeno)).status).toBe(404);
  });

  it('"Quitar de este dispositivo" desde la entrada: basta la clave del celular y no falla si ya no existe', async () => {
    const r = await entrar();
    const { token } = r.body.data.dispositivo;
    const quitar = (t: string) => request(app).post('/api/auth/perfil-rapido/quitar').send({ token: t });
    expect((await quitar('inventada')).status).toBe(204);
    expect(repo.dispositivos[0].revocadoEn).toBeNull();
    expect((await quitar(token)).status).toBe(204);
    expect(repo.dispositivos[0].revocadoEn).not.toBeNull();
    expect((await quitar(token)).status).toBe(204);
    expect(audit.acciones().filter((a) => a === 'auth.dispositivo_quitado')).toHaveLength(1);
  });

  it('solo el admin ve y quita los celulares de un guardia (el supervisor no)', async () => {
    const r = await entrar();
    const { id } = r.body.data.dispositivo;
    repo.usuarios.push(
      usuario({ id: 2, email: 'admin@platinum.local', rol: ROLES.ADMIN, permisos: PERMISOS_POR_ROL[ROLES.ADMIN] }),
      usuario({ id: 4, email: 'sup@platinum.local', rol: ROLES.SUPERVISOR, permisos: PERMISOS_POR_ROL[ROLES.SUPERVISOR] }),
    );
    const admin = await entrar({}, 'admin@platinum.local');
    const sup = await entrar({}, 'sup@platinum.local');
    expect((await request(app).get('/api/auth/usuarios/1/dispositivos').set(conToken(sup))).status).toBe(403);
    expect((await request(app).delete('/api/auth/usuarios/1/dispositivos').set(conToken(sup))).status).toBe(403);
    expect((await request(app).get('/api/auth/usuarios/1/dispositivos').set(conToken(r))).status).toBe(403);

    const lista = await request(app).get('/api/auth/usuarios/1/dispositivos').set(conToken(admin));
    expect(lista.body.data).toHaveLength(1);
    expect((await request(app).delete(`/api/auth/usuarios/1/dispositivos/${id}`).set(conToken(admin))).status).toBe(204);
    expect(audit.acciones()).toContain('auth.dispositivo_quitado_admin');

    await entrar();
    await entrar({ dispositivoToken: 'otra-clave' });
    const todos = await request(app).delete('/api/auth/usuarios/1/dispositivos').set(conToken(admin));
    expect(todos.body.data).toEqual({ quitados: 2 });
    expect(audit.acciones()).toContain('auth.dispositivos_quitados_admin');
  });
});
