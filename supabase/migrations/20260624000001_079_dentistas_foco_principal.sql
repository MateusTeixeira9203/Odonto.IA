-- Camada de persona (Fase 1 — retenção).
-- O dentista escolhe no onboarding o que mais o ajuda agora (o "job", não a idade):
--   'economizar_tempo' (perfil veterano: dor = digitar/documentar)
--   'crescer'          (perfil iniciante: dor = fechar caso / crescer)
-- Esse foco calibra copy do onboarding, a recompensa pós-ficha, a ordem dos
-- primeiros passos, a régua de e-mails e a métrica-âncora do relatório de valor.
--
-- Nullable: contas existentes ficam sem foco até a próxima passagem pelo onboarding;
-- o código trata null como neutro (sem diferenciação).

ALTER TABLE dentistas
  ADD COLUMN IF NOT EXISTS foco_principal text
    CHECK (foco_principal IN ('economizar_tempo', 'crescer'));

COMMENT ON COLUMN dentistas.foco_principal IS
  'Persona do dentista escolhida no onboarding: economizar_tempo (veterano) | crescer (iniciante). NULL = sem diferenciação.';
