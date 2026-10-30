-- A-35: motivo del plan del supervisor y de "no puedo quedarme" del guardia
ALTER TABLE `casos_cobertura` ADD COLUMN `motivo` VARCHAR(30) NULL;

ALTER TABLE `horas_extra`
  ADD COLUMN `no_puede_en` DATETIME(3) NULL,
  ADD COLUMN `no_puede_motivo` VARCHAR(30) NULL,
  ADD COLUMN `no_puede_nota` VARCHAR(255) NULL;
