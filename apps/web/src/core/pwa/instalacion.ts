import { useState } from 'react';
import { create } from 'zustand';
import { detectarEntorno, esAppInstalada, type Entorno } from './entorno';

/** Evento del navegador que permite instalar con un botón (Chrome y parecidos en Android). */
export interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CLAVE_INSTALADA = 'platinum-pwa-instalada';
/** Cuánto se espera el evento de instalación en Android antes de dar los pasos a mano. */
const ESPERA_EVENTO_MS = 4000;

const leerMarca = () => {
  try {
    return localStorage.getItem(CLAVE_INSTALADA) === '1';
  } catch {
    return false;
  }
};
const guardarMarca = (valor: boolean) => {
  try {
    if (valor) localStorage.setItem(CLAVE_INSTALADA, '1');
    else localStorage.removeItem(CLAVE_INSTALADA);
  } catch {
    /* sin almacenamiento: solo se pierde el recordatorio */
  }
};

interface InstalacionState {
  evento: EventoInstalar | null;
  /** Se instaló en esta visita (el navegador sigue abierto). */
  instaladaAhora: boolean;
  /** Ya la tenía instalada de antes (marca guardada en este navegador). */
  marcaInstalada: boolean;
  /** Tocó "Continuar" en esta visita: vuelve a salir la próxima vez que abra la página. */
  continuo: boolean;
  /** Cerró el aviso nativo de instalación: ese evento ya no se puede reusar. */
  rechazoNativo: boolean;
  /** Ya pasó el tiempo de espera del evento de instalación (Android): si no llegó, se dan los pasos a mano. */
  esperaTerminada: boolean;
  setEvento: (e: EventoInstalar | null) => void;
  marcarInstalada: () => void;
  olvidarInstalada: () => void;
  continuar: () => void;
  rechazar: () => void;
}

export const useInstalacionStore = create<InstalacionState>((set) => ({
  evento: null,
  instaladaAhora: false,
  marcaInstalada: leerMarca(),
  continuo: false,
  rechazoNativo: false,
  esperaTerminada: false,
  setEvento: (evento) => set({ evento }),
  marcarInstalada: () => {
    guardarMarca(true);
    set({ instaladaAhora: true, marcaInstalada: true, evento: null });
  },
  olvidarInstalada: () => {
    guardarMarca(false);
    set({ instaladaAhora: false, marcaInstalada: false });
  },
  continuar: () => set({ continuo: true }),
  rechazar: () => set({ rechazoNativo: true, evento: null }),
}));

/**
 * Se llama una sola vez al arrancar, antes de pintar nada: el navegador puede avisar que la app se puede instalar
 * antes de que React cargue, y ese aviso no se repite.
 */
export function iniciarInstalacion() {
  // Abierta como app: queda la marca para saber, desde el navegador, que ya está instalada.
  if (esAppInstalada()) guardarMarca(true);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstalacionStore.getState().setEvento(e as EventoInstalar);
  });
  window.addEventListener('appinstalled', () => useInstalacionStore.getState().marcarInstalada());
  // La espera corre desde el arranque (no desde que se pinta la ventana) para que todas las pantallas coincidan.
  setTimeout(() => useInstalacionStore.setState({ esperaTerminada: true }), ESPERA_EVENTO_MS);
}

/**
 * Qué hay que pedirle a la persona (A-70):
 * - `nada`: computadora, app ya instalada, o todavía no se sabe.
 * - `instalar`: Android con instalación nativa (botón "Instalar"). Obligatorio.
 * - `ios`: Safari de iPhone: pasos de "Agregar a pantalla de inicio". Obligatorio.
 * - `abrir_icono`: ya está instalada, pero abrió el navegador. Obligatorio.
 * - `manual`: este navegador no puede instalarla: instrucciones y un "Continuar" para no dejar a nadie sin trabajar.
 */
export type ModoInstalacion = 'nada' | 'instalar' | 'ios' | 'abrir_icono' | 'manual';

export function useRequisitoInstalacion(): { modo: ModoInstalacion; entorno: Entorno } {
  const [entorno] = useState(() => detectarEntorno(navigator, esAppInstalada()));
  const { evento, instaladaAhora, marcaInstalada, continuo, rechazoNativo, esperaTerminada } = useInstalacionStore();

  let modo: ModoInstalacion = 'nada';
  if (!entorno.movil || entorno.instalada) modo = 'nada';
  else if (entorno.plataforma === 'ios') modo = entorno.safariIos ? 'ios' : 'manual';
  else if (instaladaAhora || (marcaInstalada && !evento)) modo = 'abrir_icono';
  else if (evento && !entorno.navegadorDeApp) modo = 'instalar';
  else if (esperaTerminada || rechazoNativo || entorno.navegadorDeApp) modo = 'manual';
  // "Continuar" solo existe en `manual`.
  if (modo === 'manual' && continuo) modo = 'nada';
  return { modo, entorno };
}
