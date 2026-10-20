# Módulo: Control de asistencia con reconocimiento facial

> Plan vivo del módulo (alcance **A-17**, rama `Alexis-Cambios`). Se marca lo que se termina y se agrega lo nuevo; no se borra nada (lo descartado se marca `[-]` con motivo).
>
> **Estados:** `[ ]` pendiente · `[~]` en progreso · `[x]` terminada · `[!]` bloqueada · `[-]` descartada

---

## 1. Qué es

Los **guardias** registran su **entrada, salida y comida** desde el celular (la página web, responsiva). La entrada y la salida se confirman con **foto de su rostro**; el sistema toma el **GPS** por detrás. El **admin y el supervisor** dan de alta el rostro de cada guardia y consultan las marcas. **Nadie puede editar ni borrar una marca.**

## 2. Quién ve qué

| Perfil             | Dónde                 | Qué hace                                                                |
| ------------------ | --------------------- | ----------------------------------------------------------------------- |
| Guardia            | Menú **"Marcar"**     | Entrada / salida (con foto), inicio / fin de comida (sin foto)          |
| Guardia            | **"Mis marcas"**      | Ve su historial                                                         |
| Admin y supervisor | Ficha del guardia     | Botón **"Registrar rostro"** (una vez por guardia, en persona)          |
| Admin y supervisor | Edición del sitio     | Botón **"Usar mi ubicación"** para guardar las coordenadas del inmueble |
| Admin y supervisor | Menú **"Asistencia"** | Ve las marcas de todos con foto, ubicación y alertas (solo lectura)     |

## 3. Decisiones acordadas

| ID    | Decisión                                                                                                                                                                                                                                                                        | Fecha      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| DA-01 | Importa la **cuenta**, no el dispositivo: el rostro confirma que quien marca es el dueño de la cuenta, sin importar el celular.                                                                                                                                                 | 2026-10-20 |
| DA-02 | **GPS obligatorio** y automático: el guardia solo da permiso de ubicación al navegador. Sin permiso no puede marcar. Rango del sitio: **100 m**.                                                                                                                                | 2026-10-20 |
| DA-03 | La página funciona con internet; **solo el envío de la marca** debe poder hacerse sin señal: se guarda en el celular (foto, GPS, hora del celular) y se envía sola al volver la conexión.                                                                                       | 2026-10-20 |
| DA-04 | Sin internet **no se compara el rostro en el celular**: el servidor lo verifica al recibir la marca (no se guarda la huella facial en el teléfono).                                                                                                                             | 2026-10-20 |
| DA-05 | El **rostro lo dan de alta el admin y el supervisor**, en persona (3 a 5 fotos). El guardia no puede registrarse solo.                                                                                                                                                          | 2026-10-20 |
| DA-06 | Con internet: **3 intentos** de reconocimiento. Si no pasa, la marca **se registra igual con alerta** (la foto queda como evidencia para revisión).                                                                                                                             | 2026-10-20 |
| DA-07 | **Comida sin foto**: inicio y fin con un toque; se guarda el GPS. Duración de referencia: 1 hora, dentro de la jornada.                                                                                                                                                         | 2026-10-20 |
| DA-08 | **Marcas inmutables**: nadie edita ni borra. Cualquier aclaración futura se agrega aparte sin tocar la marca original.                                                                                                                                                          | 2026-10-20 |
| DA-09 | **Tolerancia de retardo: 10 min** (se aplica cuando existan horarios, Fase 3).                                                                                                                                                                                                  | 2026-10-20 |
| DA-10 | Es una **página web** responsiva (no app de tienda). Para enviar marcas sin señal se usan capacidades de PWA (guardar la pantalla de marcar y los modelos en el celular).                                                                                                       | 2026-10-20 |
| DA-11 | Una entrada sin salida se considera **jornada abierta hasta 30 h** (cubre turnos de 24 h). Después se permite una nueva entrada y la anterior queda "sin salida". _(Propuesta; revisar con horarios, Fase 3.)_                                                                  | 2026-10-20 |
| DA-12 | Orden de marcas: entrada → inicio de comida → fin de comida → salida. La **salida se permite sin cerrar la comida** (queda "comida sin cierre").                                                                                                                                | 2026-10-20 |
| DA-13 | La **entrada fija el sitio** de la jornada (asignado más cercano); comida y salida se miden contra ese sitio. **Sin sitio asignado hoy no se puede marcar.**                                                                                                                    | 2026-10-20 |
| DA-14 | Alertas que no bloquean: fuera de 100 m, sitio sin coordenadas y **GPS impreciso** (precisión reportada mayor a 100 m).                                                                                                                                                         | 2026-10-20 |
| DA-15 | El menú **Marcar** solo aparece al rol guardia (el admin tiene todos los permisos pero no marca).                                                                                                                                                                               | 2026-10-20 |
| DA-16 | La vista del admin muestra **una fila por guardia** (no por marca) y también a los **guardias asignados ese día que no han marcado** ("Sin marcas"); aún no es "falta" formal (eso requiere horarios, Fase 3). El detalle por guardia usa las mismas tarjetas que "Mis marcas". | 2026-10-20 |

## 4. Base técnica

- **Reconocimiento facial** tomado del proyecto `Optometrista` (`frontend/src/modules/pacientes/PacientesView.jsx`, `backend/src/modules/pacientes/pacientes.service.js`):
  - Se reutiliza: guía de calidad en vivo con MediaPipe FaceMesh (centrado, distancia, mirada, luz, obstrucción), recorte del rostro, vector de 128 valores con face-api.js (`@vladmandic/face-api`), comparación por distancia euclidiana, modelos alojados en el proyecto.
  - No se usa: forma de rostro, detección de lentes, modelos de edad/género/expresión, respaldo por forma de rostro.
  - Cambios: comparación **1 a 1** contra el rostro de la cuenta (1 a N solo al dar de alta, para detectar duplicados), **3 a 5 vectores** por guardia, umbral más estricto (~0.5, a calibrar), **prueba de vida** (parpadeo o giro), el **servidor vuelve a comparar** siempre.
- **Del proyecto actual**: usuarios y roles, sitios con `lat/lng` (opcionales hoy), asignaciones de guardias a sitios, almacenamiento de fotos con URL firmada, hora del servidor, auditoría.

## 5. Fases

### Fase 1 — Registro de rostro y marcas con internet

**Forma de trabajo:** cada fase se divide en dos partes y se hacen **una a la vez**: primero la **Parte A (guardia)**; el usuario la revisa y confirma; después la **Parte B (admin/supervisor)**. No se adelanta trabajo de la otra parte.

**Cámara y reconocimiento facial:** se dejan para el final de la fase (indicación del usuario, 2026-10-20). Mientras tanto, entrada y salida se registran **sin foto** y la marca queda lista para recibirla después.

#### Parte A — Guardia

> **Estado (2026-10-20):** AS1-03 a AS1-06 construidas y probadas (108 pruebas automáticas, capturas a 360 y 1440 px); **revisadas y aprobadas por el usuario**. Pantallas: menú **Marcar** (solo rol guardia), `/marcar` y `/marcar/historial`. Tabla `marcaciones` (migración `20261020000000_asistencia_marcaciones`), permiso `asistencia.marcar` (guardia).

| ID     | Tarea                                                                                                    | Estado |
| ------ | -------------------------------------------------------------------------------------------------------- | ------ |
| AS1-03 | Pantalla "Marcar": entrada, inicio/fin de comida y salida en orden; GPS automático (obligatorio)         | [x]    |
| AS1-04 | Sitio detectado automáticamente (asignación vigente + el más cercano); hora del servidor                 | [x]    |
| AS1-05 | Alertas en la marca: fuera de 100 m, sitio sin coordenadas (rostro no coincide: cuando exista la cámara) | [x]    |
| AS1-06 | "Mis marcas": historial del guardia por mes                                                              | [x]    |
| AS1-08 | Foto con reconocimiento en entrada/salida (3 intentos; si falla, se registra con alerta) — **al final**  | [ ]    |

#### Parte B — Admin / supervisor

> **Estado (2026-10-20):** AS1-01 y AS1-07 construidas y probadas (116 pruebas automáticas, capturas a 360 y 1440 px); **revisadas y aprobadas por el usuario**. Menú **Asistencia** (`/asistencia`, ficha `/asistencia/guardias/:id`), permiso `asistencia.ver` (supervisor; el admin lo tiene por ser admin). Aviso "Sin ubicación" en cada sitio sin coordenadas de la ficha del cliente.

| ID     | Tarea                                                                                                                                                                                                                              | Estado |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AS1-01 | Coordenadas del sitio: el botón "Usar mi ubicación" ya existe al editar un sitio; falta avisar qué sitios no tienen coordenadas                                                                                                    | [x]    |
| AS1-07 | Vista "Asistencia": **una fila por guardia y día** (entrada, comida, salida, horas, estado) incluyendo **asignados sin marcas**; al tocar, **ficha del guardia** con tarjetas por día y detalle de cada marca (mapa). Solo lectura | [x]    |
| AS1-02 | Registrar rostro del guardia: 3–5 fotos guiadas; detectar si esa cara ya está en otra cuenta — **al final**                                                                                                                        | [ ]    |

**Listo cuando:** un guardia con rostro registrado entra desde su celular, marca entrada, comida y salida, y el supervisor ve esas marcas con foto, ubicación y alertas.

### Fase 2 — Marcar sin internet

| ID     | Tarea                                                                                                       | Estado |
| ------ | ----------------------------------------------------------------------------------------------------------- | ------ |
| AS2-01 | Guardar en el celular la pantalla de marcar y los modelos de reconocimiento (PWA)                           | [ ]    |
| AS2-02 | Cola de marcas pendientes en el celular y envío automático al recuperar la señal (sin duplicados)           | [ ]    |
| AS2-03 | Verificación del rostro en el servidor al recibir la marca                                                  | [ ]    |
| AS2-04 | Hora del celular + hora de recepción + desfase del reloj; alertas "enviada sin conexión" / "hora desfasada" | [ ]    |

### Fase 3 — Horarios e incidencias (pendiente de definir)

| ID     | Tarea                                                                                         | Estado |
| ------ | --------------------------------------------------------------------------------------------- | ------ |
| AS3-01 | Horarios / jornadas por usuario (días, horas; definir si hay turnos rotativos)                | [ ]    |
| AS3-02 | Retardos (tolerancia 10 min), faltas, salidas anticipadas, comida no registrada               | [ ]    |
| AS3-03 | Recordatorios de comida: a la mitad de la jornada sin comer y 5 min antes de terminar la hora | [ ]    |

### Fase 4 — Reportes

| ID     | Tarea                                                                          | Estado |
| ------ | ------------------------------------------------------------------------------ | ------ |
| AS4-01 | Reporte por guardia y periodo: días, entradas/salidas, horas, comidas, alertas | [ ]    |
| AS4-02 | Exportar a Excel (formato por definir)                                         | [ ]    |

## 6. Pendientes por definir

- Horarios: días fijos, rotativos (12x24, 24x24) o ambos → Fase 3.
- Formato de reportes / nómina → Fase 4.
- Tiempo máximo para sincronizar una marca sin conexión antes de marcarla sospechosa (propuesta: 72 h) → Fase 2.
- Recordatorios sin internet: una página web no puede programar notificaciones con el navegador cerrado y sin señal; con internet se pueden enviar desde el servidor → Fase 3.
- Aviso de privacidad y consentimiento del guardia para datos biométricos (LFPDPPP).

## 7. Riesgos conocidos

- GPS dentro de edificios puede fallar 50–300 m: marcas "fuera de rango" falsas → se registran con alerta, no se rechazan.
- La cámara solo funciona con HTTPS (o `localhost`): para probar en el celular hace falta HTTPS en desarrollo.
- Los modelos de reconocimiento pesan ~15–20 MB (se descargan una vez).
- Celulares de gama baja: el reconocimiento puede tardar unos segundos.
