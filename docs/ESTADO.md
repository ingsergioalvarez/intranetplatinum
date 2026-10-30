# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-30 (cámara de asistencia: centrado, óvalo y gesto de 15 s, A-36 y A-37; antes etiqueta de Asistencia, fines de semana, motivo obligatorio y cambiar o cancelar plan, A-33 a A-35, A-45, A-46)
**Fase actual:** Asistencia completa en lo funcional: reporte oficial, modo sin conexión, cambios de turno y horas extra.
**Última tarea terminada:** F4-04 casi completa: Platinum corre en el servidor de la oficina (Docker: MySQL, API, web y túnel propio de Cloudflare); se pudo entrar desde el dominio. Falta respaldo automático y SMTP. Antes: A-19 (hora límite del plan de cobertura).
**Tarea en progreso:** ninguna. Hechas y probadas en local, sin subir al servidor (con migraciones nuevas 20261030000000 y 20261030010000): A-45 (cambiar o cancelar un plan confirmado, con motivo), A-46 (nota opcional al quedarse), A-33 (etiqueta azul de Asistencia sin cortarse), A-34 (fin de semana "Sin turno" en sitios de lunes a viernes) y A-35 (motivo obligatorio en "No puedo quedarme" y en el plan del supervisor). Antes: A-27 (rostro atendible), A-28 (calendario con turnos de 24 h), A-29 (el admin crea el acceso del cliente, máx. 2) A-30 (avisos bloqueados para el supervisor), A-31 (confirmación al marcar incidencias de rostro), A-32 (cada aviso lleva a lo que indica) y el recordatorio de 30 min de A-26, todas sin migración; además A-23 (celular sin zoom y sin ensanchar), A-24 (retardo justificado), A-25 (aceptar con retardo / mandar a casa) y A-26 parcial (solicitud al admin como aviso; faltan recordatorio a los 30 min y lista formal). Sin migración nueva. A-20 (push) funciona en el celular del usuario; A-21 (push obligatorio) y A-22 (título propio en cada aviso, con migración nueva) están hechas y probadas en local, faltan subirlas al servidor (`docker compose exec api npm run db:deploy`).

## Siguiente paso

A-33 a A-35, A-45 y A-46 ya están en el servidor. A-36 y A-37 (cámara) están hechas en local, sin subir ni probar con guardias reales. Seguir el "Orden de ejecución" de [PLAN.md](PLAN.md): A-38 (portal del cliente con guardias), A-39 (lista de solicitudes de cobertura), A-40 (perfiles rápidos y PIN), A-41 (SMTP), A-42 (respaldos), A-43 y A-44 (manual).

Antes: subir A-36 y A-37 al servidor (sin migración) y probar la cámara con guardias reales.

0. **Respaldos** automáticos de MySQL y de las fotos (volumen `uploads`) con copia fuera del servidor; sin eso no usar con guardias reales. Después, SMTP (correos y recuperar contraseña). Ver [DESPLIEGUE.md](DESPLIEGUE.md).
1. Probar AS6 con datos reales en el piloto: caso de cobertura (relevo que no llega), plan de descanso y calendario. AS6 (DA-56) está terminada y probada con datos simulados y pruebas automáticas.
2. AS4-03: ausencias justificadas (vacaciones, incapacidad, permiso) para que no cuenten como falta en el reporte.
3. Probar la PWA y el modo sin conexión en el celular (necesita HTTPS de confianza: dominio o túnel) y publicar en el dominio (F4-04).
4. Piloto con 2 o 3 guardias reales; probar el reporte de asistencia y horas extra con datos reales.
5. Después: correo (SMTP) y recuperación de contraseña, notificaciones push (TC-21), respaldos y revisión de seguridad.

## Por revisar

- Nada por revisar. El botón "No puedo quedarme" se queda, con motivo obligatorio (A-35).

## Bloqueos / pendientes del usuario

- Dominio y VPS para publicar; certificado de confianza para instalar la PWA en el celular.
- SMTP para correos salientes (F3-07).

## Cómo levantar

- `npm install`; `npm run db:deploy -w @platinum/api` y `npm run db:seed -w @platinum/api` (sincroniza roles y permisos).
- `npm run dev:https` para checador biométrico y pruebas en red local.
- Calidad: `npm test` (todas pasando), `npm run lint`, `npm run typecheck`.

## Notas de contexto

- Rama de trabajo: `Alexis-Cambios`.
- Roles activos: `admin`, `supervisor`, `guardia` y `cliente`.
- Horas extra: solo las ven admin y supervisor; el guardia recibe avisos de sus solicitudes.
