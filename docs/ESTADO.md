# Estado actual — Comunicalo (gestión): ¿dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial está en [CHANGELOG.md](../CHANGELOG.md).
> Esta es la rama `gestion-comunicalo`. Lo de Platinum está archivado en [platinum/](platinum/LEEME.md) y su versión viva en `main`.

**Última actualización:** 2026-11-03
**Fase actual:** Arranque. Todavía no hay funcionalidad propia de Comunicalo; el código es el mismo de Platinum.
**Última tarea terminada:** C-01 (estructura de ramas, documentos separados y archivos de despliegue de Comunicalo).
**Tarea en progreso:** ninguna.

## Siguiente paso

1. Que el DNS `gestion.grupocomunicalo.mx` apunte al túnel `gestion-comunicalo` (ver C-02).
2. Levantar la instalación de Comunicalo en el servidor (C-03).
3. El usuario define, poco a poco, lo primero que debe hacer Comunicalo; se agrega al [PLAN](PLAN.md) con su ID antes de implementarlo.

## Bloqueos / pendientes del usuario

- DNS: CNAME `gestion` → `14edb25a-d16d-4757-835c-2127225af245.cfargotunnel.com` (con proxy), o `cloudflared tunnel route dns gestion-comunicalo gestion.grupocomunicalo.mx`.

## Notas de contexto

- Rama de trabajo: `gestion-comunicalo` (sale de `main`, commit `9f572c0`). Reglas obligatorias en [RAMAS.md](RAMAS.md).
- Instalación propia: proyecto Docker `comunicalo`, base `gestion_comunicalo`, puerto local 5191, túnel `gestion-comunicalo`, dominio `gestion.grupocomunicalo.mx`.
- Producto: asistencia administrada por RH para áreas, técnicos y home office. Más adelante, horarios que suben los jefes y planeación de rutas de técnicos (ideas, sin ID todavía).
