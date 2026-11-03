/**
 * Sirena de la alerta de emergencia (A-60), hecha con Web Audio (sin archivos). Solo la escuchan quienes reciben
 * la alerta. Los navegadores no dejan sonar nada hasta que la persona toca la pantalla una vez: por eso el primer
 * toque en cualquier parte de la app "desbloquea" el audio, y si aun así está bloqueado la alerta lo avisa.
 */
let ctx: AudioContext | null = null;
let sirena: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
let temporizador: ReturnType<typeof setTimeout> | undefined;

function contexto() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

if (typeof document !== 'undefined') {
  const desbloquear = () => void contexto()?.resume().catch(() => undefined);
  document.addEventListener('pointerdown', desbloquear, { once: true });
  document.addEventListener('keydown', desbloquear, { once: true });
}

/** Empieza a sonar (si ya sonaba, no hace nada). Devuelve false si el navegador lo tiene bloqueado. */
export function iniciarSirena(): boolean {
  const c = contexto();
  if (!c) return false;
  void c.resume().catch(() => undefined);
  if (c.state !== 'running') return false;
  if (sirena) return true;
  const osc = c.createOscillator();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.value = 900;
  // El tono sube y baja ~1.5 veces por segundo entre 600 y 1200 Hz.
  lfo.frequency.value = 1.5;
  lfoGain.gain.value = 300;
  gain.gain.value = 0.35;
  lfo.connect(lfoGain).connect(osc.frequency);
  osc.connect(gain).connect(c.destination);
  osc.start();
  lfo.start();
  sirena = { osc, lfo, gain };
  return true;
}

export function detenerSirena() {
  clearTimeout(temporizador);
  if (!sirena) return;
  sirena.osc.stop();
  sirena.lfo.stop();
  sirena.osc.disconnect();
  sirena.lfo.disconnect();
  sirena.gain.disconnect();
  sirena = null;
}

/** Suena 2 segundos para que admin y supervisor comprueben el volumen. Devuelve false si está bloqueado. */
export function probarSirena(): boolean {
  if (!iniciarSirena()) return false;
  temporizador = setTimeout(detenerSirena, 2000);
  return true;
}
