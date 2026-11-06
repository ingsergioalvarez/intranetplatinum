-- Roles por empresa (C-11 parte 3, DC-019): cada empresa tiene sus propios roles con sus permisos editables, y la clave
-- interna `guardia` pasa a `colaborador`.
-- Los roles que ya existían (globales) pasan a ser los de la primera empresa (Comunicalo); las demás empresas reciben una
-- copia con los mismos permisos, y sus usuarios se pasan a esa copia. No se pierde ningún usuario ni permiso.

-- La clave ya no es única en toda la tabla, sino por empresa.
DROP INDEX `roles_clave_key` ON `roles`;

ALTER TABLE `roles` ADD COLUMN `empresa_id` INTEGER NULL,
    ADD COLUMN `es_base` BOOLEAN NOT NULL DEFAULT false;

UPDATE `roles` SET `clave` = 'colaborador', `nombre` = 'Colaborador' WHERE `clave` = 'guardia';
UPDATE `roles` SET `es_base` = true WHERE `clave` IN ('admin', 'jefe', 'supervisor', 'colaborador');
UPDATE `roles` SET `empresa_id` = (SELECT MIN(`id`) FROM `empresas`);

-- Copia para cada una de las demás empresas.
INSERT INTO `roles` (`clave`, `nombre`, `descripcion`, `es_base`, `created_at`, `updated_at`, `empresa_id`)
SELECT r.`clave`, r.`nombre`, r.`descripcion`, r.`es_base`, NOW(3), NOW(3), e.`id`
FROM `roles` r
JOIN `empresas` e ON e.`id` <> (SELECT MIN(`id`) FROM `empresas`)
WHERE r.`empresa_id` = (SELECT MIN(`id`) FROM `empresas`);

INSERT INTO `rol_permiso` (`rol_id`, `permiso_id`)
SELECT nuevo.`id`, rp.`permiso_id`
FROM `rol_permiso` rp
JOIN `roles` orig ON orig.`id` = rp.`rol_id`
JOIN `roles` nuevo ON nuevo.`clave` = orig.`clave` AND nuevo.`empresa_id` <> orig.`empresa_id`
WHERE orig.`empresa_id` = (SELECT MIN(`id`) FROM `empresas`);

-- Los usuarios de las demás empresas pasan a los roles de su empresa.
UPDATE `usuarios` u
JOIN `roles` orig ON orig.`id` = u.`rol_id`
JOIN `roles` nuevo ON nuevo.`clave` = orig.`clave` AND nuevo.`empresa_id` = u.`empresa_id`
SET u.`rol_id` = nuevo.`id`
WHERE u.`empresa_id` IS NOT NULL
  AND u.`empresa_id` <> (SELECT MIN(`id`) FROM `empresas`)
  AND orig.`empresa_id` = (SELECT MIN(`id`) FROM `empresas`);

ALTER TABLE `roles` MODIFY `empresa_id` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `roles_empresa_id_idx` ON `roles`(`empresa_id`);

-- CreateIndex
CREATE UNIQUE INDEX `roles_empresa_id_clave_key` ON `roles`(`empresa_id`, `clave`);

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
