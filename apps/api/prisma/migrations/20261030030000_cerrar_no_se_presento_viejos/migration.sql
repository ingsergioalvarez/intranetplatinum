-- A-48: los "No se presentó" que ya pasaron a falta (o cuyo guardia llegó) se cierran solos,
-- como ya pasa con los nuevos. Solo toca los que nadie ha justificado ni decidido.
UPDATE `bitacora_eventos` AS e
JOIN `turnos_dia` AS t
  ON t.`usuario_id` = e.`usuario_id`
 AND t.`sitio_id` = e.`sitio_id`
 AND e.`ocurrio_en` = DATE_ADD(t.`programada_entrada`, INTERVAL 15 MINUTE)
SET e.`decision` = 'superado', e.`decidido_en` = NOW(3)
WHERE e.`tipo` = 'no_se_presento'
  AND e.`decision` IS NULL
  AND e.`justificado_en` IS NULL
  AND (t.`falta_en` IS NOT NULL OR t.`entrada_id` IS NOT NULL);
