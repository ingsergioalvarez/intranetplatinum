-- A-54: los avisos saben qué atienden y se actualizan cuando alguien lo atiende
ALTER TABLE `avisos`
  ADD COLUMN `entidad` VARCHAR(30) NULL,
  ADD COLUMN `entidad_id` INTEGER NULL,
  ADD COLUMN `atendido_en` DATETIME(3) NULL,
  ADD COLUMN `atendido_por` VARCHAR(120) NULL,
  ADD COLUMN `resultado` VARCHAR(120) NULL;

CREATE INDEX `avisos_entidad_entidad_id_idx` ON `avisos`(`entidad`, `entidad_id`);
