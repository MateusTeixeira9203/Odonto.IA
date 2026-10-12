# HANDOFF — preparação da estabilização do core

STATUS: REFERENCE_ONLY
OWNER: Coordenação
LAST_REVIEWED: 2026-10-11
REPLACES: nenhum
CANONICAL_FOR: passagem da preparação; contrato no R-182

## 1. Identificação

Tarefa: preparar estabilização verificável. Área: Produto/planejamento e documentação.
Responsável anterior: Coordenação. Estado: READY_FOR_REVIEW.
Branch: `codex/baseline-producao-v2`; HEAD `ba5b531164c2983b991de27a96f94668fbb7ebda`.
Data: 11/10/2026. Nenhum agente ou chat acionado.

## 2. Objetivo

Dar limite e critérios de encerramento ao pente-fino pedido pelo usuário e preservar
simplicidade como princípio da futura gestão abrangente.

## 3. Contexto mínimo

O usuário quer estabilizar o core, melhorar entradas/usabilidade e então ampliar gestão.
O acervo registra riscos anteriores que exigem conciliação antes de refinamento cosmético.

## 4. Fonte de verdade utilizada

[R-182 proposto](../specs/R-182-baseline-verificavel.md), [Produto](../../docs/PRODUTO.md),
[AGENTS](../../AGENTS.md) e protocolos 01/05/07. Origem histórica identificada na spec.
Sem artefato visual novo ou contrato de correção aprovado nesta etapa.

## 5. Decisões tomadas

Prioridade de estabilidade e ambição de gestão registradas conforme o usuário.
Marcos e critérios de encerramento são proposta do coordenador, não resultados de auditoria.

## 6. Fora de escopo

Implementação, correções, auditoria funcional, mudanças em dados, publicação e delegação.

## 7. Arquivos alterados

[R-182](../specs/R-182-baseline-verificavel.md): retomado no mesmo caminho como DRAFT.
[Produto](../../docs/PRODUTO.md): abrangência com simplicidade e limite do benchmark inicial.
[Estado](../ESTADO.md): contrato e próxima decisão. Este handoff: passagem da preparação.

## 8. Banco / schemas / APIs afetados

Nenhum. Schema/deploy não reconsultados nesta etapa.

## 9. Critérios de aceite documental

Marcos delimitados, critérios observáveis, evidência histórica separada de atual e ausência
de alteração funcional. Revisão do usuário pendente; critérios funcionais estão na spec.

## 10. Testes executados

Verificação de links e diff documental; comparação com snapshot anterior à edição para
preservação dos demais arquivos, HEAD e índice. Gates funcionais: NÃO TESTADO nesta retomada.
Snapshot temporário: `/tmp/odonto-estabilizacao-plano-before.json`.

## 11. Problemas conhecidos

Registros anteriores R-188 e financeiros sem estado atual reconciliado. Sua existência
não autoriza reaplicar correções nem afirmar que os defeitos continuam no ambiente publicado.

## 12. Riscos de regressão

Expandir gestão durante estabilização, fazer redesign em lote, confundir documentação com
gate ou apagar fluxos legados. Limites e preservação explícitos na spec.

## 13. Próxima ação exata

Revisar o contrato proposto e, com aval para delegação, despachar somente M0 ao Auditor:
inventário/conciliação de leitura, sem correção. O Executor recebe depois um defeito confirmado
e seu contrato próprio; o panorama permanece sob responsabilidade da Coordenação.

## 14. Não fazer

Não publicar, testar com escrita em dados reais ou reativar autorização histórica genérica.
Não transportar branches/migrations em lote. Não declarar produto estabilizado nesta preparação.

## 15. Estado da documentação

Contrato DRAFT e apontadores atualizados; decisões duráveis no Produto. Handoff salvo;
spec histórica permanece consultável no Git. Não houve arquivamento ou exclusão de acervo.
