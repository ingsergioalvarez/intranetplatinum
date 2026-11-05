-- CreateTable
CREATE TABLE `usuario_permisos` (
    `usuario_id` INTEGER NOT NULL,
    `permiso_id` INTEGER NOT NULL,

    INDEX `usuario_permisos_permiso_id_idx`(`permiso_id`),
    PRIMARY KEY (`usuario_id`, `permiso_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuario_permisos` ADD CONSTRAINT `usuario_permisos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_permisos` ADD CONSTRAINT `usuario_permisos_permiso_id_fkey` FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
