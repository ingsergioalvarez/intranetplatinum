# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-12
**Fase actual:** Fase 0 terminada (salvo F0-09 bloqueada) → siguiente: **Fase 1 — Autenticación y usuarios**
**Última tarea terminada:** F0-08 — README de arranque (antes F0-05/06/07: frontend core, librería UI, layout)
**Tarea en progreso:** ninguna

## Siguiente paso

1. **F1-01**: tablas `refresh_tokens`, `password_resets`, `auditoria` (roles/permisos/usuarios ya existen desde F0-04) + migración SQL.
2. **F1-02**: API login / refresh / logout (JWT + cookie httpOnly, bcrypt, rate-limit, bloqueo tras 5 intentos).
3. **F1-03 / F1-04**: pantalla de login real y `AuthService` con refresh automático (conectar `api.setRefreshSession`). Quitar sesiones demo.

## Bloqueos / pendientes del usuario

- **F0-09** bloqueada: aplicar migración + seed en el MySQL de la otra máquina. Necesita `DATABASE_URL` y `SEED_ADMIN_PASSWORD` en `apps/api/.env`, luego `npm run db:deploy -w @platinum/api` y `npm run db:seed -w @platinum/api`.
- Sin BD, F1 se puede construir y probar con pruebas automatizadas (repositorios en memoria), pero la prueba de punta a punta de login necesita F0-09.
- **F1-05** (recuperar contraseña) necesita datos SMTP para enviar correos reales.
- D-001, D-002, D-003 sin respuesta (ver [DECISIONES.md](DECISIONES.md)); no bloquean la Fase 1.

## Cómo levantar

- `npm install` en la raíz (genera el cliente Prisma automáticamente).
- Copiar `apps/api/.env.example` → `apps/api/.env` (y `apps/web/.env.example` → `apps/web/.env`).
- `npm run dev` → API en http://localhost:4000, web en http://localhost:5173. En desarrollo: login demo por rol; catálogo de componentes en `/ui`.
- Calidad: `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`.

## Notas de contexto

- Uso principal será en celular por guardias intramuros.
- TypeScript 5.9 (D-009), Prisma 7.10 + override `mariadb` 3.5.4 (D-010), migraciones sin BD (D-011).
- `npm audit`: 4 alertas solo en el CLI de Prisma (desarrollo), aceptadas en D-010.
- Git: `1c0ff3b` (F0-00..02), `f61001d` (F0-03), `ee39650` (F0-04), Fase 0 web en el siguiente commit.
