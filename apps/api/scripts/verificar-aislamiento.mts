/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación con supertest y módulos cargados dinámicamente */
/**
 * Verificación de extremo a extremo del aislamiento por empresa (C-08) con el sistema REAL: API, autenticación,
 * repositorios y MySQL, en una base TEMPORAL con dos empresas. No toca la base del usuario.
 * Uso: `npm run verificar:aislamiento -w @platinum/api` (requiere un MySQL local en DATABASE_URL).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const API = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(`${API}/package.json`);
const mariadb = req('mariadb') as {
  createConnection: (c: object) => Promise<{ query: (s: string) => Promise<unknown>; end: () => Promise<void> }>;
};
const bcrypt = req('bcryptjs') as { hash: (s: string, n: number) => Promise<string> };
const supertest = req('supertest') as (app: unknown) => any;

process.chdir(API);
process.loadEnvFile();
const u = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
  console.error('ABORTADO: no es una base local.');
  process.exit(1);
}
const TEMP = `c08_aislamiento_${Date.now()}`;
const urlTemp = new URL(u);
urlTemp.pathname = `/${TEMP}`;

let fallos = 0;
let total = 0;
const check = (nombre: string, ok: boolean, detalle?: unknown) => {
  total++;
  if (ok) console.log(`  ✔ ${nombre}`);
  else {
    fallos++;
    console.log(`  ✘ ${nombre}${detalle !== undefined ? ` -> ${typeof detalle === 'string' ? detalle : JSON.stringify(detalle).slice(0, 300)}` : ''}`);
  }
};
const seccion = (t: string) => console.log(`\n${t}`);

async function main() {
  const admin = await mariadb.createConnection({
    host: u.hostname, port: Number(u.port || 3306), user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password), allowPublicKeyRetrieval: true,
  });
  try {
    await admin.query(`CREATE DATABASE \`${TEMP}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    const r = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { cwd: API, env: { ...process.env, DATABASE_URL: urlTemp.toString() }, shell: true, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`migrate deploy falló:\n${(r.stdout + r.stderr).slice(-500)}`);
    console.log(`Base temporal ${TEMP} lista (48 migraciones)`);

    // A partir de aquí TODO el código del proyecto usa la base temporal.
    process.env.DATABASE_URL = urlTemp.toString();
    process.env.NODE_ENV = 'test';
    const imp = (p: string) => import(pathToFileURL(`${API}/src/${p}`).href);
    const { createPrismaClient, getPrisma, disconnectPrisma } = await imp('core/data/prisma.ts');
    const { conEmpresa, sinFiltroDeEmpresa } = await imp('core/empresa/contexto.ts');
    const { signAccessToken, verifyAccessToken } = await imp('core/index.ts');
    const { createApp } = await imp('app.ts');

    // ---------- Datos de partida (con el cliente SIN filtro, como hace el seed) ----------
    const raw = createPrismaClient(urlTemp.toString());
    const hash = await bcrypt.hash('Password-123456', 4);
    const rolAdmin = await raw.rol.create({ data: { clave: 'admin', nombre: 'Administrador' } });
    const rolSup = await raw.rol.create({ data: { clave: 'supervisor', nombre: 'Supervisor' } });
    await raw.rol.create({ data: { clave: 'guardia', nombre: 'Guardia' } });
    await raw.rol.create({ data: { clave: 'cliente', nombre: 'Cliente' } });
    const acme = await raw.empresa.create({ data: { nombre: 'Acme', zonaHoraria: 'America/Mexico_City' } });
    const E1 = 1;
    const E2 = acme.id;
    const mkUser = (nombre: string, email: string, empresaId: number, extra: object = {}) =>
      raw.usuario.create({ data: { nombre, email, passwordHash: hash, rolId: rolAdmin.id, empresaId, telefono: '5550000000', ...extra } });
    const admin1 = await mkUser('Admin Uno', 'admin1@x.mx', E1);
    const admin2 = await mkUser('Admin Dos', 'admin2@x.mx', E2);
    await mkUser('Super', 'super@x.mx', E1, { esSuperAdmin: true });
    await raw.usuario.create({ data: { nombre: 'Sup Uno', email: 'sup1@x.mx', passwordHash: hash, rolId: rolSup.id, empresaId: E1, telefono: '5550000001', propietarioId: admin1.id } });
    const c1 = await raw.cliente.create({ data: { empresaId: E1, razonSocial: 'Uno SA', nombreComercial: 'Cliente Uno', propietarioId: admin1.id } });
    const c2 = await raw.cliente.create({ data: { empresaId: E2, razonSocial: 'Dos SA', nombreComercial: 'Cliente Dos', propietarioId: admin2.id } });
    await raw.turno.create({ data: { empresaId: E1, nombre: 'Turno Uno', horas: 8, horaEntrada: '09:00', diasTipo: 'diario' } });
    await raw.turno.create({ data: { empresaId: E2, nombre: 'Turno Dos', horas: 8, horaEntrada: '09:00', diasTipo: 'diario' } });
    // El nombre de un turno es único por empresa: el mismo nombre en dos empresas debe poder existir.
    let mismoNombre = true;
    const gemelo = await raw.turno.create({ data: { empresaId: E1, nombre: 'Turno Dos', horas: 8, horaEntrada: '09:00', diasTipo: 'diario' } }).catch(() => { mismoNombre = false; return null; });
    let repetido = false;
    await raw.turno.create({ data: { empresaId: E1, nombre: 'Turno Dos', horas: 8, horaEntrada: '09:00', diasTipo: 'diario' } }).catch(() => { repetido = true; });
    check('el mismo nombre de turno se permite en dos empresas y no se repite en una', mismoNombre && repetido, { mismoNombre, repetido });
    if (gemelo) await raw.turno.delete({ where: { id: gemelo.id } });
    await raw.$disconnect();

    const app = createApp();
    const api = supertest(app);
    const login = async (email: string) => {
      const res = await api.post('/api/auth/login').send({ email, password: 'Password-123456' });
      return { status: res.status, token: res.body?.data?.accessToken as string | undefined, body: res.body };
    };
    const como = (token?: string) => ({
      get: (p: string) => api.get(`/api${p}`).set('Authorization', `Bearer ${token}`),
      post: (p: string, b: object = {}) => api.post(`/api${p}`).set('Authorization', `Bearer ${token}`).send(b),
      patch: (p: string, b: object = {}) => api.patch(`/api${p}`).set('Authorization', `Bearer ${token}`).send(b),
      del: (p: string) => api.delete(`/api${p}`).set('Authorization', `Bearer ${token}`),
    });
    const nombres = (res: any) => (res.body?.data?.items ?? res.body?.data ?? []).map((x: any) => x.nombreComercial ?? x.nombre ?? x.email);

    // ---------- 1. Inicio de sesión ----------
    seccion('1. Inicio de sesión: el token lleva la empresa');
    const l1 = await login('admin1@x.mx');
    const l2 = await login('admin2@x.mx');
    const lS = await login('super@x.mx');
    check('admin de la empresa 1 inicia sesión', l1.status === 200 && !!l1.token, l1.body);
    check('admin de la empresa 2 inicia sesión', l2.status === 200 && !!l2.token, l2.body);
    check('el token de cada uno lleva su empresa', verifyAccessToken(l1.token!).empresaId === E1 && verifyAccessToken(l2.token!).empresaId === E2);
    const T1 = l1.token!;
    const T2 = l2.token!;
    const TS = lS.token!;

    // ---------- 2. Lecturas ----------
    seccion('2. Cada empresa ve solo lo suyo');
    check('clientes de la empresa 1', JSON.stringify(nombres(await como(T1).get('/clientes'))) === '["Cliente Uno"]', nombres(await como(T1).get('/clientes')));
    check('clientes de la empresa 2', JSON.stringify(nombres(await como(T2).get('/clientes'))) === '["Cliente Dos"]', nombres(await como(T2).get('/clientes')));
    check('turnos de la empresa 1', JSON.stringify(nombres(await como(T1).get('/turnos'))) === '["Turno Uno"]', nombres(await como(T1).get('/turnos')));
    check('turnos de la empresa 2', JSON.stringify(nombres(await como(T2).get('/turnos'))) === '["Turno Dos"]', nombres(await como(T2).get('/turnos')));
    const verSuper = await como(TS).get('/usuarios');
    const correos = (verSuper.body?.data?.items ?? []).map((x: any) => x.email);
    check('el super admin (empresa 1) NO ve usuarios de la empresa 2', verSuper.status === 200 && !correos.includes('admin2@x.mx') && correos.includes('admin1@x.mx'), correos);
    check('un cliente de otra empresa no se encuentra por su id (404)', (await como(T2).get(`/clientes/${c1.id}`)).status === 404);
    check('y al revés', (await como(T1).get(`/clientes/${c2.id}`)).status === 404);

    // ---------- 3. Modificaciones ----------
    seccion('3. No se puede tocar lo de otra empresa');
    const hack = await como(T2).patch(`/clientes/${c1.id}`, { notas: 'hackeado' });
    check('editar un cliente ajeno responde 404', hack.status === 404, hack.body);
    check('dar de baja un cliente ajeno responde 404', (await como(T2).patch(`/clientes/${c1.id}/baja`)).status === 404);
    const sigue = await sinFiltroDeEmpresa(() => getPrisma().cliente.findUnique({ where: { id: c1.id } }));
    check('el cliente ajeno quedó intacto en la base', sigue?.notas == null && sigue?.deletedAt == null, sigue);

    // ---------- 4. Altas ----------
    seccion('4. Lo que se crea nace en la empresa de quien lo crea');
    const nuevo = await como(T2).post('/clientes', { nombreComercial: 'Cliente Nuevo Dos', razonSocial: 'Nuevo Dos SA', estatus: 'activo' });
    check('crear un cliente (empresa 2)', nuevo.status === 201, nuevo.body);
    const filaNuevo = await sinFiltroDeEmpresa(() => getPrisma().cliente.findUnique({ where: { id: nuevo.body?.data?.id } }));
    check('quedó con empresa_id = 2', filaNuevo?.empresaId === E2, filaNuevo?.empresaId);
    check('la empresa 1 no lo ve', !nombres(await como(T1).get('/clientes')).includes('Cliente Nuevo Dos'));
    const nu = await como(T2).post('/usuarios', { nombre: 'Supervisor Dos', email: 'sup2@x.mx', telefono: '5511111111', rol: 'supervisor' });
    check('crear un usuario (empresa 2)', nu.status === 201, nu.body);
    const filaU = await sinFiltroDeEmpresa(() => getPrisma().usuario.findUnique({ where: { email: 'sup2@x.mx' } }));
    check('el usuario quedó con empresa_id = 2', filaU?.empresaId === E2, filaU?.empresaId);

    // ---------- 5. Capa de datos ----------
    seccion('5. Capa de datos (consultas directas, transacciones, altas cruzadas)');
    const prisma = getPrisma();
    let msg = '';
    try { await prisma.cliente.findMany(); } catch (e: any) { msg = e.code ?? e.message; }
    check('sin empresa en el contexto se niega (falla cerrada)', msg === 'SIN_EMPRESA', msg);
    const own1 = await conEmpresa(E1, () => prisma.cliente.count());
    const own2 = await conEmpresa(E2, () => prisma.cliente.count());
    const todas = await sinFiltroDeEmpresa(() => prisma.cliente.count());
    check('contar: cada empresa cuenta lo suyo y sin filtro se cuenta todo', own1 === 1 && own2 === 2 && todas === 3, { own1, own2, todas });
    msg = '';
    try { await conEmpresa(E2, () => prisma.cliente.create({ data: { empresaId: E1, razonSocial: 'x', nombreComercial: 'x' } })); } catch (e: any) { msg = e.code ?? e.message; }
    check('crear en otra empresa se rechaza', msg === 'EMPRESA_NO_COINCIDE', msg);
    msg = '';
    try { await conEmpresa(E2, () => prisma.cliente.update({ where: { id: c2.id }, data: { empresaId: E1 } })); } catch (e: any) { msg = e.code ?? e.message; }
    check('mover un registro a otra empresa se rechaza', msg === 'EMPRESA_NO_COINCIDE', msg);
    const um = await conEmpresa(E2, () => prisma.cliente.updateMany({ where: {}, data: { notas: 'masivo' } }));
    const trasMasivo = await sinFiltroDeEmpresa(() => prisma.cliente.findUnique({ where: { id: c1.id } }));
    check('un updateMasivo sin condiciones solo alcanza la empresa propia', um.count === 2 && trasMasivo?.notas == null, { count: um.count, ajeno: trasMasivo?.notas });
    const dm = await conEmpresa(E2, () => prisma.turno.deleteMany({}));
    const turnosQuedan = await sinFiltroDeEmpresa(() => prisma.turno.count());
    check('un deleteMany sin condiciones solo borra la empresa propia', dm.count === 1 && turnosQuedan === 1, { borrados: dm.count, quedan: turnosQuedan });
    const enTx = await conEmpresa(E1, () => prisma.$transaction(async (tx: any) => (await tx.cliente.findMany()).map((x: any) => x.nombreComercial)));
    check('transacción interactiva: solo ve lo de la empresa', JSON.stringify(enTx) === '["Cliente Uno"]', enTx);
    const lote = await conEmpresa(E2, () => prisma.$transaction([prisma.cliente.count(), prisma.usuario.count()]));
    check('transacción en lote: cuenta solo lo de la empresa', lote[0] === 2 && lote[1] === 2, lote);
    const anidado = await conEmpresa(E1, () => prisma.cliente.findMany({ include: { sitios: true, contactos: true } }));
    check('lecturas con relaciones anidadas siguen acotadas', anidado.length === 1 && anidado[0].nombreComercial === 'Cliente Uno');
    msg = '';
    try { await conEmpresa(E2, () => prisma.cliente.findUniqueOrThrow({ where: { id: c1.id } })); } catch (e: any) { msg = e.code ?? e.name; }
    check('findUniqueOrThrow de un registro ajeno falla como "no encontrado"', msg === 'P2025' || /NotFound/.test(msg), msg);

    // ---------- 6. Plataforma y sesiones viejas ----------
    seccion('6. Plataforma y sesiones');
    const emp = await como(TS).get('/plataforma/empresas?estado=todas');
    check('el super admin ve TODAS las empresas en plataforma (sin filtro)', emp.status === 200 && emp.body.data.length === 2, emp.body);
    check('un admin de empresa no entra a plataforma (403)', (await como(T1).get('/plataforma/empresas')).status === 403);
    const adm = await como(TS).get(`/plataforma/empresas/${E2}/administradores`);
    check('plataforma lista los administradores de otra empresa', adm.status === 200 && adm.body.data.some((x: any) => x.email === 'admin2@x.mx'), adm.body);
    const sinEmp = signAccessToken({ id: admin1.id, email: 'admin1@x.mx', rol: 'admin', permisos: [], empresaId: null });
    const viejo = await como(sinEmp).get('/clientes');
    check('un token sin empresa (anterior a C-08) es rechazado, no ve nada', viejo.status === 401 && viejo.body?.error?.code === 'SIN_EMPRESA', viejo.body);
    check('sin sesión responde 401', (await api.get('/api/clientes')).status === 401);

    // ---------- 7. Auditoría ----------
    seccion('7. Auditoría por empresa');
    await como(T1).patch(`/clientes/${c1.id}`, { notas: 'de la 1' });
    await como(T2).patch(`/clientes/${c2.id}`, { notas: 'de la 2' });
    await como(TS).patch(`/plataforma/empresas/${E2}`, { nombre: 'Acme SA' });
    const aud = await sinFiltroDeEmpresa(() => prisma.auditoria.findMany({ orderBy: { id: 'asc' } }));
    const de = (accion: string) => aud.filter((a: any) => a.accion === accion);
    check('el cambio de la empresa 1 quedó en la auditoría de la 1', de('clientes.actualizar').some((a: any) => a.empresaId === E1) || aud.some((a: any) => a.empresaId === E1 && a.accion.startsWith('clientes')), aud.map((a: any) => `${a.accion}:${a.empresaId}`));
    check('el cambio de la empresa 2 quedó en la de la 2', aud.some((a: any) => a.empresaId === E2 && a.accion.startsWith('clientes')));
    check('el evento de plataforma quedó sin empresa (solo el super admin)', de('plataforma.empresa_editar').every((a: any) => a.empresaId === null) && de('plataforma.empresa_editar').length > 0, de('plataforma.empresa_editar'));
    const logins = de('auth.login');
    check('los inicios de sesión quedaron en la empresa de cada usuario', logins.some((a: any) => a.usuarioId === admin1.id && a.empresaId === E1) && logins.some((a: any) => a.usuarioId === admin2.id && a.empresaId === E2), logins.map((a: any) => `${a.usuarioId}:${a.empresaId}`));
    const vistaAud = await conEmpresa(E2, () => prisma.auditoria.findMany());
    check('una empresa solo ve su propia auditoría', vistaAud.length > 0 && vistaAud.every((a: any) => a.empresaId === E2), vistaAud.map((a: any) => a.empresaId));

    // ---------- 8. Tareas sin petición ----------
    seccion('8. Tarea que corre cada minuto (sin petición ni sesión)');
    const capturados: string[] = [];
    const consolaOriginal = console.error;
    console.error = (...a: unknown[]) => void capturados.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' ').slice(0, 220));
    const { iniciarVigilanciaTurnos } = await imp('modules/asistencia/index.ts');
    const temporizador = iniciarVigilanciaTurnos();
    await new Promise((ok) => setTimeout(ok, 3000));
    clearInterval(temporizador);
    check('la tarea corre con dos empresas activas sin errores', capturados.length === 0, capturados);

    const { paraCadaEmpresa } = await imp('core/index.ts');
    const { avisarConPrisma } = await imp('modules/avisos/avisar.ts');
    const errTarea = await paraCadaEmpresa([E1, E2], async (id: number) => {
      await avisarConPrisma([id === E1 ? admin1.id : admin2.id], { tipo: 'horas_extra', mensaje: `desde la tarea ${id}` });
    });
    console.error = consolaOriginal;
    check('un aviso escrito desde una tarea no falla (ni en silencio)', errTarea.length === 0 && capturados.length === 0, { errTarea, capturados });
    const avisos = await sinFiltroDeEmpresa(() => prisma.aviso.findMany({ where: { mensaje: { startsWith: 'desde la tarea' } } }));
    check('cada aviso quedó en la empresa de su tarea', avisos.length === 2 && avisos.every((a: any) => a.mensaje === `desde la tarea ${a.empresaId}`), avisos.map((a: any) => `${a.mensaje}:${a.empresaId}`));
    const ve1 = await conEmpresa(E1, () => prisma.aviso.findMany({ where: { mensaje: { startsWith: 'desde la tarea' } } }));
    check('la empresa 1 solo ve su aviso', ve1.length === 1 && ve1[0].empresaId === E1, ve1.length);

    console.log('\n9. Módulos encendidos y empresa elegida por el super admin (C-09)');
    const { lectorModulos } = await imp('core/modulos/guardia.ts');
    // La empresa 1 tiene solo Ausencias encendido; la 2 (Acme) no tiene ninguno.
    await sinFiltroDeEmpresa(() => prisma.empresaModulo.deleteMany({}));
    await sinFiltroDeEmpresa(() => prisma.empresaModulo.create({ data: { empresaId: E1, modulo: 'ausencias', encendido: true } }));
    lectorModulos.invalidar();
    check('módulo encendido: la empresa 1 entra a /ausencias', (await como(T1).get('/ausencias')).status !== 403);
    const apagado = await como(T2).get('/ausencias');
    check('módulo apagado: la empresa 2 recibe 403 MODULO_APAGADO', apagado.status === 403 && apagado.body?.error?.code === 'MODULO_APAGADO', apagado.body);
    check('lo que es núcleo no se bloquea (usuarios de la empresa 2)', (await como(T2).get('/usuarios')).status === 200);
    const ctx1 = await como(T1).get('/mi-empresa');
    const ctx2 = await como(T2).get('/mi-empresa');
    check('/mi-empresa trae la empresa y sus módulos', ctx1.body?.data?.empresa?.id === E1 && ctx1.body?.data?.modulos?.ausencias === true && ctx2.body?.data?.empresa?.id === E2 && ctx2.body?.data?.modulos?.ausencias === false, JSON.stringify({ e1: ctx1.body?.data?.empresa?.id, a1: ctx1.body?.data?.modulos?.ausencias, n2: ctx2.body?.data?.empresa?.nombre, a2: ctx2.body?.data?.modulos?.ausencias, st: ctx2.status }));
    const conCabecera = (t: string, id: number) => api.get('/api/mi-empresa').set('Authorization', `Bearer ${t}`).set('X-Empresa-Id', String(id));
    check('el super admin sin elegir trabaja en su empresa', (await como(TS).get('/mi-empresa')).body?.data?.empresa?.id === E1);
    check('el super admin elige la empresa 2 con la cabecera', (await conCabecera(TS, E2)).body?.data?.empresa?.id === E2);
    check('el super admin en la empresa 2 ve los usuarios de la 2, no los de la 1', (await api.get('/api/usuarios').set('Authorization', `Bearer ${TS}`).set('X-Empresa-Id', String(E2))).body?.data?.items?.map((u: any) => u.email).filter((e: string) => ['admin1@x.mx', 'super@x.mx', 'sup1@x.mx'].includes(e)).length === 0, 'usuarios');
    check('un admin común no puede elegir otra empresa: la cabecera se ignora', (await conCabecera(T1, E2)).body?.data?.empresa?.id === E1);
    const entrar = await como(TS).post(`/plataforma/empresas/${E2}/entrar`);
    check('entrar a una empresa queda en la auditoría', entrar.status === 200 && (await sinFiltroDeEmpresa(() => prisma.auditoria.count({ where: { accion: 'plataforma.entrar_empresa', entidadId: String(E2) } }))) === 1, entrar.body);
    check('un admin de empresa no puede usar /entrar (403)', (await como(T1).post(`/plataforma/empresas/${E2}/entrar`)).status === 403);

    await disconnectPrisma();
    console.log(`\n${fallos === 0 ? 'TODO BIEN' : 'HAY FALLOS'}: ${total - fallos} de ${total} comprobaciones correctas.`);
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS \`${TEMP}\``);
    await admin.end();
    console.log(`Base temporal borrada: ${TEMP}`);
  }
}

main()
  .catch((e) => {
    console.error('\nFALLÓ:', e instanceof Error ? (e.stack ?? e.message) : e);
    process.exitCode = 1;
  })
  .finally(() => process.exit(fallos > 0 ? 1 : (process.exitCode ?? 0)));
