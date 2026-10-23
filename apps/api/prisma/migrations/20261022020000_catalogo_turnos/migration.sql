-- AlterTable
ALTER TABLE `sitio_guardia` ADD COLUMN `turno_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `turnos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `jornada` ENUM('diurno', 'nocturno', '24x24', 'mixto', '12x12') NOT NULL,
    `hora_entrada` CHAR(5) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `turnos_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `sitio_guardia_turno_id_idx` ON `sitio_guardia`(`turno_id`);

-- AddForeignKey
ALTER TABLE `sitio_guardia` ADD CONSTRAINT `sitio_guardia_turno_id_fkey` FOREIGN KEY (`turno_id`) REFERENCES `turnos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Datos: un turno del catálogo por cada combinación (jornada, hora de entrada) ya usada, y las
-- asignaciones existentes quedan ligadas a él (DA-37).
INSERT INTO `turnos` (`nombre`, `jornada`, `hora_entrada`, `updated_at`)
SELECT DISTINCT CONCAT(IF(`turno` = '24x24', '24 h', '12 h'), ' · ', `hora_inicio`), `turno`, `hora_inicio`, CURRENT_TIMESTAMP(3)
FROM `sitio_guardia`
WHERE `tipo` <> 'eventual' AND `turno` IN ('24x24', '12x12') AND `hora_inicio` IS NOT NULL;

UPDATE `sitio_guardia` sg
JOIN `turnos` t ON t.`jornada` = sg.`turno` AND t.`hora_entrada` = sg.`hora_inicio`
SET sg.`turno_id` = t.`id`
WHERE sg.`tipo` <> 'eventual';
