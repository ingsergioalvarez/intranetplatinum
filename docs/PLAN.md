# Plan de trabajo — Intranet Platinum Agency

> Documento vivo y **trazable**. Cada alcance (`A-xx`) se mapea a tareas (`Fx-yy`).
> Ningún alcance se elimina: si se descarta, se marca `DESCARTADO` con motivo en [DECISIONES.md](DECISIONES.md).
>
> **Estados de tarea:** `[ ]` pendiente · `[~]` en progreso · `[x]` terminada · `[!]` bloqueada · `[-]` descartada
>
> **Regla:** al terminar una tarea → marcarla aquí, registrar en [CHANGELOG.md](../CHANGELOG.md) y actualizar [ESTADO.md](ESTADO.md).

---

## 1. Stack acordado

| Capa       | Tecnología                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------- |
| Frontend   | React 18 + Vite + TypeScript, Tailwind CSS, TanStack Query, Zustand, PWA                      |
| Backend    | Node.js + Express + TypeScript, arquitectura modular OOP (Base Controller/Service/Repository) |
| BD         | MySQL 8 + ORM (pendiente decisión D-004: Prisma recomendado)                                  |
| Archivos   | Disco local → S3/R2 en producción                                                             |
| Correo     | Nodemailer SMTP                                                                               |
| Seguridad  | JWT access (15 min) + refresh (7 d, cookie httpOnly), bcrypt, helmet, rate-limit, zod         |
| Estructura | Monorepo: `apps/api`, `apps/web`, `packages/shared`                                           |

**Principios:** mobile-first (uso principal en celular), componentes reutilizables, módulos verticales desacoplados, borrado lógico, auditoría.

---

## 2. Matriz de alcances (requerimientos del cliente)

| ID   | Alcance                                                                                                    | Origen             | Tareas              | Estado           |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------------------ | ------------------- | ---------------- |
| A-01 | Arquitectura React + Node + MySQL                                                                          | Usuario 2026-10-12 | F0-01..F0-08        | En progreso      |
| A-02 | Componentes reutilizables orientados a objetos                                                             | Usuario 2026-10-12 | F0-03, F0-05, F0-06 | Terminado (base) |
| A-03 | Arquitectura modular                                                                                       | Usuario 2026-10-12 | F0-01, F0-03        | Terminado (base) |
| A-04 | Uso escritorio y celular (prioridad móvil)                                                                 | Usuario 2026-10-12 | F0-06, F0-07, F4-01 | En progreso      |
| A-05 | Login                                                                                                      | Usuario 2026-10-12 | F1-01..F1-04        | Terminado        |
| A-06 | Recuperación de contraseña                                                                                 | Usuario 2026-10-12 | F1-05, F1-06        | Pendiente        |
| A-07 | Modal para gestionar accesos de usuario                                                                    | Usuario 2026-10-12 | F1-07..F1-11        | Terminado        |
| A-08 | Dar de baja usuarios                                                                                       | Usuario 2026-10-12 | F1-09               | Terminado        |
| A-09 | Tabla clientes con datos generales                                                                         | Usuario 2026-10-12 | F2-01, F2-02        | Terminado        |
| A-10 | Datos de contacto y responsables (1..N) por cliente                                                        | Usuario 2026-10-12 | F2-03               | Terminado        |
| A-11 | Guardias intramuros generan reportes (iluminación, cámaras, casetas, escritorios, daños al inmueble, etc.) | Usuario 2026-10-12 | F3-01..F3-04        | Terminado        |
| A-12 | Catálogo extensible de tipos de incidencia ("miles de cosas")                                              | Usuario 2026-10-12 | F3-01               | Terminado        |
| A-13 | Evidencia con fotografías, fecha y comentarios                                                             | Usuario 2026-10-12 | F3-03, F3-05        | Terminado        |
| A-14 | Seguimiento de reportes                                                                                    | Usuario 2026-10-12 | F3-05, F3-06        | Terminado        |
| A-15 | Notificación a clientes                                                                                    | Usuario 2026-10-12 | F3-07..F3-10        | Pendiente        |
| A-16 | Plan trazable, changelog y memoria de sesión                                                               | Usuario 2026-10-12 | F0-00               | Terminado        |
| A-17 | Control de asistencia con reconocimiento facial (plan en [ASISTENCIA.md](ASISTENCIA.md))                   | Usuario 2026-10-20 | AS1-01..AS6-08      | En progreso      |
| A-18 | Administrar los turnos desde el menú (admin y supervisor); borrar un turno asignado eligiendo el turno nuevo | Usuario 2026-10-27 | A-18 (ver DA-57)    | Terminado        |
| A-19 | Plan de cobertura con hora límite: el supervisor elige hasta cuándo se queda el guardia; pasada esa hora se avisa y lo que pase de ahí queda por aprobar | Usuario 2026-10-28 | A-19 (ver DA-58)    | Terminado        |
| A-20 | Notificaciones push: los avisos llegan al celular aunque la app esté cerrada o el teléfono bloqueado (Android) | Usuario 2026-10-28 | A-20 (ver DA-59; TC-21) | Terminado        |
| A-21 | Push obligatorio: sin botón para desactivarlo, la app pide activarlo y no deja seguir; notificación con ícono de barra de estado y botón "Ver" | Usuario 2026-10-28 | A-21 (ver A-20)     | Terminado        |
| A-22 | Cada aviso (campanita y push) lleva un título propio y coherente con lo que dice, no uno genérico por tipo (ej. "Tu sitio y horario" para un supervisor nuevo) | Usuario 2026-10-28 | A-22 (ver A-20)     | Terminado         |
| A-23 | Celular bien ajustado: nada ensancha la pantalla (modales y Asistencia sin recortes a 360–412px), y sin zoom de pellizco en la app (solo en las fotos) | Usuario 2026-10-29 | A-23                | Terminado (falta ver con datos reales en el celular) |
| A-24 | Un retardo justificado se ve como "Retardo justificado" en todas las pantallas (lista del día, tarjeta de jornada, checador) | Usuario 2026-10-29 | A-24                | Terminado         |
| A-25 | Decisiones ante un retardo: Justificar / Aceptar con retardo / Mandar a casa (solo con jornada abierta; cuenta como falta, horas no cuentan; confirmación con consecuencias; avisa a guardia y, si el sitio queda solo, a admin) | Usuario 2026-10-29 | A-25 (ver A-24)     | Terminado         |
| A-26 | Solicitud formal al admin para cubrir un sitio con un guardia de otro supervisor, y aviso al supervisor del guardia prestado; recordatorio a los 30 min si nadie llega | Usuario 2026-10-29 | A-26 (ver A-25)     | Terminado: la solicitud llega al admin, hay recordatorio a los 30 min y la lista formal de solicitudes (A-39) |
| A-27 | Incidencia de rostro atendible: botón visible "Revisar y atender" (falsa alarma / confirmada cierra la incidencia; una nota sola no) y el aviso de arriba dice qué incidencias faltan | Usuario 2026-10-29 | A-27 | Terminado |
| A-28 | Calendario de cobertura: un guardia de turno de 24 h que llega muy tarde (9 h) cuenta como presente, no "Sin registro" | Usuario 2026-10-29 | A-28 | Terminado |
| A-29 | El admin crea el acceso del cliente desde su ficha (nombre y correo, contraseña temporal y mensaje para copiar), máximo 2 usuarios por cliente; liga solo usuarios cliente sin cliente elegidos de una lista (nunca escribiendo un correo existente) y pide confirmación explicando a qué cliente quedará ligado; su correo queda como contacto que recibe avisos | Usuario 2026-10-29 | A-29 | Terminado |
| A-30 | Avisos de reportes: el supervisor ve la pantalla bloqueada (solo lectura, también en el servidor); solo el admin cambia a quién se avisa | Usuario 2026-10-29 | A-30 (ver A-29) | Terminado |
| A-31 | Ventana de confirmación al marcar una incidencia de rostro (falsa alarma / confirmada) que explica qué significa y qué pasará, y aviso claro al terminar | Usuario 2026-10-29 | A-31 (ver A-27) | Terminado |
| A-32 | Cada aviso y notificación push lleva directo a lo que indica (una cosa: a ella; varias: a la lista filtrada; si ya no existe: a la lista con mensaje); los del guardia por retardo o mandado a casa van a su historial y los de sitios, grupos y horarios a Mis sitios | Usuario 2026-10-29 | A-32 (ver A-22) | Terminado |
| A-33 | Asistencia: la etiqueta azul del horario del guardia ("Entra a las 8:00 a.m. · 1 h 52 min tarde") se ve completa en celular, sin cortarse | Usuario 2026-10-30 | A-33 | Terminado (falta verlo en el celular) |
| A-34 | Calendario de cobertura: en sitios con turno de lunes a viernes, sábado y domingo salen "Sin turno", no "Sin cubrir"; los ciclos continuos (24x24, 12x12) siguen exigiendo cobertura todos los días | Usuario 2026-10-30 | A-34 (ver A-28) | Terminado |
| A-35 | "No puedo quedarme" se queda, pero con motivo obligatorio (lista corta + "otro" con texto) tanto para el guardia al declinar como para el supervisor al dejar o cambiar el plan; el supervisor ve el motivo y que el guardia no puede quedarse, con la opción de elegir quién cubre | Usuario 2026-10-30 | A-35 (ver A-19) | Terminado (con migración 20261030000000) |
| A-36 | Cámara de asistencia legible: óvalo más alto y claro, exterior en negro semitransparente, instrucciones de los gestos un poco más grandes sobre cápsula oscura (sin romper el diseño) | Usuario 2026-10-30 | A-36 | Terminado (falta probarlo con guardias reales) |
| A-37 | Cámara con proceso de centrado: 1) cara dentro del óvalo (borde verde), 2) se mantiene unos segundos ("No te muevas, mira al frente"), 3) recién entonces el gesto con 15 s para hacerlo, 4) captura; pocos mensajes (el detalle fino solo si lleva ~3 s mal) | Usuario 2026-10-30 | A-37 (ver A-36) | Terminado (falta probarlo con guardias reales) |
| A-38 | Portal del cliente: ve todos los guardias asignados a sus sitios (foto, nombre, turno, si hoy trabaja o descansa y quién cubre), solo lo confirmado; presente / en curso como hoy, sin retardos ni alertas ni datos de contacto; aviso al cliente cuando cambia la asignación o hay cobertura | Usuario 2026-10-30 | A-38 (ver F5-01) | Terminado |
| A-39 | Lista formal de solicitudes de cobertura (tabla con migración): las crea el supervisor al pedir un guardia de otro supervisor; el admin las atiende desde la lista (lleva al calendario del sitio), se cierran al asignar la cobertura, avisan a quien las pidió; el supervisor ve solo las suyas | Usuario 2026-10-30 | A-39 (completa A-26) | Terminado (con migración 20261103010000) |
| A-40 | Perfiles rápidos solo para guardias: al entrar con correo y contraseña el celular guarda su perfil solo (sin preguntar) y la pantalla de entrada muestra tarjetas con iniciales y nombre completo; tocar una pide el PIN de 4 dígitos (opcional; sin PIN pide la contraseña). 5 PIN incorrectos bloquean la tarjeta hasta entrar con contraseña. Cerrar sesión no borra la tarjeta; "Quitar de este dispositivo" sí. El PIN se crea desde un aviso en Inicio o en "Acceso rápido". Solo el admin ve y quita los celulares de un usuario (Usuarios). Desde 2026-11-02 aplica a todos los roles: el guardia se guarda solo; admin, supervisor y cliente deciden con un aviso sobre usar solo celulares personales | Usuario 2026-10-30 | A-40 | Terminado (con migración 20261030040000; falta probarlo en el celular) |
| A-41 | Correo (SMTP): envío real de lo encolado en `notificaciones` con reintentos y "Olvidé mi contraseña" (cierra A-06 y A-15); necesita host, puerto, usuario, remitente y SPF/DKIM del dominio; la contraseña la pone el usuario en el `.env` del servidor | Usuario 2026-10-30 | A-41 (ver A-06, A-15) | Pendiente (esperando datos del correo) |
| A-42 | Respaldos: copia periódica de MySQL y de las fotos (uploads) fuera del servidor, con prueba de restauración | Usuario 2026-10-30 | A-42 (ver F4-04) | Pospuesta por el usuario (2026-11-09): todo se queda en el servidor por ahora; se le recuerda al llegar a esta parte |
| A-43 | Ausencias justificadas por adelantado (AS4-03 de [ASISTENCIA.md](ASISTENCIA.md)): vacaciones, incapacidad, cita médica, permiso u otro. El admin las registra (quedan aprobadas) o las aprueba; el guardia pide la suya y el supervisor la de un guardia suyo. Lo médico exige foto del comprobante; permiso y otro, motivo. Pueden ser de fechas pasadas y justifican solas las faltas ya marcadas en esos días. Sin falsos avisos mientras duran, salen en el reporte como "Ausencia justificada" y el hueco sigue en el calendario de cobertura | Usuario 2026-10-20 / 2026-11-03 | AS4-03 | Terminado (con migración 20261103020000) |
| A-44 | Manual de usuario: un manual por rol (Guardia, Supervisor, Administrador y Cliente) escrito por tareas, con una parte común (instalar, entrar, PIN, campanita, aviso de privacidad) y el Manual completo para el administrador; el texto vive en `docs/manual/*.md` (fuente única) y de ahí sale la pantalla de Ayuda de la app (A-69); el PDF se genera solo en local con `npm run manual` y no se publica en el dominio (decisión 2026-11-10). Capturas poco a poco, con marcador visible mientras falten | Usuario 2026-10-30 (reenfocado 2026-11-10) | A-44 | Textos terminados (2026-11-11): parte común, Guardia, Supervisor, Administrador y Cliente en borrador; faltan las capturas (A-74) y mantenerlos al día con cada cambio de la app |
| A-69 | Pantalla de Ayuda dentro de la app: icono "?" junto a la campanita (celular y escritorio) que abre el manual del rol como página normal (cada rol ve el suyo; el admin ve todos), legible sin conexión; sin PDF descargable por ahora (si se quiere, servirlo por la API con sesión, no por el dominio) | Usuario 2026-11-10 | A-69 (ver A-44) | Hecho, en el servidor y probado por el usuario (2026-11-10) |
| A-70 | Instalación obligatoria de la app en celular: al abrir la página en el navegador de un celular o tableta (cualquier rol, no en computadora) sale una ventana que explica y pide instalarla. Android (Chrome): botón "Instalar" con la instalación nativa; iPhone (Safari): pasos de "Compartir → Agregar a pantalla de inicio" (Apple no permite el botón). Si ya está instalada, la ventana dice "ábrela desde su icono" con un botón "Abrir la app" (no se puede abrir sola desde el navegador; los enlaces que llegan por mensaje sí abren la app en Android). Si el navegador no puede instalar (Chrome en iPhone, Firefox, navegador de WhatsApp) se muestran las instrucciones y un botón para continuar, para que nadie se quede sin trabajar. Motivo: las notificaciones obligatorias (en iPhone solo funcionan con la app instalada) y el guardado de checadas sin conexión. Probar en un Android y un iPhone con los guardias de prueba. El manual dirá "la app te lo pedirá" | Usuario 2026-11-10 (decisiones 2026-11-11: obligatoria con "Continuar" solo si el navegador no puede instalar, que sale cada vez que abra la página y se activa a los 5 s; cualquier rol, solo celular y tableta) | A-70 (ver A-20, DA-53) | Subido; el usuario probó la instalación el 2026-11-11 y funciona (falta confirmar en iPhone si no se probó) |
| A-71 | Menú de la cuenta en el celular: los iconos de candado (PIN), llave (cambiar contraseña) y salir de la barra de arriba pasan a un menú que sale del icono de usuario, con el nombre y el rol arriba, "Acceso rápido (PIN)", "Cambiar contraseña" y, aparte y en rojo, "Cerrar sesión". Campanita y "?" se quedan afuera. Escritorio no cambia (la barra lateral ya tiene los enlaces con texto). Se ajusta el manual (parte común y Guardia). Sin el puntito de "falta crear PIN" (opcional, no pedido) | Usuario 2026-11-10 | A-71 | Hecho en local; sin subir |
| A-72 | Ajustes tras probar A-69 y A-71: (a) el menú de la cuenta muestra un bloque de perfil con círculo de iniciales a la izquierda, nombre, rol y estado a la derecha, y punto verde "En línea" (gris "Sin conexión") según la conexión del celular; (b) el índice del manual deja el título de la sección arriba (antes llegaba más abajo porque el índice se encogía durante el desplazamiento) | Usuario 2026-11-10 | A-72 | Hecho en local; sin subir |
| A-73 | Detalles de la app que el usuario fue notando al probar (cosas que no salen bien o que conviene ajustar): los irá pasando; se ordenan y se comparan con el código antes de tocar nada. **Ya detectados al leer el código para los manuales (sin tocar):** (a2) **[x] hecho 2026-11-11, sin subir:** en el detalle de un reporte, la línea del tiempo dice el rol de quien escribió cada cosa ("Nombre (Cliente)", "(Supervisor)"…, antes decía "(Guardia)" siempre en el primer evento) y el cliente ve su formulario como "Agregar un comentario" (el resto de los roles sigue con "Agregar seguimiento"); (a) **[x] corregido 2026-11-11, sin subir:** la lista "Reportes" del cliente salía vacía: la pantalla mandaba siempre "solo los míos" y el cliente no crea reportes de guardia (confirmado por el usuario con un reporte de prueba); (b) **[x] corregido 2026-11-11, sin subir:** la lista de Ausencias del administrador no se limitaba a su cartera y al registrar, aprobar, rechazar o cancelar no se validaba la cartera del guardia; (c) **[x] corregido 2026-11-11, sin subir:** en Cambios de turno, la lista "quién lo cubrirá" traía a todos los guardias del sistema (el servidor ya rechazaba a los ajenos, pero la lista mostraba sus nombres); ahora solo los del alcance, y para alguien de otro supervisor se usa la solicitud de cobertura; (d) el cliente ve en Asistencia las fotos de checada y la ubicación de los guardias (ocultando solo lo biométrico): el usuario confirmó que es lo deseado y que el cliente siempre debe ver al guardia asignado; ya lo veía (foto de referencia aprobada), y se corrigió que la lista cambiara su foto por la de la checada: ver A-75 [x]; (e) el texto de las notificaciones decía "tu turno" también al cliente: ahora el cliente lee "avisos de tus reportes y novedades" [x]; (f) el SOS lanzado por un supervisor: el usuario lo probó el 2026-11-11 y funciona (manda ubicación si el celular da permiso de GPS; el teléfono de contacto ya es obligatorio para guardia y supervisor desde A-63) [x]; (g) la auditoría no tiene pantalla y los correos no salen (A-41) | Usuario 2026-11-11 | A-73 | Pendiente (esperando la lista del usuario) |
| A-74 | Plan para llenar las capturas de los manuales: (1) el usuario toma cada captura en celular (360 px de ancho, datos de prueba, sin recortar la barra de abajo) siguiendo `docs/manual/capturas/PENDIENTES.md`; (2) la guarda con el nombre exacto del ID (`G01-checador.png`) en la carpeta de su manual (`capturas/comun`, `guardia`, `supervisor`, `admin`, `cliente`); (3) `npm run manual:capturas` dice qué hay, qué falta, qué pesa de más y qué está mal nombrado; (4) al avisar, se revisan los nombres, se optimizan las imágenes (ancho máximo 720 px y unos 150 KB cada una), se marca `[x]` en PENDIENTES, se regeneran los PDF, se compila y se sube. Va por tandas, empezando por la parte común y Guardia. **Pendiente técnico antes de la primera tanda:** hoy las imágenes entran en la descarga que la app hace al instalarse (para todos los roles); hay que sacarlas de ese paquete para que se carguen solo al abrir el manual y no encarezcan la instalación de los guardias | Usuario 2026-11-11 | A-74 (ver A-44) | Pendiente (carpetas y revisión listas; falta la optimización) |
| A-75 | Asistencia: la foto de cada fila de la lista es siempre la de referencia del guardia (quién debe estar) aunque ya haya checado, y junto a la hora de entrada va una miniatura con la foto de la checada (quién checó), que se amplía al tocarla; si el guardia no tiene referencia se usa la de la checada. Aplica a todos los roles. Incluye: texto de las notificaciones obligatorias para el cliente (sin "tu turno"), manuales del Cliente, Supervisor y común, y el borrador del aviso de privacidad (el cliente sí ve retardos, foto y ubicación de la checada) | Usuario 2026-11-11 | A-75 (ver A-73) | Hecho en local; sin subir |
| A-76 | Pantalla de auditoría: hoy el sistema guarda quién hizo cada acción administrativa y cuándo (tabla `auditoria`) pero no hay pantalla ni ruta para leerla; hará falta una pantalla de solo lectura con filtros (persona, acción, fecha) y alcance por cartera. Por definir: quién la ve y qué filtros | Usuario 2026-11-11 | A-76 | Pendiente (el usuario la quiere, sin fecha) |
| A-77 | Notificaciones por cuenta guardada en el celular (retoma D-020 y A-56): el celular recibe los avisos de TODAS las cuentas que tiene guardadas (acceso rápido), no solo de la última que entró. Si el celular lo usan varias cuentas, la notificación dice "para NOMBRE" y oculta el contenido en la pantalla bloqueada ("Tienes un aviso nuevo"; las emergencias conservan su título); al tocarla pide entrar con esa cuenta (PIN) y abre su pantalla. Con una sola cuenta nada cambia. Quitar la cuenta del celular, o cerrar sesión sin tenerla guardada, deja de mandarle avisos ahí. Migración | Usuario 2026-11-12 | A-77 (ver D-020) | Hecho en local, con migración 20261112000000; sin subir |
| A-78 | Tips por notificación: dos a la semana (martes y viernes, 10:30), uno por celular aunque tenga varias cuentas, de una lista fija por rol (guardia, supervisor, administrador, cliente) más unos para todos; al tocar la notificación se abre una ventana emergente que explica el tip completo con "Entendido". Sin pantalla para editarlos por ahora (si la piden, se hace). Migración (registro de envíos) | Usuario 2026-11-12 | A-78 | Hecho en local, con migración 20261112000000; sin subir |
| A-45 | Cambiar o cancelar un plan de cobertura ya confirmado, con motivo obligatorio; deshace sus efectos (descansos en pausa y coberturas creadas) y avisa al guardia | Usuario 2026-10-30 | A-45 (ver A-35) | Terminado (con migración 20261030010000) |
| A-46 | "Me quedo" / "Sí, sigo aquí" admite una nota opcional para el supervisor (p. ej. "no puedo quedarme mucho tiempo"); queda como motivo de las horas extra, en la bitácora y en el aviso | Usuario 2026-10-30 | A-46 (ver A-35) | Terminado |
| A-47 | Óvalo de la cámara punteado (verde al centrar) en el checador y en el registro de rostro; el registro usa el mismo estilo (fondo oscuro afuera) | Usuario 2026-10-30 | A-47 (ver A-36) | Terminado (falta verlo en el celular) |
| A-48 | Falta y "No se presentó": además de Justificar, "Confirmar falta" (motivo en lista + otro con texto, medida opcional); la "Falta" cierra sola el aviso "No se presentó"; en Atendidas se ve Justificada o Falta confirmada; "No se presentó" también se puede confirmar sin esperar las 2 h (crea la falta); justificar también pide motivo de lista | Usuario 2026-10-30 | A-48 | Terminado (con migración 20261030020000) |
| A-49 | Cerrar jornada por salida sin marcar: motivo en lista + otro, cuenta como "salida sin marcar" del guardia, medida opcional (ninguna, llamada de atención verbal, amonestación escrita) guardada en historial formal del guardia y en bitácora, aviso al guardia y sugerencia al llegar a 3 en el mes | Usuario 2026-10-30 | A-49 | Terminado (con migración 20261030020000) |
| A-50 | Lentes menos estrictos: con lentes detectados el checador deja continuar (recomienda quitárselos), amplía un poco el margen de reconocimiento mientras ningún otro guardia quede igual o más cerca, y pide giros de cabeza en lugar de parpadear; el registro de rostro permite registrar con lentes. Sin marca visible para el supervisor | Usuario 2026-10-30 | A-50 | Terminado (falta probarlo con guardias que usan lentes) |
| A-52 | Tras confirmar o justificar una falta (o retardo) ya no salen "Justificar" ni "Confirmar falta"; solo el admin puede "Revertir decisión", con motivo obligatorio y en auditoría | Usuario 2026-11-03 | A-52 (ver A-48) | Terminado |
| A-53 | Fotos del guardia en todos los roles: el cliente ve solo la foto aprobada de los guardias de sus sitios (sin datos biométricos); enlaces de foto que se renuevan al caducar (60 min); cuadro neutro en lugar de la imagen rota (avisos, listas) | Usuario 2026-11-03 | A-53 | Terminado |
| A-54 | Avisos que se actualizan al atenderse (rostro aprobado/rechazado, falta confirmada o justificada, incidencia revisada…): cambian a "… por Luis · fecha", se marcan leídos para todos y quedan con etiqueta "Atendido"; la miniatura se conserva | Usuario 2026-11-03 | A-54 | Terminado (con migración 20261103000000): rostros, incidencias de rostro, faltas y "No se presentó", cambios de turno, horas extra, casos de cobertura y retardos / salidas anticipadas / comida fuera |
| A-55 | PDF del horario de guardias para supervisor y admin (uno, varios o un sitio) con rango de fechas elegible y atajos (esta semana, próxima, este mes); lleva fecha de generación y "Horario vigente al…"; el guardia no lo descarga | Usuario 2026-11-03 | A-55 | Terminado |
| A-56 | Notificaciones por cuenta guardada en el celular y avisos generales sin sesión | Usuario 2026-11-03 | A-56 | Retomado como A-77 y A-78 (ver DECISIONES D-020) |
| A-57 | Burbuja roja con número sobre cada botón del menú (celular y escritorio) con los avisos sin leer de esa sección; "Más" suma lo escondido | Usuario 2026-11-03 | A-57 | Terminado |
| A-58 | Burbuja roja con el total de avisos sin leer en cada tarjeta de acceso rápido de la pantalla de entrada, consultada con la clave del celular (solo devuelve el número) | Usuario 2026-11-03 | A-58 | Terminado |
| A-59 | Reportes del cliente sobre el servicio o sobre un guardia concreto (a supervisor y admin; el guardia no se entera; los urgentes escalan al admin) | Usuario 2026-11-03 | A-59 | Terminado (en el servidor, migración 20261105000000) |
| A-60 | Botón de pánico SOS (v1): flotante en todas las pantallas de guardia, supervisor y admin; se mantiene presionado 2 s; sale sin preguntar con ubicación, hora del servidor, sitio y batería; push urgente + alerta a pantalla completa para supervisor y admin que exige "Voy en camino"; si nadie la recibe en 60 s se repite a todos; el guardia ve el estado, elige el tipo después y puede decir "Fue sin querer"; Asistencia → Emergencias para atender y cerrar con resultado; todo auditado | Usuario 2026-11-03 | A-60 | Terminado (en el servidor; modo simulacro descartado, ver D-022) |
| A-63 | Teléfono de contacto obligatorio en guardias y supervisores (puede ser el compartido de la empresa) y teléfono personal opcional; "Llamar a Juan" marca el personal si lo tiene y dice cuál es; "Abrir marcador (911)" y "Llamar a mi supervisor" solo en celulares; sirena para quien recibe la alerta (con "Probar sonido"); "Sin teléfono" en la lista de usuarios | Usuario 2026-11-03 | A-60 | Terminado en local (migración 20261103040000) |
| A-64 | Avisos de "Retardos seguidos" y "Salidas anticipadas seguidas" ligados a su checada (A-54): se ponen verdes al atenderse y viajan con la cartera | Usuario 2026-11-04 | A-54 | Terminado |
| A-65 | Super admin y carteras, fase 1: el super admin (marca en su cuenta, solo se asigna por comando en el servidor) controla todo; cada admin ve solo sus usuarios, clientes, sitios y grupos (dueño anotado al crearlos); un admin no ve ni toca a otros admin; transferencia de cartera (completa o por elementos, con la cadena supervisor → guardias → sitios) al dar de baja a un admin o cuando se quiera; lo no asignado queda "Sin asignar" y solo lo ve el super admin; los avisos pendientes viajan con la cartera; emergencias van al supervisor del sitio y su admin, y al super admin solo si nadie responde en 60 s o no hay a quién | Usuario 2026-11-04 | A-65 | Terminado en local (migraciones 20261104000000 y 20261104010000; al desplegar hay que correr el comando del super admin) |
| A-66 | Super admin y carteras, fase 2: asistencia, tablero, calendario, bitácora, reportes, informes, horas extra, ausencias, cambios de turno, solicitudes y casos de cobertura muestran solo lo de la cartera de cada admin (con pruebas de que el admin B no ve nada del A) | Usuario 2026-11-04 | A-66 | Terminado en local (sin migración nueva) |
| A-61 | Monitoreo del C2: rol Operador C2 (permiso `c2.ver`) y pantalla de solo lectura con clientes desplegables y sus sitios, ordenada con lo peor arriba, contadores, buscador, 25/50/100 clientes por hoja, foto aprobada, nombre, entrada y horario de cada guardia, y se actualiza sola cada 15 s. Estados por sitio: SOS, solo (15 min sin checar, regla de asistencia), parcial, por llegar, cubierto y sin turno. Un proceso cada minuto guarda los episodios de "sitio solo" (tabla `sitio_solo_episodios`), avisa solo al C2 ("Sitio sin guardia" / "Sitio con guardia", sin retardos ni horas extra) y alimenta el historial por día. Sonido que se repite hasta silenciarlo y notificación al celular. El C2 recibe todo SOS en paralelo con la cadena, responde "Estamos atendiendo" (le llega a quien lo lanzó y a los demás que lo recibieron) y la fila sigue en rojo hasta que se cierra. Quien recibe un SOS ve todos los números (personal y de la empresa) del guardia y del supervisor del sitio; el C2, también los del admin. Manual del C2, tips del C2 y aviso de privacidad con el C2. Sin ligar a cámaras por ahora (el C2 ve todos los sitios) | Usuario 2026-11-03 (definido 2026-11-12) | A-61 | Hecho en local, con migración 20261113000000; sin subir |
| A-62 | Prueba de rendimiento y carga: simular guardias, supervisores y admin a la vez (inicio de sesión, checadas, reportes con foto, avisos, cambio de turno y una emergencia) con k6 contra una base de pruebas, para saber cuántos usuarios simultáneos aguanta el servidor de la oficina y cuál es el cuello de botella; incluye medir por qué a veces la página se queda congelada | Usuario 2026-11-03 | A-62 | Terminado (2026-11-03): aguanta 300 usuarios virtuales sin fallos; el inicio de sesión en ráfaga es el punto débil (ver resultado en [PRUEBA_CARGA.md](PRUEBA_CARGA.md)); faltan prueba de ráfaga de cambio de turno y con base llena (pendientes, sin prioridad, 2026-11-09; el inicio de sesión se deja como está, D-024) |
| A-67 | Fotos en los reportes del cliente (A-59): hasta 5 fotos (solo imágenes, sin videos ni documentos) al levantar el reporte; las ven el cliente, el supervisor del sitio y el admin dueño; migración para ligar las fotos al reporte; los reportes anteriores quedan igual; criterio: el cliente adjunta fotos y las ve en su reporte, y supervisor y admin las ven en la tarjeta | Usuario 2026-11-09 (confirmado 2026-11-11: máximo 5 fotos; también en los comentarios del cliente dentro de un reporte de guardia) | A-67 | Quejas con fotos: subido y probado por el usuario (migración 20261111000000); tope de 5 en comentarios: hecho en local, sin subir |
| A-68 | Aviso de privacidad y consentimiento por el uso del rostro (LFPDPPP): lo ven todos los guardias que deben checar y deben aceptarlo antes de registrar el rostro o checar; se guarda versión del aviso, fecha del servidor, IP y dispositivo y se audita; si el aviso cambia se versiona y se vuelve a pedir; el admin ve quién falta y los que faltan reciben aviso en la campanita; migración. Por definir con el usuario: texto legal, responsable (Platinum Agency o Grupo Comunicalo) y qué pasa si el guardia no acepta | Usuario 2026-11-09 | A-68 (ver ASISTENCIA.md) | Hecho y probado en local (2026-11-09, migración 20261109000000). Texto en borrador, a revisión del abogado ([AVISO_PRIVACIDAD_BORRADOR.md](AVISO_PRIVACIDAD_BORRADOR.md)); pendientes sus datos entre corchetes. Sin subir al servidor |
| A-51 | Faltas por revisar: una falta que el supervisor no ha atendido no cuenta (ni en el resumen ni en el reporte, donde sale "Por revisar"); solo cuenta al confirmarla. Recordatorio en la campanita a las 8:00 y a las 14:00 hasta que la atienda, y a las 24 h también al admin | Usuario 2026-10-30 | A-51 (ver A-48) | Terminado |

### Orden de ejecución (de lo rápido a lo tardado)

| #  | Alcance | Tamaño | Migración | Depende de |
| -- | ------- | ------ | --------- | ---------- |
| 1  | A-33 Etiqueta azul de Asistencia | Muy chico | No | — |
| 2  | A-34 Fin de semana "Sin turno" | Chico | No | — |
| 3  | A-35 Motivo obligatorio en "No puedo quedarme" y en el plan | Mediano | Sí | — |
| 3b | A-45 Cambiar o cancelar un plan confirmado | Mediano | Sí | A-35 |
| 3c | A-47 Óvalo punteado en checador y registro | Muy chico | No | A-36 |
| 3d | A-48 Confirmar falta y motivo al justificar (pendiente: que el contador cuente solo faltas confirmadas, por decidir) | Mediano | Sí | — |
| 3e | A-49 Salida sin marcar con medida disciplinaria | Mediano | Sí | A-48 (comparten medidas) |
| 3f | A-51 Faltas por revisar y recordatorios | Mediano | No | A-48 |
| 3g | A-50 Lentes menos estrictos | Mediano | No | A-36 |
| 3h | A-52 Ocultar Justificar/Confirmar tras decidir; revertir solo admin | Chico | No | A-48 |
| 3i | A-53 Fotos del guardia en todos los roles | Mediano | No | — |
| 3j | A-54 Avisos que se actualizan al atenderse | Mediano | Sí | — |
| 3k | A-57 y A-58 Burbujas en el menú y en las tarjetas | Mediano | No | A-54 |
| 3l | A-55 PDF de horarios | Mediano | No | — |
| 4  | A-36 Óvalo alto, fondo oscuro e instrucciones grandes | Chico | No | — |
| 5  | A-37 Centrado, mantener y gesto de 15 s | Mediano | No | A-36 |
| 6  | A-38 Portal del cliente con guardias | Mediano | No | — |
| 7  | A-39 Lista formal de solicitudes de cobertura | Mediano | Sí | — |
| 8  | A-40 Perfiles rápidos y PIN (guardias) | Grande | Sí | — |
| 9  | A-41 Correo SMTP y recuperación de contraseña | Grande | Posible | Datos del correo |
| 10 | A-42 Respaldos (pospuesta por el usuario: todo se queda en el servidor) | Grande | No | Acceso al servidor y destino de la copia |
| 11 | A-43 Ausencias justificadas por adelantado | Mediano | Sí | — |
| 11b | A-62 Prueba de rendimiento y carga (extras pendientes, sin prioridad) | Mediano | No | Datos del servidor y usuarios esperados |
| 11c | A-67 Fotos en los reportes del cliente | Chico | Sí | A-59 |
| 11d | A-68 Aviso de privacidad y consentimiento del rostro (hecho en local; el texto final lo aprueba el abogado) | Mediano | Sí | Texto legal y responsable |
| 12 | A-44 Manual de usuario (en progreso: común + Guardia) y A-69 pantalla de Ayuda con "?" | Grande | No | Todo lo anterior y las ideas nuevas del usuario |
| 12b | A-70 Instalación obligatoria de la app en celular | Mediano | No | Probar en Android e iPhone |

Las ideas nuevas que traiga el usuario se agregan como A-45 en adelante y se ubican en este orden según su tamaño.

### Alcances propuestos (sugeridos, sin confirmar)

| ID   | Alcance                                                | Estado                         |
| ---- | ------------------------------------------------------ | ------------------------------ |
| P-01 | Sitios/inmuebles por cliente y asignación de guardias  | Terminado en F2 (F2-04, F2-05) |
| P-02 | Roles y permisos (admin, supervisor, guardia, cliente) | Incluido en F1                 |
| P-03 | Auditoría de acciones                                  | Incluido en F1                 |
| P-04 | Modo offline para guardias                             | Fase 4 (ver D-001)             |
| P-05 | Portal de clientes                                     | Terminado en Fase 5 (REP-09)   |
| P-06 | Aprobación de supervisor antes de notificar            | Descartado (D-003, D-016)      |
| P-07 | WhatsApp, dashboard, PDF, SLA                          | Fase 5                         |

---

## 3. Tareas por fase

### Fase 0 — Base del proyecto

| ID    | Tarea                                                                                                                                      | Alcance    | Criterio de aceptación                                                                         | Estado |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- | ------ |
| F0-00 | Estructura de trazabilidad: PLAN, CHANGELOG, ESTADO, DECISIONES, `.claude/`, CLAUDE.md                                                     | A-16       | Archivos creados y protocolo de sesión documentado                                             | [x]    |
| F0-01 | Monorepo (npm workspaces): `apps/api`, `apps/web`, `packages/shared`                                                                       | A-01, A-03 | `npm install` en raíz funciona                                                                 | [x]    |
| F0-02 | Configuración TS, ESLint, Prettier, `.env.example`, `.gitignore`, git init                                                                 | A-01       | Lint pasa en ambos apps                                                                        | [x]    |
| F0-03 | Backend core: `BaseController`, `BaseService`, `BaseRepository`, `HttpError`, middlewares (errores, validate zod, auth, roles, upload)     | A-02, A-03 | Módulo de ejemplo `health` usa las clases base                                                 | [x]    |
| F0-04 | Prisma 7 + adaptador MySQL, esquema inicial (roles, permisos, usuarios), migración SQL generada sin BD y seed (roles, permisos, admin)     | A-01       | `prisma validate` OK, migración SQL generada, pruebas de capa de datos pasan                   | [x]    |
| F0-05 | Frontend core: `ApiClient`, `CrudService`, manejo de errores, router con rutas protegidas                                                  | A-02       | Llamada a `/api/health` desde web                                                              | [x]    |
| F0-06 | Librería UI: Button, Input, Select, Modal/BottomSheet, DataTable/CardList, Card, Badge, Toast, FormField, PhotoUploader (stub)             | A-02, A-04 | Componentes documentados en página `/ui`                                                       | [x]    |
| F0-07 | Layout responsive: AppShell, BottomNav (móvil), Sidebar (escritorio)                                                                       | A-04       | Se ve correcto en 360px y 1440px                                                               | [x]    |
| F0-08 | Scripts dev (concurrently), README de arranque                                                                                             | A-01       | `npm run dev` levanta api + web                                                                | [x]    |
| F0-09 | Aplicar migraciones y seed en el servidor MySQL (otra máquina, D-008)                                                                      | A-01       | `npm run db:deploy` y `npm run db:seed` crean tablas y usuario admin                           | [x]    |
| F0-10 | Constructor de BD local (`npm run db:setup`): crea `.env`, la base, aplica migraciones y seed para que otro desarrollador trabaje en su PC | A-01       | En una PC nueva con MySQL 8, `npm install` + `npm run db:setup` dejan la app lista para entrar | [x]    |

### Fase 1 — Autenticación y usuarios

| ID    | Tarea                                                                                               | Alcance     | Criterio de aceptación                                   | Estado |
| ----- | --------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------- | ------ |
| F1-01 | Tablas: roles, permisos, rol_permiso, usuarios, refresh_tokens, password_resets, auditoria          | A-05, P-02  | Migración aplicada                                       | [x]    |
| F1-02 | API login / refresh / logout (JWT + cookie httpOnly, bcrypt, rate-limit, bloqueo 5 intentos)        | A-05        | Tests de login OK/KO                                     | [x]    |
| F1-03 | Pantalla `/login` mobile-first                                                                      | A-05        | Login funcional en celular                               | [x]    |
| F1-04 | `AuthService` front + refresh automático + guard de rutas por rol                                   | A-05        | Sesión persiste y expira correctamente                   | [x]    |
| F1-05 | API forgot/reset password (token hasheado, expira 30 min, revoca sesiones) + correo                 | A-06        | Correo recibido y contraseña cambiada                    | [ ]    |
| F1-06 | Pantallas `/recuperar` y `/restablecer/:token`                                                      | A-06        | Flujo completo en móvil                                  | [ ]    |
| F1-07 | API CRUD usuarios + filtros + paginación                                                            | A-07        | Endpoints protegidos por permiso                         | [x]    |
| F1-08 | Pantalla usuarios (DataTable/CardList) + **modal** alta/edición + asignar rol                       | A-07        | Alta y edición desde modal                               | [x]    |
| F1-09 | Baja lógica / reactivación (revoca tokens inmediatamente)                                           | A-08        | Usuario dado de baja no puede entrar                     | [x]    |
| F1-10 | Forzar reset de contraseña desde modal + registro en auditoría                                      | A-07, P-03  | Acciones visibles en auditoría                           | [x]    |
| F1-11 | Cambio de contraseña propio y obligatorio tras contraseña temporal (bloqueo de API hasta cambiarla) | A-07, D-012 | Usuario con contraseña temporal debe cambiarla al entrar | [x]    |

### Fase 2 — Clientes

| ID    | Tarea                                                                                 | Alcance          | Criterio de aceptación                         | Estado |
| ----- | ------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------- | ------ |
| F2-01 | Tablas: clientes, cliente_contactos, sitios, sitio_guardia                            | A-09, A-10, P-01 | Migración aplicada                             | [x]    |
| F2-02 | API + pantalla CRUD clientes (datos generales)                                        | A-09             | Alta/edición/baja de cliente                   | [x]    |
| F2-03 | Contactos/responsables 1..N (flags `es_responsable`, `recibe_notificaciones`)         | A-10             | Varios contactos por cliente                   | [x]    |
| F2-04 | Sitios por cliente                                                                    | P-01             | Varios sitios por cliente                      | [x]    |
| F2-05 | Asignación de guardias a sitios (turno, vigencia)                                     | P-01             | Guardia ve solo sus sitios                     | [x]    |
| F2-06 | Grupos de guardias (un guardia en varios grupos), administrables por supervisor/admin | P-01, D-017      | Alta de grupo con integrantes                  | [x]    |
| F2-07 | Asignación de sitios a grupo o guardia, tipo fija / temporal / eventual (con horario) | P-01, D-017      | Guardia ve solo sitios propios y de sus grupos | [x]    |

### Fase 3 — Reportes de guardias

| ID    | Tarea                                                                                                                                         | Alcance     | Criterio de aceptación                      | Estado |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------- | ------ |
| F3-01 | Tabla + CRUD `categorias_reporte` jerárquica (seed: Iluminación, Cámaras, Casetas, Mobiliario/Escritorios, Daño al inmueble, Seguridad, Otro) | A-11, A-12  | Admin agrega categorías sin código          | [x]    |
| F3-02 | Tablas: reportes, reporte_evidencias, reporte_seguimientos, notificaciones; folio `PLT-AAAA-NNNNNN`                                           | A-11        | Migración aplicada                          | [x]    |
| F3-03 | Upload de fotos (multer, validación tipo/tamaño, compresión en cliente, almacenamiento abstracto `StorageService`)                            | A-13        | Fotos visibles en reporte                   | [x]    |
| F3-04 | Wizard móvil "Nuevo reporte": sitio → categoría → prioridad → fotos (cámara) → descripción → enviar; fecha servidor + GPS opcional            | A-11, A-13  | Guardia crea reporte desde celular          | [x]    |
| F3-05 | Seguimiento: línea de tiempo con comentarios, fotos y cambios de estatus                                                                      | A-13, A-14  | Historial completo por reporte              | [x]    |
| F3-06 | Listado/filtros de reportes por estatus, cliente, sitio, fechas, categoría                                                                    | A-14        | Filtros funcionales en móvil                | [x]    |
| F3-07 | Notificación por correo a contactos con `recibe_notificaciones` (plantilla con folio, fotos, enlace)                                          | A-15        | Contacto recibe correo                      | [!]    |
| F3-08 | Registro de notificaciones (enviado/error) y reenvío                                                                                          | A-15        | Bitácora visible                            | [!]    |
| F3-09 | Reglas de aviso por cliente y prioridad (solo supervisor / solo cliente / ambos)                                                              | A-15, D-016 | Configurable desde la ficha del cliente     | [x]    |
| F3-10 | Avisos dentro de la app (campanita) para supervisores y guardias; cola de correos al cliente                                                  | A-15, D-016 | Supervisor ve avisos sin correo configurado | [x]    |

### Fase 4 — PWA y endurecimiento

| ID    | Tarea                                          | Alcance | Criterio de aceptación                   | Estado |
| ----- | ---------------------------------------------- | ------- | ---------------------------------------- | ------ |
| F4-01 | PWA instalable (manifest, service worker)      | A-04    | Instalable en Android/iOS                | [x]    |
| F4-02 | Cola offline de reportes (IndexedDB + sync)    | P-04    | Reporte sin señal se envía al reconectar | [ ]    |
| F4-03 | Pruebas (unit api, e2e flujos críticos)        | —       | CI en verde                              | [ ]    |
| F4-04 | Despliegue (servidor de la oficina, Docker, túnel de Cloudflare, HTTPS, respaldos; ver [DESPLIEGUE.md](DESPLIEGUE.md)) | — | Producción accesible por HTTPS | [~]    |

### Fase 5 — Extras (por confirmar)

| ID    | Tarea                                        | Alcance | Estado |
| ----- | -------------------------------------------- | ------- | ------ |
| F5-01 | Portal de clientes (solo lectura + comentar) | P-05    | [x]    |
| F5-02 | Notificación por WhatsApp                    | P-07    | [ ]    |
| F5-03 | Dashboard de métricas                        | P-07    | [ ]    |
| F5-04 | Exportar reporte a PDF                       | P-07    | [ ]    |
| F5-05 | SLA / tiempos de atención                    | P-07    | [ ]    |

---

## 4. Modelo de datos (referencia)

```
roles(id, nombre)                     permisos(id, clave)          rol_permiso(rol_id, permiso_id)
usuarios(id, nombre, email, telefono, password_hash, rol_id, cliente_id?, activo, intentos_fallidos,
         bloqueado_hasta, ultimo_acceso, created_at, updated_at, deleted_at)
password_resets(id, usuario_id, token_hash, expira_en, usado_en)
refresh_tokens(id, usuario_id, token_hash, user_agent, ip, expira_en, revocado)
auditoria(id, usuario_id, accion, entidad, entidad_id, datos_json, ip, fecha)

clientes(id, razon_social, nombre_comercial, rfc, giro, direccion_fiscal, telefono, email, logo_url,
         estatus, notas, created_at, updated_at, deleted_at)
cliente_contactos(id, cliente_id, nombre, puesto, telefono, celular, email, es_responsable,
                  recibe_notificaciones, prioridad)
sitios(id, cliente_id, nombre, direccion, referencias, lat, lng, deleted_at)            -- D-014
sitio_guardia(id, sitio_id, usuario_id?, grupo_id?, tipo, turno?, hora_inicio?, hora_fin?,
              desde, hasta, vigente_hasta)                                            -- D-017, historial
grupos_guardias(id, nombre, descripcion, deleted_at)   grupo_integrantes(grupo_id, usuario_id)

categorias_reporte(id, padre_id?, nombre, icono, orden, activo)
reportes(id, folio, sitio_id, cliente_id, categoria_id, creado_por, titulo, descripcion,
         ubicacion_detalle, prioridad, estatus, lat, lng, created_at, cerrado_en)   -- D-015
folios_reporte(anio, ultimo)
reporte_evidencias(id, reporte_id, seguimiento_id?, archivo, mime, tamano, subida_por, created_at)
reporte_seguimientos(id, reporte_id, usuario_id, comentario, estatus_anterior, estatus_nuevo, created_at)
notificaciones(id, reporte_id, contacto_id, canal, enviado_en, estado, error)
```

Estatus de reporte: `abierto → notificado → en_proceso → resuelto → cerrado`

## 5. Matriz de permisos

| Acción         | Admin | Supervisor          | Guardia      | Cliente                     |
| -------------- | ----- | ------------------- | ------------ | --------------------------- |
| Usuarios       | CRUD  | Ver                 | —            | —                           |
| Clientes       | CRUD  | CRUD                | —            | —                           |
| Crear reporte  | Sí    | Sí                  | Sus sitios   | —                           |
| Seguimiento    | Sí    | Sí                  | Sus reportes | Comentar / fotos (F5)       |
| Ver reportes   | Todos | Todos               | Sus sitios   | Los suyos (F5)              |
| Ver asistencia | Todos | Sus sitios/guardias | Sus marcas   | Sus guardias asignados (F5) |
