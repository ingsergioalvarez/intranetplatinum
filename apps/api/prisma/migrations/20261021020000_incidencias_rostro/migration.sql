-- AlterTable
ALTER TABLE `avisos` ADD COLUMN `foto_clave` VARCHAR(255) NULL,
    MODIFY `tipo` ENUM('reporte_nuevo', 'reporte_estatus', 'reporte_comentario', 'rostro_pendiente', 'rostro_suplantacion', 'rostro_duplicado', 'rostro_pantalla', 'rostro_reto') NOT NULL;

-- CreateTable
CREATE TABLE `incidencias_rostro` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `motivo` ENUM('pantalla', 'rostro_de_otro', 'no_titular', 'reto_fallido', 'registro_duplicado') NOT NULL,
    `tipo_marca` ENUM('entrada', 'inicio_comida', 'fin_comida', 'salida') NULL,
    `foto_clave` VARCHAR(255) NOT NULL,
    `rostro_de_id` INTEGER NULL,
    `sitio_id` INTEGER NULL,
    `revisada_por_id` INTEGER NULL,
    `revisada_en` DATETIME(3) NULL,
    `nota` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `incidencias_rostro_revisada_en_created_at_idx`(`revisada_en`, `created_at`),
    INDEX `incidencias_rostro_usuario_id_created_at_idx`(`usuario_id`, `created_at`),
    INDEX `incidencias_rostro_rostro_de_id_idx`(`rostro_de_id`),
    INDEX `incidencias_rostro_revisada_por_id_idx`(`revisada_por_id`),
    INDEX `incidencias_rostro_sitio_id_idx`(`sitio_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `incidencias_rostro` ADD CONSTRAINT `incidencias_rostro_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incidencias_rostro` ADD CONSTRAINT `incidencias_rostro_rostro_de_id_fkey` FOREIGN KEY (`rostro_de_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incidencias_rostro` ADD CONSTRAINT `incidencias_rostro_revisada_por_id_fkey` FOREIGN KEY (`revisada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incidencias_rostro` ADD CONSTRAINT `incidencias_rostro_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
