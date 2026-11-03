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
| C-05 | Imagen de marca de Comunicalo: paleta propia armada con los colores del ícono (azul marino, azul eléctrico, cian y degradado), login con el ícono y el nombre "Gestión Comunicalo" en dos tonos, título y color del navegador. Después: menú lateral, íconos de la app instalada (192/512, iPhone, notificaciones) y nombre de la app. Sin cambios de funcionamiento | Usuario 2026-11-03 | [~] En curso: paleta y login (en local para revisión del usuario) |

## Ideas por definir (sin ID hasta que el usuario las pida)

Se van concretando poco a poco; no se implementa nada de esta lista sin pasar a la matriz de arriba.

- Menú reducido en Comunicalo (por ejemplo, empezar viendo solo Asistencia) sin afectar a Platinum; incluye bloquear las rutas, no solo esconder los botones.
- Generalizar "sitio" hacia áreas, home office y técnicos en campo.
- RH administra la asistencia.
- Más adelante: los jefes suben los horarios de las personas y planean las rutas de los técnicos.
- Correo (SMTP): se aborda al fusionar ambos conceptos; ERPModular ya envía correos desde `smtp.uservers.net`.
- Posible conexión con ERPModular (empresas, áreas y centros de costos).
- Pendiente heredado de Platinum, sin decidir: costo de bcrypt (12 → 10 o hilos) por el inicio de sesión lento en ráfaga.
