-- AlterTable
ALTER TABLE `marcaciones` ADD COLUMN `desfase_seg` INTEGER NULL,
    ADD COLUMN `hora_celular` DATETIME(3) NULL,
    ADD COLUMN `recibida_en` DATETIME(3) NULL;
