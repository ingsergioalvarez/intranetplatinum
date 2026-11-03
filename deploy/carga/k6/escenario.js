// Prueba de carga de Platinum (A-62). Simula guardias, supervisores, admin y clientes con la app abierta,
// por escalones, hasta PICO usuarios simultáneos (máximo 300). Solo contra la copia aparte `platinum-carga`.
//
//   docker run --rm --network platinum-carga_default -v "$PWD/k6:/scripts" grafana/k6 run \
//     -e BASE=http://api:4000 -e PICO=300 /scripts/escenario.js
//
// Cada usuario virtual inicia sesión una vez y repite lo que su pantalla consulta sin parar (acelerado: la app real
// consulta cada 30-60 s, aquí cada 4-8 s, así que cada usuario virtual pesa como ~6 personas reales).
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://api:4000';
const PICO = Math.min(Number(__ENV.PICO || 300), 300);
const PASO = Number(__ENV.PASO_SEG || 120); // segundos por escalón
const PASSWORD = 'Carga2026xx';

// Escalones de usuarios simultáneos; se corta en PICO.
const ESCALONES = [25, 50, 100, 150, 200, 300].filter((n) => n <= PICO);
// Reparto: casi todo son guardias.
const REPARTO = { guardia: 0.8, supervisor: 0.1, admin: 0.02, cliente: 0.08 };
const CUENTAS = { guardia: 240, supervisor: 30, admin: 5, cliente: 25 };

const loginMs = new Trend('login_ms', true);
const fallos = new Rate('fallos');

function etapas(rol) {
  const e = [];
  for (const n of ESCALONES) {
    const meta = Math.max(1, Math.round(n * REPARTO[rol]));
    e.push({ duration: '20s', target: meta }, { duration: `${PASO}s`, target: meta });
  }
  e.push({ duration: '20s', target: 0 });
  return e;
}

const escenario = (rol) => ({
  executor: 'ramping-vus',
  startVUs: 0,
  stages: etapas(rol),
  gracefulRampDown: '10s',
  exec: rol,
  tags: { rol },
});

export const options = {
  scenarios: {
    guardia: escenario('guardia'),
    supervisor: escenario('supervisor'),
    admin: escenario('admin'),
    cliente: escenario('cliente'),
  },
  thresholds: {
    // Lo que consideramos "se saturó": errores o respuestas lentas sostenidas. Con más de 10 % de fallos la
    // prueba se detiene sola (no tiene caso seguir castigando al servidor).
    fallos: ['rate<0.02', { threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: ['p(95)<1500'],
    // Estos aparecen por separado en el resumen.
    'http_req_duration{endpoint:login}': ['p(95)<3000'],
    'http_req_duration{endpoint:g_estado}': ['p(95)<1000'],
    'http_req_duration{endpoint:avisos}': ['p(95)<1000'],
    'http_req_duration{endpoint:s_dia}': ['p(95)<1500'],
    'http_req_duration{endpoint:s_tablero}': ['p(95)<1500'],
    'http_req_duration{endpoint:a_usuarios}': ['p(95)<1500'],
  },
};

// Cada usuario virtual guarda su sesión.
const sesion = {};

function correo(rol, n) {
  if (rol === 'guardia') return `carga_g${n}@carga.local`;
  if (rol === 'supervisor') return `carga_sup${n}@carga.local`;
  if (rol === 'admin') return `carga_admin${n}@carga.local`;
  return `carga_cli${((n - 1) % 5) + 1}_${Math.floor((n - 1) / 5) + 1}@carga.local`;
}

function entrar(rol) {
  if (sesion[__VU]) return sesion[__VU];
  const n = ((__VU - 1) % CUENTAS[rol]) + 1;
  const r = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: correo(rol, n), password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } },
  );
  loginMs.add(r.timings.duration);
  const ok = check(r, { 'login 200': (x) => x.status === 200 });
  fallos.add(!ok);
  if (!ok) return null;
  sesion[__VU] = { Authorization: `Bearer ${r.json('data.accessToken')}` };
  return sesion[__VU];
}

function get(h, ruta, nombre) {
  const r = http.get(`${BASE}/api${ruta}`, { headers: h, tags: { endpoint: nombre } });
  const ok = check(r, { [`${nombre} 200`]: (x) => x.status === 200 });
  fallos.add(!ok);
  return r;
}

const hoy = () => new Date().toISOString().slice(0, 10);
const mes = () => new Date().toISOString().slice(0, 7);
const pausa = () => sleep(4 + Math.random() * 4);

export function guardia() {
  const h = entrar('guardia');
  if (!h) return sleep(5);
  group('guardia', () => {
    get(h, '/asistencia/estado', 'g_estado');
    get(h, '/avisos', 'avisos');
    get(h, '/emergencias/mia', 'emergencia_mia');
    get(h, '/sitios/mios', 'g_sitios');
    get(h, `/asistencia/mias?mes=${mes()}`, 'g_mias');
  });
  pausa();
}

export function supervisor() {
  const h = entrar('supervisor');
  if (!h) return sleep(5);
  group('supervisor', () => {
    get(h, '/avisos', 'avisos');
    get(h, `/asistencia/dia?fecha=${hoy()}&page=1&limit=25`, 's_dia');
    get(h, '/asistencia/tablero', 's_tablero');
    get(h, '/emergencias?estado=activas', 'emergencias_activas');
    get(h, '/solicitudes-cobertura', 's_solicitudes');
    get(h, '/emergencias/mia', 'emergencia_mia');
  });
  pausa();
}

export function admin() {
  const h = entrar('admin');
  if (!h) return sleep(5);
  group('admin', () => {
    get(h, '/avisos', 'avisos');
    get(h, `/asistencia/dia?fecha=${hoy()}&page=1&limit=50`, 's_dia');
    get(h, '/asistencia/tablero', 's_tablero');
    get(h, '/emergencias?estado=activas', 'emergencias_activas');
    get(h, '/usuarios?page=1&limit=25', 'a_usuarios');
    get(h, '/clientes?page=1&limit=25', 'a_clientes');
  });
  pausa();
}

export function cliente() {
  const h = entrar('cliente');
  if (!h) return sleep(5);
  group('cliente', () => {
    get(h, '/avisos', 'avisos');
    get(h, '/sitios/del-cliente', 'c_sitios');
    get(h, '/reportes?page=1&limit=20', 'c_reportes');
  });
  pausa();
}
