# Changelog — Intranet Platinum Agency

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Cada entrada referencia las tareas (`Fx-yy`), alcances (`A-xx`) y decisiones (`D-xxx`) del [PLAN](docs/PLAN.md).

## [Sin publicar]

### Sesión 2026-10-30 #34 — Faltas por revisar y lentes menos estrictos (A-50, A-51)

#### Añadido

- **Recordatorios de incidencias sin atender** (A-51): a las 8:00 y a las 14:00 (zona del negocio) cada supervisor recibe un solo aviso con el total de incidencias de asistencia que nadie ha justificado ni decidido, hasta que las atienda. Con más de 24 h sin atender también se avisa a los admin (una vez al día). Al generarse la falta, el supervisor recibe "Falta por revisar".

#### Cambiado

- Una falta sin revisar **ya no cuenta** como falta (A-51): ni en el resumen del guardia ni en el reporte, donde el día sale como "Por revisar" (con su cifra aparte). Solo cuenta al confirmarla; si se justifica, no cuenta. "No se presentó" es un aviso y no suma por sí mismo.
- **Lentes** (A-50): detectarlos ya no bloquea el checador ni el registro de rostro. Se recomienda quitárselos, pero se deja continuar; no se pide parpadear (se sortean giros u otros gestos) y el servidor acepta un margen un poco más amplio (0.56 en lugar de 0.50 para el titular, 0.66 en lugar de 0.60 para descartarlo). Otro guardia bloquea si queda más cerca o a menos de 0.06 del propio, así el margen extra no deja pasar a un compañero. Se quitó el botón "No traigo lentes". Sin marca visible para el supervisor; la distancia se sigue guardando.

#### Corregido

- Confirmar un "No se presentó" cuyo turno ya tenía su falta creaba una segunda falta: ahora confirma la existente y cierra el aviso. Migración `20261030030000_cerrar_no_se_presento_viejos`: cierra los "No se presentó" anteriores que ya pasaron a falta o cuyo guardia llegó (A-48).

#### Pendiente

- Probar con guardias que usan lentes y ajustar los márgenes con datos reales.
- Seguir con A-38 (portal del cliente con guardias).

### Sesión 2026-10-30 #33 — Óvalo punteado, confirmar falta y salida sin marcar con medida (A-47, A-48, A-49)

#### Añadido

- **Confirmar falta** (A-48): en una falta sin atender, además de "Justificar", el supervisor puede "Confirmar falta" con motivo de lista (no se presentó y no avisó, abandonó el servicio, otro con texto) y una medida disciplinaria opcional. `POST /api/bitacora/eventos/:id/confirmar-falta`. "Dejar la falta" (cuando el guardia llegó tarde) usa la misma ventana, así también queda el motivo. Migración `20261030020000_medidas_disciplinarias` (`bitacora_eventos.decision_motivo`).
- **Historial formal de medidas disciplinarias** (A-48, A-49): tabla `medidas_disciplinarias` (llamada de atención verbal o amonestación por escrito, con origen, motivo y quién la aplicó). Cada medida también queda en la bitácora (tipo `medida_disciplinaria`) y se avisa al guardia. `GET /api/bitacora/guardias/:id/medidas` y tarjeta "Medidas disciplinarias" en el perfil del guardia.
- **Salida sin marcar** (A-49): al cerrar una jornada el motivo es de lista (se le olvidó, falla del teléfono, no pudo marcar, otro con texto) y se puede aplicar una medida. Cuenta como salida sin marcar del guardia; al llegar a 3 en el mes el sistema sugiere una amonestación (aviso al cerrar). La respuesta de `POST /api/asistencia/jornadas/:id/cerrar` ahora trae `salidasSinMarcarMes`.

#### Cambiado

- Óvalo de la cámara **punteado** (verde al centrar) en el checador y en el registro de rostro (A-47). Las dos pantallas usan el mismo componente: si el registro se vio con el estilo viejo (sin fondo oscuro), era la versión anterior guardada en el celular; basta cerrar y abrir la app.
- "No se presentó" también tiene **Confirmar falta**: crea la falta en ese momento (sin esperar las 2 h), la liga al turno para que no se genere otra y cierra el aviso. Es definitiva: si el guardia llega después, la falta confirmada se queda.
- Justificar ahora pide el motivo de una lista (permiso, enfermedad, avisó antes, transporte, otro con texto) en lugar de texto libre (A-48). El cuerpo de `justificar` cambió de `{ motivo }` a `{ categoria, nota }`.
- El aviso "No se presentó" se cierra solo cuando el turno pasa a falta o el guardia llega, y deja de contar aparte (A-48).

#### Pendiente

- Probar en el celular el óvalo punteado y, en escritorio, confirmar falta y cerrar jornada con medida.
- Preguntar si los guardias que usan lentes deben seguir quitándoselos para el checador.

### Sesión 2026-10-30 #32 — Cámara de asistencia: centrado, óvalo y gesto de 15 s (A-36, A-37)

#### Cambiado

- Óvalo más alto y angosto (78 % del alto, proporción 0.72), con borde sólido y grueso, y el exterior en negro semitransparente para que resalte dónde poner la cara. La revisión del encuadre usa el mismo óvalo, así que pide estar un poco más cerca (A-36).
- Proceso de centrado (A-37): el borde del óvalo se pone **verde** cuando la cara queda dentro; con todo bien se pide quedarse quieto 2 s ("No te muevas, mira al frente") y solo entonces aparece el gesto. Antes eran 1 s y arrancaba directo.
- El gesto dura **15 s** (antes 6 s); la barra de tiempo usa el mismo valor.
- Menos mensajes: mientras el encuadre está mal solo sale "Centra tu cara y mira al frente"; el detalle ("Acércate", "Aléjate", "Mira de frente"…) aparece si el problema dura 3 s. Se agrega "Pon tu cara aquí" dentro del óvalo hasta que la cara esté ubicada. El aviso de subir o bajar el teléfono se mantiene.
- Instrucciones un poco más grandes: texto del panel de `text-sm` a `text-base`, tarjeta del gesto más ancha con `text-2xl`, avisos del teléfono y "¡Listo!" en `text-lg` (A-36).

#### Pendiente

- Probar con guardias reales, sobre todo los que batallan: si el encuadre resulta estricto, se ajustan los topes de `evaluarEncuadre` (0.55 a 1.05 de la altura del óvalo) y `ESTABLE_MS`.
- No se verificó visualmente (la cámara necesita un celular real).

### Sesión 2026-10-30 #31 — Etiqueta de Asistencia, fines de semana, motivo obligatorio y cambiar o cancelar el plan (A-33 a A-35, A-45, A-46)

#### Añadido

- Motivo obligatorio (A-35). El guardia que toca "No puedo quedarme" elige un motivo de una lista (otro compromiso, salud, cansancio, no tengo cómo regresar, urgencia familiar u otro) y con "otro" debe explicarlo; el supervisor, al dejar el plan de un caso de cobertura, elige el suyo (relevo no llegó, falta de personal, necesidad del cliente, emergencia u otro). Sin motivo el servidor responde 400. El motivo queda en el caso, en la bitácora del guardia, en la auditoría (`casos_cobertura.no_puede_quedarse`) y en los avisos a ambos.
- Cuando el guardia dice que no puede quedarse, el supervisor recibe "No puede quedarse: elige quién cubre" con el motivo; en Casos de cobertura el caso muestra el motivo y el plan se abre ya en "Mando a otro guardia". Solo se puede avisar una vez y no si el plan ya está dejado (409).
- Migración `20261030000000_motivos_cobertura`: `casos_cobertura.motivo` y `horas_extra.no_puede_en / no_puede_motivo / no_puede_nota`.

- Cancelar o cambiar un plan de cobertura ya confirmado (A-45), solo mientras el guardia sigue con sus horas extra abiertas. `POST /api/casos-cobertura/:entradaId/cancelar` (motivo obligatorio: el relevo ya llegó, me equivoqué, cambió la situación u otro) y `POST /api/casos-cobertura/:entradaId/cambiar` (mismo cuerpo que resolver, con el motivo del cambio). Se deshace lo que creó el plan: se cancelan sus coberturas (avisando a quienes las tenían), se quitan los descansos en pausa y el caso vuelve a "Sin decidir"; el guardia recibe "Plan cancelado: quédate en tu puesto". Queda en la bitácora y la auditoría (`casos_cobertura.cancelar` / `.cambiar`). En Casos de cobertura, los casos confirmados muestran "Cambiar plan" y "Cancelar plan". Migración `20261030010000_plan_coberturas` (`casos_cobertura.coberturas_ids`); los planes anteriores a ella solo deshacen la primera cobertura y los descansos.
- Nota opcional al quedarse (A-46): en "¿Sigues en turno?" el guardia puede escribir algo para su supervisor (p. ej. "no puedo quedarme mucho tiempo"). Queda como motivo de las horas extra, en la bitácora y en el aviso "Pidió extender su horario".

#### Cambiado

- Calendario de cobertura (A-34): en un sitio con turnos de lunes a viernes (días de la semana), sábado y domingo salen "Sin turno" y no "Sin cubrir". Los ciclos (24x24, 12x12) y los turnos diarios siguen exigiendo cobertura todos los días.
- La etiqueta azul del horario del guardia en Asistencia (`HoraMarca`) baja de línea en el celular en vez de cortarse (A-33).
- El botón "No puedo quedarme" se queda: se descartó quitarlo.

#### Pendiente

- Probar en el celular la etiqueta de A-33, la ventana de motivo de A-35 y cancelar/cambiar plan de A-45.
- Sigue el plan de [docs/PLAN.md](docs/PLAN.md), "Orden de ejecución": A-36 en adelante.
- Subir al servidor: requiere `docker compose exec api npm run db:deploy` tras el build.

### Sesión 2026-10-29 #30 — Observaciones del primer guardia: rostro, calendario, acceso del cliente, avisos y rutas (A-26 a A-32)

#### Añadido

- Acceso del cliente: en la ficha, "Acceso a la intranet" (solo admin). `POST /api/clientes/:id/accesos` crea el usuario con rol cliente ligado al cliente, con contraseña temporal y mensaje para copiar; si el correo ya es de un usuario cliente sin cliente, lo liga. Máximo 2 usuarios activos por cliente (`MAX_ACCESOS_CLIENTE`). Su correo queda como contacto que recibe notificaciones. `ClienteDetalle.accesos` (A-29).

#### Cambiado

- Avisos de reportes: `PUT /api/clientes/:id/avisos` es solo para admin; el supervisor ve la pantalla con los campos bloqueados ("Ver") (A-30).
- Incidencia de rostro: el botón "Revisar y atender" es visible y aclara que una nota no la cierra; el aviso de arriba detalla qué falta por atender (A-27).
- Calendario de cobertura: en turnos largos la ventana para ligar la entrada al turno crece a la mitad del turno, así un guardia de 24 h que llega 9 h tarde ya no sale "Sin registro" (A-28).

- Al marcar una incidencia de rostro como falsa alarma o confirmada, una ventana explica qué significa y qué pasará (se cierra, queda en verde o rojo en el historial, no se deshace), y al terminar el aviso lo dice (A-31).

- Recordatorio a los 30 min (A-26): si mandaron a casa a un guardia y el sitio sigue sin ningún guardia, se avisa una sola vez al supervisor y a los admin ("El sitio sigue sin guardia", con ruta al calendario del sitio) y queda en la bitácora. Corre dentro de la vigilancia de cada minuto (`RecordatorioSitioSolo`).
- Cada aviso lleva a donde está lo que indica (A-32): "Te mandaron a casa", "Cerraron tu jornada" y "Retardo aceptado" van al historial de marcas del guardia; los avisos de sitios, grupos, horarios y coberturas del guardia van a Mis sitios (antes al inicio o al checador). La push usa la misma ruta. Una incidencia que ya no existe muestra un mensaje en vez de una pantalla vacía.

- Acceso del cliente, ajuste tras probarlo en el servidor: el modal permite elegir de una lista solo a usuarios con rol Cliente sin cliente asignado (`GET /api/clientes/:id/accesos/disponibles`) o crear uno nuevo; un correo que ya existe ya no se liga escribiéndolo, y antes de crear o ligar sale una ventana que explica a qué cliente quedará ligado ese correo (A-29).

#### Pendiente

- A-26: falta la lista formal de solicitudes de cobertura para que el admin las resuelva (necesita tabla y migración).
- Sin migración nueva (`Usuario.clienteId` ya existía). Siguen pendientes A-26 (recordatorio y lista formal), subir A-21 a A-30 al servidor y la migración de A-22.

### Sesión 2026-10-29 #29 — Celular sin zoom, retardo justificado y decisiones ante un retardo (A-23 a A-26)

#### Añadido

- Ante un retardo sin atender, el supervisor elige: **Justificar**, **Aceptar con retardo** (el guardia se queda y el retardo sigue contando, ya atendido) o **Mandar a casa** (solo si el guardia sigue en el sitio: cierra su jornada, cuenta como falta y sus horas no cuentan). `POST /api/asistencia/retardos/:id/decidir`, bloque `DecisionRetardo` en la bitácora y las incidencias (A-25).
- Mandar a casa pide motivo, explica las consecuencias y avisa al guardia ("Te mandaron a casa"). Si el sitio quedaría sin otro guardia, el servidor responde `SITIO_QUEDARIA_SOLO` y la ventana pide elegir: se queda solo bajo su responsabilidad, mandará a alguien de sus guardias, o necesita un guardia de otro supervisor. En los tres casos se avisa a los admin ("Sitio sin guardia" / "Solicitud de cobertura", con ruta al calendario) y queda en la bitácora del sitio (A-25, A-26 parcial).
- El reporte trata un retardo "mandado a casa" como falta sin horas; la alerta nueva `enviada_a_casa` muestra "Mandado a casa" en la lista del día.

#### Cambiado

- Un retardo o salida anticipada justificado ya no aparece como pendiente: `Jornada.justificadas`; la lista del día, la tarjeta de jornada y las horas muestran "justificado" (A-24).
- La etiqueta de hora programada en Asistencia se acomoda en varias líneas y dice "9 h 19 min tarde" en vez de "+549 min", para que no ensanche la pantalla del celular (A-23).
- Sin zoom de pellizco ni de doble toque en la app (viewport bloqueado y `touch-action`); las fotos siguen con su visor y su zoom. El cuerpo de los modales no crece a lo ancho (A-23).

#### Pendiente

- A-26: recordatorio a los 30 min si nadie llega y lista formal de solicitudes para que el admin las resuelva (hoy la solicitud es un aviso al admin; la cobertura se crea con el calendario de siempre).
- Sin migración nueva en esta sesión (la de A-22 sigue pendiente de `db:deploy` en el servidor).

### Sesión 2026-10-28 #28 — Título propio en cada aviso (A-22)

#### Cambiado

- Cada aviso de la campanita y cada notificación push lleva un título propio y coherente con su mensaje, en vez de uno genérico por tipo (antes un supervisor nuevo recibía "Tu sitio y horario"). Columna nueva `avisos.titulo` (migración `20261028020000_avisos_titulo`); los avisos anteriores, sin título propio, siguen mostrando el genérico de su tipo.
- Títulos asignados en todos los puntos que crean avisos: asignaciones y supervisión de sitios, turnos, grupos, cambios de turno, coberturas, casos de cobertura, horas extra, asistencia (retardos, marcas, comidas, rostros) y reportes. Se distingue lo que recibe el guardia de lo que recibe el supervisor.
- `tituloDeAviso(tipo, titulo)` en `@platinum/shared`; `Aviso.titulo` siempre viene lleno.

### Sesión 2026-10-28 #27 — Push obligatorio (A-21)

#### Cambiado

- Las notificaciones push ya no se pueden desactivar desde la app: se quitó el interruptor de la campanita. Si el celular no las tiene activas, la app muestra un aviso que no se puede cerrar (`ExigirPush`) con "Activar notificaciones" o, si el navegador las bloqueó, los pasos para permitirlas; al volver de los permisos se revisa solo. Queda "Cerrar sesión" para celulares compartidos. Si el navegador o el servidor no admiten push (iPhone sin instalar, servidor sin claves) no se pide nada.
- `Modal` acepta `cerrable={false}` (sin botón de cerrar ni Escape).
- La notificación lleva ícono monocromático para la barra de estado (`public/push-badge.png`), vibración y botón "Ver".
- Sin cambios en la API: la ruta para quitar una suscripción sigue existiendo, pero la app ya no la usa.

### Sesión 2026-10-28 #26 — Notificaciones push (A-20, DA-59)

#### Añadido

- Notificaciones push: cada aviso de la campanita llega también al celular aunque la app esté cerrada o el teléfono bloqueado. Módulo `push` (tabla `suscripciones_push`, `GET /api/push/clave`, `POST` y `DELETE /api/push/suscripciones`), enviado con Web Push (VAPID, librería `web-push`) desde los tres lugares donde se crean avisos.
- Interruptor "Activar / Desactivar" en la campanita; al tocar la notificación se abre la pantalla del aviso (`public/push-sw.js`, cargado por el service worker sin cambiar su caché ni el modo sin conexión).
- Variables `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; sin ellas el push queda apagado. Pasos en `docs/DESPLIEGUE.md`.

### Sesión 2026-10-28 #25 — Preparación del despliegue (F4-04, D-008b)

#### Añadido

- Carpeta `deploy/`: Docker Compose con MySQL 8.4, API, sitio web (nginx) y túnel propio de Cloudflare (`platinum`); `Dockerfile.api`, `Dockerfile.web`, `nginx.conf`, `cloudflared.yml` y `.env.example`. La IP real del visitante pasa a la API para que el límite de intentos de login no cuente a todos como una sola IP.
- `docs/DESPLIEGUE.md`: pasos de primera vez y de actualización.

#### Corregido

- Los Dockerfiles de la web y la API no copiaban `tsconfig.base.json`, y la construcción de la web fallaba.

#### Cambiado

- D-008b: en producción MySQL va en un contenedor del servidor de la oficina (no en otra máquina).

### Sesión 2026-10-28 #24 — Foco en las ventanas (experiencia de uso)

#### Corregido

- Al escribir en una ventana (p. ej. "Rechazar horas extra" y "Hora en que terminaron"), el campo perdía el foco con cada letra y había que volver a tocarlo. La ventana (`Modal`) devolvía el foco al botón de atrás cada vez que la pantalla se redibujaba; ahora no reacciona a eso. Corrige a la vez las ~49 ventanas que usan `Modal`/`FormModal`.
- Al cerrar una ventana el foco vuelve al botón que la abrió, aunque un campo con `autoFocus` lo hubiera tomado al abrir.

### Sesión 2026-10-28 #23 — Hora límite en el plan de cobertura (A-19, DA-58)

#### Añadido

- El plan "No llegará" pide **hasta qué hora se queda** el guardia (propone el fin del turno del relevo; si ya pasó, hay que elegir otra, y el servidor no deja guardar una hora pasada).
- Pasada esa hora sin salida: aviso en la campanita al guardia y al supervisor (una sola vez) y aviso rojo en el Checador ("Marca tu salida y retírate").

#### Cambiado

- Las horas extra del plan se aprueban solas **solo hasta esa hora**; lo que se pase (más de 10 min) se registra aparte como horas extra por aprobar. No se marca la salida por el guardia.
- Textos del plan del guardia: "Te quedas hasta las X; a esa hora marca tu salida y retírate".

### Sesión 2026-10-27 #22 — Un solo cálculo de huecos (A-17)

#### Cambiado

- Bitácora del guardia: "Comentar" ahora es "Agregar nota" (con aviso de que la nota no cambia el evento y de que Justificar sí). Una nota ya no saca una incidencia de "Sin atender" si se puede justificar; solo justificar la saca. Las que no se pueden justificar (rachas) siguen saliendo con una nota.
- Etiqueta de entrada con retardo: muestra el total y los minutos fuera de tolerancia ("+13 min (+3 fuera de tolerancia)").

#### Corregido

- El cuadro "Próximos 7 días" de la ventana de turnos del sitio medía contra las 24 h del día y marcaba "Sin cubrir" aunque el turno (p. ej. 1 h) estuviera cubierto. Ahora usa el mismo cálculo que el calendario de cobertura (estado por turno, guardias y enlace "Ver calendario"), así que ambas pantallas coinciden.

### Sesión 2026-10-27 #21 — Turnos en el menú y borrado con reemplazo (A-18, DA-57)

#### Añadido

- **Turnos** como entrada del menú para admin y supervisor (`/catalogos/turnos`); se quita la pestaña de Catálogos y el subtítulo dice que ahí se crean y editan los horarios y que en cada sitio solo se elige cuál usa. Enlace "Administrar turnos" en la ventana de turnos de cada sitio.
- **Borrar un turno** (admin y supervisor): `GET /api/turnos/:id/uso` dice a qué sitios está asignado; `DELETE /api/turnos/:id` con `reemplazos` por sitio. Sin asignaciones se borra directo; si está asignado hay que elegir el turno nuevo de cada sitio activo (los guardias pasan a él y se les avisa); los sitios de baja no lo necesitan. El supervisor solo cambia sus sitios (si lo usa un sitio activo de otro supervisor, lo borra el admin).
- 6 pruebas nuevas (351 en total).

#### Cambiado

- Antes solo el admin borraba un turno (aunque estuviera asignado, dejando a los guardias con su copia del horario); ahora todos piden turno nuevo para los sitios activos.

### Sesión 2026-10-27 #20 — Caso de cobertura, descanso por patrón y sin falta en horas extra (DA-56, AS6-05..AS6-08)

#### Añadido

- **Caso de cobertura** (módulo `casos-cobertura`, `/api/casos-cobertura`, tabla `casos_cobertura`, migración `20261027030000_casos_cobertura`): cuando un guardia sigue en el sitio porque su relevo no llegó (o dijo que sigue en turno), el supervisor (o el admin) deja el plan completo desde el inicio en Asistencia → **Casos de cobertura**: (1) el relevo viene en camino (se vuelve a preguntar a las 2 h), no llegará (el guardia cubre ese turno) o se manda a otro guardia; (2) si el guardia cubre, su siguiente turno lo trabaja normal o descansa; (3) quién cubre el hueco (sin elegir a nadie el sitio queda en rojo en el calendario). Con "no llegará" sus horas extra se aprueban solas al marcar su salida (hasta donde empieza su turno normal) y el plan queda en auditoría, bitácora y avisos (campanita) a supervisor y guardia.
- **Descanso por patrón** (`plan.ts`): regresa = fin de lo que cubre + el descanso del patrón (24 h en 24x24, 12 h en 12x12…) + lo que agregue el supervisor (solo agregar); si regresa a la mitad de un turno entra tarde y termina a la hora original (no se recorre); sus turnos saltados quedan en pausa y el hueco se cubre con una cobertura. Aviso de cansancio al supervisor (más de 16 h seguidas).
- **Sin falta ni retardo en horas extra (AS6-07)**: la vigilancia no marca "no se presentó" ni falta a quien seguía en su jornada cuando empezó su turno siguiente; el tablero muestra una sola tarjeta por guardia ("Sigue en turno… horas extra") con "Plan de cobertura" y "Cerrar jornada"; su entrada al venir de horas extra no cuenta como retardo (alerta `viene_de_horas_extra`); el calendario lo cuenta como presente.
- **Plan de hoy (AS6-08)**: el guardia ve en el Checador hasta cuándo cubre, qué pasa con su siguiente turno y cuándo se presenta; botón "No puedo quedarme" (avisa al supervisor).
- 34 pruebas nuevas (345 en total).

#### Límites conocidos

- El relevo ausente se detecta por la vigilancia de turnos (turno sin entrada con "no se presentó"); si el guardia solo dice que sigue en turno y no hay relevo registrado, el caso aparece en la lista sin relevo y el supervisor decide.
- "Descansa" solo lo ve la vigilancia y el calendario a partir de las pausas del plan; el reporte oficial no cambia.
- El plan no se puede editar una vez confirmado (hay que cancelar las coberturas desde Coberturas).

### Sesión 2026-10-27 #19 — Calendario de cobertura (DA-56, AS6-01..AS6-04)

#### Añadido

- Módulo `cobertura` (`GET /api/cobertura` por sitio y `GET /api/cobertura/resumen` de todos, máx. 62 días; admin y supervisor, este solo en sus sitios): por día y turno del sitio (misma hora y duración) indica quién cubre y el estado: cubierto, cobertura, con horas extra, sin cubrir (sin asignar, no se presentó o falta), sin registro o sin turno. Días pasados con lo que realmente pasó (entradas, faltas, horas extra); futuros con lo planeado (patrón, descansos movidos, coberturas). Un turno que terminó ya no se exige.
- Web: **Asistencia → Calendario** (`/asistencia/calendario`): mes por sitio con una línea por turno, "Solo huecos" y detalle del día (bottom-sheet en celular); vista **Todos los sitios** (próximos 14 días, un renglón por sitio). El botón Calendario muestra los turnos sin cubrir. Desde un hueco, "Asignar quién cubre" abre el flujo de cubrir existente con el día, la hora y el guardia que faltó ya puestos, y el calendario se actualiza.
- Aviso al supervisor (campanita, tipo nuevo `cobertura`, migración `20261027020000_aviso_cobertura`) con los turnos sin cubrir de los próximos 7 días: una vez al día por sitio, con enlace al día en el calendario; sin supervisor, al admin.
- Esquemas compartidos `cobertura.ts` y `duracionPatronMin`. 25 pruebas nuevas (306 en total tras AS6-01, 311 ahora).

#### Notas

- Con datos reales (solo lectura) ya muestra la contradicción de "falta" en el turno siguiente de un guardia con turno de 24 h y horas extra; se resuelve en AS6-05 a AS6-07.
- Un sitio con turno parcial (p. ej. solo lunes a viernes) marca "sin cubrir" los demás días, igual que el calendario de 7 días del sitio.

### Sesión 2026-10-27 #18 — Horas extra (DA-55, AS5-01..AS5-05)

#### Añadido

- Tabla `horas_extra` (misma BD; no toca las jornadas ni el reporte oficial) y marca `salida_extra` (salida final). Módulo `horas-extra` (`/api/horas-extra`): lista con contador de pendientes, aprobar, rechazar con motivo, fijar la hora de salida, captura manual del supervisor y reporte por guardia y periodo.
- Qué cuenta: salida más de 15 min tarde, jornada sin salida, el guardia que dice que sigue en turno (botón "Extender mi horario", con salida final si ya había marcado) y trabajo en día de descanso (un descanso movido con cambio de turno aprobado no cuenta). Solo horas, sin tarifas. Nada cuenta sin aprobación.
- Vigilancia cada minuto: abre el registro a la hora de salida + 15 min, lo marca "sin salida" pasado el límite de la jornada y sube el aviso a los admins si el supervisor no responde en 12 h.
- Todo en auditoría, en la bitácora del guardia (solo admin y supervisor) y con avisos en la campanita a ambos lados.
- Web: pregunta "¿Sigues en turno?" y botón "Extender mi horario" en Checador; sección Horas extra (Por aprobar, Todas, Reporte) con contador en Asistencia.
- Migración `20261027010000_horas_extra`. 24 pruebas nuevas.

#### Límites conocidos

- Si el guardia marca su salida normal, se queda y nunca abre la app, el sistema no se entera: el respaldo es la captura manual del supervisor.
- Extender el horario requiere conexión. Sin exportación a Excel del reporte de horas extra todavía.

### Sesión 2026-10-26 #17 — Cambios de turno (DA-54, TC-22)

#### Añadido

- Módulo `cambios` (`/api/cambios-turno`): el guardia pide, el supervisor aprueba (o hace el cambio directo); tipos cubrir y mover descanso, con motivo; cancelar y deshacer; avisos y bitácora. Tablas `cambios_turno` y `pausas_turno`.
- Las pausas por cambio de turno las respetan vigilancia (faltas), tablero, reporte oficial, candidatos de cobertura y el próximo turno del guardia.
- Web: "Cambios de turno" (por aprobar / todos) en Asistencia, con contador; sección y botón "Solicitar" en Mis sitios del guardia.

### Sesión 2026-10-26 #16 — Checar sin señal y app instalable (DA-53, AS2-01..AS2-04, F4-01)

#### Añadido

- PWA con `vite-plugin-pwa`: manifest, iconos, service worker; los modelos de reconocimiento se guardan al abrir el Checador.
- Cola de checadas sin conexión en IndexedDB (`core/offline`), envío automático en orden y sin duplicados, aviso "Sin conexión" y "Pendiente de enviar", y qué sigue calculado en el celular.
- Reloj corregido con la hora del servidor; la marca guarda hora del celular, de recepción y desfase (`recibida_en`, `hora_celular`, `desfase_seg`) y alertas `enviada_sin_conexion` / `hora_desfasada`.
- Sin conexión, lo no corregible (lejos, GPS débil, rostro dudoso) se registra con alerta; el servidor verifica el rostro al recibir.
- El guardia abre la app sin señal con su perfil guardado.

### Sesión 2026-10-26 #15 — Reporte oficial de asistencia (DA-52, TC-42)

#### Añadido

- Reporte de asistencia personal y general (periodo libre ≤ 31 días), congelado con folio `ASIS-AAAA-NNNNNN`, huella SHA-256, QR y verificación pública `/verificar/:folio`; reemplazo por folio nuevo e idempotencia por huella (`apps/api/src/modules/informes`, tabla `informes_asistencia`).
- PDF oficial corporativo (pdfkit) y Excel de trabajo no oficial (exceljs); dependencias `pdfkit`, `qrcode`, `exceljs`.
- Web: "Reportes emitidos" (tabla de solo lectura con columna Acciones: Ver · PDF · Excel), "Nuevo reporte", vista del reporte congelado, página pública de verificación, botón "Reporte" y sección en la ficha del guardia. `DataTable` acepta `actionsHeader`; `ApiClient.blob` para descargas con sesión.

#### Notas

- `npm audit`: `uuid@8.3.2` (moderado) llega por exceljs; solo afecta a `v3/v5/v6` con búfer, que no se usan.

### Sesión 2026-10-23 / 2026-10-26 #14 — Reportes, Relevo de Consignas y Portal de Clientes (REP-01..REP-09, P-05, DA-47, DA-48)

Detalle en [REPORTES.md](docs/REPORTES.md) y [DECISIONES.md](docs/DECISIONES.md).

#### Añadido

- **Fase 1 (REP-01):** Claridad en horario programado de asistencia: etiquetas "Entra a las <hora>" y "Sale a las <hora>" en `HoraMarca.tsx`.
- **Fase 2 (REP-02..REP-05):**
  - Comprobante visual oficial tras enviar reporte con folio, primera foto, sitio, prioridad y hora de servidor (`NuevoReportePage.tsx`).
  - Rediseño de ficha oficial de reporte en 2 columnas (7/12 ficha/evidencias y 5/12 seguimiento), semáforo de prioridad y visor modal de alta resolución (`ReporteDetallePage.tsx`, `Galeria.tsx`).
  - Hilo de seguimiento bidireccional con invalidación en tiempo real y campanita de avisos.
  - Pestañas del guardia ("Mis reportes" vs "Del sitio: [Nombre]"), banner de sitio con enlace directo y píldoras rápidas de estatus en `ReportesPage.tsx`.
  - Supervisor / Admin: columna "Reportó" y filtro por usuario creador en `/reportes`.
- **Fase 3 (REP-06 / DA-46):** Coberturas en selector de sitios y visibilidad: guardias con cobertura activa hoy pueden reportar en el sitio cubierto sin fallas de autorización.
- **Fase 4 (REP-07, REP-08):**
  - Verificación interactiva de relevo de 3 activos críticos (**Celular del sitio**, **Llaves** y **Teléfono fijo**) al checar entrada y salida con `RelevoTurnoModal.tsx`.
  - Detección de novedades: descripción obligatoria y uploader de evidencias fotográficas, levantando reporte automático de alta prioridad.
  - Resumen visual en entrada con novedades del turno saliente y exclusión de auto-reportes.
  - Apertura ágil directa de la cámara biométrica tras verificación conforme.
- **Fase 5 (REP-09 / P-05 / DA-48 Portal de Clientes):**
  - Rol `cliente` dotado con permisos granulares `[reportes.ver_propios, reportes.seguimiento, asistencia.ver]`.
  - Alcance multi-inquilino en backend filtrado por `clienteId` en reportes y asistencia de sus sitios y guardias asignados.
  - Hilo de comentarios y subida de fotografías de seguimiento para clientes en sus reportes.
  - Monitoreo ejecutivo de asistencia (`/asistencia`) para clientes: avatar/foto oficial del guardia, hora programada vs real, retardo en píldora (`+X min`), desglose compacto de comidas (`1ª`, `2ª` y `en curso`), salida y horas trabajadas.
  - Blindaje y privacidad: ocultamiento de incidencias de fraude biométrico, bitácora disciplinaria y modal de registro facial de 5 fotos.
  - Notificaciones en tiempo real en la campanita (`🔔`) y contador numérico en badge rojo.
- **Control de comidas (DA-47):** Contador de comidas adaptado a turnos de 24 h (hasta 2 comidas), validación de jornada activa y nomenclatura compacta `[1ª]` / `[2ª]`.
- **Registro facial ágil (DA-44):** Captura automática de las 5 tomas de autoregistro al mantener la pose estable durante 1 s (`calidad.armado`), sin requerir parpadeo forzado.

#### Añadido (2026-10-26)

- **Inicio por rol y "Mis sitios"** (DA-51): el guardia entra directo al Checador (con saludo) y tiene la pestaña "Mis sitios"; admin y supervisor, un tablero del día con lo que necesita atención (sin llegar, sin salida, comidas sin cierre, incidencias y reportes abiertos); el cliente, un resumen de sus reportes y guardias. Se quitan la pantalla de componentes (`/ui`) y "Estado del sistema".
- **Cerrar la jornada de un guardia** (DA-49): admin o supervisor registran su salida con motivo y hora cuando no pudo checarla; queda marcada, en auditoría y bitácora, y se le avisa al guardia.
- **Borrar definitivamente sitios y clientes** (DA-50, solo admin): con el historial que se perdería y confirmación escrita; el diálogo de usuarios usa ahora el mismo componente. Verificado contra MySQL real con una transacción revertida.

#### Corregido (revisión de Claude, 2026-10-26)

- **Seguridad del portal de clientes:** la bitácora disciplinaria quedó solo para admin y supervisor (el cliente podía leerla y justificar faltas); la asistencia del día y la ficha del guardia ya no entregan al cliente alertas biométricas, resultado del reconocimiento ni el rostro registrado, ni jornadas o sitios de otros clientes (antes solo se escondían en la pantalla).
- **Salida y comidas (DA-47):** para checar salida hay que iniciar y terminar la comida (dos en turnos de 24 h); antes se podía salir sin haber comido o con la comida abierta.
- Recordatorios de comida (DA-47): aviso al guardia a la mitad del turno y al vencer su hora con ventana "Regresar de comer", aviso al supervisor a los 90 min y si no registró comida.

#### Corregido

- Base de datos: sincronización de matriz de permisos para el rol `cliente` (`npm run db:seed`) para habilitar acceso a `/asistencia` y `/reportes`.
- Consejos de cámara: se respeta la preferencia "No volver a mostrar en este dispositivo" para `ConsejosCamara.tsx`.

#### Verificado

- `npm test`: 219 de 219 pruebas pasando en Vitest.
- `npm run typecheck`: 0 errores de TypeScript en todos los paquetes.
- `npm run lint`: 0 advertencias o errores.

### Sesión 2026-10-22 #13 — Control de asistencia (A-17), fases 1 y 1B

Detalle de decisiones en [ASISTENCIA.md](docs/ASISTENCIA.md) (DA-28 a DA-46).

#### Añadido

- **Cámara y rostro** (AS1-08..AS1-15, DA-28..DA-31, DA-43, DA-44): verificación en vivo del titular, gestos al azar, detector de pantalla o foto, registro de 5 fotos guiado con flechas, cámara compacta para teléfonos de gama baja, guía "Cómo sostener el teléfono", teléfono abajo/arriba (sensor de inclinación y respaldo por la cara), lentes obligatorio con "No traigo lentes" (alerta en la checada), cara oscura u ojos que no se distinguen, bienvenida para registrar el rostro la primera vez. "Marcar" pasa a **Checador**.
- **Incidencias de rostro** con foto, revisión y conclusión (falsa alarma / confirmada).
- **GPS obligatorio** para entrada y salida con radio por sitio (DA-36).
- **Catálogo de turnos** con horarios libres (horas y días), cobertura del sitio con asignación en lote, grupos y calendario (DA-37).
- **Avisos lógicos** de retardo, salida anticipada, comida fuera y patrones de 3 seguidos (DA-33).
- **Bitácora del guardia** (DA-41, DA-42): todo lo que le pasa; comentar y justificar; incidencias = asistencia + rostro; pantalla "Incidencias" por guardia y general; ficha del guardia de escritorio con resumen del mes; el Estado de cada jornada abre sus incidencias.
- **Supervisor por sitio** (DA-45, TC-38, TC-39): recibe los avisos de su sitio y solo ve sus sitios y guardias.
- **Turnos sin entrada** (TC-11..TC-14, TC-40, TC-41): aviso al guardia a los 5 min, "no se presentó" al supervisor a los 15 min, falta a las 2 h; si llega después el supervisor acepta la asistencia o deja la falta; la asistencia del día muestra solo a quien le tocaba; la entrada se registra en el sitio del turno que le toca.
- **Cubrir otro sitio** (DA-39, DA-46, TC-15..TC-18): "Enviar a cubrir" desde una falta o desde el sitio, motivo obligatorio, quién descansa primero, advertencia si descansa menos de 12 h; su sitio queda en pausa; etiqueta "Cobertura".
- **Para el guardia** (DA-40, TC-19, TC-20): ventana "Tu turno empieza a las…" con distancia GPS en vivo y tarjeta "En turno" / "Descansas hoy, tu próximo turno…".

#### Verificado

- `npm test` 208/208; capturas a 360 px y 1440 px.

### Sesión 2026-10-20 #12

#### Añadido

- Página de inicio de la API (`GET /` y `GET /api`): confirma que está en línea y lista los módulos (antes respondía "Ruta no encontrada" y parecía caída).
- Opción `allowPublicKeyRetrieval=true` en `DATABASE_URL` (MySQL 8 local sin SSL); documentada en `.env.example`.

#### Corregido

- Login fallaba con "No se pudo iniciar sesión" tras reiniciar la PC: MySQL 8 (`caching_sha2_password`) exige la llave pública en la primera conexión sin SSL y el pool no podía conectarse.

#### Verificado

- `npm test` 94/94; login de admin a través de la web contra MySQL.

### Sesión 2026-10-20 #12

#### Añadido

- **F0-10** Constructor de BD local `npm run db:setup` (`apps/api/prisma/setup.ts`): crea `apps/api/.env` (secretos JWT aleatorios, `--url` como `DATABASE_URL`, contraseña de admin generada si falta) y `apps/web/.env`, crea la base utf8mb4 si no existe, aplica migraciones y seed. `--reset` borra y recrea la base (solo MySQL local). Mensajes de ayuda para MySQL apagado, credenciales y `allowPublicKeyRetrieval`. Probado en PC "nueva" (sin `.env`), con `--reset` y en re-ejecución.

#### Cambiado

- README: "Arranque rápido" usa `npm run db:setup` para que otro desarrollador monte el proyecto en su PC.

### Sesión 2026-10-14 #11

#### Añadido

- **F2-06** Grupos de guardias: tablas `grupos_guardias` y `grupo_integrantes`, API `/api/grupos` (lista, alta con integrantes, edición, integrantes, baja que termina sus asignaciones, reactivación) y pantalla `/grupos` (menú "Grupos"). Permiso nuevo `grupos.administrar` (supervisor y admin).
- **F2-07** Asignaciones a grupo o a guardia, tipo fija / temporal / eventual (con horario): columnas `grupo_id`, `tipo`, `hora_inicio`, `hora_fin`, `vigente_hasta` en `sitio_guardia` (migración escrita a mano; datos existentes convertidos). Nuevo formulario de asignación en la ficha del cliente; "Mis sitios" muestra tipo, horario y grupo.
- `LOGIN_RATE_LIMIT` configurable (30 por defecto; más alto solo en desarrollo).

#### Cambiado

- La visibilidad del guardia (Mis sitios, sitios para reportar y reportes) incluye las asignaciones de sus grupos (`asignadaA`).
- La tarjeta del sitio cuenta "asignaciones" vigentes en lugar de guardias.

#### Verificado

- `npm test` 94/94, `lint`, `typecheck`, `format:check`, `build`.
- API contra MySQL: grupos y asignaciones (26), reportes (37).
- Edge headless: grupos (14), avisos (11), reportes (17), clientes (17), usuarios (22), login (11).

#### Decisiones

- D-017 grupos y tipos de asignación.

#### Tareas

- F2-06, F2-07 terminadas.

### Sesión 2026-10-13 #10

#### Añadido

- **F3-09** Reglas de aviso por cliente y prioridad (solo supervisor / solo cliente / ambos): columna `clientes.aviso_por_defecto`, tabla `cliente_reglas_aviso`, `PUT /api/clientes/:id/avisos`, tarjeta "Avisos de reportes" en la ficha con advertencia si ningún contacto puede recibir correo.
- **F3-10** Avisos en la app: tabla `avisos`, `/api/avisos` (bandeja, marcar leído, marcar todo) y campanita con contador en escritorio y celular. Al crear un reporte se avisa según la regla; el guardia recibe avisos de cambios de estatus y comentarios; los correos al cliente se encolan en `notificaciones` (pendiente).
- `NotificadorReportes` inyectable en `ReportesService`; `resolverDestino` compartido.

#### Decisiones

- D-003 resuelta (sin aprobación manual) y D-016 (a quién se avisa). P-06 descartada.

#### Verificado

- `npm test` 91/91, `lint`, `typecheck`, `format:check`, `build`.
- Edge headless contra MySQL: avisos (11), reportes (17), clientes (17), usuarios (22), login (11). En BD solo el reporte crítico encoló correo al cliente.

#### Tareas

- F3-09, F3-10 terminadas.

### Sesión 2026-10-13 #9

#### Añadido

- **F3-01** Categorías de reporte jerárquicas (2 niveles) con catálogo inicial en el seed (7 principales, 19 subcategorías), API `/api/categorias` y pantalla `/catalogos/categorias` (menú "Catálogos").
- **F3-02** Tablas `reportes`, `reporte_seguimientos`, `reporte_evidencias`, `notificaciones` y `folios_reporte` (migración `20261013020000_reportes`); folio `PLT-AAAA-NNNNNN` consecutivo y atómico.
- **F3-03** Fotos: compresión en el dispositivo, validación por firma de bytes, `StorageService` (disco local) y descarga con URL firmada en `/api/archivos/*`.
- **F3-04** Wizard móvil `/reportes/nuevo` (sitio → categoría → prioridad → fotos → detalle, GPS opcional) y botón "Nuevo reporte" en el inicio del guardia.
- **F3-05** Detalle `/reportes/:id` con galería, línea de tiempo y seguimiento (comentario, fotos, cambio de estatus con transiciones válidas).
- **F3-06** Listado `/reportes` con búsqueda por folio/título y filtros por estatus, prioridad, categoría, cliente, fechas (zona CDMX) y "solo míos".
- Permiso `reportes.estatus` (admin y supervisor). Núcleo: `tienePermiso`, `inicioDelDia`, `detectarImagen`, `firmarArchivo`/`verificarFirma`, `ARCHIVOS_URL_TTL_MIN`. Web: `formularioConFotos`, `Galeria`, badges de estatus/prioridad.
- README: sección "Cómo arrancar la app (día a día)".

#### Cambiado

- Helpers de esquemas compartidos (`textoOpcional`, `coordenada`, `fechaSchema`) movidos a `schemas/comunes.ts`.

#### Corregido

- Errores del wizard que seguían visibles tras corregir el campo; botón "Filtros" sin nombre accesible en celular.

#### Verificado

- `npm test` 81/81, `lint`, `typecheck`, `format:check`, `build`.
- API contra MySQL: 37 verificaciones (categorías, folio, fotos, URL firmada, visibilidad, transiciones, filtros).
- Edge headless: reportes (17), clientes (17), usuarios (22) y login (11); sin scroll horizontal a 360px.

#### Decisiones

- D-015 reportes y evidencias.

#### Tareas

- F3-01..F3-06 terminadas. F3-07/F3-08 bloqueadas (SMTP, D-003).

### Sesión 2026-10-13 #8

#### Añadido

- **F2-01** Tablas `clientes`, `cliente_contactos`, `sitios`, `sitio_guardia` y relación `usuarios.cliente_id` (migración `20261013010000_clientes_sitios`).
- **F2-02** API `/api/clientes` (lista con búsqueda, estatus y vigencia; ficha; alta, edición, baja y reactivación; RFC validado y único) y pantallas `/clientes` y `/clientes/:id`.
- **F2-03** Contactos 1..N por cliente con responsable, notificaciones (exigen correo) y prioridad.
- **F2-04** Sitios por cliente con dirección, referencias y coordenadas ("usar mi ubicación"); la baja termina las asignaciones vigentes.
- **F2-05** Asignación de guardias a sitios con turno y vigencia, sin cruces; `GET /api/sitios/mios` y tarjeta "Mis sitios" en el inicio del guardia.
- Núcleo API: `AccionCtx` + `audit.registrarAccion`, `BaseController.accionCtx(req)`, `calcularCambios`, `hoyISO`/`fechaADate`/`dateAFecha`, `APP_TIMEZONE`.
- Web: `useForm`, `FormModal`, `Checkbox`, `useDebounced`, `formatFecha`/`hoyLocal`, `mapsUrl`, `mensajeDeError`.

#### Cambiado

- Avisos (toasts) abajo a la derecha en escritorio para no tapar las acciones del encabezado.

#### Corregido

- `clienteUpdateSchema` ya no aplica el estatus por defecto en un PATCH parcial (reactivaba clientes suspendidos).
- Scroll horizontal a 360px en la ficha del cliente (`grid-cols-1` explícito).

#### Verificado

- `npm test` 68/68, `lint`, `typecheck`, `format:check`, `build`.
- API contra MySQL: 27 verificaciones de clientes, contactos, sitios y asignaciones.
- Edge headless contra MySQL: clientes (17), usuarios (22) y login (11) verificaciones; sin scroll horizontal a 360px en páginas y modales.

#### Decisiones

- D-014 modelo de clientes, sitios y asignaciones.

#### Tareas

- F2-01..F2-05 terminadas. **Fase 2 completa.**

### Sesión 2026-10-12 #7

#### Añadido

- **F0-09** MySQL 8 local de pruebas: BD `platinum_intranet`, migraciones y seed aplicados.
- **F1-01** Tablas `refresh_tokens`, `password_resets`, `auditoria` (migración `20261012230000_sesiones_auditoria`).
- **F1-02** API `/api/auth`: login, refresh rotativo (cookie httpOnly `platinum_rt`, token guardado como SHA-256, detección de reuso), logout; bloqueo tras 5 intentos (`LOGIN_MAX_INTENTOS`/`LOGIN_BLOQUEO_MIN`), límite por IP (`express-rate-limit`).
- Núcleo API: `AuditLogger`/`PrismaAuditLogger`, `requestContext`, `rateLimit`, `generateOpaqueToken`/`hashToken`, `hashPassword`/`verifyPassword`/`generateTemporaryPassword`, `authenticateAllowingTemporaryPassword`.
- **F1-03** Pantalla `/login` mobile-first (validación compartida, mostrar contraseña, mensajes por código de error) con `AuthLayout`.
- **F1-04** `AuthService` en la web: restaura la sesión al abrir, refresh automático ante 401, logout en servidor; `ProtectedRoute` acepta `roles`.
- **F1-07** API `/api/usuarios`: lista con búsqueda/rol/estado y paginación, alta, edición, protegida por permisos y auditada.
- **F1-08** Pantalla `/usuarios` (tabla/tarjetas, filtros) con modal de alta/edición y modal de contraseña temporal (copiar / mensaje para WhatsApp).
- **F1-09** Baja lógica y reactivación; la baja revoca las sesiones.
- **F1-10** Restablecer contraseña desde el modal: contraseña temporal, desbloqueo y cierre de sesiones (D-012).
- **F1-11** `/cambiar-password`: cambio propio y obligatorio con contraseña temporal; la API responde 403 `PASSWORD_CHANGE_REQUIRED` hasta cambiarla (columna `debe_cambiar_password`).
- Web: `PasswordInput`, `ConfirmDialog`, `erroresDeCampos`, `formatFechaHora`; tipos compartidos `SessionUser`, `AuthSession`, `Usuario`, esquemas de login, contraseña y usuarios.

#### Cambiado

- Se quitaron las sesiones demo por rol del login.
- `ApiError.fieldErrors` también lee errores por campo de respuestas 409.
- Migraciones con `--from-config-datasource` (Prisma 7 pide BD shadow para `--from-migrations`), D-011 actualizada.

#### Corregido

- La prueba de `getPrisma` sin `DATABASE_URL` ya no depende del `.env` de la máquina.

#### Verificado

- `npm test` 54/54, `lint`, `typecheck`, `format:check` y `build` sin errores.
- Pruebas en Edge headless (360px y 1440px) contra MySQL: login/refresh/logout (11 verificaciones) y gestión de usuarios con cambio obligatorio, reset, baja y reactivación (22 verificaciones).

#### Decisiones

- D-012 contraseña temporal sin SMTP; D-013 el access token vigente (máx. 15 min) no se revalida contra BD.

#### Tareas

- F0-09, F1-01, F1-02, F1-03, F1-04, F1-07, F1-08, F1-09, F1-10, F1-11 terminadas. Pendientes de Fase 1: F1-05/F1-06 (requieren SMTP).

### Sesión 2026-10-12 #6

#### Añadido

- **F0-05 Frontend core:** `ApiClient` (token Bearer, cookies, desenvuelve `{ ok, data }`, refresh único compartido ante 401), `ApiError` (`fieldErrors`), `CrudService` genérico con claves de TanStack Query, `queryClient`, `useAuthStore` (Zustand) con `hasPermission`, `ProtectedRoute` por permiso, router (React Router 7).
- **F0-06 Librería UI** (`components/ui`): Button, Input, Select, Textarea, FormField, Card, Badge, Spinner, EmptyState, Modal (bottom-sheet en celular), DataTable (tabla/tarjetas), Pagination, Toast, PhotoUploader (cámara trasera + galería). Catálogo en `/ui`.
- **F0-07 Layout responsive:** AppShell con Sidebar (escritorio), Topbar y BottomNav (celular), menú filtrado por permisos, páginas "en construcción" que indican las tareas del plan.
- Tailwind CSS 4 con tema Platinum (`brand-*`, `platinum-*`), utilidades `pb-safe`/`pt-safe`, favicon.
- Pantalla de login provisional con sesiones demo por rol (solo desarrollo; se reemplaza en F1-03).
- **F0-08** `README.md` de arranque.

#### Corregido

- Al cerrar sesión, el siguiente usuario ya no aterriza en la última página del anterior (`logout()` vs `clear()`).
- Pie del modal sin margen inferior en escritorio; recuadros de fotos demasiado grandes en pantallas anchas.

#### Verificado

- Capturas reales en Edge headless a 360px y 1440px: login, inicio (API en línea vía proxy), catálogo UI, modal; sin scroll horizontal; guardia solo ve Inicio/Reportes; sin errores de consola.
- `npm test` 14/14, `typecheck`, `lint` y `build` sin errores.

#### Tareas

- F0-05, F0-06, F0-07, F0-08 terminadas. **Fase 0 completa** salvo F0-09 (bloqueada por acceso a MySQL).

### Sesión 2026-10-12 #5

#### Añadido

- Prisma 7.10 con adaptador `@prisma/adapter-mariadb` para MySQL (F0-04, D-004, D-010).
- `apps/api/prisma.config.ts` y `prisma/schema.prisma` con modelos `Rol`, `Permiso`, `RolPermiso`, `Usuario` (tablas `roles`, `permisos`, `rol_permiso`, `usuarios`; baja lógica, bloqueo por intentos).
- Migración inicial `20261012000000_init_seguridad` generada sin BD (D-011).
- `prisma/seed.ts` idempotente: permisos, roles, matriz rol-permiso y administrador inicial (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, bcrypt 12).
- `core/data/prisma.ts`: cliente compartido perezoso (`getPrisma`), error claro si falta `DATABASE_URL`.
- `@platinum/shared`: catálogo `PERMISOS`, descripciones y `PERMISOS_POR_ROL` (matriz del PLAN §5).
- Scripts `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:status`, `db:studio`; `postinstall` genera el cliente.
- Pruebas de capa de datos y catálogo de permisos (`test/prisma.test.ts`).
- Tarea nueva **F0-09** (bloqueada): aplicar migración y seed en el servidor MySQL.

#### Seguridad

- Override de `mariadb` a 3.5.4 (vulnerabilidades altas en 3.4.5); `lodash` actualizado con `npm audit fix`.

#### Decisiones

- D-004 aceptada (Prisma), D-010 (versiones Prisma/mariadb), D-011 (migraciones sin BD).

#### Verificado

- `prisma validate` OK; `npm test` 14/14; `typecheck` y `lint` sin errores.

#### Tareas

- F0-04 terminada; F0-09 creada como bloqueada (D-008).

### Sesión 2026-10-12 #4

#### Añadido

- Núcleo del backend `apps/api/src/core/` (F0-03, A-02, A-03):
  - `HttpError` con fábricas por código HTTP.
  - `BaseController`, `BaseService`, `CrudService` genérico y `BaseRepository` abstracto (independiente del ORM, con baja lógica).
  - Middlewares: `errorHandler` + `notFoundHandler` (formato de error estándar; maneja zod, multer y JSON inválido), `validate` (zod → `req.validated`), `authenticate` (JWT Bearer), `requireRoles`, `requirePermission`, `uploadImages` (jpeg/png/webp/heic, límite por `MAX_UPLOAD_MB`).
  - `security/jwt.ts`: `signAccessToken` / `verifyAccessToken`.
  - Contrato `AppModule` y registro de módulos en `src/modules/index.ts`.
- `config/env.ts`: variables de entorno validadas con zod; carga `.env` nativa de Node; exige secretos JWT reales en producción.
- `app.ts` con helmet, CORS (con credenciales hacia `APP_URL`), cookie-parser, límite JSON 1 MB.
- Módulo `health` reescrito con las clases base: `GET /api/health` y `GET /api/health/me` (protegida).
- `@platinum/shared`: `paginationQuerySchema`, `idParamSchema`, tipo `ApiError`; `HealthStatus` con versión y uptime.
- Pruebas Vitest + supertest (`apps/api/test/core.test.ts`, 9 casos): health, 404, 401/403, validación, CRUD genérico con baja lógica, upload, JSON inválido. Script `npm test`.

#### Verificado

- `npm test` 9/9, `typecheck` y `lint` sin errores; servidor real responde health y 401 en `/me`; cabeceras helmet presentes.

#### Tareas

- F0-03 terminada.

### Sesión 2026-10-12 #3

#### Añadido

- ESLint 10 (flat config) con `typescript-eslint`, reglas de React Hooks / React Refresh y `eslint-config-prettier` (F0-02).
- Prettier 3 (`.prettierrc.json`, `.prettierignore`), `.editorconfig` y `.gitattributes` (LF).
- `apps/api/.env.example` (servidor, `DATABASE_URL`, JWT, SMTP, almacenamiento) y `apps/web/.env.example`.
- Scripts raíz `lint`, `lint:fix`, `format`, `format:check`; `package.json` raíz como `type: module`.
- Repositorio git inicializado en rama `main` (sin commits todavía).

#### Cambiado

- TypeScript fijado a `~5.9` (antes 7.0) por compatibilidad con `typescript-eslint` (D-009).
- Documentos `.md` reformateados con Prettier.

#### Decisiones

- D-008: MySQL correrá en otra máquina; la conexión se configura después vía `DATABASE_URL`.
- D-009: TypeScript `~5.9`.

#### Verificado

- `npm run lint`, `npm run format:check` y `npm run typecheck` sin errores.

#### Tareas

- F0-02 terminada.

### Sesión 2026-10-12 #2

#### Añadido

- Monorepo con npm workspaces: `apps/api`, `apps/web`, `packages/shared` (F0-01, A-01, A-03).
- `tsconfig.base.json` compartido, `.gitignore` y scripts raíz `dev`, `build`, `typecheck`.
- `@platinum/shared`: constantes de roles, estatus/prioridad de reportes y tipos `ApiResponse`, `Paginated`, `HealthStatus`.
- `@platinum/api`: Express 5 + tsx, endpoint `GET /api/health` (puerto 4000).
- `@platinum/web`: React 18.3 + Vite 8, proxy `/api` → 4000, pantalla mínima que consulta health.

#### Versiones

- Node 24.13, npm 11.6, TypeScript 7.0, Express 5.3, Vite 8.3, React 18.3, concurrently 10.

#### Verificado

- `npm install`, `npm run typecheck` y build de web OK; `/api/health` responde `ok`.

#### Notas

- No se encontró cliente `mysql` en PATH: confirmar instalación de MySQL 8 (o Docker) antes de F0-04.

#### Tareas

- F0-01 terminada.

### Sesión 2026-10-12 #1

#### Añadido

- Plan general de la intranet: stack, arquitectura modular OOP, modelo de datos, permisos y fases (D-005).
- `docs/PLAN.md` con matriz de alcances A-01..A-16 y tareas trazables F0..F5.
- `docs/DECISIONES.md` con decisiones aceptadas (D-005..D-007) y pendientes (D-001..D-004).
- `docs/ESTADO.md` para retomar la sesión.
- `CLAUDE.md` y carpeta `.claude/` (settings, comandos `/retomar` y `/cerrar-sesion`).

#### Tareas

- F0-00 terminada.
