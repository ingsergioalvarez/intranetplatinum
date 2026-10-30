/**
 * Perfiles rápidos de guardias (A-40): el celular recuerda a quienes han entrado en él para mostrar sus
 * tarjetas en la pantalla de entrada. Guarda la clave propia del celular (el servidor solo conserva su
 * hash); sin el PIN o la contraseña esa clave no abre nada. Cerrar sesión no borra la tarjeta.
 */
export interface PerfilRapido {
  usuarioId: number;
  nombre: string;
  email: string;
  /** Id del celular en el servidor (para sincronizar su estado). */
  dispositivoId: number;
  token: string;
  tienePin: boolean;
  /** Bloqueado por PIN incorrecto: pide la contraseña (al entrar con ella se libera). */
  bloqueado: boolean;
}

const CLAVE = 'auth.perfiles';
const AVISO_PIN = 'auth.avisoPinOculto';

function leer(): PerfilRapido[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function escribir(lista: PerfilRapido[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Sin almacenamiento (modo privado): no hay tarjetas, se entra con contraseña.
  }
}

/** Tarjetas de este celular, la más reciente primero. */
export const perfilesGuardados = () => leer();

export const perfilPorCorreo = (email: string) =>
  leer().find((p) => p.email.toLowerCase() === email.trim().toLowerCase());

export const perfilDeUsuario = (usuarioId: number) => leer().find((p) => p.usuarioId === usuarioId);

/** Guarda o actualiza la tarjeta y la sube al primer lugar. */
export function guardarPerfil(perfil: PerfilRapido) {
  escribir([perfil, ...leer().filter((p) => p.usuarioId !== perfil.usuarioId)]);
}

export function actualizarPerfil(usuarioId: number, cambios: Partial<PerfilRapido>) {
  escribir(leer().map((p) => (p.usuarioId === usuarioId ? { ...p, ...cambios } : p)));
}

export function quitarPerfil(usuarioId: number) {
  escribir(leer().filter((p) => p.usuarioId !== usuarioId));
}

/** El aviso "Crea un PIN" se oculta por guardia con "Ahora no". */
export function avisoPinOculto(usuarioId: number) {
  try {
    return (JSON.parse(localStorage.getItem(AVISO_PIN) ?? '[]') as number[]).includes(usuarioId);
  } catch {
    return false;
  }
}

export function ocultarAvisoPin(usuarioId: number) {
  try {
    const ids = new Set(JSON.parse(localStorage.getItem(AVISO_PIN) ?? '[]') as number[]);
    ids.add(usuarioId);
    localStorage.setItem(AVISO_PIN, JSON.stringify([...ids]));
  } catch {
    // Sin almacenamiento: el aviso volverá a salir.
  }
}
