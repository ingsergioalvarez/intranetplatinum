-- A-39: solicitudes formales de cobertura (completa A-26)
CREATE TABLE `solicitudes_cobertura` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `sitio_id` INTEGER NOT NULL,
  `solicitante_id` INTEGER NOT NULL,
  `guardia_id` INTEGER NULL,
  `fecha` DATE NOT NULL,
  `motivo` VARCHAR(255) NOT NULL,
  `estado` VARCHAR(15) NOT NULL DEFAULT 'pendiente',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `cerrada_en` DATETIME(3) NULL,
  `cerrada_por` VARCHAR(120) NULL,
  `resolucion` VARCHAR(255) NULL,
  `cobertura_id` INTEGER NULL,
  `recordada_en` DATETIME(3) NULL,

  INDEX `solicitudes_cobertura_estado_created_at_idx`(`estado`, `created_at`),
  INDEX `solicitudes_cobertura_solicitante_id_idx`(`solicitante_id`),
  INDEX `solicitudes_cobertura_sitio_id_estado_idx`(`sitio_id`, `estado`),
  INDEX `solicitudes_cobertura_guardia_id_idx`(`guardia_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `solicitudes_cobertura` ADD CONSTRAINT `solicitudes_cobertura_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `solicitudes_cobertura` ADD CONSTRAINT `solicitudes_cobertura_solicitante_id_fkey` FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `solicitudes_cobertura` ADD CONSTRAINT `solicitudes_cobertura_guardia_id_fkey` FOREIGN KEY (`guardia_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
