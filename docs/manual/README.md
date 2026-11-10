# Manual de usuario de Platinum Intranet (A-44)

Esta carpeta es la **fuente única** del manual. Se edita aquí, en texto (`.md`). De estos mismos archivos sale la pantalla de **Ayuda** de la app (icono "?"), que se empaqueta con la app: se lee sin conexión y solo entrando con cuenta. Cada rol ve su manual; el administrador ve todos.

El **PDF** (`npm run manual`) se genera solo en local, en `docs/manual/pdf/` (no se sube a git ni se publica en el dominio). **No se edita a mano.**

## Archivos

| Archivo | Contenido |
|---|---|
| `comun.md` | Lo que todos hacen igual: instalar, notificaciones, entrar, PIN, campanita, aviso de privacidad. Se incluye en cada manual. |
| `guardia.md` | Manual del Guardia (checador, SOS, sitios, reportes, ausencias, cambios de turno). |
| `supervisor.md` | Manual del Supervisor (asistencia, decisiones, cobertura, reportes, quejas, clientes y sitios, turnos). |
| `admin.md`, `cliente.md` | Por escribir. |
| `capturas/` | Imágenes del manual y `PENDIENTES.md` con la lista de las que faltan. |

**Cómo se arma cada manual:** Guardia = `comun.md` + `guardia.md`. Supervisor = `comun.md` + `supervisor.md`. Y así con cada rol. El **Manual completo** (para el administrador) junta todo.

## Cómo se escribe

- Español sencillo, frases cortas, tuteo, pasos numerados. Una sección por **tarea**, no por pantalla.
- Los textos de botones y mensajes van **tal cual aparecen en la app**, entre comillas o en negritas.
- Un dato que no se pudo confirmar en el código no se inventa: se pregunta o se marca.

## Capturas

Donde va una imagen se escribe un marcador en una línea sola:

```
{{captura:G01-checador|Pantalla del Checador con sus botones}}
```

- `G01-checador` es el nombre del archivo (`capturas/G01-checador.png`); la parte después de `|` describe qué debe verse.
- Si el archivo existe, se muestra la imagen. Si no, se muestra un recuadro gris **"Captura pendiente: …"**.
- Prefijos: `C` = parte común, `G` = guardia (después `S` = supervisor, `A` = administrador, `K` = cliente).
- La lista de pendientes está en [capturas/PENDIENTES.md](capturas/PENDIENTES.md).

## Cuando cambia la app

Si un cambio altera una pantalla o un texto, se corrige el párrafo y la captura afectada en el `.md` y se regenera. Así el manual no se desactualiza.
