-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `empresa_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `empresas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(120) NOT NULL,
    `razon_social` VARCHAR(160) NULL,
    `rfc` VARCHAR(13) NULL,
    `calle` VARCHAR(160) NULL,
    `calle2` VARCHAR(160) NULL,
    `codigo_postal` VARCHAR(10) NULL,
    `ciudad` VARCHAR(80) NULL,
    `estado` VARCHAR(80) NULL,
    `pais` VARCHAR(80) NULL,
    `telefono` VARCHAR(30) NULL,
    `email` VARCHAR(160) NULL,
    `sitio_web` VARCHAR(200) NULL,
    `zona_horaria` VARCHAR(60) NOT NULL DEFAULT 'America/Mexico_City',
    `moneda` CHAR(3) NOT NULL DEFAULT 'MXN',
    `color_principal` CHAR(7) NULL,
    `color_acento` CHAR(7) NULL,
    `logo_clave` VARCHAR(255) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `empresas_activa_idx`(`activa`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empresa_modulos` (
    `empresa_id` INTEGER NOT NULL,
    `modulo` VARCHAR(40) NOT NULL,
    `encendido` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`empresa_id`, `modulo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `usuarios_empresa_id_idx` ON `usuarios`(`empresa_id`);

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `empresa_modulos` ADD CONSTRAINT `empresa_modulos_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Comunicalo es la empresa 1 (C-07): la empresa propia. Todos los usuarios existentes pasan a ella.
-- Sus módulos opcionales los enciende `db:seed` (la primera vez, con todos encendidos).
INSERT INTO `empresas` (`id`, `nombre`, `zona_horaria`, `moneda`, `activa`, `created_at`, `updated_at`)
VALUES (1, 'Comunicalo', 'America/Mexico_City', 'MXN', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

UPDATE `usuarios` SET `empresa_id` = 1;
