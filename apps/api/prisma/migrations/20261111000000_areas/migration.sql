-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `area_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `areas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `padre_id` INTEGER NULL,
    `jefe_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `empresa_id` INTEGER NOT NULL,

    INDEX `areas_padre_id_idx`(`padre_id`),
    INDEX `areas_jefe_id_idx`(`jefe_id`),
    INDEX `areas_empresa_id_idx`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `usuarios_area_id_idx` ON `usuarios`(`area_id`);

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `areas` ADD CONSTRAINT `areas_padre_id_fkey` FOREIGN KEY (`padre_id`) REFERENCES `areas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `areas` ADD CONSTRAINT `areas_jefe_id_fkey` FOREIGN KEY (`jefe_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `areas` ADD CONSTRAINT `areas_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
