# R-196 — mostrar nome do protético antes de enviar pedido

STATUS: ACTIVE — gate Preview PASSA; integração/publicação separadas
OWNER: Implementar — código e teste; Coordenação — integração; Auditor — gate
LAST_REVIEWED: 2026-10-12
CANONICAL_FOR: correção do achado R182-EST-03

## Problema e limite

Na Agenda → detalhe do agendamento → Enviar ao protético, o seletor fechado
mostra UUID em vez do nome, embora o pedido seja gravado para o ID correto.
Evidência: seção 9.4 de
[R-182 auditoria dirigida](../auditorias/2026-10-12-R-182-estabilizacao-dirigida.md).

Corrigir somente o rótulo visível do seletor nesse fluxo. Preservar o ID
enviado, a lista por clínica, permissão, validação e persistência do pedido.
Não alterar modelo de dados, Action nem outras telas.

## Aceite

| Estado inicial e ação | Resultado esperado | Efeito proibido | Verificação |
| --- | --- | --- | --- |
| Dois protéticos QA ativos; abrir e alternar seleção | Seletor fechado mostra o nome do selecionado em todos os estados | UUID exposto, nome do outro ou fallback enganoso | Renderizado com duas opções e teclado |
| Enviar pedido sintético ao selecionado | Banco registra exatamente o ID escolhido e nome visível corresponde ao destino | Pedido enviado ao protético diferente | Preview com conta QA, persistência e recarga |

Entregar diff pequeno e gate de UI + persistência. Não fazer commit, push ou
deploy no despacho de implementação.

## Gate no Preview — 2026-10-12

Deployment `dpl_KKAAtPXXdEKjEsFhuHj1ANHsyjDh`, commit
`89f20ffeddd6abc0f63caff836b5df80ab69394c`, com secretária, dentista, dois protéticos, paciente e
agendamento descartáveis na QA B.

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Nome de Alfa e Beta no Select fechado | **PASSA** | Alfa apareceu após seleção por ponteiro; Beta após `ArrowDown` + `Enter`. Reabrir e fechar preservou o nome escolhido, sem UUID visível. |
| ID escolhido | **PASSA** | Beta visível correspondeu ao valor interno `5b3f9096-5bdd-46c8-8e08-3b8f0802280b`; o único pedido persistido usou exatamente esse `protetico_id`. |
| Destinatário e reload | **PASSA** | Beta viu o pedido completo na própria agenda e o reload preservou paciente, dentista, observação, hora e status. |
| Isolamento negativo | **PASSA** | Sessão autenticada de Alfa recebeu zero linhas para o pedido; Beta recebeu uma. |
| Console e limpeza | **PASSA** | Zero warning/error e zero resíduo sintético delimitado. |

O gate focal **PASSA no Preview**. R182-EST-03 fica preservado como falha histórica, com a correção
confirmada no candidato atual. Marcar o pedido como entregue permaneceu fora desta rodada porque não
é necessário para verificar o rótulo, o ID enviado e a persistência do destinatário.
