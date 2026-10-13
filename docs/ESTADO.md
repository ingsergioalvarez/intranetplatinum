# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-13
**Fase actual:** Fase 3 — Reportes terminada salvo envío de correos (F3-07/F3-08, esperan SMTP) → siguiente: **Fase 4 — PWA**
**Última tarea terminada:** F3-10 — avisos en la app (antes F3-09 reglas de aviso por cliente y prioridad)
**Tarea en progreso:** ninguna

## Siguiente paso

1. **F4-01 PWA instalable** (manifest, íconos, service worker): ícono en la pantalla del celular, pantalla completa, actualizaciones automáticas. El usuario preguntó si es un APK: se explicó que la PWA se instala desde el navegador y funciona en Android e iPhone; si se requiere Play Store, se empaqueta después.
2. **F4-02 Cola offline de reportes** según D-001 (pendiente: ¿hay señal en los inmuebles?).
3. Cuando el usuario configure el correo: **F1-05/F1-06** (recuperar contraseña) y **F3-07/F3-08** (enviar los correos en cola de `notificaciones`, marcar reporte "notificado", bitácora y reenvío).

Avisos (D-016): cada cliente tiene destino por defecto (solo supervisor / solo cliente / ambos) y excepciones por prioridad (`PUT /api/clientes/:id/avisos`, tarjeta "Avisos de reportes" en la ficha). Supervisores (permiso `reportes.estatus`) reciben avisos en la campanita; el guardia recibe aviso cuando su reporte cambia de estatus o le comentan; los correos al cliente quedan en cola.

## Bloqueos / pendientes del usuario

- **F0-09** terminada (2026-10-12): MySQL 8.0.46 local de pruebas en esta PC, BD `platinum_intranet` con migración `init_seguridad` y seed (15 permisos, 4 roles, admin). Cada PC necesita su propio `apps/api/.env` (no está en git).
- Pendiente de commit: Fases 2 y 3 sin commit; lo anterior está en `acf5d09` (sin push). El usuario avisa cuándo hacer commit/push.
- BD local con datos de prueba creados por las pruebas automáticas (usuarios `guardia.*`, `g.*@platinum.local`, clientes "Plaza …", "Corporativo …", "Hotel …", "Rep Plaza …" y sus reportes; fotos en `apps/api/uploads/`, ignorada por git).
- **SMTP**: el usuario avisará cuando esté configurado (F1-05/F1-06, F3-07/F3-08).
- D-001 (señal en inmuebles) y D-002 (portal de clientes) siguen sin respuesta.

## Cómo levantar

- `npm install` en la raíz (genera el cliente Prisma automáticamente).
- Copiar `apps/api/.env.example` → `apps/api/.env` (y `apps/web/.env.example` → `apps/web/.env`).
- Con MySQL disponible: `npm run db:deploy -w @platinum/api` y `npm run db:seed -w @platinum/api` (crea tablas y admin).
- `npm run dev` → API en http://localhost:4000, web en http://localhost:5173. Entrar con `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`; catálogo de componentes en `/ui`.
- Calidad: `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`.

## Notas de contexto

- Uso principal será en celular por guardias intramuros.
- TypeScript 5.9 (D-009), Prisma 7.10 + override `mariadb` 3.5.4 (D-010), migraciones sin BD (D-011).
- `npm audit`: 4 alertas solo en el CLI de Prisma (desarrollo), aceptadas en D-010.
- Git: repositorio remoto https://github.com/ingsergioalvarez/intranetplatinum (rama `main`). Commits: `1c0ff3b` (F0-00..02), `f61001d` (F0-03), `ee39650` (F0-04), `c0644dd` (F0-05..08).
