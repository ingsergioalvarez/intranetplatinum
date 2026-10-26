-- CreateTable
CREATE TABLE `cambios_turno` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('cubrir', 'descanso') NOT NULL,
    `estado` ENUM('pendiente', 'aprobado', 'rechazado', 'cancelado') NOT NULL DEFAULT 'pendiente',
    `usuario_id` INTEGER NOT NULL,
    `solicitante_id` INTEGER NOT NULL,
    `sitio_id` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `fecha_nueva` DATE NULL,
    `cubre_id` INTEGER NULL,
    `motivo` VARCHAR(255) NOT NULL,
    `hora_inicio` CHAR(5) NOT NULL,
    `horas` INTEGER NOT NULL,
    `resuelto_por_id` INTEGER NULL,
    `resuelto_en` DATETIME(3) NULL,
    `nota_resolucion` VARCHAR(255) NULL,
    `cobertura_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cambios_turno_usuario_id_fecha_idx`(`usuario_id`, `fecha`),
    INDEX `cambios_turno_estado_fecha_idx`(`estado`, `fecha`),
    INDEX `cambios_turno_sitio_id_idx`(`sitio_id`),
    INDEX `cambios_turno_solicitante_id_idx`(`solicitante_id`),
    INDEX `cambios_turno_cubre_id_idx`(`cubre_id`),
    INDEX `cambios_turno_resuelto_por_id_idx`(`resuelto_por_id`),
    INDEX `cambios_turno_cobertura_id_idx`(`cobertura_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pausas_turno` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `cambio_id` INTEGER NOT NULL,

    INDEX `pausas_turno_cambio_id_idx`(`cambio_id`),
    UNIQUE INDEX `pausas_turno_usuario_id_fecha_key`(`usuario_id`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cambios_turno` ADD CONSTRAINT `cambios_turno_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cambios_turno` ADD CONSTRAINT `cambios_turno_solicitante_id_fkey` FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cambios_turno` ADD CONSTRAINT `cambios_turno_cubre_id_fkey` FOREIGN KEY (`cubre_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cambios_turno` ADD CONSTRAINT `cambios_turno_resuelto_por_id_fkey` FOREIGN KEY (`resuelto_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cambios_turno` ADD CONSTRAINT `cambios_turno_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cambios_turno` ADD CONSTRAINT `cambios_turno_cobertura_id_fkey` FOREIGN KEY (`cobertura_id`) REFERENCES `coberturas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pausas_turno` ADD CONSTRAINT `pausas_turno_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pausas_turno` ADD CONSTRAINT `pausas_turno_cambio_id_fkey` FOREIGN KEY (`cambio_id`) REFERENCES `cambios_turno`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
