-- AlterTable
ALTER TABLE `pausas_turno` ADD COLUMN `caso_id` INTEGER NULL,
    MODIFY `cambio_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `casos_cobertura` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entrada_id` INTEGER NOT NULL,
    `guardia_id` INTEGER NOT NULL,
    `sitio_id` INTEGER NOT NULL,
    `relevo_id` INTEGER NULL,
    `relevo_inicio` DATETIME(3) NULL,
    `estado` ENUM('en_espera', 'resuelto', 'cancelado') NOT NULL DEFAULT 'en_espera',
    `decision` ENUM('en_camino', 'no_llegara', 'otro_cubre') NOT NULL,
    `siguiente` ENUM('normal', 'descansa') NULL,
    `descanso_extra_horas` INTEGER NOT NULL DEFAULT 0,
    `fin_cubierto` DATETIME(3) NULL,
    `regresa_en` DATETIME(3) NULL,
    `limite_extra` DATETIME(3) NULL,
    `cobertura_id` INTEGER NULL,
    `resuelto_por_id` INTEGER NULL,
    `reconsultar_en` DATETIME(3) NULL,
    `nota` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `casos_cobertura_entrada_id_key`(`entrada_id`),
    INDEX `casos_cobertura_guardia_id_idx`(`guardia_id`),
    INDEX `casos_cobertura_sitio_id_idx`(`sitio_id`),
    INDEX `casos_cobertura_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `pausas_turno_caso_id_idx` ON `pausas_turno`(`caso_id`);

-- AddForeignKey
ALTER TABLE `pausas_turno` ADD CONSTRAINT `pausas_turno_caso_id_fkey` FOREIGN KEY (`caso_id`) REFERENCES `casos_cobertura`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `casos_cobertura` ADD CONSTRAINT `casos_cobertura_guardia_id_fkey` FOREIGN KEY (`guardia_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `casos_cobertura` ADD CONSTRAINT `casos_cobertura_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `casos_cobertura` ADD CONSTRAINT `casos_cobertura_entrada_id_fkey` FOREIGN KEY (`entrada_id`) REFERENCES `marcaciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
