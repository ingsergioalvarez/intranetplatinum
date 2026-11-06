# Estado actual — Comunicalo (gestión): ¿dónde nos quedamos?

> Se sobrescribe al final de cada sesión. El historial está en [CHANGELOG.md](../CHANGELOG.md).
> Esta es la rama `gestion-comunicalo`. Lo de Platinum está archivado en [platinum/](platinum/LEEME.md) y su versión viva en `main`.

**Última actualización:** 2026-11-06
**Fase actual:** En el servidor, `https://gestion.grupocomunicalo.mx` sigue como borrador (copia de Platinum, con el login nuevo de C-05 solo si se despliega). Lo nuevo (C-05 a C-14: marca, plataforma, empresas y módulos guardados) se trabaja **solo en local**; el usuario no ha desplegado nada de esto.
**Última tarea terminada:** C-11 parte 4 (alcance por rol), en local; las partes 1 a 3 y lo anterior ya están en GitHub.
**Tarea en progreso:** C-11 (roles y permisos): hechas las partes 1 a 4; falta la 5 (pantallas de Roles y permisos y permisos por persona). Después, C-21 (personas que marcan por permiso). Nada está desplegado.

## Siguiente paso

0. Seguir el plan de [PLAN.md](PLAN.md), en orden. El usuario sigue revisando en local (`http://localhost:5273`); cuando pida desplegar, C-05, C-07 y C-14 van juntos (14 migraciones nuevas: `db:deploy` y luego `db:seed`; todos deben iniciar sesión de nuevo; en el servidor `almartinez` probablemente ya es super admin porque el seed marca al primer admin). Después C-10 (estructura), C-11 (roles y permisos), C-12 (checador flexible y rostro obligatorio), C-13 (planeador de horarios). Decisiones en DC-006 a DC-009.
1. El usuario define, poco a poco, lo primero que debe hacer Comunicalo; se agrega al [PLAN](PLAN.md) con su ID antes de implementarlo.
2. C-04 (respaldos de la base y las fotos de Comunicalo) antes de usarlo con personas reales.

## Bloqueos / pendientes del usuario

- Cambiar la contraseña del administrador (quedó escrita en el chat al crearla).
- Nada más por ahora.

## Cómo levantar en local

- `npm run dev` en esta carpeta: web en `http://localhost:5273` y API en `http://localhost:4100` (celular: `http://<IP de la PC>:5273`).
- Base local `gestion_comunicalo` (59 migraciones: las 45 de Platinum más `empresas`, `empresas_color_modo`, `empresa_en_todo`, `turnos_nombre_por_empresa`, `unicos_por_empresa`, `areas`, `quitar_carteras`, `quitar_rol_cliente`, `usuario_permisos`, `quitar_reportes`, `quitar_contactos_cliente`, `area_supervisores`, `roles_por_empresa` y `alcance_por_rol`). El `apps/api/.env` lleva `PORT=4100` y el `DATABASE_URL` hacia esa base. Detalle y reglas de las dos carpetas en [RAMAS.md](RAMAS.md).
- Cuentas locales: `almartinez@comunicalo.mx` (super admin) y `admin@comunicalo.com` (admin de Comunicalo, para pruebas).

## Cómo está desplegado

- Servidor de la oficina, carpeta `~/comunicalo/deploy`, proyecto Docker `comunicalo` (contenedores `comunicalo-mysql-1`, `-api-1`, `-web-1`, `-tunnel-1`).
- Base `gestion_comunicalo` (45 migraciones aplicadas; las 14 nuevas de C-07, C-14, C-08, C-10, C-11, C-18, C-19 y C-20 están sin desplegar), puerto local 5191, túnel `gestion-comunicalo` (`14edb25a-d16d-4757-835c-2127225af245`), dominio `gestion.grupocomunicalo.mx`.
- El `.env` vive solo en el servidor (no está en git). Claves de push generadas una sola vez: no cambiarlas.
- Actualizar: desde la rama `gestion-comunicalo` hacer `git archive` y `scp` a `~/comunicalo`, y en `~/comunicalo/deploy`: `docker compose up -d --build` (más `docker compose exec api npm run db:deploy` si hay migraciones). Ver [DESPLIEGUE.md](DESPLIEGUE.md) y las reglas de [RAMAS.md](RAMAS.md).

## Notas de contexto

- Módulos (DC-015): Comunicalo arranca con núcleo + Bitácora + SOS + Turnos y horarios + Reporte de asistencia; lo demás se agrega cuando el usuario lo pida. Una empresa nueva arranca solo con el núcleo. Hasta C-09 los interruptores solo se guardan.
- Hay dos chats (Platinum y Comunicalo) en la misma ventana del IDE, abierta en esta carpeta; el de Platinum trabaja en `intranetplatinum-platinum`. La memoria de los chats es compartida: toda nota debe decir a qué chat se refiere. Detalle en [RAMAS.md](RAMAS.md) y DC-013.
- Rama de trabajo: `gestion-comunicalo` (sale de `main`, commit `9f572c0`). Reglas obligatorias en [RAMAS.md](RAMAS.md).
- El seed trajo los datos de Platinum (26 categorías de reporte de seguridad, 20 permisos, 4 roles); se ajustarán a Comunicalo más adelante.
- Producto: asistencia administrada por RH para áreas, técnicos y home office. Más adelante, horarios que suben los jefes y planeación de rutas de técnicos (ideas, sin ID todavía).
