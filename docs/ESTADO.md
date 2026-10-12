# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-12
**Fase actual:** Fase 1 — Autenticación y usuarios
**Última tarea terminada:** F1-11 — cambio de contraseña propio/obligatorio (antes F1-07..F1-10 gestión de usuarios; F1-01..F1-04 login)
**Tarea en progreso:** ninguna

## Siguiente paso

1. **F1-05 / F1-06**: recuperación de contraseña por correo — único pendiente de la Fase 1; **necesita datos SMTP**. Tabla `password_resets` lista; reutilizar `generateOpaqueToken`/`hashToken`; agregar enlace "¿Olvidaste tu contraseña?" en `LoginPage`.
2. Si aún no hay SMTP: arrancar **Fase 2 — Clientes** (F2-01 tablas clientes/contactos/sitios).

Hecho en Fase 1:

- Login (F1-02..F1-04): cookie httpOnly `platinum_rt` (path `/api/auth`) con refresh rotativo; bloqueo tras 5 intentos (15 min); 30 logins/15 min por IP; la web restaura la sesión al abrir.
- Usuarios (F1-07..F1-10): `/api/usuarios` (lista con `q`/`rol`/`estado`, alta, edición, `/baja`, `/reactivar`, `/reset-password`), protegido por permisos y auditado. Reglas: no cambiar el propio rol, no darse de baja, no dejar el sistema sin admin activo. Pantalla `/usuarios` con modal (bottom-sheet en celular).
- Contraseñas temporales (D-012, F1-11): alta y reset generan una contraseña temporal mostrada una vez; el usuario debe cambiarla en `/cambiar-password` (la API responde 403 hasta hacerlo).

## Bloqueos / pendientes del usuario

- **F0-09** terminada (2026-10-12): MySQL 8.0.46 local de pruebas en esta PC, BD `platinum_intranet` con migración `init_seguridad` y seed (15 permisos, 4 roles, admin). Cada PC necesita su propio `apps/api/.env` (no está en git).
- Pendiente de commit: F1-01..F1-11 están sin commit (el usuario avisa cuándo hacerlo).
- BD local con 2 usuarios guardia de prueba (`guardia.*@platinum.local`) creados por las pruebas de navegador.
- **F1-05** (recuperar contraseña) necesita datos SMTP para enviar correos reales.
- D-001, D-002, D-003 sin respuesta (ver [DECISIONES.md](DECISIONES.md)); no bloquean la Fase 1.

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
