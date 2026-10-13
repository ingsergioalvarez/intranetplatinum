import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellRing,
  Building,
  ChevronLeft,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
  Star,
  Users,
  XCircle,
} from 'lucide-react';
import { PERMISOS, type Contacto, type Sitio } from '@platinum/shared';
import { ApiError, mensajeDeError } from '../../core/api';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { mapsUrl } from '../../core/format/mapas';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Spinner,
  toast,
} from '../../components/ui';
import { ClienteModal } from './ClienteModal';
import { ContactoModal } from './ContactoModal';
import { EstatusClienteBadge } from './EstatusClienteBadge';
import { ReglasAvisoCard } from './ReglasAviso';
import { GuardiasSitioModal } from './GuardiasSitioModal';
import { SitioModal } from './SitioModal';
import { clientesService } from './clientes.service';

/** Modal abierto en la ficha: `null` en contacto/sitio = alta. */
type Abierto =
  | { tipo: 'cliente' }
  | { tipo: 'contacto'; contacto: Contacto | null }
  | { tipo: 'sitio'; sitio: Sitio | null }
  | { tipo: 'guardias'; sitio: Sitio };

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-800">{children || '—'}</dd>
    </div>
  );
}

/** Ficha del cliente (F2-02..F2-05): datos generales, contactos y sitios con sus guardias. */
export function ClienteDetallePage() {
  const id = Number(useParams().id);
  const qc = useQueryClient();
  const yo = useAuthStore((s) => s.user);
  const [abierto, setAbierto] = useState<Abierto | null>(null);
  const [confirmarBaja, setConfirmarBaja] = useState(false);

  const detalle = useQuery({
    queryKey: clientesService.keys.detail(id),
    queryFn: () => clientesService.detalle(id),
    enabled: Number.isInteger(id),
  });

  const baja = useMutation({
    mutationFn: (deBaja: boolean) => (deBaja ? clientesService.restore(id) : clientesService.deactivate(id)),
    onSuccess: (_r, deBaja) => {
      void qc.invalidateQueries({ queryKey: clientesService.keys.all });
      setConfirmarBaja(false);
      toast.success(deBaja ? 'Cliente reactivado' : 'Cliente dado de baja');
    },
    onError: (e) => {
      setConfirmarBaja(false);
      toast.error(mensajeDeError(e));
    },
  });

  if (detalle.isPending) {
    return (
      <div className="flex justify-center py-16 text-brand-600">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (detalle.isError || !detalle.data) {
    const noExiste = detalle.error instanceof ApiError && detalle.error.status === 404;
    return (
      <EmptyState
        title={noExiste ? 'Cliente no encontrado' : 'No se pudo cargar el cliente'}
        action={
          <Link
            to="/clientes"
            className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            Volver a clientes
          </Link>
        }
      />
    );
  }

  const c = detalle.data;
  const deBaja = !!c.deletedAt;
  const puedeEditar = hasPermission(yo, PERMISOS.CLIENTES_EDITAR) && !deBaja;
  const puedeBaja = hasPermission(yo, PERMISOS.CLIENTES_BAJA);
  const sitiosActivos = c.sitios.filter((s) => !s.deletedAt);
  const sitiosBaja = c.sitios.filter((s) => s.deletedAt);

  return (
    <>
      <Link
        to="/clientes"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ChevronLeft className="size-4" /> Clientes
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 md:mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 md:text-2xl">{c.nombreComercial}</h1>
            <EstatusClienteBadge cliente={c} />
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{c.razonSocial}</p>
        </div>
        <div className="flex gap-2">
          {puedeEditar && (
            <Button
              variant="secondary"
              icon={<Pencil className="size-4" />}
              onClick={() => setAbierto({ tipo: 'cliente' })}
            >
              Editar
            </Button>
          )}
          {puedeBaja && (
            <Button
              variant={deBaja ? 'secondary' : 'ghost'}
              className={deBaja ? undefined : 'text-red-700 hover:bg-red-50'}
              icon={deBaja ? <RotateCcw className="size-4" /> : <XCircle className="size-4" />}
              onClick={() => setConfirmarBaja(true)}
            >
              {deBaja ? 'Reactivar' : 'Dar de baja'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Building className="size-4 text-slate-400" />
                Datos generales
              </span>
            }
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
            <Dato label="RFC">{c.rfc}</Dato>
            <Dato label="Giro">{c.giro}</Dato>
            <Dato label="Teléfono">
              {c.telefono && (
                <a href={`tel:${c.telefono}`} className="text-brand-700 underline-offset-2 hover:underline">
                  {c.telefono}
                </a>
              )}
            </Dato>
            <Dato label="Correo">
              {c.email && (
                <a href={`mailto:${c.email}`} className="text-brand-700 underline-offset-2 hover:underline">
                  {c.email}
                </a>
              )}
            </Dato>
            <div className="col-span-2">
              <Dato label="Dirección fiscal">{c.direccionFiscal}</Dato>
            </div>
            {c.notas && (
              <div className="col-span-2">
                <Dato label="Notas internas">
                  <span className="whitespace-pre-line">{c.notas}</span>
                </Dato>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Users className="size-4 text-slate-400" />
                Contactos
              </span>
            }
            subtitle={`${c.contactos.length} registrados`}
            actions={
              puedeEditar && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="size-4" />}
                  onClick={() => setAbierto({ tipo: 'contacto', contacto: null })}
                >
                  Agregar
                </Button>
              )
            }
          />
          {c.contactos.length === 0 ? (
            <EmptyState
              title="Sin contactos"
              description="Agrega al responsable y a quienes deben recibir avisos."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {c.contactos.map((ct) => (
                <li key={ct.id}>
                  <button
                    type="button"
                    onClick={() => setAbierto({ tipo: 'contacto', contacto: ct })}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 active:bg-slate-100"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{ct.nombre}</p>
                      <p className="truncate text-sm text-slate-500">
                        {[ct.puesto, ct.celular ?? ct.telefono, ct.email].filter(Boolean).join(' · ') ||
                          'Sin datos de contacto'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {ct.esResponsable && (
                        <Badge tone="brand">
                          <Star className="mr-1 size-3" />
                          Responsable
                        </Badge>
                      )}
                      {ct.recibeNotificaciones && (
                        <Badge tone="info" className="px-1.5">
                          <BellRing className="size-3" aria-label="Recibe notificaciones" />
                        </Badge>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <ReglasAvisoCard cliente={c} puedeEditar={puedeEditar} />

        <Card className="md:col-span-2">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <MapPin className="size-4 text-slate-400" />
                Sitios
              </span>
            }
            subtitle={`${sitiosActivos.length} activos${sitiosBaja.length ? ` · ${sitiosBaja.length} de baja` : ''}`}
            actions={
              puedeEditar && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="size-4" />}
                  onClick={() => setAbierto({ tipo: 'sitio', sitio: null })}
                >
                  Agregar sitio
                </Button>
              )
            }
          />
          {c.sitios.length === 0 ? (
            <EmptyState
              title="Sin sitios"
              description="Registra los inmuebles donde se presta el servicio."
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
              {[...sitiosActivos, ...sitiosBaja].map((s) => (
                <li
                  key={s.id}
                  className={`rounded-xl border p-4 ${s.deletedAt ? 'border-dashed border-slate-200 bg-slate-50' : 'border-slate-200'}`}
                >
                  <button
                    type="button"
                    onClick={() => setAbierto({ tipo: 'sitio', sitio: s })}
                    className="block w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">{s.nombre}</p>
                      {s.deletedAt ? (
                        <Badge>De baja</Badge>
                      ) : (
                        <Badge tone={s.guardiasVigentes ? 'success' : 'warning'}>
                          <Shield className="mr-1 size-3" />
                          {s.guardiasVigentes} {s.guardiasVigentes === 1 ? 'guardia' : 'guardias'}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{s.direccion ?? 'Sin dirección'}</p>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Shield className="size-4" />}
                      onClick={() => setAbierto({ tipo: 'guardias', sitio: s })}
                    >
                      Guardias
                    </Button>
                    {s.lat !== null && s.lng !== null && (
                      <a
                        href={mapsUrl(s.lat, s.lng)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Navigation className="size-4" /> Mapa
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {abierto?.tipo === 'cliente' && <ClienteModal cliente={c} onClose={() => setAbierto(null)} />}
      {abierto?.tipo === 'contacto' && (
        <ContactoModal
          key={abierto.contacto?.id ?? 'nuevo'}
          clienteId={c.id}
          contacto={abierto.contacto}
          readOnly={!puedeEditar}
          onClose={() => setAbierto(null)}
        />
      )}
      {abierto?.tipo === 'sitio' && (
        <SitioModal
          key={abierto.sitio?.id ?? 'nuevo'}
          clienteId={c.id}
          sitio={abierto.sitio}
          readOnly={!puedeEditar}
          onClose={() => setAbierto(null)}
        />
      )}
      {abierto?.tipo === 'guardias' && (
        <GuardiasSitioModal
          sitio={abierto.sitio}
          puedeEditar={puedeEditar}
          onClose={() => setAbierto(null)}
        />
      )}

      <ConfirmDialog
        open={confirmarBaja}
        title={deBaja ? 'Reactivar cliente' : 'Dar de baja al cliente'}
        description={
          deBaja
            ? `${c.nombreComercial} volverá a estar vigente con sus contactos y sitios.`
            : `${c.nombreComercial} quedará de baja: no se podrá editar y sus sitios dejarán de aparecer a los guardias. Podrás reactivarlo después.`
        }
        confirmLabel={deBaja ? 'Reactivar' : 'Dar de baja'}
        variant={deBaja ? 'primary' : 'danger'}
        loading={baja.isPending}
        onConfirm={() => baja.mutate(deBaja)}
        onCancel={() => setConfirmarBaja(false)}
      />
    </>
  );
}
