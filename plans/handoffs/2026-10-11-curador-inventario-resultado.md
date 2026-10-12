# Inventário do Curador — estabilização documental

STATUS: DRAFT
OWNER: Curador de Documentação
LAST_REVIEWED: 2026-10-11
CANONICAL_FOR: resultado delimitado do inventário de contradições e referências da estabilização

## Escopo lido

`00_FONTE_DA_VERDADE.md`, `AGENTS.md`, `plans/ESTADO.md`, `plans/specs/R-182-baseline-verificavel.md`,
`plans/specs/R-188-autorizacao-financeira-rpc.md`, os relatórios M0 e de auditoria ampla.
Não houve alteração nas fontes, código, banco ou status central.

## Achados verificáveis para integração

| Prioridade | Achado | Evidência | Correção mínima proposta à Coordenação |
| --- | --- | --- | --- |
| Alta | A hierarquia do 00 põe produção/baseline acima da spec, mas a própria regra posterior diz que produção é evidência de regressão e não autoriza perpetuar defeito. Sem uma regra explícita de exceção, uma leitura literal pode impedir correção aprovada. | `00_FONTE_DA_VERDADE.md:17-25,70-73`; `AGENTS.md:21-22` remete ao 00. | Reordenar ou explicitar em `00` que instrução atual do usuário e mudança deliberada por spec aprovada prevalecem sobre o comportamento existente; produção continua prova do implantado e baseline de regressão. |
| Alta | R-182 conserva o snapshot do M0 dizendo que R-188 estava vulnerável e recomendando sua contenção, antes da seção posterior que documenta aplicação e gate focal aprovados. A cronologia existe, mas o leitor pode usar os itens antigos como estado atual. | `plans/specs/R-182-baseline-verificavel.md:153-166` versus `:168-184`; estado atual também está em `plans/specs/R-188-autorizacao-financeira-rpc.md:130-185`. | Acrescentar no início do §8 de R-182: “snapshot de M0, superado para R-188 pelo §9 e pela spec R-188; não usar como estado atual da RPC”. Manter os achados M0 como evidência histórica, sem reclassificá-los. |
| Média | Referência interna ausente na spec ativa R-182. | `plans/specs/R-182-baseline-verificavel.md:103-104` aponta para `plans/handoffs/2026-10-11-etapa-01-baseline-e-estabilidade.md`, que não existe no checkout. | Remover o apontador inexistente ou substituir pelo handoff preservado que a Coordenação confirmar. Não inventar destino nem recriar o handoff a partir de memória. |
| Média | O cabeçalho do 00 declara substituir “AGENTS.md e CLAUDE.md: hierarquia documental anterior”, enquanto o próprio `AGENTS.md` está ACTIVE e remete ao 00. A formulação pode ser lida como substituição do AGENTS inteiro. | `00_FONTE_DA_VERDADE.md:3-7`; `AGENTS.md:3-7,16-22`. | Trocar o valor de `REPLACES` por “hierarquia documental anterior contida em versões pré-V2 de AGENTS.md e CLAUDE.md”. |
| Baixa | O bloqueio de billing da conta QA A é descrito de forma abreviada no Estado; a auditoria define que é impedimento de cobertura, sem defeito de billing demonstrado. | `plans/ESTADO.md:52-55`; `plans/auditorias/2026-10-11-auditoria-ampla-inicio.md:49-51`; `plans/specs/R-188-autorizacao-financeira-rpc.md:156-159`. | Em `ESTADO`, substituir “barrada pelo billing” por “redirecionada ao gate comercial `billing=required`; impedimento de cobertura, sem defeito de billing demonstrado”. |

## Fonte única por assunto após a correção

| Assunto | Fonte canônica | Estado que um novo agente deve usar |
| --- | --- | --- |
| Precedência documental | `00_FONTE_DA_VERDADE.md` | Requer a clarificação acima antes de servir como regra operacional sem ressalvas. |
| Foco, decisões e bloqueios atuais | `plans/ESTADO.md` | ACTIVE; não é prova de publicação por si só. |
| Versão/base publicada identificada | `01_BASELINE_E_ESTABILIDADE.md` e relatório M0 | Deploy/SHA identificados; schema reprodutível e jornadas amplas não estão fechados. |
| R-188, aplicação e gate da RPC | `plans/specs/R-188-autorizacao-financeira-rpc.md` | Migration aplicada; núcleo RPC passa com A/B QA; UI, secretária e outros papéis permanecem NÃO TESTADOS. |
| Auditoria ampla | `plans/auditorias/2026-10-11-auditoria-ampla-inicio.md` | ACTIVE/INCOMPLETA; cobertura de leitura parcial não promove estabilidade geral. |

## Validação de referências

Nos documentos do escopo, o único destino local ausente confirmado é o handoff de etapa 01 citado em R-182. Links entre Estado, R-188 e auditoria ampla existem e formam a trilha atual do gate financeiro. Não foi feita varredura de links do acervo histórico, que permanece fora deste recorte.

## Limites preservados

Fato de produção: R-188 teve migration aplicada e gate focal da RPC aprovado com fixtures QA.
Não inferir disso publicação da Action local, cobertura da UI, cobertura da secretária/outros papéis ou estabilidade geral. O gate comercial da conta QA A é impedimento de cobertura documentado, não diagnóstico de defeito de billing.
