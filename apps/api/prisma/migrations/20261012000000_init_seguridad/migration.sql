-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clave` VARCHAR(30) NOT NULL,
    `nombre` VARCHAR(60) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_clave_key`(`clave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permisos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clave` VARCHAR(60) NOT NULL,
    `descripcion` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `permisos_clave_key`(`clave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rol_permiso` (
    `rol_id` INTEGER NOT NULL,
    `permiso_id` INTEGER NOT NULL,

    INDEX `rol_permiso_permiso_id_idx`(`permiso_id`),
    PRIMARY KEY (`rol_id`, `permiso_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(120) NOT NULL,
    `email` VARCHAR(160) NOT NULL,
    `telefono` VARCHAR(30) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `rol_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `intentos_fallidos` INTEGER NOT NULL DEFAULT 0,
    `bloqueado_hasta` DATETIME(3) NULL,
    `ultimo_acceso` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    INDEX `usuarios_rol_id_idx`(`rol_id`),
    INDEX `usuarios_cliente_id_idx`(`cliente_id`),
    INDEX `usuarios_activo_deleted_at_idx`(`activo`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rol_permiso` ADD CONSTRAINT `rol_permiso_rol_id_fkey` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rol_permiso` ADD CONSTRAINT `rol_permiso_permiso_id_fkey` FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_rol_id_fkey` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
