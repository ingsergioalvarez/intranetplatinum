-- AlterTable
ALTER TABLE `clientes` ADD COLUMN `propietario_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `grupos_guardias` ADD COLUMN `propietario_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `es_super_admin` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `propietario_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `clientes_propietario_id_idx` ON `clientes`(`propietario_id`);

-- CreateIndex
CREATE INDEX `grupos_guardias_propietario_id_idx` ON `grupos_guardias`(`propietario_id`);

-- CreateIndex
CREATE INDEX `usuarios_propietario_id_idx` ON `usuarios`(`propietario_id`);

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_propietario_id_fkey` FOREIGN KEY (`propietario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clientes` ADD CONSTRAINT `clientes_propietario_id_fkey` FOREIGN KEY (`propietario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grupos_guardias` ADD CONSTRAINT `grupos_guardias_propietario_id_fkey` FOREIGN KEY (`propietario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
