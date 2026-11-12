# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-11-11 (detalles de la app, A-73, todos subidos y probados: reportes del cliente, rol en la línea del tiempo, ausencias y cambios de turno por cartera, foto de referencia en Asistencia, textos del cliente y aviso de privacidad; A-67 fotos en los reportes del cliente hecha en local, con migración, sin subir; manuales de los cinco roles con texto y sin capturas) · antes: 2026-11-10
**Fase actual:** Platinum corre en el servidor de la oficina (Docker: MySQL, API, web y túnel de Cloudflare, en `platinum.grupocomunicalo.mx`) con asistencia completa, reportes, portal del cliente, botón SOS, carteras de admin y reportes del cliente. Estado: terminado y en mantenimiento; se hacen mejoras que el usuario pide.
**Última tarea terminada:** A-81 (respuestas del C2 al SOS, tablas del manual sin emojis, barra de Contenido fija y PDF del manual del C2) hecha el 2026-11-13 en local, sin migración; antes, A-79 (barra lateral que se oculta) y A-80 (bitácora, acciones y reportes del C2) hechas el 2026-11-12 en local, con la migración `20261114000000_c2_bitacora` (escrita a mano, sin probar contra una base de datos); antes, A-61 (monitoreo del C2) hecha el 2026-11-12 en local: rol Operador C2, pantalla de solo lectura, estados de sitio, episodios e historial, sonido, SOS con el C2 y todos los teléfonos, manual y aviso; migración `20261113000000_monitoreo_c2` escrita a mano (sin probar contra una base de datos); 621 pruebas pasando, tipado y lint limpios. Antes: A-77 y A-78 ya subidas y probadas.
**Tarea en progreso:** ninguna. Falta que el usuario vea la pantalla del C2 con datos reales (con su usuario de pruebas), la suba con su migración y cree una cuenta con rol Operador C2.

## Siguiente paso

El usuario traerá cambios pendientes. Ya registrados en el [PLAN](PLAN.md) y por definir con él antes de construir:

1. **A-68 Aviso de privacidad:** construido (ver [AVISO_PRIVACIDAD_BORRADOR.md](AVISO_PRIVACIDAD_BORRADOR.md)). Falta: subirlo al servidor, que el abogado apruebe el texto y llenar sus datos entre corchetes (razón social y domicilio de Platinum, correo para derechos ARCO, plazos, transferencias y qué hace el guardia que no acepta) cambiando `packages/shared/src/constants/avisoPrivacidad.ts` y subiendo `AVISO_PRIVACIDAD_VERSION`; después regenerar el documento. Quitar `AVISO_PRIVACIDAD_ES_BORRADOR` cuando esté aprobado.
2. **A-70 Instalación obligatoria de la app en celular:** subida y probada por el usuario; solo falta confirmar en iPhone si no se probó.
3. **A-76 Pantalla de auditoría** (solo lectura): el usuario la quiere, sin fecha. **A-41 Correos:** falta que el usuario dé host, puerto, usuario y remitente del servidor de correo. **A-61 Pantalla del C2:** hecha en local; falta subirla y probarla (ver Tarea en progreso).
4. Otras cosas que el usuario fue notando al probar la app: las va a pasar para ordenarlas y compararlas con el código antes de tocar nada.

Se registrarán también como tareas nuevas (con ID, en el PLAN) antes de implementarlas.

## Decisiones tomadas el 2026-11-09

- **A-42 Respaldos:** pospuesta. Todo se queda en el servidor; se le recuerda al usuario cuando lleguemos a esa parte.
- **D-001 Señal:** prioridad al checador (entrada, comida y salida) sin señal. DA-53 ya está construido; el usuario lo prueba en modo avión y avisa. Después, reportes del guardia con la misma cola (F4-02). Supervisor y admin no.
- **Lentes (D-025):** se dejan puestos, funciona bien.
- **Bcrypt (D-024):** se deja como está.
- **D-022 Simulacro SOS:** cerrada; el botón ya se probó.
- **A-61 C2 (D-023):** aceptada y construida en local el 2026-11-12; falta subirla y probarla.
- **D-020 Notificaciones por cuenta en el celular:** aceptada el 2026-11-12 y construida (A-77 y A-78).
- Pruebas de carga extra (ráfaga de cambio de turno, base con meses de datos): pendientes, sin prioridad.

## Pendientes

- A-41 Correo SMTP y recuperar contraseña (cierra A-06 y A-15): necesita host, puerto, usuario, remitente y SPF/DKIM; la contraseña la pone el usuario en el `.env` del servidor.
- A-44 Manual de usuario: al final, con capturas definitivas.
- A-42 Respaldos (pospuesta).
- F4-02 Cola offline de reportes del guardia (después de probar el checador sin señal).
- Opcionales sin hacer: F4-03 (CI y pruebas de flujos críticos) y Fase 5 (WhatsApp, dashboard de métricas, PDF de reportes, SLA).

## Cómo levantar

- `npm install`; `npm run db:deploy -w @platinum/api` y `npm run db:seed -w @platinum/api` (sincroniza roles y permisos).
- `npm run dev:https` para checador biométrico y pruebas en red local.
- Calidad: `npm test` (597 pasando), `npm run lint`, `npm run typecheck`.
- La carpeta de Platinum (`intranetplatinum-platinum`) aún no tiene `node_modules` ni `apps/api/.env`: hay que hacer `npm install` y crear el `.env` antes de probar en local.

## Notas de contexto

- Rama de trabajo: `Alexis-Cambios`, en su propia carpeta (`C:\Users\DEVOPS\Videos\intranetplatinum-platinum`, git worktree). La carpeta `intranetplatinum` es de la rama `gestion-comunicalo`, que trabaja el otro chat. Ver [RAMAS.md](RAMAS.md).
- Roles activos: `admin`, `supervisor`, `guardia` y `cliente`; el super admin es una marca en la cuenta (D-021).
- Horas extra: solo las ven admin y supervisor; el guardia recibe avisos de sus solicitudes.
- Platinum se despliega directo a producción, solo cuando el usuario lo pide.
