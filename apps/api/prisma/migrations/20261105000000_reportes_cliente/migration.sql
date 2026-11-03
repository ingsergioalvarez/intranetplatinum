-- CreateTable
CREATE TABLE `reportes_cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `sitio_id` INTEGER NOT NULL,
    `guardia_id` INTEGER NULL,
    `creado_por` INTEGER NOT NULL,
    `tipo` ENUM('servicio', 'guardia') NOT NULL,
    `urgente` BOOLEAN NOT NULL DEFAULT false,
    `asunto` VARCHAR(150) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `estatus` ENUM('abierto', 'en_revision', 'resuelto') NOT NULL DEFAULT 'abierto',
    `atendido_en` DATETIME(3) NULL,
    `atendido_por` VARCHAR(120) NULL,
    `respuesta` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reportes_cliente_cliente_id_estatus_created_at_idx`(`cliente_id`, `estatus`, `created_at`),
    INDEX `reportes_cliente_sitio_id_estatus_idx`(`sitio_id`, `estatus`),
    INDEX `reportes_cliente_creado_por_idx`(`creado_por`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reportes_cliente` ADD CONSTRAINT `reportes_cliente_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reportes_cliente` ADD CONSTRAINT `reportes_cliente_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reportes_cliente` ADD CONSTRAINT `reportes_cliente_guardia_id_fkey` FOREIGN KEY (`guardia_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reportes_cliente` ADD CONSTRAINT `reportes_cliente_creado_por_fkey` FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
