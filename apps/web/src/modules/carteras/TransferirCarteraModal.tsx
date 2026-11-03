import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase } from 'lucide-react';
import type { CarteraArbol, PersonaCartera, TransferirCarteraInput } from '@platinum/shared';
import { Button, Checkbox, Modal, Select, Spinner, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { carterasService } from './carteras.service';

const SIN_ASIGNAR = 'sin-asignar';

/**
 * Pasar la cartera de un admin a otro (A-65): todo de un paso, o eligiendo qué. Al pasar un supervisor puede llevarse
 * lo que tiene detrás (sus guardias, y los clientes con sus sitios que supervisa). `modoBaja` es el paso previo a dar
 * de baja a un admin: lo que no se pase queda "sin asignar" y solo lo ve el super admin.
 */
export function TransferirCarteraModal({
  origenId,
  origenNombre,
  modoBaja = false,
  onClose,
  onListo,
}: {
  /** null = lo que está sin asignar. */
  origenId: number | null;
  origenNombre: string;
  modoBaja?: boolean;
  onClose: () => void;
  /** Se pasó (o se decidió no pasar nada en modo baja). */
  onListo: () => void;
}) {
  const qc = useQueryClient();
  const arbol = useQuery({ queryKey: carterasService.keys.arbol(origenId), queryFn: () => carterasService.arbol(origenId) });
  const resumen = useQuery({ queryKey: carterasService.keys.resumen, queryFn: carterasService.resumen });
  const destinos = (resumen.data?.admins ?? []).filter((a) => a.activo && a.id !== origenId);

  const [destino, setDestino] = useState('');
  const [todo, setTodo] = useState(true);
  const [cadena, setCadena] = useState(true);
  const [usuarios, setUsuarios] = useState<Set<number>>(new Set());
  const [clientes, setClientes] = useState<Set<number>>(new Set());
  const [grupos, setGrupos] = useState<Set<number>>(new Set());

  const alternar = (set: Set<number>, poner: (s: Set<number>) => void, id: number) => {
    const n = new Set(set);
    if (!n.delete(id)) n.add(id);
    poner(n);
  };

  const total = arbol.data?.totales;
  const vacia = !!total && total.usuarios + total.clientes + total.grupos === 0;
  const elegidos = usuarios.size + clientes.size + grupos.size;

  const pasar = useMutation({
    mutationFn: (input: TransferirCarteraInput) => carterasService.transferir(input),
    onSuccess: (r) => {
      void qc.invalidateQueries();
      toast.success(
        `Pasaron ${r.usuarios} usuarios, ${r.clientes} clientes y ${r.grupos} grupos${r.avisos ? ` (y ${r.avisos} avisos pendientes)` : ''}`,
      );
      onListo();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const enviar = () => {
    if (!destino) return toast.error('Elige a quién se la pasas');
    pasar.mutate({
      origenId,
      destinoId: destino === SIN_ASIGNAR ? null : Number(destino),
      todo,
      cadena,
      usuarioIds: todo ? [] : [...usuarios],
      clienteIds: todo ? [] : [...clientes],
      grupoIds: todo ? [] : [...grupos],
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={modoBaja ? `Antes de dar de baja a ${origenNombre}` : `Pasar la cartera de ${origenNombre}`}
      description={
        modoBaja
          ? 'Pasa lo suyo a otro administrador. Lo que no pases queda sin asignar y solo tú lo ves.'
          : 'Lo que pases deja de verlo este administrador y lo ve el que elijas.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          {modoBaja && (
            <Button variant="secondary" onClick={onListo}>
              {vacia ? 'Continuar' : 'Dejar sin asignar y continuar'}
            </Button>
          )}
          {!vacia && (
            <Button
              loading={pasar.isPending}
              disabled={!destino || (!todo && elegidos === 0)}
              onClick={enviar}
              icon={<Briefcase className="size-4" />}
            >
              {todo ? 'Pasar todo' : `Pasar lo elegido (${elegidos})`}
            </Button>
          )}
        </>
      }
    >
      {arbol.isPending ? (
        <div className="flex justify-center py-8 text-brand-600">
          <Spinner className="size-6" />
        </div>
      ) : arbol.isError ? (
        <p className="text-sm text-red-700">No se pudo cargar la cartera.</p>
      ) : vacia ? (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-700">No tiene usuarios, clientes ni grupos.</p>
      ) : (
        <div className="space-y-4">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Tiene <strong>{total!.usuarios}</strong> usuarios, <strong>{total!.clientes}</strong> clientes (
            {total!.sitios} sitios) y <strong>{total!.grupos}</strong> grupos.
          </p>
          <label className="block text-sm font-medium text-slate-700">
            Pasarla a
            <Select
              className="mt-1"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Elige un administrador activo"
              options={[
                ...destinos.map((a) => ({ value: String(a.id), label: a.nombre })),
                { value: SIN_ASIGNAR, label: 'Dejar sin asignar' },
              ]}
            />
          </label>
          <Checkbox
            label="Pasar toda la cartera"
            description="Usuarios, clientes con sus sitios y grupos, y sus avisos pendientes."
            checked={todo}
            onChange={(e) => setTodo(e.target.checked)}
          />
          {!todo && (
            <Detalle
              arbol={arbol.data}
              cadena={cadena}
              onCadena={setCadena}
              usuarios={usuarios}
              clientes={clientes}
              grupos={grupos}
              onUsuario={(id) => alternar(usuarios, setUsuarios, id)}
              onCliente={(id) => alternar(clientes, setClientes, id)}
              onGrupo={(id) => alternar(grupos, setGrupos, id)}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function Seccion({ titulo, vacio, children }: { titulo: string; vacio?: boolean; children: React.ReactNode }) {
  if (vacio) return null;
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{titulo}</h3>
      <div className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">{children}</div>
    </section>
  );
}

function Detalle({
  arbol,
  cadena,
  onCadena,
  usuarios,
  clientes,
  grupos,
  onUsuario,
  onCliente,
  onGrupo,
}: {
  arbol: CarteraArbol;
  cadena: boolean;
  onCadena: (v: boolean) => void;
  usuarios: Set<number>;
  clientes: Set<number>;
  grupos: Set<number>;
  onUsuario: (id: number) => void;
  onCliente: (id: number) => void;
  onGrupo: (id: number) => void;
}) {
  const sueltos = useMemo(() => {
    const deSupervisor = new Set(arbol.supervisores.flatMap((s) => s.guardias.map((g) => g.id)));
    return arbol.guardias.filter((g) => !deSupervisor.has(g.id));
  }, [arbol]);
  const fila = (p: PersonaCartera, extra?: string) => (
    <Checkbox
      key={p.id}
      className="px-3"
      label={p.nombre}
      description={[p.activo ? null : 'de baja', extra].filter(Boolean).join(' · ') || undefined}
      checked={usuarios.has(p.id)}
      onChange={() => onUsuario(p.id)}
    />
  );
  return (
    <div className="space-y-4">
      <Checkbox
        label="Llevar también lo que tiene detrás"
        description="Al pasar un supervisor: sus guardias y los clientes (con sus sitios) que supervisa. Al pasar un cliente: sus accesos."
        checked={cadena}
        onChange={(e) => onCadena(e.target.checked)}
      />
      <Seccion titulo="Supervisores" vacio={arbol.supervisores.length === 0}>
        {arbol.supervisores.map((s) =>
          fila(
            s,
            `${s.guardias.length} guardias · ${s.clientes.length} clientes`,
          ),
        )}
      </Seccion>
      <Seccion titulo="Clientes" vacio={arbol.clientes.length === 0}>
        {arbol.clientes.map((c) => (
          <Checkbox
            key={c.id}
            className="px-3"
            label={c.nombre}
            description={`${c.sitios.length} sitios · ${c.accesos.length} accesos`}
            checked={clientes.has(c.id)}
            onChange={() => onCliente(c.id)}
          />
        ))}
      </Seccion>
      <Seccion titulo="Guardias que no son de un supervisor" vacio={sueltos.length === 0}>
        {sueltos.map((g) => fila(g))}
      </Seccion>
      <Seccion titulo="Otros usuarios" vacio={arbol.otros.length === 0}>
        {arbol.otros.map((u) => fila(u, u.rol))}
      </Seccion>
      <Seccion titulo="Grupos" vacio={arbol.grupos.length === 0}>
        {arbol.grupos.map((g) => (
          <Checkbox
            key={g.id}
            className="px-3"
            label={g.nombre}
            description={`${g.integrantes} integrantes`}
            checked={grupos.has(g.id)}
            onChange={() => onGrupo(g.id)}
          />
        ))}
      </Seccion>
    </div>
  );
}
