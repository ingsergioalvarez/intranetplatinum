-- C-08 (DC-014): cada dato lleva su empresa. Todo lo que existe es de Comunicalo (empresa 1).
-- La columna es obligatoria y SIN valor por defecto: nada se guarda sin saber de qué empresa es.

-- usuarios
UPDATE `usuarios` SET `empresa_id` = 1 WHERE `empresa_id` IS NULL;
ALTER TABLE `usuarios` MODIFY `empresa_id` INTEGER NOT NULL;

-- auditoria
ALTER TABLE `auditoria` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `auditoria` SET `empresa_id` = 1;
CREATE INDEX `auditoria_empresa_id_idx` ON `auditoria`(`empresa_id`);
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- clientes
ALTER TABLE `clientes` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `clientes` SET `empresa_id` = 1;
ALTER TABLE `clientes` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `clientes_empresa_id_idx` ON `clientes`(`empresa_id`);
ALTER TABLE `clientes` ADD CONSTRAINT `clientes_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- cliente_contactos
ALTER TABLE `cliente_contactos` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `cliente_contactos` SET `empresa_id` = 1;
ALTER TABLE `cliente_contactos` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `cliente_contactos_empresa_id_idx` ON `cliente_contactos`(`empresa_id`);
ALTER TABLE `cliente_contactos` ADD CONSTRAINT `cliente_contactos_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- sitios
ALTER TABLE `sitios` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `sitios` SET `empresa_id` = 1;
ALTER TABLE `sitios` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `sitios_empresa_id_idx` ON `sitios`(`empresa_id`);
ALTER TABLE `sitios` ADD CONSTRAINT `sitios_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- sitio_guardia
ALTER TABLE `sitio_guardia` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `sitio_guardia` SET `empresa_id` = 1;
ALTER TABLE `sitio_guardia` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `sitio_guardia_empresa_id_idx` ON `sitio_guardia`(`empresa_id`);
ALTER TABLE `sitio_guardia` ADD CONSTRAINT `sitio_guardia_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- grupos_guardias
ALTER TABLE `grupos_guardias` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `grupos_guardias` SET `empresa_id` = 1;
ALTER TABLE `grupos_guardias` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `grupos_guardias_empresa_id_idx` ON `grupos_guardias`(`empresa_id`);
ALTER TABLE `grupos_guardias` ADD CONSTRAINT `grupos_guardias_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- grupo_integrantes
ALTER TABLE `grupo_integrantes` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `grupo_integrantes` SET `empresa_id` = 1;
ALTER TABLE `grupo_integrantes` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `grupo_integrantes_empresa_id_idx` ON `grupo_integrantes`(`empresa_id`);
ALTER TABLE `grupo_integrantes` ADD CONSTRAINT `grupo_integrantes_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- categorias_reporte
ALTER TABLE `categorias_reporte` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `categorias_reporte` SET `empresa_id` = 1;
ALTER TABLE `categorias_reporte` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `categorias_reporte_empresa_id_idx` ON `categorias_reporte`(`empresa_id`);
ALTER TABLE `categorias_reporte` ADD CONSTRAINT `categorias_reporte_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- folios_reporte
ALTER TABLE `folios_reporte` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `folios_reporte` SET `empresa_id` = 1;
ALTER TABLE `folios_reporte` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `folios_reporte_empresa_id_idx` ON `folios_reporte`(`empresa_id`);
ALTER TABLE `folios_reporte` ADD CONSTRAINT `folios_reporte_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- reportes
ALTER TABLE `reportes` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `reportes` SET `empresa_id` = 1;
ALTER TABLE `reportes` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `reportes_empresa_id_idx` ON `reportes`(`empresa_id`);
ALTER TABLE `reportes` ADD CONSTRAINT `reportes_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- reporte_seguimientos
ALTER TABLE `reporte_seguimientos` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `reporte_seguimientos` SET `empresa_id` = 1;
ALTER TABLE `reporte_seguimientos` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `reporte_seguimientos_empresa_id_idx` ON `reporte_seguimientos`(`empresa_id`);
ALTER TABLE `reporte_seguimientos` ADD CONSTRAINT `reporte_seguimientos_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- reporte_evidencias
ALTER TABLE `reporte_evidencias` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `reporte_evidencias` SET `empresa_id` = 1;
ALTER TABLE `reporte_evidencias` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `reporte_evidencias_empresa_id_idx` ON `reporte_evidencias`(`empresa_id`);
ALTER TABLE `reporte_evidencias` ADD CONSTRAINT `reporte_evidencias_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- reportes_cliente
ALTER TABLE `reportes_cliente` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `reportes_cliente` SET `empresa_id` = 1;
ALTER TABLE `reportes_cliente` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `reportes_cliente_empresa_id_idx` ON `reportes_cliente`(`empresa_id`);
ALTER TABLE `reportes_cliente` ADD CONSTRAINT `reportes_cliente_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- notificaciones
ALTER TABLE `notificaciones` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `notificaciones` SET `empresa_id` = 1;
ALTER TABLE `notificaciones` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `notificaciones_empresa_id_idx` ON `notificaciones`(`empresa_id`);
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- cliente_reglas_aviso
ALTER TABLE `cliente_reglas_aviso` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `cliente_reglas_aviso` SET `empresa_id` = 1;
ALTER TABLE `cliente_reglas_aviso` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `cliente_reglas_aviso_empresa_id_idx` ON `cliente_reglas_aviso`(`empresa_id`);
ALTER TABLE `cliente_reglas_aviso` ADD CONSTRAINT `cliente_reglas_aviso_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- avisos
ALTER TABLE `avisos` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `avisos` SET `empresa_id` = 1;
ALTER TABLE `avisos` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `avisos_empresa_id_idx` ON `avisos`(`empresa_id`);
ALTER TABLE `avisos` ADD CONSTRAINT `avisos_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- suscripciones_push
ALTER TABLE `suscripciones_push` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `suscripciones_push` SET `empresa_id` = 1;
ALTER TABLE `suscripciones_push` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `suscripciones_push_empresa_id_idx` ON `suscripciones_push`(`empresa_id`);
ALTER TABLE `suscripciones_push` ADD CONSTRAINT `suscripciones_push_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- marcaciones
ALTER TABLE `marcaciones` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `marcaciones` SET `empresa_id` = 1;
ALTER TABLE `marcaciones` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `marcaciones_empresa_id_idx` ON `marcaciones`(`empresa_id`);
ALTER TABLE `marcaciones` ADD CONSTRAINT `marcaciones_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- rostros_guardia
ALTER TABLE `rostros_guardia` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `rostros_guardia` SET `empresa_id` = 1;
ALTER TABLE `rostros_guardia` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `rostros_guardia_empresa_id_idx` ON `rostros_guardia`(`empresa_id`);
ALTER TABLE `rostros_guardia` ADD CONSTRAINT `rostros_guardia_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- incidencias_rostro
ALTER TABLE `incidencias_rostro` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `incidencias_rostro` SET `empresa_id` = 1;
ALTER TABLE `incidencias_rostro` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `incidencias_rostro_empresa_id_idx` ON `incidencias_rostro`(`empresa_id`);
ALTER TABLE `incidencias_rostro` ADD CONSTRAINT `incidencias_rostro_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- turnos
ALTER TABLE `turnos` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `turnos` SET `empresa_id` = 1;
ALTER TABLE `turnos` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `turnos_empresa_id_idx` ON `turnos`(`empresa_id`);
ALTER TABLE `turnos` ADD CONSTRAINT `turnos_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- bitacora_eventos
ALTER TABLE `bitacora_eventos` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `bitacora_eventos` SET `empresa_id` = 1;
ALTER TABLE `bitacora_eventos` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `bitacora_eventos_empresa_id_idx` ON `bitacora_eventos`(`empresa_id`);
ALTER TABLE `bitacora_eventos` ADD CONSTRAINT `bitacora_eventos_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- bitacora_comentarios
ALTER TABLE `bitacora_comentarios` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `bitacora_comentarios` SET `empresa_id` = 1;
ALTER TABLE `bitacora_comentarios` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `bitacora_comentarios_empresa_id_idx` ON `bitacora_comentarios`(`empresa_id`);
ALTER TABLE `bitacora_comentarios` ADD CONSTRAINT `bitacora_comentarios_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- turnos_dia
ALTER TABLE `turnos_dia` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `turnos_dia` SET `empresa_id` = 1;
ALTER TABLE `turnos_dia` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `turnos_dia_empresa_id_idx` ON `turnos_dia`(`empresa_id`);
ALTER TABLE `turnos_dia` ADD CONSTRAINT `turnos_dia_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- coberturas
ALTER TABLE `coberturas` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `coberturas` SET `empresa_id` = 1;
ALTER TABLE `coberturas` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `coberturas_empresa_id_idx` ON `coberturas`(`empresa_id`);
ALTER TABLE `coberturas` ADD CONSTRAINT `coberturas_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- avisos_enviados
ALTER TABLE `avisos_enviados` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `avisos_enviados` SET `empresa_id` = 1;
ALTER TABLE `avisos_enviados` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `avisos_enviados_empresa_id_idx` ON `avisos_enviados`(`empresa_id`);
ALTER TABLE `avisos_enviados` ADD CONSTRAINT `avisos_enviados_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- informes_asistencia
ALTER TABLE `informes_asistencia` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `informes_asistencia` SET `empresa_id` = 1;
ALTER TABLE `informes_asistencia` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `informes_asistencia_empresa_id_idx` ON `informes_asistencia`(`empresa_id`);
ALTER TABLE `informes_asistencia` ADD CONSTRAINT `informes_asistencia_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- cambios_turno
ALTER TABLE `cambios_turno` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `cambios_turno` SET `empresa_id` = 1;
ALTER TABLE `cambios_turno` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `cambios_turno_empresa_id_idx` ON `cambios_turno`(`empresa_id`);
ALTER TABLE `cambios_turno` ADD CONSTRAINT `cambios_turno_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- pausas_turno
ALTER TABLE `pausas_turno` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `pausas_turno` SET `empresa_id` = 1;
ALTER TABLE `pausas_turno` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `pausas_turno_empresa_id_idx` ON `pausas_turno`(`empresa_id`);
ALTER TABLE `pausas_turno` ADD CONSTRAINT `pausas_turno_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- casos_cobertura
ALTER TABLE `casos_cobertura` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `casos_cobertura` SET `empresa_id` = 1;
ALTER TABLE `casos_cobertura` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `casos_cobertura_empresa_id_idx` ON `casos_cobertura`(`empresa_id`);
ALTER TABLE `casos_cobertura` ADD CONSTRAINT `casos_cobertura_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- horas_extra
ALTER TABLE `horas_extra` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `horas_extra` SET `empresa_id` = 1;
ALTER TABLE `horas_extra` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `horas_extra_empresa_id_idx` ON `horas_extra`(`empresa_id`);
ALTER TABLE `horas_extra` ADD CONSTRAINT `horas_extra_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- medidas_disciplinarias
ALTER TABLE `medidas_disciplinarias` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `medidas_disciplinarias` SET `empresa_id` = 1;
ALTER TABLE `medidas_disciplinarias` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `medidas_disciplinarias_empresa_id_idx` ON `medidas_disciplinarias`(`empresa_id`);
ALTER TABLE `medidas_disciplinarias` ADD CONSTRAINT `medidas_disciplinarias_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- dispositivos_usuario
ALTER TABLE `dispositivos_usuario` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `dispositivos_usuario` SET `empresa_id` = 1;
ALTER TABLE `dispositivos_usuario` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `dispositivos_usuario_empresa_id_idx` ON `dispositivos_usuario`(`empresa_id`);
ALTER TABLE `dispositivos_usuario` ADD CONSTRAINT `dispositivos_usuario_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- solicitudes_cobertura
ALTER TABLE `solicitudes_cobertura` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `solicitudes_cobertura` SET `empresa_id` = 1;
ALTER TABLE `solicitudes_cobertura` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `solicitudes_cobertura_empresa_id_idx` ON `solicitudes_cobertura`(`empresa_id`);
ALTER TABLE `solicitudes_cobertura` ADD CONSTRAINT `solicitudes_cobertura_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ausencias
ALTER TABLE `ausencias` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `ausencias` SET `empresa_id` = 1;
ALTER TABLE `ausencias` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `ausencias_empresa_id_idx` ON `ausencias`(`empresa_id`);
ALTER TABLE `ausencias` ADD CONSTRAINT `ausencias_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- emergencias
ALTER TABLE `emergencias` ADD COLUMN `empresa_id` INTEGER NULL;
UPDATE `emergencias` SET `empresa_id` = 1;
ALTER TABLE `emergencias` MODIFY `empresa_id` INTEGER NOT NULL;
CREATE INDEX `emergencias_empresa_id_idx` ON `emergencias`(`empresa_id`);
ALTER TABLE `emergencias` ADD CONSTRAINT `emergencias_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
