import { ClipboardPlus, Megaphone, NotebookPen, Phone } from 'lucide-react';
import { Button, Modal, cn } from '../../components/ui';
import { ESTILO, LEYENDA } from './c2.estilos';

const Punto = ({ estado }: { estado: keyof typeof ESTILO }) => (
  <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', ESTILO[estado].punto)} aria-hidden />
);

const Titulo = ({ children }: { children: string }) => <h3 className="text-sm font-bold text-slate-900">{children}</h3>;

/** "¿Cómo leer esta pantalla?": cinco puntos cortos. Se abre sola la primera vez y con el botón Ayuda. */
export function AyudaC2({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="¿Cómo leer esta pantalla?"
      footer={<Button onClick={onClose}>Entendido</Button>}
    >
      <div className="grid grid-cols-1 gap-4 text-sm text-slate-700">
        <section>
          <Titulo>Qué vigilas</Titulo>
          <p>Que cada sitio tenga guardia y que no haya un SOS sin atender. Lo peor aparece arriba y la pantalla se actualiza sola.</p>
        </section>
        <section>
          <Titulo>Los colores</Titulo>
          <ul className="mt-1 grid grid-cols-1 gap-1.5">
            {LEYENDA.map((l) => (
              <li key={l.estado} className="flex gap-2">
                <Punto estado={l.estado} />
                <span>
                  <strong className={ESTILO[l.estado].texto}>{l.nombre}:</strong> {l.explicacion}
                </span>
              </li>
            ))}
            <li className="flex gap-2">
              <Punto estado="sos" />
              <span>
                <strong className={ESTILO.sos.texto}>SOS:</strong> alguien pidió ayuda. Sale arriba de todo.
              </span>
            </li>
          </ul>
        </section>
        <section>
          <Titulo>La columna "Qué pasa"</Titulo>
          <p>Dice quién falta y a qué hora debía entrar, y quién sí está, con su foto y la hora a la que entró.</p>
        </section>
        <section>
          <Titulo>Los iconos de la derecha</Titulo>
          <ul className="mt-1 grid grid-cols-1 gap-1.5">
            <li className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden /><span><strong>Llamar:</strong> los números del supervisor del sitio.</span></li>
            <li className="flex gap-2"><Megaphone className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden /><span><strong>Avisar al supervisor:</strong> le llega un aviso a él y al administrador del sitio.</span></li>
            <li className="flex gap-2"><NotebookPen className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden /><span><strong>Nota:</strong> anotas lo que pasó o lo que hiciste. La última nota del día se ve en el sitio.</span></li>
            <li className="flex gap-2"><ClipboardPlus className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden /><span><strong>Reporte:</strong> levantas un reporte sobre ese sitio. Lo ven el supervisor y el administrador.</span></li>
          </ul>
          <p className="mt-1">Todo lo que haces queda en la pestaña <strong>Bitácora</strong>, con tu nombre y la hora.</p>
        </section>
        <section>
          <Titulo>Sonido</Titulo>
          <p>Toca "Activar sonido". Suena mientras haya un sitio solo o un SOS. "Silenciar" apaga lo de ahora; si aparece algo nuevo, vuelve a sonar.</p>
        </section>
        <section>
          <Titulo>Si hay un SOS</Titulo>
          <p>Sale arriba, en rojo, con los teléfonos para llamar. Toca "Estamos atendiendo" para avisar que lo atiendes. Se queda en rojo hasta que se cierra.</p>
        </section>
      </div>
    </Modal>
  );
}
