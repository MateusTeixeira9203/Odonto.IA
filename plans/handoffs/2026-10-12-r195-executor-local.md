# HANDOFF

## 1. Identificação

- Tarefa: R-195 — refletir status encaminhado após salvar
- Área: Prontuário
- Responsável anterior: Coordenação
- Estado: `READY_FOR_REVIEW`
- Commit/branch: sem commit; `codex/baseline-producao-v2`
- Data: 2026-10-12

## 2. Objetivo

Após sucesso da Action de status, refletir imediatamente o estado do procedimento encaminhado
e o progresso da Ficha. O refresh do router permanece para reconciliar a leitura do servidor.

## 3. Contexto mínimo

O componente consumia somente `dados` das props e chamava `router.refresh()` após o toast.
Até a resposta RSC chegar, cartão e contadores permaneciam com o estado anterior.

## 4. Fonte de verdade utilizada

- Documento canônico: `00_FONTE_DA_VERDADE.md`
- Especificação: `plans/specs/R-195-feedback-status-encaminhado.md`
- Artefato de design: não se aplica
- Outros: `AGENTS.md`, guia local Next de Server Actions

## 5. Decisões tomadas

1. Criado overlay local de status ligado à identidade do payload que confirmou a Action; um payload novo do servidor sempre prevalece.
2. Após `resultado.ok` no ramo encaminhado, eventos, momento e contadores da Ficha são atualizados localmente, sem inventar data clínica.
3. A falha retorna antes da atualização local; Action, RPC e autorização não foram alteradas.

## 6. Fora de escopo

- RPC, Action, autorização, data clínica, assinatura, logs, schema e redesign.
- Escrita em QA/produção, commit, push e deploy.

## 7. Arquivos alterados

- `src/components/pacientes/ProntuarioTab.tsx`
  - mudança: estado local reconciliável para status e progresso de eventos.
  - motivo: remover o intervalo visual obsoleto após sucesso.
- `src/lib/prontuario/status-encaminhado-local.ts`
  - mudança: lógica pura do overlay temporário e da reconciliação por payload.
  - motivo: permitir validação de entrada/saída sem acoplar teste à tela.
- `src/components/pacientes/prontuario-tab-status-encaminhado.test.ts`
  - mudança: testa status, momento, contadores, data não inventada e precedência do servidor.
  - motivo: impedir retorno ao overlay persistente ou a teste textual do componente.

## 8. Banco / schemas / APIs afetados

- Nenhum. A chamada existente a `atualizarStatusEncaminhado` foi preservada.

## 9. Critérios de aceite

- [x] Após resposta positiva, o estado local passa a `realizado` ou `indicado` e os
  contadores são recalculados.
- [x] Ao concluir, o momento local passa a `sessao_atual` sem inventar data; ao reabrir, a data
  local é nula e o momento existente é preservado.
- [x] Payload novo do servidor deixa de receber o overlay local anterior.
- [x] Falha retorna antes da sincronização visual local.
- [ ] Preview com duas contas QA, persistência e recarga: não testado neste despacho.

## 10. Testes executados

- [x] unitários/focais: `pnpm exec tsx --test src/components/pacientes/prontuario-tab-status-encaminhado.test.ts` — PASSA.
- [ ] integração
- [ ] E2E
- [ ] manual
- [x] regressão: `pnpm typecheck`, ESLint focal e `git diff --check` — PASSA.

Resultados: UI no Preview e persistência após reload permanecem **NÃO TESTADOS**. Nenhuma
escrita foi realizada em banco ou ambiente publicado. O `pnpm lint` completo continua
**NÃO PASSA** por erros preexistentes em outros módulos; o ESLint dos arquivos deste recorte passa.

## 11. Problemas conhecidos

### Confirmados

- Nenhum novo no recorte.

### Suspeitos / sem evidência

- A atualização visual depende da mesma lista de IDs que a Action recebeu; o gate de duas
  contas no Preview continua necessário para confirmar o caminho real de autorização.

## 12. Riscos de regressão

- O overlay não mascara payload novo do servidor e não cria escrita adicional; a data clínica
  permanece pendente até a atualização explícita da RPC no payload.

## 13. Próxima ação exata

No Preview autorizado, com evento sintético encaminhado, exercer Realizado e A fazer com
destinatário e não-destinatário; conferir UI imediata, banco e reload.

## 14. Não fazer

Não substituir a Action/RPC, não otimizar sucesso antes da resposta e não alterar regras de
assinatura ou encaminhamento.

## 15. Estado da documentação

- [x] atualizada
- [x] handoff salvo
