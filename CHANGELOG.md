# Changelog — Intranet Platinum Agency

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Cada entrada referencia las tareas (`Fx-yy`), alcances (`A-xx`) y decisiones (`D-xxx`) del [PLAN](docs/PLAN.md).

## [Sin publicar]

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
