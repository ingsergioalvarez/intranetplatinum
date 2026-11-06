-- Alcance por rol (C-11 parte 4, DC-019): cada rol dice hasta dónde llega (toda la empresa, su área y subáreas, solo su
-- área o solo ella o él). Los roles de partida conservan lo que ya tenían por su nombre: el admin ve toda la empresa, el
-- jefe su área y subáreas, el supervisor su área y el colaborador solo lo suyo. Un rol nuevo empieza en "solo ella o él".

-- AlterTable
ALTER TABLE `roles` ADD COLUMN `alcance` ENUM('empresa', 'area_subareas', 'area', 'propio') NOT NULL DEFAULT 'propio';

UPDATE `roles` SET `alcance` = 'empresa' WHERE `clave` = 'admin';
UPDATE `roles` SET `alcance` = 'area_subareas' WHERE `clave` = 'jefe';
UPDATE `roles` SET `alcance` = 'area' WHERE `clave` = 'supervisor';
UPDATE `roles` SET `alcance` = 'propio' WHERE `clave` = 'colaborador';
