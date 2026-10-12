# HANDOFF — R-200

## 1. Identificação
- Tarefa: R-200 — resumo financeiro após recebimento confirmado
- Área: perfil do paciente / orçamento
- Responsável anterior: Coordenação; executor: R-200
- Estado: READY_FOR_REVIEW local — gate integrado pendente
- Commit/branch: `codex/baseline-producao-v2@5e2c4e4` (checkout compartilhado com alterações locais)
- Data: 2026-10-12

## 2. Objetivo
Depois da confirmação do recebimento manual, mostrar recebido e saldo atuais no diálogo imediatamente, com valores autoritativos e iguais aos da recarga.

## 3. Contexto mínimo
No Preview `2c52879`, dois recebimentos sintéticos persistiram, mas o diálogo mostrou saldo antigo até recarregar nos dois consumidores: formulário R-189 e `CobrancasPorEtapa`. `handleRegistrarPagamento` apenas chamava `router.refresh()` após sucesso. R-189 exige reutilizar a mesma operação no retry incerto; a cobrança por etapa não possui chave idempotente.

## 4. Fonte de verdade utilizada
- Documento canônico / spec: [`plans/specs/R-200-resumo-financeiro-apos-recebimento.md`](../specs/R-200-resumo-financeiro-apos-recebimento.md)
- Evidência: [`plans/auditorias/2026-10-12-R-182-estabilizacao-dirigida.md`](../auditorias/2026-10-12-R-182-estabilizacao-dirigida.md)
- Artefato: não há.

## 5. Decisões tomadas
1. Corrigir somente a reconciliação visual pós-sucesso confirmado; não alterar a semântica de pagamento.
2. Em R-189, resposta incerta preserva resumo e chave para retry explícito.
3. Em cobrança por etapa, resposta incerta preserva resumo e formulário, e bloqueia o ID da cobrança no cliente-pai até reload completo, pois não existe chave idempotente.

## 6. Fora de escopo
- Nova RPC, migration, estorno, redesign ou R-198.

## 7. Arquivos alterados
- `src/app/dashboard/orcamentos/actions.ts`
  - após confirmação de cada RPC de recebimento, lê pagamentos persistidos na clínica e os devolve ao consumidor;
  - a etapa devolve também pagamentos completos do orçamento-pai;
  - R-189 devolve resultado retryable se a releitura falhar; cobrança por etapa sinaliza resultado incerto.
- `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`
  - substitui pagamentos do orçamento apenas a partir da lista autoritativa retornada;
  - preserva estado, `pagIntent` e retry em erro ou resposta incompleta.
  - conserva em nível de página os IDs de cobranças com resultado incerto, inclusive ao fechar/reabrir o detalhe; o bloqueio termina somente no reload completo.
- `src/app/dashboard/pacientes/[id]/_components/modals/detalhe-orcamento-modal.tsx`
  - reconcilia a etapa apenas após pagamentos confirmados;
  - encaminha pagamentos completos ao estado-pai para atualizar cabeçalho e resumo geral;
  - mantém CSS de R-199 e bloqueia reenvio da etapa em resultado incerto.
- `src/lib/orcamentos/reconciliar-pagamentos-confirmados.ts`
- `src/lib/orcamentos/reconciliar-pagamentos-confirmados.test.ts`
- `src/lib/orcamentos/bloqueio-resultado-incerto-cobranca.ts`
- `src/lib/orcamentos/bloqueio-resultado-incerto-cobranca.test.ts`
- `plans/specs/R-200-resumo-financeiro-apos-recebimento.md`
- `plans/handoffs/2026-10-12-r200-resumo-financeiro.md`

Não foram alterados migration/teste R-197 nem `plans/ESTADO.md`. O trecho financeiro
do modal R-199 foi autorizado para R-200; a correção CSS foi preservada.

## 8. Banco / schemas / APIs afetados
- Sem mudança de schema; a Action pode retornar estado financeiro autoritativo após confirmação, mantendo idempotência R-189.

## 9. Critérios de aceite
- [ ] Sucesso: resumo imediato e recarga concordam, sem novo recebimento.
- [ ] Retry incerto: mesma operação, sem duplicação.
- [ ] Erro/permissão negativa: resumo intacto e efeito zero.

## 10. Testes executados
- [x] `pnpm typecheck` — passou.
- [x] ESLint focal — nenhum erro novo; 27 warnings preexistentes em
  `paciente-detail-client.tsx`.
- [x] testes focais — 4/4 passaram: reconciliação confirmada, preservação sem confirmação, erro e fechar/reabrir.
- [x] `git diff --check` — passou.
- [ ] integração local com Supabase.
- [ ] Preview com contas e dados QA sintéticos.
- [ ] regressão R-189 com resposta, persistência e recarga.

Resultado: reconciliação dos dois consumidores e bloqueio de resultado incerto da
etapa **PASSAM localmente**; gates que exercitam banco e Preview permanecem
**NÃO TESTADOS**.

## 11. Problemas conhecidos
- Confirmado: resumo obsoleto até recarga no Preview anterior.
- Verificação impedida: comportamento na branch corrigida ainda não foi testado em
  dados QA autenticados.
- Limite adjacente: a cobrança por etapa ainda não tem chave idempotente. Em resultado
  incerto, o único caminho seguro é recarregar e reconciliar antes de outra tentativa.

## 12. Riscos de regressão
- Atualização otimista criar saldo fictício; ou, na etapa sem chave idempotente, um novo caminho de
  edição ignorar o bloqueio local. O conjunto não é limpo por props e só termina em reload completo;
  o gate integrado deve confirmar esse ciclo.

## 13. Próxima ação exata
O Auditor deve repetir o gate R200-AUD-01: com dados QA sintéticos, simular resultado incerto,
fechar/reabrir o detalhe e confirmar que o botão e a mensagem continuam bloqueados até reload completo.
Separadamente, conferir resposta, estado imediato, banco e reload nos dois consumidores e a negativa
de permissão.

## 14. Não fazer
- Não usar dados reais, não aplicar migration, commit, push ou deploy neste despacho. Não reverter alterações compartilhadas de R-197/R-199.

## 15. Estado da documentação
- [x] spec e handoff atualizados com implementação, evidências e limite de idempotência da etapa.
