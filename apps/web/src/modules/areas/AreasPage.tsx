import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Network,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { ROL_DESCRIPCIONES, type Area, type CandidatoArea, type PersonaDeArea } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Spinner,
  Switch,
  toast,
  cn,
} from '../../components/ui';
import { PageHeader } from '../../components/layout/AppShell';
import { AreaModal } from './AreaModal';
import { ElegirPersonaModal } from './ElegirPersonaModal';
import { areasService } from './areas.service';

interface Nodo {
  area: Area;
  hijos: Nodo[];
}

/** Arma el árbol a partir de la lista plana; una subárea cuyo superior no está a la vista cuenta como de primer nivel. */
function armarArbol(areas: Area[]): Nodo[] {
  const nodos = new Map(areas.map((a) => [a.id, { area: a, hijos: [] as Nodo[] }]));
  const raices: Nodo[] = [];
  for (const nodo of nodos.values()) {
    const padre = nodo.area.padreId === null ? undefined : nodos.get(nodo.area.padreId);
    (padre ? padre.hijos : raices).push(nodo);
  }
  return raices;
}

type Modal =
  | { tipo: 'area'; area: Area | null; padreId?: number | null }
  | { tipo: 'persona' }
  | { tipo: 'jefe' }
  | null;

/** Áreas de la empresa (C-10): árbol de áreas y subáreas, sus personas y su jefe. */
export function AreasPage() {
  const qc = useQueryClient();
  const esSuper = useAuthStore((s) => !!s.user?.esSuperAdmin);
  const [verBajas, setVerBajas] = useState(false);
  const estado = verBajas ? 'todas' : 'activas';
  const lista = useQuery({
    queryKey: areasService.keys.list(estado),
    queryFn: () => areasService.list(estado),
  });
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null);
  const [plegadas, setPlegadas] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<Modal>(null);
  const [dandoDeBaja, setDandoDeBaja] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const areas = useMemo(() => lista.data ?? [], [lista.data]);
  const arbol = useMemo(() => armarArbol(areas), [areas]);
  const seleccionada = areas.find((a) => a.id === seleccionadaId) ?? null;
  const activas = areas.filter((a) => !a.deletedAt);
  const personasTotales = arbol.reduce((n, r) => n + r.area.personasTotal, 0);

  const refrescar = () => qc.invalidateQueries({ queryKey: areasService.keys.all });

  const baja = useMutation({
    mutationFn: (id: number) => areasService.baja(id),
    onSuccess: () => {
      setDandoDeBaja(false);
      setSeleccionadaId(null);
      void refrescar();
      void qc.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Área dada de baja');
    },
    onError: (e) => {
      setDandoDeBaja(false);
      toast.error(mensajeDeError(e));
    },
  });

  const reactivar = useMutation({
    mutationFn: (id: number) => areasService.reactivar(id),
    onSuccess: () => {
      void refrescar();
      toast.success('Área reactivada');
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => areasService.eliminar(id),
    onSuccess: () => {
      setEliminando(false);
      setSeleccionadaId(null);
      void refrescar();
      void qc.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Área eliminada');
    },
    onError: (e) => {
      setEliminando(false);
      toast.error(mensajeDeError(e));
    },
  });

  /** Subáreas de un área a cualquier nivel (las que se ven en pantalla). */
  const descendientes = (id: number): number =>
    areas.filter((a) => a.padreId === id).reduce((n, h) => n + 1 + descendientes(h.id), 0);

  const alternar = (id: number) =>
    setPlegadas((actual) => {
      const nuevo = new Set(actual);
      if (!nuevo.delete(id)) nuevo.add(id);
      return nuevo;
    });

  const renderNodo = (nodo: Nodo, nivel: number) => {
    const { area } = nodo;
    const abierta = !plegadas.has(area.id);
    return (
      <li key={area.id}>
        <div
          className={cn(
            'flex items-center gap-1 rounded-lg pr-2 transition-colors',
            seleccionadaId === area.id ? 'bg-brand-50' : 'hover:bg-slate-50',
          )}
          style={{ paddingLeft: nivel * 16 }}
        >
          {nodo.hijos.length > 0 ? (
            <button
              type="button"
              onClick={() => alternar(area.id)}
              aria-label={abierta ? `Plegar ${area.nombre}` : `Desplegar ${area.nombre}`}
              className="flex size-8 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
            >
              {abierta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <span className="size-8 shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => setSeleccionadaId(area.id)}
            className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 py-1.5 text-left"
          >
            <span
              className={cn(
                'truncate text-sm',
                seleccionadaId === area.id ? 'font-semibold text-brand-800' : 'text-slate-800',
                area.deletedAt && 'italic text-slate-400 line-through',
              )}
            >
              {area.nombre}
            </span>
            <span className="shrink-0 text-xs text-slate-500">{area.personasTotal}</span>
          </button>
        </div>
        {nodo.hijos.length > 0 && abierta && <ul>{nodo.hijos.map((h) => renderNodo(h, nivel + 1))}</ul>}
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="Áreas"
        subtitle={
          lista.data
            ? `${activas.length} ${activas.length === 1 ? 'área' : 'áreas'} · ${personasTotales} ${personasTotales === 1 ? 'persona' : 'personas'}`
            : undefined
        }
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setModal({ tipo: 'area', area: null })}>
            <span className="hidden sm:inline">Nueva área</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        }
      />

      <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
        <Switch checked={verBajas} onChange={setVerBajas} label="Mostrar áreas dadas de baja" />
        <span>Mostrar áreas dadas de baja</span>
      </div>

      {lista.isPending ? (
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : lista.isError ? (
        <EmptyState title="No se pudieron cargar las áreas" description="Revisa tu conexión." />
      ) : areas.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Network className="size-8" />}
            title="Aún no tienes áreas"
            description="Crea la primera (RH, Sistemas, Técnicos…) y luego sus subáreas."
            action={
              <Button
                icon={<Plus className="size-4" />}
                onClick={() => setModal({ tipo: 'area', area: null })}
              >
                Nueva área
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_minmax(0,1fr)] md:items-start">
          <Card className={cn(seleccionada && 'hidden md:block')}>
            <ul className="p-2" aria-label="Árbol de áreas">
              {arbol.map((n) => renderNodo(n, 0))}
            </ul>
          </Card>

          <div className={cn(!seleccionada && 'hidden md:block')}>
            {seleccionada ? (
              <DetalleArea
                key={seleccionada.id}
                area={seleccionada}
                areas={areas}
                esSuper={esSuper}
                onVolver={() => setSeleccionadaId(null)}
                onSeleccionar={setSeleccionadaId}
                onModal={setModal}
                onBaja={() => setDandoDeBaja(true)}
                onEliminar={() => setEliminando(true)}
                onReactivar={() => reactivar.mutate(seleccionada.id)}
                reactivando={reactivar.isPending}
              />
            ) : (
              <Card>
                <EmptyState
                  title="Elige un área"
                  description="Toca un área del árbol para ver sus personas y su jefe."
                />
              </Card>
            )}
          </div>
        </div>
      )}

      {modal?.tipo === 'area' && (
        <AreaModal
          key={modal.area?.id ?? `nueva-${modal.padreId ?? 'raiz'}`}
          area={modal.area}
          padreInicial={modal.padreId}
          areas={areas}
          onClose={() => setModal(null)}
          onListo={(a) => {
            // Una subárea nueva se ve en la ficha de su área superior (con su lista de subáreas); lo demás, en la suya.
            const verEn = modal.area === null && a.padreId !== null ? a.padreId : a.id;
            if (a.padreId !== null) setPlegadas((p) => new Set([...p].filter((id) => id !== a.padreId)));
            setModal(null);
            setSeleccionadaId(verEn);
          }}
        />
      )}
      {modal?.tipo === 'persona' && seleccionada && (
        <AgregarPersona
          area={seleccionada}
          modo="persona"
          onClose={() => setModal(null)}
          onListo={refrescar}
        />
      )}
      {modal?.tipo === 'jefe' && seleccionada && (
        <AgregarPersona area={seleccionada} modo="jefe" onClose={() => setModal(null)} onListo={refrescar} />
      )}

      <ConfirmDialog
        open={dandoDeBaja && seleccionada !== null}
        title={`Dar de baja "${seleccionada?.nombreCompleto ?? ''}"`}
        description={
          seleccionada &&
          (seleccionada.personasTotal > 0 || seleccionada.subareas > 0
            ? `Se darán de baja también sus subáreas y sus ${seleccionada.personasTotal} personas quedarán sin área. Podrás reactivar el área después, pero tendrás que volver a agregar a las personas.`
            : 'El área no tiene personas ni subáreas. Podrás reactivarla después.')
        }
        confirmLabel="Dar de baja"
        variant="danger"
        loading={baja.isPending}
        onConfirm={() => seleccionada && baja.mutate(seleccionada.id)}
        onCancel={() => setDandoDeBaja(false)}
      />

      <ConfirmDialog
        open={eliminando && seleccionada !== null}
        title={`Eliminar definitivamente "${seleccionada?.nombreCompleto ?? ''}"`}
        description={
          seleccionada && (
            <>
              Se borrará para siempre
              {descendientes(seleccionada.id) > 0
                ? `, junto con sus ${descendientes(seleccionada.id)} subáreas (también las dadas de baja)`
                : ''}
              .
              {seleccionada.personasTotal > 0 &&
                ` Las ${seleccionada.personasTotal} personas que tiene quedarán sin área.`}{' '}
              Esto no se puede deshacer.
            </>
          )
        }
        confirmLabel="Eliminar definitivamente"
        variant="danger"
        loading={eliminar.isPending}
        onConfirm={() => seleccionada && eliminar.mutate(seleccionada.id)}
        onCancel={() => setEliminando(false)}
      />
    </>
  );
}

/** Ficha del área elegida: su superior, su jefe, sus personas y sus subáreas. */
function DetalleArea({
  area,
  areas,
  esSuper,
  onVolver,
  onSeleccionar,
  onModal,
  onBaja,
  onEliminar,
  onReactivar,
  reactivando,
}: {
  area: Area;
  areas: Area[];
  esSuper: boolean;
  onVolver: () => void;
  onSeleccionar: (id: number) => void;
  onModal: (m: Modal) => void;
  onBaja: () => void;
  onEliminar: () => void;
  onReactivar: () => void;
  reactivando: boolean;
}) {
  const deBaja = !!area.deletedAt;
  const qc = useQueryClient();
  const personas = useQuery({
    queryKey: areasService.keys.personas(area.id),
    queryFn: () => areasService.personas(area.id),
  });
  const superior = areas.find((a) => a.id === area.padreId);
  const subareas = areas.filter((a) => a.padreId === area.id && !a.deletedAt);

  const quitar = useMutation({
    mutationFn: (p: PersonaDeArea) => areasService.asignar(p.id, null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: areasService.keys.all });
      void qc.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('La persona quedó sin área');
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onVolver}
              className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-brand-700 md:hidden"
            >
              <ChevronLeft className="size-4" /> Áreas
            </button>
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900">
              {area.nombreCompleto}
              {deBaja && <Badge>Dada de baja</Badge>}
            </h2>
            <p className="text-sm text-slate-500">
              {superior ? (
                <>
                  Área superior:{' '}
                  <button
                    type="button"
                    className="font-medium text-brand-700"
                    onClick={() => onSeleccionar(superior.id)}
                  >
                    {superior.nombreCompleto}
                  </button>
                </>
              ) : (
                'Área de primer nivel'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {deBaja ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<RotateCcw className="size-4" />}
                loading={reactivando}
                onClick={onReactivar}
              >
                Reactivar
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Pencil className="size-4" />}
                  onClick={() => onModal({ tipo: 'area', area })}
                >
                  Editar
                </Button>
                <Button size="sm" variant="secondary" icon={<Trash2 className="size-4" />} onClick={onBaja}>
                  Dar de baja
                </Button>
              </>
            )}
            {esSuper && (
              <Button size="sm" variant="danger" icon={<Trash2 className="size-4" />} onClick={onEliminar}>
                <span className="hidden sm:inline">Eliminar definitivamente</span>
                <span className="sm:hidden">Eliminar</span>
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
          <p className="flex items-center gap-2 text-sm">
            <Crown className="size-4 text-amber-500" aria-hidden="true" />
            {area.jefe ? (
              <span className="text-slate-800">
                Jefe: <span className="font-medium">{area.jefe.nombre}</span>
              </span>
            ) : (
              <span className="text-slate-500">Sin jefe</span>
            )}
          </p>
          {!deBaja && (
            <Button size="sm" variant="ghost" onClick={() => onModal({ tipo: 'jefe' })}>
              {area.jefe ? 'Cambiar jefe' : 'Elegir jefe'}
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`Personas${personas.data ? ` (${personas.data.length})` : ''}`}
          actions={
            !deBaja && (
              <Button
                size="sm"
                variant="secondary"
                icon={<UserPlus className="size-4" />}
                onClick={() => onModal({ tipo: 'persona' })}
              >
                Agregar
              </Button>
            )
          }
        />
        {personas.isPending ? (
          <div className="flex justify-center py-6 text-brand-600">
            <Spinner className="size-5" />
          </div>
        ) : personas.data?.length === 0 ? (
          <EmptyState title="Sin personas" description="Agrega a quienes trabajan en esta área." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {personas.data?.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{p.nombre}</p>
                  <p className="truncate text-xs text-slate-500">{p.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.esJefe ? <Badge tone="warning">Jefe</Badge> : <Badge>{ROL_DESCRIPCIONES[p.rol]}</Badge>}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Quitar a ${p.nombre} del área`}
                    icon={<UserMinus className="size-4" />}
                    loading={quitar.isPending && quitar.variables?.id === p.id}
                    onClick={() => quitar.mutate(p)}
                  >
                    <span className="hidden sm:inline">Quitar</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={`Subáreas (${subareas.length})`}
          actions={
            !deBaja && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="size-4" />}
                onClick={() => onModal({ tipo: 'area', area: null, padreId: area.id })}
              >
                Nueva subárea
              </Button>
            )
          }
        />
        {subareas.length === 0 ? (
          <EmptyState title="Sin subáreas" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {subareas.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSeleccionar(s.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <span className="truncate font-medium text-slate-900">{s.nombre}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {s.personasTotal} {s.personasTotal === 1 ? 'persona' : 'personas'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Elige a una persona y la pone en el área (y, en modo jefe, la deja como jefe). */
function AgregarPersona({
  area,
  modo,
  onClose,
  onListo,
}: {
  area: Area;
  modo: 'persona' | 'jefe';
  onClose: () => void;
  onListo: () => void;
}) {
  const guardar = useMutation({
    mutationFn: async (p: CandidatoArea) => {
      if (modo === 'jefe') await areasService.actualizar(area.id, { jefeId: p.id });
      else await areasService.asignar(p.id, area.id);
      return p;
    },
    onSuccess: (p) => {
      onListo();
      toast.success(
        modo === 'jefe'
          ? `${p.nombre} es ahora jefe de ${area.nombre}`
          : `${p.nombre} se agregó a ${area.nombre}`,
      );
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  return (
    <ElegirPersonaModal
      titulo={modo === 'jefe' ? 'Elegir jefe del área' : 'Agregar persona'}
      descripcion={
        modo === 'jefe'
          ? `La persona pasará a formar parte de ${area.nombreCompleto} y será su jefe.`
          : `Si ya está en otra área, pasará a ${area.nombreCompleto}.`
      }
      accion={modo === 'jefe' ? 'Elegir' : 'Agregar'}
      areaId={modo === 'jefe' ? -1 : area.id}
      ocupado={guardar.isPending}
      onElegir={(p) => guardar.mutate(p)}
      onClose={onClose}
    />
  );
}
