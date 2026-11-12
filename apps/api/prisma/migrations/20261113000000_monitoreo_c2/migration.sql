-- AlterTable
ALTER TABLE `avisos` MODIFY `tipo` ENUM('reporte_nuevo', 'reporte_estatus', 'reporte_comentario', 'rostro_pendiente', 'rostro_suplantacion', 'rostro_duplicado', 'rostro_pantalla', 'rostro_reto', 'rostro_aprobado', 'rostro_rechazado', 'cuenta_intento', 'asignacion', 'grupo', 'retardo', 'marca_alerta', 'horas_extra', 'cobertura', 'emergencia', 'c2_sitio') NOT NULL;

-- CreateTable
CREATE TABLE `sitio_solo_episodios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sitio_id` INTEGER NOT NULL,
    `inicio` DATETIME(3) NOT NULL,
    `fin` DATETIME(3) NULL,
    `cubierto` BOOLEAN NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sitio_solo_episodios_sitio_id_inicio_idx`(`sitio_id`, `inicio`),
    INDEX `sitio_solo_episodios_fin_idx`(`fin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sitio_solo_episodios` ADD CONSTRAINT `sitio_solo_episodios_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
