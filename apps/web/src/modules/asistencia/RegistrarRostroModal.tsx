import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanFace, Trash2, TriangleAlert } from 'lucide-react';
import { ROLES } from '@platinum/shared';
import { Button, ConfirmDialog, Modal, Spinner, toast } from '../../components/ui';
import { useAuthStore } from '../../core/auth/authStore';
import { asistenciaService } from './asistencia.service';
import { RevisionRostro } from './RevisionRostro';
import { CapturaRegistro } from './rostro/CapturaRegistro';
import { ListaConsejos } from './rostro/ConsejosCamara';
import { formularioRostro } from './rostro/registro';

/**
 * Ventana "Rostro" de un guardia (supervisor/admin): ver su registro y revisarlo si lo hizo él
 * mismo (aprobar / rechazar), registrarlo en persona para casos raros (queda aprobado) y, solo
 * admin, eliminarlo.
 */
export function RegistrarRostroModal({
  guardia,
  onClose,
}: {
  guardia: { id: number; nombre: string };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const rostro = useQuery({
    queryKey: asistenciaService.keys.rostro(guardia.id),
    queryFn: () => asistenciaService.rostro(guardia.id),
  });
  const esAdmin = useAuthStore((s) => s.user?.rol === ROLES.ADMIN);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [capturando, setCapturando] = useState(false);
  /** Consejos previos a la cámara (registrar en las mismas condiciones en que marcará). */
  const [viendoConsejos, setViendoConsejos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: asistenciaService.keys.all });

  const guardar = useMutation({
    mutationFn: (form: FormData) => asistenciaService.registrarRostro(guardia.id, form),
    onSuccess: () => {
      toast.success('Rostro registrado');
      setCapturando(false);
      void refrescar();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el rostro');
      setCapturando(false);
    },
  });

  const eliminar = useMutation({
    mutationFn: () => asistenciaService.eliminarRostro(guardia.id),
    onSuccess: () => {
      toast.success('Rostro eliminado');
      setConfirmarBorrado(false);
      void refrescar();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el rostro'),
  });

  if (capturando) {
    return (
      <CapturaRegistro
        titulo={`Rostro · ${guardia.nombre}`}
        onCerrar={() => setCapturando(false)}
        guardando={guardar.isPending}
        onGuardar={(capturas) => guardar.mutate(formularioRostro(capturas))}
      />
    );
  }

  const registrado = rostro.data;
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Rostro · ${guardia.nombre}`}
      description="Normalmente el guardia lo registra él mismo la primera vez que marca; aquí se revisa."
      footer={
        viendoConsejos ? (
          <>
            <Button variant="secondary" onClick={() => setViendoConsejos(false)}>
              Atrás
            </Button>
            <Button
              icon={<ScanFace className="size-4" />}
              onClick={() => {
                setViendoConsejos(false);
                setCapturando(true);
              }}
            >
              Entendido, abrir cámara
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        )
      }
    >
      {viendoConsejos ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Para que el guardia sea reconocido a la primera, toma las fotos en las condiciones en que marcará:
          </p>
          <ListaConsejos />
        </div>
      ) : rostro.isPending ? (
        <div className="flex justify-center py-10 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <p role="alert" className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
          {registrado ? (
            <RevisionRostro guardia={guardia} rostro={registrado} puedeRevisar />
          ) : (
            <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Sin rostro registrado. Se le pedirá registrarlo la primera vez que marque; mientras tanto sus
              marcas llevan la alerta "Sin rostro registrado".
            </p>
          )}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 md:flex-row">
            <Button
              variant="secondary"
              icon={<ScanFace className="size-4" />}
              onClick={() => {
                setError(null);
                setViendoConsejos(true);
              }}
            >
              Registrar en persona
            </Button>
            {registrado && esAdmin && (
              <Button
                variant="ghost"
                className="text-red-700 hover:bg-red-50"
                icon={<Trash2 className="size-4" />}
                onClick={() => setConfirmarBorrado(true)}
              >
                Eliminar rostro
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            "Registrar en persona" es para casos raros: queda aprobado y reemplaza el registro actual.
          </p>
        </div>
      )}
      <ConfirmDialog
        open={confirmarBorrado}
        title="Eliminar rostro"
        description={`Se borrarán el rostro de ${guardia.nombre} y sus fotos de registro. Sus marcas pasadas conservan su foto. Se le pedirá registrarse de nuevo la próxima vez que marque.`}
        confirmLabel="Eliminar rostro"
        variant="danger"
        loading={eliminar.isPending}
        onConfirm={() => eliminar.mutate()}
        onCancel={() => setConfirmarBorrado(false)}
      />
    </Modal>
  );
}
