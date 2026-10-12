# R-182 — Tentativa de banco QA isolado sem dados reais

STATUS: EVIDENCE
OWNER: Coordenação
LAST_REVIEWED: 2026-10-11
CANONICAL_FOR: resultado da tentativa de branch Supabase para gates R-184/R-189/R-194

Com autorização do usuário, foi criada a preview branch
`qa-r182-financeiro-20261011` (branch ID `7d1aa815-60a2-4c1b-927c-85b98668c2ac`,
project ref `jknjipopzamjfiowfxoa`) na organização Pro do Odonto.IA, **sem copiar dados**.
O painel exibiu compute de **US$ 0,01344/h**, sem impostos. O conector de custo
específico falhou; o usuário aprovou a criação com esse preço inicial e cobrança
variável, e o painel confirmou o mesmo preço antes da criação.

A branch chegou a `ACTIVE_HEALTHY` e `FUNCTIONS_DEPLOYED`, mas a consulta ao catálogo
retornou **zero tabelas `public`**, sem `orcamentos`, `pagamentos`, view
`orcamentos_com_estado` ou RPCs-base. `list_migrations` retornou lista vazia.
Portanto ela **não era um clone de schema utilizável** para estes gates. Nenhuma
migration, fixture ou teste com escrita foi aplicada. Não inferir integridade do
schema a partir do estado de saúde do projeto.

A branch foi apagada imediatamente; `list_branches` voltou a listar apenas `main`.
Produção não foi alterada. R184-01–06, R189-01–08 e R194-01–07 continuam
**NÃO TESTADO** em banco isolado. Próximo passo técnico: reconstruir um schema-only
confiável em ambiente descartável, reconciliando os objetos vivos com as migrations
faltantes, antes de repetir a criação e qualquer teste financeiro. Não usar a branch
vazia como alvo de aplicação.
