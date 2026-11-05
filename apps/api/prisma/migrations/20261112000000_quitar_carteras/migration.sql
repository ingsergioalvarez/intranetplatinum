-- Se quita Carteras (C-10 paso 4): el módulo y las columnas de dueño. El alcance sale de las áreas.
-- El módulo ya no existe en el catálogo: se borran los interruptores que quedaron guardados.
DELETE FROM `empresa_modulos` WHERE `modulo` = 'carteras';

-- DropForeignKey
ALTER TABLE `clientes` DROP FOREIGN KEY `clientes_propietario_id_fkey`;

-- DropForeignKey
ALTER TABLE `grupos_guardias` DROP FOREIGN KEY `grupos_guardias_propietario_id_fkey`;

-- DropForeignKey
ALTER TABLE `usuarios` DROP FOREIGN KEY `usuarios_propietario_id_fkey`;

-- DropIndex
DROP INDEX `clientes_propietario_id_idx` ON `clientes`;

-- DropIndex
DROP INDEX `grupos_guardias_propietario_id_idx` ON `grupos_guardias`;

-- DropIndex
DROP INDEX `usuarios_propietario_id_idx` ON `usuarios`;

-- AlterTable
ALTER TABLE `clientes` DROP COLUMN `propietario_id`;

-- AlterTable
ALTER TABLE `grupos_guardias` DROP COLUMN `propietario_id`;

-- AlterTable
ALTER TABLE `usuarios` DROP COLUMN `propietario_id`;
