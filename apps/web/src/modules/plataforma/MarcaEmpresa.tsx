import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Palette, RotateCcw, Trash2, TriangleAlert, Upload, Wand2 } from 'lucide-react';
import { esColorHex, generarPaleta, type ColorModo, type Empresa, type EmpresaMarca } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { Button, Input, toast } from '../../components/ui';
import { analizarImagen, pareceHorizontal } from './coloresImagen';
import { COLOR_ACENTO_DEFECTO, COLOR_PRINCIPAL_DEFECTO, EmpresaAvatar } from './EmpresaAvatar';
import { plataformaService } from './plataforma.service';
import { PrevisualizacionMarca } from './PrevisualizacionMarca';

/** Selector de color: el del sistema más el código hexadecimal. */
function CampoColor({
  etiqueta,
  ayuda,
  valor,
  onChange,
}: {
  etiqueta: string;
  ayuda: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{etiqueta}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="color"
          aria-label={etiqueta}
          value={valor}
          onChange={(e) => {
            setTexto(e.target.value);
            onChange(e.target.value);
          }}
          className="size-10 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
        />
        <Input
          aria-label={`${etiqueta} (código)`}
          value={texto}
          maxLength={7}
          className="font-mono uppercase"
          onChange={(e) => {
            const v = e.target.value.trim();
            setTexto(v);
            if (esColorHex(v)) onChange(v.toLowerCase());
          }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">{ayuda}</p>
    </div>
  );
}

const ORIGEN: Record<ColorModo, string> = {
  defecto: 'Se usan los colores de Gestión Comunicalo.',
  logo: 'Los colores se tomaron del ícono de la empresa.',
  personalizado: 'Los colores están personalizados.',
};

/**
 * Pestaña Marca (C-07, C-14): ícono, colores y vista previa. Por defecto se usa la paleta de Gestión Comunicalo; al
 * subir un ícono se toman sus colores; personalizarlos es opcional. Aquí solo se guarda: aplicarla a la app es C-09.
 */
export function MarcaEmpresa({ empresa }: { empresa: Empresa }) {
  const qc = useQueryClient();
  const archivo = useRef<HTMLInputElement>(null);
  const [editando, setEditando] = useState(false);
  const [principal, setPrincipal] = useState(empresa.colorPrincipal ?? COLOR_PRINCIPAL_DEFECTO);
  const [acento, setAcento] = useState(empresa.colorAcento ?? COLOR_ACENTO_DEFECTO);
  const refrescar = () => void qc.invalidateQueries({ queryKey: plataformaService.keys.all });

  // La dirección firmada cambia en cada consulta: se analiza una vez por imagen, no por firma.
  const imagen = empresa.logoUrl?.split('?')[0] ?? null;
  const analisis = useQuery({
    queryKey: ['plataforma', 'analisis-logo', imagen],
    queryFn: () => analizarImagen(empresa.logoUrl!),
    enabled: !!empresa.logoUrl,
    staleTime: Infinity,
    retry: false,
  });
  const coloresDelLogo = analisis.data?.colores ?? null;

  const guardarMarca = useMutation({
    mutationFn: (datos: EmpresaMarca) => plataformaService.marca(empresa.id, datos),
    onSuccess: (e) => {
      refrescar();
      setEditando(false);
      setPrincipal(e.colorPrincipal ?? COLOR_PRINCIPAL_DEFECTO);
      setAcento(e.colorAcento ?? COLOR_ACENTO_DEFECTO);
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const subir = useMutation({
    mutationFn: async (f: File) => {
      const e = await plataformaService.subirLogo(empresa.id, f);
      // Lo personalizado no se pisa; en los demás casos se toman los colores del ícono nuevo.
      if (e.colorModo === 'personalizado') return 'personalizados' as const;
      const a = e.logoUrl ? await analizarImagen(e.logoUrl) : null;
      if (!a?.colores) return 'sin-colores' as const;
      await plataformaService.marca(e.id, {
        colorModo: 'logo',
        colorPrincipal: a.colores.principal,
        colorAcento: a.colores.acento,
      });
      return 'aplicados' as const;
    },
    onSuccess: (r) => {
      refrescar();
      setEditando(false);
      toast.success(
        r === 'aplicados'
          ? 'Ícono actualizado y colores tomados de él'
          : r === 'personalizados'
            ? 'Ícono actualizado. Tus colores personalizados se conservan'
            : 'Ícono actualizado. No encontramos colores en él, se mantienen los actuales',
      );
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const quitar = useMutation({
    mutationFn: () => plataformaService.quitarLogo(empresa.id),
    onSuccess: (e) => {
      refrescar();
      toast.success(
        e.colorModo === 'defecto' && empresa.colorModo === 'logo'
          ? 'Ahora se usan las iniciales y los colores de Gestión Comunicalo'
          : 'Ahora se usan las iniciales de la empresa',
      );
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  // Colores que se ven en la vista previa: los que se están editando o los guardados.
  const efPrincipal = editando ? principal : (empresa.colorPrincipal ?? COLOR_PRINCIPAL_DEFECTO);
  const efAcento = editando ? acento : (empresa.colorAcento ?? (empresa.colorPrincipal ? null : COLOR_ACENTO_DEFECTO));
  const paleta = generarPaleta(efPrincipal, efAcento);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Ícono o logo</h2>
          <div className="mt-3 flex items-center gap-4">
            <EmpresaAvatar
              nombre={empresa.nombre}
              logoUrl={empresa.logoUrl}
              color={paleta.brand['700']}
              className="size-20 text-2xl"
            />
            <div className="flex flex-col gap-2">
              <input
                ref={archivo}
                type="file"
                accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label="Elegir ícono"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) subir.mutate(f);
                  e.target.value = '';
                }}
              />
              <Button
                variant="secondary"
                icon={<Upload className="size-4" />}
                loading={subir.isPending}
                onClick={() => archivo.current?.click()}
              >
                Subir SVG o PNG
              </Button>
              {empresa.logoUrl && (
                <Button
                  variant="ghost"
                  className="text-slate-600"
                  icon={<Trash2 className="size-4" />}
                  loading={quitar.isPending}
                  onClick={() => quitar.mutate()}
                >
                  Usar iniciales
                </Button>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Mejor solo el símbolo, cuadrado y sin letras. Hasta 300 KB: SVG, PNG, JPG o WebP. Sin ícono se usan las iniciales.
          </p>
          {analisis.data && pareceHorizontal(analisis.data) && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Esta imagen parece un logo horizontal (con letras). En el menú se verá muy pequeña; para que quede mejor, sube
              solo el símbolo.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Colores</h2>
          <p className="text-sm text-slate-600">{ORIGEN[empresa.colorModo]}</p>

          {editando ? (
            <div className="space-y-4">
              <CampoColor
                etiqueta="Color principal"
                ayuda="Botones, ítem activo del menú, enlaces y avatares."
                valor={principal}
                onChange={setPrincipal}
              />
              <CampoColor etiqueta="Color de acento" ayuda="Detalles sobre fondos oscuros." valor={acento} onChange={setAcento} />
              <div className="flex flex-wrap gap-2">
                <Button
                  loading={guardarMarca.isPending}
                  onClick={() =>
                    guardarMarca.mutate(
                      { colorModo: 'personalizado', colorPrincipal: principal, colorAcento: acento },
                      { onSuccess: () => toast.success('Colores guardados') },
                    )
                  }
                >
                  Guardar colores
                </Button>
                <Button variant="secondary" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {empresa.logoUrl && coloresDelLogo && empresa.colorModo !== 'logo' && (
                <Button
                  variant="secondary"
                  icon={<Wand2 className="size-4" />}
                  loading={guardarMarca.isPending}
                  onClick={() =>
                    guardarMarca.mutate(
                      { colorModo: 'logo', colorPrincipal: coloresDelLogo.principal, colorAcento: coloresDelLogo.acento },
                      { onSuccess: () => toast.success('Colores tomados del ícono') },
                    )
                  }
                >
                  Usar los colores del ícono
                </Button>
              )}
              <Button
                variant="secondary"
                icon={<Palette className="size-4" />}
                onClick={() => {
                  setPrincipal(empresa.colorPrincipal ?? COLOR_PRINCIPAL_DEFECTO);
                  setAcento(empresa.colorAcento ?? COLOR_ACENTO_DEFECTO);
                  setEditando(true);
                }}
              >
                Personalizar colores
              </Button>
              {empresa.colorModo !== 'defecto' && (
                <Button
                  variant="ghost"
                  icon={<RotateCcw className="size-4" />}
                  loading={guardarMarca.isPending}
                  onClick={() =>
                    guardarMarca.mutate(
                      { colorModo: 'defecto', colorPrincipal: null, colorAcento: null },
                      { onSuccess: () => toast.success('Colores de Gestión Comunicalo') },
                    )
                  }
                >
                  Restablecer a Gestión Comunicalo
                </Button>
              )}
            </div>
          )}

          {empresa.logoUrl && analisis.data && !coloresDelLogo && (
            <p className="text-xs text-slate-500">
              El ícono no tiene colores que podamos usar (es blanco, negro o gris), por eso se mantienen los colores actuales.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Vista previa</h2>
        <PrevisualizacionMarca nombre={empresa.nombre} logoUrl={empresa.logoUrl} paleta={paleta} />
        {paleta.ajustado ? (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-amber-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            Oscurecimos un poco el color principal (queda en {paleta.brand['700'].toUpperCase()}) para que el texto blanco se lea
            bien.
          </p>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700">
            <CircleCheck className="size-4" /> Contraste suficiente ({paleta.contraste}:1)
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Los colores se guardan en la empresa; la app se vestirá con ellos cuando se active la marca por empresa.
        </p>
      </section>
    </div>
  );
}
