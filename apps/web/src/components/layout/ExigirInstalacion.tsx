import { useEffect, useState } from 'react';
import { Download, MoreVertical, Share } from 'lucide-react';
import { Button, Modal } from '../ui';
import { useInstalacionStore, useRequisitoInstalacion } from '../../core/pwa/instalacion';

/** Segundos que se espera antes de poder tocar "Continuar" cuando el navegador no puede instalar la app. */
const ESPERA_CONTINUAR_S = 5;

const MOTIVO =
  'Instalada se abre a pantalla completa, los avisos te llegan aunque la app esté cerrada y puedes checar aunque se vaya la señal. Es obligatorio usarla instalada.';

/**
 * La app se instala en el celular o la tableta (A-70). Al abrir la página en un navegador móvil sale esta ventana y
 * no se puede cerrar: en Android se instala con un botón; en iPhone se dan los pasos; si ya está instalada se pide
 * abrirla desde su icono. Solo cuando el navegador no puede instalarla (Chrome en iPhone, Firefox, el navegador de
 * WhatsApp…) hay un "Continuar" para que nadie se quede sin trabajar, y la ventana vuelve a salir cada vez.
 */
export function ExigirInstalacion() {
  const { modo, entorno } = useRequisitoInstalacion();
  const { evento, instaladaAhora, marcarInstalada, olvidarInstalada, continuar, rechazar } = useInstalacionStore();
  const [instalando, setInstalando] = useState(false);
  const [espera, setEspera] = useState(ESPERA_CONTINUAR_S);

  // Cuenta regresiva para "Continuar": que alcance a leer antes de poder seguir.
  useEffect(() => {
    if (modo !== 'manual') return;
    setEspera(ESPERA_CONTINUAR_S);
    const t = setInterval(() => setEspera((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [modo]);

  const instalar = async () => {
    if (!evento) return;
    setInstalando(true);
    try {
      await evento.prompt();
      const { outcome } = await evento.userChoice;
      if (outcome === 'accepted') marcarInstalada();
      else rechazar();
    } catch {
      rechazar();
    } finally {
      setInstalando(false);
    }
  };

  const titulo = {
    instalar: 'Instala la app',
    ios: 'Instala la app en tu iPhone',
    abrir_icono: instaladaAhora ? 'Listo, ya está instalada' : 'Ya tienes la app instalada',
    manual: 'Instala la app si puedes',
    nada: '',
  }[modo];

  return (
    <Modal
      open={modo !== 'nada'}
      onClose={() => undefined}
      cerrable={false}
      dismissible={false}
      size="sm"
      title={titulo}
      footer={
        modo === 'instalar' ? (
          <Button icon={<Download className="size-4" />} loading={instalando} onClick={() => void instalar()}>
            Instalar
          </Button>
        ) : modo === 'abrir_icono' && !instaladaAhora ? (
          <Button variant="ghost" onClick={olvidarInstalada}>
            Ya no la tengo instalada
          </Button>
        ) : modo === 'manual' ? (
          <Button variant="secondary" disabled={espera > 0} onClick={continuar}>
            {espera > 0 ? `Continuar (${espera})` : 'Continuar'}
          </Button>
        ) : undefined
      }
    >
      {modo === 'instalar' && (
        <p className="text-sm text-slate-700">
          Instala Platinum en tu {entorno.plataforma === 'android' ? 'celular' : 'dispositivo'}. {MOTIVO}
        </p>
      )}

      {modo === 'ios' && (
        <div className="space-y-3 text-sm text-slate-700">
          <p>{MOTIVO}</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Toca el botón <strong>Compartir</strong> <Share className="inline size-4 align-text-bottom" aria-hidden /> de
              la barra de Safari.
            </li>
            <li>
              Elige <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
            </li>
            <li>
              Toca <strong>Agregar</strong> y abre la app desde el nuevo icono de <strong>Platinum</strong>.
            </li>
          </ol>
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Si ya la instalaste, cierra esta página y ábrela desde su icono. Las notificaciones en iPhone solo funcionan
            con la app instalada y con iOS 16.4 o más nuevo.
          </p>
        </div>
      )}

      {modo === 'abrir_icono' && (
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            {instaladaAhora ? 'Se instaló correctamente. ' : ''}Ábrela desde su icono <strong>Platinum</strong> en la
            pantalla de inicio de tu celular y sigue ahí: desde el navegador ya no se usa.
          </p>
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Desde el navegador no se puede abrir sola. Si el icono no aparece, busca &quot;Platinum&quot; en tus
            aplicaciones.
          </p>
        </div>
      )}

      {modo === 'manual' && (
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Este navegador no puede instalar la app con un botón.{' '}
            <strong>
              {entorno.plataforma === 'ios' ? 'Si puedes, ábrela en Safari' : 'Si puedes, ábrela en Chrome'}
            </strong>{' '}
            e instálala: es lo que se pide a todos.
          </p>
          {entorno.navegadorDeApp && (
            <p>
              Estás en el navegador de otra aplicación (como WhatsApp). Toca los tres puntos o el icono de compartir y
              elige <strong>&quot;Abrir en el navegador&quot;</strong>.
            </p>
          )}
          {entorno.plataforma === 'android' && (
            <p>
              En Chrome toca los tres puntos <MoreVertical className="inline size-4 align-text-bottom" aria-hidden /> y
              elige <strong>&quot;Instalar aplicación&quot;</strong> (o <strong>&quot;Agregar a pantalla de inicio&quot;</strong>).
            </p>
          )}
          {entorno.plataforma === 'ios' && (
            <p>
              En Safari toca <strong>Compartir</strong> <Share className="inline size-4 align-text-bottom" aria-hidden /> y
              elige <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
            </p>
          )}
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Puedes continuar por ahora, pero esta ventana saldrá cada vez que abras la página mientras no la instales.
          </p>
        </div>
      )}
    </Modal>
  );
}
