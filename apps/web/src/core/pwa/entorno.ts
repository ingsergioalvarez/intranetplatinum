/**
 * Dónde está abierta la página (A-70): celular o tableta, iPhone o Android, si ya corre como app instalada y si
 * es un navegador que sí puede instalarla. Funciones puras para poder probarlas con distintos navegadores.
 */
export type Plataforma = 'ios' | 'android' | 'otra';

export interface Entorno {
  plataforma: Plataforma;
  /** Celular o tableta (iPhone, iPad o Android). En computadora nunca se pide instalar. */
  movil: boolean;
  /** Ya está abierta como app instalada (sin barra del navegador). */
  instalada: boolean;
  /** Navegador que vive dentro de otra app (WhatsApp, Facebook, Instagram…): ahí no se puede instalar. */
  navegadorDeApp: boolean;
  /** Safari de iPhone o iPad: único en iOS que ofrece "Agregar a pantalla de inicio" con los pasos conocidos. */
  safariIos: boolean;
}

interface NavegadorMinimo {
  userAgent: string;
  maxTouchPoints?: number;
  platform?: string;
}

const NAVEGADOR_DE_APP = /FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|WhatsApp|Snapchat|TikTok|Line\/|Twitter|LinkedInApp|; wv\)/i;

export function detectarEntorno(nav: NavegadorMinimo, standalone: boolean): Entorno {
  const ua = nav.userAgent;
  // iPadOS 13+ se presenta como Mac: se distingue porque tiene pantalla táctil.
  const ios = /iPhone|iPod|iPad/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
  const android = /Android/i.test(ua);
  const plataforma: Plataforma = ios ? 'ios' : android ? 'android' : 'otra';
  const navegadorDeApp = NAVEGADOR_DE_APP.test(ua);
  const safariIos = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) && !navegadorDeApp;
  return { plataforma, movil: plataforma !== 'otra', instalada: standalone, navegadorDeApp, safariIos };
}

/** ¿Está abierta como app instalada? (Android/escritorio: display-mode; iPhone: `navigator.standalone`). */
export function esAppInstalada() {
  if (typeof window === 'undefined') return false;
  const modos = ['standalone', 'fullscreen', 'minimal-ui'];
  const porModo = typeof window.matchMedia === 'function' && modos.some((m) => window.matchMedia(`(display-mode: ${m})`).matches);
  return porModo || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
