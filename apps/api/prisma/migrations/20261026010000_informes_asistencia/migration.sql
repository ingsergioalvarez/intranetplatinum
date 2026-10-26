-- CreateTable
CREATE TABLE `informes_asistencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folio` VARCHAR(20) NULL,
    `tipo` ENUM('personal', 'general') NOT NULL,
    `usuario_id` INTEGER NULL,
    `sitio_id` INTEGER NULL,
    `desde` DATE NOT NULL,
    `hasta` DATE NOT NULL,
    `incluir_detalle` BOOLEAN NOT NULL DEFAULT false,
    `incluir_firmas` BOOLEAN NOT NULL DEFAULT true,
    `datos` JSON NOT NULL,
    `huella` CHAR(64) NOT NULL,
    `hash` CHAR(64) NOT NULL,
    `generado_por_id` INTEGER NULL,
    `reemplaza_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `informes_asistencia_folio_key`(`folio`),
    INDEX `informes_asistencia_tipo_usuario_id_desde_hasta_idx`(`tipo`, `usuario_id`, `desde`, `hasta`),
    INDEX `informes_asistencia_huella_idx`(`huella`),
    INDEX `informes_asistencia_created_at_idx`(`created_at`),
    INDEX `informes_asistencia_sitio_id_idx`(`sitio_id`),
    INDEX `informes_asistencia_generado_por_id_idx`(`generado_por_id`),
    INDEX `informes_asistencia_reemplaza_id_idx`(`reemplaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `informes_asistencia` ADD CONSTRAINT `informes_asistencia_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `informes_asistencia` ADD CONSTRAINT `informes_asistencia_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `informes_asistencia` ADD CONSTRAINT `informes_asistencia_generado_por_id_fkey` FOREIGN KEY (`generado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `informes_asistencia` ADD CONSTRAINT `informes_asistencia_reemplaza_id_fkey` FOREIGN KEY (`reemplaza_id`) REFERENCES `informes_asistencia`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
