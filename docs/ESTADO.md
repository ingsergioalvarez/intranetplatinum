# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-22
**Fase actual:** A-17 Control de asistencia — Fase 1B (días de turno, coberturas, para el guardia) terminada; en pruebas reales con el teléfono del sitio.
**Última tarea terminada:** TC-15..TC-20 (cubrir otro sitio; ventana y tarjeta del turno del guardia)
**Tarea en progreso:** ninguna. Las tareas de cámara (AS1-08, AS1-09, AS1-10, AS1-15) siguen en `[~]` hasta confirmarlas en la prueba real.

## Siguiente paso

1. Probar en real: supervisor por sitio (asignarlo en Clientes → sitio → "Supervisor"), avisos de turno sin entrada, falta y "Aceptar asistencia", cubrir otro sitio y la ventana del turno en el teléfono del guardia.
2. Ajustar con lo que salga de la prueba (umbrales de cámara: luz de la cara, contraste de ojos, teléfono abajo/arriba).
3. Después (ASISTENCIA.md): TC-21 notificaciones push (requiere servidor con dominio y HTTPS), TC-22 cambios de turno; Fase 2 sin conexión (AS2-01..04); reportes y Excel (AS4).

## Bloqueos / pendientes del usuario

- Ningún sitio tiene supervisor asignado: hasta asignarlos, los avisos de los sitios le llegan al admin y un supervisor sin sitios no ve guardias.
- Reportes de los guardias desde la intranet: se dejan para después (hoy los mandan por WhatsApp).
- Teléfono por sitio (DA-43): cada guardia inicia sesión con su cuenta; teléfono autorizado / PIN se revisará tras las pruebas.
- SMTP, D-001 y D-002 siguen pendientes (ver PLAN).

## Cómo levantar

- `npm install`; `npm run db:deploy -w @platinum/api` y `npm run db:generate -w @platinum/api` (hay migraciones nuevas: bitácora, supervisor del sitio, turnos del día, coberturas).
- `npm run dev:https` para probar la cámara en el celular (HTTPS en la red local). El servidor revisa cada minuto los turnos sin entrada mientras está encendido.
- Calidad: `npm test`, `npm run lint`, `npm run typecheck`.

## Notas de contexto

- Rama de trabajo: `Alexis-Cambios`.
- Uso principal en celular por guardias; la empresa da un teléfono por sitio (DA-43).
