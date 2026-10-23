-- CreateTable
CREATE TABLE `bitacora_eventos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `tipo` ENUM('retardo', 'salida_anticipada', 'comida_fuera', 'racha', 'falta', 'no_se_presento', 'incidencia_rostro', 'rostro_registrado', 'rostro_aprobado', 'rostro_rechazado', 'rostro_eliminado', 'asignacion', 'asignacion_cambio', 'asignacion_fin', 'grupo_alta', 'grupo_baja') NOT NULL,
    `ocurrio_en` DATETIME(3) NOT NULL,
    `detalle` VARCHAR(300) NOT NULL,
    `datos` JSON NULL,
    `marcacion_id` INTEGER NULL,
    `incidencia_id` INTEGER NULL,
    `sitio_id` INTEGER NULL,
    `actor_id` INTEGER NULL,
    `justificacion` VARCHAR(255) NULL,
    `justificado_por_id` INTEGER NULL,
    `justificado_en` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bitacora_eventos_usuario_id_ocurrio_en_idx`(`usuario_id`, `ocurrio_en`),
    INDEX `bitacora_eventos_actor_id_idx`(`actor_id`),
    INDEX `bitacora_eventos_justificado_por_id_idx`(`justificado_por_id`),
    INDEX `bitacora_eventos_marcacion_id_idx`(`marcacion_id`),
    INDEX `bitacora_eventos_incidencia_id_idx`(`incidencia_id`),
    INDEX `bitacora_eventos_sitio_id_idx`(`sitio_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bitacora_comentarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `evento_id` INTEGER NOT NULL,
    `autor_id` INTEGER NULL,
    `texto` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bitacora_comentarios_evento_id_idx`(`evento_id`),
    INDEX `bitacora_comentarios_autor_id_idx`(`autor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bitacora_eventos` ADD CONSTRAINT `bitacora_eventos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bitacora_eventos` ADD CONSTRAINT `bitacora_eventos_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bitacora_eventos` ADD CONSTRAINT `bitacora_eventos_justificado_por_id_fkey` FOREIGN KEY (`justificado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bitacora_eventos` ADD CONSTRAINT `bitacora_eventos_marcacion_id_fkey` FOREIGN KEY (`marcacion_id`) REFERENCES `marcaciones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bitacora_eventos` ADD CONSTRAINT `bitacora_eventos_incidencia_id_fkey` FOREIGN KEY (`incidencia_id`) REFERENCES `incidencias_rostro`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bitacora_eventos` ADD CONSTRAINT `bitacora_eventos_sitio_id_fkey` FOREIGN KEY (`sitio_id`) REFERENCES `sitios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bitacora_comentarios` ADD CONSTRAINT `bitacora_comentarios_evento_id_fkey` FOREIGN KEY (`evento_id`) REFERENCES `bitacora_eventos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bitacora_comentarios` ADD CONSTRAINT `bitacora_comentarios_autor_id_fkey` FOREIGN KEY (`autor_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (DA-41): eventos que ya ocurrieron, para que la bitácora no arranque vacía.
-- Retardos (más de 10 min de tolerancia).
INSERT INTO `bitacora_eventos` (`usuario_id`, `tipo`, `ocurrio_en`, `detalle`, `datos`, `marcacion_id`, `sitio_id`)
SELECT m.`usuario_id`, 'retardo', m.`registrada_en`,
  CONCAT('Llegó ', IF(t.min < 60, CONCAT(t.min, ' min'), CONCAT(FLOOR(t.min / 60), ' h ', LPAD(MOD(t.min, 60), 2, '0'), ' min')), ' tarde a ', COALESCE(s.`nombre`, 'su sitio')),
  JSON_OBJECT('minutos', t.min), m.`id`, m.`sitio_id`
FROM `marcaciones` m
JOIN (SELECT `id`, TIMESTAMPDIFF(MINUTE, `programada_entrada`, `registrada_en`) AS min FROM `marcaciones` WHERE `tipo` = 'entrada' AND `programada_entrada` IS NOT NULL) t ON t.`id` = m.`id`
LEFT JOIN `sitios` s ON s.`id` = m.`sitio_id`
WHERE t.min > 10;

-- Salidas anticipadas (10 min o más).
INSERT INTO `bitacora_eventos` (`usuario_id`, `tipo`, `ocurrio_en`, `detalle`, `datos`, `marcacion_id`, `sitio_id`)
SELECT m.`usuario_id`, 'salida_anticipada', m.`registrada_en`,
  CONCAT('Salió ', IF(t.min < 60, CONCAT(t.min, ' min'), CONCAT(FLOOR(t.min / 60), ' h ', LPAD(MOD(t.min, 60), 2, '0'), ' min')), ' antes en ', COALESCE(s.`nombre`, 'su sitio')),
  JSON_OBJECT('minutos', t.min), m.`id`, m.`sitio_id`
FROM `marcaciones` m
JOIN (SELECT sa.`id`, TIMESTAMPDIFF(MINUTE, sa.`registrada_en`, en.`programada_salida`) AS min
      FROM `marcaciones` sa JOIN `marcaciones` en ON en.`id` = sa.`entrada_id`
      WHERE sa.`tipo` = 'salida' AND en.`programada_salida` IS NOT NULL) t ON t.`id` = m.`id`
LEFT JOIN `sitios` s ON s.`id` = m.`sitio_id`
WHERE t.min >= 10;

-- Comida fuera del sitio.
INSERT INTO `bitacora_eventos` (`usuario_id`, `tipo`, `ocurrio_en`, `detalle`, `datos`, `marcacion_id`, `sitio_id`)
SELECT m.`usuario_id`, 'comida_fuera', m.`registrada_en`,
  CONCAT(IF(m.`tipo` = 'inicio_comida', 'Salió a comer', 'Regresó de comer'), ' fuera de ', COALESCE(s.`nombre`, 'su sitio'), ' (', m.`distancia_m`, ' m)'),
  JSON_OBJECT('distanciaM', m.`distancia_m`), m.`id`, m.`sitio_id`
FROM `marcaciones` m
LEFT JOIN `sitios` s ON s.`id` = m.`sitio_id`
WHERE m.`tipo` IN ('inicio_comida', 'fin_comida') AND JSON_CONTAINS(m.`alertas`, '"fuera_de_rango"');

-- Incidencias de rostro (la revisión se lee de la propia incidencia).
INSERT INTO `bitacora_eventos` (`usuario_id`, `tipo`, `ocurrio_en`, `detalle`, `incidencia_id`, `sitio_id`)
SELECT i.`usuario_id`, 'incidencia_rostro', i.`created_at`,
  CONCAT(CASE i.`motivo`
    WHEN 'pantalla' THEN 'Intentó marcar con una pantalla o foto'
    WHEN 'rostro_de_otro' THEN 'Otra persona intentó marcar con su cuenta'
    WHEN 'no_titular' THEN 'Otra persona apareció frente a la cámara'
    WHEN 'reto_fallido' THEN 'No completó el gesto al marcar'
    ELSE 'Intentó registrar un rostro que ya es de otro guardia' END,
    IF(s.`nombre` IS NULL, '', CONCAT(' en ', s.`nombre`))),
  i.`id`, i.`sitio_id`
FROM `incidencias_rostro` i
LEFT JOIN `sitios` s ON s.`id` = i.`sitio_id`;

-- Rostros: registro y revisión.
INSERT INTO `bitacora_eventos` (`usuario_id`, `tipo`, `ocurrio_en`, `detalle`, `actor_id`)
SELECT r.`usuario_id`, 'rostro_registrado', r.`created_at`,
  IF(r.`autoregistro`, 'Registró su rostro (pendiente de revisión)', CONCAT('Le registraron el rostro', IF(u.`nombre` IS NULL, '', CONCAT(' (', u.`nombre`, ')')))),
  IF(r.`autoregistro`, NULL, r.`registrado_por_id`)
FROM `rostros_guardia` r LEFT JOIN `usuarios` u ON u.`id` = r.`registrado_por_id`;

INSERT INTO `bitacora_eventos` (`usuario_id`, `tipo`, `ocurrio_en`, `detalle`, `actor_id`)
SELECT r.`usuario_id`, IF(r.`estado` = 'aprobado', 'rostro_aprobado', 'rostro_rechazado'), r.`revisado_en`,
  IF(r.`estado` = 'aprobado', 'Rostro aprobado', CONCAT('Rostro rechazado', IF(r.`motivo_rechazo` IS NULL, '', CONCAT(': ', r.`motivo_rechazo`)))),
  r.`revisado_por_id`
FROM `rostros_guardia` r
WHERE r.`revisado_en` IS NOT NULL AND r.`estado` IN ('aprobado', 'rechazado');

-- Asignaciones (directas y por grupo).
INSERT INTO `bitacora_eventos` (`usuario_id`, `tipo`, `ocurrio_en`, `detalle`, `sitio_id`)
SELECT a.`usuario_id`, 'asignacion', a.`created_at`,
  CONCAT('Asignado a ', s.`nombre`, ' desde el ', DATE_FORMAT(a.`desde`, '%d/%m/%Y'), IF(a.`hasta` IS NULL, '', CONCAT(' hasta el ', DATE_FORMAT(a.`hasta`, '%d/%m/%Y')))),
  a.`sitio_id`
FROM `sitio_guardia` a JOIN `sitios` s ON s.`id` = a.`sitio_id`
WHERE a.`usuario_id` IS NOT NULL;

INSERT INTO `bitacora_eventos` (`usuario_id`, `tipo`, `ocurrio_en`, `detalle`, `sitio_id`)
SELECT gi.`usuario_id`, 'asignacion', a.`created_at`,
  CONCAT('Asignado a ', s.`nombre`, ' con el grupo ', g.`nombre`, ' desde el ', DATE_FORMAT(a.`desde`, '%d/%m/%Y'), IF(a.`hasta` IS NULL, '', CONCAT(' hasta el ', DATE_FORMAT(a.`hasta`, '%d/%m/%Y')))),
  a.`sitio_id`
FROM `sitio_guardia` a
JOIN `sitios` s ON s.`id` = a.`sitio_id`
JOIN `grupos_guardias` g ON g.`id` = a.`grupo_id`
JOIN `grupo_integrantes` gi ON gi.`grupo_id` = a.`grupo_id`;

-- Altas en grupos.
INSERT INTO `bitacora_eventos` (`usuario_id`, `tipo`, `ocurrio_en`, `detalle`)
SELECT gi.`usuario_id`, 'grupo_alta', gi.`created_at`, CONCAT('Entró al grupo ', g.`nombre`)
FROM `grupo_integrantes` gi JOIN `grupos_guardias` g ON g.`id` = gi.`grupo_id`;
