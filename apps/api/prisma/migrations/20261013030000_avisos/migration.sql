-- CreateTable
CREATE TABLE `cliente_reglas_aviso` (
    `cliente_id` INTEGER NOT NULL,
    `prioridad` ENUM('baja', 'media', 'alta', 'critica') NOT NULL,
    `destino` ENUM('supervisor', 'cliente', 'ambos') NOT NULL,

    PRIMARY KEY (`cliente_id`, `prioridad`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `avisos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `reporte_id` INTEGER NULL,
    `tipo` ENUM('reporte_nuevo', 'reporte_estatus', 'reporte_comentario') NOT NULL,
    `mensaje` VARCHAR(255) NOT NULL,
    `leido_en` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `avisos_usuario_id_leido_en_created_at_idx`(`usuario_id`, `leido_en`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cliente_reglas_aviso` ADD CONSTRAINT `cliente_reglas_aviso_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avisos` ADD CONSTRAINT `avisos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avisos` ADD CONSTRAINT `avisos_reporte_id_fkey` FOREIGN KEY (`reporte_id`) REFERENCES `reportes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
