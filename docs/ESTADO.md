# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-12
**Fase actual:** Fase 0 — Base del proyecto
**Última tarea terminada:** F0-03 — Núcleo del backend (clases base, middlewares, módulo `health`, pruebas)
**Tarea en progreso:** ninguna

## Siguiente paso

1. **F0-04 (parcial)**: definir ORM (D-004, Prisma por defecto), escribir esquema inicial (roles, usuarios) y seeds. Aplicar migraciones queda pendiente hasta tener MySQL (D-008).
2. **F0-05**: frontend core (`ApiClient`, `CrudService`, router con rutas protegidas).
3. **F0-06 / F0-07**: librería UI + layout responsive (Tailwind).

## Bloqueos / pendientes del usuario

- D-001 a D-004 sin respuesta (ver [DECISIONES.md](DECISIONES.md)). D-004 (ORM): si no responde, Prisma por defecto.
- MySQL en otra máquina (D-008): falta `DATABASE_URL` real para aplicar migraciones y seeds.

## Cómo levantar

- `npm install` en la raíz.
- Copiar `apps/api/.env.example` → `apps/api/.env` (y `apps/web/.env.example` → `apps/web/.env`).
- `npm run dev` → API en http://localhost:4000, web en http://localhost:5173 (proxy `/api`).
- Calidad: `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`.

## Notas de contexto

- Uso principal será en celular por guardias intramuros.
- TypeScript fijado en 5.9 (D-009).
- Git: commit inicial `1c0ff3b` (F0-00..F0-02). F0-03 pendiente de commit.
