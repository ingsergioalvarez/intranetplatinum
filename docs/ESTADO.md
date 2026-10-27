# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-27 (horas extra, DA-55)
**Fase actual:** Asistencia completa en lo funcional: reporte oficial, modo sin conexión, cambios de turno y horas extra.
**Última tarea terminada:** AS5-01..AS5-05 (horas extra con aprobación del supervisor).
**Tarea en progreso:** ninguna.

## Siguiente paso

1. Subir lo de horas extra a `Alexis-Cambios` (último push: commit `c067d62`, antes de horas extra).
2. **AS6 (DA-56)**, planeado y aprobado el diseño: empezar por el calendario de cobertura (AS6-01..AS6-04) y luego el caso de cobertura (AS6-05..AS6-08). Ver [ASISTENCIA.md](ASISTENCIA.md) Fase 6.
3. AS4-03: ausencias justificadas (vacaciones, incapacidad, permiso) para que no cuenten como falta en el reporte.
4. Probar la PWA y el modo sin conexión en el celular (necesita HTTPS de confianza: dominio o túnel) y publicar en el dominio (F4-04).
5. Piloto con 2 o 3 guardias reales; probar el reporte de asistencia y horas extra con datos reales.
6. Después: correo (SMTP) y recuperación de contraseña, notificaciones push (TC-21), respaldos y revisión de seguridad.

## Bloqueos / pendientes del usuario

- Dominio y VPS para publicar; certificado de confianza para instalar la PWA en el celular.
- SMTP para correos salientes (F3-07).

## Cómo levantar

- `npm install`; `npm run db:deploy -w @platinum/api` y `npm run db:seed -w @platinum/api` (sincroniza roles y permisos).
- `npm run dev:https` para checador biométrico y pruebas en red local.
- Calidad: `npm test` (286/286 pasando), `npm run lint`, `npm run typecheck`.

## Notas de contexto

- Rama de trabajo: `Alexis-Cambios`.
- Roles activos: `admin`, `supervisor`, `guardia` y `cliente`.
- Horas extra: solo las ven admin y supervisor; el guardia recibe avisos de sus solicitudes.
