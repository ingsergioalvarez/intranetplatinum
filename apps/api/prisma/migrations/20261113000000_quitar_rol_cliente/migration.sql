-- Se quita el rol Cliente, el portal del cliente y Quejas del cliente (C-10 paso 4b).
-- El módulo ya no existe en el catálogo: se borran los interruptores guardados.
DELETE FROM `empresa_modulos` WHERE `modulo` = 'quejas';
-- El rol se borra solo si nadie lo tiene (así nunca se pierde una cuenta); sus permisos se borran en cascada.
DELETE FROM `roles` WHERE `clave` = 'cliente' AND NOT EXISTS (SELECT 1 FROM `usuarios` WHERE `usuarios`.`rol_id` = `roles`.`id`);

-- DropForeignKey
ALTER TABLE `reportes_cliente` DROP FOREIGN KEY `reportes_cliente_cliente_id_fkey`;

-- DropForeignKey
ALTER TABLE `reportes_cliente` DROP FOREIGN KEY `reportes_cliente_creado_por_fkey`;

-- DropForeignKey
ALTER TABLE `reportes_cliente` DROP FOREIGN KEY `reportes_cliente_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `reportes_cliente` DROP FOREIGN KEY `reportes_cliente_guardia_id_fkey`;

-- DropForeignKey
ALTER TABLE `reportes_cliente` DROP FOREIGN KEY `reportes_cliente_sitio_id_fkey`;

-- DropForeignKey
ALTER TABLE `usuarios` DROP FOREIGN KEY `usuarios_cliente_id_fkey`;

-- DropIndex
DROP INDEX `usuarios_cliente_id_idx` ON `usuarios`;

-- AlterTable
ALTER TABLE `usuarios` DROP COLUMN `cliente_id`;

-- DropTable
DROP TABLE `reportes_cliente`;
