-- C-08: RFC de clientes, folio de reportes, nombre de grupos y folio anual pasan a ser únicos por empresa
-- (antes eran únicos en todo el sistema).
CREATE UNIQUE INDEX `clientes_empresa_id_rfc_key` ON `clientes`(`empresa_id`, `rfc`);
DROP INDEX `clientes_rfc_key` ON `clientes`;

CREATE UNIQUE INDEX `reportes_empresa_id_folio_key` ON `reportes`(`empresa_id`, `folio`);
DROP INDEX `reportes_folio_key` ON `reportes`;

CREATE UNIQUE INDEX `grupos_guardias_empresa_id_nombre_key` ON `grupos_guardias`(`empresa_id`, `nombre`);
DROP INDEX `grupos_guardias_nombre_key` ON `grupos_guardias`;

ALTER TABLE `folios_reporte` DROP PRIMARY KEY, ADD PRIMARY KEY (`empresa_id`, `anio`);
