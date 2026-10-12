# Changelog — Intranet Platinum Agency

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Cada entrada referencia las tareas (`Fx-yy`), alcances (`A-xx`) y decisiones (`D-xxx`) del [PLAN](docs/PLAN.md).

## [Sin publicar]

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
