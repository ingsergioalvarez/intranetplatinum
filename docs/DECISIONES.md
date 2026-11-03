# Decisiones — Comunicalo (gestión)

> Las decisiones de Platinum (`D-xxx`) están archivadas en [platinum/DECISIONES.md](platinum/DECISIONES.md). Aquí se numeran como `DC-xxx`.

| ID | Tema | Estado | Detalle | Fecha | Alcances |
|---|---|---|---|---|---|
| DC-001 | Un solo repositorio con dos ramas principales | ACEPTADA | Comunicalo reutiliza el código de Platinum (login, checador, avisos, asistencia) en lugar de un proyecto aparte, para no repetir el trabajo. Las dos ramas siguen caminos separados para que Platinum no se vea afectado. Detalle y reglas en [RAMAS.md](RAMAS.md). | 2026-11-03 | C-01 |
| DC-002 | Instalación separada por rama | ACEPTADA | Cada rama se despliega en su propia instalación: contenedores propios, base de datos propia y subdominio propio. Nunca se comparte la base ni el dominio con Platinum (chocarían cookies, service worker y modo sin conexión). | 2026-11-03 | C-01, C-02 |
| DC-003 | Túnel de Cloudflare propio | ACEPTADA | Túnel `gestion-comunicalo`, como el de Platinum, escáner y arco (uno por aplicación). Subdominio `gestion.grupocomunicalo.mx`. | 2026-11-03 | C-02 |
| DC-004 | Nombre de la rama | ACEPTADA | `gestion-comunicalo`: abarca asistencia administrada por RH, horarios y rutas de técnicos. Es solo una etiqueta y se puede renombrar. | 2026-11-03 | C-01 |
| DC-005 | Documentos separados y Platinum archivado | ACEPTADA | `ESTADO`, `PLAN`, `DECISIONES` y `CHANGELOG` de Comunicalo empiezan nuevos. Los de Platinum se conservan en `docs/platinum/` como contexto, sin actualizarse. | 2026-11-03 | C-01 |
