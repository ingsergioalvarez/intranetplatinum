# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-26
**Fase actual:** Módulo de Reportes, Relevo de Consignas y Portal de Clientes (Fases 1 a 5, REP-01..REP-09, P-05) terminado y verificado.
**Última tarea terminada:** REP-09 (Portal de clientes con vista de reportes, comentarios con foto, asistencia ejecutiva con avatar, retardos y desglose de comidas, campanita en tiempo real sincronizada y permisos en BD).
**Tarea en progreso:** ninguna. Todo el bloque de reportes y portal de clientes está en verde.

## Siguiente paso

1. Elegir siguiente alcance:
   - Opción A: Reporte consolidado de asistencia por periodo y exportación a Excel / PDF (AS4-01, AS4-02, F5-04).
   - Opción B: Modo offline en celular / PWA con cola de marcas en IndexedDB (AS2-01..AS2-04).
   - Opción C: Notificaciones externas por correo a clientes (F3-07..F3-10) y cambios de turno (TC-21, TC-22).
2. Pruebas reales en sitio con el cliente y guardias.

## Bloqueos / pendientes del usuario

- SMTP para envío de correos salientes (F3-07): las notificaciones al cliente hoy se visualizan vía campanita y portal web.
- Teléfono por sitio (DA-43): cada guardia inicia sesión con su cuenta.

## Cómo levantar

- `npm install`; `npm run db:deploy -w @platinum/api` y `npm run db:seed -w @platinum/api` (sincroniza roles y permisos actualizados).
- `npm run dev:https` para checador biométrico y pruebas en red local.
- Calidad: `npm test` (219/219 pasando), `npm run lint`, `npm run typecheck`.

## Notas de contexto

- Rama de trabajo: `Alexis-Cambios`.
- Roles activos: `admin`, `supervisor`, `guardia` y `cliente`.
