-- AlterTable
ALTER TABLE `empresas` ADD COLUMN `color_modo` VARCHAR(15) NOT NULL DEFAULT 'defecto';

-- Las empresas que ya tenían colores guardados (elegidos a mano) quedan como personalizadas.
UPDATE `empresas` SET `color_modo` = 'personalizado' WHERE `color_principal` IS NOT NULL;
