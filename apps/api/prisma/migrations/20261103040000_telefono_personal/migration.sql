-- A-60: teléfono personal opcional (el de contacto puede ser el compartido de la empresa)
ALTER TABLE `usuarios` ADD COLUMN `telefono_personal` VARCHAR(30) NULL;
