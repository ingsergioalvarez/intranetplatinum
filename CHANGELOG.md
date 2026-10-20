# Changelog — Intranet Platinum Agency

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Cada entrada referencia las tareas (`Fx-yy`), alcances (`A-xx`) y decisiones (`D-xxx`) del [PLAN](docs/PLAN.md).

## [Sin publicar]

### Sesión 2026-10-20 #12

#### Añadido

- Página de inicio de la API (`GET /` y `GET /api`): confirma que está en línea y lista los módulos (antes respondía "Ruta no encontrada" y parecía caída).
- Opción `allowPublicKeyRetrieval=true` en `DATABASE_URL` (MySQL 8 local sin SSL); documentada en `.env.example`.

#### Corregido

- Login fallaba con "No se pudo iniciar sesión" tras reiniciar la PC: MySQL 8 (`caching_sha2_password`) exige la llave pública en la primera conexión sin SSL y el pool no podía conectarse.

#### Verificado

- `npm test` 94/94; login de admin a través de la web contra MySQL.

### Sesión 2026-10-20 #12

#### Añadido

- **F0-10** Constructor de BD local `npm run db:setup` (`apps/api/prisma/setup.ts`): crea `apps/api/.env` (secretos JWT aleatorios, `--url` como `DATABASE_URL`, contraseña de admin generada si falta) y `apps/web/.env`, crea la base utf8mb4 si no existe, aplica migraciones y seed. `--reset` borra y recrea la base (solo MySQL local). Mensajes de ayuda para MySQL apagado, credenciales y `allowPublicKeyRetrieval`. Probado en PC "nueva" (sin `.env`), con `--reset` y en re-ejecución.

#### Cambiado

- README: "Arranque rápido" usa `npm run db:setup` para que otro desarrollador monte el proyecto en su PC.

### Sesión 2026-10-14 #11

#### Añadido

- **F2-06** Grupos de guardias: tablas `grupos_guardias` y `grupo_integrantes`, API `/api/grupos` (lista, alta con integrantes, edición, integrantes, baja que termina sus asignaciones, reactivación) y pantalla `/grupos` (menú "Grupos"). Permiso nuevo `grupos.administrar` (supervisor y admin).
- **F2-07** Asignaciones a grupo o a guardia, tipo fija / temporal / eventual (con horario): columnas `grupo_id`, `tipo`, `hora_inicio`, `hora_fin`, `vigente_hasta` en `sitio_guardia` (migración escrita a mano; datos existentes convertidos). Nuevo formulario de asignación en la ficha del cliente; "Mis sitios" muestra tipo, horario y grupo.
- `LOGIN_RATE_LIMIT` configurable (30 por defecto; más alto solo en desarrollo).

#### Cambiado

- La visibilidad del guardia (Mis sitios, sitios para reportar y reportes) incluye las asignaciones de sus grupos (`asignadaA`).
- La tarjeta del sitio cuenta "asignaciones" vigentes en lugar de guardias.

#### Verificado

- `npm test` 94/94, `lint`, `typecheck`, `format:check`, `build`.
- API contra MySQL: grupos y asignaciones (26), reportes (37).
- Edge headless: grupos (14), avisos (11), reportes (17), clientes (17), usuarios (22), login (11).

#### Decisiones

- D-017 grupos y tipos de asignación.

#### Tareas

- F2-06, F2-07 terminadas.

### Sesión 2026-10-13 #10

#### Añadido

- **F3-09** Reglas de aviso por cliente y prioridad (solo supervisor / solo cliente / ambos): columna `clientes.aviso_por_defecto`, tabla `cliente_reglas_aviso`, `PUT /api/clientes/:id/avisos`, tarjeta "Avisos de reportes" en la ficha con advertencia si ningún contacto puede recibir correo.
- **F3-10** Avisos en la app: tabla `avisos`, `/api/avisos` (bandeja, marcar leído, marcar todo) y campanita con contador en escritorio y celular. Al crear un reporte se avisa según la regla; el guardia recibe avisos de cambios de estatus y comentarios; los correos al cliente se encolan en `notificaciones` (pendiente).
- `NotificadorReportes` inyectable en `ReportesService`; `resolverDestino` compartido.

#### Decisiones

- D-003 resuelta (sin aprobación manual) y D-016 (a quién se avisa). P-06 descartada.

#### Verificado

- `npm test` 91/91, `lint`, `typecheck`, `format:check`, `build`.
- Edge headless contra MySQL: avisos (11), reportes (17), clientes (17), usuarios (22), login (11). En BD solo el reporte crítico encoló correo al cliente.

#### Tareas

- F3-09, F3-10 terminadas.

### Sesión 2026-10-13 #9

#### Añadido

- **F3-01** Categorías de reporte jerárquicas (2 niveles) con catálogo inicial en el seed (7 principales, 19 subcategorías), API `/api/categorias` y pantalla `/catalogos/categorias` (menú "Catálogos").
- **F3-02** Tablas `reportes`, `reporte_seguimientos`, `reporte_evidencias`, `notificaciones` y `folios_reporte` (migración `20261013020000_reportes`); folio `PLT-AAAA-NNNNNN` consecutivo y atómico.
- **F3-03** Fotos: compresión en el dispositivo, validación por firma de bytes, `StorageService` (disco local) y descarga con URL firmada en `/api/archivos/*`.
- **F3-04** Wizard móvil `/reportes/nuevo` (sitio → categoría → prioridad → fotos → detalle, GPS opcional) y botón "Nuevo reporte" en el inicio del guardia.
- **F3-05** Detalle `/reportes/:id` con galería, línea de tiempo y seguimiento (comentario, fotos, cambio de estatus con transiciones válidas).
- **F3-06** Listado `/reportes` con búsqueda por folio/título y filtros por estatus, prioridad, categoría, cliente, fechas (zona CDMX) y "solo míos".
- Permiso `reportes.estatus` (admin y supervisor). Núcleo: `tienePermiso`, `inicioDelDia`, `detectarImagen`, `firmarArchivo`/`verificarFirma`, `ARCHIVOS_URL_TTL_MIN`. Web: `formularioConFotos`, `Galeria`, badges de estatus/prioridad.
- README: sección "Cómo arrancar la app (día a día)".

#### Cambiado

- Helpers de esquemas compartidos (`textoOpcional`, `coordenada`, `fechaSchema`) movidos a `schemas/comunes.ts`.

#### Corregido

- Errores del wizard que seguían visibles tras corregir el campo; botón "Filtros" sin nombre accesible en celular.

#### Verificado

- `npm test` 81/81, `lint`, `typecheck`, `format:check`, `build`.
- API contra MySQL: 37 verificaciones (categorías, folio, fotos, URL firmada, visibilidad, transiciones, filtros).
- Edge headless: reportes (17), clientes (17), usuarios (22) y login (11); sin scroll horizontal a 360px.

#### Decisiones

- D-015 reportes y evidencias.

#### Tareas

- F3-01..F3-06 terminadas. F3-07/F3-08 bloqueadas (SMTP, D-003).

### Sesión 2026-10-13 #8

#### Añadido

- **F2-01** Tablas `clientes`, `cliente_contactos`, `sitios`, `sitio_guardia` y relación `usuarios.cliente_id` (migración `20261013010000_clientes_sitios`).
- **F2-02** API `/api/clientes` (lista con búsqueda, estatus y vigencia; ficha; alta, edición, baja y reactivación; RFC validado y único) y pantallas `/clientes` y `/clientes/:id`.
- **F2-03** Contactos 1..N por cliente con responsable, notificaciones (exigen correo) y prioridad.
- **F2-04** Sitios por cliente con dirección, referencias y coordenadas ("usar mi ubicación"); la baja termina las asignaciones vigentes.
- **F2-05** Asignación de guardias a sitios con turno y vigencia, sin cruces; `GET /api/sitios/mios` y tarjeta "Mis sitios" en el inicio del guardia.
- Núcleo API: `AccionCtx` + `audit.registrarAccion`, `BaseController.accionCtx(req)`, `calcularCambios`, `hoyISO`/`fechaADate`/`dateAFecha`, `APP_TIMEZONE`.
- Web: `useForm`, `FormModal`, `Checkbox`, `useDebounced`, `formatFecha`/`hoyLocal`, `mapsUrl`, `mensajeDeError`.

#### Cambiado

- Avisos (toasts) abajo a la derecha en escritorio para no tapar las acciones del encabezado.

#### Corregido

- `clienteUpdateSchema` ya no aplica el estatus por defecto en un PATCH parcial (reactivaba clientes suspendidos).
- Scroll horizontal a 360px en la ficha del cliente (`grid-cols-1` explícito).

#### Verificado

- `npm test` 68/68, `lint`, `typecheck`, `format:check`, `build`.
- API contra MySQL: 27 verificaciones de clientes, contactos, sitios y asignaciones.
- Edge headless contra MySQL: clientes (17), usuarios (22) y login (11) verificaciones; sin scroll horizontal a 360px en páginas y modales.

#### Decisiones

- D-014 modelo de clientes, sitios y asignaciones.

#### Tareas

- F2-01..F2-05 terminadas. **Fase 2 completa.**

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
