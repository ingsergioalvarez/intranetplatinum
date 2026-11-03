-- A-43: ausencias justificadas por adelantado (vacaciones, incapacidad, permiso…)
ALTER TABLE `bitacora_eventos`
  MODIFY `tipo` ENUM('retardo', 'salida_anticipada', 'comida_fuera', 'racha', 'falta', 'no_se_presento', 'incidencia_rostro', 'rostro_registrado', 'rostro_aprobado', 'rostro_rechazado', 'rostro_eliminado', 'asignacion', 'asignacion_cambio', 'asignacion_fin', 'grupo_alta', 'grupo_baja', 'cobertura', 'cobertura_cancelada', 'comida_sin_cierre', 'sin_comida', 'jornada_cerrada', 'horas_extra', 'medida_disciplinaria', 'ausencia') NOT NULL;

CREATE TABLE `ausencias` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `usuario_id` INTEGER NOT NULL,
  `tipo` VARCHAR(20) NOT NULL,
  `desde` DATE NOT NULL,
  `hasta` DATE NOT NULL,
  `motivo` VARCHAR(255) NULL,
  `estado` VARCHAR(15) NOT NULL DEFAULT 'pendiente',
  `solicitante_id` INTEGER NOT NULL,
  `comprobante_clave` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resuelta_en` DATETIME(3) NULL,
  `resuelta_por` VARCHAR(120) NULL,
  `resolucion` VARCHAR(255) NULL,
  `faltas_justificadas` INTEGER NOT NULL DEFAULT 0,

  INDEX `ausencias_usuario_id_estado_desde_idx`(`usuario_id`, `estado`, `desde`),
  INDEX `ausencias_estado_created_at_idx`(`estado`, `created_at`),
  INDEX `ausencias_solicitante_id_idx`(`solicitante_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ausencias` ADD CONSTRAINT `ausencias_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ausencias` ADD CONSTRAINT `ausencias_solicitante_id_fkey` FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
