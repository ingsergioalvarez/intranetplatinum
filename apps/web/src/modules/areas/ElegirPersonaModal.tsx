import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { ROL_DESCRIPCIONES, type CandidatoArea } from '@platinum/shared';
import { useDebounced } from '../../core/hooks/useDebounced';
import { Badge, Button, EmptyState, Input, Modal, Spinner } from '../../components/ui';
import { areasService } from './areas.service';

/**
 * Elegir a una persona de la empresa para ponerla en un área o como su jefe. Muestra el área que tiene hoy, porque
 * elegirla la mueve (una persona pertenece a una sola área).
 */
export function ElegirPersonaModal({
  titulo,
  descripcion,
  accion,
  areaId,
  ocupado,
  onElegir,
  onClose,
}: {
  titulo: string;
  descripcion: string;
  /** Texto del botón de cada persona. */
  accion: string;
  /** Área a la que se la quiere llevar: quien ya está en ella no se ofrece. */
  areaId: number;
  ocupado?: boolean;
  onElegir: (persona: CandidatoArea) => void;
  onClose: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounced(busqueda.trim());
  const lista = useQuery({ queryKey: areasService.keys.candidatos(q), queryFn: () => areasService.candidatos(q) });
  const personas = (lista.data ?? []).filter((p) => p.area?.id !== areaId);

  return (
    <Modal open onClose={onClose} title={titulo} description={descripcion} size="md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          aria-label="Buscar persona"
          placeholder="Nombre o correo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
          autoComplete="off"
          autoFocus
        />
      </div>
      <div className="mt-3 max-h-80 overflow-y-auto">
        {lista.isPending ? (
          <div className="flex justify-center py-8 text-brand-600">
            <Spinner className="size-6" />
          </div>
        ) : personas.length === 0 ? (
          <EmptyState title="Sin resultados" description="Prueba con otro nombre." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {personas.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{p.nombre}</p>
                  <p className="truncate text-xs text-slate-500">
                    {ROL_DESCRIPCIONES[p.rol] ?? p.rol} · {p.email}
                  </p>
                  {p.area ? (
                    <Badge className="mt-1">Hoy en: {p.area.nombreCompleto}</Badge>
                  ) : (
                    <Badge tone="warning" className="mt-1">
                      Sin área
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="secondary" disabled={ocupado} onClick={() => onElegir(p)}>
                  {accion}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
