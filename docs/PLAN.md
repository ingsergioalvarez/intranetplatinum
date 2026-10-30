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
| A-26 | Solicitud formal al admin para cubrir un sitio con un guardia de otro supervisor, y aviso al supervisor del guardia prestado; recordatorio a los 30 min si nadie llega | Usuario 2026-10-29 | A-26 (ver A-25)     | Parcial: la solicitud llega como aviso al admin y el recordatorio a los 30 min ya funciona; falta la lista formal de solicitudes (ver A-39) |
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
| A-38 | Portal del cliente: ve todos los guardias asignados a sus sitios (foto, nombre, turno, si hoy trabaja o descansa y quién cubre), solo lo confirmado; presente / en curso como hoy, sin retardos ni alertas ni datos de contacto; aviso al cliente cuando cambia la asignación o hay cobertura | Usuario 2026-10-30 | A-38 (ver F5-01) | Pendiente |
| A-39 | Lista formal de solicitudes de cobertura (tabla con migración): las crea el supervisor al pedir un guardia de otro supervisor; el admin las atiende desde la lista (lleva al calendario del sitio), se cierran al asignar la cobertura, avisan a quien las pidió; el supervisor ve solo las suyas | Usuario 2026-10-30 | A-39 (completa A-26) | Pendiente |
| A-40 | Perfiles rápidos solo para guardias: el celular recuerda al guardia (nombre, correo, foto o iniciales) y muestra tarjetas deslizables al entrar; toca la suya y pone contraseña o un PIN opcional (token por dispositivo, bloqueo tras 5 fallos, "Quitar de este dispositivo"); al final "Usar otro perfil". Admin y supervisor solo con contraseña | Usuario 2026-10-30 | A-40 | Pendiente |
| A-41 | Correo (SMTP): envío real de lo encolado en `notificaciones` con reintentos y "Olvidé mi contraseña" (cierra A-06 y A-15); necesita host, puerto, usuario, remitente y SPF/DKIM del dominio; la contraseña la pone el usuario en el `.env` del servidor | Usuario 2026-10-30 | A-41 (ver A-06, A-15) | Pendiente (esperando datos del correo) |
| A-42 | Respaldos: copia periódica de MySQL y de las fotos (uploads) fuera del servidor, con prueba de restauración | Usuario 2026-10-30 | A-42 (ver F4-04) | Pendiente |
| A-43 | Faltas justificadas (AS4-03 de [ASISTENCIA.md](ASISTENCIA.md)) | Usuario 2026-10-20 | AS4-03 | Pendiente |
| A-44 | Manual de usuario: un PDF general con todas las funciones y vistas, y después un extracto por rol (admin, supervisor, guardia, cliente); se hace al final, con las capturas ya definitivas | Usuario 2026-10-30 | A-44 | Pendiente (al final) |
| A-45 | Cambiar o cancelar un plan de cobertura ya confirmado, con motivo obligatorio; deshace sus efectos (descansos en pausa y coberturas creadas) y avisa al guardia | Usuario 2026-10-30 | A-45 (ver A-35) | Terminado (con migración 20261030010000) |
| A-46 | "Me quedo" / "Sí, sigo aquí" admite una nota opcional para el supervisor (p. ej. "no puedo quedarme mucho tiempo"); queda como motivo de las horas extra, en la bitácora y en el aviso | Usuario 2026-10-30 | A-46 (ver A-35) | Terminado |

### Orden de ejecución (de lo rápido a lo tardado)

| #  | Alcance | Tamaño | Migración | Depende de |
| -- | ------- | ------ | --------- | ---------- |
| 1  | A-33 Etiqueta azul de Asistencia | Muy chico | No | — |
| 2  | A-34 Fin de semana "Sin turno" | Chico | No | — |
| 3  | A-35 Motivo obligatorio en "No puedo quedarme" y en el plan | Mediano | Sí | — |
| 3b | A-45 Cambiar o cancelar un plan confirmado | Mediano | Sí | A-35 |
| 4  | A-36 Óvalo alto, fondo oscuro e instrucciones grandes | Chico | No | — |
| 5  | A-37 Centrado, mantener y gesto de 15 s | Mediano | No | A-36 |
| 6  | A-38 Portal del cliente con guardias | Mediano | No | — |
| 7  | A-39 Lista formal de solicitudes de cobertura | Mediano | Sí | — |
| 8  | A-40 Perfiles rápidos y PIN (guardias) | Grande | Sí | — |
| 9  | A-41 Correo SMTP y recuperación de contraseña | Grande | Posible | Datos del correo |
| 10 | A-42 Respaldos | Grande | No | Acceso al servidor y destino de la copia |
| 11 | A-43 Faltas justificadas | Mediano | Por ver | — |
| 12 | A-44 Manual de usuario | Grande | No | Todo lo anterior y las ideas nuevas del usuario |

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
