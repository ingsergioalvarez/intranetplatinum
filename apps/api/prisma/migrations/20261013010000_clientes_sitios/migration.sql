-- CreateTable
CREATE TABLE `clientes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `razon_social` VARCHAR(200) NOT NULL,
    `nombre_comercial` VARCHAR(150) NOT NULL,
    `rfc` VARCHAR(13) NULL,
    `giro` VARCHAR(100) NULL,
    `direccion_fiscal` VARCHAR(300) NULL,
    `telefono` VARCHAR(30) NULL,
    `email` VARCHAR(160) NULL,
    `logo_url` VARCHAR(500) NULL,
    `estatus` ENUM('activo', 'suspendido') NOT NULL DEFAULT 'activo',
    `notas` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `clientes_rfc_key`(`rfc`),
    INDEX `clientes_deleted_at_estatus_idx`(`deleted_at`, `estatus`),
    INDEX `clientes_nombre_comercial_idx`(`nombre_comercial`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cliente_contactos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `puesto` VARCHAR(100) NULL,
    `telefono` VARCHAR(30) NULL,
    `celular` VARCHAR(30) NULL,
    `email` VARCHAR(160) NULL,
    `es_responsable` BOOLEAN NOT NULL DEFAULT false,
    `recibe_notificaciones` BOOLEAN NOT NULL DEFAULT false,
    `prioridad` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `cliente_contactos_cliente_id_deleted_at_idx`(`cliente_id`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sitios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,
    `direccion` VARCHAR(300) NULL,
    `referencias` VARCHAR(300) NULL,
    `lat` DECIMAL(10, 7) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `sitios_cliente_id_deleted_at_idx`(`cliente_id`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sitio_guardia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sitio_id` INTEGER NOT NULL,
    `usuario_id` INTEGER NOT NULL,
    `turno` ENUM('diurno', 'nocturno', '24x24', 'mixto') NOT NULL,
    `desde` DATE NOT NULL,
    `hasta` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sitio_guardia_sitio_id_hasta_idx`(`sitio_id`, `hasta`),
    INDEX `sitio_guardia_usuario_id_hasta_idx`(`usuario_id`, `hasta`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cliente_contactos` ADD CONSTRAINT `cliente_contactos_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sitios` ADD CONSTRAINT `sitios_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sitio_guardia` ADD CONSTRAINT `sitio_guardia_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sitio_guardia` ADD CONSTRAINT `sitio_guardia_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
