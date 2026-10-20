-- F2-06 / F2-07 (D-017): grupos de guardias y tipos de asignación.
-- Escrita a mano: el diff de Prisma eliminaba la FK de sitio_id sin recrearla
-- y volvía a crear una FK existente en reporte_evidencias.

-- CreateTable
CREATE TABLE `grupos_guardias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `grupos_guardias_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grupo_integrantes` (
    `grupo_id` INTEGER NOT NULL,
    `usuario_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `grupo_integrantes_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`grupo_id`, `usuario_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- La FK de usuario_id se recrea con ON DELETE SET NULL (columna ahora opcional).
ALTER TABLE `sitio_guardia` DROP FOREIGN KEY `sitio_guardia_usuario_id_fkey`;

-- AlterTable
ALTER TABLE `sitio_guardia` ADD COLUMN `grupo_id` INTEGER NULL,
    ADD COLUMN `hora_fin` CHAR(5) NULL,
    ADD COLUMN `hora_inicio` CHAR(5) NULL,
    ADD COLUMN `tipo` ENUM('fija', 'temporal', 'eventual') NOT NULL DEFAULT 'fija',
    ADD COLUMN `vigente_hasta` DATE NULL,
    MODIFY `usuario_id` INTEGER NULL,
    MODIFY `turno` ENUM('diurno', 'nocturno', '24x24', 'mixto') NULL;

-- Datos existentes: con fecha de fin = temporal; la vigencia efectiva es la fecha de fin.
UPDATE `sitio_guardia` SET `vigente_hasta` = `hasta`, `tipo` = IF(`hasta` IS NULL, 'fija', 'temporal');

-- Índices nuevos antes de quitar los viejos (las FK siempre conservan un índice).
CREATE INDEX `sitio_guardia_sitio_id_vigente_hasta_idx` ON `sitio_guardia`(`sitio_id`, `vigente_hasta`);
CREATE INDEX `sitio_guardia_usuario_id_vigente_hasta_idx` ON `sitio_guardia`(`usuario_id`, `vigente_hasta`);
CREATE INDEX `sitio_guardia_grupo_id_vigente_hasta_idx` ON `sitio_guardia`(`grupo_id`, `vigente_hasta`);
DROP INDEX `sitio_guardia_sitio_id_hasta_idx` ON `sitio_guardia`;
DROP INDEX `sitio_guardia_usuario_id_hasta_idx` ON `sitio_guardia`;

-- AddForeignKey
ALTER TABLE `sitio_guardia` ADD CONSTRAINT `sitio_guardia_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sitio_guardia` ADD CONSTRAINT `sitio_guardia_grupo_id_fkey` FOREIGN KEY (`grupo_id`) REFERENCES `grupos_guardias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `grupo_integrantes` ADD CONSTRAINT `grupo_integrantes_grupo_id_fkey` FOREIGN KEY (`grupo_id`) REFERENCES `grupos_guardias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `grupo_integrantes` ADD CONSTRAINT `grupo_integrantes_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
