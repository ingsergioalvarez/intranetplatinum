# Relevo de sesión — Para Claude (2026-11-06)

> Documento de continuidad técnica para que Claude conozca exactamente qué cambios se realizaron en la rama `gestion-comunicalo`, por qué, qué archivos se crearon o modificaron, y qué verificaciones pasaron durante la pausa por límite de 5 horas (`You've hit your 5-hour limit · resets 2:10pm`).

---

## 1. Contexto del relevo

En la sesión de Claude (`e377cb16-3844-44f8-8c55-96b7fdf3c022`), tras terminar la **parte 4 de C-11** (`84a5795`), Claude presentó el boceto en texto plano de la **parte 5 de C-11 (Pantallas de Roles y permisos y permisos por persona)** y planteó **3 preguntas de diseño**.

El usuario respondió aprobando las 3 decisiones y pidió proceder (`19:36:45 UTC`), momento exacto en que saltó el límite de uso de Claude:

1. **Al designar jefe o supervisor de un área, ¿qué pasa con quien ya tiene un rol propio?**
   - **Acordado:** El rol solo cambia automáticamente si la persona es `colaborador` (o `supervisor` cuando pasa a ser `jefe`). Si tiene un rol personalizado (por ejemplo `"Nómina"`) o es `admin`, se respeta su rol y la designación únicamente la mueve al área.
2. **Permisos individuales: ¿cualquiera del catálogo?**
   - **Acordado:** Sí, cualquiera de `CATALOGO_PERMISOS` **excepto `roles.administrar`**, para que el poder de administrar roles solo se otorgue mediante un rol y no por permisos sueltos.
3. **Atajo "RH":**
   - **Acordado:** La casilla *"Recibe y atiende las emergencias de la empresa (RH)"* otorga (y quita) en un solo paso ambos permisos (`emergencias.recibir` y `emergencias.atender`), para que quien las reciba pueda también abrirlas y cerrarlas.

---

## 2. Qué se construyó (C-11 Parte 5 completa, en local)

### A. Esquemas y tipos compartidos (`@platinum/shared`)
- **Nuevo archivo** [packages/shared/src/schemas/roles.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/packages/shared/src/schemas/roles.ts) (exportado en [packages/shared/src/index.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/packages/shared/src/index.ts)):
  - `PERMISOS_CATALOGO_CLAVES`: las 33 claves editables de `CATALOGO_PERMISOS`.
  - `PERMISOS_INDIVIDUALES_CLAVES`: las 32 claves de `CATALOGO_PERMISOS` excluyendo `roles.administrar`.
  - `RolEmpresa`: `{ id, clave, nombre, esBase, alcance, permisos, personas }`.
  - `rolCreateSchema` (`{ nombre, aPartirDeId }`), `rolUpdateSchema` (`{ nombre?, alcance?, permisos? }`) y `usuarioPermisosSchema` (`{ permisos }`).
- **Actualizado** [packages/shared/src/schemas/usuarios.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/packages/shared/src/schemas/usuarios.ts):
  - `rol` en `usuarioCreateSchema`, `usuarioUpdateSchema` y `usuarioFiltroSchema` acepta cualquier clave de rol válida (`[a-z0-9_]{1,30}`) para soportar los roles creados por la empresa (la existencia del rol en la empresa se valida en `UsuariosService`).
  - `Usuario` expone ahora `rolNombre?: string` y `permisosPropios?: Permiso[]`.

### B. Backend (`apps/api`)
- **Suma de permisos individuales en sesión:**
  - [apps/api/src/modules/auth/auth.repository.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/src/modules/auth/auth.repository.ts): `usuarioAuthInclude` incluye `permisosPropios: { include: { permiso: true } }` y `toUsuarioAuth` une los permisos del rol con `permisosPropios` sin duplicados. Así el JWT lleva los permisos del rol + los individuales al iniciar o renovar sesión.
- **Respeto a roles personalizados al designar Jefe/Supervisor en Áreas:**
  - [apps/api/src/modules/areas/areas.service.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/src/modules/areas/areas.service.ts): en `hacerJefe`, solo se cambia el rol a `ROLES.JEFE` si el usuario tenía `ROLES.COLABORADOR` o `ROLES.SUPERVISOR` (`fijarSupervisores` ya verificaba `u.rol === ROLES.COLABORADOR`). Quien tenga un rol propio (ej. `"nomina"`) conserva su rol.
- **Nuevo módulo `/api/roles`:**
  - [apps/api/src/modules/roles/roles.repository.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/src/modules/roles/roles.repository.ts)
  - [apps/api/src/modules/roles/roles.service.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/src/modules/roles/roles.service.ts)
  - [apps/api/src/modules/roles/index.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/src/modules/roles/index.ts)
  - Registrado en [apps/api/src/modules/index.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/src/modules/index.ts).
  - Rutas protegidas con `requirePermission(PERMISOS.ROLES_ADMINISTRAR)` y acotadas por empresa (`extensionEmpresa`):
    - `GET /api/roles` — lista primero los 4 roles base en orden (`admin`, `jefe`, `supervisor`, `colaborador`) y luego los creados por la empresa en orden alfabético, con conteo de personas activas (`deletedAt: null`).
    - `GET /api/roles/:id` — detalle de un rol.
    - `POST /api/roles` — crea un rol nuevo "a partir de" otro (`aPartirDeId`), copiando su `alcance` y sus `permisos` (conservando permisos heredados no editables como `clientes.*` o `catalogos.administrar` si el rol origen no es admin), generando su `clave` única y auditando `roles.crear`.
    - `PATCH /api/roles/:id` — edita `nombre`, `alcance` y/o `permisos` de `CATALOGO_PERMISOS` (preservando permisos heredados fuera del catálogo editable). Bloquea con `400` cualquier intento de modificar `admin`. Audita `roles.editar` con `{ antes, despues }`.
    - `DELETE /api/roles/:id` — bloquea con `409` si `esBase` es `true` o si `personas > 0`. Si hubiera usuarios dados de baja con ese `rolId`, los reasigna a `colaborador` antes de borrar para no violar la llave foránea. Audita `roles.eliminar`.
- **Permisos individuales y validación de rol en Usuarios:**
  - [apps/api/src/modules/usuarios/usuarios.repository.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/src/modules/usuarios/usuarios.repository.ts)
  - [apps/api/src/modules/usuarios/usuarios.service.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/src/modules/usuarios/usuarios.service.ts)
  - [apps/api/src/modules/usuarios/usuarios.controller.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/src/modules/usuarios/usuarios.controller.ts)
  - [apps/api/src/modules/usuarios/index.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/src/modules/usuarios/index.ts)
  - Nuevo endpoint `PUT /api/usuarios/:id/permisos` con `requirePermission(PERMISOS.ROLES_ADMINISTRAR)`: guarda `usuario_permisos`, aplica el atajo RH (`emergencias.recibir` agrega automáticamente `emergencias.atender`), rechaza `roles.administrar` con `400` y audita `usuarios.permisos` con `{ antes, despues }`.

### C. Frontend (`apps/web`)
- **Módulo de Roles y permisos:**
  - [apps/web/src/modules/roles/roles.service.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/roles/roles.service.ts)
  - [apps/web/src/modules/roles/RolesPage.tsx](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/roles/RolesPage.tsx) — tabla en escritorio y tarjetas en celular (`360px`) con Rol, Personas, Alcance, Permisos (`X de 33` o `Todos (33)`) y Tipo (`Base · fijo`, `Base`, `Creado por ti`).
  - [apps/web/src/modules/roles/NuevoRolModal.tsx](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/roles/NuevoRolModal.tsx) — modal para crear un rol eligiendo nombre y de qué rol copiar permisos y alcance; al crearlo navega directo a `/roles/:id`.
  - [apps/web/src/modules/roles/RolDetallePage.tsx](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/roles/RolDetallePage.tsx) — edición de nombre y alcance (con texto explicativo debajo según el alcance elegido), tarjetas por cada uno de los 12 grupos de `GRUPOS_PERMISOS` con contador `activos/total` y botón rápido `Todos / Ninguno`, botón `Eliminar rol` (para roles no base sin personas) y aviso de bloqueo cuando se consulta el rol Administrador.
- **Ficha y lista de Usuarios:**
  - [apps/web/src/modules/usuarios/usuarios.service.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/usuarios/usuarios.service.ts) — método `fijarPermisos`.
  - [apps/web/src/modules/usuarios/UsuariosPage.tsx](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/usuarios/UsuariosPage.tsx) — filtro de rol alimentado con los roles de la empresa y columna Rol mostrando `u.rolNombre`.
  - [apps/web/src/modules/usuarios/UsuarioModal.tsx](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/usuarios/UsuarioModal.tsx) — selector de rol dinámico con los roles de la empresa y sección **Permisos adicionales (solo para esta persona)** con las 2 casillas principales arriba (*Recibe y atiende las emergencias de la empresa (RH)* y *Ver a todas las personas de la empresa*) más el desplegable *Otros permisos individuales* donde los permisos ya incluidos por su rol se muestran marcados con insignia `Por su rol`.
- **Rutas, menú y etiquetas de rol:**
  - [apps/web/src/app/router.tsx](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/app/router.tsx) — rutas `/roles` y `/roles/:id` con `<ProtectedRoute permiso={PERMISOS.ROLES_ADMINISTRAR}>`.
  - [apps/web/src/components/layout/navItems.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/components/layout/navItems.ts) — ítem `Roles y permisos` (`/roles`, `permiso: PERMISOS.ROLES_ADMINISTRAR`).
  - Fallback `ROL_DESCRIPCIONES[x.rol] ?? x.rol` en `AppShell.tsx`, `AreasPage.tsx`, `ElegirPersonaModal.tsx` y `LoginPage.tsx`.

---

## 3. Pruebas y verificación

- **Pruebas unitarias e integración (`npm test`):**
  - Nuevo [apps/api/test/roles.test.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/test/roles.test.ts) (6 pruebas).
  - Ampliado [apps/api/test/usuarios.test.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/test/usuarios.test.ts) (permisos individuales, atajo RH, bloqueo de `roles.administrar`, validación de rol existente).
  - Actualizado [apps/api/test/rutas-por-permiso.test.ts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/test/rutas-por-permiso.test.ts) (`['roles', P.ROLES_ADMINISTRAR, []]`).
- **Verificación de extremo a extremo (`npm run verificar:aislamiento -w @platinum/api`):**
  - Añadida sección **16. Pantalla y API de Roles y permisos + permisos por persona (C-11 parte 5)** en [apps/api/scripts/verificar-aislamiento.mts](file:///C:/Users/DEVOPS/Videos/intranetplatinum/apps/api/scripts/verificar-aislamiento.mts).
- **No se requirieron migraciones nuevas de base de datos** (las tablas `roles`, `rol_permiso` y `usuario_permisos` ya quedaron listas en las partes 1 a 4).

---

## 4. Qué sigue al retomar con Claude

1. **C-11 está completa (partes 1 a 5).**
2. **Siguiente tarea en el plan:** **C-21** (*Personas que marcan, por permiso `asistencia.marcar` y no por la clave del rol `colaborador`*), para que las personas con roles nuevos que tengan `asistencia.marcar` aparezcan en las listas de horarios, ausencias, cambios de turno, horas extra, bitácora, informes, grupos y cobertura.
3. Después de C-21, continúa **C-12** (Checador flexible y rostro obligatorio) y **C-13** (Planeador de horarios).
