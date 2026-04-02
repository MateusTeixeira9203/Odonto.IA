-- Novas colunas (idempotentes)
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES dentistas(id);

-- RLS por role: secretária vê todos, dentista/admin apenas os seus
-- Substituir a política única atual por duas políticas específicas

DROP POLICY IF EXISTS "agendamentos_all_policy" ON agendamentos;

-- Secretária: acesso total a todos os agendamentos da clínica
CREATE POLICY "agendamentos_secretaria_policy" ON agendamentos
  FOR ALL TO authenticated
  USING (
    clinica_id = get_my_clinica_id()
    AND get_my_role() = 'secretaria'
  )
  WITH CHECK (
    clinica_id = get_my_clinica_id()
  );

-- Dentista / Admin: acessa apenas os próprios agendamentos
CREATE POLICY "agendamentos_dentista_policy" ON agendamentos
  FOR ALL TO authenticated
  USING (
    clinica_id = get_my_clinica_id()
    AND dentista_id = (
      SELECT id FROM dentistas
      WHERE user_id = auth.uid()
        AND clinica_id = get_my_clinica_id()
      LIMIT 1
    )
  )
  WITH CHECK (
    clinica_id = get_my_clinica_id()
    AND dentista_id = (
      SELECT id FROM dentistas
      WHERE user_id = auth.uid()
        AND clinica_id = get_my_clinica_id()
      LIMIT 1
    )
  );
