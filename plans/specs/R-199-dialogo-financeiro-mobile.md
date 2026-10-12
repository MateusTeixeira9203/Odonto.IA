# R-199 — Diálogo financeiro alcançável no celular

STATUS: 🔵 ativo — desktop Preview PASSA; gate 390×844 impedido e pendente
OWNER: Coordenação — contrato/integração; Implementar — código; Auditor — gate
LAST_REVIEWED: 2026-10-12
CANONICAL_FOR: R182-EST-06 da auditoria dirigida

## Problema e escopo

No Preview `2c52879`, o detalhe de orçamento com cobrança parcial mede mais de
1.197 px de largura em viewport 390×844, inclusive em light/dark. Parte do
conteúdo fica fora do viewport sem rolagem horizontal alcançável. Evidência:
[auditoria R-182](../auditorias/2026-10-12-R-182-estabilizacao-dirigida.md).

Corrigir somente layout responsivo do diálogo financeiro e descendentes que
forçam largura. Preservar valores, ações, autorização, estados, ordem de
informação e layout desktop. Não alterar RPC, schema ou regra de negócio.

## Aceite

| Estado inicial e ação | Resultado esperado | Efeito proibido | Verificação |
| --- | --- | --- | --- |
| Orçamento sintético com entrada/parcelas em 390×844, abrir detalhe | Diálogo cabe no viewport; todas as seções e controles alcançáveis por toque, rolagem vertical e teclado | Conteúdo cortado sem caminho de rolagem | Preview light/dark, medidas DOM e navegação real |
| Abrir o mesmo orçamento no desktop | Hierarquia e controles anteriores preservados | Regressão de largura/posição ou ocultação de dados | Comparação renderizada antes/depois |
| Salvar uma ação financeira sintética já permitida | Mesmo resultado/persistência após recarga | Mudança de payload causada por layout | Gate focal de botão, resposta e reload |

Mudança visual pequena neste recorte usa os tokens atuais; se exigir redesenho,
voltar ao planejamento e aprovar artefato antes de ampliar.

## Implementação local e evidências

Em 2026-10-12, o modal passou a declarar no próprio breakpoint móvel
`w/max-w: calc(100vw - 2rem)` e `max-h: calc(100dvh - 2rem)`. O desktop mantém
`82vw`, máximo de `1280px` e `90vh` a partir de `sm`. O corpo e a coluna
financeira receberam `min-w-0`, para que o conteúdo interno não imponha uma
largura mínima à composição empilhada.

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Limites móveis e redução da coluna financeira no código | **PASSA (estático)** | A composição final de classes contém os limites `calc(100vw - 2rem)` e `calc(100dvh - 2rem)`, além de `min-w-0` no corpo e na coluna financeira. |
| TypeScript, lint focal e integridade do diff | **PASSA** | `pnpm typecheck`, ESLint do modal e `git diff --check` concluídos sem erro. |
| 390×844 light/dark, alcance por toque/rolagem/teclado | **NÃO TESTADO** | O checkout local iniciou sem sessão sintética; a abertura do Preview auditado foi bloqueada pela política do navegador. Nenhuma alternativa de contorno foi usada. |
| Desktop renderizado | **NÃO TESTADO** | A regra desktop foi preservada no código, mas ainda requer comparação renderizada. |
| Ação financeira, resposta, persistência e recarga | **NÃO TESTADO** | Fora da verificação local sem sessão sintética; não houve escrita financeira. |

A auditoria prova o defeito no candidato `2c52879`, mas a causa exata da largura
observada não pôde ser medida de novo neste ambiente. A correção torna explícitos
os limites móveis e elimina os mínimos intrínsecos nos dois contêineres que podem
forçar largura, sem alterar regras financeiras.

## Gate de browser no Preview — 2026-10-12

Ambiente: deployment `dpl_GD2g32dDQSUnySRm64oRfDckX9pf`, commit
`5cbd956a4f8c6c136d62fa819c0be236a7661dcf`, orçamento e pagamentos sintéticos removidos ao final.

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Desktop dark | **PASSA** | Em 1280×720, diálogo `1037,3 × 492,66`, dentro de `left=113,75` / `right=1151,05` e `top=113,67` / `bottom=606,33`; documento 1265 px ≤ viewport 1280 px. |
| Desktop light | **PASSA** | Mesma geometria; tokens observados alternaram de fundo/texto `13,13,13` / `250,250,250` para `244,244,246` / `9,9,11`. |
| Teclado desktop | **PASSA no recorte** | Foco alcançou todas as ações centrais e rodapé com bounding boxes visíveis; nenhuma ação financeira foi disparada. |
| Console | **PASSA** | Zero warning/error durante abertura, troca de tema e navegação focal. |
| 390×844 light/dark, toque e rolagem | **NÃO TESTADO — verificação impedida** | O controlador foi configurado antes de nova aba e após reload, mas a página permaneceu em `1280×720`; o navegador alternativo estava indisponível. Medidas móveis foram descartadas. |
| Ação financeira e reload | **NÃO TESTADO por limite** | Fixture serviu só para renderização; R-200 e escritas financeiras ficaram fora do recorte. |

O desktop renderizado está preservado. O aceite central de R-199 continua pendente: repetir em um
navegador que realmente aplique 390×844 e medir diálogo, `scrollWidth`, alcance por rolagem/toque e
foco nos dois temas. Não inferir PASSA móvel a partir das classes ou de emulação não aplicada.
