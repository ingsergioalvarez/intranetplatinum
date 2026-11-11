-- CreateTable
CREATE TABLE `reporte_cliente_fotos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reporte_id` INTEGER NOT NULL,
    `archivo` VARCHAR(300) NOT NULL,
    `mime` VARCHAR(40) NOT NULL,
    `tamano` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reporte_cliente_fotos_reporte_id_idx`(`reporte_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reporte_cliente_fotos` ADD CONSTRAINT `reporte_cliente_fotos_reporte_id_fkey` FOREIGN KEY (`reporte_id`) REFERENCES `reportes_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
