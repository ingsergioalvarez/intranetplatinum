-- AlterTable
ALTER TABLE `marcaciones` ADD COLUMN `foto_clave` VARCHAR(255) NULL,
    ADD COLUMN `rostro_distancia` DOUBLE NULL,
    ADD COLUMN `rostro_intentos` INTEGER NULL;

-- CreateTable
CREATE TABLE `rostros_guardia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `descriptores` JSON NOT NULL,
    `foto_clave` VARCHAR(255) NOT NULL,
    `registrado_por_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reemplazado_en` DATETIME(3) NULL,

    INDEX `rostros_guardia_usuario_id_reemplazado_en_idx`(`usuario_id`, `reemplazado_en`),
    INDEX `rostros_guardia_registrado_por_id_idx`(`registrado_por_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rostros_guardia` ADD CONSTRAINT `rostros_guardia_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rostros_guardia` ADD CONSTRAINT `rostros_guardia_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
