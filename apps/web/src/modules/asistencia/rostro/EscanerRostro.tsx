import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  CameraOff,
  CircleCheck,
  Eye,
  Glasses,
  Lightbulb,
  Move,
  RefreshCw,
  ShieldAlert,
  SmartphoneNfc,
  UserCheck,
} from 'lucide-react';
import type { ResultadoVerificacion } from '@platinum/shared';
import { Button, Spinner, cn } from '../../../components/ui';
import {
  DetectorParpadeo,
  aperturaOjos,
  CABECEO_DESDE_ABAJO,
  CABECEO_DESDE_ARRIBA,
  cabeceo,
  evaluarEncuadre,
  evaluarLuz,
  CONTRASTE_OJOS_MIN,
  contrasteOjos,
  evaluarPose,
  geometriaOvalo,
  pareceTenerLentes,
  recortarRostro,
  type Luz,
  type Mirada,
  type Objetivo,
  type Ovalo,
  type Pose,
  type Posicion,
} from './calidad';
import {
  DetectorGesto,
  TEXTO_GESTO,
  medidasRostro,
  mezclarMedidas,
  sortearGesto,
  type Gesto,
  type Medidas,
} from './gestos';
import { INCLINACION_MAX, INCLINACION_MIN } from './inclinacion';
import { cargarMotor, type Motor, type Punto } from './motor';
import { PantallaCamara } from './PantallaCamara';

export interface Captura {
  foto: Blob;
  /** URL local para vista previa (quien la recibe la libera con `URL.revokeObjectURL`). */
  url: string;
  /** Vector facial de 128 valores, o null si no se pudo leer el rostro. */
  descriptor: number[] | null;
  /** Hacia dónde estaba girada la cabeza (para pedir el lado contrario en la siguiente). */
  giro: Pose['giro'];
  /** Cabeceo de la cara en la foto (la de frente sirve de base para pedir arriba / abajo). */
  cabeceo: number | null;
  /** Tocó "No traigo lentes" aunque se detectaban lentes (DA-44). */
  sinLentes: boolean;
}

/** Intentos rechazados que detecta la cámara (DA-31). */
export type MotivoCamara = 'pantalla' | 'no_titular' | 'reto_fallido';

/** Verificación en vivo del dueño de la cuenta (marcas, DA-28 a DA-30). */
export interface Titular {
  /** Nombre del titular para el saludo ("Hola, Juan"). */
  nombre: string;
  verificar: (descriptor: number[]) => Promise<ResultadoVerificacion>;
  /** Intento rechazado con su foto (cada motivo se reporta una sola vez por apertura de la cámara). */
  onIncidencia: (motivo: MotivoCamara, foto: Blob, descriptor: number[] | null) => void;
}

interface Props {
  titulo: string;
  etiqueta?: ReactNode;
  onCerrar: () => void;
  onCaptura: (c: Captura) => void;
  /** Pose pedida (de frente o girando a un lado). */
  objetivo?: Objetivo;
  /** Texto de la pose pedida. */
  indicacion?: string;
  /** Detiene el análisis (p. ej. ya se tomaron todas las fotos). */
  pausado?: boolean;
  /** Contenido extra del panel inferior (miniaturas, botones). */
  children?: ReactNode;
  /**
   * Marcas: no se habilita la foto hasta confirmar que es el titular y que no es una pantalla o
   * foto; en lugar del parpadeo se pide un gesto al azar.
   */
  titular?: Titular;
}

type Identidad = 'buscando' | 'titular' | 'no_titular';

/** Gesto en curso (para la vista). */
interface RetoVista {
  gesto: Gesto;
  /** Cuándo se pidió (reinicia la barra de tiempo). */
  inicio: number;
  paso: number;
  total: number;
  regresando: boolean;
}

type Fase =
  | { tipo: 'cargando'; progreso: number }
  | { tipo: 'iniciando' }
  | { tipo: 'activo' }
  | { tipo: 'error'; mensaje: string };

interface Calidad {
  luz: Luz;
  posicion: Posicion | null;
  mirada: Mirada | null;
  instruccion: string;
  listo: boolean;
  /** Listo y estable: se pide parpadear (animación). */
  armado: boolean;
  /** Teléfono abajo apuntando hacia arriba, o muy arriba apuntando hacia abajo (DA-44). */
  telefono: 'bajo' | 'alto' | null;
}

/**
 * Cara oscura u ojos que no se distinguen (DA-44): se pide más luz o quitarse los lentes, pero si
 * después de este tiempo no mejora se deja continuar (no se bloquea para siempre).
 */
const TOLERAR_VISTA_MS = 12_000;

/** Segundos con lentes detectados antes de ofrecer "No traigo lentes" (por si el detector se equivoca). */
const OFRECER_SIN_LENTES_MS = 15_000;

/** El análisis en vivo usa una copia reducida del video: más cuadros por segundo para no perder el parpadeo. */
const ANCHO_ANALISIS = 360;
/** La foto que se guarda sí va en mejor calidad. */
const ANCHO_FOTO = 960;
/** Luz y lentes se revisan cada medio segundo (leer los píxeles en cada cuadro es lento). */
const LUZ_CADA_MS = 500;
/** Todo en verde y la cara dentro del óvalo durante este tiempo antes de pedir el parpadeo. */
const ESTABLE_MS = 1000;
/** Tras el parpadeo se espera a que los ojos estén bien abiertos antes de la foto. */
const ESPERA_TRAS_PARPADEO_MS = 400;
const MAX_ESPERA_OJOS_MS = 1500;
/** "Tomar foto" manual aparece como respaldo si no se logra en este tiempo. */
const ESPERA_RESPALDO_MS = 10_000;
/** Pausa tras cada foto: se muestra "Foto lista" y se vuelve a exigir estabilidad. */
const PAUSA_TRAS_FOTO_MS = 1200;
/** Un indicador que falla un instante (p. ej. durante el parpadeo) no reinicia la espera. */
const TOLERANCIA_NO_LISTO_MS = 400;
/** Verificación del titular en vivo: una consulta por segundo como máximo. */
const VERIFICAR_CADA_MS = 900;
/** Verificaciones seguidas que confirman al titular. */
const TITULAR_SEGUIDAS = 2;
/** Verificaciones de "no es el titular" antes de guardar la evidencia y avisar. */
const NO_TITULAR_PARA_AVISO = 3;
/** Sin cara este tiempo, puede ser otra persona: se vuelve a buscar al titular. */
const SIN_CARA_REINICIA_MS = 600;
/** Los primeros instantes con la cara a la vista solo se dibuja la malla (lo demás espera). */
const PRIORIDAD_MALLA_MS = 500;
/** Mensaje cuando la foto final no pasa la revisión. */
const RECHAZO_MS = 1800;
/** Tiempo para hacer el gesto pedido (DA-29). */
const TIEMPO_GESTO_MS = 6000;
/** Gestos no completados a tiempo antes de reportar la incidencia. */
const FALLOS_PARA_AVISO = 3;
/** Detector de pantalla (DA-30): por debajo es pantalla o foto; entre ambos, duda (segundo gesto). */
const UMBRAL_PANTALLA = 0.2;
const UMBRAL_DUDA = 0.8;
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

function mensajeCamara(err: unknown) {
  const nombre = (err as { name?: string })?.name;
  if (nombre === 'NotAllowedError' || nombre === 'PermissionDeniedError') {
    return 'Permite el acceso a la cámara en el navegador para continuar.';
  }
  if (nombre === 'NotFoundError' || nombre === 'DevicesNotFoundError') return 'No se encontró una cámara.';
  if (nombre === 'NotReadableError' || nombre === 'TrackStartError') {
    return 'La cámara está ocupada por otra aplicación.';
  }
  if (nombre === 'NotSupportedError' || !navigator.mediaDevices) {
    return 'La cámara requiere una conexión segura (HTTPS).';
  }
  return 'No se pudo preparar el reconocimiento facial. Revisa tu conexión e intenta de nuevo.';
}

/**
 * Cámara frontal a pantalla completa con guía en vivo (luz, mirada, posición dentro del óvalo).
 * Cuando todo está en verde durante 1 s aparece la animación "¡Listo! Parpadea" y la foto se toma
 * al parpadear (prueba de vida). "Tomar foto" aparece solo como respaldo a los 10 s.
 *
 * Con `titular` (marcas) además:
 * - Busca al dueño de la cuenta desde que abre (DA-28): hasta confirmarlo no hay foto; si es otra
 *   persona lo dice y se reporta la incidencia.
 * - Revisa que no sea una pantalla o foto (DA-30); si hay duda se piden dos gestos.
 * - En lugar del parpadeo pide un gesto al azar (DA-29) y la foto se toma al terminarlo. No hay
 *   "Tomar foto" manual (sería una forma de saltarse la prueba de vida).
 * La foto final se vuelve a revisar (de frente, dentro del óvalo, persona real y titular).
 */
export function EscanerRostro({
  titulo,
  etiqueta,
  onCerrar,
  onCaptura,
  objetivo = { tipo: 'frente' },
  indicacion,
  pausado = false,
  children,
  titular,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const visorRef = useRef<HTMLDivElement>(null);
  const mallaRef = useRef<HTMLCanvasElement>(null);
  const analisisRef = useRef<HTMLCanvasElement | null>(null);
  const luzRef = useRef<{ luz: Luz; en: number }>({ luz: 'ok', en: 0 });
  const lentesRef = useRef(0);
  const motorRef = useRef<Motor | null>(null);
  const giroRef = useRef<Pose['giro']>(0);
  const confianzaRef = useRef(1);
  const ultimaConfianzaRef = useRef(0);
  const parpadeoRef = useRef(new DetectorParpadeo());
  const listoDesdeRef = useRef<number | null>(null);
  const noListoDesdeRef = useRef<number | null>(null);
  const bloqueoHastaRef = useRef(0);
  const pausadoRef = useRef(pausado);
  const capturandoRef = useRef(false);
  const onCapturaRef = useRef(onCaptura);
  const objetivoRef = useRef(objetivo);
  const respaldoTimerRef = useRef(0);
  const titularRef = useRef(titular);
  const identidadRef = useRef<Identidad>('buscando');
  const verificandoRef = useRef(false);
  const ultimaVerificacionRef = useRef(0);
  const seguidasRef = useRef({ titular: 0, otro: 0 });
  /** Cambia cuando se pierde la cara: las verificaciones en curso ya no cuentan. */
  const generacionRef = useRef(0);
  const sinCaraDesdeRef = useRef<number | null>(null);
  /** Desde cuándo se ve la cara (para dar prioridad a la malla al inicio). */
  const caraDesdeRef = useRef<number | null>(null);
  const reportadosRef = useRef(new Set<MotivoCamara>());
  /** Resultados seguidos del detector de pantalla. */
  const vidaRef = useRef({ bajas: 0, altas: 0 });
  const pantallaRef = useRef(false);
  /** El detector tuvo duda en esta apertura: se piden dos gestos. */
  const dudaRef = useRef(false);
  /** Medidas normales de la cara (aprendidas de frente) para detectar los gestos. */
  const baseRef = useRef<Medidas | null>(null);
  /** Gestos completados antes de la foto en curso (con duda se exigen dos). */
  const gestosHechosRef = useRef(0);
  /** Lo último que se mostró de "regresa al frente" (para actualizar la vista solo al cambiar). */
  const regresandoVistoRef = useRef(false);
  const retoRef = useRef<{
    detector: DetectorGesto;
    inicio: number;
    hechos: number;
    total: number;
    fallos: number;
    usados: Gesto[];
  } | null>(null);

  const [fase, setFase] = useState<Fase>({ tipo: 'cargando', progreso: 0 });
  const [calidad, setCalidad] = useState<Calidad>({
    luz: 'ok',
    posicion: null,
    mirada: null,
    instruccion: 'Coloca tu cara dentro del óvalo',
    listo: false,
    armado: false,
    telefono: null,
  });
  const [ovalo, setOvalo] = useState<Ovalo | null>(null);
  const [capturando, setCapturando] = useState(false);
  const [fotoLista, setFotoLista] = useState(false);
  const [respaldo, setRespaldo] = useState(false);
  const [lentes, setLentes] = useState(false);
  // Lentes obligatorio quitarlos (DA-44); si el detector se equivoca, puede decir que no trae.
  const [sinLentes, setSinLentes] = useState(false);
  const [ofrecerSinLentes, setOfrecerSinLentes] = useState(false);
  const lentesBloqueanRef = useRef(false);
  // Ojos que no se distinguen (con histéresis) y la tolerancia si no mejora.
  const ojosRef = useRef(0);
  const ojosMalRef = useRef(false);
  const vistaDesdeRef = useRef<number | null>(null);
  const vistaToleradaRef = useRef(false);
  const sinLentesRef = useRef(false);
  /** Inclinación del teléfono (beta, grados: 90 = vertical); null si no hay sensor. */
  const inclinacionRef = useRef<number | null>(null);
  const [intento, setIntento] = useState(0);
  const [identidad, setIdentidad] = useState<Identidad>('buscando');
  const [reportados, setReportados] = useState<MotivoCamara[]>([]);
  const [pantalla, setPantalla] = useState(false);
  const [reto, setReto] = useState<RetoVista | null>(null);
  const [rechazo, setRechazo] = useState<string | null>(null);
  /** Ya se analizó el primer cuadro (hasta entonces: "Ubicando tu rostro…"). */
  const [analizando, setAnalizando] = useState(false);

  useEffect(() => {
    onCapturaRef.current = onCaptura;
    objetivoRef.current = objetivo;
    titularRef.current = titular;
  });

  const fijarIdentidad = useCallback((i: Identidad) => {
    identidadRef.current = i;
    setIdentidad(i);
  }, []);

  const fijarPantalla = useCallback((p: boolean) => {
    pantallaRef.current = p;
    setPantalla(p);
  }, []);

  /** Gesto en curso → vista (null: sin gesto). */
  const mostrarReto = useCallback(() => {
    const r = retoRef.current;
    regresandoVistoRef.current = r?.detector.regresando ?? false;
    setReto(
      r && {
        gesto: r.detector.gesto,
        inicio: r.inicio,
        paso: r.hechos + 1,
        total: r.total,
        regresando: r.detector.regresando,
      },
    );
  }, []);

  /** Pide un gesto nuevo (distinto de los ya pedidos en esta marca). */
  const nuevoGesto = useCallback(
    (ahora: number) => {
      const r = retoRef.current;
      const gesto = sortearGesto(r?.usados);
      retoRef.current = {
        detector: new DetectorGesto(gesto, baseRef.current!, parpadeoRef.current),
        inicio: ahora,
        hechos: r?.hechos ?? 0,
        total: r?.total ?? (dudaRef.current ? 2 : 1),
        fallos: r?.fallos ?? 0,
        usados: [...(r?.usados ?? []), gesto],
      };
      mostrarReto();
    },
    [mostrarReto],
  );

  const cancelarReto = useCallback(() => {
    if (!retoRef.current) return;
    retoRef.current = null;
    listoDesdeRef.current = null;
    setReto(null);
  }, []);

  /** Se perdió la cara (pudo cambiar la persona): se vuelve a buscar al titular. */
  const reiniciarIdentidad = useCallback(() => {
    generacionRef.current++;
    seguidasRef.current = { titular: 0, otro: 0 };
    baseRef.current = null;
    cancelarReto();
    if (identidadRef.current !== 'buscando') fijarIdentidad('buscando');
  }, [fijarIdentidad, cancelarReto]);

  /** Reporta una incidencia con la foto del momento (una vez por motivo en esta apertura). */
  const reportar = useCallback(
    (motivo: MotivoCamara, foto: HTMLCanvasElement, descriptor: number[] | null) => {
      const t = titularRef.current;
      if (!t || reportadosRef.current.has(motivo)) return;
      reportadosRef.current.add(motivo);
      setReportados([...reportadosRef.current]);
      foto.toBlob((b) => b && t.onIncidencia(motivo, b, descriptor), 'image/jpeg', 0.85);
    },
    [],
  );

  /**
   * Detector de pantalla o foto (DA-30). Dos resultados muy bajos seguidos → pantalla; tres
   * normales seguidos la quitan. Un resultado intermedio marca duda (se pedirán dos gestos).
   */
  const evaluarVida = useCallback(
    (vida: number, foto: HTMLCanvasElement, descriptor: number[] | null) => {
      const v = vidaRef.current;
      if (vida < UMBRAL_PANTALLA) {
        v.altas = 0;
        v.bajas++;
        if (v.bajas >= 2 && !pantallaRef.current) {
          fijarPantalla(true);
          cancelarReto();
          reportar('pantalla', foto, descriptor);
        }
        return;
      }
      v.bajas = 0;
      if (vida < UMBRAL_DUDA) {
        dudaRef.current = true;
        v.altas = 0;
      } else if (++v.altas >= 3 && pantallaRef.current) {
        fijarPantalla(false);
      }
    },
    [fijarPantalla, cancelarReto, reportar],
  );

  /** Muestra un momento por qué no se tomó la foto. */
  const rechazar = useCallback((motivo: string) => {
    setRechazo(motivo);
    setTimeout(() => setRechazo(null), RECHAZO_MS);
  }, []);

  /** "Tomar foto" vuelve a ocultarse y reaparece a los 10 s sin lograr la foto. */
  const reiniciarRespaldo = useCallback(() => {
    setRespaldo(false);
    clearTimeout(respaldoTimerRef.current);
    respaldoTimerRef.current = window.setTimeout(() => setRespaldo(true), ESPERA_RESPALDO_MS);
  }, []);

  // Cambiar de pose pedida o pausar reinicia la espera (estabilidad y parpadeo).
  const claveObjetivo =
    objetivo.tipo === 'lado'
      ? `lado${objetivo.signo ?? ''}`
      : objetivo.tipo === 'vertical'
        ? objetivo.sentido
        : 'frente';
  useEffect(() => {
    pausadoRef.current = pausado;
    parpadeoRef.current.reiniciar();
    listoDesdeRef.current = null;
  }, [pausado, claveObjetivo]);

  // Óvalo guía calculado con la misma fórmula que usa la revisión del encuadre.
  useEffect(() => {
    const visor = visorRef.current;
    if (!visor) return;
    const medir = () => setOvalo(geometriaOvalo(visor.clientWidth, visor.clientHeight));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(visor);
    return () => obs.disconnect();
  }, []);

  /** Cuadro nuevo del video: foto en buena calidad y los puntos del rostro de ese mismo instante. */
  const tomarCuadro = useCallback(async () => {
    const foto = fotoDelVideo(videoRef.current!);
    const puntos = await motorRef.current!.analizar(reducir(foto, ANCHO_ANALISIS));
    return { foto, puntos };
  }, []);

  /**
   * Verificación en vivo: vector de la cara actual → servidor. Dos "titular" seguidos lo confirman;
   * tres "no es el titular" guardan la foto como evidencia y avisan (una vez por apertura).
   */
  const verificarEnVivo = useCallback(
    async (puntos: Punto[]) => {
      const t = titularRef.current;
      const motor = motorRef.current;
      const video = videoRef.current;
      if (!t || !motor || !video) return;
      verificandoRef.current = true;
      ultimaVerificacionRef.current = Date.now();
      const generacion = generacionRef.current;
      try {
        const foto = fotoDelVideo(video);
        const descriptor = await motor.vector(recortarRostro(foto, puntos));
        if (!descriptor) return;
        evaluarVida(await motor.vida(foto, puntos), foto, descriptor);
        if (pantallaRef.current) return;
        const resultado = await t.verificar(descriptor);
        if (generacion !== generacionRef.current) return;
        const seguidas = seguidasRef.current;
        if (resultado === 'titular' || resultado === 'sin_rostro') {
          seguidas.otro = 0;
          seguidas.titular++;
          if (seguidas.titular >= TITULAR_SEGUIDAS || resultado === 'sin_rostro') fijarIdentidad('titular');
        } else if (resultado === 'no_titular') {
          seguidas.titular = 0;
          seguidas.otro++;
          fijarIdentidad('no_titular');
          cancelarReto();
          if (seguidas.otro >= NO_TITULAR_PARA_AVISO) reportar('no_titular', foto, descriptor);
        } else {
          // Dudoso (luz, distancia): se sigue buscando.
          seguidas.titular = 0;
          if (identidadRef.current === 'titular') {
            fijarIdentidad('buscando');
            cancelarReto();
          }
        }
      } catch {
        // Sin conexión o error del servidor: se reintenta en la siguiente vuelta.
      } finally {
        verificandoRef.current = false;
      }
    },
    [fijarIdentidad, evaluarVida, cancelarReto, reportar],
  );

  /**
   * Toma la foto. Tras un parpadeo espera a que los ojos estén bien abiertos (hasta 1 s) y se
   * queda con el cuadro más abierto, para que la foto no salga con ojos cerrados. El cuadro
   * elegido debe seguir en la pose pedida y dentro del óvalo, y (con `titular`) ser del titular.
   */
  const capturar = useCallback(
    async (trasParpadeo: boolean) => {
      const motor = motorRef.current;
      const visor = visorRef.current;
      if (!motor || !visor || !videoRef.current || capturandoRef.current) return;
      capturandoRef.current = true;
      setCapturando(true);
      try {
        const enPose = (c: { foto: HTMLCanvasElement; puntos: Punto[] | null }) => {
          if (!c.puntos) return false;
          const { width: w, height: h } = c.foto;
          const pose = evaluarPose(c.puntos, w, h, confianzaRef.current, objetivoRef.current);
          const encuadre = evaluarEncuadre(
            c.puntos,
            { ancho: w, alto: h },
            { ancho: visor.clientWidth, alto: visor.clientHeight },
          );
          return pose.posicion !== 'obstruido' && pose.mirada === 'ok' && encuadre.ok;
        };

        const primero = await tomarCuadro();
        let cuadro: typeof primero | null = enPose(primero) ? primero : null;
        const normal = parpadeoRef.current.apertura;
        if (trasParpadeo && normal) {
          await espera(ESPERA_TRAS_PARPADEO_MS);
          const limite = Date.now() + MAX_ESPERA_OJOS_MS;
          let mejor = cuadro && { ...cuadro, apertura: -1 };
          for (;;) {
            const c = await tomarCuadro();
            const valido = enPose(c);
            const apertura = valido ? aperturaOjos(c.puntos!, c.foto.width, c.foto.height) : -1;
            if (valido && apertura > (mejor?.apertura ?? -1)) mejor = { ...c, apertura };
            if ((valido && apertura >= normal * 0.85) || Date.now() > limite) break;
            await espera(80);
          }
          cuadro = mejor;
        }
        if (!cuadro) {
          rechazar('Mantén la cara de frente y dentro del óvalo');
          return;
        }
        const { foto: canvas, puntos } = cuadro;
        const descriptor = await motor.vector(recortarRostro(canvas, puntos!));
        const t = titularRef.current;
        if (t) {
          // Pantalla o foto: se rechaza. Con duda, solo pasa si ya hizo dos gestos (DA-30).
          const vida = await motor.vida(canvas, puntos!);
          if (vida < UMBRAL_PANTALLA) {
            fijarPantalla(true);
            reportar('pantalla', canvas, descriptor);
            rechazar('No pudimos confirmar que seas una persona real frente a la cámara');
            return;
          }
          if (vida < UMBRAL_DUDA && gestosHechosRef.current < 2) {
            dudaRef.current = true;
            rechazar('Falta un gesto más para confirmar');
            return;
          }
          const resultado = descriptor ? await t.verificar(descriptor).catch(() => null) : null;
          if (resultado !== 'titular' && resultado !== 'sin_rostro') {
            if (resultado === 'no_titular') fijarIdentidad('no_titular');
            else reiniciarIdentidad();
            rechazar(
              resultado === null
                ? 'No se pudo verificar: revisa tu conexión'
                : 'No pudimos confirmar que seas el titular',
            );
            return;
          }
        }
        const foto = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.88));
        if (!foto) return;
        onCapturaRef.current({
          foto,
          url: URL.createObjectURL(foto),
          descriptor,
          giro: giroRef.current,
          cabeceo: puntos ? cabeceo(puntos, canvas.height) : null,
          sinLentes: sinLentesRef.current && lentesBloqueanRef.current,
        });
        if (descriptor) {
          setFotoLista(true);
          setTimeout(() => setFotoLista(false), PAUSA_TRAS_FOTO_MS);
        }
      } finally {
        parpadeoRef.current.reiniciar();
        listoDesdeRef.current = null;
        bloqueoHastaRef.current = Date.now() + PAUSA_TRAS_FOTO_MS;
        capturandoRef.current = false;
        setCapturando(false);
        reiniciarRespaldo();
      }
    },
    [tomarCuadro, reiniciarRespaldo, rechazar, fijarIdentidad, reiniciarIdentidad, fijarPantalla, reportar],
  );

  useEffect(() => {
    let cancelado = false;
    let raf = 0;
    let stream: MediaStream | null = null;

    async function cuadro() {
      if (cancelado) return;
      const video = videoRef.current;
      const visor = visorRef.current;
      const motor = motorRef.current;
      if (pausadoRef.current || capturandoRef.current || !video || !visor || !motor || video.readyState < 2) {
        raf = requestAnimationFrame(cuadro);
        return;
      }

      const canvas = (analisisRef.current ??= document.createElement('canvas'));
      reducir(video, ANCHO_ANALISIS, canvas);
      const { width: w, height: h } = canvas;

      const puntos = await motor.analizar(canvas);
      if (cancelado) return;
      setAnalizando(true);
      if (Date.now() - luzRef.current.en > LUZ_CADA_MS) {
        const img = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h);
        luzRef.current = { luz: evaluarLuz(img, puntos), en: Date.now() };
        if (puntos) {
          // Puntaje con histéresis para que el aviso de lentes no parpadee.
          lentesRef.current = pareceTenerLentes(img, puntos)
            ? Math.min(lentesRef.current + 1, 10)
            : Math.max(lentesRef.current - 1, 0);
          ojosRef.current =
            contrasteOjos(img, puntos) < CONTRASTE_OJOS_MIN
              ? Math.min(ojosRef.current + 1, 6)
              : Math.max(ojosRef.current - 1, 0);
          if (ojosRef.current >= 4) ojosMalRef.current = true;
          else if (ojosRef.current <= 1) ojosMalRef.current = false;
          if (lentesRef.current >= 6) {
            lentesBloqueanRef.current = true;
            setLentes(true);
          } else if (lentesRef.current <= 2) {
            lentesBloqueanRef.current = false;
            setLentes(false);
          }
        }
      }
      const ahora = Date.now();
      // Cara oscura u ojos borrosos: se pide mejorar, pero pasado un rato se deja continuar.
      const vistaMalaCruda = !!puntos && (luzRef.current.luz === 'cara_oscura' || ojosMalRef.current);
      if (!vistaMalaCruda) vistaDesdeRef.current = null;
      else if (!vistaToleradaRef.current) {
        vistaDesdeRef.current ??= ahora;
        if (ahora - vistaDesdeRef.current >= TOLERAR_VISTA_MS) vistaToleradaRef.current = true;
      }
      const luz: Luz =
        luzRef.current.luz === 'cara_oscura' && vistaToleradaRef.current ? 'ok' : luzRef.current.luz;
      const ojosBorrosos = ojosMalRef.current && !vistaToleradaRef.current;

      let siguiente: Calidad;
      if (!puntos) {
        parpadeoRef.current.reiniciar();
        listoDesdeRef.current = null;
        sinCaraDesdeRef.current ??= ahora;
        if (ahora - sinCaraDesdeRef.current >= SIN_CARA_REINICIA_MS) {
          caraDesdeRef.current = null;
          reiniciarIdentidad();
        }
        siguiente = {
          luz,
          posicion: null,
          mirada: null,
          listo: false,
          armado: false,
          telefono: null,
          instruccion:
            luz === 'oscuro'
              ? 'Hay poca luz: busca un lugar más iluminado'
              : 'Coloca tu cara dentro del óvalo',
        };
      } else {
        sinCaraDesdeRef.current = null;
        caraDesdeRef.current ??= ahora;
        // Al aparecer la cara, primero la malla; los detectores pesados entran medio segundo después.
        const conPrioridad = ahora - caraDesdeRef.current < PRIORIDAD_MALLA_MS;
        // Detector de face-api como señal de obstrucción, máximo cada 1.5 s.
        if (!conPrioridad && ahora - ultimaConfianzaRef.current > 1500) {
          ultimaConfianzaRef.current = ahora;
          motor
            .confianza(canvas)
            .then((c) => (confianzaRef.current = c))
            .catch(() => (confianzaRef.current = 0));
        }
        const pose = evaluarPose(puntos, w, h, confianzaRef.current, objetivoRef.current);
        const encuadre = evaluarEncuadre(
          puntos,
          { ancho: w, alto: h },
          { ancho: visor.clientWidth, alto: visor.clientHeight },
        );
        giroRef.current = pose.giro;
        const posicion: Posicion =
          pose.posicion === 'obstruido' ? 'obstruido' : encuadre.ok ? 'ok' : 'ajustar';
        // Teléfono abajo apuntando a la cara (DA-44): por el sensor, o porque la cara se ve desde abajo.
        const inclinacion = inclinacionRef.current;
        const vertical = cabeceo(puntos, h);
        const telefono: Calidad['telefono'] =
          objetivoRef.current.tipo !== 'frente' || retoRef.current
            ? null
            : (inclinacion !== null && inclinacion < INCLINACION_MIN) || vertical < CABECEO_DESDE_ABAJO
              ? 'bajo'
              : (inclinacion !== null && inclinacion > INCLINACION_MAX) || vertical > CABECEO_DESDE_ARRIBA
                ? 'alto'
                : null;
        const conLentes = lentesBloqueanRef.current && !sinLentesRef.current;
        const enPose =
          luz === 'ok' &&
          posicion === 'ok' &&
          pose.mirada === 'ok' &&
          !telefono &&
          !conLentes &&
          !ojosBorrosos;
        // Verificación del titular en vivo (solo con la cara bien colocada, para un vector confiable).
        if (
          titularRef.current &&
          enPose &&
          !conPrioridad &&
          !verificandoRef.current &&
          ahora - ultimaVerificacionRef.current >= VERIFICAR_CADA_MS
        ) {
          void verificarEnVivo(puntos);
        }
        const esTitular = !titularRef.current || identidadRef.current === 'titular';
        const valido = esTitular && !pantallaRef.current;
        const listo = enPose && valido && ahora >= bloqueoHastaRef.current;
        const r = retoRef.current;
        let armado: boolean;

        if (r) {
          // Gesto en curso (DA-29): la cabeza se mueve, así que no se exige estar de frente.
          armado = true;
          if (r.detector.actualizar(puntos, w, h)) {
            if (++r.hechos < r.total) {
              nuevoGesto(ahora);
            } else {
              gestosHechosRef.current = r.total;
              cancelarReto();
              void capturar(true);
            }
          } else if (ahora - r.inicio > TIEMPO_GESTO_MS) {
            if (++r.fallos >= FALLOS_PARA_AVISO) reportar('reto_fallido', fotoDelVideo(video), null);
            nuevoGesto(ahora);
          } else if (r.detector.regresando !== regresandoVistoRef.current) {
            mostrarReto();
          }
        } else {
          // Estabilidad: listo durante 1 s seguido (un fallo de menos de 0.4 s no la reinicia).
          if (listo) {
            noListoDesdeRef.current = null;
            listoDesdeRef.current ??= ahora;
          } else {
            noListoDesdeRef.current ??= ahora;
            if (ahora - noListoDesdeRef.current >= TOLERANCIA_NO_LISTO_MS) {
              listoDesdeRef.current = null;
              parpadeoRef.current.reiniciar();
            }
          }
          armado = listoDesdeRef.current !== null && ahora - listoDesdeRef.current >= ESTABLE_MS;
          if (armado && titularRef.current) {
            baseRef.current ??= medidasRostro(puntos, w, h);
            nuevoGesto(ahora);
          } else if (armado && parpadeoRef.current.actualizar(aperturaOjos(puntos, w, h))) {
            void capturar(true);
          } else if (!armado && listo) {
            // Mientras se estabiliza se aprenden la apertura normal de los ojos y las medidas de la cara.
            parpadeoRef.current.actualizar(aperturaOjos(puntos, w, h));
            parpadeoRef.current.reiniciar();
            baseRef.current = mezclarMedidas(baseRef.current, medidasRostro(puntos, w, h));
          }
        }
        const retoActual = retoRef.current;

        siguiente = {
          luz,
          posicion,
          mirada: pose.mirada,
          listo,
          armado,
          telefono,
          instruccion: pantallaRef.current
            ? 'Parece una pantalla o foto: pon tu cara real frente a la cámara'
            : retoActual
              ? retoActual.detector.regresando
                ? '¡Bien! Ahora regresa al frente'
                : `${TEXTO_GESTO[retoActual.detector.gesto]}${retoActual.total > 1 ? ` (gesto ${retoActual.hechos + 1} de ${retoActual.total})` : ''}`
              : luz === 'oscuro'
                ? 'Hay poca luz: busca un lugar más iluminado'
                : luz === 'reflejo'
                  ? 'Hay demasiado reflejo: aléjate de la ventana o la luz'
                  : luz === 'cara_oscura'
                    ? 'Tu cara se ve oscura: busca más luz o voltéate hacia la luz'
                    : pose.posicion === 'obstruido'
                      ? (pose.instruccion ?? 'Retira la mano u objeto de tu cara')
                      : telefono
                        ? telefono === 'bajo'
                          ? 'Sube el teléfono a la altura de tus ojos'
                          : 'Baja el teléfono a la altura de tus ojos'
                        : conLentes
                          ? 'Quítate los lentes para continuar'
                          : ojosBorrosos
                            ? 'No se ven bien tus ojos: quítate los lentes o busca más luz'
                            : (encuadre.instruccion ??
                              pose.instruccion ??
                              (!esTitular
                                ? identidadRef.current === 'no_titular'
                                  ? 'El rostro frente a la cámara no es el titular de esta cuenta'
                                  : 'Verificando que seas el titular…'
                                : armado
                                  ? '¡Listo! Parpadea para tomar la foto'
                                  : 'No te muevas…')),
        };
      }
      dibujarMalla(mallaRef.current, puntos, w, h, siguiente.listo);
      setCalidad((prev) =>
        prev.luz === siguiente.luz &&
        prev.posicion === siguiente.posicion &&
        prev.mirada === siguiente.mirada &&
        prev.instruccion === siguiente.instruccion &&
        prev.listo === siguiente.listo &&
        prev.armado === siguiente.armado &&
        prev.telefono === siguiente.telefono
          ? prev
          : siguiente,
      );
      raf = requestAnimationFrame(cuadro);
    }

    (async () => {
      // La cámara se pide al mismo tiempo que se cargan los modelos (no después).
      const camara = navigator.mediaDevices?.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      try {
        setFase({ tipo: 'cargando', progreso: 0 });
        motorRef.current = await cargarMotor((hechos, total) => {
          if (!cancelado) setFase({ tipo: 'cargando', progreso: Math.round((hechos / total) * 100) });
        });
        if (cancelado)
          return void camara?.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => undefined);
        setFase({ tipo: 'iniciando' });
        if (!camara) throw Object.assign(new Error('Sin cámara'), { name: 'NotSupportedError' });
        stream = await camara;
        if (cancelado) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setFase({ tipo: 'activo' });
        reiniciarRespaldo();
        raf = requestAnimationFrame(cuadro);
      } catch (err) {
        // Si falló la carga, la cámara pudo abrirse: se libera.
        camara?.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => undefined);
        if (!cancelado) setFase({ tipo: 'error', mensaje: mensajeCamara(err) });
      }
    })();

    return () => {
      cancelado = true;
      cancelAnimationFrame(raf);
      clearTimeout(respaldoTimerRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [
    capturar,
    intento,
    reiniciarRespaldo,
    reiniciarIdentidad,
    verificarEnVivo,
    nuevoGesto,
    cancelarReto,
    mostrarReto,
    reportar,
  ]);

  // Sensor de inclinación (Android lo da directo; en iPhone se pidió permiso al tocar el botón).
  useEffect(() => {
    // Solo se confía en el sensor si sus lecturas cambian (en la mano siempre tiembla un poco):
    // algunos navegadores mandan un valor fijo sin tener sensor.
    let primera: number | null = null;
    let real = false;
    const leer = (e: DeviceOrientationEvent) => {
      if (e.beta === null) return;
      primera ??= e.beta;
      real ||= Math.abs(e.beta - primera) > 0.5;
      inclinacionRef.current = real ? Math.abs(e.beta) : null;
    };
    window.addEventListener('deviceorientation', leer);
    return () => window.removeEventListener('deviceorientation', leer);
  }, []);

  // Si lleva un rato detectando lentes, ofrece "No traigo lentes" (por si el detector se equivoca).
  useEffect(() => {
    if (!lentes || sinLentes) {
      setOfrecerSinLentes(false);
      return;
    }
    const t = setTimeout(() => setOfrecerSinLentes(true), OFRECER_SIN_LENTES_MS);
    return () => clearTimeout(t);
  }, [lentes, sinLentes]);

  const activo = fase.tipo === 'activo';
  const pidiendoGiro = objetivo.tipo !== 'frente' && !calidad.armado;
  const noTitular = !!titular && identidad === 'no_titular';
  const puedeFoto = !titular || (identidad === 'titular' && !pantalla);

  return (
    <PantallaCamara
      titulo={titulo}
      etiqueta={etiqueta}
      onCerrar={onCerrar}
      fondo={
        <div ref={visorRef} className="absolute inset-0">
          <style>{ANIMACIONES}</style>
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 size-full -scale-x-100 object-cover"
          />
          <canvas ref={mallaRef} className="absolute inset-0 size-full -scale-x-100 object-cover" />
          {activo && ovalo && (
            <div
              className={cn(
                'pointer-events-none absolute rounded-[50%] border-4 border-dashed transition-colors',
                noTitular || pantalla
                  ? 'border-red-500'
                  : calidad.armado
                    ? 'border-emerald-400'
                    : calidad.listo
                      ? 'border-emerald-300/80'
                      : 'border-white/70',
              )}
              style={{
                left: ovalo.cx - ovalo.rx,
                top: ovalo.cy - ovalo.ry,
                width: ovalo.rx * 2,
                height: ovalo.ry * 2,
              }}
            />
          )}

          {activo && titular && !capturando && ovalo && (
            <div
              className={cn(
                'pointer-events-none absolute left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg',
                pantalla || noTitular
                  ? 'bg-red-600'
                  : identidad === 'titular'
                    ? 'bg-emerald-600'
                    : 'bg-slate-950/75',
              )}
              style={{ top: Math.max(8, ovalo.cy - ovalo.ry - 20) }}
              role="status"
            >
              {pantalla ? (
                <>
                  <SmartphoneNfc className="size-5 shrink-0" /> Parece una pantalla o foto
                </>
              ) : identidad === 'titular' ? (
                <>
                  <UserCheck className="size-5 shrink-0" /> Hola, {titular.nombre.split(' ')[0]}
                </>
              ) : noTitular ? (
                <>
                  <ShieldAlert className="size-5 shrink-0" /> No eres el titular de esta cuenta
                </>
              ) : (
                <>
                  <Spinner className="size-4 shrink-0" /> Buscando al titular…
                </>
              )}
            </div>
          )}

          {activo && !capturando && ovalo && calidad.telefono && !reto && (
            <>
              <FlechaGuia direccion={calidad.telefono === 'bajo' ? 'arriba' : 'abajo'} ovalo={ovalo} />
              <div
                className="pointer-events-none absolute left-1/2 flex w-72 max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-2xl bg-amber-500/95 px-4 py-3 text-white shadow-lg"
                style={{ top: ovalo.cy + ovalo.ry - 56 }}
                role="status"
              >
                <TelefonoMoviendo sube={calidad.telefono === 'bajo'} />
                <p className="text-base leading-tight font-semibold">
                  {calidad.telefono === 'bajo' ? 'Sube' : 'Baja'} el teléfono a la altura de tus ojos
                </p>
              </div>
            </>
          )}

          {activo && !capturando && ovalo && reto && !reto.regresando && DIRECCION_GESTO[reto.gesto] && (
            <FlechaGuia direccion={DIRECCION_GESTO[reto.gesto]!} ovalo={ovalo} />
          )}

          {activo && !capturando && ovalo && reto && (
            <div
              className="pointer-events-none absolute left-1/2 w-72 max-w-[92%] -translate-x-1/2 overflow-hidden rounded-2xl bg-slate-950/85 text-white shadow-lg"
              style={{ top: ovalo.cy + ovalo.ry - 40 }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-14 shrink-0 items-center justify-center [&>span]:text-5xl [&>svg]:size-12">
                  <IconoGesto gesto={reto.gesto} regresando={reto.regresando} />
                </span>
                <div className="min-w-0">
                  {reto.total > 1 && (
                    <p className="text-xs text-white/70">
                      Gesto {reto.paso} de {reto.total}
                    </p>
                  )}
                  <p className="text-xl leading-tight font-semibold">
                    {reto.regresando ? '¡Bien! Regresa al frente' : TEXTO_GESTO[reto.gesto]}
                  </p>
                </div>
              </div>
              {!reto.regresando && (
                <div className="h-1.5 bg-white/20">
                  <div
                    key={reto.inicio}
                    className="h-full bg-emerald-400"
                    style={{ animation: `escaner-tiempo ${TIEMPO_GESTO_MS}ms linear forwards` }}
                  />
                </div>
              )}
            </div>
          )}

          {activo && !titular && !pausado && !capturando && ovalo && pidiendoGiro && (
            <FlechaGuia
              direccion={
                objetivo.tipo === 'vertical'
                  ? objetivo.sentido
                  : objetivo.tipo === 'lado' && objetivo.signo === -1
                    ? 'der'
                    : 'izq'
              }
              ovalo={ovalo}
            />
          )}
          {activo &&
            !titular &&
            !pausado &&
            !capturando &&
            ovalo &&
            !calidad.telefono &&
            (calidad.armado || (pidiendoGiro && puedeFoto)) && (
              <div
                className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950/75 px-4 py-2 whitespace-nowrap text-white"
                style={{ top: ovalo.cy + ovalo.ry - 24 }}
              >
                {calidad.armado ? (
                  <>
                    <OjoParpadeando />
                    <span className="font-semibold">¡Listo! Parpadea</span>
                  </>
                ) : (
                  <>
                    {objetivo.tipo === 'vertical' ? (
                      <CabezaVertical desplazamiento={objetivo.sentido === 'arriba' ? '-4px' : '4px'} />
                    ) : (
                      <CabezaGirando signo={objetivo.tipo === 'lado' ? objetivo.signo : undefined} />
                    )}
                    <span className="font-semibold">
                      {objetivo.tipo === 'vertical'
                        ? objetivo.sentido === 'arriba'
                          ? 'Mira un poco arriba'
                          : 'Baja un poco la cabeza'
                        : 'Gira la cabeza hacia la flecha'}
                    </span>
                  </>
                )}
              </div>
            )}

          {rechazo && (
            <Aviso>
              <RefreshCw className="size-12 text-amber-300" />
              <p className="text-lg font-semibold">No se tomó la foto</p>
              <p className="max-w-xs text-sm text-white/80">{rechazo}</p>
            </Aviso>
          )}
          {fotoLista && (
            <Aviso>
              <CircleCheck className="size-14 text-emerald-400" />
              <p className="text-lg font-semibold">¡Foto lista!</p>
            </Aviso>
          )}
          {fase.tipo === 'cargando' && (
            <Aviso>
              <Camera className="size-10 text-platinum-300" />
              <p className="font-medium">Preparando la cámara…</p>
              <div className="h-2 w-48 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{ width: `${fase.progreso}%` }}
                />
              </div>
              <p className="text-xs text-white/70">Solo la primera vez; después abre al momento</p>
            </Aviso>
          )}
          {activo && !analizando && (
            <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
              <span className="flex items-center gap-2 rounded-full bg-slate-950/75 px-4 py-2 text-sm font-medium text-white">
                <Spinner className="size-4" /> Ubicando tu rostro…
              </span>
            </div>
          )}
          {fase.tipo === 'iniciando' && (
            <Aviso>
              <Spinner className="size-8" />
              <p>Abriendo la cámara…</p>
            </Aviso>
          )}
          {fase.tipo === 'error' && (
            <Aviso>
              <CameraOff className="size-10 text-red-300" />
              <p className="font-medium">No se pudo usar la cámara</p>
              <p className="max-w-xs text-sm text-white/80">{fase.mensaje}</p>
              <Button
                size="sm"
                variant="secondary"
                icon={<RefreshCw className="size-4" />}
                onClick={() => setIntento((n) => n + 1)}
              >
                Reintentar
              </Button>
            </Aviso>
          )}
          {capturando && (
            <Aviso>
              <Spinner className="size-10" />
              <p className="text-lg font-semibold">Tomando foto…</p>
              <p className="text-sm text-white/75">No te muevas</p>
            </Aviso>
          )}
        </div>
      }
      panel={
        <>
          {indicacion && (
            <p className="text-center text-base leading-tight font-semibold text-slate-900">{indicacion}</p>
          )}
          {activo && !pausado && (
            <>
              <div className="flex flex-wrap justify-center gap-1.5 text-xs font-medium">
                <Indicador icono={<Lightbulb className="size-3.5" />} texto="Luz" ok={calidad.luz === 'ok'} />
                <Indicador icono={<Eye className="size-3.5" />} texto="Mirada" ok={calidad.mirada === 'ok'} />
                <Indicador
                  icono={<Move className="size-3.5" />}
                  texto="Posición"
                  ok={calidad.posicion === 'ok'}
                />
                {titular && (
                  <Indicador
                    icono={<UserCheck className="size-3.5" />}
                    texto="Titular"
                    ok={identidad === 'titular'}
                  />
                )}
                {lentes && !sinLentes && (
                  <Indicador icono={<Glasses className="size-3.5" />} texto="Lentes" ok={false} />
                )}
              </div>
              {pantalla ? (
                <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-800">
                  <SmartphoneNfc className="size-4 shrink-0" />
                  <span>
                    Parece una pantalla o foto: pon tu cara real.
                    {reportados.includes('pantalla') && ' Se avisó a tu supervisor.'}
                  </span>
                </p>
              ) : noTitular ? (
                <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-800">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span>
                    No eres el titular de esta cuenta.
                    {reportados.includes('no_titular') && ' Se avisó a tu supervisor.'}
                  </span>
                </p>
              ) : (
                <p
                  role="status"
                  className={cn(
                    'flex min-h-6 items-center justify-center gap-1.5 text-center text-sm font-medium',
                    calidad.armado ? 'text-emerald-600' : 'text-slate-700',
                  )}
                >
                  {calidad.armado && <CircleCheck className="size-5" />}
                  {calidad.instruccion}
                </p>
              )}
              {ofrecerSinLentes && (
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  icon={<Glasses className="size-4" />}
                  onClick={() => {
                    sinLentesRef.current = true;
                    setSinLentes(true);
                  }}
                >
                  No traigo lentes
                </Button>
              )}
            </>
          )}
          {activo && respaldo && !pausado && !titular && (
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              icon={<Camera className="size-4" />}
              disabled={capturando || !!calidad.telefono || (lentes && !sinLentes)}
              onClick={() => void capturar(false)}
            >
              Tomar foto
            </Button>
          )}
          {children}
        </>
      }
    />
  );
}

/** Animaciones de las indicaciones (parpadeo y giro de cabeza). */
const ANIMACIONES = `
@keyframes escaner-parpado { 0%, 60%, 100% { transform: scaleY(1); } 70%, 80% { transform: scaleY(0.08); } }
@keyframes escaner-giro { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(var(--giro, 6px)); } }
@keyframes escaner-vertical { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(var(--giro, 4px)); } }
@keyframes escaner-tiempo { from { width: 100%; } to { width: 0%; } }
@keyframes escaner-latido { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
@keyframes escaner-empuje { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(var(--dx), var(--dy)); } }
`;

/** Hacia dónde se mueve la cabeza en cada gesto (en el espejo de la cámara); null si no se mueve. */
const DIRECCION_GESTO: Record<Gesto, DireccionGuia | null> = {
  parpadear: null,
  sonreir: null,
  abrir_boca: null,
  girar_izq: 'izq',
  girar_der: 'der',
  mirar_arriba: 'arriba',
  asentir: 'abajo',
};

type DireccionGuia = 'izq' | 'der' | 'arriba' | 'abajo';

/**
 * Flecha grande y animada dentro del óvalo hacia donde debe mover la cabeza (DA-44). La vista es
 * de espejo: "a tu izquierda" es hacia la izquierda de la pantalla.
 */
function FlechaGuia({ direccion, ovalo }: { direccion: DireccionGuia; ovalo: Ovalo }) {
  const Icono = { izq: ArrowLeft, der: ArrowRight, arriba: ArrowUp, abajo: ArrowDown }[direccion];
  const tam = 64;
  const pos =
    direccion === 'izq'
      ? { left: ovalo.cx - ovalo.rx - tam / 3, top: ovalo.cy - tam / 2 }
      : direccion === 'der'
        ? { left: ovalo.cx + ovalo.rx - (tam * 2) / 3, top: ovalo.cy - tam / 2 }
        : direccion === 'arriba'
          ? { left: ovalo.cx - tam / 2, top: ovalo.cy - ovalo.ry - tam / 3 }
          : { left: ovalo.cx - tam / 2, top: ovalo.cy + ovalo.ry - (tam * 2) / 3 };
  const [dx, dy] = { izq: [-10, 0], der: [10, 0], arriba: [0, -10], abajo: [0, 10] }[direccion];
  return (
    <span
      className="pointer-events-none absolute flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-white/80"
      style={
        {
          ...pos,
          width: tam,
          height: tam,
          '--dx': `${dx}px`,
          '--dy': `${dy}px`,
          animation: 'escaner-empuje 0.9s ease-in-out infinite',
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <Icono className="size-10" strokeWidth={3} />
    </span>
  );
}

/** Teléfono que sube o baja (para "Sube/Baja el teléfono a la altura de tus ojos"). */
function TelefonoMoviendo({ sube }: { sube: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-10 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      style={
        {
          '--dx': '0px',
          '--dy': sube ? '-5px' : '5px',
          animation: 'escaner-empuje 1.1s ease-in-out infinite',
        } as React.CSSProperties
      }
    >
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

/** Animación del gesto pedido. */
function IconoGesto({ gesto, regresando }: { gesto: Gesto; regresando: boolean }) {
  if (regresando) return <CircleCheck className="size-8 shrink-0 text-emerald-400" />;
  switch (gesto) {
    case 'parpadear':
      return <OjoParpadeando />;
    case 'girar_izq':
      return <CabezaGirando signo={1} />;
    case 'girar_der':
      return <CabezaGirando signo={-1} />;
    case 'mirar_arriba':
      return <CabezaVertical desplazamiento="-4px" />;
    case 'asentir':
      return <CabezaVertical desplazamiento="4px" />;
    default:
      return (
        <span
          className="shrink-0 text-3xl"
          style={{ animation: 'escaner-latido 1.2s ease-in-out infinite' }}
          aria-hidden="true"
        >
          {gesto === 'sonreir' ? '😁' : '😮'}
        </span>
      );
  }
}

/** Cara que sube o baja (mirar arriba / bajar la cabeza). */
function CabezaVertical({ desplazamiento }: { desplazamiento: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-8 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <g
        style={
          {
            '--giro': desplazamiento,
            animation: 'escaner-vertical 1.4s ease-in-out infinite',
          } as React.CSSProperties
        }
      >
        <circle cx="9.5" cy="10" r="1" fill="currentColor" />
        <circle cx="14.5" cy="10" r="1" fill="currentColor" />
        <path d="M12 11.5v2.5" />
        <path d="M9.5 16.5h5" />
      </g>
    </svg>
  );
}

function OjoParpadeando() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <g style={{ transformOrigin: '12px 12px', animation: 'escaner-parpado 1.6s ease-in-out infinite' }}>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </g>
    </svg>
  );
}

/** Cara que se desplaza hacia el lado pedido (en espejo, como el guardia se ve en pantalla). */
function CabezaGirando({ signo }: { signo?: 1 | -1 }) {
  const desplazamiento = signo === 1 ? '-6px' : '6px';
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <g
        style={
          {
            '--giro': desplazamiento,
            animation: 'escaner-giro 1.4s ease-in-out infinite',
          } as React.CSSProperties
        }
      >
        <circle cx="9.5" cy="10" r="1" fill="currentColor" />
        <circle cx="14.5" cy="10" r="1" fill="currentColor" />
        <path d="M12 11.5v2.5" />
        <path d="M9.5 16.5h5" />
      </g>
    </svg>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 p-6 text-center text-white">
      {children}
    </div>
  );
}

function Indicador({ icono, texto, ok }: { icono: ReactNode; texto: string; ok: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset',
        ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200',
      )}
    >
      {icono} {texto} {ok ? '✓' : '✕'}
    </span>
  );
}

/** Puntos de la malla sobre el video: verdes si todo está listo, ámbar si hay que ajustar. */
function dibujarMalla(
  canvas: HTMLCanvasElement | null,
  puntos: Punto[] | null,
  w: number,
  h: number,
  listo: boolean,
) {
  if (!canvas) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  if (!puntos) return;
  ctx.fillStyle = listo ? 'rgba(16,185,129,0.8)' : 'rgba(245,158,11,0.8)';
  for (let i = 0; i < puntos.length; i += 2) {
    ctx.beginPath();
    ctx.arc(puntos[i].x * w, puntos[i].y * h, 1.2, 0, 2 * Math.PI);
    ctx.fill();
  }
}

/** Cuadro actual del video en la calidad de la foto (ANCHO_FOTO). */
function fotoDelVideo(video: HTMLVideoElement) {
  const escala = Math.min(1, ANCHO_FOTO / (video.videoWidth || ANCHO_FOTO));
  const foto = document.createElement('canvas');
  foto.width = Math.round((video.videoWidth || ANCHO_FOTO) * escala);
  foto.height = Math.round((video.videoHeight || ANCHO_FOTO * 0.75) * escala);
  foto.getContext('2d')!.drawImage(video, 0, 0, foto.width, foto.height);
  return foto;
}

/** Copia reducida de una imagen o del video (ancho máximo), reutilizando el canvas destino si se pasa. */
function reducir(origen: HTMLVideoElement | HTMLCanvasElement, ancho: number, destino?: HTMLCanvasElement) {
  const ow = origen instanceof HTMLVideoElement ? origen.videoWidth : origen.width;
  const oh = origen instanceof HTMLVideoElement ? origen.videoHeight : origen.height;
  const escala = Math.min(1, ancho / (ow || ancho));
  const c = destino ?? document.createElement('canvas');
  const w = Math.round((ow || ancho) * escala);
  const h = Math.round((oh || ancho * 0.75) * escala);
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  c.getContext('2d', { willReadFrequently: true })!.drawImage(origen, 0, 0, w, h);
  return c;
}
