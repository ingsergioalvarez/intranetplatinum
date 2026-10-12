# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-12
**Fase actual:** Fase 0 — Base del proyecto
**Última tarea terminada:** F0-02 — ESLint, Prettier, `.env.example`, git init
**Tarea en progreso:** ninguna

## Siguiente paso

1. **F0-03**: clases base del backend (`BaseController`, `BaseService`, `BaseRepository`, `HttpError`, middlewares de errores, validación zod, auth, roles y upload) + módulo `health` usándolas.
2. Después **F0-05 / F0-06 / F0-07** (frontend core, librería UI, layout). **F0-04** se puede preparar (esquema y migraciones) pero aplicar migraciones requiere acceso a MySQL (D-008).

## Bloqueos / pendientes del usuario

- D-001 a D-004 sin respuesta (ver [DECISIONES.md](DECISIONES.md)). D-004 (ORM): si no responde, Prisma por defecto.
- MySQL en otra máquina (D-008): falta `DATABASE_URL` real para aplicar migraciones y seeds.
- Git inicializado sin commits: el usuario decide cuándo hacer el primer commit / remoto.

## Cómo levantar

- `npm install` en la raíz.
- Copiar `apps/api/.env.example` → `apps/api/.env` (y `apps/web/.env.example` → `apps/web/.env`).
- `npm run dev` → API en http://localhost:4000, web en http://localhost:5173 (proxy `/api`).
- Calidad: `npm run lint`, `npm run format:check`, `npm run typecheck`.

## Notas de contexto

- Uso principal será en celular por guardias intramuros.
- TypeScript fijado en 5.9 (D-009).
