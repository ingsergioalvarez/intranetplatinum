# Manual del Administrador

> Antes de leer esto, revisa la **parte común** (instalar la app, entrar, PIN, campanita y aviso de privacidad) y el **manual del Supervisor**. Todo lo que hace un supervisor (asistencia, retardos y faltas, cobertura, horas extra, reportes, clientes y sitios, turnos, grupos) **tú también lo haces, de la misma forma**. Aquí está lo que **solo tú** haces o lo que ves distinto.

## 1. Tu papel como administrador

Tienes **todos los permisos**. En el celular, la barra de abajo trae **Inicio, Asistencia, Reportes y Clientes**; lo demás está en **"Más"**, con títulos: **Seguimiento** (C2, Quejas), **Operación** (Grupos, Turnos), **Administración** (Usuarios, Catálogos y, si eres super administrador, Carteras) y **Consulta** (Privacidad). En tu Inicio, la tarjeta **"Hoy en el C2"** cuenta lo que hizo el C2 hoy en tu cartera y te lleva a su bitácora. Lo que te distingue del supervisor:

| Solo tú puedes… | Dónde |
|---|---|
| **Dar de alta, editar, dar de baja y reactivar usuarios**, y restablecer contraseñas | **Usuarios** |
| **Quitar los celulares guardados** de una persona | **Usuarios → "Celulares"** |
| **Eliminar definitivamente** usuarios, clientes y sitios | Usuarios y ficha del cliente |
| **Eliminar una asignación** de guardia en un sitio | Ficha del cliente → "Cobertura" |
| **Eliminar el rostro** de un guardia | Usuarios → "Rostro" |
| **Crear el acceso del cliente** a la app | Ficha del cliente |
| **Cambiar a quién se avisa** de los reportes del cliente | Ficha del cliente → "Avisos de reportes" |
| **Aprobar o rechazar ausencias**, o registrarlas directo | **Asistencia → "Ausencias"** |
| **Elegir quién cubre** una solicitud de cobertura | **Asistencia → "Solicitudes de cobertura"** |
| **Revertir una decisión** (justificar, confirmar falta, aceptar retardo) | Bitácora del guardia |

**Tu cartera.** Cada administrador ve y administra **lo que él creó** (sus usuarios, clientes, sitios y grupos) y lo que cuelga de eso. A eso se le llama **cartera**. Lo que es de otro administrador **no lo ves**: si intentas abrirlo, la app responde "no encontrado". Tus **supervisores** ven la cartera de su administrador, es decir, la tuya.

En **Asistencia, Inicio, Calendario, Casos, Cambios, Horas extra, Incidencias y Rostros** ves **todos los sitios de tus clientes**, de cualquier supervisor, y a tus guardias aunque todavía no tengan sitio. El supervisor, en cambio, ve solo los sitios donde él es el supervisor.

> **NOTA:** si eres **super administrador**, ves todo, de todas las carteras. Lo que solo tú haces está en la sección 20.

## 2. Usuarios: la lista

Entra a **Usuarios**. Ves las personas de tu cartera y tu propia cuenta.

- **Buscar:** por **nombre, correo o teléfono**.
- **Filtros:** **"Rol"** (*Administrador, Supervisor, Guardia, Cliente, Operador C2*) y el estado: **"Activos"** (por omisión), **"De baja"** o **"Todos"**.
- **Columnas:** **Nombre** (con "(tú)" en tu fila), **Correo**, **Rol**, **Estado** y **Último acceso**. En el celular cada persona es una tarjeta.
- Un guardia o supervisor **sin teléfono** lleva la insignia amarilla **"Sin teléfono"**. Conviene corregirlo: el teléfono se usa en las emergencias.

**Estados:**

| Estado | Qué significa |
|---|---|
| **Activo** | Puede entrar normalmente. |
| **Contraseña temporal** | Aún no ha cambiado la contraseña que le diste. |
| **Bloqueado** | Falló demasiadas veces al escribir su contraseña. |
| **De baja** | Ya no puede entrar. Conserva su historial. |

{{captura:A01-usuarios|Lista de Usuarios con los filtros y los estados}}

## 3. Dar de alta a una persona

1. En **Usuarios** toca **"Nuevo usuario"**.
2. Llena:
   - **"Nombre completo"** (obligatorio).
   - **"Correo"** (obligatorio). Con ese correo entrará. Si ya existe, la app avisa: *"Ya existe un usuario con este correo"* (aunque esa persona esté de baja).
   - **"Teléfono de contacto"**: es **obligatorio para guardias y supervisores**. Puede ser el de la empresa.
   - **"Rol"**: *Supervisor, Guardia, Cliente* u *Operador C2*. (*Administrador* solo lo ofrece el super administrador.)
   - **"Teléfono personal (opcional)"**: si lo tiene, es el que se marca primero en una emergencia.
3. Toca **"Crear usuario"**.
4. Se abre **"Usuario creado"** con la **"Contraseña temporal"**. Toca **"Copiar mensaje para enviar"**: te deja el texto listo para pegarlo en WhatsApp, con la página, el correo y la contraseña temporal.

> **IMPORTANTE:** la contraseña temporal **se muestra solo esta vez**. Al cerrar la ventana ya no se puede volver a ver. Si se pierde, usa **"Restablecer contraseña"** (sección 5). Al entrar por primera vez, la persona **debe crear una contraseña nueva**.

Quien tú das de alta **queda en tu cartera**. Si das de alta a un supervisor, él verá tu cartera.

{{captura:A02-nuevo-usuario|Ventana "Nuevo usuario" con sus campos}}
{{captura:A03-contrasena-temporal|Ventana "Usuario creado" con la contraseña temporal y "Copiar mensaje para enviar"}}

> **Operador C2:** es la cuenta del centro de monitoreo. Entra directo a la pantalla **C2** (que tú también ves en el menú), donde vigila que cada sitio tenga guardia y recibe los SOS. No necesita teléfono. Ve todos los sitios de todos los clientes, así que dale esta cuenta solo a quien opera el C2. Su manual está en la pestaña **C2** de Ayuda. Tú ves en **C2 → Bitácora** todo lo que pasó con los sitios y lo que hizo el C2; sus **reportes son internos** (los ven tú y el supervisor, no el cliente ni los guardias).

## 4. Editar a una persona

Toca la fila de la persona. Se abre su ventana con los mismos campos del alta y una sección **"Cuenta"** (estado, último acceso y fecha de baja si aplica).

- Cambia lo que necesites y toca **"Guardar cambios"** (se activa cuando algo cambió). Verás **"Cambios guardados"**.
- **No puedes cambiar tu propio rol.**
- Un guardia o supervisor **no puede quedarse sin teléfono de contacto**.
- **Debe quedar siempre al menos un administrador activo.** Si intentas quitarle el rol o dar de baja al único, la app no lo permite.
- Una persona **de baja** se ve en solo lectura.

## 5. Contraseñas olvidadas y cuentas bloqueadas

**No existe "recuperar contraseña por correo".** Cuando alguien olvida su contraseña, tú le generas una temporal:

1. En **Usuarios**, toca a la persona.
2. En **"Cuenta"** toca **"Restablecer contraseña"**.
3. Confirma con **"Generar contraseña"**.
4. Se abre **"Contraseña restablecida"**. Toca **"Copiar mensaje para enviar"** y mándaselo.

Al restablecer, **se cierran todas sus sesiones** y **se desbloquea su cuenta** si estaba bloqueada. Al entrar con la temporal, la app le pide crear una nueva.

- **Bloqueo por intentos:** por omisión, **5 intentos fallidos seguidos** bloquean la cuenta durante **15 minutos**. Se desbloquea sola al pasar ese tiempo, o antes con "Restablecer contraseña". No hay un botón de "Desbloquear" aparte.
- **No puedes restablecer tu propia contraseña** aquí: usa **"Cambiar contraseña"** en tu menú de usuario (sección 19).
- No puedes restablecer a alguien que esté **de baja**: primero reactívalo.

## 6. Dar de baja y reactivar a una persona

**Dar de baja** (para personal que ya no trabaja, **conserva el historial**):

1. Abre a la persona y toca **"Dar de baja"**.
2. Confirma. Verás **"Usuario dado de baja"**.

La persona **ya no puede entrar y se cierran sus sesiones abiertas al instante**. Si intenta entrar verá *"Tu usuario está dado de baja. Contacta al administrador."* Sus marcas, reportes y bitácora se conservan.

**Reactivar:** abre a la persona (filtra por **"De baja"**) y toca **"Reactivar"**. Podrá entrar con su contraseña de antes.

> **NOTA:** no puedes darte de baja a ti mismo, ni dar de baja al **único administrador activo**.

## 7. Celulares guardados

Cada persona puede guardar su perfil en un celular para entrar con un PIN. Si alguien **perdió su celular**, o ya no debe entrar así, tú puedes quitárselo:

1. En **Usuarios**, toca **"Celulares"** en la fila de la persona (este botón es solo tuyo).
2. Ves cada celular con su nombre (*Android, iPhone, Windows…*), si tiene **"Con PIN"** o **"Sin PIN"**, su último uso y una etiqueta roja **"PIN bloqueado"** si lo está.
3. Toca **"Quitar"** en un celular, o **"Quitar todos"**. Confirma.

Verás *"Listo: el celular ya no puede entrar con perfil rápido"*. La persona tendrá que entrar con su **correo y contraseña** en ese celular.

> **NOTA:** tú **no puedes ver ni cambiar el PIN** de nadie. Cada persona lo crea en su celular.

## 8. Eliminar definitivamente

Hay dos formas de quitar algo, y no son lo mismo:

| | **Dar de baja** | **Eliminar definitivamente** |
|---|---|---|
| ¿Se puede deshacer? | **Sí**, con "Reactivar". | **No.** |
| ¿Qué pasa con el historial? | Se **conserva**. | Se **borra todo**, con sus fotos. |
| ¿Cuándo usarlo? | Personal o clientes **reales** que ya no están. | **Limpiar pruebas** o errores de captura. |

> **IMPORTANTE:** "Eliminar definitivamente" **no se puede deshacer** y borra el historial. Para personal o clientes reales usa siempre **"Dar de baja"**.

**Cómo se hace** (es igual para usuarios, clientes y sitios):

1. Abre la persona (**Usuarios**), el cliente (ficha del cliente, botón **"Eliminar"** rojo) o el sitio (ventana del sitio, botón **"Eliminar"**).
2. Se abre **"Eliminar definitivamente"**. Lee la lista **"También se borrará:"**, que te dice cuánto historial se va (marcas, rostros, reportes, asignaciones, sitios, contactos…).
3. Escribe **ELIMINAR** en el campo **"Escribe ELIMINAR para confirmar"** (no importa si es mayúscula o minúscula).
4. Toca **"Eliminar"** (se activa solo cuando escribes la palabra). Verás *"… se eliminó definitivamente"*.

**Qué se borra:**

- **Usuario:** sus marcas de asistencia, rostros, reportes, seguimientos y asignaciones.
- **Cliente:** el cliente, **todos sus sitios** con asignaciones, checadas con fotos, coberturas y reportes, las quejas del cliente y sus contactos.
- **Sitio:** el sitio con sus asignaciones, checadas con fotos, reportes, coberturas y quejas.

**Qué no se borra:** al eliminar un cliente, **los usuarios de su portal no se borran**: quedan **sin cliente** y no ven nada. Dalos de baja si ya no deben entrar.

**Reglas:** no puedes eliminar tu propia cuenta, ni al único administrador activo, ni a nadie de otra cartera.

{{captura:A04-eliminar-definitivo|Ventana "Eliminar definitivamente" con la lista de lo que se borra}}

## 9. Quitar o eliminar una asignación

En la ficha del cliente, **"Cobertura"** del sitio, cada guardia asignado tiene estos botones:

| Botón | Qué hace |
|---|---|
| **"Quitar"** | Si la asignación **ya empezó**, la **termina hoy** (el guardia deja de ver el sitio desde mañana). Si **aún no empieza**, la cancela. Se le avisa. Es lo que también hace el supervisor. |
| **"Eliminar"** (solo tú) | **Borra el renglón por completo**, aunque ya haya empezado o terminado. Las **marcas de asistencia del guardia no se pierden**. |

Al eliminar una asignación **vigente o futura**, se le avisa al guardia (**"Ya no estás asignado a un sitio"** o **"Se canceló una asignación"**) y al cliente. Si ya había terminado, no se avisa a nadie.

## 10. Rostros: eliminar y registrar en persona

En **Usuarios**, el botón **"Rostro"** de un guardia abre su ventana. Ahí revisas el rostro (aprobar o rechazar, como en el manual del Supervisor) y además puedes:

- **"Registrar en persona"** (tú y el supervisor): para casos raros. Te muestra primero los consejos y luego abre la cámara. El rostro **queda aprobado y reemplaza al actual**.
- **"Eliminar rostro"** (solo tú, si ya hay rostro): confirma con **"Eliminar rostro"**. Se borran el rostro y sus fotos de registro. **Sus marcas pasadas conservan su foto.** Al guardia se le pedirá registrarse de nuevo la próxima vez que cheque.

## 11. Dar acceso a un cliente a la app

Un cliente puede entrar a la app para ver **sus sitios, sus guardias y sus reportes**, y reportar algo del servicio. Tú le creas el acceso:

1. Entra a **Clientes** y abre el cliente.
2. En la tarjeta **"Acceso a la intranet"** toca **"Crear acceso"**. Si ya hay 2, el botón está desactivado.
3. Si ya existen usuarios con rol *Cliente* sin cliente asignado, ves dos pestañas:
   - **"Elegir de la lista"**: elige el **"Usuario cliente"**.
   - **"Crear nuevo"**: escribe el **"Nombre"** y el **"Correo"**. Con ese correo entra y también recibe los avisos de reportes.
4. Toca **"Continuar"**. La app te confirma: **"¿Dar acceso a este cliente?"**. Te recuerda que esa persona verá los sitios, guardias y reportes de **ese cliente y nada de otros**.
5. Toca **"Sí, dar acceso"**.
6. Si es una persona nueva, se abre **"Acceso del cliente creado"** con la **contraseña temporal**. Usa **"Copiar mensaje para enviar"** y mándaselo. Si elegiste a alguien que ya existía, verás *"Usuario ligado al cliente"* y conserva su contraseña.

**Reglas:**

- **Máximo 2 usuarios activos por cliente.** Los dos ven lo mismo. Uno dado de baja no cuenta.
- La app crea **sola un contacto** del cliente con ese nombre y correo, marcado para recibir avisos.
- Un correo que ya pertenece a un usuario **que no es cliente** no se puede usar.
- Para **restablecer la contraseña, dar de baja o reactivar** a un usuario del portal, se hace en **Usuarios**, como con cualquier otra persona (secciones 5 y 6).

> **IMPORTANTE:** hoy **no sale ningún correo** al crear el acceso. La contraseña se la entregas tú, por WhatsApp o en persona.

{{captura:A05-acceso-cliente|Tarjeta "Acceso a la intranet" y ventana "Crear acceso del cliente"}}

## 12. A quién se avisa de los reportes del cliente

En la ficha del cliente, la tarjeta **"Avisos de reportes"** decide **a quién se avisa cuando un guardia levanta un reporte** en los sitios de ese cliente. Tú tocas **"Configurar"**; el supervisor solo puede verla.

1. Toca **"Configurar"**.
2. En **"Por defecto, avisar a"** elige una opción:
   - **"Solo supervisor"**: avisa al supervisor del sitio **y a ti, como administrador dueño del cliente**. El cliente no se entera.
   - **"Solo cliente"**: avisa a los usuarios de su acceso a la app. Tú y el supervisor **no** reciben el aviso del reporte nuevo.
   - **"Supervisor y cliente"**: avisa a ambos.
3. Si lo necesitas, en **"Excepciones por prioridad"** elige otra regla solo para **Baja, Media, Alta o Crítica**. **"Usar por defecto"** deja la regla general.
4. Toca **"Guardar"**. Verás **"Avisos actualizados"**.

**Lo que no depende de la regla:**

- Los **guardias asignados o que cubren el sitio ese día** siempre reciben el aviso del reporte nuevo.
- Cuando el **estatus de un reporte cambia**, **siempre** se avisa a quien lo reportó y al cliente.

**Contactos:** en la tarjeta **"Contactos"** puedes marcar **"Recibe notificaciones de reportes"** (necesita correo) y **"Responsable del servicio"**.

> **IMPORTANTE:** **hoy no sale ningún correo.** Los correos al cliente solo quedan "en cola" y no se envían hasta que se configure el servidor de correo (tarea pendiente). El cliente **se entera por la campanita de la app** (y por las notificaciones del celular, si las activó). No le prometas avisos por correo.

La tarjeta te muestra una advertencia amarilla si avisas al cliente pero **ningún contacto tiene correo** con "Recibe notificaciones".

{{captura:A06-avisos-reportes|Ventana "Avisos de reportes" con la regla por defecto y las excepciones}}

## 13. Ausencias

Las ausencias del personal (vacaciones, incapacidades, permisos) las **aprueba el administrador**. El supervisor las pide.

Entra a **Asistencia → "Ausencias"**. Ves las ausencias de **los guardias de tu cartera** (el super administrador ve todas). Por omisión salen las **"Por aprobar"**; el filtro **"Todas"** muestra el resto.

### Aprobar o rechazar

Cada solicitud muestra el guardia, el tipo, las fechas, el motivo, quién la pidió y el **comprobante** (**"Ver comprobante"**).

1. Toca **"Aprobar"** (o **"Rechazar"**).
2. Al aprobar, la app te recuerda: *esos días no se le contarán como falta y las faltas que ya hubiera en ellos se justifican solas*. Confirma con **"Aprobar"**. Verás **"Ausencia aprobada"**, o **"Ausencia aprobada: se justificaron N falta(s)"**.
3. Al rechazar, elige el **"Motivo"**: *Falta el comprobante o no es válido, Las fechas no son correctas, No procede* u *Otro* (con **"Explica el motivo"** obligatorio). Confirma con **"Rechazar"**. Verás **"Solicitud rechazada"**.

El guardia y quien la pidió reciben el aviso. Al aprobar, **los supervisores de los sitios del guardia** reciben **"Ausencia justificada de un guardia"**, porque **su sitio puede quedar sin cubrir**: conviene revisar el calendario.

### Registrar una ausencia directo

1. Toca **"Registrar ausencia"** (el supervisor ve "Pedir ausencia").
2. Elige el **"Guardia"** y el **"Tipo de ausencia"**: *Vacaciones, Incapacidad médica, Cita o consulta médica, Permiso* u *Otro*.
3. Pon **"Desde"** y **"Hasta"** (máximo 180 días).
4. **"Motivo"**: obligatorio en *Permiso* y *Otro*.
5. **"Foto del comprobante"**: obligatoria en *Incapacidad médica* y *Cita o consulta médica*; opcional en *Permiso* y *Otro*; *Vacaciones* no la pide. Es una sola foto.
6. Si el guardia ya tiene faltas en esas fechas, la app te avisa en ámbar que **se justificarán solas**.
7. Toca **"Registrar"**. Verás **"Ausencia registrada y aprobada"**: **queda aprobada al guardarla**.

La ausencia no puede cruzarse con otra del mismo guardia (pendiente o aprobada).

### Cancelar

Puedes cancelar una **"Por aprobar"**, o una **"Aprobada" que todavía no empieza**. Toca **"Cancelar"**, elige el motivo (*Ya no se necesita, Se pidió por error, Otro*) y confirma con **"Cancelar ausencia"**. Una aprobada que **ya empezó no se puede cancelar**, porque sus faltas ya se justificaron.

{{captura:A07-ausencia-aprobar|Solicitud de ausencia con los botones "Aprobar" y "Rechazar" y el comprobante}}

## 14. Solicitudes de cobertura: elegir quién cubre

Cuando un supervisor manda a casa a un guardia, el sitio queda solo y necesita un guardia **de otro supervisor**, se crea una **solicitud** para ti.

1. Te llega **"Solicitud de cobertura"** a la campanita. Si pasan **2 horas** sin atenderla te llega **"Solicitud de cobertura sin atender"**, y se repite **cada 4 horas**.
2. Entra a **Asistencia → "Solicitudes de cobertura"**. Cada solicitud muestra el sitio, el día, quién la pide, por quién y el motivo.
3. Toca **"Elegir quién cubre"**. No abre una ventana: te lleva al **Calendario de cobertura**, ya posicionado en ese sitio y ese día.
4. En el turno **"Sin cubrir"** toca **"Asignar quién cubre"**. Se abre **"Enviar a cubrir"** (igual que en el manual del Supervisor, sección 4).
5. Elige al guardia en **"¿Quién cubre?"**, revisa **"Descansaría N h"** y toca **"Enviar a cubrir"**.

La solicitud se cierra sola como **"Atendida"**. El supervisor que la pidió recibe **"Tu solicitud de cobertura se atendió"**, y el guardia recibe **"Cubrirás un turno"**.

> **NOTA:** si el guardia al que mandaron a casa ya había checado ese día, puede que el calendario no marque el turno como "Sin cubrir" y no veas "Asignar quién cubre". En ese caso usa **"Enviar a cubrir"** de la pantalla Asistencia o de la ficha del sitio.

También puedes **"Cancelar solicitud"** (con motivo). Se avisa a quien la pidió.

## 15. Revertir una decisión

Si un supervisor (o tú) se equivocó al **justificar**, **confirmar una falta** o **aceptar un retardo**, solo **tú** puedes deshacerlo:

1. Abre la **ficha del guardia** y su **"Bitácora"** (Asistencia → toca al guardia).
2. En el evento, toca **"Revertir decisión"**.
3. Elige el **"Motivo"**: *Se decidió por error, Hay información nueva* u *Otro* (con **"Explica el motivo"** obligatorio, mínimo 3 letras).
4. Toca **"Revertir"**. Verás **"Decisión revertida: el evento volvió a quedar sin atender"**.

**Qué pasa:** el evento vuelve a **"Sin atender"** para que se decida de nuevo, queda una **nota** con tu motivo y el registro, y los recordatorios de incidencias lo vuelven a contar. **No se avisa a nadie.** Si se había aplicado una **medida disciplinaria**, **se queda en el historial** del guardia.

> **IMPORTANTE:** hay decisiones que **no se pueden revertir**: las que cerró el sistema solo, y **"Mandar a casa"** (porque la jornada ya se cerró).

{{captura:A08-revertir|Ventana "Revertir decisión" con el motivo}}

## 16. Avisos que te llegan

Los avisos llegan a la **campanita** (y como notificación del celular). **Lo que llega al supervisor del sitio, a ti solo te llega cuando el sitio no tiene supervisor.** Pero hay avisos que **siempre** te llegan:

| Aviso | Cuándo |
|---|---|
| **"Solicitud de ausencia"** | Cuando un guardia o un supervisor pide una ausencia. |
| **"Solicitud de cobertura"** y **"sin atender"** | Sección 14. |
| **"Horas extra sin respuesta"** | Pasaron **más de 12 horas** y el supervisor no decidió. |
| **"Incidencias sin atender más de 24 h"** | Retardos, faltas, etc. que el supervisor no ha decidido. Una vez al día. |
| **"Sitio sin guardia"** | Un supervisor mandó a casa a un guardia y dejó el sitio solo. |
| **"Guardia sin aceptar el aviso de privacidad"** | Un guardia intentó checar sin aceptarlo. |
| **"Reporte URGENTE de un cliente"** | Una queja urgente (y las demás, si el sitio no tiene supervisor). |
| **"Reporte nuevo"** y comentarios | De los sitios de tu cartera, según la regla de avisos del cliente (sección 12). |
| **"Te pasaron una cartera"** | El super administrador te pasó clientes o usuarios. |

**Si un sitio no tiene supervisor,** te llegan además los avisos de asistencia (no se presentó, retardos, rostros por revisar…), de cambios de turno, de horas extra y de cobertura. Por eso conviene que **todos los sitios tengan supervisor** (**"Sin supervisor: los avisos le llegan al admin"** se ve en la tarjeta del sitio).

> **IMPORTANTE:** si un guardia o un cliente **no tiene dueño** (administrador asignado), **el aviso no le llega a ningún administrador**: queda pendiente en pantalla y le llega a quien lo reciba cuando se asigne. El super administrador ve estos casos en **"Sin asignar"** (sección 20).

## 17. Emergencias

> **EMERGENCIA:** cuando un guardia presiona su botón SOS, **a ti siempre te llega la alerta**, aunque el sitio tenga supervisor: a pantalla completa, con sirena y vibración, y como notificación urgente aunque la app esté cerrada. **No se quita hasta que toques "Voy en camino".**

Lo que haces es lo mismo que en el manual del Supervisor, sección 14: **"Voy en camino"**, llamar o ir al sitio, y al terminar **Asistencia → "Emergencias" → "Atender y cerrar"** con el resultado (*Atendida, Falsa alarma* u *Otro*).

**A quién le toca cada alerta:**

| Quién la lanza | Quién la recibe |
|---|---|
| Un **guardia** | Su supervisor del sitio, el administrador del supervisor, y los administradores dueños del guardia y del cliente. |
| Un **supervisor** | Su administrador. |
| Un **administrador** | Los supervisores de su cartera y los super administradores. |
| Un **super administrador** | Todos los administradores. |

Si **nadie la recibe en 60 segundos**, la alerta se repite cada minuto con el aviso **"SIN RESPUESTA"**, y se suma a los super administradores. También tienes tu propio botón **SOS** (mantenlo presionado 2 segundos).

### Lo que hace el C2

Ves lo mismo que el supervisor, pero de **toda tu cartera**: la tarjeta **"Lo que hizo el C2 hoy"** en Inicio, la **bitácora** completa dentro de **C2 → Bitácora**, la **última nota** bajo cada sitio en Asistencia, la **campanita** ("Aviso del C2", "Respuesta del C2", "Reporte del C2") y, en cada SOS, **"Lo que ya se hizo"**. Los reportes del C2 llevan la etiqueta **C2** y son **internos**: los ven tú y el supervisor, no el cliente ni los guardias. Los avisos no se mandan a quien hizo la acción: si pruebas con tu propia cuenta, no te llegarán a ti.

## 18. Quejas, reportes y privacidad: lo que ves distinto

- **Quejas** (reportes de clientes): ves **todas las de tu cartera**, no solo las de un sitio. Puedes **"Tomar a revisión"** y **"Resolver"** cualquiera, igual que el supervisor. Ves también las **fotos** que el cliente adjuntó (hasta 5). Si eliminas un cliente, un sitio o un usuario, también se borran las fotos de sus quejas. Te llega el aviso de las **urgentes** siempre, y el de las demás **solo si el sitio no tiene supervisor**.
- **Reportes** (de los guardias): ves los de tu cartera. No hay diferencia con el supervisor.
- **Privacidad:** ves la misma lista que el supervisor, pero **el aviso de que un guardia no aceptó solo te llega a ti**, no al supervisor.
- **Catálogos y Turnos:** son los mismos para todos. Para **borrar un turno** que usan sitios de otro supervisor (o de otra cartera) hace falta que lo borre quien tenga ese alcance.
- **Reportes de asistencia y horarios PDF:** incluyen **todos los sitios y guardias de tu cartera**. Aunque una etiqueta diga "Todos los sitios" o "Todos los guardias", solo trae lo tuyo.

## 19. Mi cuenta

Tu menú de usuario (arriba a la derecha en el celular) trae **"Acceso rápido (PIN)"**, **"Cambiar contraseña"** y **"Cerrar sesión"**, como el de todos (parte común).

- **Cambiar contraseña:** pide la **actual**, la **nueva** y su confirmación. Mínimo **10 caracteres, una letra y un número**. Al guardarla **se cierran tus sesiones en los demás dispositivos**.
- **PIN:** 4 números, solo funciona en ese celular. Con 5 PIN incorrectos se bloquea el PIN de ese celular y hay que entrar con la contraseña.
- Tu aviso **"¿Guardar tu perfil en este celular?"** sale al entrar la primera vez. Si el celular es de uso compartido, elige **"No, solo esta vez"**.

## 20. Si eres super administrador

El super administrador es un administrador con más alcance. Ves **todo**, de todas las carteras. Además:

- **Solo tú creas o cambias administradores.** En **Usuarios**, el rol *Administrador* solo aparece para ti.
- **Nadie más puede modificar tu cuenta.** Un administrador normal ni siquiera te ve en la lista.
- En **Usuarios** y **Clientes** tienes una columna **"Administrador"** (de quién es cada uno, o **"Sin asignar"** en ámbar) y un filtro por administrador.
- Tienes el menú **"Carteras"**.

### Carteras

Entra a **Carteras**: *"Lo que ve y administra cada administrador. Tú ves todo."* Cada administrador es una tarjeta con **"N usuarios · N clientes · N grupos"**.

**Sin asignar:** si hay cosas que no tienen administrador, aparece una tarjeta ámbar. Dice cuántos usuarios, clientes y grupos son. **Solo tú los ves y siguen funcionando**, pero nadie los atiende. Toca **"Ver usuarios"** o **"Asignar"**.

**Pasar una cartera** (por ejemplo, cuando un administrador se va):

1. En la tarjeta del administrador, toca **"Pasar cartera"** (se desactiva si está vacía).
2. En **"Pasarla a"** elige un **administrador activo** (o **"Dejar sin asignar"**).
3. Deja marcada **"Pasar toda la cartera"** (usuarios, clientes con sus sitios, grupos y avisos pendientes). Si prefieres elegir piezas, desmárcala y elige de las listas: **Supervisores, Clientes, Guardias que no son de un supervisor, Otros usuarios y Grupos**. La casilla **"Llevar también lo que tiene detrás"** hace que al pasar un supervisor se vayan también sus guardias y los clientes que supervisa, y al pasar un cliente, sus accesos.
4. Toca **"Pasar todo"** (o **"Pasar lo elegido (n)"**).

Verás cuántos pasaron. **Es todo o nada.** El administrador que recibe tiene el aviso **"Te pasaron una cartera"**, y el de origen **"Cambió tu cartera"**.

**Al dar de baja a un administrador,** la app primero te pide qué pasa con su cartera (**"Antes de dar de baja a (nombre)"**). Si no la pasas, queda **sin asignar** y solo tú la ves.

> **NOTA:** no existe un selector para asignar a una persona a un administrador. La cartera de cada quien se fija **al crearlo** (quien lo crea es su dueño) y solo cambia con **"Pasar cartera"**.

## 21. Lo que la app todavía no tiene

Para que no lo busques en vano, hoy **no existen en la app**:

| Cosa | Situación actual |
|---|---|
| **Pantalla de auditoría** | Cada acción administrativa **sí se registra** (altas, bajas, restablecer contraseñas, eliminar, pasar cartera, inicios de sesión…), pero **todavía no hay una pantalla para consultarla**. |
| **Envío de correos** | **No sale ningún correo** (avisos al cliente, contraseñas, etc.). Los avisos llegan por la **campanita** y las **notificaciones del celular**. Es una tarea pendiente. |
| **Recuperar contraseña por correo** | No existe: la contraseña temporal la genera el administrador (sección 5). |
| **Respaldos automáticos** | No hay una pantalla de respaldos. Los respaldos del servidor los gestiona quien lo administra, y **hoy no hay un respaldo automático configurado**. Confírmalo con quien administra el servidor. |
| **Roles y permisos editables** | Los permisos de cada rol son fijos. |

## 22. Si algo sale mal

> **SI ALGO SALE MAL:** estas son las situaciones más comunes y qué hacer.

| Qué pasa | Qué hacer |
|---|---|
| **Alguien olvidó su contraseña** | **Usuarios** → la persona → **"Restablecer contraseña"** → mándale la temporal (sección 5). |
| **Alguien no puede entrar y dice "Cuenta bloqueada"** | Espera 15 minutos, o usa **"Restablecer contraseña"** para desbloquearla al momento. |
| **"Tu usuario está dado de baja"** | Reactívalo en **Usuarios** (filtro **"De baja"**) si debe volver. |
| **Perdí la contraseña temporal que generé** | Ya no se puede ver. Usa **"Restablecer contraseña"** y genera otra. |
| **Alguien perdió su celular** | **Usuarios** → **"Celulares"** → **"Quitar todos"** (sección 7). |
| **Eliminé algo por error** | **No se puede deshacer.** Por eso solo se usa para pruebas. Para lo real, **"Dar de baja"**. |
| **Un supervisor justificó o confirmó mal** | Abre la bitácora del guardia y usa **"Revertir decisión"** (sección 15). |
| **No me llegan avisos de un sitio** | Es normal si el sitio **tiene supervisor**: a él le llegan. Revisa la sección 16. |
| **El cliente dice que no le llegan correos** | **Hoy no salen correos.** Se avisa en la campanita de su app. |
| **No veo a una persona o un cliente** | Pertenece a la cartera de **otro administrador**. Pregúntale al super administrador. |
| **Un cliente ya tiene 2 accesos y necesito otro** | Da de baja uno en **Usuarios** (sección 6) y crea el nuevo. |
