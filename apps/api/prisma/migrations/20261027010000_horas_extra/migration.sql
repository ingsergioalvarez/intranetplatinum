-- AlterTable
ALTER TABLE `avisos` MODIFY `tipo` ENUM('reporte_nuevo', 'reporte_estatus', 'reporte_comentario', 'rostro_pendiente', 'rostro_suplantacion', 'rostro_duplicado', 'rostro_pantalla', 'rostro_reto', 'rostro_aprobado', 'rostro_rechazado', 'cuenta_intento', 'asignacion', 'grupo', 'retardo', 'marca_alerta', 'horas_extra') NOT NULL;

-- AlterTable
ALTER TABLE `bitacora_eventos` MODIFY `tipo` ENUM('retardo', 'salida_anticipada', 'comida_fuera', 'racha', 'falta', 'no_se_presento', 'incidencia_rostro', 'rostro_registrado', 'rostro_aprobado', 'rostro_rechazado', 'rostro_eliminado', 'asignacion', 'asignacion_cambio', 'asignacion_fin', 'grupo_alta', 'grupo_baja', 'cobertura', 'cobertura_cancelada', 'comida_sin_cierre', 'sin_comida', 'jornada_cerrada', 'horas_extra') NOT NULL;

-- AlterTable
ALTER TABLE `incidencias_rostro` MODIFY `tipo_marca` ENUM('entrada', 'inicio_comida', 'fin_comida', 'salida', 'salida_extra') NULL;

-- AlterTable
ALTER TABLE `marcaciones` MODIFY `tipo` ENUM('entrada', 'inicio_comida', 'fin_comida', 'salida', 'salida_extra') NOT NULL;

-- CreateTable
CREATE TABLE `horas_extra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `sitio_id` INTEGER NOT NULL,
    `entrada_id` INTEGER NULL,
    `fecha` DATE NOT NULL,
    `desde` DATETIME(3) NOT NULL,
    `hasta` DATETIME(3) NULL,
    `minutos` INTEGER NULL,
    `origen` ENUM('salida_tardia', 'guardia_extiende', 'jornada_abierta', 'cobertura_descanso', 'captura_supervisor') NOT NULL,
    `estado` ENUM('abierta', 'por_aprobar', 'aprobada', 'rechazada', 'sin_salida') NOT NULL,
    `motivo` VARCHAR(255) NULL,
    `resuelto_por_id` INTEGER NULL,
    `resuelto_en` DATETIME(3) NULL,
    `nota_resolucion` VARCHAR(255) NULL,
    `escalada_en` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `horas_extra_entrada_id_key`(`entrada_id`),
    INDEX `horas_extra_usuario_id_fecha_idx`(`usuario_id`, `fecha`),
    INDEX `horas_extra_sitio_id_fecha_idx`(`sitio_id`, `fecha`),
    INDEX `horas_extra_estado_idx`(`estado`),
    INDEX `horas_extra_resuelto_por_id_idx`(`resuelto_por_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `horas_extra` ADD CONSTRAINT `horas_extra_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horas_extra` ADD CONSTRAINT `horas_extra_resuelto_por_id_fkey` FOREIGN KEY (`resuelto_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horas_extra` ADD CONSTRAINT `horas_extra_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horas_extra` ADD CONSTRAINT `horas_extra_entrada_id_fkey` FOREIGN KEY (`entrada_id`) REFERENCES `marcaciones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
