-- A-65: a quiénes se avisó de cada emergencia
ALTER TABLE `emergencias` ADD COLUMN `destinatarios` JSON NULL;
