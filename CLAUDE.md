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
- Backend por módulos verticales en `apps/api/src/modules/<modulo>/` con `routes`, `controller`, `service`, `repository`, `schemas`. Las clases extienden `BaseController` / `BaseService` / `BaseRepository` de `src/core/`.
- Frontend por módulos en `apps/web/src/modules/<modulo>/`; componentes genéricos en `src/components/ui/`; servicios OOP (`ApiClient`, `CrudService`) en `src/core/`.

## Convenciones

- Idioma de dominio en español (tablas, entidades, UI); código técnico genérico en inglés aceptable (`BaseRepository`).
- Tablas en `snake_case` plural; borrado lógico con `deleted_at`.
- Mobile-first: diseñar a 360px primero; modales se convierten en bottom-sheet en móvil.
- Validación con zod compartida front/back. Nunca confiar en fecha del cliente para evidencias (D-007).
- Toda acción administrativa se registra en `auditoria`.
