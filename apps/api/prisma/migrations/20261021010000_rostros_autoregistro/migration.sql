-- AlterTable
ALTER TABLE `avisos` ADD COLUMN `ruta` VARCHAR(200) NULL,
    MODIFY `tipo` ENUM('reporte_nuevo', 'reporte_estatus', 'reporte_comentario', 'rostro_pendiente', 'rostro_suplantacion', 'rostro_duplicado') NOT NULL;

-- AlterTable
ALTER TABLE `marcaciones` ADD COLUMN `rostro_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `rostros_guardia` ADD COLUMN `autoregistro` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `estado` ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'aprobado',
    ADD COLUMN `fotos` JSON NULL,
    ADD COLUMN `motivo_rechazo` VARCHAR(255) NULL,
    ADD COLUMN `revisado_en` DATETIME(3) NULL,
    ADD COLUMN `revisado_por_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `rostros_guardia_estado_reemplazado_en_idx` ON `rostros_guardia`(`estado`, `reemplazado_en`);

-- CreateIndex
CREATE INDEX `rostros_guardia_revisado_por_id_idx` ON `rostros_guardia`(`revisado_por_id`);

-- AddForeignKey
ALTER TABLE `marcaciones` ADD CONSTRAINT `marcaciones_rostro_id_fkey` FOREIGN KEY (`rostro_id`) REFERENCES `rostros_guardia`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rostros_guardia` ADD CONSTRAINT `rostros_guardia_revisado_por_id_fkey` FOREIGN KEY (`revisado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
