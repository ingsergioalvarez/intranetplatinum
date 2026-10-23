import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Search, UserRound, UsersRound } from 'lucide-react';
import {
  esUnoYUno,
  horaSalida,
  letraDia,
  mismoHorario,
  seCruzan,
  sumarDiasFecha,
  textoDias,
  type Asignacion,
  type AsignacionDeGuardia,
  type GuardiaDisponible,
  type PatronTurno,
  type Sitio,
  type TurnoCatalogo,
} from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { hoyLocal } from '../../core/format/fechas';
import { Button, Checkbox, FormField, Input, Modal, Spinner, cn, toast } from '../../components/ui';
import { asignacionActual, textoHorario } from '../catalogos/turnos.texto';
import { gruposService } from '../grupos/grupos.service';
import { clientesService, sitiosService } from './clientes.service';

/** Foto del guardia (o sus iniciales). */
export function Avatar({
  foto,
  nombre,
  grupo = false,
}: {
  foto?: string | null;
  nombre: string;
  grupo?: boolean;
}) {
  if (grupo) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <UsersRound className="size-5" />
      </span>
    );
  }
  if (foto) {
    return (
      <img
        src={foto}
        alt=""
        className="size-10 shrink-0 -scale-x-100 rounded-full object-cover ring-1 ring-slate-200"
      />
    );
  }
  const iniciales = nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
      {iniciales || <UserRound className="size-5" />}
    </span>
  );
}

type Filtro = 'todos' | 'sin' | 'asignados';

/**
 * Qué pasa con un guardia si se le asigna este turno (DA-37):
 * - libre: no tiene nada que estorbe.
 * - yaEsta: ya está en este mismo turno en este sitio (asignación individual).
 * - mismo: tiene este mismo horario en este sitio: pasa a la nueva asignación sin cambiarle nada.
 * - otroHorario: tiene otro horario en este sitio: el supervisor decide si lo cambia.
 * - grupoSitio: ya cubre este sitio con otro grupo.
 * - cruce: su turno en otro sitio se encima con este.
 */
type Situacion =
  | { tipo: 'libre' }
  | { tipo: 'yaEsta' }
  | { tipo: 'mismo' }
  | { tipo: 'otroHorario'; e: AsignacionDeGuardia }
  | { tipo: 'grupoSitio'; e: AsignacionDeGuardia }
  | { tipo: 'cruce'; e: AsignacionDeGuardia };

const bloquea = (s: Situacion) => s.tipo === 'yaEsta' || s.tipo === 'grupoSitio' || s.tipo === 'cruce';

/**
 * Asignar un turno del catálogo en el sitio a varios guardias o grupos (DA-37): tabla con foto,
 * lo que ya tienen asignado, filtros y búsqueda; primer día de cada uno (en "un día sí, uno no" se
 * reparten Día A y Día B); opción de crear un grupo con los seleccionados. Si alguien ya tiene otro
 * horario en este sitio, el supervisor elige si lo cambia; solo se bloquea si ya está en este turno,
 * si cubre el sitio con otro grupo o si se le encima con su turno en otro sitio.
 */
export function AsignarTurnoModal({
  sitio,
  turno,
  existentes,
  onClose,
}: {
  sitio: Sitio;
  turno: TurnoCatalogo;
  /** Asignaciones de este turno en el sitio (referencia para Día A / Día B). */
  existentes: Asignacion[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const hoy = hoyLocal();
  const unoYUno = esUnoYUno(turno.dias);
  const [pestana, setPestana] = useState<'guardias' | 'grupos'>('guardias');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [guardias, setGuardias] = useState<Map<number, string>>(new Map());
  const [grupos, setGrupos] = useState<Map<number, string>>(new Map());
  const [reemplazar, setReemplazar] = useState<Set<number>>(new Set());
  const [hasta, setHasta] = useState('');
  const [crearGrupo, setCrearGrupo] = useState(false);
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [desdeGrupo, setDesdeGrupo] = useState(hoy);

  const disponibles = useQuery({
    queryKey: sitiosService.keys.disponibles,
    queryFn: sitiosService.guardiasDisponibles,
  });
  const listaGrupos = useQuery({
    queryKey: gruposService.keys.list('activos'),
    queryFn: () => gruposService.list('activos'),
  });

  const referencia = existentes.map((a) => a.desde).sort()[0] ?? hoy;
  const patron = (desde: string): PatronTurno => ({
    tipo: hasta ? 'temporal' : 'fija',
    horas: turno.horas,
    dias: turno.dias,
    horaInicio: turno.horaEntrada,
    horaFin: horaSalida(turno.horas, turno.horaEntrada),
    desde,
    hasta: hasta || null,
  });

  /** Primer día sugerido: en "un día sí, uno no", el lado (A o B) con menos gente. */
  const primerDiaSugerido = (seleccion: Map<number, string>) => {
    if (!unoYUno) return hoy;
    const fechas = [
      ...existentes.filter((a) => a.vigente || a.desde > hoy).map((a) => a.desde),
      ...seleccion.values(),
    ];
    const enA = fechas.filter((f) => letraDia(f, referencia) === 'A').length;
    const quiere = enA <= fechas.length - enA ? 'A' : 'B';
    return letraDia(hoy, referencia) === quiere ? hoy : sumarDiasFecha(hoy, 1);
  };

  const situacion = (g: GuardiaDisponible, desde: string): Situacion => {
    const nuevo = patron(desde);
    for (const e of g.asignaciones) {
      if (e.sitio.id === sitio.id) {
        if (e.grupo !== null) return { tipo: 'grupoSitio', e };
        if (mismoHorario(nuevo, e))
          return !crearGrupo && e.turnoId === turno.id ? { tipo: 'yaEsta' } : { tipo: 'mismo' };
        return { tipo: 'otroHorario', e };
      }
      if (seCruzan(nuevo, e)) return { tipo: 'cruce', e };
    }
    return { tipo: 'libre' };
  };
  const desdeDe = (id: number) =>
    crearGrupo ? desdeGrupo : (guardias.get(id) ?? primerDiaSugerido(guardias));

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (disponibles.data ?? []).filter(
      (g) =>
        (!q || g.nombre.toLowerCase().includes(q) || g.email.toLowerCase().includes(q)) &&
        (filtro === 'todos' || (filtro === 'sin') === (g.asignaciones.length === 0)),
    );
  }, [disponibles.data, busqueda, filtro]);

  const alternar = (mapa: Map<number, string>, set: (m: Map<number, string>) => void, id: number) => {
    const m = new Map(mapa);
    if (m.has(id)) m.delete(id);
    else m.set(id, primerDiaSugerido(m));
    set(m);
  };
  const decidir = (id: number, cambiar: boolean) => {
    const r = new Set(reemplazar);
    if (cambiar) r.add(id);
    else r.delete(id);
    setReemplazar(r);
    if (!cambiar) alternar(guardias, setGuardias, id);
  };

  const nombres = new Map((disponibles.data ?? []).map((g) => [g.id, g]));
  const seleccionados = [...guardias.keys()]
    .map((id) => nombres.get(id))
    .filter((g): g is GuardiaDisponible => !!g);
  const situaciones = new Map(seleccionados.map((g) => [g.id, situacion(g, desdeDe(g.id))]));
  const pendientes = seleccionados.filter(
    (g) => situaciones.get(g.id)?.tipo === 'otroHorario' && !reemplazar.has(g.id),
  );
  const bloqueados = seleccionados.filter((g) => bloquea(situaciones.get(g.id)!));

  const asignar = useMutation({
    mutationFn: async () => {
      const gruposSel = [...grupos].map(([grupoId, desde]) => ({ grupoId, desde }));
      let guardiasSel = [...guardias].map(([usuarioId, desde]) => ({ usuarioId, desde }));
      if (crearGrupo) {
        const nuevo = await gruposService.crear({ nombre: nombreGrupo, usuarioIds: [...guardias.keys()] });
        gruposSel.push({ grupoId: nuevo.id, desde: desdeGrupo });
        guardiasSel = [];
      }
      return sitiosService.asignarTurno(sitio.id, {
        turnoId: turno.id,
        hasta: hasta || null,
        guardias: guardiasSel,
        grupos: gruposSel,
        reemplazar: [...reemplazar].filter((id) => guardias.has(id)),
      });
    },
    onSuccess: (creadas) => {
      void qc.invalidateQueries({ queryKey: sitiosService.keys.all });
      void qc.invalidateQueries({ queryKey: clientesService.keys.all });
      void qc.invalidateQueries({ queryKey: gruposService.keys.all });
      toast.success(creadas.length === 1 ? 'Turno asignado' : `Turno asignado a ${creadas.length}`);
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const total = guardias.size + grupos.size;
  const puedeCrearGrupo = guardias.size >= 2;

  /** Texto bajo el nombre según su situación. */
  const nota = (s: Situacion) => {
    switch (s.tipo) {
      case 'yaEsta':
        return (
          <span className="block text-xs text-slate-500">
            Ya está en este turno. Para meterlo a una cuadrilla, márcalo junto con otro guardia y elige "Crear
            un grupo".
          </span>
        );
      case 'mismo':
        return <span className="text-xs text-emerald-700">Mismo horario: pasa sin cambios</span>;
      case 'otroHorario':
        return (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
            <AlertTriangle className="size-3.5 shrink-0" /> Tiene otro horario en este sitio (
            {s.e.turnoNombre ?? 'turno anterior'})
          </span>
        );
      case 'grupoSitio':
        return (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
            <AlertTriangle className="size-3.5 shrink-0" /> Ya cubre este sitio con el grupo {s.e.grupo}
          </span>
        );
      case 'cruce':
        return (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
            <AlertTriangle className="size-3.5 shrink-0" /> Se cruza con su turno en {s.e.sitio.nombre}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Asignar: ${turno.nombre}`}
      description={`${sitio.nombre} · ${textoHorario(turno.horas, turno.horaEntrada)} · ${textoDias(turno.dias).toLowerCase()}`}
      footer={
        <>
          <span className="mr-auto hidden text-sm text-slate-500 md:inline">
            {total === 0 ? 'Nadie seleccionado' : `${total} seleccionado${total === 1 ? '' : 's'}`}
          </span>
          <Button variant="secondary" onClick={onClose} disabled={asignar.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={
              total === 0 ||
              pendientes.length > 0 ||
              bloqueados.length > 0 ||
              (crearGrupo && nombreGrupo.trim().length < 2)
            }
            loading={asignar.isPending}
            onClick={() => asignar.mutate()}
          >
            {crearGrupo ? 'Crear grupo y asignar' : 'Asignar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium" role="tablist">
          {(['guardias', 'grupos'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={pestana === p}
              onClick={() => setPestana(p)}
              className={cn(
                'rounded-md px-3 py-2',
                pestana === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600',
              )}
            >
              {p === 'guardias'
                ? `Guardias${guardias.size ? ` (${guardias.size})` : ''}`
                : `Grupos${grupos.size ? ` (${grupos.size})` : ''}`}
            </button>
          ))}
        </div>

        {pestana === 'guardias' ? (
          <>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Buscar guardia"
                  aria-label="Buscar guardia"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div
                className="grid grid-cols-3 rounded-lg bg-slate-100 p-1 text-xs font-medium"
                role="radiogroup"
                aria-label="Filtro"
              >
                {(
                  [
                    ['todos', 'Todos'],
                    ['sin', 'Sin asignar'],
                    ['asignados', 'Asignados'],
                  ] as const
                ).map(([f, label]) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={filtro === f}
                    onClick={() => setFiltro(f)}
                    className={cn(
                      'rounded-md px-2.5 py-1.5',
                      filtro === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {disponibles.isPending ? (
              <div className="flex justify-center py-8 text-brand-600">
                <Spinner className="size-6" />
              </div>
            ) : filtrados.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Sin guardias con ese filtro.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {filtrados.map((g) => {
                  const marcado = guardias.has(g.id);
                  const s = situacion(g, desdeDe(g.id));
                  // Quien ya está en este turno sí se puede marcar: para pasarlo a una cuadrilla nueva.
                  const deshabilitado = bloquea(s) && s.tipo !== 'yaEsta' && !marcado;
                  return (
                    <li key={g.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50',
                          deshabilitado && 'cursor-not-allowed opacity-60',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-5 shrink-0 rounded border-slate-300 accent-brand-700"
                          checked={marcado}
                          disabled={deshabilitado}
                          onChange={() => {
                            if (marcado) setReemplazar(new Set([...reemplazar].filter((x) => x !== g.id)));
                            alternar(guardias, setGuardias, g.id);
                          }}
                        />
                        <Avatar foto={g.foto} nombre={g.nombre} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-900">{g.nombre}</span>
                          <span className="block truncate text-xs text-slate-500">{asignacionActual(g)}</span>
                          {nota(s)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Quien tiene otro horario en este sitio: el supervisor decide. */}
            {seleccionados
              .filter((g) => situaciones.get(g.id)?.tipo === 'otroHorario')
              .map((g) => {
                const s = situaciones.get(g.id) as Extract<Situacion, { tipo: 'otroHorario' }>;
                const cambia = reemplazar.has(g.id);
                return (
                  <div
                    key={g.id}
                    className={cn(
                      'space-y-2 rounded-xl p-3 text-sm',
                      cambia ? 'bg-brand-50 text-brand-900' : 'bg-amber-50 text-amber-900',
                    )}
                  >
                    <p>
                      <strong>{g.nombre}</strong> está en <strong>{s.e.turnoNombre ?? 'otro horario'}</strong>{' '}
                      en {sitio.nombre};{' '}
                      {crearGrupo ? `el grupo será de "${turno.nombre}"` : `este turno es "${turno.nombre}"`}.
                      {cambia &&
                        ' Su turno actual terminará un día antes del nuevo y se le avisará de su nuevo horario.'}
                    </p>
                    {!cambia && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => decidir(g.id, true)}>
                          Cambiarlo a este horario
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => decidir(g.id, false)}>
                          Quitarlo de la selección
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

            {guardias.size > 0 && !crearGrupo && (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">Primer día de turno</p>
                {[...guardias].map(([id, desde]) => {
                  const g = nombres.get(id);
                  const s = situaciones.get(id);
                  return (
                    <div
                      key={id}
                      className="grid grid-cols-[1fr_auto] items-center gap-2 md:grid-cols-[1fr_10rem_4rem]"
                    >
                      <span className="truncate text-sm text-slate-800">{g?.nombre}</span>
                      <Input
                        type="date"
                        aria-label={`Primer día de ${g?.nombre}`}
                        value={desde}
                        min={hoy}
                        onChange={(e) =>
                          e.target.value && setGuardias(new Map(guardias).set(id, e.target.value))
                        }
                        className="h-10"
                      />
                      {unoYUno && (
                        <span className="col-span-2 text-xs font-semibold text-brand-700 md:col-span-1">
                          Día {letraDia(desde, referencia)}
                        </span>
                      )}
                      {s && bloquea(s) && <span className="col-span-2 md:col-span-3">{nota(s)}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {puedeCrearGrupo && (
              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                <Checkbox
                  label="Crear un grupo con los seleccionados"
                  description="Entran juntos el mismo día y se asignan como cuadrilla."
                  checked={crearGrupo}
                  onChange={(e) => setCrearGrupo(e.target.checked)}
                />
                {crearGrupo && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FormField label="Nombre del grupo" required>
                      <Input
                        value={nombreGrupo}
                        onChange={(e) => setNombreGrupo(e.target.value)}
                        placeholder="Ej. Cuadrilla A"
                      />
                    </FormField>
                    <FormField label="Primer día de turno" required>
                      <Input
                        type="date"
                        value={desdeGrupo}
                        min={hoy}
                        onChange={(e) => e.target.value && setDesdeGrupo(e.target.value)}
                      />
                    </FormField>
                  </div>
                )}
              </div>
            )}
          </>
        ) : listaGrupos.isPending ? (
          <div className="flex justify-center py-8 text-brand-600">
            <Spinner className="size-6" />
          </div>
        ) : !listaGrupos.data?.length ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No hay grupos. Selecciona guardias y marca "Crear un grupo con los seleccionados".
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {listaGrupos.data.map((g) => {
              const desde = grupos.get(g.id);
              return (
                <li key={g.id} className="px-3 py-2.5">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 rounded border-slate-300 accent-brand-700"
                      checked={desde !== undefined}
                      onChange={() => alternar(grupos, setGrupos, g.id)}
                    />
                    <Avatar nombre={g.nombre} grupo />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">{g.nombre}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {g.integrantes.length} {g.integrantes.length === 1 ? 'guardia' : 'guardias'} ·{' '}
                        {g.asignacionesVigentes ? `${g.asignacionesVigentes} asignación(es)` : 'Sin sitio'}
                      </span>
                    </span>
                  </label>
                  {desde !== undefined && (
                    <div className="mt-2 flex items-center gap-2 pl-8">
                      <Input
                        type="date"
                        aria-label={`Primer día de ${g.nombre}`}
                        value={desde}
                        min={hoy}
                        onChange={(e) =>
                          e.target.value && setGrupos(new Map(grupos).set(g.id, e.target.value))
                        }
                        className="h-10 w-44"
                      />
                      {unoYUno && (
                        <span className="text-xs font-semibold text-brand-700">
                          Día {letraDia(desde, referencia)}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <FormField label="Hasta (opcional)" hint="Sin fecha: el turno sigue hasta que lo termines.">
          <Input
            type="date"
            value={hasta}
            min={hoy}
            onChange={(e) => setHasta(e.target.value)}
            className="md:w-56"
          />
        </FormField>
      </div>
    </Modal>
  );
}
