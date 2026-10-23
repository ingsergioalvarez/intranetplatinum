-- AlterTable
ALTER TABLE `avisos` MODIFY `tipo` ENUM('reporte_nuevo', 'reporte_estatus', 'reporte_comentario', 'rostro_pendiente', 'rostro_suplantacion', 'rostro_duplicado', 'rostro_pantalla', 'rostro_reto', 'rostro_aprobado', 'rostro_rechazado', 'cuenta_intento', 'asignacion', 'grupo', 'retardo') NOT NULL;

-- AlterTable
ALTER TABLE `incidencias_rostro` ADD COLUMN `conclusion` ENUM('falsa_alarma', 'confirmada') NULL;

-- AlterTable
ALTER TABLE `marcaciones` ADD COLUMN `programada_entrada` DATETIME(3) NULL,
    ADD COLUMN `programada_salida` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `sitio_guardia` MODIFY `turno` ENUM('diurno', 'nocturno', '24x24', 'mixto', '12x12') NULL;
