# Changelog — Comunicalo (gestión)

Cada entrada referencia las tareas (`C-xx`) del [PLAN](docs/PLAN.md) y las decisiones (`DC-xxx`) de [DECISIONES](docs/DECISIONES.md).
El changelog de Platinum está archivado en [docs/platinum/CHANGELOG.md](docs/platinum/CHANGELOG.md).

## [Sin publicar]

### Sesión 2026-11-03 — Arranque de Comunicalo (C-01, C-02)

#### Añadido

- Rama `gestion-comunicalo`, creada a partir de `main` (commit `9f572c0`) con todo el trabajo de Platinum hasta esa fecha.
- [docs/RAMAS.md](docs/RAMAS.md): por qué existen dos ramas, cómo se separan las instalaciones y las reglas de despliegue.
- Archivos de despliegue propios en `deploy/`: proyecto Docker `comunicalo`, base `gestion_comunicalo`, puerto local 5191, túnel `gestion-comunicalo` y dominio `gestion.grupocomunicalo.mx`.
- Túnel de Cloudflare `gestion-comunicalo` creado en el servidor (falta el registro DNS).
- Documentos propios de Comunicalo: `ESTADO`, `PLAN`, `DECISIONES` y este `CHANGELOG`.

#### Cambiado

- `ESTADO`, `PLAN`, `DECISIONES` y `CHANGELOG` de Platinum se movieron a `docs/platinum/` como archivo de contexto.
