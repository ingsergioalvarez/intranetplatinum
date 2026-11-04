import { cn } from '../../components/ui';

/** Colores de Gestión Comunicalo: lo que usa una empresa sin marca propia. */
export const COLOR_PRINCIPAL_DEFECTO = '#0b3263';
export const COLOR_ACENTO_DEFECTO = '#00ccfc';

const iniciales = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Ícono de la empresa: su logo sobre un cuadro claro (así se lee cualquier logo, también sobre el menú oscuro);
 * sin logo, sus iniciales sobre su color principal.
 */
export function EmpresaAvatar({
  nombre,
  logoUrl,
  color,
  className,
}: {
  nombre: string;
  logoUrl?: string | null;
  color?: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-1 ring-slate-200',
          className,
        )}
      >
        <img src={logoUrl} alt="" className="size-full object-contain" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: color || COLOR_PRINCIPAL_DEFECTO }}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white',
        className,
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}

/**
 * Nombre de la empresa con el estilo de nuestra marca ("gestión comunícalo."): minúsculas, la primera palabra
 * en gris claro y el resto, con un punto final, en el color de acento de la empresa.
 * Para fondos oscuros.
 */
export function NombreEmpresa({ nombre, acento, className }: { nombre: string; acento: string; className?: string }) {
  const [primera, ...resto] = nombre.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return (
    <span className={cn('font-semibold tracking-tight', className)}>
      <span className="text-platinum-300">{primera ?? ''}</span>
      {resto.length > 0 ? (
        <>
          {' '}
          <span style={{ color: acento }}>{resto.join(' ')}.</span>
        </>
      ) : (
        <span style={{ color: acento }}>.</span>
      )}
    </span>
  );
}

/** Tarjeta de la empresa bajo nuestra marca, en la barra lateral oscura. */
export function TarjetaEmpresa({
  nombre,
  logoUrl,
  colorPrincipal,
  acento,
  compacta,
}: {
  nombre: string;
  logoUrl?: string | null;
  colorPrincipal: string;
  acento: string;
  compacta?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2.5 rounded-xl bg-white/5 ring-1 ring-white/10', compacta ? 'p-1.5' : 'p-2')}>
      <EmpresaAvatar
        nombre={nombre}
        logoUrl={logoUrl}
        color={colorPrincipal}
        className={compacta ? 'size-7 text-xs' : 'size-9'}
      />
      <NombreEmpresa nombre={nombre} acento={acento} className={cn('truncate', compacta ? 'text-xs' : 'text-sm')} />
    </div>
  );
}
