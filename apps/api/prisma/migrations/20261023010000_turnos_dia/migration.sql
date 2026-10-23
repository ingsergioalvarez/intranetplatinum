-- AlterTable
ALTER TABLE `bitacora_eventos` ADD COLUMN `decidido_en` DATETIME(3) NULL,
    ADD COLUMN `decidido_por_id` INTEGER NULL,
    ADD COLUMN `decision` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `turnos_dia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `sitio_id` INTEGER NOT NULL,
    `asignacion_id` INTEGER NULL,
    `programada_entrada` DATETIME(3) NOT NULL,
    `aviso_guardia_en` DATETIME(3) NULL,
    `no_se_presento_en` DATETIME(3) NULL,
    `falta_en` DATETIME(3) NULL,
    `falta_evento_id` INTEGER NULL,
    `entrada_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `turnos_dia_sitio_id_idx`(`sitio_id`),
    INDEX `turnos_dia_entrada_id_idx`(`entrada_id`),
    UNIQUE INDEX `turnos_dia_usuario_id_programada_entrada_key`(`usuario_id`, `programada_entrada`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `bitacora_eventos_decidido_por_id_idx` ON `bitacora_eventos`(`decidido_por_id`);

-- AddForeignKey
ALTER TABLE `bitacora_eventos` ADD CONSTRAINT `bitacora_eventos_decidido_por_id_fkey` FOREIGN KEY (`decidido_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turnos_dia` ADD CONSTRAINT `turnos_dia_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turnos_dia` ADD CONSTRAINT `turnos_dia_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turnos_dia` ADD CONSTRAINT `turnos_dia_entrada_id_fkey` FOREIGN KEY (`entrada_id`) REFERENCES `marcaciones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
