-- CreateTable
CREATE TABLE `aceptaciones_aviso_privacidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `version` VARCHAR(40) NOT NULL,
    `aceptada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,

    UNIQUE INDEX `aceptaciones_aviso_privacidad_usuario_id_version_key`(`usuario_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `aceptaciones_aviso_privacidad` ADD CONSTRAINT `aceptaciones_aviso_privacidad_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
