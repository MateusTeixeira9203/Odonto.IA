
-- Status do vínculo por convite
-- 'aceito'   → secretaria (vínculo imediato ao aceitar o link)
-- 'pendente' → dentista (aceita o link mas confirma dentro do dashboard)
-- NULL       → admin criado via onboarding (sem convite)
ALTER TABLE dentistas
  ADD COLUMN IF NOT EXISTS status_convite TEXT
  CHECK (status_convite IN ('pendente', 'aceito'));
