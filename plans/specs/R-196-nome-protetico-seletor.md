# R-196 — mostrar nome do protético antes de enviar pedido

STATUS: ACTIVE
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
