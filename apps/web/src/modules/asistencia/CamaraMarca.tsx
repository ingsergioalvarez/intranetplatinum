import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, MapPin, RotateCcw, ScanFace, ShieldAlert } from 'lucide-react';
import { TIPO_MARCACION_LABEL, type Marcacion } from '@platinum/shared';
import { Button, Spinner, toast } from '../../components/ui';
import { ApiError } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { asistenciaService } from './asistencia.service';
import { formatHora } from './formato';
import { CapturaRegistro } from './rostro/CapturaRegistro';
import { EscanerRostro, type Captura, type Titular } from './rostro/EscanerRostro';
import { PantallaCamara } from './rostro/PantallaCamara';
import { formularioRostro } from './rostro/registro';
import { SinUbicacionError, nuevoIdMarca, obtenerUbicacion, type Ubicacion } from './ubicacion';

type Paso =
  | { tipo: 'registro' }
  | { tipo: 'bloqueado'; titulo: string; mensaje: string }
  | { tipo: 'camara' }
  | { tipo: 'confirmar'; captura: Captura }
  | { tipo: 'verificando'; captura: Captura }
  | { tipo: 'noCoincide' };

/**
 * Entrada / salida con foto y reconocimiento facial (AS1-08), a pantalla completa:
 * cámara que busca al titular en vivo (DA-28) y descarta pantallas o fotos (DA-30) → gesto al
 * azar (DA-29) → confirmar foto → verificar en el servidor. Solo el titular puede marcar: si no
 * es él, no hay foto (y se avisa al supervisor).
 *
 * `registrarRostro`: el guardia aún no tiene rostro (o se lo rechazaron): primero toma sus 5 fotos
 * (una sola vez; queda pendiente de revisión) y la marca se envía con la primera foto.
 */
export function CamaraMarca({
  tipo,
  sitio,
  onCerrar,
  onRegistrada,
  registrarRostro = false,
  motivoRechazo = null,
  guardarSinConexion,
}: {
  tipo: 'entrada' | 'salida';
  sitio: string | null;
  onCerrar: () => void;
  onRegistrada: (m: Marcacion) => void;
  registrarRostro?: boolean;
  motivoRechazo?: string | null;
  /** Guarda la checada en el celular si no hay conexión (AS2-02); devuelve la marca local. */
  guardarSinConexion?: (c: Captura, ubicacion: Ubicacion, intento: number, idCliente: string) => Promise<Marcacion>;
}) {
  const [paso, setPaso] = useState<Paso>({ tipo: registrarRostro ? 'registro' : 'camara' });
  const [enviandoRegistro, setEnviandoRegistro] = useState(false);
  const [intento, setIntento] = useState(1);
  const idRef = useRef('');
  const nombre = useAuthStore((s) => s.user?.nombre ?? '');
  const titulo = TIPO_MARCACION_LABEL[tipo];

  // Verificación en vivo del titular y reporte (con foto) de los intentos rechazados.
  const titular = useMemo<Titular>(
    () => ({
      nombre,
      // Sin conexión no se puede consultar al servidor: se sigue con el reto de vida y el antipantalla
      // locales, y el servidor verifica el rostro al recibir la marca (AS2-03).
      verificar: (descriptor) =>
        asistenciaService.verificarRostro(descriptor).catch((e: unknown) => {
          if (e instanceof ApiError && e.code === 'NETWORK_ERROR') return 'sin_rostro' as const;
          throw e;
        }),
      onIncidencia: (motivo, foto, descriptor) => {
        const form = new FormData();
        form.append('tipo', tipo);
        form.append('motivo', motivo);
        if (descriptor) form.append('descriptor', JSON.stringify(descriptor));
        form.append('foto', foto, 'intento.jpg');
        asistenciaService.reportarIncidencia(form).catch(() => undefined);
      },
    }),
    [nombre, tipo],
  );

  // Libera la vista previa al cambiar de paso o cerrar.
  const captura = paso.tipo === 'confirmar' || paso.tipo === 'verificando' ? paso.captura : null;
  useEffect(() => () => void (captura && URL.revokeObjectURL(captura.url)), [captura]);

  const registrar = async (c: Captura) => {
    setPaso({ tipo: 'verificando', captura: c });
    try {
      const ubicacion = await obtenerUbicacion({ fresca: true });
      const idCliente = nuevoIdMarca();
      idRef.current = idCliente;
      if (!navigator.onLine && guardarSinConexion) {
        onRegistrada(await guardarSinConexion(c, ubicacion, intento, idCliente));
        return;
      }
      const form = new FormData();
      form.append('idCliente', idCliente);
      form.append('horaCelular', new Date().toISOString());
      form.append('tipo', tipo);
      form.append('lat', String(ubicacion.lat));
      form.append('lng', String(ubicacion.lng));
      form.append('precisionM', String(ubicacion.precisionM));
      form.append('intento', String(intento));
      if (c.descriptor) form.append('descriptor', JSON.stringify(c.descriptor));
      if (c.sinLentes) form.append('sinLentes', 'true');
      form.append('foto', c.foto, 'marca.jpg');
      onRegistrada(await asistenciaService.marcarConFoto(form));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NETWORK_ERROR' && guardarSinConexion) {
        // La red se cayó al enviar: se guarda con el mismo id (si la marca sí llegó, el servidor no la duplica).
        try {
          const ubicacion = await obtenerUbicacion();
          const id = idRef.current;
          onRegistrada(await guardarSinConexion(c, ubicacion, intento, id));
          return;
        } catch {
          // Sin ubicación: se muestra el error de abajo.
        }
      }
      if (err instanceof ApiError && err.code === 'ROSTRO_DE_OTRO') {
        setPaso({
          tipo: 'bloqueado',
          titulo: 'No eres el titular de esta cuenta',
          mensaje: err.message + '. Se avisó a tu supervisor.',
        });
        return;
      }
      if (err instanceof ApiError && err.code === 'ROSTRO_NO_COINCIDE') {
        setIntento((n) => n + 1);
        setPaso({ tipo: 'noCoincide' });
        return;
      }
      toast.error(
        err instanceof SinUbicacionError || err instanceof Error ? err.message : 'No se pudo registrar',
      );
      setPaso({ tipo: 'confirmar', captura: c });
    }
  };

  /** Primer registro del guardia: envía sus fotos y luego la marca con la primera foto. */
  const enviarRegistro = async (capturas: Captura[]) => {
    setEnviandoRegistro(true);
    try {
      await asistenciaService.autoregistrarRostro(formularioRostro(capturas));
      toast.success('Rostro enviado a revisión');
      // La vista previa de la captura se libera al cerrar el registro: se crea otra.
      const primera = { ...capturas[0], url: URL.createObjectURL(capturas[0].foto) };
      void registrar(primera);
    } catch (err) {
      setPaso({
        tipo: 'bloqueado',
        titulo: 'No se pudo registrar tu rostro',
        mensaje:
          (err instanceof Error ? err.message : 'Intenta de nuevo') +
          (err instanceof ApiError && err.status === 409 ? '. Se avisó a tu supervisor.' : ''),
      });
    } finally {
      setEnviandoRegistro(false);
    }
  };

  if (paso.tipo === 'registro') {
    return (
      <CapturaRegistro
        titulo="Registra tu rostro"
        onCerrar={onCerrar}
        guardando={enviandoRegistro}
        textoGuardar={`Enviar y checar ${titulo.toLowerCase()}`}
        onGuardar={(capturas) => void enviarRegistro(capturas)}
        aviso={
          <p className="flex gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs text-brand-800">
            <Info className="size-4 shrink-0" />
            {motivoRechazo
              ? `Tu registro anterior fue rechazado: ${motivoRechazo}. Tómate las fotos de nuevo.`
              : 'Solo esta vez: 5 fotos para que el sistema te reconozca.'}
          </p>
        }
      />
    );
  }

  if (paso.tipo === 'bloqueado') {
    return (
      <PantallaCamara
        titulo={titulo}
        onCerrar={onCerrar}
        fondo={
          <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <ShieldAlert className="size-16 text-red-400" />
            <p className="text-xl font-semibold">{paso.titulo}</p>
            <p className="max-w-xs text-white/80">{paso.mensaje}</p>
          </div>
        }
        panel={
          <Button size="lg" fullWidth onClick={onCerrar}>
            Cerrar
          </Button>
        }
      />
    );
  }

  if (paso.tipo === 'camara') {
    return (
      <EscanerRostro
        titulo={titulo}
        onCerrar={onCerrar}
        titular={titular}
        onCaptura={(c) => setPaso({ tipo: 'confirmar', captura: c })}
      />
    );
  }

  if (paso.tipo === 'noCoincide') {
    return (
      <PantallaCamara
        titulo={titulo}
        onCerrar={onCerrar}
        fondo={
          <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <p className="text-6xl">🙁</p>
            <p className="text-xl font-semibold">No pudimos reconocerte</p>
            <ul className="space-y-1 text-left text-white/80">
              <li>• Quítate gorra, cubrebocas o lentes oscuros</li>
              <li>• Busca un lugar con mejor luz</li>
              <li>• Mira de frente a la cámara</li>
            </ul>
          </div>
        }
        panel={
          <>
            <p className="text-center text-sm text-slate-600">Solo el titular de la cuenta puede checar.</p>
            <Button size="lg" fullWidth onClick={() => setPaso({ tipo: 'camara' })}>
              Intentar de nuevo
            </Button>
          </>
        }
      />
    );
  }

  const verificando = paso.tipo === 'verificando';
  return (
    <PantallaCamara
      titulo={titulo}
      onCerrar={onCerrar}
      cerrarDeshabilitado={verificando}
      fondo={
        <>
          <img src={paso.captura.url} alt="Tu foto" className="size-full -scale-x-100 object-cover" />
          {verificando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 text-white">
              <Spinner className="size-8" />
              <p className="font-medium">Verificando tu rostro…</p>
            </div>
          )}
        </>
      }
      panel={
        <>
          <p className="text-center text-lg font-semibold">¿Registrar tu {titulo.toLowerCase()}?</p>
          <p className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
            <MapPin className="size-4" /> {sitio ?? 'Tu sitio'} · {formatHora(new Date())}
          </p>
          <Button
            size="lg"
            fullWidth
            loading={verificando}
            icon={<ScanFace className="size-5" />}
            onClick={() => void registrar(paso.captura)}
          >
            Registrar
          </Button>
          <Button
            variant="secondary"
            fullWidth
            disabled={verificando}
            icon={<RotateCcw className="size-4" />}
            onClick={() => setPaso({ tipo: 'camara' })}
          >
            Repetir foto
          </Button>
        </>
      }
    />
  );
}
