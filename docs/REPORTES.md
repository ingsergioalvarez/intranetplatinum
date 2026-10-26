# Módulo de Reportes y Operación en Sitio

> Documento vivo y trazable para el módulo de reportes, relevo de consignas operativas y canal oficial con supervisión y clientes.
>
> **Estados:** `[ ]` pendiente · `[~]` en progreso · `[x]` terminada · `[-]` descartada

---

## 1. Visión y Reglas de Negocio

1. **Canal Oficial sin WhatsApp:** La intranet es la única fuente de verdad formal. Toda novedad, daño o incidencia se reporta y atiende aquí con fecha, hora de servidor y evidencias.
2. **Relevo de Consignas (Entrega de Turno):** Al terminar y comenzar turno, el guardia entrega/recibe 3 activos críticos del sitio: **Celular del sitio**, **Llaves** y **Teléfono fijo**. Cualquier falla genera reporte inmediato de relevo.
3. **Visibilidad para el Cliente:** El cliente (RH / Administración del sitio) tendrá acceso en modo consulta para ver cumplimiento de turnos/asistencias e incidencias de su inmueble, con capacidad de agregar comentarios de seguimiento.

---

## 2. Matriz de Fases y Tareas

| Fase       | ID     | Tarea / Alcance                                         | Estado | Detalle                                                                                                                                                                                                                 |
| ---------- | ------ | ------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fase 1** | REP-01 | Claridad en horario programado de asistencia            | [x]    | Reemplazar "Debía" por `Entra a las <hora>` y `Sale a las <hora>` en `HoraMarca.tsx`.                                                                                                                                   |
| **Fase 2** | REP-02 | Comprobante visual de reporte enviado                   | [x]    | Ficha comprobante oficial con folio, primera foto, sitio, prioridad y hora de servidor al terminar el wizard en `NuevoReportePage.tsx`.                                                                                 |
| **Fase 2** | REP-03 | Rediseño de la Ficha Oficial del Reporte                | [x]    | Layout responsivo 2 columnas escritorio (7/12 ficha e incidencias, 5/12 seguimiento), semáforo de prioridad, galería de evidencias táctil y visor modal de alta resolución en `ReporteDetallePage.tsx` y `Galeria.tsx`. |
| **Fase 2** | REP-04 | Hilo de seguimiento bidireccional sincronizado          | [x]    | Bitácora oficial de seguimiento con cambios de estatus, fotos y comentarios, con invalidación en tiempo real de consultas y campanita de avisos.                                                                        |
| **Fase 2** | REP-05 | Experiencia de reportes y vista por sitio (`/reportes`) | [x]    | Pestañas del guardia ("Mis reportes" vs "Del sitio: [Nombre]"), banner de sitio con enlace directo, píldoras rápidas de estatus, soporte para `?sitioId=` y `?tab=` en `ReportesPage.tsx`.                              |
| **Fase 3** | REP-06 | Coberturas en selector de sitios (DA-46)                | [x]    | Incluir el sitio cubierto hoy en `sitiosReportables` y en visibilidad para que el guardia pueda consultar y reportar ahí sin fallas de autorización.                                                                    |
| **Fase 4** | REP-07 | Checklist de entrega de turno (Salida)                  | [x]    | Verificación interactiva de celular, llaves y teléfono fijo antes de checar salida con `RelevoTurnoModal`.                                                                                                              |
| **Fase 4** | REP-08 | Checklist de recepción de turno (Entrada)               | [x]    | Confirmación de recepción conforme de los 3 activos o generación de reporte oficial inmediato con fotos obligatorias antes de checar entrada.                                                                           |
| **Fase 5** | REP-09 | Portal de consulta para el Cliente                      | [x]    | Vista ejecutiva de asistencias de sus guardias y reportes del inmueble para RH/Admin del cliente, con opción de comentar e interacción de campanita.                                                                    |

---

## 3. Registro de Avance

- **2026-10-23:** Implementada Fase 1 (REP-01). Etiquetas de asistencia actualizadas a "Entra a las" / "Sale a las". Pruebas en verde (215/215).
- **2026-10-23:** Implementada Fase 2 (REP-02 a REP-05):
  - Comprobante oficial con folio, estatus e indicación de campanita tras envío en `NuevoReportePage.tsx`.
  - Ficha oficial con semáforo, visor de alta resolución en `Galeria.tsx` y distribución 2 columnas 7/12 y 5/12 en `ReporteDetallePage.tsx`.
  - Pestañas del guardia ("Mis reportes" vs "Del sitio"), píldoras rápidas de estatus (`Todos`, `Abiertos`, `En proceso`, `Resueltos`, `Cerrados`), y banner contextual de sitio con lectura de `?sitioId=` en `ReportesPage.tsx`.
  - Sincronización completa con notificaciones de campanita (`avisos` invalidation).
- **2026-10-23:** Panel de Supervisor / Admin:
  - Nueva columna "Reportó" en la tabla de `/reportes`.
  - Nuevo selector de filtro por usuario que reportó (`?creadoPorId=`), compatible con búsqueda rápida por texto de nombre de guardia.
  - Igualdad operativa plena entre Administradores y Supervisores en el módulo de reportes.
- **2026-10-23:** Implementada Fase 4 (REP-07 y REP-08):
  - Nuevo componente `RelevoTurnoModal.tsx` interceptando la marcación de entrada y salida en `MarcarPage.tsx`.
  - Verificación de los 3 activos críticos del inmueble: **Celular del sitio**, **Llaves del inmueble** y **Teléfono fijo**.
  - Flujo ágil con botones `[✓ Conforme]` preseleccionados (1 clic para avanzar a la cámara).
  - Flujo de novedad: si cualquier activo tiene novedad, despliega captura de descripción (mínimo 10 caracteres) y uploader de evidencias fotográficas obligatorias (mínimo 1 foto), levantando reporte automático de alta prioridad en la intranet y alertando a supervisión.
- **2026-10-23:** Implementada Fase 3 (REP-06 / DA-46):
  - Actualizado `reportes.repository.ts`: tanto `whereVisibilidad` como `sitioReportableWhere` ahora incluyen sitios donde el guardia tiene una cobertura activa hoy (`sitio.coberturas.some(...)`).
  - Los guardias que cubren un turno eventual pueden seleccionar el sitio y levantar reportes con total validez.
- **2026-10-23:** Flujo ágil Relevo → Cámara y Persistencia de Consignas:
  - Eliminado el modal intermediario de consejos tras completar el relevo: ahora abre la cámara biométrica directamente.
  - Persistencia del estado del relevo verificado/reportado por jornada y sesión (`localStorage` + auto-detección de reportes de relevo creados hoy): no vuelve a solicitar los 3 activos si ya se revisaron o reportaron para esa salida/entrada.
  - Opción "Revisar de nuevo" visible en el checador por si el guardia desea modificar su declaración de consignas.
- **2026-10-23:** Notificación entre Compañeros del Sitio, Resumen en Entrada y Burbuja Roja:
  - Notificaciones a guardias del mismo sitio (`guardiasDelSitio` en `AvisosRepository` y `NotificadorAvisos`): los compañeros asignados o cubriendo el sitio hoy son alertados cuando se levanta un reporte en su inmueble.
  - Resumen visual al checar entrada: `RelevoTurnoModal.tsx` consulta novedades activas del turno saliente y muestra tarjeta destacada con folio, título, guardia que reportó y botón directo `[Ver ↗]` a la ficha oficial.
  - Burbuja roja con número encapsulado (badge): sobre el icono de "Reportes" en el menú lateral (escritorio) y barra inferior (móvil), con el número de reportes no leídos / respuestas completamente adentro del círculo (`rounded-full bg-red-600 text-white font-bold`).
  - Limpieza reactiva al consultar: al abrir la ficha de un reporte (`ReporteDetallePage.tsx`), sus avisos se marcan como leídos automáticamente y la burbuja roja disminuye en vivo.
- **2026-10-23:** Ajustes de Usabilidad y Lógica Operativa (Checador, Relevo y Registro Facial):
  - **Modal de Consejos Preservado (`ConsejosCamara.tsx`):** Se mantiene el modal tutorial ("Antes de abrir la cámara: alza el teléfono a la altura de los ojos, retira gorra/lentes") respetando `debeMostrarConsejos()`, a menos que el guardia seleccione explícitamente "No volver a mostrar en este dispositivo".
  - **Relevo de Consignas Limpio y Exclusión de Auto-Reportes:**
    - En `RelevoTurnoModal.tsx`, la alerta de novedades del turno saliente ahora excluye reportes creados por el mismo usuario (`r.creadoPor.id !== user?.id`), evitando que un guardia vea sus propios reportes como advertencias.
    - Se eliminó el estado persistente artificial ("Relevo verificado / Revisar de nuevo") bajo el botón del checador; el flujo de relevo es una secuencia natural e integrada previa al escaneo facial (`MarcarPage.tsx`).
  - **Corrección en Contador de Comidas de 24h:** El botón "Salir a comer (X de Y)" ahora valida que la jornada esté activa (`!data.permitidas.includes('entrada')` y `!data.jornada.salida`) y calcula en base a comidas concluidas (`comidas.filter(c => c.fin !== null).length + 1`), evitando conteos erróneos antes de checar entrada.
  - **Captura Ágil de 5 Fotos en Registro Facial (`EscanerRostro.tsx`):**
    - Se eliminó la exigencia de parpadeo obligatorio durante las 5 tomas de autoregistro.
    - Una vez adoptada la pose solicitada (frente, arriba, izq, der, abajo) y mantenida estable durante 1 segundo (`calidad.armado`), la captura se realiza de forma automática con feedback "¡Listo! Tomando foto…".
- **2026-10-23:** Implementada Fase 5 (REP-09 / Portal de Clientes Operativo):
  - **Permisos y Control de Acceso:** Rol `cliente` dotado con `[REPORTES_VER_PROPIOS, REPORTES_SEGUIMIENTO, ASISTENCIA_VER]`.
  - **Alcance Estricto Multi-Inquilino:** Vinculación directa `clienteId` inyectada en JWT y sesión. Reportes y asistencia filtrados en el backend exclusivamente a los inmuebles y guardias asignados/cubriendo sus sitios.
  - **Interacción y Comentarios en Reportes:** El cliente puede redactar comentarios oficiales y adjuntar fotografías en el hilo de seguimiento de incidencias de sus instalaciones.
  - **Campanita y Notificaciones en Tiempo Real:** Avisos automáticos al cliente ante reportes creados, cambios de estatus y respuestas de supervisores. Sincronización bidireccional con badges de no leídos en campanita y navegación.
  - **Monitoreo Ejecutivo de Asistencia (`/asistencia`):** Vista de guardias asignados con avatar fotográfico oficial, horarios programados vs reales, retardo en píldora (`+X min`), detalle de horas de comida (`[1ª] 14:00 – 15:00`), salida y horas totales.
  - **Blindaje y Privacidad:** Ocultamiento total de incidencias de fraude biométrico, calibración facial y bitácora disciplinaria interna.
  - **Preservación Estética:** Diseño 100% integrado al sistema visual corporativo (slate/azul marino, tipografía e iconografía nativa).
- **Verificación de Calidad:**
  - 219 de 219 pruebas automatizadas pasando en Vitest (`npm test`).
  - 0 errores de TypeScript en todos los paquetes (`npm run typecheck`).
  - 0 advertencias o errores de linter (`npm run lint`).
