# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-12
**Fase actual:** Fase 0 — Base del proyecto
**Última tarea terminada:** F0-04 — Prisma 7, esquema de seguridad, migración inicial y seed
**Tarea en progreso:** ninguna

## Siguiente paso

1. **F0-05**: frontend core (`ApiClient`, `CrudService`, router con rutas protegidas).
2. **F0-06 / F0-07**: librería UI + layout responsive (Tailwind).
3. **F0-08**: README de arranque.

## Bloqueos / pendientes del usuario

- **F0-09** bloqueada: aplicar migración + seed en el MySQL de la otra máquina. Necesita `DATABASE_URL` y `SEED_ADMIN_PASSWORD` en `apps/api/.env`, luego `npm run db:deploy -w @platinum/api` y `npm run db:seed -w @platinum/api`.
- D-001, D-002, D-003 sin respuesta (ver [DECISIONES.md](DECISIONES.md)); no bloquean la Fase 0.

## Cómo levantar

- `npm install` en la raíz (genera el cliente Prisma automáticamente).
- Copiar `apps/api/.env.example` → `apps/api/.env` (y `apps/web/.env.example` → `apps/web/.env`).
- `npm run dev` → API en http://localhost:4000, web en http://localhost:5173 (proxy `/api`).
- Calidad: `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`.

## Notas de contexto

- Uso principal será en celular por guardias intramuros.
- TypeScript 5.9 (D-009), Prisma 7.10 + override `mariadb` 3.5.4 (D-010).
- `npm audit` deja 4 alertas solo en el CLI de Prisma (desarrollo), aceptadas en D-010.
- Git: `1c0ff3b` (F0-00..02), `f61001d` (F0-03), F0-04 en el siguiente commit.
