-- DropForeignKey
ALTER TABLE `cliente_contactos` DROP FOREIGN KEY `cliente_contactos_cliente_id_fkey`;

-- DropForeignKey
ALTER TABLE `cliente_contactos` DROP FOREIGN KEY `cliente_contactos_empresa_id_fkey`;

-- DropTable
DROP TABLE `cliente_contactos`;
