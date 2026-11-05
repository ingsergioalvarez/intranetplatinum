# Changelog — Comunicalo (gestión)

Cada entrada referencia las tareas (`C-xx`) del [PLAN](docs/PLAN.md) y las decisiones (`DC-xxx`) de [DECISIONES](docs/DECISIONES.md).
El changelog de Platinum está archivado en [docs/platinum/CHANGELOG.md](docs/platinum/CHANGELOG.md).

## [Sin publicar]

### Sesión 2026-11-05 (6) — Estructura de la empresa, paso 5: avisos por la cadena de jefes (C-10, DC-017)

#### Añadido

- **Cadena de mando** (`modules/avisos/cadena.ts`): los jefes por encima de cada persona en el árbol de áreas, del más cercano al más lejano. El primero es el jefe de su área o, si no tiene, el del área de arriba; un jefe empieza en el área de arriba; los jefes dados de baja se saltan.
- **RH** por permiso: `emergencias.recibir` ("Recibe las emergencias de la empresa"), que se da a personas concretas con la nueva tabla `usuario_permisos` (migración `20261114000000_usuario_permisos`). La pantalla para darlo llega con C-11; mientras, se da directo en la base.
- 13 comprobaciones nuevas de extremo a extremo (108 en total): cadena, área sin jefe, el de más arriba, RH, otra empresa y subida al siguiente jefe.

#### Cambiado

- **Ausencias, retardos, faltas, cambios de turno, horas extra y solicitudes de cobertura:** el aviso va al **jefe más cercano** de la persona; sin nadie arriba, a RH; sin RH, a los admin (último recurso). Los admin ya no los reciben por defecto.
- **Emergencias:** llegan al jefe más cercano y a RH (al de arriba si quien la lanza es jefe; solo a RH si es el de más arriba; a los admin si no hay ni uno ni otro). Si nadie la recibe, **sube un jefe por minuto**; agotada la cadena, a los admin. El super admin las sigue viendo todas.
- **Ausencias:** el supervisor del sitio ya no recibe avisos de ausencias (DC-017: el supervisor no recibe avisos por ahora).

#### Notas

- El permiso `emergencias.recibir` lo crea el **seed**: correr `npm run db:seed` después de `db:deploy` (confirmar antes `SEED_ADMIN_EMAIL`). Sin él, nadie es RH y las emergencias van solo a la cadena.
- Quedan sin tocar (se rehacen con las sedes, C-12/C-13): los avisos al supervisor del sitio en reportes de incidentes, coberturas y revisión de rostros.
- Sin desplegar. 577 pruebas, tipos y lint sin errores, 108 de 108 comprobaciones de extremo a extremo.

### Sesión 2026-11-05 (5) — Se quita el rol Cliente, el portal y Quejas (C-10, DC-018)

#### Quitado

- **Rol Cliente** (`cliente`): ya no existe en el código, en los permisos ni en la lista de roles de Usuarios.
- **Portal del cliente**: sus pantallas (Inicio del cliente, Guardias, Checador del cliente), la ruta `/sitios/del-cliente`, la vista de asistencia recortada para el cliente y los avisos a usuarios de cliente (cambios de guardias y coberturas).
- **Accesos de cliente** en la ficha de un cliente (crear o ligar usuarios) y la columna `usuarios.cliente_id`.
- **Quejas del cliente** (módulo `quejas`, API y pantalla) y su tabla `reportes_cliente`.
- Migración `20261113000000_quitar_rol_cliente`, probada en una copia de la base con sus datos y con respaldo; borra el rol solo si nadie lo tiene (nunca pierde una cuenta) y los interruptores guardados de Quejas.

#### Cambiado

- El módulo Clientes se queda como directorio de empresas y contactos (los sitios cuelgan de él hasta C-12); ahora se llama "Clientes".
- Todos los roles ven el botón SOS y las pantallas por su permiso; ya no hay ramas especiales para el cliente.

#### Notas

- Sin desplegar. 576 pruebas (se quitaron las del portal, accesos y quejas), tipos y lint sin errores, 95 de 95 comprobaciones de extremo a extremo.
- En el servidor la migración se aplica con `db:deploy` junto con las demás (8 nuevas desde las 45).

### Sesión 2026-11-05 (4) — Estructura de la empresa, paso 4: quitar Carteras (C-10, DC-017)

#### Quitado

- **Módulo Carteras** completo: pantalla y menú, API (`/api/carteras`), traspaso de cartera al dar de baja a un admin, su entrada en el catálogo de módulos (y los interruptores que había guardados) y sus pruebas.
- **Los dueños**: las columnas `propietario_id` de `usuarios`, `clientes` y `grupos_guardias` (con sus llaves e índices) mediante la migración `20261112000000_quitar_carteras`, probada antes en una copia de la base local, con respaldo previo. No se perdió ningún dato.
- El campo `pid` del token, la bandera `sinCarteras` (y la consulta extra de módulos en cada petición), el filtro/columna **"Administrador"** de Usuarios y Clientes, y los permisos de "solo lo de mi cartera" en sitios, clientes, grupos, reportes, solicitudes de cobertura y borrado definitivo.

#### Cambiado

- Sin dueños, **toda la empresa ve** lo que antes era de una cartera, según su permiso: clientes, sitios, grupos, reportes y solicitudes de cobertura. Las personas siguen limitadas por área (admin: todas; jefe: su área y subáreas; supervisor: su área).
- **Avisos (provisional hasta el paso 5):** lo que llegaba al admin dueño de un guardia o cliente llega ahora a los admin de la empresa; las emergencias, al supervisor del sitio y a los admin. Pasan a la cadena de jefes y a RH en el paso 5 (DC-017).
- `esSuperAdmin` pasó a `core/superadmin.ts`. `npm run db:superadmin` solo marca al super admin (ya no le pasa lo "sin dueño").

#### Notas

- En el servidor, esta migración se aplica con `db:deploy` junto con las demás (7 nuevas desde las 45 que tiene): borra las columnas de dueño, que en Comunicalo no tienen uso.
- Sin desplegar. 621 pruebas (se quitaron las de carteras), tipos y lint sin errores, 95 de 95 comprobaciones de extremo a extremo.

### Sesión 2026-11-05 (3) — Estructura de la empresa, paso 3: rol Jefe (C-10, DC-016, DC-017)

#### Añadido

- **Rol Jefe** (`jefe`): lo operativo del supervisor (Usuarios en lectura, Asistencia, reportes, horarios, grupos, catálogos, rostros) más marcar su propia asistencia, **dentro de su área y subáreas**. Crear, editar y dar de baja usuarios, la auditoría y "ver a toda la empresa" quedan para el admin hasta C-11. Donde el supervisor tenía acceso (menús, rutas y API), el jefe también.
- **Designación automática:** al designar a alguien jefe de un área su rol pasa a Jefe; si ya es admin, no se le cambia; un usuario del portal de clientes no puede ser jefe. Si deja de serlo (se le quita, se va del área, o el área se da de baja o se elimina) y ya no encabeza otra área, vuelve a Colaborador. Cada cambio queda en la auditoría (`areas.rol_jefe`).
- En pantalla, el rol "Guardia" se ve como **"Colaborador"**; la clave interna sigue siendo `guardia` (el cambio interno es de C-11).
- Verificación de extremo a extremo ampliada a 95 comprobaciones.

#### Notas

- El rol Jefe lo crea el **seed**: hay que correr `npm run db:seed` después de `db:deploy`. **Antes de correrlo, confirmar que `SEED_ADMIN_EMAIL` apunta al administrador que ya existe**; si no, el seed crea un administrador extra (pasó en local y se quitó).
- Los avisos todavía llegan como en Platinum; pasan a la cadena de jefes en el paso 5 (DC-017).
- Sin desplegar. 643 pruebas, tipos y lint sin errores.

### Sesión 2026-11-05 (2) — Estructura de la empresa, paso 2: alcance por área (C-10, DC-016)

#### Añadido

- **Alcance por área:** el admin de la empresa ve a todos; el **jefe** ve a las personas de su área y de todas sus subáreas; el **supervisor** ve solo a las de su propia área; cada quien se ve a sí mismo. Rige en el listado de Usuarios (y al abrir un usuario) y en la Asistencia (día, ficha de la persona, tablero, incidencias y lo que usa el alcance central). Lo que cae fuera responde como si no existiera.
- **Carteras apagado:** con ese módulo apagado (Comunicalo), el admin de la empresa ve a **toda** su empresa en vez de solo lo que él creó. `authenticate` calcula `sinCarteras` por petición; sin él (pruebas, tareas) rige la cartera de siempre.
- Permiso **`alcance.empresa`** ("ver a todas las personas de la empresa, sin importar su área"): la regla ya lo respeta; la pantalla para dárselo a una persona llega con C-11.
- Verificación de extremo a extremo ampliada a 89 comprobaciones (jefe, supervisor, admin, permiso, 404 fuera del alcance y otra empresa).

#### Notas

- Los módulos que se enciendan después (ausencias, horas extra, bitácora, horarios…) heredan este alcance porque usan la misma regla central. Lo que decide por sitio (cambios de turno, cobertura) se rehace con el calendario (C-12/C-13).
- Lo que puede hacer cada rol (jefe frente a supervisor) se afina en C-11; aquí solo se decide a quién ve cada uno.
- Sin desplegar. 643 pruebas, tipos y lint sin errores.

### Sesión 2026-11-05 — Estructura de la empresa, paso 1: áreas (C-10, DC-016)

#### Añadido

- **Áreas con subáreas** sin límite de niveles, por empresa: migración `20261111000000_areas` (tabla `areas` y `usuarios.area_id`; probada sobre una copia de los datos). Una persona pertenece a una sola área; el jefe forma parte de su área.
- **API `/api/areas`** (solo el admin de la empresa; permisos finos en C-11): árbol con nombre completo ("RH / Nómina") y totales por área, crear, renombrar, mover (sin dejar un área dentro de sus propias subáreas), dar de baja (con sus subáreas; sus personas quedan sin área), reactivar, personas del área, candidatos, mover personas y designar jefe. No se repite el nombre dentro de la misma área superior. Todo queda en la auditoría (`areas.*`).
- **Pantalla "Áreas"** en el menú: árbol a la izquierda y ficha del área a la derecha (superior, jefe, personas, subáreas); en celular, lista y ficha en pantallas separadas. Campo **Área** en el formulario de Usuarios.
- **Eliminar definitivamente** (solo super admin): borra el área y todas sus subáreas, también las dadas de baja; sus personas quedan sin área; pide confirmación con los números y queda en la auditoría (`areas.eliminar`). El admin de empresa solo da de baja.
- **Mostrar áreas dadas de baja** (interruptor) con **Reactivar** y, para el super admin, Eliminar definitivamente.
- Corregido: al crear una subárea la pantalla saltaba a la nueva (que mostraba "Subáreas (0)"); ahora se queda en el área superior y la subárea aparece en su lista.
- El número de empleado y la carga masiva (C-17) siguen pendientes.
- Verificación de extremo a extremo ampliada a 79 comprobaciones (aislamiento entre empresas, reglas del árbol, jefe y auditoría).

#### Notas

- Registrados C-15 (primeros pasos), C-16 (restablecer de fábrica) y C-17 (carga masiva desde Excel). "Lugares" se había construido antes de tiempo y se retiró; las sedes se retoman con el calendario (C-12/C-13).
- Sin desplegar. 643 pruebas, tipos y lint sin errores.

### Sesión 2026-11-04 (2) — Módulos y marca aplicados a la app (C-09)

#### Añadido

- **Guardia de módulo** en la API: si la empresa tiene apagado Ausencias, Horas extra, Cambios de turno, Reporte de asistencia, Emergencias, Quejas, Carteras o Bitácora, sus rutas responden 403 `MODULO_APAGADO` (`AppModule.modulo`, `guardiaDeModulo`; el estado se recuerda 10 s y se olvida al cambiar los interruptores).
- **`GET /api/mi-empresa`**: marca (colores, ícono, nombre) y módulos de la empresa en la que trabaja la sesión.
- **Super admin elige empresa:** cabecera `X-Empresa-Id` (solo la respeta si la sesión es de super admin) y `POST /api/plataforma/empresas/:id/entrar`, que queda en la auditoría (`plataforma.entrar_empresa`). Selector "Trabajando en" en el menú.
- **Web:** la marca de la empresa se aplica a toda la app (colores) y su tarjeta aparece bajo nuestra marca; el menú, las rutas (`ProtectedRoute modulo`), los botones del portal de Asistencia, el tablero de Inicio, la ficha del guardia, Mis sitios, el Checador (horas extra) y el botón SOS aparecen solo si el módulo está encendido.
- Verificación de extremo a extremo ampliada a 53 comprobaciones (módulos y empresa elegida). 643 pruebas.

- **Restablecer de fábrica** (C-16) en Plataforma > Empresas > Módulos: deja los interruptores como arrancan (la empresa 1, con Bitácora, SOS, Turnos y Reporte de asistencia; cualquier otra, solo el núcleo). Se revisa y se guarda con "Guardar cambios". El texto de la pestaña ya no dice que los interruptores solo se registran.

#### Notas

- Por DC-015, **Turnos, Grupos, Cobertura, Reportes y Clientes** quedan solo ocultos en pantalla; su API sigue abierta porque asignar horarios y lugares los usa por dentro (se desatan en C-10 y C-12).
- El rol "administrador de empresa" ya era el rol `admin`: ve solo los datos de su empresa y no tiene Plataforma.
- Sin desplegar.

### Sesión 2026-11-04 — Aislamiento por empresa (C-08) y módulos iniciales (DC-015)

#### Añadido

- **Aislamiento de datos por empresa** (C-08, DC-014): `empresa_id` obligatorio y sin valor por defecto en 37 tablas (migración `20261107000000_empresa_en_todo`; lo existente queda en la empresa 1). La empresa viaja en el token (`emp`) y en un contexto por petición; un filtro central en Prisma agrega la empresa a toda lectura y bloquea mover filas entre empresas; las escrituras pasan la empresa de forma explícita y, sin empresa en el contexto, se niega (falla cerrada). Las operaciones de plataforma y los inicios de sesión piden `sinFiltroDeEmpresa`. La tarea de cada minuto corre por empresa activa. Auditoría por empresa. Folios de reportes por empresa.
- **Únicos por empresa:** nombre de turno (`20261108000000_turnos_nombre_por_empresa`), RFC de clientes, folios de reportes y nombre de grupos (`20261109000000_unicos_por_empresa`); ambas migraciones se probaron sobre una copia de los datos reales.
- **Verificación de extremo a extremo** `npm run verificar:aislamiento -w @platinum/api`: levanta una base temporal con dos empresas y comprueba con la API real que una no ve nada de la otra (43 comprobaciones).
- `MODULOS_INICIALES_COMUNICALO` en `@platinum/shared` y notas en Reportes y Clientes sobre lo que debe ser por empresa antes de encenderlos en otra empresa.

#### Cambiado

- **DC-015:** Comunicalo arranca con núcleo + Bitácora + SOS + Turnos y horarios + Reporte de asistencia (antes el seed encendía los 13 opcionales). El seed lo aplica solo la primera vez y acota las categorías a la empresa 1. La base local quedó así.
- Las sesiones anteriores deben iniciar sesión de nuevo (el token ahora lleva la empresa).

#### Notas

- Se hicieron también por empresa (migración `20261109000000_unicos_por_empresa`, probada sobre una copia de los datos): folio anual de reportes, folio de cada reporte, RFC de clientes y nombre de grupos. El nombre de categorías nunca fue único. El correo de un usuario sigue único en todo el sistema (DC-014).
- Sin desplegar. 641 pruebas, tipos y lint sin errores.

### Sesión 2026-11-04 — Plataforma y empresas (C-07)

#### Añadido

- **Empresas** (C-07): migración `20261106000000_empresas` con las tablas `empresas` y `empresa_modulos` y la columna `usuarios.empresa_id`. Comunicalo queda como la empresa 1 y todos los usuarios existentes pasan a ella. El seed enciende sus 13 módulos opcionales la primera vez y asigna al primer administrador a la empresa 1.
- **Catálogo de módulos** en `@platinum/shared` (`MODULOS`): 5 siempre incluidos y 13 opcionales, con dependencias (Horas extra y Cambios de turno necesitan Cobertura) y funciones para validar qué se puede encender o apagar.
- **API de plataforma** (`/api/plataforma/*`, solo super admin): listar, crear, editar, desactivar y reactivar empresas; colores de marca; ícono; módulos con validación de dependencias (no guarda nada si el estado no es válido); administradores con contraseña temporal. Todo se audita.
- **Ícono de la empresa** en SVG, PNG, JPG o WebP (hasta 300 KB). El SVG se valida (sin scripts, eventos ni recursos externos) y se sirve con `Content-Security-Policy: sandbox`.
- **Generador de paleta** (`generarPaleta`): de uno o dos colores saca la escala `brand-50` a `brand-950`, ajusta el principal para que el texto blanco se lea (contraste 4.5:1) y mantiene el menú siempre oscuro.
- **Pantalla Plataforma > Empresas** (solo super admin): lista con filtros y una pantalla por empresa con 4 pestañas (Datos, Marca con vista previa, Módulos con interruptores y sus reglas, Administradores). Nuevo componente `Switch` y encabezado de sección "Plataforma" en el menú lateral.
- 43 pruebas nuevas (591 en total). El repositorio de Prisma se verificó contra una base temporal con las 46 migraciones.

- **Marca de la empresa, segunda parte** (C-14): al subir un ícono o logo, sus colores dominantes pasan a ser el color principal y el de acento (`coloresDominantes` ignora lo transparente, el blanco, el negro y los grises; agrupa tonos parecidos). Por defecto se usa la paleta de Gestión Comunicalo; personalizar los colores es un botón opcional y lo personalizado no se pisa al subir otro ícono. Migración `20261106010000_empresas_color_modo`: la empresa guarda de dónde vienen sus colores (defecto, logo o personalizado); quitar un ícono cuyos colores venían de él restablece la paleta. Aviso si la imagen parece un logo horizontal.
- **Tarjeta de empresa** bajo nuestra marca (ícono sobre cuadro claro y nombre con nuestro estilo en los colores de la empresa) y **vista previa con pestañas**: Pantalla principal, Celular y Reporte (PDF). 14 pruebas nuevas (605 en total).
- Ajuste: el formulario de Datos de la empresa se reacomoda en 12 columnas para que quepa sin deslizar en escritorio.
- **Separación de entornos locales:** la web de esta carpeta pasa a los puertos 5273 (web, con `strictPort`) y 4100 (API, por `PORT` en el `.env`) para no chocar con Platinum (4000 y 5173), y Comunicalo usa su propia base local `gestion_comunicalo`. `platinum_intranet` quedó sin las tablas, la columna y las migraciones de Comunicalo (respaldo previo en `C:\Users\DEVOPS\Videos\respaldos-bd-local\`). Se eliminaron las cuentas de prueba vacías `admin@platinum.local`, `supervisor@plati.com` y `alexis@platinum.com` de la base local. Documentado en `docs/RAMAS.md`. Se dejó anotado que los dos chats comparten la ventana del IDE y la memoria (DC-013), y el usuario pasó al chat de Platinum la indicación de trabajar solo en su carpeta.

#### Notas

- Al desplegar C-07 y C-14 hay dos migraciones nuevas (`20261106000000_empresas` y `20261106010000_empresas_color_modo`): `db:deploy` y luego `db:seed`.
- Los interruptores de módulos y la marca solo se guardan: aplicarlos al menú, a las pantallas y a la API es C-09. El aislamiento de datos por empresa es C-08.
- Al desplegar: `docker compose exec api npm run db:deploy` y luego `db:seed`.

### Sesión 2026-11-03 — Arranque de Comunicalo (C-01, C-02, C-03)

#### Añadido

- Rama `gestion-comunicalo`, creada a partir de `main` (commit `9f572c0`) con todo el trabajo de Platinum hasta esa fecha.
- [docs/RAMAS.md](docs/RAMAS.md): por qué existen dos ramas, cómo se separan las instalaciones y las reglas de despliegue.
- Archivos de despliegue propios en `deploy/`: proyecto Docker `comunicalo`, base `gestion_comunicalo`, puerto local 5191, túnel `gestion-comunicalo` y dominio `gestion.grupocomunicalo.mx`.
- Túnel de Cloudflare `gestion-comunicalo` creado en el servidor y registro DNS `gestion` apuntando a él.
- Primera instalación de Comunicalo en el servidor (C-03): contenedores `comunicalo-*`, base `gestion_comunicalo` con las 45 migraciones, administrador inicial, claves de notificaciones push y acceso funcionando en `https://gestion.grupocomunicalo.mx`. Platinum siguió arriba y sin cambios.
- Documentos propios de Comunicalo: `ESTADO`, `PLAN`, `DECISIONES` y este `CHANGELOG`.

- Imagen de marca de Comunicalo, primera parte (C-05): paleta propia sacada del ícono (azul marino `#0B1528`, azul eléctrico `#0A2AF0`, azul cielo `#0A7CFC`, cian `#00CCFC` como acento solo sobre fondo oscuro y `brand-fondo` `#0B3263` para elementos discretos). Login con el ícono, "gestión comunícalo." en dos tonos y "Grupo Comunícalo" debajo, con un resplandor azul en el fondo. Favicon nuevo, título "Gestión Comunicalo" y color de la barra del navegador.

- Imagen de marca, segunda parte (C-05): menú lateral con el ícono y "gestión comunícalo."; íconos PNG de la app instalada generados desde el SVG (192, 512, Android maskable, iPhone y el de notificaciones en blanco); nombre de la app instalada "Gestión Comunicalo" y color de barra `#0b1528`; título por defecto de las notificaciones. Constante `MARCA` en `@platinum/shared` con el nombre del producto para textos planos.

- [docs/MODULOS.md](docs/MODULOS.md) (C-06): mapa de módulos y dependencias del backend (27) y del frontend (21), hallazgos que condicionan el diseño, catálogo propuesto (núcleo, generales y de seguridad), cadena de dependencias y propuesta de mecanismo para C-07. Solo lectura, sin cambios de código.

#### Cambiado

- Paleta de toda la app apagada: el color principal (botones, ítem activo del menú, enlaces) pasa del azul eléctrico al azul del resplandor del login (`#0b3263`), con tonos intermedios y claros armonizados. El azul eléctrico queda solo en el ícono.
- Textos que decían Platinum: modal de contraseña temporal, verificación pública de informes, PDF y Excel de informes, PDF de horarios, remitente de correo por defecto y nombre del servicio de la API.

- `ESTADO`, `PLAN`, `DECISIONES` y `CHANGELOG` de Platinum se movieron a `docs/platinum/` como archivo de contexto.
