# Estado actual — Comunicalo (gestión): ¿dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial está en [CHANGELOG.md](../CHANGELOG.md).
> Esta es la rama `gestion-comunicalo`. Lo de Platinum está archivado en [platinum/](platinum/LEEME.md) y su versión viva en `main`.

**Última actualización:** 2026-11-03
**Fase actual:** Borrador funcionando. Comunicalo corre en `https://gestion.grupocomunicalo.mx` como copia de Platinum (todavía con su marca y conceptos de seguridad). Aún no hay funcionalidad propia.
**Última tarea terminada:** C-03 (primera instalación en el servidor) y C-02 (dominio y túnel).
**Tarea en progreso:** ninguna. C-05 (imagen de marca) terminada en local, a la espera de la revisión visual del usuario; sin desplegar al servidor.

## Siguiente paso

0. Seguir el plan de [PLAN.md](PLAN.md), en orden: revisar C-05 (el nombre "Grupo Comunícalo" del login es provisional), luego C-06 (mapa de módulos), C-07 (plataforma y empresas), C-08 (aislamiento por empresa), C-09 (admin de empresa), C-10 (estructura), C-11 (roles y permisos), C-12 (checador flexible y rostro obligatorio), C-13 (planeador de horarios). Decisiones en DC-006 a DC-009.
1. El usuario define, poco a poco, lo primero que debe hacer Comunicalo; se agrega al [PLAN](PLAN.md) con su ID antes de implementarlo.
2. C-04 (respaldos de la base y las fotos de Comunicalo) antes de usarlo con personas reales.

## Bloqueos / pendientes del usuario

- Cambiar la contraseña del administrador (quedó escrita en el chat al crearla).
- Nada más por ahora.

## Cómo está desplegado

- Servidor de la oficina, carpeta `~/comunicalo/deploy`, proyecto Docker `comunicalo` (contenedores `comunicalo-mysql-1`, `-api-1`, `-web-1`, `-tunnel-1`).
- Base `gestion_comunicalo` (45 migraciones aplicadas), puerto local 5191, túnel `gestion-comunicalo` (`14edb25a-d16d-4757-835c-2127225af245`), dominio `gestion.grupocomunicalo.mx`.
- El `.env` vive solo en el servidor (no está en git). Claves de push generadas una sola vez: no cambiarlas.
- Actualizar: desde la rama `gestion-comunicalo` hacer `git archive` y `scp` a `~/comunicalo`, y en `~/comunicalo/deploy`: `docker compose up -d --build` (más `docker compose exec api npm run db:deploy` si hay migraciones). Ver [DESPLIEGUE.md](DESPLIEGUE.md) y las reglas de [RAMAS.md](RAMAS.md).

## Notas de contexto

- Rama de trabajo: `gestion-comunicalo` (sale de `main`, commit `9f572c0`). Reglas obligatorias en [RAMAS.md](RAMAS.md).
- El seed trajo los datos de Platinum (26 categorías de reporte de seguridad, 20 permisos, 4 roles); se ajustarán a Comunicalo más adelante.
- Producto: asistencia administrada por RH para áreas, técnicos y home office. Más adelante, horarios que suben los jefes y planeación de rutas de técnicos (ideas, sin ID todavía).
