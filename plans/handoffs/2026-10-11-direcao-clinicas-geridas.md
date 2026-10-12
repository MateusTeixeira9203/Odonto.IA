# HANDOFF — direção de produto para clínicas geridas

STATUS: REFERENCE_ONLY
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: nenhum
CANONICAL_FOR: passagem desta consolidação documental

## 1. Identificação

- Tarefa: consolidar direção de produto e preparar pesquisa de gestão.
- Área/responsável anterior: Coordenação, em etapas de Arquiteto de Produto e Curador.
- Estado: READY_FOR_REVIEW.
- Branch: `codex/baseline-producao-v2`; HEAD `ba5b531164c2983b991de27a96f94668fbb7ebda`.
- Data: 11/10/2026. Alterações locais; sem commit, push ou deploy. Nenhum chat delegado.

## 2. Objetivo

Registrar as decisões do usuário sobre público e preservação, distinguindo direção, hipóteses
e funcionamento comprovado. Preparar a conversa com três dentistas, sem implementar gestão.

## 3. Contexto mínimo

Governança V2 e README já incorporados localmente. Usuário priorizou estabilidade/segurança
antes da expansão e confirmou os nomes e preservação de Clindent e Dra. Léia.

## 4. Fonte de verdade utilizada

[AGENTS](../../AGENTS.md), [00](../../00_FONTE_DA_VERDADE.md),
[baseline](../../01_BASELINE_E_ESTABILIDADE.md), decisão explícita do usuário em 11/10/2026.
Canônico atualizado: [PRODUTO](../../docs/PRODUTO.md). Sem spec de implementação ou artefato visual.

## 5. Decisões tomadas

Público, exceções e prioridade de estabilização registrados no canônico. Sugestão de começar
a investigação por financeiro/capacidade identificada como recomendação, não escopo aprovado.
Fontes oficiais demonstram oferta concorrente, sem comprovar sua qualidade na prática.

## 6. Fora de escopo

Código, banco, planos/cobrança, migração, permissões, design, auditoria funcional e publicação.
Não contatar entrevistados nem acionar outros chats nesta etapa.

## 7. Arquivos alterados

- [PRODUTO](../../docs/PRODUTO.md): direção canônica conciliada.
- [Pesquisa](../../memory/references/gestao-clinicas-geridas-2026-10-11.md): fontes e roteiro, sem respostas fabricadas.
- [Estratégia anterior](../../docs/ESTRATEGIA-PRODUTO.md): SUPERSEDED, corpo preservado.
- [README](../../README.md) e [AGENTS](../../AGENTS.md): apontadores para a visão vigente.
- [Estado](../ESTADO.md): foco e pendências, sem duplicar a visão.
- Este handoff: registro da entrega e limites.

## 8. Banco / schemas / APIs afetados

Nenhum. Não houve leitura ou escrita de dados reais nesta etapa.

## 9. Critérios de aceite documental

- PASSA: direção nova e duas exceções explícitas; leitura dirigida do canônico.
- PASSA: relato de qualidade separado de estabilidade comprovada; hipóteses sem status de requisito.
- PASSA: fontes primárias abertas; roteiro começa por problemas e exemplos, antes de sugestões.
- PASSA: links locais válidos e regras técnicas preservadas; verificação documental local.
- PASSA: somente sete documentos alterados nesta etapa; HEAD e índice preservados.
- Pendente: revisão do usuário sobre a consolidação e escolha do próximo contrato de trabalho.

## 10. Testes executados

Verificação documental: links, diff/whitespace e comparação com snapshot anterior à edição.
Snapshot: `/tmp/odonto-produto-2026-10-11-before.json` (evidência temporária de comparação).
Testes funcionais, segurança e regressão do sistema: NÃO TESTADO, fora desta etapa documental.

## 11. Problemas conhecidos

Confirmados: roadmap histórico ainda sem conciliação; entrevistas e auditoria não realizadas.
Sem evidência: urgência relativa das capacidades e qualidade dos concorrentes no uso real.

## 12. Riscos de regressão

Interpretar direção como função pronta; retirar acesso das exceções; inferir poderes clínicos
do papel de proprietário; implementar todas as sugestões. Canônico explicita esses limites.

## 13. Próxima ação exata

Revisar a consolidação com o usuário. Na abertura da estabilização, localizar e reconciliar o
contrato existente de baseline/auditoria e suas evidências antes de propor o primeiro marco.
Usuário conduz entrevistas; resultados alimentam a priorização de gestão posteriormente.

## 14. Não fazer

Não recuperar a branch preservada em lote, não usar nomes como IDs de clínica, não alterar
planos/acessos e não promover o roadmap antigo. Sem commit, push, deploy ou dados reais.

## 15. Estado da documentação

Visão e apontadores atualizados; estratégia anterior marcada; handoff salvo.
Revisão do usuário pendente. Nenhuma entrega funcional ou publicação declarada.
