-- AlterTable
ALTER TABLE `bitacora_eventos` MODIFY `tipo` ENUM('retardo', 'salida_anticipada', 'comida_fuera', 'racha', 'falta', 'no_se_presento', 'incidencia_rostro', 'rostro_registrado', 'rostro_aprobado', 'rostro_rechazado', 'rostro_eliminado', 'asignacion', 'asignacion_cambio', 'asignacion_fin', 'grupo_alta', 'grupo_baja', 'cobertura', 'cobertura_cancelada') NOT NULL;

-- CreateTable
CREATE TABLE `coberturas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `sitio_id` INTEGER NOT NULL,
    `cubre_a_id` INTEGER NULL,
    `desde` DATE NOT NULL,
    `hasta` DATE NOT NULL,
    `hora_inicio` CHAR(5) NOT NULL,
    `horas` INTEGER NOT NULL,
    `motivo` VARCHAR(255) NOT NULL,
    `descanso_horas` INTEGER NULL,
    `creada_por_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cancelada_en` DATETIME(3) NULL,

    INDEX `coberturas_usuario_id_desde_idx`(`usuario_id`, `desde`),
    INDEX `coberturas_sitio_id_desde_idx`(`sitio_id`, `desde`),
    INDEX `coberturas_cubre_a_id_idx`(`cubre_a_id`),
    INDEX `coberturas_creada_por_id_idx`(`creada_por_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `coberturas` ADD CONSTRAINT `coberturas_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coberturas` ADD CONSTRAINT `coberturas_cubre_a_id_fkey` FOREIGN KEY (`cubre_a_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coberturas` ADD CONSTRAINT `coberturas_creada_por_id_fkey` FOREIGN KEY (`creada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coberturas` ADD CONSTRAINT `coberturas_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
