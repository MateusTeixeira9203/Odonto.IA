# R-195 — refletir status encaminhado após salvar

STATUS: ACTIVE
OWNER: Implementar — código e teste; Coordenação — integração; Auditor — gate
LAST_REVIEWED: 2026-10-12
CANONICAL_FOR: correção do achado R182-EST-02

## Problema e limite

No Preview `2c52879`, após o destinatário marcar `Realizado` ou `A fazer`, a RPC
persiste e o toast confirma, mas o cartão clínico mantém o estado anterior até
recarregar a página. Evidência: seção 9.4 de
[R-182 auditoria dirigida](../auditorias/2026-10-12-R-182-estabilizacao-dirigida.md).

Corrigir somente a sincronização visual do cartão após resposta positiva da
Action. Preservar a RPC, regras de autorização, autoria, destino, assinatura,
logs e a data clínica. Não inventar sucesso otimista quando a Action falhar.
Não redesenhar o Prontuário nem alterar schema ou outros fluxos.

## Aceite

| Estado inicial e ação | Resultado esperado | Efeito proibido | Verificação |
| --- | --- | --- | --- |
| Evento encaminhado indicado; destinatário clica `Realizado` | Após sucesso, cartão mostra `Realizado`, progresso coerente e momento atual sem recarga manual | Toast de sucesso com cartão antigo ou duplicação de gravação | Preview com conta QA; resposta, banco, UI imediata e recarga |
| Evento realizado; destinatário clica `A fazer` | Cartão e progresso voltam imediatamente; recarga confirma | Data de realização persistente ou retorno inventado à próxima sessão | Mesmo gate, com leitura antes/depois |
| Action falha ou usuário sem permissão tenta status | Cartão conserva estado anterior, mensagem de erro e efeito zero | Estado visual de sucesso sem persistência | Teste focal e duas identidades QA |

Entregar diff pequeno, testes focais, PASSA/NÃO PASSA/NÃO TESTADO e risco de
regressão. Não fazer commit, push ou deploy no despacho de implementação.
