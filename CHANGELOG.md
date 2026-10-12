# Changelog — Intranet Platinum Agency

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Cada entrada referencia las tareas (`Fx-yy`), alcances (`A-xx`) y decisiones (`D-xxx`) del [PLAN](docs/PLAN.md).

## [Sin publicar]

### Sesión 2026-10-12 #7

#### Añadido

- **F0-09** MySQL 8 local de pruebas: BD `platinum_intranet`, migraciones y seed aplicados.
- **F1-01** Tablas `refresh_tokens`, `password_resets`, `auditoria` (migración `20261012230000_sesiones_auditoria`).
- **F1-02** API `/api/auth`: login, refresh rotativo (cookie httpOnly `platinum_rt`, token guardado como SHA-256, detección de reuso), logout; bloqueo tras 5 intentos (`LOGIN_MAX_INTENTOS`/`LOGIN_BLOQUEO_MIN`), límite por IP (`express-rate-limit`).
- Núcleo API: `AuditLogger`/`PrismaAuditLogger`, `requestContext`, `rateLimit`, `generateOpaqueToken`/`hashToken`, `hashPassword`/`verifyPassword`/`generateTemporaryPassword`, `authenticateAllowingTemporaryPassword`.
- **F1-03** Pantalla `/login` mobile-first (validación compartida, mostrar contraseña, mensajes por código de error) con `AuthLayout`.
- **F1-04** `AuthService` en la web: restaura la sesión al abrir, refresh automático ante 401, logout en servidor; `ProtectedRoute` acepta `roles`.
- **F1-07** API `/api/usuarios`: lista con búsqueda/rol/estado y paginación, alta, edición, protegida por permisos y auditada.
- **F1-08** Pantalla `/usuarios` (tabla/tarjetas, filtros) con modal de alta/edición y modal de contraseña temporal (copiar / mensaje para WhatsApp).
- **F1-09** Baja lógica y reactivación; la baja revoca las sesiones.
- **F1-10** Restablecer contraseña desde el modal: contraseña temporal, desbloqueo y cierre de sesiones (D-012).
- **F1-11** `/cambiar-password`: cambio propio y obligatorio con contraseña temporal; la API responde 403 `PASSWORD_CHANGE_REQUIRED` hasta cambiarla (columna `debe_cambiar_password`).
- Web: `PasswordInput`, `ConfirmDialog`, `erroresDeCampos`, `formatFechaHora`; tipos compartidos `SessionUser`, `AuthSession`, `Usuario`, esquemas de login, contraseña y usuarios.

#### Cambiado

- Se quitaron las sesiones demo por rol del login.
- `ApiError.fieldErrors` también lee errores por campo de respuestas 409.
- Migraciones con `--from-config-datasource` (Prisma 7 pide BD shadow para `--from-migrations`), D-011 actualizada.

#### Corregido

- La prueba de `getPrisma` sin `DATABASE_URL` ya no depende del `.env` de la máquina.

#### Verificado

- `npm test` 54/54, `lint`, `typecheck`, `format:check` y `build` sin errores.
- Pruebas en Edge headless (360px y 1440px) contra MySQL: login/refresh/logout (11 verificaciones) y gestión de usuarios con cambio obligatorio, reset, baja y reactivación (22 verificaciones).

#### Decisiones

- D-012 contraseña temporal sin SMTP; D-013 el access token vigente (máx. 15 min) no se revalida contra BD.

#### Tareas

- F0-09, F1-01, F1-02, F1-03, F1-04, F1-07, F1-08, F1-09, F1-10, F1-11 terminadas. Pendientes de Fase 1: F1-05/F1-06 (requieren SMTP).

### Sesión 2026-10-12 #6

#### Añadido

- **F0-05 Frontend core:** `ApiClient` (token Bearer, cookies, desenvuelve `{ ok, data }`, refresh único compartido ante 401), `ApiError` (`fieldErrors`), `CrudService` genérico con claves de TanStack Query, `queryClient`, `useAuthStore` (Zustand) con `hasPermission`, `ProtectedRoute` por permiso, router (React Router 7).
- **F0-06 Librería UI** (`components/ui`): Button, Input, Select, Textarea, FormField, Card, Badge, Spinner, EmptyState, Modal (bottom-sheet en celular), DataTable (tabla/tarjetas), Pagination, Toast, PhotoUploader (cámara trasera + galería). Catálogo en `/ui`.
- **F0-07 Layout responsive:** AppShell con Sidebar (escritorio), Topbar y BottomNav (celular), menú filtrado por permisos, páginas "en construcción" que indican las tareas del plan.
- Tailwind CSS 4 con tema Platinum (`brand-*`, `platinum-*`), utilidades `pb-safe`/`pt-safe`, favicon.
- Pantalla de login provisional con sesiones demo por rol (solo desarrollo; se reemplaza en F1-03).
- **F0-08** `README.md` de arranque.

#### Corregido

- Al cerrar sesión, el siguiente usuario ya no aterriza en la última página del anterior (`logout()` vs `clear()`).
- Pie del modal sin margen inferior en escritorio; recuadros de fotos demasiado grandes en pantallas anchas.

#### Verificado

- Capturas reales en Edge headless a 360px y 1440px: login, inicio (API en línea vía proxy), catálogo UI, modal; sin scroll horizontal; guardia solo ve Inicio/Reportes; sin errores de consola.
- `npm test` 14/14, `typecheck`, `lint` y `build` sin errores.

#### Tareas

- F0-05, F0-06, F0-07, F0-08 terminadas. **Fase 0 completa** salvo F0-09 (bloqueada por acceso a MySQL).

### Sesión 2026-10-12 #5

#### Añadido

- Prisma 7.10 con adaptador `@prisma/adapter-mariadb` para MySQL (F0-04, D-004, D-010).
- `apps/api/prisma.config.ts` y `prisma/schema.prisma` con modelos `Rol`, `Permiso`, `RolPermiso`, `Usuario` (tablas `roles`, `permisos`, `rol_permiso`, `usuarios`; baja lógica, bloqueo por intentos).
- Migración inicial `20261012000000_init_seguridad` generada sin BD (D-011).
- `prisma/seed.ts` idempotente: permisos, roles, matriz rol-permiso y administrador inicial (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, bcrypt 12).
- `core/data/prisma.ts`: cliente compartido perezoso (`getPrisma`), error claro si falta `DATABASE_URL`.
- `@platinum/shared`: catálogo `PERMISOS`, descripciones y `PERMISOS_POR_ROL` (matriz del PLAN §5).
- Scripts `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:status`, `db:studio`; `postinstall` genera el cliente.
- Pruebas de capa de datos y catálogo de permisos (`test/prisma.test.ts`).
- Tarea nueva **F0-09** (bloqueada): aplicar migración y seed en el servidor MySQL.

#### Seguridad

- Override de `mariadb` a 3.5.4 (vulnerabilidades altas en 3.4.5); `lodash` actualizado con `npm audit fix`.

#### Decisiones

- D-004 aceptada (Prisma), D-010 (versiones Prisma/mariadb), D-011 (migraciones sin BD).

#### Verificado

- `prisma validate` OK; `npm test` 14/14; `typecheck` y `lint` sin errores.

#### Tareas

- F0-04 terminada; F0-09 creada como bloqueada (D-008).

### Sesión 2026-10-12 #4

#### Añadido

- Núcleo del backend `apps/api/src/core/` (F0-03, A-02, A-03):
  - `HttpError` con fábricas por código HTTP.
  - `BaseController`, `BaseService`, `CrudService` genérico y `BaseRepository` abstracto (independiente del ORM, con baja lógica).
  - Middlewares: `errorHandler` + `notFoundHandler` (formato de error estándar; maneja zod, multer y JSON inválido), `validate` (zod → `req.validated`), `authenticate` (JWT Bearer), `requireRoles`, `requirePermission`, `uploadImages` (jpeg/png/webp/heic, límite por `MAX_UPLOAD_MB`).
  - `security/jwt.ts`: `signAccessToken` / `verifyAccessToken`.
  - Contrato `AppModule` y registro de módulos en `src/modules/index.ts`.
- `config/env.ts`: variables de entorno validadas con zod; carga `.env` nativa de Node; exige secretos JWT reales en producción.
- `app.ts` con helmet, CORS (con credenciales hacia `APP_URL`), cookie-parser, límite JSON 1 MB.
- Módulo `health` reescrito con las clases base: `GET /api/health` y `GET /api/health/me` (protegida).
- `@platinum/shared`: `paginationQuerySchema`, `idParamSchema`, tipo `ApiError`; `HealthStatus` con versión y uptime.
- Pruebas Vitest + supertest (`apps/api/test/core.test.ts`, 9 casos): health, 404, 401/403, validación, CRUD genérico con baja lógica, upload, JSON inválido. Script `npm test`.

#### Verificado

- `npm test` 9/9, `typecheck` y `lint` sin errores; servidor real responde health y 401 en `/me`; cabeceras helmet presentes.

#### Tareas

- F0-03 terminada.

### Sesión 2026-10-12 #3

#### Añadido

- ESLint 10 (flat config) con `typescript-eslint`, reglas de React Hooks / React Refresh y `eslint-config-prettier` (F0-02).
- Prettier 3 (`.prettierrc.json`, `.prettierignore`), `.editorconfig` y `.gitattributes` (LF).
- `apps/api/.env.example` (servidor, `DATABASE_URL`, JWT, SMTP, almacenamiento) y `apps/web/.env.example`.
- Scripts raíz `lint`, `lint:fix`, `format`, `format:check`; `package.json` raíz como `type: module`.
- Repositorio git inicializado en rama `main` (sin commits todavía).

#### Cambiado

- TypeScript fijado a `~5.9` (antes 7.0) por compatibilidad con `typescript-eslint` (D-009).
- Documentos `.md` reformateados con Prettier.

#### Decisiones

- D-008: MySQL correrá en otra máquina; la conexión se configura después vía `DATABASE_URL`.
- D-009: TypeScript `~5.9`.

#### Verificado

- `npm run lint`, `npm run format:check` y `npm run typecheck` sin errores.

#### Tareas

- F0-02 terminada.

### Sesión 2026-10-12 #2

#### Añadido

- Monorepo con npm workspaces: `apps/api`, `apps/web`, `packages/shared` (F0-01, A-01, A-03).
- `tsconfig.base.json` compartido, `.gitignore` y scripts raíz `dev`, `build`, `typecheck`.
- `@platinum/shared`: constantes de roles, estatus/prioridad de reportes y tipos `ApiResponse`, `Paginated`, `HealthStatus`.
- `@platinum/api`: Express 5 + tsx, endpoint `GET /api/health` (puerto 4000).
- `@platinum/web`: React 18.3 + Vite 8, proxy `/api` → 4000, pantalla mínima que consulta health.

#### Versiones

- Node 24.13, npm 11.6, TypeScript 7.0, Express 5.3, Vite 8.3, React 18.3, concurrently 10.

#### Verificado

- `npm install`, `npm run typecheck` y build de web OK; `/api/health` responde `ok`.

#### Notas

- No se encontró cliente `mysql` en PATH: confirmar instalación de MySQL 8 (o Docker) antes de F0-04.

#### Tareas

- F0-01 terminada.

### Sesión 2026-10-12 #1

#### Añadido

- Plan general de la intranet: stack, arquitectura modular OOP, modelo de datos, permisos y fases (D-005).
- `docs/PLAN.md` con matriz de alcances A-01..A-16 y tareas trazables F0..F5.
- `docs/DECISIONES.md` con decisiones aceptadas (D-005..D-007) y pendientes (D-001..D-004).
- `docs/ESTADO.md` para retomar la sesión.
- `CLAUDE.md` y carpeta `.claude/` (settings, comandos `/retomar` y `/cerrar-sesion`).

#### Tareas

- F0-00 terminada.
