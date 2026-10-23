-- DropForeignKey
ALTER TABLE `rostros_guardia` DROP FOREIGN KEY `rostros_guardia_registrado_por_id_fkey`;

-- AlterTable
ALTER TABLE `rostros_guardia` MODIFY `registrado_por_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `rostros_guardia` ADD CONSTRAINT `rostros_guardia_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
