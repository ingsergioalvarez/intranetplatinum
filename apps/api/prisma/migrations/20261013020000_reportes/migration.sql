-- CreateTable
CREATE TABLE `categorias_reporte` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `padre_id` INTEGER NULL,
    `nombre` VARCHAR(80) NOT NULL,
    `icono` VARCHAR(40) NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `categorias_reporte_padre_id_activo_idx`(`padre_id`, `activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `folios_reporte` (
    `anio` INTEGER NOT NULL,
    `ultimo` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`anio`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reportes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folio` VARCHAR(20) NOT NULL,
    `sitio_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `categoria_id` INTEGER NOT NULL,
    `creado_por` INTEGER NOT NULL,
    `titulo` VARCHAR(150) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `ubicacion_detalle` VARCHAR(200) NULL,
    `prioridad` ENUM('baja', 'media', 'alta', 'critica') NOT NULL,
    `estatus` ENUM('abierto', 'notificado', 'en_proceso', 'resuelto', 'cerrado') NOT NULL DEFAULT 'abierto',
    `lat` DECIMAL(10, 7) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `cerrado_en` DATETIME(3) NULL,

    UNIQUE INDEX `reportes_folio_key`(`folio`),
    INDEX `reportes_estatus_created_at_idx`(`estatus`, `created_at`),
    INDEX `reportes_cliente_id_created_at_idx`(`cliente_id`, `created_at`),
    INDEX `reportes_sitio_id_created_at_idx`(`sitio_id`, `created_at`),
    INDEX `reportes_categoria_id_idx`(`categoria_id`),
    INDEX `reportes_creado_por_created_at_idx`(`creado_por`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reporte_seguimientos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reporte_id` INTEGER NOT NULL,
    `usuario_id` INTEGER NOT NULL,
    `comentario` TEXT NULL,
    `estatus_anterior` ENUM('abierto', 'notificado', 'en_proceso', 'resuelto', 'cerrado') NULL,
    `estatus_nuevo` ENUM('abierto', 'notificado', 'en_proceso', 'resuelto', 'cerrado') NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reporte_seguimientos_reporte_id_created_at_idx`(`reporte_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reporte_evidencias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reporte_id` INTEGER NOT NULL,
    `seguimiento_id` INTEGER NULL,
    `archivo` VARCHAR(300) NOT NULL,
    `mime` VARCHAR(40) NOT NULL,
    `tamano` INTEGER NOT NULL,
    `subida_por` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reporte_evidencias_reporte_id_idx`(`reporte_id`),
    INDEX `reporte_evidencias_seguimiento_id_idx`(`seguimiento_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notificaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reporte_id` INTEGER NOT NULL,
    `contacto_id` INTEGER NOT NULL,
    `canal` ENUM('email', 'whatsapp') NOT NULL DEFAULT 'email',
    `estado` ENUM('pendiente', 'enviado', 'error') NOT NULL DEFAULT 'pendiente',
    `enviado_en` DATETIME(3) NULL,
    `error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notificaciones_reporte_id_idx`(`reporte_id`),
    INDEX `notificaciones_estado_created_at_idx`(`estado`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `categorias_reporte` ADD CONSTRAINT `categorias_reporte_padre_id_fkey` FOREIGN KEY (`padre_id`) REFERENCES `categorias_reporte`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reportes` ADD CONSTRAINT `reportes_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reportes` ADD CONSTRAINT `reportes_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reportes` ADD CONSTRAINT `reportes_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_reporte`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reportes` ADD CONSTRAINT `reportes_creado_por_fkey` FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reporte_seguimientos` ADD CONSTRAINT `reporte_seguimientos_reporte_id_fkey` FOREIGN KEY (`reporte_id`) REFERENCES `reportes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reporte_seguimientos` ADD CONSTRAINT `reporte_seguimientos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reporte_evidencias` ADD CONSTRAINT `reporte_evidencias_reporte_id_fkey` FOREIGN KEY (`reporte_id`) REFERENCES `reportes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reporte_evidencias` ADD CONSTRAINT `reporte_evidencias_seguimiento_id_fkey` FOREIGN KEY (`seguimiento_id`) REFERENCES `reporte_seguimientos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reporte_evidencias` ADD CONSTRAINT `reporte_evidencias_subida_por_fkey` FOREIGN KEY (`subida_por`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_reporte_id_fkey` FOREIGN KEY (`reporte_id`) REFERENCES `reportes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_contacto_id_fkey` FOREIGN KEY (`contacto_id`) REFERENCES `cliente_contactos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
