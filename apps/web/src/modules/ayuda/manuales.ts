import { ROLES, type Rol } from '@platinum/shared';

/**
 * Manuales de usuario (A-44, A-69). El texto vive en `docs/manual/*.md` y se empaqueta con la app: se lee sin
 * conexión y solo se muestra a quien entró con su cuenta. Un manual que aún no existe se omite solo.
 */
const textos = import.meta.glob(
  [
    '../../../../../docs/manual/comun.md',
    '../../../../../docs/manual/guardia.md',
    '../../../../../docs/manual/supervisor.md',
    '../../../../../docs/manual/admin.md',
    '../../../../../docs/manual/cliente.md',
    '../../../../../docs/manual/c2.md',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** Capturas de pantalla del manual por nombre de archivo sin extensión (`G01-checador`), en la carpeta de su manual. */
const imagenes = import.meta.glob('../../../../../docs/manual/capturas/**/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const porNombre = (archivo: string) => {
  const ruta = Object.keys(textos).find((r) => r.endsWith(`/${archivo}.md`));
  return ruta ? textos[ruta] : undefined;
};

export const capturaPorId = (id: string): string | undefined => {
  const ruta = Object.keys(imagenes).find((r) => r.endsWith(`/${id}.png`));
  return ruta ? imagenes[ruta] : undefined;
};

export interface Manual {
  clave: string;
  /** Pestaña. */
  etiqueta: string;
  texto: string;
}

const PARTES: { clave: string; etiqueta: string }[] = [
  { clave: 'comun', etiqueta: 'Parte común' },
  { clave: 'guardia', etiqueta: 'Guardia' },
  { clave: 'supervisor', etiqueta: 'Supervisor' },
  { clave: 'admin', etiqueta: 'Administrador' },
  { clave: 'cliente', etiqueta: 'Cliente' },
  { clave: 'c2', etiqueta: 'C2' },
];

/** Qué ve cada rol: la parte común y lo suyo. El administrador ve todo. */
const POR_ROL: Record<Rol, string[]> = {
  [ROLES.GUARDIA]: ['comun', 'guardia'],
  [ROLES.SUPERVISOR]: ['comun', 'supervisor'],
  [ROLES.CLIENTE]: ['comun', 'cliente'],
  [ROLES.C2]: ['comun', 'c2'],
  [ROLES.ADMIN]: PARTES.map((p) => p.clave),
};

export function manualesDe(rol: Rol): Manual[] {
  return POR_ROL[rol].flatMap((clave) => {
    const texto = porNombre(clave);
    const parte = PARTES.find((p) => p.clave === clave)!;
    return texto ? [{ clave, etiqueta: parte.etiqueta, texto }] : [];
  });
}

/** ¿Falta el manual del propio rol (todavía no escrito)? El archivo de cada rol se llama como el rol. */
export const manualDelRolPendiente = (rol: Rol) => !porNombre(rol);
