-- A-45: coberturas que creó cada plan, para poder cancelarlo o cambiarlo
ALTER TABLE `casos_cobertura` ADD COLUMN `coberturas_ids` VARCHAR(255) NULL;
