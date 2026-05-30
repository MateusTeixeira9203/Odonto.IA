-- Block 10: Migrate agendamento status values from Portuguese to English
-- Mapping: agendado→scheduled, confirmado→confirmed, na_recepcao→checked_in,
--          em_atendimento→in_progress, realizado→completed,
--          cancelado→cancelled, faltou→no_show

BEGIN;

ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;

UPDATE agendamentos SET status = CASE status
  WHEN 'agendado'       THEN 'scheduled'
  WHEN 'confirmado'     THEN 'confirmed'
  WHEN 'na_recepcao'    THEN 'checked_in'
  WHEN 'em_atendimento' THEN 'in_progress'
  WHEN 'realizado'      THEN 'completed'
  WHEN 'cancelado'      THEN 'cancelled'
  WHEN 'faltou'         THEN 'no_show'
  ELSE status
END;

ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_status_check
  CHECK (status IN ('scheduled','confirmed','checked_in','in_progress','completed','cancelled','no_show'));

COMMIT;
