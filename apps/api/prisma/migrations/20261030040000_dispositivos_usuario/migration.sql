-- A-40: perfiles rápidos de guardias (celular con clave propia y PIN opcional)
CREATE TABLE `dispositivos_usuario` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `usuario_id` INTEGER NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `pin_hash` VARCHAR(255) NULL,
  `etiqueta` VARCHAR(120) NOT NULL,
  `intentos_fallidos` INTEGER NOT NULL DEFAULT 0,
  `bloqueado_en` DATETIME(3) NULL,
  `ultimo_uso` DATETIME(3) NULL,
  `revocado_en` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `dispositivos_usuario_token_hash_key`(`token_hash`),
  INDEX `dispositivos_usuario_usuario_id_revocado_en_idx`(`usuario_id`, `revocado_en`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `dispositivos_usuario` ADD CONSTRAINT `dispositivos_usuario_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
