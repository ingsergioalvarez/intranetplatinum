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
- Acceso a un servidor MySQL 8 (corre en otra máquina, ver D-008). No es necesario para desarrollar la web ni correr las pruebas.

## Arranque rápido

```bash
npm install                                  # instala todo y genera el cliente Prisma
cp apps/api/.env.example apps/api/.env       # configurar variables (ver abajo)
cp apps/web/.env.example apps/web/.env
npm run dev                                  # API :4000 + Web :5173
```

Abrir http://localhost:5173. Mientras no exista el login real (F1-03), en desarrollo la pantalla de acceso ofrece **sesiones demo** por rol. El catálogo de componentes está en `/ui`.

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
