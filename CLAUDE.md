# CLAUDE.md — Intranet Platinum Agency

Intranet para Platinum Agency (seguridad física intramuros). Uso principal en **celular** por guardias; también escritorio para supervisores/administración.

## Protocolo de sesión (obligatorio)

**Al iniciar:**

1. Leer [docs/ESTADO.md](docs/ESTADO.md) → dónde nos quedamos y siguiente paso.
2. Revisar [docs/PLAN.md](docs/PLAN.md) → tareas y alcances; [docs/DECISIONES.md](docs/DECISIONES.md) → pendientes.
3. Resumir al usuario el estado en 3–5 líneas antes de trabajar.

**Durante:**

- Toda tarea nueva o alcance nuevo que pida el usuario se agrega al PLAN con ID (`A-xx` / `Fx-yy`) antes de implementarla. Nunca borrar alcances; descartar con `[-]` y motivo en DECISIONES.
- Marcar `[~]` la tarea en curso y `[x]` al terminar (cumpliendo su criterio de aceptación).

**Al terminar (o cuando el usuario diga "cerramos"):**

1. Agregar entrada en [CHANGELOG.md](CHANGELOG.md) (sesión con fecha, añadido/cambiado/corregido, IDs de tareas).
2. Sobrescribir [docs/ESTADO.md](docs/ESTADO.md) con fase, última tarea, siguiente paso y bloqueos.
3. Actualizar la columna Estado de la matriz de alcances en el PLAN.

## Stack y estructura

- Monorepo npm workspaces: `apps/api` (Node + Express + TS), `apps/web` (React + Vite + TS + Tailwind, PWA), `packages/shared` (tipos y esquemas zod).
- MySQL 8. ORM según D-004.
- Backend por módulos verticales en `apps/api/src/modules/<modulo>/` con `index.ts` (router + export `AppModule`), `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schemas.ts`. Registrar el módulo en `src/modules/index.ts`.
- Núcleo en `apps/api/src/core/` (importar desde `../../core`):
  - `BaseController`: handlers como propiedades flecha; helpers `ok/created/paginated/noContent`, `body/query/params` (leen `req.validated`), `currentUser`.
  - `BaseService` (logging/auditoría) → `CrudService<TEntity, TCreate, TUpdate>` (getById con 404, list, create, update, deactivate, restore).
  - `BaseRepository` abstracto, independiente del ORM; `softDelete`/`restore` (D-006).
  - `HttpError` (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `tooMany`).
  - Middlewares: `validate({ body, query, params })` con zod, `authenticate`, `requireRoles(...)`, `requirePermission('x.y')`, `uploadImages` (multer en memoria).
  - Respuestas siempre `{ ok, data }` / `{ ok:false, error:{ code, message, details } }`.
- Config tipada en `apps/api/src/config/env.ts` (zod). No leer `process.env` directo en módulos.
- Base de datos: Prisma 7 (`apps/api/prisma/schema.prisma`, cliente generado en `src/generated/prisma`, ignorado en git). Acceso con `getPrisma()` de `core/data/prisma.ts` solo dentro de repositorios.
  - MySQL vive en otra máquina (D-008): **no hay BD local**. Para cambios de esquema: editar `schema.prisma` → `npx prisma validate` → generar SQL con `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script -o prisma/migrations/<AAAAMMDDHHMMSS>_<nombre>/migration.sql` (D-011). Se aplica en el servidor con `npm run db:deploy -w @platinum/api`.
  - Permisos y roles salen de `@platinum/shared` (`PERMISOS`, `PERMISOS_POR_ROL`); el seed los sincroniza.
- Pruebas: Vitest + supertest en `apps/api/test/`. `npm test` desde la raíz.
- Frontend (`apps/web/src/`):
  - Pantallas por módulo en `modules/<modulo>/`; rutas en `app/router.tsx` (envolver con `ProtectedRoute permiso={...}`); menú en `components/layout/navItems.ts` (filtra por permiso).
  - `core/api`: instancia única `api` (`ApiClient`: token, cookies, `{ ok, data }`, `ApiError` con `fieldErrors`), `queryClient`. Servicios de módulo extienden `CrudService<T>(api, '/recurso')` y usan `service.keys` para TanStack Query.
  - `core/auth`: `useAuthStore` (sesión en memoria; `clear()` = sesión expirada, `logout()` = cierre voluntario), `hasPermission`, `ProtectedRoute`.
  - Librería UI en `components/ui` (importar desde el barrel): `Button`, `Input`/`Select`/`Textarea`, `FormField` (inyecta id/invalid), `Card`, `Badge`, `Modal` (bottom-sheet en celular), `DataTable` (tabla en escritorio, tarjetas en celular; columnas con `mobile: 'title'|'subtitle'|'field'|'hidden'`), `Pagination`, `toast`, `PhotoUploader`, `EmptyState`, `Spinner`. `PageHeader` está en `components/layout/AppShell`.
  - Tailwind 4: tema en `src/index.css` (`brand-*`, `platinum-*`). Usar `pb-safe`/`pt-safe` para áreas seguras del celular.
  - Catálogo visual en `/ui` (solo desarrollo). Login demo por rol solo en desarrollo hasta F1-03.
  - Verificación visual: capturas a 360px y 1440px con Edge headless (`playwright-core`, channel `msedge`) instalado fuera del repo.

## Convenciones

- Idioma de dominio en español (tablas, entidades, UI); código técnico genérico en inglés aceptable (`BaseRepository`).
- Tablas en `snake_case` plural; borrado lógico con `deleted_at`.
- Mobile-first: diseñar a 360px primero; modales se convierten en bottom-sheet en móvil.
- Validación con zod compartida front/back. Nunca confiar en fecha del cliente para evidencias (D-007).
- Toda acción administrativa se registra en `auditoria`.
