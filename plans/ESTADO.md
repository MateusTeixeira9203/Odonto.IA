# Estado — Odonto.IA

> Atualizado em 09/09/2026 — candidato de preview R-157.

🔵 [R-157 — Financeiro e orçamento por grupos](specs/R-157-financeiro-orcamento-por-grupos.md).
Usuário autorizou commit e push para testar em preview. Produção não autorizada nesta entrega.

Branch: `codex/r157-financeiro-orcamento-preview`, baseada no app de produção `19ad94f`.
Recorte preserva as correções de retorno já publicadas; não inclui a frente local R-155.
Grupos com preço fechado, composição e acordo por cobrança implementados; Financeiro usa
recebimentos por etapa e escopo consistente nos indicadores, gráficos e CSV.

## Validação e próximos passos

- 223 testes passaram na base do preview; QA autenticada e limites estão no
  [relatório](auditorias/2026-09-09-r157-validacao-local.md).
- Acompanhar build do preview desta branch e obter retorno do usuário.
- Conferir mobile integrado; fixture390 já validada, override CUA permaneceu972px.
- Só promover para produção após teste do usuário e autorização específica.

## Banco e dados

Supabase online compartilhado autorizado pelo usuário, por não dispor de homologação.
Migração R-157 já aplicada atomicamente; dados preexistentes conferidos sem diferenças.
Apenas registros fictícios da clínica QA foram usados nas operações de teste.
Preview muda o aplicativo, mas usa o mesmo banco: usar a clínica de teste.
Nenhuma credencial/seed remoto de QA é versionada. Não rodar reset/seed local nesse banco.
Reversão deve preservar colunas e registros; procedimento em scripts/tests/r157-reverter-funcoes.sql.
