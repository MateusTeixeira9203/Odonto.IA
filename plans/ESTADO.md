# Estado — Odonto.IA

Atualizado em 23/09/2026.

🔵 **R-172 — Estoque manual e kits no banco principal.**

Contrato: [R-172](specs/R-172-estoque-manual-producao.md). A implementação está em ramo isolado
contra a baseline R-159 de governança; não foi aplicado SQL nem dado alterado no banco principal.

Pronto para revisão:

- Estoque de consumíveis, lotes, recebimento, consumo, descarte, contagem e correção auditável.
- Kits versionados e registro de uso na ficha após existir atendimento.
- Entrada pelo dentista em **Meu Consultório** e pelo proprietário em **Minha Clínica**.
- Migrations aditivas `20260923120000` a `20260923120800`, compatíveis com o catálogo atual de
  48 permissões; a migration antiga que reduziria o catálogo foi descartada.

Verificado localmente: typecheck, lint direcionado, 35 testes unitários e teste de paridade do
catálogo SQL. Falta aplicar migrations, ativar apenas as clínicas de teste e validar duas contas
no preview.

Limite assumido: instrumentais reutilizáveis exigem ciclo de lavagem e esterilização; não entram
como consumível nesta entrega.

Próximo passo: revisão final do SQL e aplicação controlada no banco principal, seguida do roteiro
manual de cadastro, entrada, baixa, ajuste, kit e ficha.
