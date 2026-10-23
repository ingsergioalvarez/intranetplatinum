-- AlterTable
ALTER TABLE `sitios` ADD COLUMN `supervisor_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `sitios_supervisor_id_idx` ON `sitios`(`supervisor_id`);

-- AddForeignKey
ALTER TABLE `sitios` ADD CONSTRAINT `sitios_supervisor_id_fkey` FOREIGN KEY (`supervisor_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
