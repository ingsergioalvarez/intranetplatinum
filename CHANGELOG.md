# Changelog — Comunicalo (gestión)

Cada entrada referencia las tareas (`C-xx`) del [PLAN](docs/PLAN.md) y las decisiones (`DC-xxx`) de [DECISIONES](docs/DECISIONES.md).
El changelog de Platinum está archivado en [docs/platinum/CHANGELOG.md](docs/platinum/CHANGELOG.md).

## [Sin publicar]

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

#### Cambiado

- Paleta de toda la app apagada: el color principal (botones, ítem activo del menú, enlaces) pasa del azul eléctrico al azul del resplandor del login (`#0b3263`), con tonos intermedios y claros armonizados. El azul eléctrico queda solo en el ícono.
- Textos que decían Platinum: modal de contraseña temporal, verificación pública de informes, PDF y Excel de informes, PDF de horarios, remitente de correo por defecto y nombre del servicio de la API.

- `ESTADO`, `PLAN`, `DECISIONES` y `CHANGELOG` de Platinum se movieron a `docs/platinum/` como archivo de contexto.
