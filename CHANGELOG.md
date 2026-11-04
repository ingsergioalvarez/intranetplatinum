# Changelog — Comunicalo (gestión)

Cada entrada referencia las tareas (`C-xx`) del [PLAN](docs/PLAN.md) y las decisiones (`DC-xxx`) de [DECISIONES](docs/DECISIONES.md).
El changelog de Platinum está archivado en [docs/platinum/CHANGELOG.md](docs/platinum/CHANGELOG.md).

## [Sin publicar]

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
