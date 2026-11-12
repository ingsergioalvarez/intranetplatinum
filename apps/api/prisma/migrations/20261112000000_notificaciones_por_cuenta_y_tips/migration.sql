-- DropIndex
DROP INDEX `suscripciones_push_endpoint_hash_key` ON `suscripciones_push`;

-- AlterTable
ALTER TABLE `suscripciones_push` ADD COLUMN `dispositivo_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `tips_enviados` (
    `slot` VARCHAR(40) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`slot`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `suscripciones_push_endpoint_hash_idx` ON `suscripciones_push`(`endpoint_hash`);

-- CreateIndex
CREATE INDEX `suscripciones_push_dispositivo_id_idx` ON `suscripciones_push`(`dispositivo_id`);

-- CreateIndex
CREATE UNIQUE INDEX `suscripciones_push_endpoint_hash_usuario_id_key` ON `suscripciones_push`(`endpoint_hash`, `usuario_id`);

-- AddForeignKey
ALTER TABLE `suscripciones_push` ADD CONSTRAINT `suscripciones_push_dispositivo_id_fkey` FOREIGN KEY (`dispositivo_id`) REFERENCES `dispositivos_usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
