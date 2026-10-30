-- A-48 / A-49: confirmar falta con motivo y historial formal de medidas disciplinarias
ALTER TABLE `bitacora_eventos`
  MODIFY `tipo` ENUM('retardo', 'salida_anticipada', 'comida_fuera', 'racha', 'falta', 'no_se_presento', 'incidencia_rostro', 'rostro_registrado', 'rostro_aprobado', 'rostro_rechazado', 'rostro_eliminado', 'asignacion', 'asignacion_cambio', 'asignacion_fin', 'grupo_alta', 'grupo_baja', 'cobertura', 'cobertura_cancelada', 'comida_sin_cierre', 'sin_comida', 'jornada_cerrada', 'horas_extra', 'medida_disciplinaria') NOT NULL,
  ADD COLUMN `decision_motivo` VARCHAR(255) NULL;

CREATE TABLE `medidas_disciplinarias` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `usuario_id` INTEGER NOT NULL,
  `tipo` VARCHAR(20) NOT NULL,
  `origen` VARCHAR(20) NOT NULL,
  `motivo` VARCHAR(255) NOT NULL,
  `evento_id` INTEGER NULL,
  `marcacion_id` INTEGER NULL,
  `sitio_id` INTEGER NULL,
  `aplicada_por_id` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `medidas_disciplinarias_usuario_id_created_at_idx`(`usuario_id`, `created_at`),
  INDEX `medidas_disciplinarias_aplicada_por_id_idx`(`aplicada_por_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `medidas_disciplinarias` ADD CONSTRAINT `medidas_disciplinarias_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `medidas_disciplinarias` ADD CONSTRAINT `medidas_disciplinarias_aplicada_por_id_fkey` FOREIGN KEY (`aplicada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
