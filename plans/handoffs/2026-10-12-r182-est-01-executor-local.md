# HANDOFF

## 1. Identificação

- Tarefa: R-182 / R182-EST-01 — concluir encaminhamento em próxima sessão
- Área: prontuário, odontograma e autorização de encaminhamento
- Responsável anterior: Coordenação
- Estado: `READY_FOR_REVIEW`
- Commit/branch: sem commit; `codex/baseline-producao-v2` em `2c52879`
- Data: 2026-10-12

## 2. Objetivo

Corrigir localmente a conclusão de evento encaminhado em `proxima_sessao`: ao mudar para
`realizado`, a RPC deve gravar `momento_planejado = 'sessao_atual'` na mesma atualização,
respeitando a constraint já existente e sem alterar autoria, destino ou autorização.

## 3. Contexto mínimo

O destinatário recebia erro da constraint `odontograma_eventos_momento_coerente` e a
operação não persistia. O fluxo comum já estabelece `sessao_atual` ao concluir. Reabrir
continua com data nula e mantém `sessao_atual`; não há regra para inventar retorno a
`proxima_sessao`.

## 4. Fonte de verdade utilizada

- Documento canônico: `00_FONTE_DA_VERDADE.md`
- Especificação: `plans/specs/R-182-baseline-verificavel.md` (§13)
- Artefato de design: não se aplica
- Outros: `plans/auditorias/2026-10-12-R-182-estabilizacao-dirigida.md`, `AGENTS.md`

## 5. Decisões tomadas

1. A migration recria apenas `public.concluir_evento_encaminhado` e adiciona a normalização
   de `momento_planejado` ao `UPDATE` quando o novo status é `realizado`.
2. A reabertura preserva o momento atual, os checks de destinatário/ficha assinada e os grants
   existentes permanecem iguais.
3. O gate isolado reproduz o `CHECK` real, a função SQL e quatro identidades sintéticas.

## 6. Fora de escopo

- UI, outras RPCs, regra clínica nova, dados reais e mudança de RLS.
- Aplicar migration, commit, push, deploy ou testar contra o ambiente publicado.

## 7. Arquivos alterados

- `supabase/migrations/20261012134222_r182_estabilizar_conclusao_encaminhada.sql`
  - mudança: substitui somente a RPC, alinhando momento e status na conclusão.
  - motivo: satisfazer a constraint sem ampliar permissões ou efeitos.
- `scripts/test-r182-est-01-encaminhamento.mjs`
  - mudança: gate PGlite com constraint, autorização e preservação dos campos da função.
  - motivo: provar a correção e negativas sem Supabase ou dados reais.
- `plans/specs/R-182-baseline-verificavel.md`
  - mudança: acrescenta o recorte §13, limites, consumidores e aceite dirigido.
  - motivo: manter o contrato único do item.

## 8. Banco / schemas / APIs afetados

- Função `public.concluir_evento_encaminhado(uuid[], text, date)`.
- Tabelas já usadas pela função: `odontograma_eventos`, `fichas`, `activity_logs` e `dentistas`.
- Nenhuma migration foi aplicada a banco algum.

## 9. Critérios de aceite

- [x] Destinatário conclui evento em próxima sessão no schema isolado; status, data,
  momento, autoria, destino, paciente, clínica e log persistem e são relidos.
- [x] Reabertura deixa data nula, mantém `sessao_atual` e registra o log esperado.
- [x] Outro dentista e outra clínica recebem `sem_permissao` sem efeito; lote com ficha
  assinada é negado atomicamente.
- [x] Action continua chamando a mesma RPC com data clínica do servidor; typecheck passa.
- [ ] UI/navegador e banco publicado: não testados, pois não houve autorização de escrita real.

## 10. Testes executados

- [ ] unitários
- [x] integração: `ODONTO_PGLITE=/tmp/odonto-r182-est-01-pglite/node_modules/@electric-sql/pglite/dist/index.js <node> scripts/test-r182-est-01-encaminhamento.mjs` — 8/8 PASSA.
- [ ] E2E
- [ ] manual
- [x] regressão: `<node> --check scripts/test-r182-est-01-encaminhamento.mjs`, `git diff --check` e `pnpm typecheck` — PASSA.

Resultados: `pnpm test` **NÃO PASSA** por falhas já externas ao recorte: scripts R-169/R-184/R-189/R-194 sem runtime PGlite configurado e expectativa antiga de `DEX_PROMPT_VERSION` em
`src/app/api/dex/formatar-evolucao/route.test.ts`. O novo script sai limpo como skip quando
`ODONTO_PGLITE` não está configurado e passou quando o runtime isolado foi fornecido.

## 11. Problemas conhecidos

### Confirmados

- A versão publicada permanece sem esta migration; o defeito reproduzido no relatório ainda
  exige aplicação autorizada e novo gate no ambiente alvo.

### Suspeitos / sem evidência

- Nenhum novo no recorte.

## 12. Riscos de regressão

- O gate usa schema mínimo; RLS real e UI continuam não exercitados neste recorte.
- A migration depende dos helpers e tabelas existentes com a mesma assinatura da função atual.

## 13. Próxima ação exata

Revisar o diff; se a aplicação em ambiente isolado for autorizada, aplicar a migration ali e
repetir a conclusão, reabertura e negativas com duas contas QA distintas antes de qualquer
publicação.

## 14. Não fazer

Não aplicar em produção, não escrever em pacientes reais e não alterar `plans/ESTADO.md` ou
`plans/ROADMAP.md` neste item.

## 15. Estado da documentação

- [x] atualizada
- [x] artefatos antigos marcados
- [x] handoff salvo
