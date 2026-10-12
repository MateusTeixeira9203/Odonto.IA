# R-200 — Resumo financeiro após recebimento confirmado

STATUS: REFERENCE_ONLY — recorte técnico concluído; encerramento operacional em 12/10
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
| Resposta, banco antes/depois, UI imediata e recarga no Preview | **PASSA nos caminhos confirmados** | Gate integrado abaixo; resultado incerto continua NÃO TESTADO em runtime. |

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

## Gate integrado no Preview — 2026-10-12

Deployment `dpl_KKAAtPXXdEKjEsFhuHj1ANHsyjDh`, commit
`89f20ffeddd6abc0f63caff836b5df80ab69394c`, com dados e identidades descartáveis na QA B.

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| R-189: resposta e resumo imediato | **PASSA** | Um recebimento de R$ 40,00 atualizou modal e cartão de R$ 0/R$ 300 para R$ 40/R$ 260 antes de reload. |
| R-189: persistência, recarga e efeito único | **PASSA** | Um pagamento e um log com `operacao_id`; reload preservou os números, sem segunda linha. |
| Etapa: resposta e resumo imediato | **PASSA** | R$ 50,00 via PIX atualizou cabeçalho, etapa e cartão para recebido R$ 50/saldo R$ 400 antes de reload. |
| Etapa: persistência, previsões e recarga | **PASSA** | Um pagamento e um log; três previsões recompostas somaram R$ 400; reload preservou tudo. |
| Erro definitivo | **PASSA** | R$ 999 contra saldo R$ 400 mostrou erro, preservou formulário/resumo e teve efeito zero. |
| Resultado incerto, close/reopen | **NÃO TESTADO em runtime** | Não houve mecanismo seguro para confirmar a RPC e perder somente a resposta/releitura; o gate estático de 12.12 continua válido. |
| Limpeza | **PASSA** | Zero resíduo das entidades e identidades sintéticas delimitadas. |

O fluxo normal de ambos os consumidores **PASSA no Preview**. O item permanece ativo somente pelo
caso específico de resultado incerto: ele exige fault injection real antes de encerrar o risco S1
em runtime.

## Gate pós-publicação representativo — 2026-10-12

Produção `https://odontoia.app`, resolvida pela Vercel para
`dpl_J2pcmJBWwf4f6eR5ZRBnGD6SfC7p`, estado `READY`, target `production`, branch `main` e commit
`d66a32614e8338c1a10f59e7e47c5756d88a58d5`. Dados e identidade descartáveis ficaram limitados à
QA B.

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| R-189: resposta e resumo imediato | **PASSA em produção** | Uma submissão de R$ 40,00 mudou modal e cartão de recebido R$ 0/saldo R$ 300 para R$ 40/R$ 260 antes de reload. |
| Persistência e efeito único | **PASSA em produção** | Exatamente um pagamento, sem `cobranca_id`, e um log `pagamento.registrado`, com a mesma `operacao_id`; nenhuma duplicação. |
| Recarga | **PASSA em produção** | Cartão, cabeçalho, resumo e histórico preservaram R$ 40,00 recebido/R$ 260,00 saldo; banco continuou com uma linha e um log. |
| Console e limpeza | **PASSA** | Zero warning/error e zero resíduo sintético delimitado. |
| Resultado incerto | **NÃO TESTADO em runtime** | O sucesso normal não substitui a fault injection que confirma a RPC e perde somente a resposta/releitura. |

O fluxo representativo normal está publicado e verificado. O item continua ativo somente pelo caso
específico de resultado incerto; o gate pós-publicação não amplia a conclusão para esse cenário.

## Gate integrado isolado — 12/10/2026, após os gates publicados

Este adendo substitui o **NÃO TESTADO em runtime** de resultado incerto acima.
Contrato e código preservados em `a1722c47c346a4a80c84ad6cd5efd0ee42afbf08`;
Next local + Auth/PostgREST reais + PG17, exclusivamente com fixtures sintéticas.
Manifesto final: 2.271 entradas `public/private`, zero diferenças contra o schema
exportado da produção, incluindo definição, owner, ACL e RLS. O runtime gerenciado
Auth/extensões não foi declarado idêntico à plataforma hospedada.

| Critério | Estado | Evidência |
| --- | --- | --- |
| RPC confirma e releitura falha | **PASSA integrado local** | Proxy somente loopback devolveu 503 ao GET de pagamentos após RPC 200; UI preservou resumo/formulário e orientou retomada. |
| Retry geral | **PASSA integrado local** | Dois envios com a mesma `operacao_id` produziram um pagamento/log por intenção; resumo atualizado após confirmação, banco e reload coerentes. |
| Bloqueio da etapa | **PASSA integrado local** | Botão desabilitado após resultado incerto e após fechar/reabrir; reload mostrou o pagamento persistido e liberou o fluxo. Nenhum segundo recebimento automático. |
| Isolamento autenticado | **PASSA no recorte** | A/B fizeram login real em clínicas distintas; leitura cruzada vazia, RPC financeira de B sobre A retornou `sem_permissao`, sem pagamento/log de B. |

Primeira rodada: geral R$ 40 e etapa R$ 50. Após conciliar ACLs extras do bootstrap
nativo, ambos os cenários foram repetidos com novas intenções de R$ 10: geral
R$ 50/saldo R$ 250, etapa R$ 60/saldo R$ 390. Quatro intenções deliberadas,
quatro pagamentos e quatro logs; os dois retries gerais não criaram linhas.
O estorno posterior do R$ 10 da etapa pertence ao gate AC-05, documentado separadamente.

Evidências e limitações: [auditoria §12.20](../auditorias/2026-10-12-R-182-estabilizacao-dirigida.md#1220-gate-integrado-local--r-200-data-futura-e-estorno).
Falha controlada não foi induzida no Preview/produção. O sucesso publicado anterior
e este gate isolado são evidências complementares; revisão/aceite do usuário e
fechamento amplo R-182 permanecem separados. Nenhum novo deploy é necessário
para os testes desta rodada, pois não houve correção de código.

**Decisão posterior em 12/10:** o usuário encerrou esta fase e fará os testes
residuais da R-182 com mais tempo. O recorte técnico R-200 acima está concluído;
isso não amplia a falha controlada local para um teste em produção.
