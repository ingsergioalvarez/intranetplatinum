# Capturas del manual: pendientes

Cada captura se guarda con **el nombre exacto** de la columna "Archivo" (formato `.png`) **en la carpeta de su manual**: la letra del nombre dice cuál es.

| Letra | Carpeta | Manual |
|---|---|---|
| `C` | `capturas/comun/` | Parte común |
| `G` | `capturas/guardia/` | Guardia |
| `S` | `capturas/supervisor/` | Supervisor |
| `A` | `capturas/admin/` | Administrador |
| `K` | `capturas/cliente/` | Cliente |

Mientras la imagen no exista, el manual muestra un recuadro gris de "Captura pendiente" (en Ayuda, el administrador ve ahí el nombre del archivo que falta). **`npm run manual:capturas`** muestra cuáles están hechas, cuáles faltan, cuáles pesan de más y cuáles tienen el nombre mal escrito o están en la carpeta equivocada. Plan completo: A-74 en el [PLAN](../../PLAN.md).

**Cómo tomarlas:** en celular a 360 px de ancho (captura de pantalla normal), y con **datos de prueba** (no nombres reales de guardias ni clientes). Una captura por pantalla, sin recortar la barra de abajo.

| Hecha | Archivo | Qué debe verse | Dónde se usa |
|---|---|---|---|
| [ ] | `C01-icono-instalada.png` | Icono de Platinum en la pantalla de inicio del celular | Parte común |
| [ ] | `C02-notificaciones.png` | Ventana "Activa las notificaciones" | Parte común |
| [ ] | `C03-iniciar-sesion.png` | Pantalla "Iniciar sesión" | Parte común |
| [ ] | `C04-crea-tu-contrasena.png` | Pantalla "Crea tu contraseña" con las reglas | Parte común |
| [ ] | `C05-quien-va-a-entrar.png` | Tarjetas de perfil en "¿Quién va a entrar?" | Parte común |
| [ ] | `C06-acceso-rapido.png` | Pantalla "Acceso rápido" con el estado del PIN | Parte común |
| [ ] | `C07-crear-pin.png` | Ventana "Crear PIN" | Parte común |
| [ ] | `C08-campanita.png` | Ventana "Avisos" con la lista agrupada | Parte común |
| [ ] | `C09-aviso-privacidad.png` | Ventana "Aviso de privacidad" | Parte común |
| [ ] | `G01-checador.png` | Pantalla del Checador con sus botones | Manual del Guardia |
| [ ] | `G02-bienvenida-rostro.png` | Ventana "Hola" con los consejos para registrar el rostro | Manual del Guardia |
| [ ] | `G03-camara-registro.png` | Cámara del registro con el óvalo y la indicación de la foto | Manual del Guardia |
| [ ] | `G04-recepcion-turno.png` | Ventana "Recepción de Turno y Consignas" | Manual del Guardia |
| [ ] | `G05-camara-gesto.png` | Cámara de verificación pidiendo un gesto | Manual del Guardia |
| [ ] | `G06-confirmar-entrada.png` | Ventana "¿Registrar tu entrada?" | Manual del Guardia |
| [ ] | `G07-entrada-checada.png` | Ventana "Entrada checada" | Manual del Guardia |
| [ ] | `G08-sin-conexion.png` | Aviso "Sin conexión" y checada pendiente de enviar | Manual del Guardia |
| [ ] | `G09-boton-sos.png` | Botón SOS mientras se mantiene presionado | Manual del Guardia |
| [ ] | `G10-alerta-enviada.png` | Ventana "Alerta enviada" | Manual del Guardia |
| [ ] | `G11-franja-alerta.png` | Franja roja "Alerta activa · Ver estado" | Manual del Guardia |
| [ ] | `G12-mis-checadas.png` | Pantalla "Mis checadas" | Manual del Guardia |
| [ ] | `G13-mis-sitios.png` | Pantalla "Mis sitios" | Manual del Guardia |
| [ ] | `G14-solicitar-cambio.png` | Ventana "Solicitar cambio de turno" | Manual del Guardia |
| [ ] | `G15-nuevo-reporte.png` | Nuevo reporte: paso de la prioridad | Manual del Guardia |
| [ ] | `G16-comprobante-reporte.png` | Comprobante "Reporte registrado" con el folio | Manual del Guardia |
| [ ] | `G17-detalle-reporte.png` | Detalle de un reporte con el seguimiento oficial | Manual del Guardia |
| [ ] | `G18-pedir-ausencia.png` | Ventana "Pedir una ausencia" | Manual del Guardia |
| [ ] | `S01-inicio.png` | Inicio del supervisor con las cinco tarjetas y "Requiere tu atención" | Manual del Supervisor |
| [ ] | `S02-asistencia.png` | Asistencia: filtros, botonera con globos y lista de guardias | Manual del Supervisor |
| [ ] | `S03-enviar-cubrir.png` | Ventana "Enviar a cubrir" con la lista de quién cubre | Manual del Supervisor |
| [ ] | `S04-retardo-decision.png` | Bloque "¿Qué haces con este retardo?" en la bitácora | Manual del Supervisor |
| [ ] | `S05-ficha-guardia.png` | Ficha del guardia con el resumen del mes y la bitácora | Manual del Supervisor |
| [ ] | `S06-detalle-reporte.png` | Detalle de un reporte con el seguimiento y "Agregar seguimiento" | Manual del Supervisor |
| [ ] | `A01-usuarios.png` | Lista de Usuarios con filtros y estados | Manual del Administrador |
| [ ] | `A02-nuevo-usuario.png` | Ventana "Nuevo usuario" | Manual del Administrador |
| [ ] | `A03-contrasena-temporal.png` | Ventana "Usuario creado" con la contraseña temporal | Manual del Administrador |
| [ ] | `A04-eliminar-definitivo.png` | Ventana "Eliminar definitivamente" | Manual del Administrador |
| [ ] | `A05-acceso-cliente.png` | Tarjeta "Acceso a la intranet" y ventana "Crear acceso del cliente" | Manual del Administrador |
| [ ] | `A06-avisos-reportes.png` | Ventana "Avisos de reportes" | Manual del Administrador |
| [ ] | `A07-ausencia-aprobar.png` | Solicitud de ausencia con "Aprobar" y "Rechazar" | Manual del Administrador |
| [ ] | `A08-revertir.png` | Ventana "Revertir decisión" | Manual del Administrador |
| [ ] | `K01-inicio.png` | Inicio del cliente con "Reportes abiertos" y "Guardias hoy" | Manual del Cliente |
| [ ] | `K02-mis-guardias.png` | "Mis guardias" con una tarjeta por sitio y el estado de cada guardia | Manual del Cliente |
| [ ] | `K03-asistencia.png` | Asistencia del cliente con el estado de cada guardia | Manual del Cliente |
| [ ] | `K04-reporte-detalle.png` | Detalle de un reporte con seguimiento y "Agregar un comentario" | Manual del Cliente |
| [ ] | `K05-nuevo-reporte.png` | Ventana "Nuevo reporte" del cliente | Manual del Cliente |
| [ ] | `K06-mis-reportes.png` | "Mis reportes" con estado y respuesta | Manual del Cliente |

Total: 47 capturas.
