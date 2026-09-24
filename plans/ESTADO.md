# Estado — Odonto.IA

Atualizado em 23/09/2026.

🔵 **R-164 — Repasses e financeiro pessoal na clínica gerida.**

Contrato aprovado: [R-164](specs/R-164-repasses-e-financeiro-pessoal.md). Referência visual
aprovada: [R-164 V1](artefatos/R-164-repasses-e-financeiro-pessoal-v1.html).

**Decisões fechadas**

- Caixa e pagamentos pertencem à clínica gerida; o dentista recebe somente por repasse.
- Acordo estruturado por profissional: percentual de recebimentos confirmados, diária explícita
  ou mensal fixo. Contrato PDF fica fora do cálculo.
- Repasse previsto é obrigação. Só o pagamento cria uma despesa no caixa da clínica.
- Proprietário ou `repasses.gerir` administra; dentista vê somente os próprios valores;
  secretaria não vê acordos ou repasses.
- Clínica colaborativa mantém o financeiro pessoal existente sem novo cálculo.

**Já concluído antes deste item**

- R-163 está 🟡 no ar: migration aplicada no banco principal, caixa clínico separado e preview
  publicado. Falta validação manual dirigida com duas contas.
- Estoque do Meu Consultório foi validado manualmente pelo usuário.

**Falta no R-164**

1. Migration aditiva: schema, RLS e RPCs transacionais.
2. Leitura segura de financeiro pessoal gerido e repasses da clínica.
3. Ações e telas de acordo, geração, pagamento e histórico conforme o artefato.
4. Typecheck, lint, build e testes técnicos; depois aplicar migration no banco principal e testar
   com duas contas antes de preview.
