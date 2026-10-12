import { useEffect, useMemo, useRef } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { cn } from './cn';

export interface PhotoUploaderProps {
  value: File[];
  onChange: (files: File[]) => void;
  max?: number;
  disabled?: boolean;
  error?: string;
}

/**
 * Captura de fotos de evidencia. En celular abre la cámara trasera (`capture="environment"`)
 * y también permite elegir de la galería. La compresión antes de subir se agrega en F3-03.
 */
export function PhotoUploader({ value, onChange, max = 10, disabled, error }: PhotoUploaderProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => value.map((f) => URL.createObjectURL(f)), [value]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const images = Array.from(list).filter((f) => f.type.startsWith('image/'));
    onChange([...value, ...images].slice(0, max));
  };

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const full = value.length >= max;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        {previews.map((src, i) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
            <img src={src} alt={`Foto ${i + 1}`} className="size-full object-cover" />
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white"
                aria-label={`Quitar foto ${i + 1}`}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}

        {!full && !disabled && (
          <>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm',
                error
                  ? 'border-red-400 text-red-600'
                  : 'border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-600',
              )}
            >
              <Camera className="size-6" />
              Tomar foto
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600"
            >
              <ImagePlus className="size-6" />
              Galería
            </button>
          </>
        )}
      </div>

      <p className={cn('text-sm', error ? 'text-red-600' : 'text-slate-500')}>
        {error ?? `${value.length} de ${max} fotos`}
      </p>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
