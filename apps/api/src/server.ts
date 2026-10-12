import { env } from './config/env';
import { createApp } from './app';

createApp().listen(env.PORT, () => {
  console.log(`[api] escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
