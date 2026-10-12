# HANDOFF

## 1. Identificação

- Tarefa: R-196 — mostrar nome do protético antes de enviar pedido
- Área: Agenda
- Responsável anterior: Coordenação
- Estado: `READY_FOR_REVIEW`
- Commit/branch: sem commit; `codex/baseline-producao-v2`
- Data: 2026-10-12

## 2. Objetivo

Fazer o seletor fechado do diálogo Enviar ao protético exibir o nome correspondente ao ID
selecionado, sem alterar o valor enviado para a Action.

## 3. Contexto mínimo

O diálogo tinha opções com nomes, mas `SelectValue` sem renderizador mostrava o UUID. O
formulário de novo agendamento no mesmo componente já resolve o nome por `proteticosAtivos`.

## 4. Fonte de verdade utilizada

- Documento canônico: `00_FONTE_DA_VERDADE.md`
- Especificação: `plans/specs/R-196-nome-protetico-seletor.md`
- Artefato de design: não se aplica
- Outros: `AGENTS.md`, padrão do formulário novo em `agendamentos-client.tsx`

## 5. Decisões tomadas

1. O diálogo usa um resolvedor puro `id → nome` para o rótulo do seletor.
2. Sem seleção, exibe instrução explícita; ID ausente da lista aparece como indisponível.
3. `handleEnviarProtetico` permanece recebendo o mesmo `pedidoProteticoForm.proteticoId`.

## 6. Fora de escopo

- Action, banco, lista por clínica, permissão, validação, outras telas e modelo de dados.
- Escrita em QA/produção, commit, push e deploy.

## 7. Arquivos alterados

- `src/app/dashboard/agendamentos/_components/agendamentos-client.tsx`
  - mudança: renderizador de `SelectValue` no diálogo de pedido ao protético.
  - motivo: mostrar nome legível no campo fechado.
- `src/app/dashboard/agendamentos/_components/nome-protetico-selecionado.ts`
  - mudança: resolvedor puro de nome, placeholder e opção indisponível.
  - motivo: cobrir o comportamento do seletor com entrada e saída.
- `src/app/dashboard/agendamentos/_components/agendamentos-client-protetico.test.ts`
  - mudança: testa duas opções, ausência de seleção e ID indisponível.
  - motivo: evitar retorno ao UUID visível sem depender de regex do fonte.

## 8. Banco / schemas / APIs afetados

- Nenhum. `criarPedidoProtetico` e seu `proteticoId` não foram modificados.

## 9. Critérios de aceite

- [x] O componente resolve o valor selecionado pelo nome da opção da clínica.
- [x] O payload de envio conserva exatamente `pedidoProteticoForm.proteticoId`.
- [ ] Render com duas opções QA, teclado, persistência e reload: não testados neste despacho.

## 10. Testes executados

- [x] unitários/focais: `pnpm exec tsx --test src/app/dashboard/agendamentos/_components/agendamentos-client-protetico.test.ts` — PASSA.
- [ ] integração
- [ ] E2E
- [ ] manual
- [x] regressão: `pnpm typecheck`, ESLint focal e `git diff --check` — PASSA.

Resultados: o teste de interface com duas opções e o pedido sintético no Preview seguem
**NÃO TESTADOS**; nenhuma escrita em banco foi realizada. O `pnpm lint` completo continua
**NÃO PASSA** por erros preexistentes em outros módulos; o ESLint dos arquivos deste recorte passa.

## 11. Problemas conhecidos

### Confirmados

- Nenhum novo no recorte.

### Suspeitos / sem evidência

- A disponibilidade da lista continua dependente da prop de protéticos ativos da clínica,
  comportamento preservado e ainda pendente do gate de ambiente.

## 12. Riscos de regressão

- Se a lista mudar durante o diálogo, o fallback mostra indisponibilidade em vez do UUID;
  o ID submetido permanece o valor já selecionado.

## 13. Próxima ação exata

No Preview autorizado, abrir o diálogo com dois protéticos sintéticos, alternar com teclado,
enviar pedido a cada opção e conferir ID persistido e nome após reload.

## 14. Não fazer

Não alterar `criarPedidoProtetico`, a query clínica ou permissões para corrigir somente o rótulo.

## 15. Estado da documentação

- [x] atualizada
- [x] handoff salvo
