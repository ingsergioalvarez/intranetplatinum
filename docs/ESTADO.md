# Estado actual — ¿Dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial completo está en [CHANGELOG.md](../CHANGELOG.md).

**Última actualización:** 2026-10-30 (perfiles rápidos y PIN, A-40; antes faltas por revisar con recordatorios y lentes menos estrictos, A-50 y A-51; antes óvalo punteado, confirmar falta y salida sin marcar con medida disciplinaria, A-47 a A-49; antes cámara de asistencia: centrado, óvalo y gesto de 15 s, A-36 y A-37; antes etiqueta de Asistencia, fines de semana, motivo obligatorio y cambiar o cancelar plan, A-33 a A-35, A-45, A-46)
**Fase actual:** Asistencia completa en lo funcional: reporte oficial, modo sin conexión, cambios de turno y horas extra.
**Última tarea terminada:** F4-04 casi completa: Platinum corre en el servidor de la oficina (Docker: MySQL, API, web y túnel propio de Cloudflare); se pudo entrar desde el dominio. Falta respaldo automático y SMTP. Antes: A-19 (hora límite del plan de cobertura).
**Tarea en progreso:** ninguna. A-40 (perfiles rápidos y PIN) hecha y probada en local, sin subir (migración 20261030040000). Hechas y probadas en local, sin subir: A-50 y A-51 (sin migración nueva). A-47 a A-49 también esperan subirse (migración 20261030020000). Hechas y probadas en local, sin subir al servidor (con migración nueva 20261030020000): A-47 (óvalo punteado en checador y registro), A-48 (confirmar falta, motivo al justificar y "No se presentó" que se cierra solo) y A-49 (salida sin marcar con motivo de lista, medida disciplinaria e historial formal). Ya en el servidor: A-33 a A-35, A-45 y A-46. Antes: A-27 (rostro atendible), A-28 (calendario con turnos de 24 h), A-29 (el admin crea el acceso del cliente, máx. 2) A-30 (avisos bloqueados para el supervisor), A-31 (confirmación al marcar incidencias de rostro), A-32 (cada aviso lleva a lo que indica) y el recordatorio de 30 min de A-26, todas sin migración; además A-23 (celular sin zoom y sin ensanchar), A-24 (retardo justificado), A-25 (aceptar con retardo / mandar a casa) y A-26 parcial (solicitud al admin como aviso; faltan recordatorio a los 30 min y lista formal). Sin migración nueva. A-20 (push) funciona en el celular del usuario; A-21 (push obligatorio) y A-22 (título propio en cada aviso, con migración nueva) están hechas y probadas en local, faltan subirlas al servidor (`docker compose exec api npm run db:deploy`).

## Siguiente paso

A-36 y A-37 (cámara) están en el servidor; el usuario las está probando. A-47 a A-49 están hechas en local, sin subir (hay migración: `db:deploy` después del build). Seguir el "Orden de ejecución" de [PLAN.md](PLAN.md): A-38 (portal del cliente con guardias), A-39 (lista de solicitudes de cobertura), A-40 (perfiles rápidos y PIN), A-41 (SMTP), A-42 (respaldos), A-43 y A-44 (manual).

Antes: subir A-47 a A-49 (con migración) y probar la cámara y las nuevas ventanas.

0. **Respaldos** automáticos de MySQL y de las fotos (volumen `uploads`) con copia fuera del servidor; sin eso no usar con guardias reales. Después, SMTP (correos y recuperar contraseña). Ver [DESPLIEGUE.md](DESPLIEGUE.md).
1. Probar AS6 con datos reales en el piloto: caso de cobertura (relevo que no llega), plan de descanso y calendario. AS6 (DA-56) está terminada y probada con datos simulados y pruebas automáticas.
2. AS4-03: ausencias justificadas (vacaciones, incapacidad, permiso) para que no cuenten como falta en el reporte.
3. Probar la PWA y el modo sin conexión en el celular (necesita HTTPS de confianza: dominio o túnel) y publicar en el dominio (F4-04).
4. Piloto con 2 o 3 guardias reales; probar el reporte de asistencia y horas extra con datos reales.
5. Después: correo (SMTP) y recuperación de contraseña, notificaciones push (TC-21), respaldos y revisión de seguridad.

## Por revisar

- Si los guardias con lentes deben seguir quitándoselos para el checador (hoy lo exige y a quien los usa a diario le estorba).

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
