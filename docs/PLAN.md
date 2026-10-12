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
| A-05 | Login                                                                                                      | Usuario 2026-10-12 | F1-01..F1-04        | Pendiente        |
| A-06 | Recuperación de contraseña                                                                                 | Usuario 2026-10-12 | F1-05, F1-06        | Pendiente        |
| A-07 | Modal para gestionar accesos de usuario                                                                    | Usuario 2026-10-12 | F1-07..F1-10        | Pendiente        |
| A-08 | Dar de baja usuarios                                                                                       | Usuario 2026-10-12 | F1-09               | Pendiente        |
| A-09 | Tabla clientes con datos generales                                                                         | Usuario 2026-10-12 | F2-01, F2-02        | Pendiente        |
| A-10 | Datos de contacto y responsables (1..N) por cliente                                                        | Usuario 2026-10-12 | F2-03               | Pendiente        |
| A-11 | Guardias intramuros generan reportes (iluminación, cámaras, casetas, escritorios, daños al inmueble, etc.) | Usuario 2026-10-12 | F3-01..F3-04        | Pendiente        |
| A-12 | Catálogo extensible de tipos de incidencia ("miles de cosas")                                              | Usuario 2026-10-12 | F3-01               | Pendiente        |
| A-13 | Evidencia con fotografías, fecha y comentarios                                                             | Usuario 2026-10-12 | F3-03, F3-05        | Pendiente        |
| A-14 | Seguimiento de reportes                                                                                    | Usuario 2026-10-12 | F3-05, F3-06        | Pendiente        |
| A-15 | Notificación a clientes                                                                                    | Usuario 2026-10-12 | F3-07, F3-08        | Pendiente        |
| A-16 | Plan trazable, changelog y memoria de sesión                                                               | Usuario 2026-10-12 | F0-00               | Terminado        |

### Alcances propuestos (sugeridos, sin confirmar)

| ID   | Alcance                                                | Estado                               |
| ---- | ------------------------------------------------------ | ------------------------------------ |
| P-01 | Sitios/inmuebles por cliente y asignación de guardias  | Incluido en F2 (necesario para A-11) |
| P-02 | Roles y permisos (admin, supervisor, guardia, cliente) | Incluido en F1                       |
| P-03 | Auditoría de acciones                                  | Incluido en F1                       |
| P-04 | Modo offline para guardias                             | Fase 4 (ver D-001)                   |
| P-05 | Portal de clientes                                     | Fase 5 (ver D-002)                   |
| P-06 | Aprobación de supervisor antes de notificar            | Por decidir (D-003)                  |
| P-07 | WhatsApp, dashboard, PDF, SLA                          | Fase 5                               |

---

## 3. Tareas por fase

### Fase 0 — Base del proyecto

| ID    | Tarea                                                                                                                                  | Alcance    | Criterio de aceptación                                                       | Estado |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- | ------ |
| F0-00 | Estructura de trazabilidad: PLAN, CHANGELOG, ESTADO, DECISIONES, `.claude/`, CLAUDE.md                                                 | A-16       | Archivos creados y protocolo de sesión documentado                           | [x]    |
| F0-01 | Monorepo (npm workspaces): `apps/api`, `apps/web`, `packages/shared`                                                                   | A-01, A-03 | `npm install` en raíz funciona                                               | [x]    |
| F0-02 | Configuración TS, ESLint, Prettier, `.env.example`, `.gitignore`, git init                                                             | A-01       | Lint pasa en ambos apps                                                      | [x]    |
| F0-03 | Backend core: `BaseController`, `BaseService`, `BaseRepository`, `HttpError`, middlewares (errores, validate zod, auth, roles, upload) | A-02, A-03 | Módulo de ejemplo `health` usa las clases base                               | [x]    |
| F0-04 | Prisma 7 + adaptador MySQL, esquema inicial (roles, permisos, usuarios), migración SQL generada sin BD y seed (roles, permisos, admin) | A-01       | `prisma validate` OK, migración SQL generada, pruebas de capa de datos pasan | [x]    |
| F0-05 | Frontend core: `ApiClient`, `CrudService`, manejo de errores, router con rutas protegidas                                              | A-02       | Llamada a `/api/health` desde web                                            | [x]    |
| F0-06 | Librería UI: Button, Input, Select, Modal/BottomSheet, DataTable/CardList, Card, Badge, Toast, FormField, PhotoUploader (stub)         | A-02, A-04 | Componentes documentados en página `/ui`                                     | [x]    |
| F0-07 | Layout responsive: AppShell, BottomNav (móvil), Sidebar (escritorio)                                                                   | A-04       | Se ve correcto en 360px y 1440px                                             | [x]    |
| F0-08 | Scripts dev (concurrently), README de arranque                                                                                         | A-01       | `npm run dev` levanta api + web                                              | [x]    |
| F0-09 | Aplicar migraciones y seed en el servidor MySQL (otra máquina, D-008)                                                                  | A-01       | `npm run db:deploy` y `npm run db:seed` crean tablas y usuario admin         | [!]    |

### Fase 1 — Autenticación y usuarios

| ID    | Tarea                                                                                        | Alcance    | Criterio de aceptación                 | Estado |
| ----- | -------------------------------------------------------------------------------------------- | ---------- | -------------------------------------- | ------ |
| F1-01 | Tablas: roles, permisos, rol_permiso, usuarios, refresh_tokens, password_resets, auditoria   | A-05, P-02 | Migración aplicada                     | [ ]    |
| F1-02 | API login / refresh / logout (JWT + cookie httpOnly, bcrypt, rate-limit, bloqueo 5 intentos) | A-05       | Tests de login OK/KO                   | [ ]    |
| F1-03 | Pantalla `/login` mobile-first                                                               | A-05       | Login funcional en celular             | [ ]    |
| F1-04 | `AuthService` front + refresh automático + guard de rutas por rol                            | A-05       | Sesión persiste y expira correctamente | [ ]    |
| F1-05 | API forgot/reset password (token hasheado, expira 30 min, revoca sesiones) + correo          | A-06       | Correo recibido y contraseña cambiada  | [ ]    |
| F1-06 | Pantallas `/recuperar` y `/restablecer/:token`                                               | A-06       | Flujo completo en móvil                | [ ]    |
| F1-07 | API CRUD usuarios + filtros + paginación                                                     | A-07       | Endpoints protegidos por permiso       | [ ]    |
| F1-08 | Pantalla usuarios (DataTable/CardList) + **modal** alta/edición + asignar rol                | A-07       | Alta y edición desde modal             | [ ]    |
| F1-09 | Baja lógica / reactivación (revoca tokens inmediatamente)                                    | A-08       | Usuario dado de baja no puede entrar   | [ ]    |
| F1-10 | Forzar reset de contraseña desde modal + registro en auditoría                               | A-07, P-03 | Acciones visibles en auditoría         | [ ]    |

### Fase 2 — Clientes

| ID    | Tarea                                                                         | Alcance          | Criterio de aceptación       | Estado |
| ----- | ----------------------------------------------------------------------------- | ---------------- | ---------------------------- | ------ |
| F2-01 | Tablas: clientes, cliente_contactos, sitios, sitio_guardia                    | A-09, A-10, P-01 | Migración aplicada           | [ ]    |
| F2-02 | API + pantalla CRUD clientes (datos generales)                                | A-09             | Alta/edición/baja de cliente | [ ]    |
| F2-03 | Contactos/responsables 1..N (flags `es_responsable`, `recibe_notificaciones`) | A-10             | Varios contactos por cliente | [ ]    |
| F2-04 | Sitios por cliente                                                            | P-01             | Varios sitios por cliente    | [ ]    |
| F2-05 | Asignación de guardias a sitios (turno, vigencia)                             | P-01             | Guardia ve solo sus sitios   | [ ]    |

### Fase 3 — Reportes de guardias

| ID    | Tarea                                                                                                                                         | Alcance    | Criterio de aceptación             | Estado |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------- | ------ |
| F3-01 | Tabla + CRUD `categorias_reporte` jerárquica (seed: Iluminación, Cámaras, Casetas, Mobiliario/Escritorios, Daño al inmueble, Seguridad, Otro) | A-11, A-12 | Admin agrega categorías sin código | [ ]    |
| F3-02 | Tablas: reportes, reporte_evidencias, reporte_seguimientos, notificaciones; folio `PLT-AAAA-NNNNNN`                                           | A-11       | Migración aplicada                 | [ ]    |
| F3-03 | Upload de fotos (multer, validación tipo/tamaño, compresión en cliente, almacenamiento abstracto `StorageService`)                            | A-13       | Fotos visibles en reporte          | [ ]    |
| F3-04 | Wizard móvil "Nuevo reporte": sitio → categoría → prioridad → fotos (cámara) → descripción → enviar; fecha servidor + GPS opcional            | A-11, A-13 | Guardia crea reporte desde celular | [ ]    |
| F3-05 | Seguimiento: línea de tiempo con comentarios, fotos y cambios de estatus                                                                      | A-13, A-14 | Historial completo por reporte     | [ ]    |
| F3-06 | Listado/filtros de reportes por estatus, cliente, sitio, fechas, categoría                                                                    | A-14       | Filtros funcionales en móvil       | [ ]    |
| F3-07 | Notificación por correo a contactos con `recibe_notificaciones` (plantilla con folio, fotos, enlace)                                          | A-15       | Contacto recibe correo             | [ ]    |
| F3-08 | Registro de notificaciones (enviado/error) y reenvío                                                                                          | A-15       | Bitácora visible                   | [ ]    |

### Fase 4 — PWA y endurecimiento

| ID    | Tarea                                          | Alcance | Criterio de aceptación                   | Estado |
| ----- | ---------------------------------------------- | ------- | ---------------------------------------- | ------ |
| F4-01 | PWA instalable (manifest, service worker)      | A-04    | Instalable en Android/iOS                | [ ]    |
| F4-02 | Cola offline de reportes (IndexedDB + sync)    | P-04    | Reporte sin señal se envía al reconectar | [ ]    |
| F4-03 | Pruebas (unit api, e2e flujos críticos)        | —       | CI en verde                              | [ ]    |
| F4-04 | Despliegue (VPS, Nginx, PM2, HTTPS, respaldos) | —       | Producción accesible por HTTPS           | [ ]    |

### Fase 5 — Extras (por confirmar)

| ID    | Tarea                                        | Alcance | Estado |
| ----- | -------------------------------------------- | ------- | ------ |
| F5-01 | Portal de clientes (solo lectura + comentar) | P-05    | [ ]    |
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
sitios(id, cliente_id, nombre, direccion, lat, lng, activo)
sitio_guardia(sitio_id, usuario_id, turno, desde, hasta)

categorias_reporte(id, padre_id?, nombre, icono, activo)
reportes(id, folio, sitio_id, cliente_id, categoria_id, creado_por, titulo, descripcion,
         ubicacion_detalle, prioridad, estatus, lat, lng, fecha_detectado, created_at, cerrado_en)
reporte_evidencias(id, reporte_id, seguimiento_id?, url, mime, tamano, tomada_en, subida_por, created_at)
reporte_seguimientos(id, reporte_id, usuario_id, comentario, estatus_anterior, estatus_nuevo, created_at)
notificaciones(id, reporte_id, contacto_id, canal, enviado_en, estado, error)
```

Estatus de reporte: `abierto → notificado → en_proceso → resuelto → cerrado`

## 5. Matriz de permisos

| Acción        | Admin | Supervisor | Guardia      | Cliente        |
| ------------- | ----- | ---------- | ------------ | -------------- |
| Usuarios      | CRUD  | Ver        | —            | —              |
| Clientes      | CRUD  | CRUD       | —            | —              |
| Crear reporte | Sí    | Sí         | Sus sitios   | —              |
| Seguimiento   | Sí    | Sí         | Sus reportes | Comentar (F5)  |
| Ver reportes  | Todos | Todos      | Sus sitios   | Los suyos (F5) |
