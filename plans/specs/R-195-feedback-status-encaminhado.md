# R-195 — refletir status encaminhado após salvar

STATUS: ACTIVE — direção A fazer → Realizado PASSA no Preview; inversa e negativa não testadas
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

## Gate no Preview — 2026-10-12

No deployment `dpl_KKAAtPXXdEKjEsFhuHj1ANHsyjDh` (`89f20ffeddd6abc0f63caff836b5df80ab69394c`),
um procedimento novo e sintético encaminhado ao dentista autenticado passou de `A fazer` para
`Realizado`. Antes de reload, cartão, odontograma e progresso mudaram para `Realizado`, “feito aqui”
e `33% · 1 de 3`. O banco confirmou `realizado_em=2026-10-12`,
`momento_planejado=sessao_atual`, autoria/destino preservados e um log do destinatário. A recarga
manteve o mesmo estado.

| Critério | Estado |
| --- | --- |
| `A fazer → Realizado`, resposta, UI imediata e banco | **PASSA** |
| Persistência após recarga | **PASSA** |
| `Realizado → A fazer` | **NÃO TESTADO nesta rodada** |
| Falha/sem permissão com efeito zero | **NÃO TESTADO nesta rodada** |

A fixture e as duas identidades QA foram removidas; zero resíduo delimitado permaneceu.
