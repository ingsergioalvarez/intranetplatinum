-- Se quita Reportes de incidentes (C-18): módulo, categorías, folios, seguimientos, evidencias, cola de correos
-- al cliente y reglas de aviso por cliente.
-- Antes de cambiar el tipo de aviso, se borran los avisos de reportes (ya no tienen pantalla a la que llevar).
DELETE FROM `avisos` WHERE `tipo` IN ('reporte_nuevo', 'reporte_estatus', 'reporte_comentario');
-- El módulo ya no existe en el catálogo: se borran los interruptores guardados.
DELETE FROM `empresa_modulos` WHERE `modulo` = 'reportes';
-- Los permisos de reportes se borran (rol_permiso y usuario_permisos se borran en cascada).
DELETE FROM `permisos` WHERE `clave` LIKE 'reportes.%';

-- DropForeignKey
ALTER TABLE `avisos` DROP FOREIGN KEY `avisos_reporte_id_fkey`;

-- DropForeignKey
ALTER TABLE `categorias_reporte` DROP FOREIGN KEY `categorias_reporte_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `categorias_reporte` DROP FOREIGN KEY `categorias_reporte_padre_id_fkey`;

-- DropForeignKey
ALTER TABLE `cliente_reglas_aviso` DROP FOREIGN KEY `cliente_reglas_aviso_cliente_id_fkey`;

-- DropForeignKey
ALTER TABLE `cliente_reglas_aviso` DROP FOREIGN KEY `cliente_reglas_aviso_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `folios_reporte` DROP FOREIGN KEY `folios_reporte_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `notificaciones` DROP FOREIGN KEY `notificaciones_contacto_id_fkey`;

-- DropForeignKey
ALTER TABLE `notificaciones` DROP FOREIGN KEY `notificaciones_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `notificaciones` DROP FOREIGN KEY `notificaciones_reporte_id_fkey`;

-- DropForeignKey
ALTER TABLE `reporte_evidencias` DROP FOREIGN KEY `reporte_evidencias_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `reporte_evidencias` DROP FOREIGN KEY `reporte_evidencias_reporte_id_fkey`;

-- DropForeignKey
ALTER TABLE `reporte_evidencias` DROP FOREIGN KEY `reporte_evidencias_seguimiento_id_fkey`;

-- DropForeignKey
ALTER TABLE `reporte_evidencias` DROP FOREIGN KEY `reporte_evidencias_subida_por_fkey`;

-- DropForeignKey
ALTER TABLE `reporte_seguimientos` DROP FOREIGN KEY `reporte_seguimientos_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `reporte_seguimientos` DROP FOREIGN KEY `reporte_seguimientos_reporte_id_fkey`;

-- DropForeignKey
ALTER TABLE `reporte_seguimientos` DROP FOREIGN KEY `reporte_seguimientos_usuario_id_fkey`;

-- DropForeignKey
ALTER TABLE `reportes` DROP FOREIGN KEY `reportes_categoria_id_fkey`;

-- DropForeignKey
ALTER TABLE `reportes` DROP FOREIGN KEY `reportes_cliente_id_fkey`;

-- DropForeignKey
ALTER TABLE `reportes` DROP FOREIGN KEY `reportes_creado_por_fkey`;

-- DropForeignKey
ALTER TABLE `reportes` DROP FOREIGN KEY `reportes_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `reportes` DROP FOREIGN KEY `reportes_sitio_id_fkey`;

-- DropIndex
DROP INDEX `avisos_reporte_id_fkey` ON `avisos`;

-- AlterTable
ALTER TABLE `avisos` DROP COLUMN `reporte_id`,
    MODIFY `tipo` ENUM('rostro_pendiente', 'rostro_suplantacion', 'rostro_duplicado', 'rostro_pantalla', 'rostro_reto', 'rostro_aprobado', 'rostro_rechazado', 'cuenta_intento', 'asignacion', 'grupo', 'retardo', 'marca_alerta', 'horas_extra', 'cobertura', 'emergencia') NOT NULL;

-- AlterTable
ALTER TABLE `cliente_contactos` DROP COLUMN `recibe_notificaciones`;

-- AlterTable
ALTER TABLE `clientes` DROP COLUMN `aviso_por_defecto`;

-- DropTable
DROP TABLE `categorias_reporte`;

-- DropTable
DROP TABLE `cliente_reglas_aviso`;

-- DropTable
DROP TABLE `folios_reporte`;

-- DropTable
DROP TABLE `notificaciones`;

-- DropTable
DROP TABLE `reporte_evidencias`;

-- DropTable
DROP TABLE `reporte_seguimientos`;

-- DropTable
DROP TABLE `reportes`;
