# HANDOFF — R-194, candidato local da RPC única

## 1. Identificação

- Tarefa: preparar o candidato local do R-194 revisado.
- Área: orçamento / pagamento rápido.
- Responsável anterior: Arquiteto de Produto; destino: Implementar.
- Estado: `READY_FOR_REVIEW`; checkout compartilhado `codex/baseline-producao-v2@ba5b531`.
- Data: 2026-10-11.

## 2–4. Objetivo, contexto e fonte

Implementar a [spec R-194](../specs/R-194-confirmacao-parcela-idempotente.md): uma única
RPC transacional decide previsão ou saldo e a Action a chama uma vez. O candidato atual
falha estaticamente R194-01C/04. R-189 permanece o formulário manual e a coluna/índice
de `operacao_id` são sua dependência. A fonte de verdade do trabalho é a spec R-194;
usar também R-189, AGENTS.md e 00_FONTE_DA_VERDADE.md.

## 5–8. Decisões, limites e arquivos

Responsabilidade exclusiva do Executor: `supabase/migrations/20261011231702_r194_confirmacao_parcela_idempotente.sql`, o ramo `registrarPagamentoRapido` de
`src/app/dashboard/orcamentos/actions.ts` e testes focais necessários. Não editar outras
migrations, a RPC manual R-189, UI, ESTADO.md, ROADMAP.md nem o contrato da spec. Há outros agentes
no mesmo checkout; não reverter alterações alheias. Preservar autorização R-188,
confirmação explícita por ID, estorno e cobrança por etapa.

## 9–12. Aceite, verificação e riscos

Critérios R194-01 a 07, incluindo 01C e 04/04B/04C, estão na spec. Fazer revisão
estática de assinatura, lock, replay, autorização, efeitos e consumidores; rodar
typecheck/lint/testes focais pertinentes. Registrar `PASSA`, `NÃO PASSA` e
`NÃO TESTADO` separadamente. Os gates de concorrência, falha, persistência e reload
continuam **NÃO TESTADO** sem banco isolado reproduzível. Não inferir aceite de build.

## 13–15. Próxima ação, proibições e documentação

Devolver diff local e evidências por critério à Coordenação, sem aplicar SQL em
produção ou localhost conectado ao banco publicado. Não criar branch Supabase,
fixture, commit, push ou deploy. Atualizar somente a seção de evidência da spec
R-194 se necessário para relatar resultado, sem mudar seu contrato; Coordenação
integra o panorama e prepara revisão do usuário.

## 16. Resultado do Executor

### Implementação local

- A migration R-194 agora expõe somente `registrar_pagamento_rapido_idempotente` com a assinatura
  aprovada. A função valida identidade, clínica, vínculo, perfil, papel, payload e propriedade antes
  de qualquer efeito financeiro.
- A função trava o orçamento, reconcilia `(clinica_id, operacao_id)`, escolhe e trava a primeira
  previsão pendente ou calcula o saldo, grava um pagamento e um `activity_log` na mesma transação.
- Replay compatível retorna o mesmo ID com `repetida=true`; mudança de ator, orçamento, forma ou data
  retorna `chave_idempotencia_reutilizada` sem expor o ID vencedor.
- `registrarPagamentoRapido` valida o payload e faz exatamente uma chamada à RPC R-194. Não há
  preflight, leitura de parcelas, seleção do ramo ou delegação ao recebimento manual R-189.
- Foi adicionado um teste contratual focal para impedir a reintrodução dos dois endpoints e conferir
  autorização, ordem de lock/replay, índice, log e grants.

### Arquivos sob responsabilidade deste resultado

- `supabase/migrations/20261011231702_r194_confirmacao_parcela_idempotente.sql`;
- ramo `registrarPagamentoRapido` e remoção do import que ficou sem uso em
  `src/app/dashboard/orcamentos/actions.ts`;
- `src/lib/orcamentos/r194-pagamento-rapido-contract.test.ts`;
- esta seção de resultado no handoff existente.

`actions.ts` já continha mudanças locais R-188/R-189 de outro recorte. Elas foram preservadas e não
devem ser atribuídas integralmente ao R-194 ao revisar o diff contra `ba5b531`.

### Critérios e evidências

| Critério | Estado | Evidência local | Limite |
| --- | --- | --- | --- |
| R194-01 / 01B / 01C | NÃO TESTADO | PASSA estático: replay ocorre sob lock e antes da escolha do ramo. | Sem aplicação em banco isolado, perda de resposta, persistência ou reload. |
| R194-02 | NÃO TESTADO | Chaves diferentes não são reconciliadas entre si no código. | Efeito sequencial não exercitado em banco. |
| R194-03 | NÃO TESTADO | PASSA estático: ator, orçamento, forma e data são comparados antes de devolver ID. | Duas sessões e conflito real não exercitados. |
| R194-04 / 04B / 04C | NÃO TESTADO | PASSA estático: orçamento é o primeiro lock, há RPC única e índice único final. | Concorrência real não exercitada. |
| R194-05 | NÃO TESTADO | Pagamento e log pertencem à mesma função/transação. | Falha controlada antes do commit não foi injetada. |
| R194-06 | NÃO TESTADO | PASSA estático: `SECURITY DEFINER` usa `search_path=''` e valida auth, clínica, vínculo, perfil, papel e orçamento. | Duas contas autenticadas sintéticas não disponíveis. |
| R194-07 | NÃO TESTADO | PASSA estático: RPC manual R-189 e `marcarPagamentoPago` não foram alteradas neste recorte. | Regressão dirigida por API/UI não executada. |

Não foi encontrado critério `NÃO PASSA` na revisão local. Isso não converte os gates persistentes em
`PASSA`.

### Testes executados

- `pnpm exec tsx --test src/lib/orcamentos/r194-pagamento-rapido-contract.test.ts`: PASSA, 3/3.
- `pnpm exec tsx --test src/lib/orcamentos/*.test.ts`: PASSA, 21/21.
- `pnpm typecheck`: PASSA.
- `pnpm exec eslint src/app/dashboard/orcamentos/actions.ts src/lib/orcamentos/r194-pagamento-rapido-contract.test.ts`:
  PASSA, zero erros e zero avisos após remover o import sem consumidor.
- `git diff --check` nos arquivos do recorte: PASSA.
- `pnpm test`: VERIFICAÇÃO IMPEDIDA como gate global. O comando inclui scripts R-169 que exigem
  `R169_PGLITE` e também encontra uma expectativa Dex já divergente de
  `DEX_PROMPT_VERSION`; nenhuma falha apontou para R-194.

### Riscos residuais e reversão

- A migration não foi analisada pelo parser do PostgreSQL nem aplicada. Sintaxe, retorno PostgREST,
  persistência, concorrência, rollback transacional e isolamento permanecem não verificados.
- O localhost usa o banco publicado; por isso não foi usado para testes de escrita.
- R-194 depende de R-189 aplicada antes, incluindo `pagamentos.operacao_id` e o índice único.
- Se a RPC única falhar em ambiente isolado, a contenção segura é desabilitar o pagamento rápido e
  revisar o candidato. Não restaurar a seleção de ramo na Action.
- Não houve branch, commit, push, deploy, migration, escrita em banco nem dado real alterado.
