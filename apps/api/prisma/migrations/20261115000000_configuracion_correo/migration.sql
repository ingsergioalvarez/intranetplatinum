-- CreateTable
CREATE TABLE `configuracion_correo` (
    `id` INTEGER NOT NULL,
    `host` VARCHAR(255) NOT NULL,
    `puerto` INTEGER NOT NULL,
    `cifrado` VARCHAR(10) NOT NULL,
    `usuario` VARCHAR(255) NOT NULL,
    `password_cifrada` TEXT NULL,
    `remitente_nombre` VARCHAR(100) NOT NULL,
    `remitente_correo` VARCHAR(255) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT false,
    `actualizado_por` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
