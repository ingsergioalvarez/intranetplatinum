# Relevo de sesión — Para Claude (2026-10-23)

> Documento de continuidad técnica para que Claude conozca exactamente qué cambios se realizaron, por qué y cómo quedaron implementados tras la pausa por límite semanal de sesión.

---

## 1. Contexto del relevo

El usuario solicitó continuar la sesión tras el mensaje:
`"You've hit your weekly limit · resets Oct 26, 8am (America/Mexico_City)"`.

La instrucción explícita del usuario fue:

1. Proceder con el cambio acordado en la última captura sin alterar el estilo ni la arquitectura del proyecto.
2. Mantener **dos campos** de contraseña ("Nueva contraseña" y "Confirmar nueva contraseña") y no uno solo: _"tampoco dejaremos flojo esto"_.
3. Registrar todo en este archivo `.md` para que Claude retome sin fricción.

---

## 2. Cambio implementado: Flujo de Contraseña Temporal (F1-11 / D-012)

### El problema resuelto

Al crear una cuenta o resetear contraseña, el usuario entraba con correo y contraseña temporal en `/login`. Al ingresar, `/cambiar-password` volvía a solicitar la contraseña temporal que acababa de escribir. Se eliminó esta redundancia innecesaria sin relajar la seguridad.

### Reglas aplicadas

1. **Primer ingreso con contraseña temporal (`debe_cambiar_password = true`):**
   - No se vuelve a pedir la contraseña actual/temporal.
   - Se muestran **dos campos**: _"Nueva contraseña"_ y _"Confirmar nueva contraseña"_, ambos con botón para ver/ocultar el texto (`PasswordInput`).
   - Se muestran **reglas interactivas en vivo** debajo del campo con íconos de verificación (`Check`):
     - ✓ Mínimo 10 caracteres
     - ✓ Al menos una letra
     - ✓ Al menos un número
   - Al guardar, la API limpia `debe_cambiar_password`, emite una nueva sesión y redirige al inicio (`/`).
   - La nueva contraseña no puede ser idéntica a la contraseña temporal previa (valida contra el hash en BD).
2. **Cambio voluntario desde el menú (`debe_cambiar_password = false`):**
   - Se mantiene la obligatoriedad de la contraseña actual para proteger sesiones abiertas en celulares.

---

## 3. Archivos modificados y detalle técnico

| Archivo                                                                                                                                                | Cambio realizado                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [packages/shared/src/schemas/auth.ts](file:///c:/Users/DEVOPS/Videos/intranetplatinum/packages/shared/src/schemas/auth.ts)                             | En `cambiarPasswordSchema`, `actual` pasa a ser opcional (`z.string().max(200).optional()`). Si viene, se valida que `nueva !== actual`.                                                                                                                     |
| [apps/api/src/modules/auth/auth.service.ts](file:///c:/Users/DEVOPS/Videos/intranetplatinum/apps/api/src/modules/auth/auth.service.ts)                 | En `cambiarPassword`: si `usuario.debeCambiarPassword` es `true`, no exige `actual` y rechaza con 400 si `nueva` es idéntica al hash actual. Si es `false` (voluntario), exige `actual` y valida contraseña con `verifyPassword`.                            |
| [apps/api/test/auth.test.ts](file:///c:/Users/DEVOPS/Videos/intranetplatinum/apps/api/test/auth.test.ts)                                               | Se actualizaron las pruebas de `cambiar-password`: temporal sin `actual` funciona (200), temporal con contraseña idéntica es rechazada (400), y cambio voluntario sin `actual` es rechazado con error de campo en `actual` (400). Pasan 24/24 tests en auth. |
| [apps/web/src/components/ui/PasswordInput.tsx](file:///c:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/components/ui/PasswordInput.tsx)           | Soporte para prop opcional `defaultVisible?: boolean` (mantiene por defecto `false`).                                                                                                                                                                        |
| [apps/web/src/modules/auth/CambiarPasswordPage.tsx](file:///c:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/auth/CambiarPasswordPage.tsx) | Si `obligatorio = true`, oculta el campo de contraseña actual/temporal. Muestra los dos campos de nueva y confirmación, y la lista interactiva de requisitos con color verde/gris dinámico. Mantiene los 3 campos en cambio voluntario.                      |
| [docs/DECISIONES.md](file:///c:/Users/DEVOPS/Videos/intranetplatinum/docs/DECISIONES.md)                                                               | Actualizada la decisión D-012 con la precisión del 2026-10-23.                                                                                                                                                                                               |

---

## 4. Estado de verificación técnica

- **Pruebas unitarias/integración:** `npm test` → **215 de 215 pasando** en Vitest.
- **Tipado:** `npm run typecheck` → **0 errores** en todos los workspaces (`shared`, `api`, `web`).
- **Estilo/Linter:** `npm run lint` → **0 errores / 0 advertencias**.
- **Base de datos:** Migraciones al día en MySQL local (`db:status` OK).
- **Rama:** `Alexis-Cambios`.

---

## 5. Módulo de Reportes y Operación en Sitio (Fase 1 y Fase 2: REP-01..REP-05)

El usuario definió el nuevo enfoque en reportes: **WhatsApp se elimina** de la operación diaria; la intranet es el único canal oficial y formal con trazabilidad de supervisor, guardia y cliente.

### Cambios realizados:

1. **Fase 1 (REP-01):**
   - [apps/web/src/modules/asistencia/HoraMarca.tsx](file:///c:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/asistencia/HoraMarca.tsx): Reemplazada la palabra confusa `"Debía"` por `"Entra a las <hora>"` y `"Sale a las <hora>"`.
2. **Fase 2 (REP-02..REP-05):**
   - [apps/web/src/modules/reportes/NuevoReportePage.tsx](file:///c:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/reportes/NuevoReportePage.tsx):
     - Tarjeta comprobante oficial al concluir el envío con Folio, timestamp de servidor, sitio, categoría, prioridad y aviso de campanita.
     - Detección de query param `?sitioId=` para pre-seleccionar sitio y abrir directo en paso de Categoría.
     - Invalidación en vivo de `['avisos']` para refrescar la campanita.
   - [apps/web/src/modules/reportes/Galeria.tsx](file:///c:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/reportes/Galeria.tsx):
     - Miniaturas táctiles 2-4 cols y visor modal en pantalla completa con navegación entre evidencias y metadatos de autor y fecha.
   - [apps/web/src/modules/reportes/ReporteDetallePage.tsx](file:///c:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/reportes/ReporteDetallePage.tsx):
     - Layout responsivo 2 columnas en escritorio: 7/12 para ficha del inmueble, descripción y evidencias fotográficas; 5/12 para bitácora oficial y formulario de respuesta.
     - Invalidación en vivo de `['avisos']` al agregar seguimiento o cambiar estatus.
   - [apps/web/src/modules/reportes/ReportesPage.tsx](file:///c:/Users/DEVOPS/Videos/intranetplatinum/apps/web/src/modules/reportes/ReportesPage.tsx):
     - Pestañas del guardia: **"Mis reportes"** (sus reportes levantados) vs **"Del sitio: [Nombre]"** (todas las incidencias del inmueble asignado para continuidad entre turnos).
     - Banner contextual de sitio cuando hay `sitioId` activo con enlace directo a "Reportar aquí" y limpiar filtro.
     - Píldoras rápidas de estatus: `Todos`, `Abiertos`, `En proceso`, `Resueltos`, `Cerrados`.
     - Selector de sitio en cajón de filtros y sincronización bidireccional con URL (`?sitioId=`, `?estatus=`, `?tab=`).

Todo el seguimiento detallado vive en [docs/REPORTES.md](file:///c:/Users/DEVOPS/Videos/intranetplatinum/docs/REPORTES.md).

---

## 6. Siguientes pasos

1. **Fase 3:** Coberturas en selector de sitios (DA-46 / REP-06).
2. **Fase 4:** Checklist de entrega y recepción de turno en asistencia (Celular del sitio, Llaves y Teléfono fijo: REP-07 y REP-08).
3. **Fase 5:** Portal de consulta para el Cliente / RH del sitio (REP-09).
4. Todas las pruebas (215/215), tipado (`typecheck`) y linter (`lint`) están en verde.
