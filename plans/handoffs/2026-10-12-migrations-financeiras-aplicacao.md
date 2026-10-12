# HANDOFF — aplicação e gate financeiro R-184/R-189/R-194

## 1. Identificação

- Área: previsão e recebimento de orçamento.
- Responsável anterior: Coordenação.
- Estado: `READY_FOR_REVIEW` para as migrations e gates dirigidos; itens ainda ativos.
- Branch/HEAD: `codex/baseline-producao-v2` / `ba5b531`, alterações locais sem commit.
- Data: 2026-10-12.

## 2. Objetivo e fonte de verdade

Aplicar as três migrations financeiras autorizadas, verificar efeitos com dados
sintéticos e preservar a baseline clínica. Contratos:
[R-184](../specs/R-184-previsao-aprovacao-parcial.md),
[R-189](../specs/R-189-recebimento-idempotente.md) e
[R-194](../specs/R-194-confirmacao-parcela-idempotente.md). A
[auditoria dirigida](../auditorias/2026-10-12-financeiro-migrations.md) contém
ambiente, IDs QA, estados PASSA/NÃO TESTADO e capturas; não criar outro checklist.

## 3. Decisões e escopo

- Aplicações em ordem R-184 → R-189 → R-194 no projeto Supabase
  `zenfemoxvwerplrjgfqz`, com autorização do usuário em 12/10.
- Versões registradas no ledger: `20261012034818`, `20261012034837`,
  `20261012034858`. Os arquivos locais passaram a ter esses prefixos; os
  prefixos anteriores `20261011223156`, `20261011223540`, `20261011231702`
  aparecem apenas em handoffs históricos.
- Nenhum commit, push, deploy, teste de carga ou falha injetada no banco real.
- Preservar a RPC antiga R-189 enquanto o site publicado ainda a chama.

## 4. Arquivos e banco afetados

- `supabase/migrations/20261012034818_r184_previsao_aprovacao_parcial.sql`:
  cálculo da primeira previsão, mantendo autorização R-188.
- `supabase/migrations/20261012034837_r189_recebimento_idempotente.sql`:
  `pagamentos.operacao_id`, índice único parcial e RPC de recebimento.
- `supabase/migrations/20261012034858_r194_confirmacao_parcela_idempotente.sql`:
  RPC transacional do pagamento rápido.
- `scripts/qa-r184-r189-r194-live.mjs`: gate autenticado, com opt-in e fixture QA.
- Scripts/testes contratuais e specs: nomes das migrations reconciliados com o ledger.
- `plans/ESTADO.md` e relatório dirigido: estado atual e limites publicados.

## 5. Aceite e regressão

- **PASSA:** objetos/ACL e contagem antes/depois; autorização negativa R-184;
  replay/conflitos R-189; previsão/saldo/notificação R-194; recebimento manual
  e confirmação explícita no localhost com reload; testes locais 14+5.
- **NÃO TESTADO:** atalho R-194 na UI, pois `/dashboard/orcamentos` redireciona;
  versão publicada com código novo, corrida real, perda de resposta e restore
  completo do schema. O site segue no deployment `ba5b531`.
- **Risco material:** a RPC antiga de recebimento continua sem idempotência para
  a interface publicada. A migration sozinha não conclui R-189 ao usuário final.

## 6. Próxima ação exata

Integrador deve revisar o diff local por item, resolver o destino do atalho
R-194 sem reativar uma rota antiga automaticamente, preparar release pequeno do
consumidor R-189 e verificar com duas identidades e reload no deployment
autorizado. Depois conferir dependentes, decidir revogação da RPC antiga e
retomar R-182 com os gates clínicos/restore ainda pendentes.

## 7. Reversão/contensão e não fazer

Se o novo endpoint causar erro, conter somente o endpoint afetado por grants ou
correção forward; não remover `operacao_id` nem apagar pagamentos. Em R-184,
corrigir forward preservando a guarda R-188; não restaurar definição vulnerável.
Não usar dados/contas da portaria real da Clindent, não fazer cleanup automático
das fixtures QA, não declarar os três itens fechados nem publicar sem gate.
