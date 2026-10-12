# R-200 — Resumo financeiro após recebimento confirmado

STATUS: 🔵 ativo — dois consumidores prontos localmente; gate integrado pendente
OWNER: Coordenação — contrato/integração; Implementar — código; Auditor — gate
LAST_REVIEWED: 2026-10-12
CANONICAL_FOR: R182-EST-07 da auditoria dirigida

## Problema e escopo

No Preview `2c52879`, um recebimento sintético de R$ 10,00 e outro de R$ 5,00
foram persistidos, mas o diálogo ainda mostrou total recebido e saldo antigos
até recarregar. O mesmo diálogo é usado na conferência financeira; o atraso pode
induzir nova tentativa. Evidência: [auditoria R-182](../auditorias/2026-10-12-R-182-estabilizacao-dirigida.md).

Após sucesso confirmado da Action, reconciliar o resumo do orçamento com dados
autoritativos do servidor e refletir recebimento/saldo no diálogo sem recarga
manual. Em falha ou resposta incerta, preservar o estado anterior e a identidade
da operação R-189 para retry. Não reescrever pagamento, cobrança ou RPC.

## Aceite

| Estado inicial e ação | Resultado esperado | Efeito proibido | Verificação |
| --- | --- | --- | --- |
| Orçamento sintético com saldo, registrar recebimento manual | Após sucesso, diálogo mostra recebido e saldo atualizados; recarga confirma os mesmos números | Toast de sucesso com resumo velho ou segundo recebimento automático | Preview, resposta, banco antes/depois, UI imediata e reload |
| Repetir operação R-189 depois de resposta incerta | Mesmo pagamento, mesmo saldo | Duplicação por retry | Duas tentativas com mesma chave sintética |
| Action falha ou usuário sem permissão tenta receber | Resumo conserva estado, erro claro e efeito zero | Atualização otimista sem persistência | Conta QA negativa e leitura do banco |

Preservar filtros do Financeiro, R-189/R-194, aprovação, parcelas e estorno.
Teste local isolado é parcial; gate de uso precisa do Preview.

## Implementação local e evidências

Em 2026-10-12, as Actions de recebimento passaram a reler, após confirmação da
RPC, os pagamentos persistidos dentro da clínica. O cliente do paciente e
`CobrancasPorEtapa` substituem suas listas locais somente quando recebem essa
leitura autoritativa. Na etapa, a Action devolve também a lista completa do
orçamento-pai, atualizando cabeçalho e resumo geral. Como os resumos derivam
dessas listas, recebido e saldo passam a ser recalculados no mesmo render.

No R-189, falha da RPC ou da releitura preserva a mesma `operacaoId` para retry.
Na cobrança por etapa não há chave idempotente: resultado incerto preserva o
formulário, não muda valores e bloqueia novo envio até recarga; não há retry
automático.

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Sucesso R-189 atualiza resumo sem criar um segundo pagamento | **PASSA (código)** | A Action devolve a lista persistida e o cliente a substitui apenas depois da resposta confirmada. O resumo deriva de `orcamentosState.pagamentos`; não há inserção local sintética. |
| Retry após resposta incerta preserva a mesma operação | **PASSA (código)** | Falha da RPC ou da releitura marca o resultado como retryable e não limpa `pagIntent`; o próximo envio reutiliza a chave existente. |
| Sucesso em `CobrancasPorEtapa` atualiza resumo da etapa e do orçamento | **PASSA (código)** | A Action devolve pagamentos persistidos da cobrança e do orçamento-pai; o componente atualiza a etapa e encaminha a lista completa ao estado que alimenta cabeçalho/resumo geral. |
| Resultado incerto da etapa não permite duplicação pelo botão | **PASSA local** | Falha após a RPC ou exceção mantém valores/formulário e desabilita o envio até reload completo. O bloqueio pertence ao cliente do paciente, portanto sobrevive a fechar/reabrir o diálogo na mesma página. |
| Erro ou permissão negativa preserva o resumo | **PASSA (código)** | Não há atualização local nos ramos de erro. |
| Resposta, banco antes/depois, UI imediata e recarga no Preview | **NÃO TESTADO** | Não há sessão QA sintética disponível neste checkout e não houve escrita financeira. |

## Correção R200-AUD-01 — 2026-10-12

O bloqueio de resultado incerto antes vivia em `CobrancasPorEtapa`, que desmonta ao fechar o
detalhe. Isso permitia reabrir o mesmo orçamento e reenviar uma cobrança cuja RPC não é
idempotente. O conjunto de IDs bloqueados agora pertence a `PacienteDetailClient`: o filho só
recebe a informação e a usa para desabilitar tanto o botão aberto quanto o atalho
“Registrar recebimento”.

- A exceção, resposta incompleta ou `outcomeUnknown` marca somente a cobrança afetada no pai.
- Fechar e reabrir o diálogo na mesma página conserva o bloqueio e uma mensagem explícita para
  recarregar antes de outro recebimento.
- O bloqueio não é limpo por atualização de props, pois uma nova renderização pode não provar o
  resultado da tentativa incerta. Ele termina somente no reload completo da página; nenhuma marca é
  gravada ou reutilizada após esse reload.
- O sucesso confirmado continua a reconciliar somente as listas persistidas recebidas pela Action.

| Critério adicional | Estado | Evidência | Limite |
| --- | --- | --- | --- |
| Erro incerto bloqueia a cobrança específica | **PASSA local** | Teste focal acrescenta a cobrança e preserva outras marcas | Não induz RPC real |
| Fechar/reabrir na mesma página não habilita novo envio | **PASSA local** | Estado mora no pai e teste focal mantém o mesmo conjunto no ciclo de reabertura | Nenhum componente/browser renderizado |
| Sucesso confirmado não cria bloqueio | **PASSA local** | O ramo de sucesso só reconcilia listas persistidas e não marca a cobrança; teste de reconciliação cobre a resposta confirmada | Releitura real e reload continuam pendentes |
| CSS R-199 e fluxos R-197 preservados | **PASSA estático** | Mudança limitada a props, estado e botões da cobrança | Visual renderizado não testado |
