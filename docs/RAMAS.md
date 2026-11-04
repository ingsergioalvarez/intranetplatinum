# Ramas, instalaciones y reglas de despliegue

> Documento de referencia. Leer antes de tocar código, hacer commits o subir algo a producción.
> Creado: 2026-11-03. Solo se modifica si el usuario lo indica.

## Por qué existe esta estructura

El proyecto es **producto nuestro**. Hoy tiene dos usos distintos:

| | **Platinum** | **Comunicalo (gestión)** |
|---|---|---|
| Para quién | Platinum Agency (seguridad física) | Nuestra empresa |
| Concepto | Guardias, sitios, clientes | Áreas, técnicos, home office, RH |
| Estado | Terminado y en uso; solo se mantiene | En construcción, paso a paso |

Los conceptos son muy distintos, pero comparten lo difícil y caro: login, roles y permisos, auditoría, avisos y notificaciones, checador con cámara y rostro, ausencias, horas extra, reporte de asistencia, PWA y modo sin conexión.

**Decisión (acordada con el usuario):** no hacer un proyecto aparte, para no repetir ese trabajo ni mantener dos bases de código desde cero. Tampoco mezclar los dos conceptos en una sola rama, porque **Platinum no debe verse afectado** por lo que se construya para Comunicalo.

Por eso: un solo repositorio, **dos ramas principales** que parten del mismo código, y **dos instalaciones separadas**.

**Platinum queda resguardado:** `main` es la versión estable y respaldada. No se toca a menos que sea necesario (un fallo, una mejora que el usuario pida expresamente o un arreglo que él decida llevarle).

## Las ramas

```
main                 = PLATINUM. Se despliega a la instalación de Platinum.
Alexis-Cambios       = rama de trabajo de Platinum; se une a main al terminar.
gestion-comunicalo   = COMUNICALO. Sale de main (commit 9f572c0, 2026-11-03).
                       Se despliega a la instalación de Comunicalo.
```

- Las ramas **no se unen de vuelta** entre sí por defecto: cada una sigue su camino.
- El nombre `gestion-comunicalo` abarca lo previsto: asistencia administrada por RH, horarios que suben los jefes y planeación de rutas de técnicos. Es solo una etiqueta y se puede renombrar.

## Las instalaciones

Cada instalación es un conjunto de contenedores aparte (API, web y MySQL) **con su propia base de datos**. Nunca se comparte la base entre las dos.

- **Platinum:** la que ya existe (`platinum.grupocomunicalo.mx`).
- **Comunicalo:** mismo servidor de la oficina, contenedores propios y un **subdominio propio** (por definir; ejemplo: `gestion.grupocomunicalo.mx`) por el mismo túnel de Cloudflare. No se comparte dominio ni ruta con Platinum: chocarían las cookies, el service worker de la PWA y el modo sin conexión.

Cada instalación se actualiza **solo cuando el usuario lo indica**, desde **su** rama.

## Reglas (obligatorias)

1. **Una rama a la vez.** Si el usuario dice que se trabaja en Comunicalo, todo cambio queda en `gestion-comunicalo`. Si dice Platinum, en `main` / `Alexis-Cambios`.
2. **No tocar la otra rama** (ni sus archivos, commits o despliegue) a menos que el usuario lo indique expresamente.
3. **No llevar cambios de una rama a la otra por cuenta propia** (ni merge ni cherry-pick). Si un cambio también le sirve a la otra rama (por ejemplo, un arreglo del checador), **avisar al usuario y esperar su decisión**.
4. **Subir a producción solo cuando el usuario lo pida** ("procede", "súbelo a producción"). Se sube **únicamente a la instalación de la rama en la que se está trabajando**.
5. **Antes de dar comandos de despliegue**, confirmar la rama actual (`git branch --show-current`) y a qué instalación corresponden. Los comandos se dan completos (PC y servidor) y con los datos de **esa** instalación: su rama, sus contenedores y su base de datos.
6. **Migraciones de base de datos:** se aplican a la base de la instalación que se despliega. Una migración que llegue a una rama por un merge también se aplica en su base. Revisar que las migraciones de las dos ramas no se estorben (los nombres llevan fecha y hora).
7. **Documentos separados.** `docs/ESTADO.md`, `docs/PLAN.md`, `docs/DECISIONES.md` y `CHANGELOG.md` de Platinum se quedan en `main` y no se llevan a Comunicalo. `gestion-comunicalo` tendrá los suyos con su propia historia. Este documento (`RAMAS.md`) es la excepción: aplica a las dos.
8. **Despliegue de Platinum intacto.** Lo que se construya para Comunicalo no debe cambiar el comportamiento de Platinum. Las diferencias entre instalaciones no se resuelven editando código compartido para una sola de ellas.

9. **No se borra nada.** Ni de Platinum ni de esta rama se elimina código, módulos o datos a menos que el usuario lo pida de forma explícita, y solo en `gestion-comunicalo`. Lo que no se use se apaga (módulos encendibles por empresa), no se elimina.
10. **Esta rama es el producto para cualquier empresa** (DC-006). Comunicalo es su primera empresa; lo propio de una empresa se resuelve como configuración, no como código fijo.

## Carpetas, puertos y bases de datos locales (desde 2026-11-04)

Cada proyecto trabaja en **su propia carpeta de git** (`git worktree`), con su rama, sus puertos y su base local, para que los dos chats puedan trabajar a la vez sin estorbarse:

| | **Platinum** | **Comunicalo** |
|---|---|---|
| Carpeta | `C:\Users\DEVOPS\Videos\intranetplatinum-platinum` | `C:\Users\DEVOPS\Videos\intranetplatinum` |
| Rama | `Alexis-Cambios` (y `main`) | `gestion-comunicalo` |
| API local | 4000 | **4100** (`PORT` en `apps/api/.env`) |
| Web local | 5173 | **5273** (fijo en `apps/web/vite.config.ts`, con `strictPort`) |
| Base local | `platinum_intranet` | `gestion_comunicalo` |

- **No cambiar de rama dentro de una carpeta** y **no usar `git stash`** (se comparte entre carpetas). Cada chat se limita a la suya: no commitea ni modifica la otra; solo puede leerla y avisar al usuario.
- Cada carpeta tiene su propio `apps/api/.env` (no se versiona). El de Comunicalo lleva `PORT=4100` y un `DATABASE_URL` hacia `gestion_comunicalo`. **Nunca apuntar las dos a la misma base**: las migraciones de Comunicalo (empresas, módulos, color de marca) no existen en Platinum y `prisma migrate dev` podría pedir reiniciarla.
- Para rehacer la base local de Comunicalo: crearla vacía, `npm run db:deploy -w @platinum/api`, `db:seed` (con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` en el entorno) y `db:superadmin` para el super admin.
- Respaldos de las bases locales: `C:\Users\DEVOPS\Videos\respaldos-bd-local\` (fuera del proyecto).
- El chat de Platinum documenta en su propia rama cómo se creó su carpeta (`git worktree add`). Cuando la guarde, **alinear los textos compartidos** de este documento; esta sección describe la parte de Comunicalo.
- El `.env` no se lee ni se imprime desde el chat (el sistema lo bloquea): los cambios a ese archivo los hace el usuario.
- **Los dos chats comparten la ventana del IDE (Antigravity), abierta en `intranetplatinum`.** El chat de Comunicalo trabaja en esa carpeta. El de Platinum arranca ahí también, pero debe trabajar en `intranetplatinum-platinum` con rutas completas, `git -C` o un `cd`, y confirmar con `git branch --show-current` que dice `Alexis-Cambios` antes de commitear o desplegar; nunca ejecutar `git`, `npm` ni otro comando en `intranetplatinum`. El usuario le pasó esta indicación a ese chat (2026-11-04). El panel de Git y la terminal del IDE actúan sobre la carpeta abierta (`gestion-comunicalo`): no se usan para Platinum.
- **La memoria de los chats también es compartida** (misma carpeta de proyecto en `~/.claude/projects/`): lo que guarda un chat lo leen los dos. Toda nota debe decir a qué chat o rama se refiere. `chat-solo-platinum` la escribió el chat de Platinum y es una regla de ese chat, no del de Comunicalo (ver `chats-por-rama`).
- Quien opera las bases locales es Claude: el usuario no maneja sus datos de conexión. Platinum se trabaja directo hacia producción y casi no usa lo local; Comunicalo se trabaja solo en local y no se despliega hasta que el usuario lo pida.

## Pendientes por definir (poco a poco)

- ~~Subdominio y despliegue~~: definidos (`gestion.grupocomunicalo.mx`, túnel `gestion-comunicalo`, proyecto Docker `comunicalo`, puerto 5191). Falta el DNS (C-02).
- ~~Separar los documentos~~: hecho en `gestion-comunicalo`; los de Platinum quedan archivados en `docs/platinum/`.
- Cómo se generaliza "sitio" hacia áreas, técnicos y home office.
- Menús visibles en Comunicalo (por ejemplo, empezar solo con Asistencia) sin afectar a Platinum.
- Correo (SMTP): se aborda cuando se fusionen ambos conceptos; ERPModular ya envía correos desde `smtp.uservers.net`.
- Posible conexión con ERPModular (empresas, áreas, centros de costos).
