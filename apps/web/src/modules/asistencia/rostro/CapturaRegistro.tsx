import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, RotateCcw, ScanFace } from 'lucide-react';
import { MUESTRAS_ROSTRO_MAX, MUESTRAS_ROSTRO_MIN } from '@platinum/shared';
import { Button, cn, toast } from '../../../components/ui';
import { EscanerRostro, type Captura } from './EscanerRostro';
import { PASOS_REGISTRO } from './registro';

/**
 * Toma de las fotos del registro de rostro a pantalla completa (guía por ángulo, miniaturas y
 * "Guardar"). La usan el supervisor (en persona) y el guardia (autoregistro). Cada foto se toma
 * automáticamente al sostener la pose dentro del óvalo (prueba de vida por giros 3D).
 */
export function CapturaRegistro({
  titulo,
  onCerrar,
  onGuardar,
  guardando,
  textoGuardar = 'Guardar rostro',
  aviso,
}: {
  titulo: string;
  onCerrar: () => void;
  onGuardar: (capturas: Captura[]) => void;
  guardando: boolean;
  textoGuardar?: string;
  /** Nota en el panel (p. ej. motivo de un rechazo anterior). */
  aviso?: ReactNode;
}) {
  const [capturas, setCapturas] = useState<Captura[]>([]);
  const urls = useRef<string[]>([]);

  // Libera las vistas previas al cerrar.
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const limpiar = () => {
    capturas.forEach((c) => URL.revokeObjectURL(c.url));
    setCapturas([]);
  };

  const onCaptura = (c: Captura) => {
    if (!c.descriptor) {
      URL.revokeObjectURL(c.url);
      toast.warning('No se pudo leer el rostro. Intenta de nuevo.');
      return;
    }
    urls.current.push(c.url);
    setCapturas((prev) => [...prev, c]);
  };

  const completas = capturas.length >= MUESTRAS_ROSTRO_MAX;
  const paso = PASOS_REGISTRO[Math.min(capturas.length, PASOS_REGISTRO.length - 1)];

  return (
    <EscanerRostro
      titulo={titulo}
      etiqueta={`Foto ${Math.min(capturas.length + 1, MUESTRAS_ROSTRO_MAX)} de ${MUESTRAS_ROSTRO_MAX}`}
      onCerrar={onCerrar}
      objetivo={paso.objetivo(capturas)}
      indicacion={completas ? 'Listo: revisa las fotos y guarda' : paso.texto}
      pausado={completas || guardando}
      onCaptura={onCaptura}
    >
      {capturas.length === 0 && aviso}
      <ul className="flex justify-center gap-2" aria-label="Fotos tomadas">
        {Array.from({ length: MUESTRAS_ROSTRO_MAX }, (_, i) => (
          <li
            key={i}
            className={cn(
              'relative size-11 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset [@media(max-height:720px)]:size-9',
              i === capturas.length && !completas ? 'ring-2 ring-brand-600' : 'ring-slate-200',
            )}
          >
            {capturas[i] && (
              <>
                <img
                  src={capturas[i].url}
                  alt={`Foto ${i + 1}`}
                  className="size-full -scale-x-100 object-cover"
                />
                <CircleCheck className="absolute right-0.5 bottom-0.5 size-4 rounded-full bg-white text-emerald-600" />
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          icon={<RotateCcw className="size-4" />}
          disabled={capturas.length === 0 || guardando}
          onClick={limpiar}
        >
          De nuevo
        </Button>
        <Button
          icon={<ScanFace className="size-4" />}
          disabled={capturas.length < MUESTRAS_ROSTRO_MIN}
          loading={guardando}
          onClick={() => onGuardar(capturas)}
        >
          {capturas.length < MUESTRAS_ROSTRO_MIN
            ? `Faltan ${MUESTRAS_ROSTRO_MIN - capturas.length} fotos`
            : textoGuardar}
        </Button>
      </div>
    </EscanerRostro>
  );
}
