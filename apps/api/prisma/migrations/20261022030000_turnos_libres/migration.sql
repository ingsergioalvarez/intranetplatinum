-- Turnos con horas y días libres (DA-37): 24 h / 12 h pasan a horas + patrón de días.

-- AlterTable
ALTER TABLE `sitio_guardia` ADD COLUMN `dias_descanso` INTEGER NULL,
    ADD COLUMN `dias_semana` INTEGER NULL,
    ADD COLUMN `dias_tipo` ENUM('diario', 'ciclo', 'semanal') NULL,
    ADD COLUMN `dias_trabajo` INTEGER NULL,
    ADD COLUMN `horas` INTEGER NULL;

-- AlterTable (las columnas nuevas se llenan desde la jornada anterior antes de quitarla)
ALTER TABLE `turnos` ADD COLUMN `dias_descanso` INTEGER NULL,
    ADD COLUMN `dias_semana` INTEGER NULL,
    ADD COLUMN `dias_tipo` ENUM('diario', 'ciclo', 'semanal') NOT NULL DEFAULT 'diario',
    ADD COLUMN `dias_trabajo` INTEGER NULL,
    ADD COLUMN `horas` INTEGER NOT NULL DEFAULT 24;

UPDATE `turnos`
SET `horas` = IF(`jornada` = '24x24', 24, 12),
    `dias_tipo` = IF(`jornada` = '24x24', 'ciclo', 'diario'),
    `dias_trabajo` = IF(`jornada` = '24x24', 1, NULL),
    `dias_descanso` = IF(`jornada` = '24x24', 1, NULL);

ALTER TABLE `turnos` DROP COLUMN `jornada`, ALTER COLUMN `horas` DROP DEFAULT;

-- Copia del horario en las asignaciones de turno (no eventos).
UPDATE `sitio_guardia`
SET `horas` = IF(`turno` = '24x24', 24, 12),
    `dias_tipo` = IF(`turno` = '24x24', 'ciclo', 'diario'),
    `dias_trabajo` = IF(`turno` = '24x24', 1, NULL),
    `dias_descanso` = IF(`turno` = '24x24', 1, NULL)
WHERE `tipo` <> 'eventual' AND `turno` IN ('24x24', '12x12');
