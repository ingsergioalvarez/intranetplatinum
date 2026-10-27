# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-27 (calendario de cobertura, DA-56)
**Fase actual:** Asistencia completa en lo funcional: reporte oficial, modo sin conexión, cambios de turno y horas extra.
**Última tarea terminada:** AS6-01..AS6-04 (calendario de cobertura por sitio, todos los sitios, asignar cubridor y aviso de huecos).
**Tarea en progreso:** ninguna.

## Siguiente paso

1. **AS6 (DA-56), parte 2**: caso de cobertura AS6-05 (relevo que no llega, plan del supervisor), AS6-06 (descanso por patrón), AS6-07 (sin falta ni retardo en horas extra, un solo aviso por guardia) y AS6-08 (Plan de hoy del guardia). Ver [ASISTENCIA.md](ASISTENCIA.md) Fase 6.
2. AS4-03: ausencias justificadas (vacaciones, incapacidad, permiso) para que no cuenten como falta en el reporte.
3. Probar la PWA y el modo sin conexión en el celular (necesita HTTPS de confianza: dominio o túnel) y publicar en el dominio (F4-04).
4. Piloto con 2 o 3 guardias reales; probar el reporte de asistencia y horas extra con datos reales.
5. Después: correo (SMTP) y recuperación de contraseña, notificaciones push (TC-21), respaldos y revisión de seguridad.

## Bloqueos / pendientes del usuario

- Dominio y VPS para publicar; certificado de confianza para instalar la PWA en el celular.
- SMTP para correos salientes (F3-07).

## Cómo levantar

- `npm install`; `npm run db:deploy -w @platinum/api` y `npm run db:seed -w @platinum/api` (sincroniza roles y permisos).
- `npm run dev:https` para checador biométrico y pruebas en red local.
- Calidad: `npm test` (311/311 pasando), `npm run lint`, `npm run typecheck`.

## Notas de contexto

- Rama de trabajo: `Alexis-Cambios`.
- Roles activos: `admin`, `supervisor`, `guardia` y `cliente`.
- Horas extra: solo las ven admin y supervisor; el guardia recibe avisos de sus solicitudes.
