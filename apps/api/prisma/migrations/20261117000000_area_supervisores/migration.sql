-- CreateTable
CREATE TABLE `area_supervisores` (
    `area_id` INTEGER NOT NULL,
    `usuario_id` INTEGER NOT NULL,

    INDEX `area_supervisores_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`area_id`, `usuario_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `area_supervisores` ADD CONSTRAINT `area_supervisores_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `area_supervisores` ADD CONSTRAINT `area_supervisores_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
