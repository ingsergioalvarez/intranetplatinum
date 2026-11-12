import { env } from './config/env';
import { createApp } from './app';
import { iniciarVigilanciaTurnos } from './modules/asistencia';
import { iniciarTips } from './modules/push/enviar';

createApp().listen(env.PORT, () => {
  console.log(`[api] escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  // Turnos sin entrada: avisos y faltas (DA-45).
  iniciarVigilanciaTurnos();
  // Tips por notificación, dos a la semana (A-78).
  iniciarTips();
});
