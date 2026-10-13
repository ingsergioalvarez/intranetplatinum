-- AlterTable
ALTER TABLE `clientes` ADD COLUMN `aviso_por_defecto` ENUM('supervisor', 'cliente', 'ambos') NOT NULL DEFAULT 'supervisor';
