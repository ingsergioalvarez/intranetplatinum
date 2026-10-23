import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Glasses, Lightbulb, ScanFace, Smartphone } from 'lucide-react';
import { PERMISOS, ROLES } from '@platinum/shared';
import { Button, Modal, toast } from '../../components/ui';
import { ApiError } from '../../core/api';
import { hasPermission, hasRole, useAuthStore } from '../../core/auth/authStore';
import { asistenciaService } from './asistencia.service';
import { CapturaRegistro } from './rostro/CapturaRegistro';
import { GuiaTelefono } from './rostro/GuiaTelefono';
import { pedirSensorInclinacion } from './rostro/inclinacion';
import { precargarMotor } from './rostro/motor';
import { formularioRostro } from './rostro/registro';

const CLAVE = 'asistencia.bienvenidaRostro.omitida';

const PASOS = [
  { icono: Glasses, texto: 'Quítate los lentes (obligatorio), la gorra y el cubrebocas' },
  { icono: Smartphone, texto: 'Sostén el teléfono a la altura de tus ojos' },
  { icono: Lightbulb, texto: 'Busca buena luz, sin ventana detrás' },
  { icono: ScanFace, texto: 'Sigue las flechas: son 5 fotos' },
];

const omitida = () => {
  try {
    return sessionStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
};

/**
 * Primera vez del guardia (DA-43): si no tiene rostro registrado (o se lo rechazaron), al abrir la
 * app le pide registrarlo, sin tener que buscar dónde. "Ahora no" la oculta hasta que vuelva a
 * abrir la app; al checar se le pedirá de todos modos.
 */
export function BienvenidaRostro() {
  const user = useAuthStore((s) => s.user);
  const esGuardia = hasRole(user, [ROLES.GUARDIA]) && hasPermission(user, PERMISOS.ASISTENCIA_MARCAR);
  const qc = useQueryClient();
  const [cerrada, setCerrada] = useState(omitida);
  const [capturando, setCapturando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const estado = useQuery({
    queryKey: asistenciaService.keys.estado,
    queryFn: asistenciaService.estado,
    enabled: esGuardia,
  });
  const rostro = estado.data?.rostro;
  const falta = !!rostro && (rostro.estado === 'sin_registro' || rostro.estado === 'rechazado');
  const visible = esGuardia && falta && !cerrada;

  // La cámara abre más rápido si el motor ya se está descargando.
  useEffect(() => {
    if (visible) precargarMotor();
  }, [visible]);

  if (!visible) return null;

  const ahoraNo = () => {
    try {
      sessionStorage.setItem(CLAVE, '1');
    } catch {
      // Sin almacenamiento: solo se cierra por ahora.
    }
    setCerrada(true);
  };

  if (capturando) {
    return (
      <CapturaRegistro
        titulo="Registra tu rostro"
        onCerrar={() => setCapturando(false)}
        guardando={guardando}
        textoGuardar="Enviar"
        onGuardar={async (capturas) => {
          setGuardando(true);
          try {
            await asistenciaService.autoregistrarRostro(formularioRostro(capturas));
            toast.success('¡Listo! Tu rostro quedó registrado; ya puedes checar');
            setCapturando(false);
            setCerrada(true);
            void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
          } catch (err) {
            toast.error(
              (err instanceof Error ? err.message : 'No se pudo registrar tu rostro') +
                (err instanceof ApiError && err.status === 409 ? '. Se avisó a tu supervisor.' : ''),
            );
          } finally {
            setGuardando(false);
          }
        }}
      />
    );
  }

  const nombre = user?.nombre.split(' ')[0] ?? '';
  return (
    <Modal
      open
      onClose={ahoraNo}
      size="sm"
      title={`Hola, ${nombre}`}
      description={
        rostro?.estado === 'rechazado'
          ? `Tu registro de rostro fue rechazado${rostro.motivoRechazo ? `: ${rostro.motivoRechazo}` : ''}. Regístralo de nuevo para poder checar.`
          : 'Antes de checar, registra tu rostro. Solo se hace una vez.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={ahoraNo}>
            Ahora no
          </Button>
          <Button
            icon={<ScanFace className="size-4" />}
            onClick={() => {
              pedirSensorInclinacion();
              setCapturando(true);
            }}
          >
            Empezar
          </Button>
        </>
      }
    >
      <GuiaTelefono />
      <ol className="mt-4 space-y-3">
        {PASOS.map(({ icono: Icono, texto }, i) => (
          <li key={texto} className="flex items-center gap-3 text-slate-700">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Icono className="size-5" />
            </span>
            <span>
              <span className="font-semibold text-slate-900">{i + 1}.</span> {texto}
            </span>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
