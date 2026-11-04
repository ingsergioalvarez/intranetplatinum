# Plan de trabajo — Comunicalo (gestión)

> Documento vivo. Cada alcance nuevo que pida el usuario se agrega aquí con ID **antes** de implementarlo.
> Ningún alcance se elimina: si se descarta, se marca `[-]` con motivo en [DECISIONES.md](DECISIONES.md).
>
> **IDs:** `C-xx` (Comunicalo). No confundir con `A-xx` y `Fx-yy`, que son de Platinum ([archivo](platinum/PLAN.md)).
> **Estados:** `[ ]` pendiente · `[~]` en progreso · `[x]` terminada · `[!]` bloqueada · `[-]` descartada
> **Regla:** al terminar una tarea → marcarla aquí, registrar en [CHANGELOG.md](../CHANGELOG.md) y actualizar [ESTADO.md](ESTADO.md).

## Matriz de alcances

| ID | Alcance | Pedido por | Estado |
|---|---|---|---|
| C-01 | Estructura del proyecto: rama `gestion-comunicalo` separada de Platinum, documentos propios (Platinum archivado en `docs/platinum/`), reglas de despliegue ([RAMAS.md](RAMAS.md)) y archivos de despliegue propios (`deploy/`) | Usuario 2026-11-03 | [x] Terminada |
| C-02 | Dominio `gestion.grupocomunicalo.mx`: túnel `gestion-comunicalo` (creado, id `14edb25a-d16d-4757-835c-2127225af245`) y registro DNS en Cloudflare | Usuario 2026-11-03 | [x] Terminada (2026-11-03): CNAME `gestion` creado y el sitio responde |
| C-03 | Primera instalación de Comunicalo en el servidor de la oficina (contenedores `comunicalo-*`, base propia, migraciones y primer administrador) | Usuario 2026-11-03 | [x] Terminada (2026-11-03): corre como copia de Platinum en `https://gestion.grupocomunicalo.mx`; entró el administrador. Platinum sin cambios |
| C-04 | Respaldos de la base y las fotos de Comunicalo, sumados a los respaldos que ya tiene Platinum | Usuario 2026-11-03 | [ ] Pendiente (antes de usar con personas reales) |
| C-05 | Imagen de marca de Comunicalo: paleta propia armada con los colores del ícono (azul marino, azul eléctrico, cian y degradado), login con el ícono y el nombre "Gestión Comunicalo" en dos tonos, título y color del navegador. Después: menú lateral, íconos de la app instalada (192/512, iPhone, notificaciones) y nombre de la app. Sin cambios de funcionamiento | Usuario 2026-11-03 | [x] Terminada en local (2026-11-04), sin desplegar: paleta apagada en toda la app, login, menú lateral, íconos PNG de la app instalada (192, 512, Android, iPhone y notificaciones), nombre en el manifiesto y textos (PDF, Excel, correo). Nombre del producto en un solo lugar (`MARCA` en `@platinum/shared`). Sin "Platinum" a la vista |
| C-06 | Mapa de módulos y dependencias (solo lectura): catálogo de módulos de producto, qué carpetas de código incluye cada uno, de quién depende y quién depende de él; núcleo / opcional / de seguridad. Documento que el usuario revisa y aprueba | Usuario 2026-11-04 | [x] Documento hecho (2026-11-04): [MODULOS.md](MODULOS.md). Falta que el usuario decida cada módulo (núcleo, opcional, apagado por defecto) |
| C-07 | Plataforma: empresas (Comunicalo = empresa 1) y sección "Plataforma > Empresas" para el super admin, con una pantalla por empresa y 4 pestañas: **Datos** (nombre y zona horaria obligatorios; razón social, RFC, dirección, teléfono, correo, sitio web y moneda opcionales, MXN por defecto; sin sucursales), **Marca** (color principal y de acento con escala generada y vista previa, ícono SVG/PNG o iniciales), **Módulos** (catálogo en el código, interruptores con dependencias; una empresa nueva empieza solo con lo siempre incluido) y **Administradores** (crear con contraseña temporal). El super admin pertenece a su empresa y la plataforma es una puerta extra. Todo se audita. Los interruptores y la marca solo se guardan: aplicarlos a la app es C-09 | Usuario 2026-11-04 | [x] Terminada en local (2026-11-04), sin desplegar: migración `20261106000000_empresas` (empresas, empresa_modulos, `usuarios.empresa_id`; Comunicalo = empresa 1), seed que enciende sus 13 módulos opcionales, API `/api/plataforma/*` solo super admin, ícono SVG/PNG con validación, y pantalla Plataforma > Empresas con 4 pestañas. 591 pruebas pasando |
| C-08 | Aislamiento de datos por empresa (cada dato pertenece a una empresa, filtro central) con pruebas de que la empresa B no ve nada de la A. Debe estar antes de que entre el primer admin de empresa | Usuario 2026-11-04 | [ ] Pendiente. Listo con las pruebas pasando con dos empresas |
| C-09 | Admin de empresa: su rol, su menú filtrado por los módulos encendidos (núcleo siempre) y selector para que el super admin entre a una empresa, con auditoría | Usuario 2026-11-04 | [ ] Pendiente |
| C-10 | Estructura de la empresa: áreas, equipos y lugares de trabajo (el lugar ya no depende de un cliente) | Usuario 2026-11-04 | [ ] Pendiente |
| C-11 | Roles y permisos por empresa: pantalla para editar qué puede hacer cada rol, permisos finos ligados a módulos, el seed no pisa lo editado, cambios auditados. Roles: super admin (marca), admin de empresa, jefe, supervisor y colaborador | Usuario 2026-11-04 | [ ] Pendiente |
| C-12 | Checador flexible (quien no tiene sitio asignado marca sin sitio ni geocerca, con ubicación capturada pero sin validar) y rostro obligatorio (registro forzado y sin rostro no se marca) | Usuario 2026-11-04 | [ ] Pendiente |
| C-13 | Planeador de horarios: el jefe o supervisor define por persona y día oficina u home office y la hora de checar (semana, quincena o mes); borrador y publicado con aviso; el checador usa el plan | Usuario 2026-11-04 | [ ] Pendiente |
| C-14 | Marca de la empresa, segunda parte (amplía la pestaña Marca de C-07): **colores desde el ícono** (por defecto la paleta de Gestión Comunicalo; al subir un ícono o logo se toman de él el color principal y el de acento, adaptados en tonos; un botón opcional para personalizarlos; no se pisan los personalizados al subir otro logo; modo de color guardado en la empresa), aviso si el logo es horizontal (se recomienda solo el símbolo), **tarjeta de empresa** bajo nuestra marca (ícono sobre cuadro claro y nombre con nuestro estilo en los colores del cliente) y **vista previa con pestañas** (Pantalla principal, Celular, Reporte PDF; el Acceso queda fuera). Aplicarla a la app real sigue siendo C-09 | Usuario 2026-11-04 | [x] Terminada en local (2026-11-04), sin desplegar: migración `20261106010000_empresas_color_modo`, extractor de colores (`coloresDominantes`, 8 pruebas), modo de color en la API, tarjeta de empresa y vista previa con 3 pestañas. 605 pruebas pasando |

## Ideas por definir (sin ID hasta que el usuario las pida)

Se van concretando poco a poco; no se implementa nada de esta lista sin pasar a la matriz de arriba.

- Menú reducido en Comunicalo (por ejemplo, empezar viendo solo Asistencia) sin afectar a Platinum; incluye bloquear las rutas, no solo esconder los botones.
- Generalizar "sitio" hacia áreas, home office y técnicos en campo.
- RH administra la asistencia.
- Más adelante: los jefes suben los horarios de las personas y planean las rutas de los técnicos.
- Correo (SMTP): se aborda al fusionar ambos conceptos; ERPModular ya envía correos desde `smtp.uservers.net`.
- Posible conexión con ERPModular (empresas, áreas y centros de costos).
- Pendiente heredado de Platinum, sin decidir: costo de bcrypt (12 → 10 o hilos) por el inicio de sesión lento en ráfaga.
- Planes y plan básico para clientes externos: qué incluye el básico (propuesta: núcleo + reporte oficial de asistencia) y qué es adicional (SOS, Bitácora, cobertura, etc.), con paquetes tipo "aplicar plan". Se define cuando el sistema esté armado; Comunicalo no entra en un plan.
- Cuestionario de módulos por cliente: versión limpia del Excel (`CUESTIONARIO_RH.xlsx` es la versión interna para RH de Comunicalo), sin detalles internos ni funciones por construir, con "Tu plan incluye" y "Funciones adicionales". Más adelante podría generarse solo desde el catálogo de módulos.
- Solicitar módulos desde el sistema: el admin de la empresa ve el catálogo y pide módulos, y el super admin los aprueba.
- Peticiones muy propias de Comunicalo: se hacen como módulos encendidos solo para la empresa 1, no como código fijo.
