-- A-60: botón de pánico
ALTER TABLE `avisos` MODIFY `tipo` ENUM('reporte_nuevo', 'reporte_estatus', 'reporte_comentario', 'rostro_pendiente', 'rostro_suplantacion', 'rostro_duplicado', 'rostro_pantalla', 'rostro_reto', 'rostro_aprobado', 'rostro_rechazado', 'cuenta_intento', 'asignacion', 'grupo', 'retardo', 'marca_alerta', 'horas_extra', 'cobertura', 'emergencia') NOT NULL;

CREATE TABLE `emergencias` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `usuario_id` INTEGER NOT NULL,
  `sitio_id` INTEGER NULL,
  `estado` VARCHAR(10) NOT NULL DEFAULT 'activa',
  `tipo` VARCHAR(15) NULL,
  `lat` DECIMAL(10, 7) NULL,
  `lng` DECIMAL(10, 7) NULL,
  `precision_m` INTEGER NULL,
  `bateria` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `acusada_por_id` INTEGER NULL,
  `acusada_por` VARCHAR(120) NULL,
  `acusada_en` DATETIME(3) NULL,
  `escaladas` INTEGER NOT NULL DEFAULT 0,
  `escalada_en` DATETIME(3) NULL,
  `cerrada_en` DATETIME(3) NULL,
  `cerrada_por` VARCHAR(120) NULL,
  `resultado` VARCHAR(15) NULL,
  `nota` VARCHAR(255) NULL,

  INDEX `emergencias_estado_created_at_idx`(`estado`, `created_at`),
  INDEX `emergencias_usuario_id_created_at_idx`(`usuario_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `emergencias` ADD CONSTRAINT `emergencias_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `emergencias` ADD CONSTRAINT `emergencias_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
