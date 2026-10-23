import { env } from './config/env';
import { createApp } from './app';
import { iniciarVigilanciaTurnos } from './modules/asistencia';

createApp().listen(env.PORT, () => {
  console.log(`[api] escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  // Turnos sin entrada: avisos y faltas (DA-45).
  iniciarVigilanciaTurnos();
});
