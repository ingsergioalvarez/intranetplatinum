-- CreateTable
CREATE TABLE `marcaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_cliente` CHAR(36) NOT NULL,
    `usuario_id` INTEGER NOT NULL,
    `sitio_id` INTEGER NULL,
    `entrada_id` INTEGER NULL,
    `tipo` ENUM('entrada', 'inicio_comida', 'fin_comida', 'salida') NOT NULL,
    `registrada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lat` DECIMAL(10, 7) NOT NULL,
    `lng` DECIMAL(10, 7) NOT NULL,
    `precision_m` INTEGER NOT NULL,
    `distancia_m` INTEGER NULL,
    `alertas` JSON NOT NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,

    UNIQUE INDEX `marcaciones_id_cliente_key`(`id_cliente`),
    INDEX `marcaciones_usuario_id_registrada_en_idx`(`usuario_id`, `registrada_en`),
    INDEX `marcaciones_entrada_id_idx`(`entrada_id`),
    INDEX `marcaciones_sitio_id_registrada_en_idx`(`sitio_id`, `registrada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `marcaciones` ADD CONSTRAINT `marcaciones_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marcaciones` ADD CONSTRAINT `marcaciones_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
