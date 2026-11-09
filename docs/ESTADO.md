# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-11-09
**Fase actual:** Platinum corre en el servidor de la oficina (Docker: MySQL, API, web y túnel de Cloudflare, en `platinum.grupocomunicalo.mx`) con asistencia completa, reportes, portal del cliente, botón SOS, carteras de admin y reportes del cliente. Estado: terminado y en mantenimiento; se hacen mejoras que el usuario pide.
**Última tarea terminada:** A-59 (reportes del cliente sobre el servicio o un guardia): en el servidor (migración 20261105000000) y probada por el usuario con un cliente. Todo lo anterior (hasta A-66, carteras fase 2) también está en el servidor y probado.
**Tarea en progreso:** ninguna. Esta sesión (2026-11-09) fue de revisión y de ordenar decisiones; no se tocó código.

## Siguiente paso

El usuario traerá cambios pendientes. Ya registrados en el [PLAN](PLAN.md) y por definir con él antes de construir:

1. **A-68 Aviso de privacidad y consentimiento por el uso del rostro:** debe salirle a todos los guardias que van a checar y aceptarlo antes de registrar el rostro o checar. Falta que el usuario dé: texto legal, responsable (Platinum Agency o Grupo Comunicalo) y qué pasa si el guardia no acepta.
2. **A-67 Fotos en los reportes del cliente:** hasta 5 fotos (solo imágenes). Ya aprobada la idea; con migración.
3. Otras cosas que el usuario fue notando al probar la app: las va a pasar para ordenarlas y compararlas con el código antes de tocar nada.

Se registrarán también como tareas nuevas (con ID, en el PLAN) antes de implementarlas.

## Decisiones tomadas el 2026-11-09

- **A-42 Respaldos:** pospuesta. Todo se queda en el servidor; se le recuerda al usuario cuando lleguemos a esa parte.
- **D-001 Señal:** prioridad al checador (entrada, comida y salida) sin señal. DA-53 ya está construido; el usuario lo prueba en modo avión y avisa. Después, reportes del guardia con la misma cola (F4-02). Supervisor y admin no.
- **Lentes (D-025):** se dejan puestos, funciona bien.
- **Bcrypt (D-024):** se deja como está.
- **D-022 Simulacro SOS:** cerrada; el botón ya se probó.
- **A-61 C2 (D-023):** cambia a una pantalla de monitoreo propia para el C2; sin definir ni fecha.
- **D-020 Notificaciones por cuenta en el celular:** reabierta, pendiente por resolver.
- Pruebas de carga extra (ráfaga de cambio de turno, base con meses de datos): pendientes, sin prioridad.

## Pendientes

- A-41 Correo SMTP y recuperar contraseña (cierra A-06 y A-15): necesita host, puerto, usuario, remitente y SPF/DKIM; la contraseña la pone el usuario en el `.env` del servidor.
- A-44 Manual de usuario: al final, con capturas definitivas.
- A-42 Respaldos (pospuesta), A-61 monitoreo del C2 y D-020 (por definir).
- F4-02 Cola offline de reportes del guardia (después de probar el checador sin señal).
- Opcionales sin hacer: F4-03 (CI y pruebas de flujos críticos) y Fase 5 (WhatsApp, dashboard de métricas, PDF de reportes, SLA).

## Cómo levantar

- `npm install`; `npm run db:deploy -w @platinum/api` y `npm run db:seed -w @platinum/api` (sincroniza roles y permisos).
- `npm run dev:https` para checador biométrico y pruebas en red local.
- Calidad: `npm test` (548 pasando), `npm run lint`, `npm run typecheck`.
- La carpeta de Platinum (`intranetplatinum-platinum`) aún no tiene `node_modules` ni `apps/api/.env`: hay que hacer `npm install` y crear el `.env` antes de probar en local.

## Notas de contexto

- Rama de trabajo: `Alexis-Cambios`, en su propia carpeta (`C:\Users\DEVOPS\Videos\intranetplatinum-platinum`, git worktree). La carpeta `intranetplatinum` es de la rama `gestion-comunicalo`, que trabaja el otro chat. Ver [RAMAS.md](RAMAS.md).
- Roles activos: `admin`, `supervisor`, `guardia` y `cliente`; el super admin es una marca en la cuenta (D-021).
- Horas extra: solo las ven admin y supervisor; el guardia recibe avisos de sus solicitudes.
- Platinum se despliega directo a producción, solo cuando el usuario lo pide.
