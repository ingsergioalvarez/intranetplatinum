# Mapa de módulos y dependencias (C-06)

> Revisión de solo lectura hecha el 2026-11-04 sobre la rama `gestion-comunicalo`. No cambia código.
> Sirve para decidir qué es núcleo, qué se puede apagar y qué depende de qué (base de C-07).
> **Cómo se hizo:** se leyeron los registros de módulos, rutas, permisos y el esquema, y un script contó quién importa a quién
> en el backend (27 módulos registrados) y en el frontend (21 carpetas de pantallas). Una importación indica relación, no siempre que se llame en cada operación.

## 1. Hallazgos que condicionan el diseño

1. **Asistencia es el centro de todo.** En el backend importa a 12 módulos y 8 la importan (3,973 líneas). En el frontend, su pantalla es un
   portal con 9 accesos (rostros, casos, emergencias, solicitudes, ausencias, calendario, horas extra, cambios, incidencias) y 1 más a los reportes.
   Dentro de ese módulo conviven dos cosas distintas: **marcar con rostro** (núcleo) y **turnos, retardos, comidas y faltas** (opcional).
   Separarlas es el trabajo más grande de C-12.
2. **Buena noticia: asistencia ya recibe a los demás como "puertos"** que se pueden sustituir (bitácora, horas extra, medidas, avisos de
   atención, solicitudes, llegada). Para pruebas ya existen versiones vacías (`sinHorasExtra`, `sinBitacora`…). Apagar un módulo puede ser
   inyectar su versión vacía. Pero en producción esos puertos se arman con las versiones reales, fijas en el código.
3. **Avisos y Bitácora son infraestructura.** Avisos lo usan 17 módulos y Bitácora 11 (y Bitácora y Asistencia se importan entre sí).
   Avisos es núcleo; Bitácora se queda por decisión del usuario.
4. **Sitios depende de Clientes** y 8 módulos importan Clientes (asistencia, ausencias, coberturas, emergencias, grupos, reportes,
   reportes-cliente, sitios). Mientras el lugar de trabajo dependa de un cliente, Clientes es estructural y no se puede apagar. Es C-10.
5. **Los permisos son demasiado gruesos para apagar módulos.** Solo hay 20 permisos en 7 familias (usuarios, clientes, reportes, catálogos,
   grupos, auditoría, asistencia). 11 de los 27 módulos registrados no usan ningún permiso (admin, archivos, auth, avisos, ausencias,
   carteras, coberturas, emergencias, health, push, reportes-cliente): se protegen por rol (`requireRoles`) o solo por sesión. Otros reutilizan
   `asistencia.*` y `clientes.*`. Por eso "apagar módulo = quitar sus permisos" no alcanza; hace falta un **guardia de módulo** aparte.
   Ventaja: el backend registra cada módulo en un solo lugar (`modules/index.ts`), así que el guardia puede ir ahí.
6. **Una sola tarea automática corre cada minuto** (`iniciarVigilanciaTurnos`, en `asistencia/index.ts`) y revisa 9 cosas de 9 módulos:
   turnos sin entrada, comidas, horas extra, huecos de cobertura, casos, guardia solo en sitio, incidencias de rostro, solicitudes y
   escalado de emergencias. Hoy corre para todo el sistema; con empresas debe correr **por empresa y solo por los módulos encendidos**.
7. **Dependencias por base de datos, además de por código.** Asistencia lee tablas de otros módulos (ausencias, avisos, bitácora,
   incidencias, turnos del día, pausas, coberturas). Apagar Ausencias, por ejemplo, no rompe imports pero sí cambia lo que asistencia cuenta como falta.
8. **Los roles `guardia` y `cliente` están escritos en el código de la web** (rutas, menú, redirección de Inicio al Checador).
   Hay que generalizarlos a "colaborador" cuando toque.

## 2. Catálogo propuesto de módulos de producto

Dificultad de apagarlo hoy: **Fácil** (casi nadie depende de él), **Media**, **Difícil** (varios dependen de él o hay que desatarlo antes).
La columna "Decisión" la completa el usuario.

### Núcleo (siempre encendido)

| Módulo | Backend | Frontend | Tablas principales | Notas |
|---|---|---|---|---|
| **Plataforma y acceso** | auth, usuarios, archivos, health | auth, usuarios | usuarios, roles, permisos, rol_permiso, refresh_tokens, password_resets, dispositivos_usuario, auditoria | Login, PIN, contraseñas, roles. Incluye subida de fotos con URL firmada |
| **Avisos y campanita** | avisos, push | (Campanita en el menú) | avisos, notificaciones, suscripciones_push | 17 módulos lo usan |
| **Biometría y marcación** | asistencia (parte) | asistencia (Marcar, Historial, Rostros, Incidencias) | marcaciones, rostros_guardia, incidencias_rostro | Es el producto. Hoy está mezclado con turnos y retardos dentro de `asistencia` |
| **Estructura mínima** | sitios + clientes (hoy) | clientes, inicio (Mis sitios) | sitios, sitio_guardia, clientes | Hoy el sitio cuelga del cliente. A generalizar en C-10 |
| **Administración (borrado definitivo)** | admin | (acciones en usuarios y clientes) | todas | Por sus rutas parece el borrado definitivo de usuarios, sitios y clientes (A-64); confirmar |

### Generales (opcionales, se encienden por empresa)

| Módulo | Backend | Frontend | Depende de | Lo usan | Apagarlo | Decisión |
|---|---|---|---|---|---|---|
| **Turnos y horarios** | turnos, horarios | catalogos (Turnos), horarios | sitios, bitácora, avisos | asistencia, sitios | Media (asistencia y sitios lo importan; el PDF de horarios usa código de informes) | — |
| **Ausencias** | ausencias | ausencias | sitios, clientes, bitácora, avisos | nadie por código; asistencia lee su tabla | Fácil | — |
| **Horas extra** | horas-extra | horas-extra | asistencia, coberturas, casos-cobertura, bitácora | asistencia (puerto) | Media: depende de Cobertura | — |
| **Cambios de turno** | cambios | cambios | asistencia, coberturas, solicitudes, bitácora | nadie | Media: depende de Cobertura | — |
| **Reporte de asistencia** | informes | informes | asistencia, bitácora, sitios | horarios | Media | — |
| **Grupos (equipos)** | grupos | grupos | clientes, bitácora, avisos | sitios (asignación por grupo) | Media | — |
| **Carteras** | carteras | carteras | avisos | nada por código, pero el filtro de alcance por cartera está en varios módulos | Media: el alcance pasaría a ser por empresa y área | — |
| **Bitácora** | bitacora, medidas | asistencia (Bitácora, Medidas) | asistencia, sitios, avisos | 11 módulos | Difícil (se queda por decisión del usuario) | Se queda |
| **Emergencias (SOS)** | emergencias | emergencias, botón SOS | avisos, clientes | asistencia (el escalado corre en la tarea de cada minuto) | Media | Se queda por ahora, para todos |

### De seguridad privada (candidatos a quedar apagados por defecto)

| Módulo | Backend | Frontend | Depende de | Lo usan | Apagarlo | Decisión |
|---|---|---|---|---|---|---|
| **Clientes y portal del cliente** | clientes | clientes, guardias | usuarios, grupos, carteras (front) | 8 módulos | Difícil: estructural hasta C-10 | — |
| **Reportes de incidentes** | reportes, categorias | reportes, catalogos (Categorías) | clientes, avisos | tablero de Inicio | Fácil | — |
| **Quejas del cliente** | reportes-cliente | reportes-cliente | clientes, avisos | nadie | Fácil | — |
| **Cobertura de relevos** | coberturas, cobertura, casos-cobertura, solicitudes-cobertura | cobertura (Calendario), casos, solicitudes | asistencia, sitios, bitácora, avisos | cambios, horas-extra, asistencia | Difícil: Cambios de turno y Horas extra dependen de ella | — |

## 3. Dependencias clave (qué se rompe al apagar)

- **Cobertura es la raíz de una cadena:** Horas extra y Cambios de turno la necesitan hoy. Si Cobertura se apaga, esos dos también, a menos que se desaten.
- **Clientes ← Sitios ← casi todo:** no se apaga ninguno de los dos antes de C-10.
- **Asistencia ↔ Bitácora:** se importan entre sí. Ya es parte del mismo bloque funcional.
- **Pantalla Asistencia (admin):** 9 accesos a otros módulos. Cada uno debe ocultarse cuando su módulo esté apagado.
- **Tablero de Inicio:** mezcla asistencia, incidencias de rostro, casos de cobertura (mismo enlace) y **Reportes abiertos** (módulo de reportes).
  Sus tarjetas deben armarse según los módulos encendidos.
- **Rutas del frontend:** `ProtectedRoute` mezcla permiso y rol; sumaría un tercer criterio: módulo encendido.
- **Tarea de cada minuto:** pasa a ser por empresa y por módulo encendido.

## 4. Propuesta de mecanismo (para C-07, sin implementar)

1. **Catálogo de módulos en `@platinum/shared`:** clave, nombre, de qué depende, qué permisos y rutas trae. Fuente única para backend y web.
2. **Backend:** un guardia de módulo aplicado donde se registran los módulos (`modules/index.ts`), puertos vacíos para los módulos apagados y la
   tarea de cada minuto leyendo la configuración de cada empresa.
3. **Frontend:** un criterio de módulo en el menú y en las rutas, y ocultar los accesos internos y las tarjetas del tablero.
4. **Permisos más finos y agrupados por módulo** (C-11), para que apagar el módulo quite también sus permisos.
5. **Dependencias declaradas:** encender un módulo pide sus dependencias; no se permite apagar uno si otro encendido lo necesita.

## 5. Lo que se revisaría y no quedó resuelto aquí

- Si todos los endpoints pasan por permisos o por roles: se contó por módulo, pero no se auditó ruta por ruta.
- Si Bitácora, SOS y Medidas pueden funcionar sin "guardia" ni "sitio" (se adaptan módulo por módulo, tras C-10).
- El alcance exacto del módulo `admin` (borrado definitivo).
- Qué parte del código de `asistencia` es núcleo y cuál es opcional; se define al empezar C-12.

## 6. Decisiones pendientes del usuario

Pasar por cada fila de las tablas: **núcleo**, **opcional encendido**, **opcional apagado por defecto** o **dejar para después**.
Nada se borra (DC-009): lo que no se use se apaga.
