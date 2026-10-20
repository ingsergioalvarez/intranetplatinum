# Intranet Platinum Agency

Intranet para Platinum Agency (seguridad física intramuros). Uso principal en **celular** por guardias; escritorio para supervisores y administración.

- **Plan y trazabilidad:** [docs/PLAN.md](docs/PLAN.md) · **Estado actual:** [docs/ESTADO.md](docs/ESTADO.md) · **Decisiones:** [docs/DECISIONES.md](docs/DECISIONES.md) · **Historial:** [CHANGELOG.md](CHANGELOG.md)

## Stack

| Capa     | Tecnología                                                                        |
| -------- | --------------------------------------------------------------------------------- |
| Web      | React 18, Vite, TypeScript, Tailwind CSS 4, TanStack Query, Zustand, React Router |
| API      | Node.js, Express 5, TypeScript, zod, JWT                                          |
| BD       | MySQL 8 con Prisma 7 (adaptador MariaDB/MySQL)                                    |
| Calidad  | ESLint, Prettier, Vitest + supertest                                              |
| Monorepo | npm workspaces: `apps/api`, `apps/web`, `packages/shared`                         |

## Requisitos

- Node.js 20 o superior (desarrollado con Node 24) y npm 10+.
- MySQL 8: local para pruebas o el servidor de la otra máquina (D-008). No es necesario para correr las pruebas automáticas.

## Cómo arrancar la app (día a día)

Con MySQL encendido (servicio `MySQL80` en Windows), desde la carpeta raíz del proyecto:

```bash
npm run dev
```

- Web: http://localhost:5173 (desde el celular en la misma red: la dirección "Network" que muestra la terminal).
- API: http://localhost:4000/api/health
- Para detenerla: `Ctrl + C` en la terminal donde corre.

Si acabas de bajar cambios (`git pull`) o es otra PC, antes de `npm run dev`:

```bash
npm install                              # dependencias y cliente Prisma
npm run db:deploy -w @platinum/api       # aplica migraciones nuevas
```

## Arranque rápido (primera vez en una PC)

Requisitos: Node 20+, git y MySQL 8 instalado y encendido en la PC (con el usuario `root` o uno con permiso para crear bases).

```bash
git clone https://github.com/ingsergioalvarez/intranetplatinum.git
cd intranetplatinum
npm install                                  # instala todo y genera el cliente Prisma
npm run db:setup -- --url "mysql://root:TU_CLAVE@localhost:3306/platinum_intranet?allowPublicKeyRetrieval=true"
npm run dev                                  # API :4000 + Web :5173
```

`npm run db:setup` es el constructor de la base de datos local:

1. Crea `apps/api/.env` (con secretos JWT aleatorios) y `apps/web/.env` si no existen; guarda la `--url` como `DATABASE_URL`.
2. Crea la base de datos si no existe (utf8mb4).
3. Aplica todas las migraciones y el seed (roles, permisos, administrador y catálogo de categorías).
4. Si `SEED_ADMIN_PASSWORD` está vacío, genera una contraseña, la guarda en `apps/api/.env` y la muestra en pantalla.

Se puede volver a correr sin riesgo (solo aplica lo que falte). `npm run db:setup -- --reset` borra y recrea la base desde cero (solo con MySQL local). Si `.env` ya tiene la `DATABASE_URL`, basta con `npm run db:setup`.

Abrir http://localhost:5173 e iniciar sesión con el administrador (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` de `apps/api/.env`). El catálogo de componentes está en `/ui` (solo desarrollo).

Para probar desde el celular en la misma red, usar la dirección "Network" que muestra Vite (ej. `http://192.168.x.x:5173`).

## Base de datos

Configurar en `apps/api/.env`:

```env
DATABASE_URL=mysql://usuario:password@HOST:3306/platinum_intranet
SEED_ADMIN_EMAIL=admin@tuempresa.com
SEED_ADMIN_PASSWORD=una-contraseña-segura
```

Luego, con acceso al servidor:

```bash
npm run db:deploy -w @platinum/api   # aplica migraciones pendientes
npm run db:seed   -w @platinum/api   # roles, permisos y administrador inicial
npm run db:status -w @platinum/api   # estado de migraciones
```

Cambios de esquema: editar `apps/api/prisma/schema.prisma` y generar la migración SQL (ver CLAUDE.md, D-011).

## Scripts (raíz)

| Script                                    | Descripción                           |
| ----------------------------------------- | ------------------------------------- |
| `npm run dev`                             | API y web en modo desarrollo          |
| `npm run dev:api` / `npm run dev:web`     | Solo uno de los dos                   |
| `npm test`                                | Pruebas (Vitest)                      |
| `npm run typecheck`                       | Verificación de tipos en todo el repo |
| `npm run lint` / `npm run lint:fix`       | ESLint                                |
| `npm run format` / `npm run format:check` | Prettier                              |
| `npm run build`                           | Compila shared, API y web             |

## Estructura

```
apps/
  api/                 API REST (Express)
    prisma/            esquema, migraciones y seed
    src/core/          clases base (BaseController, CrudService, BaseRepository), middlewares, seguridad
    src/modules/       módulos verticales (health, auth, usuarios, clientes, reportes…)
    test/              pruebas Vitest + supertest
  web/                 PWA React
    src/core/          ApiClient, CrudService, sesión, rutas protegidas
    src/components/ui/ librería de componentes reutilizables
    src/components/layout/ AppShell (sidebar escritorio, navegación inferior celular)
    src/modules/       pantallas por módulo
packages/
  shared/              tipos, constantes (roles, permisos, estatus) y esquemas zod compartidos
docs/                  plan, estado y decisiones
```

## Convenciones

Ver [CLAUDE.md](CLAUDE.md): protocolo de sesión, arquitectura por módulos, borrado lógico, validación con zod, mobile-first.
