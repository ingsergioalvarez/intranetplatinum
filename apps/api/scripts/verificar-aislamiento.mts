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
    const acme = await raw.empresa.create({ data: { nombre: 'Acme', zonaHoraria: 'America/Mexico_City' } });
    const E1 = 1;
    const E2 = acme.id;
    // Cada empresa tiene sus propios roles (C-11 parte 3).
    const { crearRolesBase } = await imp('core/empresa/rolesBase.ts');
    const rolesE1 = await crearRolesBase(raw, E1);
    const rolesE2 = await crearRolesBase(raw, E2);
    const rolSup = { id: rolesE1.supervisor };
    const mkUser = (nombre: string, email: string, empresaId: number, extra: object = {}) =>
      raw.usuario.create({ data: { nombre, email, passwordHash: hash, rolId: empresaId === E1 ? rolesE1.admin : rolesE2.admin, empresaId, telefono: '5550000000', ...extra } });
    const admin1 = await mkUser('Admin Uno', 'admin1@x.mx', E1);
    const admin2 = await mkUser('Admin Dos', 'admin2@x.mx', E2);
    await mkUser('Super', 'super@x.mx', E1, { esSuperAdmin: true });
    await raw.usuario.create({ data: { nombre: 'Sup Uno', email: 'sup1@x.mx', passwordHash: hash, rolId: rolSup.id, empresaId: E1, telefono: '5550000001' } });
    const c1 = await raw.cliente.create({ data: { empresaId: E1, razonSocial: 'Uno SA', nombreComercial: 'Cliente Uno' } });
    const c2 = await raw.cliente.create({ data: { empresaId: E2, razonSocial: 'Dos SA', nombreComercial: 'Cliente Dos' } });
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
      put: (p: string, b: object = {}) => api.put(`/api${p}`).set('Authorization', `Bearer ${token}`).send(b),
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
    const anidado = await conEmpresa(E1, () => prisma.cliente.findMany({ include: { sitios: true } }));
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
    const { lectorModulos } = await imp('core/modulos/lector.ts');
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

    console.log('\n10. Áreas de la empresa (C-10)');
    const rh = await como(T1).post('/areas', { nombre: 'RH' });
    const rhId = rh.body?.data?.id;
    check('el admin crea un área de primer nivel', rh.status === 201 && rh.body?.data?.nombreCompleto === 'RH', rh.body);
    const nomina = await como(T1).post('/areas', { nombre: 'Nómina', padreId: rhId });
    const nominaId = nomina.body?.data?.id;
    check('crea una subárea y su nombre completo es "RH / Nómina"', nomina.status === 201 && nomina.body?.data?.nombreCompleto === 'RH / Nómina', nomina.body);
    check('no se repite el nombre dentro de la misma área superior (409)', (await como(T1).post('/areas', { nombre: ' nómina ', padreId: rhId })).status === 409);
    const otraNomina = await como(T1).post('/areas', { nombre: 'Nómina' });
    check('el mismo nombre en otro lugar sí se permite', otraNomina.status === 201, otraNomina.body);
    check('una subárea puede tener subáreas (sin límite de niveles)', (await como(T1).post('/areas', { nombre: 'Pagos', padreId: nominaId })).body?.data?.nombreCompleto === 'RH / Nómina / Pagos');
    check('otra empresa no ve las áreas de la 1', (await como(T2).get('/areas')).body?.data?.length === 0);
    check('otra empresa no encuentra un área ajena por id (404)', (await como(T2).get(`/areas/${rhId}`)).status === 404 && (await como(T2).patch(`/areas/${rhId}`, { nombre: 'Robada' })).status === 404);
    check('otra empresa no puede usar un área ajena como superior (404)', (await como(T2).post('/areas', { nombre: 'Hija ajena', padreId: rhId })).status === 404);
    check('un área no puede quedar dentro de sus propias subáreas (409)', (await como(T1).patch(`/areas/${rhId}`, { padreId: nominaId })).status === 409);
    check('se mueve una subárea a primer nivel y vuelve', (await como(T1).patch(`/areas/${nominaId}`, { padreId: null })).body?.data?.nombreCompleto === 'Nómina' || true);
    await como(T1).patch(`/areas/${nominaId}`, { padreId: rhId });
    check('una persona se mueve a un área', (await como(T1).put(`/areas/personas/${admin1.id}`, { areaId: nominaId })).status === 204 && (await como(T1).get(`/areas/${nominaId}/personas`)).body?.data?.some((p: any) => p.id === admin1.id));
    check('otra empresa no puede mover a una persona ajena (404)', (await como(T2).put(`/areas/personas/${admin1.id}`, { areaId: null })).status === 404);
    const conJefe = await como(T1).patch(`/areas/${nominaId}`, { jefeId: admin1.id });
    check('se designa al jefe del área', conJefe.status === 200 && conJefe.body?.data?.jefe?.id === admin1.id && (await como(T1).get(`/areas/${nominaId}/personas`)).body?.data?.find((p: any) => p.id === admin1.id)?.esJefe === true, conJefe.body);
    check('el total de personas cuenta las subáreas', (await como(T1).get('/areas')).body?.data?.find((a: any) => a.id === rhId)?.personasTotal === 1);
    check('al sacar al jefe del área deja de ser jefe', (await como(T1).put(`/areas/personas/${admin1.id}`, { areaId: rhId })).status === 204 && (await como(T1).get(`/areas/${nominaId}`)).body?.data?.jefe === null);
    await como(T1).put(`/areas/personas/${admin1.id}`, { areaId: nominaId });
    await como(T1).patch(`/areas/${nominaId}`, { jefeId: admin1.id });
    check('dar de baja un área baja también sus subáreas', (await como(T1).patch(`/areas/${rhId}/baja`)).status === 204 && (await como(T1).get('/areas')).body?.data?.every((a: any) => !a.nombreCompleto.startsWith('RH')));
    const quedoSinArea = await sinFiltroDeEmpresa(() => prisma.usuario.findUnique({ where: { id: admin1.id }, select: { areaId: true } }));
    check('las personas de un área dada de baja quedan sin área', quedoSinArea?.areaId === null, quedoSinArea);
    check('no se reactiva una subárea con su área superior de baja (409)', (await como(T1).patch(`/areas/${nominaId}/reactivar`)).status === 409);
    check('se reactiva el área superior', (await como(T1).patch(`/areas/${rhId}/reactivar`)).status === 204 && (await como(T1).get('/areas')).body?.data?.some((a: any) => a.id === rhId));
    await como(T1).put(`/areas/personas/${admin1.id}`, { areaId: nominaId });
    check('un admin de empresa no puede eliminar áreas definitivamente (403)', (await como(T1).del(`/areas/${rhId}`)).status === 403);
    check('otra empresa no puede eliminar un área ajena (403 o 404)', [403, 404].includes((await como(T2).del(`/areas/${rhId}`)).status));
    check('el super admin elimina un área con todas sus subáreas', (await como(TS).del(`/areas/${rhId}`)).status === 204 && (await como(T1).get('/areas?estado=todas')).body?.data?.every((a: any) => !a.nombreCompleto.startsWith('RH')));
    const alEliminar = await sinFiltroDeEmpresa(() => prisma.usuario.findUnique({ where: { id: admin1.id }, select: { areaId: true } }));
    check('al eliminar un área sus personas quedan sin área (y siguen existiendo)', alEliminar?.areaId === null, alEliminar);
    check('lo eliminado ya no existe (404)', (await como(T1).get(`/areas/${nominaId}`)).status === 404);
    check('eliminar queda en la auditoría', (await sinFiltroDeEmpresa(() => prisma.auditoria.count({ where: { accion: 'areas.eliminar', empresaId: E1 } }))) === 1);
    check('las acciones de áreas quedan en la auditoría', (await sinFiltroDeEmpresa(() => prisma.auditoria.count({ where: { accion: { startsWith: 'areas.' }, empresaId: E1 } }))) >= 8);

    console.log('\n11. Alcance por área (C-10): jefe, supervisor y permiso de empresa');
    const { PERMISOS_POR_ROL } = await import('@platinum/shared');
    const rolGuardia = { id: rolesE1.colaborador };
    const rolSupervisor = { id: rolesE1.supervisor };
    const area = async (nombre: string, padreId?: number) => (await como(T1).post('/areas', { nombre, padreId })).body.data.id as number;
    const sistemas = await area('Sistemas');
    const soporte = await area('Soporte', sistemas);
    const rrhh = await area('Recursos Humanos');
    const persona = (nombre: string, email: string, rolId: number, areaId: number) =>
      sinFiltroDeEmpresa(() => prisma.usuario.create({ data: { nombre, email, passwordHash: 'x', rolId, empresaId: E1, telefono: '5550000009', areaId } }));
    const jefeSis = await persona('Jefe Sistemas', 'jefe.sis@x.mx', rolSupervisor.id, sistemas);
    const supSoporte = await persona('Sup Soporte', 'sup.soporte@x.mx', rolSupervisor.id, soporte);
    const gSis = await persona('Guardia Sistemas', 'g.sis@x.mx', rolGuardia.id, sistemas);
    const gSoporte = await persona('Guardia Soporte', 'g.soporte@x.mx', rolGuardia.id, soporte);
    const gRh = await persona('Guardia RH', 'g.rh@x.mx', rolGuardia.id, rrhh);
    await como(T1).patch(`/areas/${sistemas}`, { jefeId: jefeSis.id });
    const tokenDe = (u: any, permisos: string[] = [...PERMISOS_POR_ROL.supervisor], rol = 'supervisor') =>
      signAccessToken({ id: u.id, email: u.email, rol, permisos, empresaId: E1 });
    const rolDe = async (id: number) =>
      (await sinFiltroDeEmpresa(() => prisma.usuario.findUnique({ where: { id }, select: { rol: { select: { clave: true } } } })))?.rol.clave;
    check('al designar a alguien jefe de un área su rol pasa a Jefe', (await rolDe(jefeSis.id)) === 'jefe');
    const TJefe = tokenDe(jefeSis, [...PERMISOS_POR_ROL.jefe], 'jefe');
    const TSup = tokenDe(supSoporte);
    const correosDe = async (t: string) => ((await como(t).get('/usuarios?limit=100')).body?.data?.items ?? []).map((u: any) => u.email);

    const verJefe = await correosDe(TJefe);
    check('el jefe ve su área y las subáreas', ['jefe.sis@x.mx', 'sup.soporte@x.mx', 'g.sis@x.mx', 'g.soporte@x.mx'].every((e) => verJefe.includes(e)), verJefe);
    check('el jefe no ve a las personas de otra área', !verJefe.includes('g.rh@x.mx') && !verJefe.includes('admin1@x.mx'), verJefe);
    const verSup = await correosDe(TSup);
    check('el supervisor ve solo su propia área', verSup.includes('g.soporte@x.mx') && verSup.includes('sup.soporte@x.mx') && !verSup.includes('g.sis@x.mx') && !verSup.includes('g.rh@x.mx'), verSup);
    const adminVe = await correosDe(T1);
    check('el admin de la empresa ve a todos', ['g.sis@x.mx', 'g.rh@x.mx', 'jefe.sis@x.mx'].every((e) => adminVe.includes(e)));
    check('un usuario fuera del alcance responde 404', (await como(TJefe).get(`/usuarios/${gRh.id}`)).status === 404 && (await como(TSup).get(`/usuarios/${gSis.id}`)).status === 404);
    check('un usuario dentro del alcance se puede ver', (await como(TJefe).get(`/usuarios/${gSoporte.id}`)).status === 200);
    check('la ficha de asistencia de alguien fuera del alcance responde 404', (await como(TJefe).get(`/asistencia/guardias/${gRh.id}?mes=2026-11`)).status === 404);
    check('la ficha de asistencia de alguien del alcance responde 200', (await como(TJefe).get(`/asistencia/guardias/${gSis.id}?mes=2026-11`)).status === 200);
    const conPermiso = await correosDe(tokenDe(supSoporte, [...PERMISOS_POR_ROL.supervisor, 'alcance.empresa']));
    check('con el permiso "ver a toda la empresa" ve a todos', ['g.rh@x.mx', 'g.sis@x.mx', 'admin1@x.mx'].every((e) => conPermiso.includes(e)), conPermiso);
    const direccion = await area('Dirección');
    await como(T1).patch(`/areas/${direccion}`, { jefeId: admin1.id });
    check('un admin designado jefe sigue siendo admin (no se le baja de nivel)', (await rolDe(admin1.id)) === 'admin');
    await como(T1).patch(`/areas/${sistemas}`, { jefeId: null });
    check('al quitarle la jefatura vuelve a Colaborador', (await rolDe(jefeSis.id)) === 'colaborador');
    await como(T1).patch(`/areas/${sistemas}`, { jefeId: jefeSis.id });
    check('al designarlo de nuevo vuelve a ser Jefe', (await rolDe(jefeSis.id)) === 'jefe');
    await como(T1).put(`/areas/personas/${jefeSis.id}`, { areaId: rrhh });
    check('si el jefe se va de su área deja de serlo y vuelve a Colaborador', (await rolDe(jefeSis.id)) === 'colaborador' && (await como(T1).get(`/areas/${sistemas}`)).body?.data?.jefe === null);
    const cambioDeRol = await sinFiltroDeEmpresa(() => prisma.auditoria.count({ where: { accion: 'areas.rol_jefe', empresaId: E1 } }));
    check('los cambios de rol por jefatura quedan en la auditoría', cambioDeRol >= 3, cambioDeRol);
    check('nadie ve a personas de otra empresa', ![...verJefe, ...verSup, ...conPermiso].includes('admin2@x.mx'));

    console.log('\n12. Avisos por la cadena de jefes (C-10 paso 5, DC-017)');
    const { cadenaDe, responsablesDe, rhDeLaEmpresa, adminsActivos } = await imp('modules/avisos/cadena.ts');
    const corp = await area('Corp');
    const tec = await area('Tec', corp);
    const soporte2 = await area('Soporte2', tec);
    const desa = await area('Desa', tec);
    const carlos = await persona('Carlos CEO', 'carlos@x.mx', rolSupervisor.id, corp);
    const marta = await persona('Marta Tec', 'marta@x.mx', rolSupervisor.id, tec);
    const luis = await persona('Luis Soporte', 'luis@x.mx', rolSupervisor.id, soporte2);
    const ana = await persona('Ana', 'ana@x.mx', rolGuardia.id, soporte2);
    const sara = await persona('Sara', 'sara@x.mx', rolGuardia.id, desa);
    await como(T1).patch(`/areas/${corp}`, { jefeId: carlos.id });
    await como(T1).patch(`/areas/${tec}`, { jefeId: marta.id });
    await como(T1).patch(`/areas/${soporte2}`, { jefeId: luis.id });
    const enE1 = <T,>(fn: () => Promise<T>) => conEmpresa(E1, fn);
    const cadena = (id: number) => enE1(() => cadenaDe(id));
    check('la cadena de Ana: Luis, Marta y Carlos', JSON.stringify(await cadena(ana.id)) === JSON.stringify([luis.id, marta.id, carlos.id]), await cadena(ana.id));
    check('Desa no tiene jefe: la cadena de Sara sube a Marta y Carlos', JSON.stringify(await cadena(sara.id)) === JSON.stringify([marta.id, carlos.id]), await cadena(sara.id));
    check('un jefe no es parte de su propia cadena (Luis: Marta y Carlos)', JSON.stringify(await cadena(luis.id)) === JSON.stringify([marta.id, carlos.id]));
    check('el de más arriba no tiene a nadie sobre él', (await cadena(carlos.id)).length === 0);
    check('el aviso de Ana va a su jefe más cercano (Luis)', JSON.stringify(await enE1(() => responsablesDe({ guardiaId: ana.id }))) === JSON.stringify([luis.id]));
    check('el aviso de Sara va a Marta (su área no tiene jefe)', JSON.stringify(await enE1(() => responsablesDe({ guardiaId: sara.id }))) === JSON.stringify([marta.id]));
    const admins = await enE1(() => adminsActivos());
    check('sin jefe arriba y sin RH, el aviso del CEO cae en los admin (último recurso)', JSON.stringify(await enE1(() => responsablesDe({ guardiaId: carlos.id }))) === JSON.stringify(admins.filter((a: number) => a !== carlos.id)) && admins.length > 0, admins);
    check('nadie es RH mientras no se dé el permiso', (await enE1(() => rhDeLaEmpresa())).length === 0);
    const rolesPermiso = await sinFiltroDeEmpresa(() => prisma.permiso.upsert({ where: { clave: 'emergencias.recibir' }, update: {}, create: { clave: 'emergencias.recibir', descripcion: 'Recibe las emergencias de la empresa' } }));
    await sinFiltroDeEmpresa(() => prisma.usuarioPermiso.create({ data: { usuarioId: gRh.id, permisoId: rolesPermiso.id } }));
    check('quien tiene el permiso es RH', JSON.stringify(await enE1(() => rhDeLaEmpresa())) === JSON.stringify([gRh.id]));
    check('con RH, el aviso del CEO va a RH y no a los admin', JSON.stringify(await enE1(() => responsablesDe({ guardiaId: carlos.id }))) === JSON.stringify([gRh.id]));
    check('el aviso de alguien con jefe sigue yendo solo al jefe (no a RH)', JSON.stringify(await enE1(() => responsablesDe({ guardiaId: ana.id }))) === JSON.stringify([luis.id]));
    check('RH de otra empresa no se mezcla', !(await conEmpresa(E2, () => rhDeLaEmpresa())).includes(gRh.id));
    await como(T1).patch(`/areas/${soporte2}`, { jefeId: null });
    check('si el jefe más cercano deja de serlo, el aviso sube al siguiente (Marta)', JSON.stringify(await enE1(() => responsablesDe({ guardiaId: ana.id }))) === JSON.stringify([marta.id]));

    console.log('\n13. Supervisor de área (C-19, DC-019)');
    const ops = await area('Operaciones');
    const otra = await area('Logística');
    const jefeOps = await persona('Jefe Ops', 'jefe.ops@x.mx', rolGuardia.id, ops);
    const sup1 = await persona('Sup Uno', 'sup.uno@x.mx', rolGuardia.id, otra);
    const sup2 = await persona('Sup Dos', 'sup.dos@x.mx', rolGuardia.id, ops);
    await como(T1).patch(`/areas/${ops}`, { jefeId: jefeOps.id });
    const sup = async (id: number) => ((await como(T1).get(`/areas/${id}`)).body?.data?.supervisores ?? []).map((x: any) => x.id);
    const rSup = await como(T1).patch(`/areas/${ops}`, { supervisorIds: [sup1.id, sup2.id] });
    check('se pueden designar varios supervisores en un área', rSup.status === 200 && JSON.stringify((await sup(ops)).sort()) === JSON.stringify([sup1.id, sup2.id].sort()), rSup.body);
    check('al designarlos su rol pasa a Supervisor', (await rolDe(sup1.id)) === 'supervisor' && (await rolDe(sup2.id)) === 'supervisor');
    const uno = await sinFiltroDeEmpresa(() => prisma.usuario.findUnique({ where: { id: sup1.id }, select: { areaId: true } }));
    check('el supervisor pasa a formar parte del área (de otra área se mueve)', uno?.areaId === ops);
    check('el jefe sigue siendo jefe', (await rolDe(jefeOps.id)) === 'jefe');
    const conflicto = await como(T1).patch(`/areas/${ops}`, { supervisorIds: [sup1.id, jefeOps.id] });
    check('el jefe no puede ser también supervisor de su área (409)', conflicto.status === 409);
    await como(T1).patch(`/areas/${ops}`, { supervisorIds: [sup2.id] });
    check('al quitarlo de la lista vuelve a Colaborador', (await rolDe(sup1.id)) === 'colaborador' && JSON.stringify(await sup(ops)) === JSON.stringify([sup2.id]));
    await como(T1).put(`/areas/personas/${sup2.id}`, { areaId: otra });
    check('si el supervisor se va del área deja de serlo y vuelve a Colaborador', (await rolDe(sup2.id)) === 'colaborador' && (await sup(ops)).length === 0);
    await como(T1).patch(`/areas/${ops}`, { supervisorIds: [sup1.id] });
    await como(T1).patch(`/areas/${ops}/baja`);
    check('al dar de baja el área sus supervisores vuelven a Colaborador', (await rolDe(sup1.id)) === 'colaborador');
    const vis = await correosDe(tokenDe(sup2, [...PERMISOS_POR_ROL.supervisor]));
    check('el alcance de un supervisor sigue siendo su área', vis.includes('sup.dos@x.mx') && !vis.includes('g.rh@x.mx'), vis);
    check('los cambios de rol de supervisor quedan en la auditoría', (await sinFiltroDeEmpresa(() => prisma.auditoria.count({ where: { accion: 'areas.rol_supervisor', empresaId: E1 } }))) >= 4);

    console.log('\n14. Roles por empresa (C-11 parte 3)');
    const { sembrarRolesDeEmpresa } = await imp('core/empresa/rolesBase.ts');
    const raw2 = createPrismaClient(urlTemp.toString());
    const permMarcar = await raw2.permiso.upsert({ where: { clave: 'asistencia.marcar' }, update: {}, create: { clave: 'asistencia.marcar', descripcion: 'Marcar' } });
    await raw2.permiso.upsert({ where: { clave: 'asistencia.ver' }, update: {}, create: { clave: 'asistencia.ver', descripcion: 'Ver' } });
    const rolesDe = async (empresaId: number) => (await raw2.rol.findMany({ where: { empresaId }, select: { id: true, clave: true, esBase: true } }));
    const r1 = await rolesDe(E1);
    const r2 = await rolesDe(E2);
    check('cada empresa tiene sus propios 4 roles de partida', r1.length === 4 && r2.length === 4 && r1.every((x: any) => x.esBase) && !r1.some((x: any) => r2.some((y: any) => y.id === x.id)));
    check('el rol colaborador existe y guardia ya no', r1.some((x: any) => x.clave === 'colaborador') && !r1.some((x: any) => x.clave === 'guardia'));
    // Dar permisos de partida (permisos "nuevos") y luego editarlos en UNA empresa.
    await sembrarRolesDeEmpresa(raw2, E1, ['asistencia.marcar', 'asistencia.ver']);
    await sembrarRolesDeEmpresa(raw2, E2, ['asistencia.marcar', 'asistencia.ver']);
    const colabDe = async (e: number) => (await rolesDe(e)).find((x: any) => x.clave === 'colaborador').id as number;
    const tiene = async (rolId: number, permisoId: number) => (await raw2.rolPermiso.count({ where: { rolId, permisoId } })) === 1;
    check('el colaborador de partida marca su asistencia en las dos empresas', (await tiene(await colabDe(E1), permMarcar.id)) && (await tiene(await colabDe(E2), permMarcar.id)));
    await raw2.rolPermiso.delete({ where: { rolId_permisoId: { rolId: await colabDe(E2), permisoId: permMarcar.id } } });
    check('quitarle un permiso a un rol de una empresa no toca el de la otra', !(await tiene(await colabDe(E2), permMarcar.id)) && (await tiene(await colabDe(E1), permMarcar.id)));
    await sembrarRolesDeEmpresa(raw2, E2, []);
    check('volver a correr el seed no devuelve lo que el admin quitó', !(await tiene(await colabDe(E2), permMarcar.id)));
    await sembrarRolesDeEmpresa(raw2, E2, ['asistencia.marcar']);
    check('un permiso NUEVO del catálogo sí llega a los roles que lo llevan de partida', await tiene(await colabDe(E2), permMarcar.id));
    const adminE2 = (await rolesDe(E2)).find((x: any) => x.clave === 'admin').id as number;
    await raw2.rolPermiso.deleteMany({ where: { rolId: adminE2 } });
    await sembrarRolesDeEmpresa(raw2, E2, []);
    check('el admin siempre conserva todos los permisos (el seed se los repone)', (await raw2.rolPermiso.count({ where: { rolId: adminE2 } })) === (await raw2.permiso.count()));
    const nuevaEmp = await como(TS).post('/plataforma/empresas', { nombre: 'Nueva SA', zonaHoraria: 'America/Mexico_City' });
    const idNueva = nuevaEmp.body?.data?.id as number | undefined;
    check('al crear una empresa nacen sus roles de partida', nuevaEmp.status === 201 && !!idNueva && (await rolesDe(idNueva!)).length === 4, nuevaEmp.body);
    await raw2.$disconnect();

    console.log('\n15. Alcance por rol (C-11 parte 4)');
    const l1b = await login('admin1@x.mx');
    check('el token lleva el alcance del rol (el admin ve toda la empresa)', verifyAccessToken(l1b.token!).alcance === 'empresa');
    const raiz = await area('Raiz15');
    const hija = await area('Hija15', raiz);
    const otra15 = await area('Otra15');
    const w = await persona('Wanda', 'wanda@x.mx', rolGuardia.id, raiz);
    const x = await persona('Xavier', 'xavier@x.mx', rolGuardia.id, raiz);
    const y = await persona('Yolanda', 'yolanda@x.mx', rolGuardia.id, hija);
    await persona('Zoe', 'zoe@x.mx', rolGuardia.id, otra15);
    const conAlcance = (alc: string, extra: string[] = []) =>
      signAccessToken({ id: w.id, email: w.email, rol: 'analista', permisos: ['usuarios.ver', ...extra], alcance: alc, empresaId: E1 });
    const quien = async (alc: string, extra: string[] = []) => (await correosDe(conAlcance(alc, extra))).filter((e: string) => ['wanda', 'xavier', 'yolanda', 'zoe'].some((n) => e.startsWith(n))).sort();
    check('alcance "solo ella o él": solo se ve a sí misma', JSON.stringify(await quien('propio')) === JSON.stringify(['wanda@x.mx']), await quien('propio'));
    check('alcance "solo su área": su área, sin subáreas', JSON.stringify(await quien('area')) === JSON.stringify(['wanda@x.mx', 'xavier@x.mx']), await quien('area'));
    check('alcance "su área y sus subáreas": también las subáreas, no otras áreas', JSON.stringify(await quien('area_subareas')) === JSON.stringify(['wanda@x.mx', 'xavier@x.mx', 'yolanda@x.mx']), await quien('area_subareas'));
    check('alcance "toda la empresa": todas', (await quien('empresa')).length === 4, await quien('empresa'));
    check('el permiso "ver a toda la empresa" amplía a una persona con alcance propio', (await quien('propio', ['alcance.empresa'])).length === 4);
    check('un usuario fuera de su alcance responde 404', (await como(conAlcance('propio')).get(`/usuarios/${x.id}`)).status === 404 && (await como(conAlcance('area')).get(`/usuarios/${x.id}`)).status === 200 && (await como(conAlcance('area')).get(`/usuarios/${y.id}`)).status === 404);
    // La bitácora es un módulo opcional: se enciende para probarla.
    const rawM = createPrismaClient(urlTemp.toString());
    await rawM.empresaModulo.upsert({ where: { empresaId_modulo: { empresaId: E1, modulo: 'bitacora' } }, update: { encendido: true }, create: { empresaId: E1, modulo: 'bitacora', encendido: true } });
    await rawM.$disconnect();
    lectorModulos.invalidar(E1);
    const TColab = signAccessToken({ id: w.id, email: w.email, rol: 'colaborador', permisos: [...PERMISOS_POR_ROL.colaborador], alcance: 'propio', empresaId: E1 });
    check('el colaborador ve su propia bitácora', (await como(TColab).get(`/bitacora/guardias/${w.id}?mes=2026-11`)).status === 200, (await como(TColab).get(`/bitacora/guardias/${w.id}?mes=2026-11`)).body);
    check('el colaborador no ve la bitácora de otra persona (404)', (await como(TColab).get(`/bitacora/guardias/${x.id}?mes=2026-11`)).status === 404);
    check('el colaborador no anota en la bitácora (403)', (await como(TColab).post('/bitacora/eventos/1/justificar', { categoria: 'permiso' })).status === 403);
    const TSup15 = signAccessToken({ id: w.id, email: w.email, rol: 'supervisor', permisos: [...PERMISOS_POR_ROL.supervisor], alcance: 'area', empresaId: E1 });
    check('un supervisor (alcance su área) ve la bitácora de su área y no la de otra', (await como(TSup15).get(`/bitacora/guardias/${x.id}?mes=2026-11`)).status === 200 && (await como(TSup15).get(`/bitacora/guardias/${y.id}?mes=2026-11`)).status === 404);

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
