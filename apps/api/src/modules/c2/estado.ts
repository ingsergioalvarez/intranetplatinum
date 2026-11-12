import {
  GRAVEDAD_SITIO_C2,
  type ClienteC2,
  type ContactoTelefono,
  type EstadoSitioC2,
  type FilaAsistencia,
  type GuardiaC2,
  type SitioC2,
} from '@platinum/shared';

/** Un sitio activo con su cliente y su supervisor, tal como lo entrega el repositorio. */
export interface SitioBase {
  id: number;
  nombre: string;
  cliente: { id: number; nombre: string };
  supervisor: ContactoTelefono | null;
}

const MIN = 60_000;
/** Una jornada que sigue abierta mucho después de acabar su turno se toma como olvido de checar la salida: ya se fue. */
const GRACIA_SALIDA_MS = 2 * 3_600_000;
/** Turno sin duración conocida: se supone de 12 horas. */
const HORAS_SIN_DATO = 12;

/**
 * Estado de un sitio ahora (A-61) a partir de las filas de asistencia de hoy y de ayer (por los turnos de noche). No
 * considera el SOS: eso lo pone quien consulta. Un turno cuenta mientras no haya terminado.
 */
export function calcularSitio(base: SitioBase, filas: FilaAsistencia[], ahora: Date): SitioC2 {
  const t = ahora.getTime();
  const presentes: GuardiaC2[] = [];
  const faltantes: GuardiaC2[] = [];
  const esperando: GuardiaC2[] = [];
  const vistos = new Set<string>();

  for (const f of filas) {
    if (f.sitio?.id !== base.id) continue;
    const g = {
      id: f.guardia.id,
      nombre: f.guardia.nombre,
      foto: f.guardia.foto ?? null,
      fotoAprobada: f.guardia.fotoAprobada ?? false,
    };
    if (f.jornada) {
      const clave = `j${f.jornada.entrada.id}`;
      if (vistos.has(clave) || f.jornada.salida) continue;
      const programada = f.jornada.programada;
      if (programada && t > Date.parse(programada.salida) + GRACIA_SALIDA_MS) continue;
      vistos.add(clave);
      presentes.push({ ...g, presente: true, entrada: f.jornada.entrada.registradaEn, horario: programada });
    } else if (f.turno) {
      const clave = `t${f.guardia.id}:${f.turno.entrada}`;
      if (vistos.has(clave)) continue;
      const inicio = Date.parse(f.turno.entrada);
      const fin = inicio + (f.turno.horas ?? HORAS_SIN_DATO) * 60 * MIN;
      if (t >= fin || f.turno.estado === 'por_entrar') continue;
      vistos.add(clave);
      const guardia = { ...g, presente: false, entrada: null, horario: { entrada: f.turno.entrada, salida: new Date(fin).toISOString() } };
      (f.turno.estado === 'por_llegar' ? esperando : faltantes).push(guardia);
    }
  }

  let estado: EstadoSitioC2;
  if (presentes.length > 0) estado = faltantes.length > 0 ? 'parcial' : 'cubierto';
  else if (faltantes.length > 0) estado = 'solo';
  else estado = esperando.length > 0 ? 'por_llegar' : 'sin_turno';

  const desde = faltantes.length ? faltantes.map((g) => g.horario!.entrada).sort()[0] : null;
  return {
    id: base.id,
    nombre: base.nombre,
    estado,
    desde: estado === 'solo' || estado === 'parcial' ? desde : null,
    supervisor: base.supervisor,
    guardias: [...presentes, ...faltantes, ...esperando],
  };
}

/** Agrupa los sitios por cliente: los de peor estado primero, y el cliente toma el peor de sus sitios. */
export function agruparPorCliente(items: { cliente: { id: number; nombre: string }; sitio: SitioC2 }[]): ClienteC2[] {
  const porCliente = new Map<number, ClienteC2>();
  for (const { cliente, sitio } of items) {
    const c = porCliente.get(cliente.id) ?? { id: cliente.id, nombre: cliente.nombre, estado: 'sin_turno', solos: 0, parciales: 0, sitios: [] };
    c.sitios.push(sitio);
    if (sitio.estado === 'solo') c.solos++;
    if (sitio.estado === 'parcial') c.parciales++;
    if (GRAVEDAD_SITIO_C2[sitio.estado] < GRAVEDAD_SITIO_C2[c.estado]) c.estado = sitio.estado;
    porCliente.set(cliente.id, c);
  }
  const clientes = [...porCliente.values()];
  for (const c of clientes) {
    c.sitios.sort((a, b) => GRAVEDAD_SITIO_C2[a.estado] - GRAVEDAD_SITIO_C2[b.estado] || a.nombre.localeCompare(b.nombre, 'es'));
  }
  return clientes.sort((a, b) => GRAVEDAD_SITIO_C2[a.estado] - GRAVEDAD_SITIO_C2[b.estado] || a.nombre.localeCompare(b.nombre, 'es'));
}
