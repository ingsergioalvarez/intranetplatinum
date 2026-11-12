-- CreateTable
CREATE TABLE `c2_eventos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sitio_id` INTEGER NULL,
    `sitio_nombre` VARCHAR(150) NULL,
    `cliente_nombre` VARCHAR(150) NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `detalle` VARCHAR(500) NULL,
    `usuario_id` INTEGER NULL,
    `usuario_nombre` VARCHAR(120) NULL,
    `minutos` INTEGER NULL,
    `entidad` VARCHAR(20) NULL,
    `entidad_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `c2_eventos_created_at_idx`(`created_at`),
    INDEX `c2_eventos_sitio_id_created_at_idx`(`sitio_id`, `created_at`),
    INDEX `c2_eventos_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c2_eventos` ADD CONSTRAINT `c2_eventos_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c2_eventos` ADD CONSTRAINT `c2_eventos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
