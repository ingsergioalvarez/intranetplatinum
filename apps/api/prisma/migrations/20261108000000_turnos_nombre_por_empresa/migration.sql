-- C-08: el nombre del turno es único por empresa (antes era único en todo el sistema).
CREATE UNIQUE INDEX `turnos_empresa_id_nombre_key` ON `turnos`(`empresa_id`, `nombre`);
DROP INDEX `turnos_nombre_key` ON `turnos`;
