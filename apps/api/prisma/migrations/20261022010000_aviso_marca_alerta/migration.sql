-- AlterTable
ALTER TABLE `avisos` MODIFY `tipo` ENUM('reporte_nuevo', 'reporte_estatus', 'reporte_comentario', 'rostro_pendiente', 'rostro_suplantacion', 'rostro_duplicado', 'rostro_pantalla', 'rostro_reto', 'rostro_aprobado', 'rostro_rechazado', 'cuenta_intento', 'asignacion', 'grupo', 'retardo', 'marca_alerta') NOT NULL;
