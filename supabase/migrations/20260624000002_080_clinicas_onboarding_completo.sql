-- Sinal de conclusão do onboarding (Fase 1 — novo fluxo cadastro → aha → plano).
--
-- Antes, "dentista existe" era sinônimo de "onboarding concluído", porque o
-- dentista só era criado no último passo. No fluxo novo o dentista é criado no
-- meio (logo após a identidade, pra a demo do Modo Consulta poder rodar), então
-- "existe" deixou de significar "concluído". Este flag é o sinal correto: o guard
-- do layout do onboarding só redireciona pro dashboard quando ele é true.

ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS onboarding_completo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clinicas.onboarding_completo IS
  'true quando o dentista concluiu o onboarding (passo de procedimentos). Guard do /onboarding usa isto, não a mera existência do dentista.';
