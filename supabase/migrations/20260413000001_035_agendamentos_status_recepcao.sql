-- Expande os status permitidos para suportar check-in pela secretária
ALTER TABLE agendamentos
  DROP CONSTRAINT agendamentos_status_check,
  ADD CONSTRAINT agendamentos_status_check
    CHECK (status = ANY (ARRAY[
      'agendado', 'confirmado', 'cancelado', 'realizado', 'faltou',
      'na_recepcao', 'em_atendimento'
    ]));
