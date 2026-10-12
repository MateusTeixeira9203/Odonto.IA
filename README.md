# Odonto.IA — Sistema Operacional de Desenvolvimento

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: nenhum
CANONICAL_FOR: apresentação e navegação do repositório

Este repositório reúne o código do Odonto.IA e a governança V2 de desenvolvimento.
O processo organiza produto, execução, auditoria e documentação em etapas verificáveis,
com critérios de aceite e proteção dos fluxos existentes.

Este README é a porta de entrada. Regras, decisões e evidências permanecem nos documentos
responsáveis por cada assunto; o histórico não define requisitos atuais automaticamente.

## Por onde começar

1. Leia [AGENTS.md](AGENTS.md): regras compartilhadas, limites e segurança técnica.
2. Consulte [Fonte da verdade](00_FONTE_DA_VERDADE.md): autoridade e status dos documentos.
3. Abra [Estado atual](plans/ESTADO.md): foco, pendências e próxima decisão.
4. Confira a [baseline](01_BASELINE_E_ESTABILIDADE.md) e o contrato aprovado do item antes
   de implementar. Specs ficam em [plans/specs/](plans/specs/).

[CLAUDE.md](CLAUDE.md) encaminha às mesmas regras; não mantém uma governança alternativa.

## Baseline e momento do projeto

A retomada parte do código publicado, identificado em
[Baseline e estabilidade](01_BASELINE_E_ESTABILIDADE.md). Esse documento concentra o SHA,
o deployment, a data da conferência e os limites da verificação. Branch de trabalho e
preservação do acervo anterior estão no [Estado](plans/ESTADO.md).

A governança V2 foi incorporada localmente. Instalar seus protocolos não comprova um ciclo
completo de desenvolvimento nem a estabilidade funcional de todas as jornadas.
O acervo anterior deve ser reconciliado por item, sem reaplicar branches ou exclusões em lote.

A direção vigente está em [docs/PRODUTO.md](docs/PRODUTO.md), incluindo público, capacidades
e limites de evolução. A visão não comprova implantação nem autoriza implementação.
O [roadmap histórico](plans/ROADMAP.md) continua aguardando conciliação com o novo ciclo.

## Como uma tarefa avança

Produto → especificação aprovada → execução por marcos → validação local → auditoria →
correção pelo Executor, se necessária → regressão → documentação e handoff.

O [fluxo completo](03_FLUXO_DE_TRABALHO.md) define responsabilidades e limites. A spec do
item é o contrato único; o [handoff](04_HANDOFF_TEMPLATE.md) permite continuar sem reconstruir
todo o histórico. O Auditor reúne evidências e não corrige durante a auditoria.

Entrega local, revisão do usuário e publicação são estados distintos. Compilar não basta;
a conclusão depende dos [critérios de entrega](13_CHECKLIST_DE_ENTREGA.md) e das regressões
relevantes. Commit, push, deploy e alterações de produção exigem autorização conforme AGENTS.

## Mapa da governança V2

| Documento | Responsabilidade |
| --- | --- |
| [00 — Fonte da verdade](00_FONTE_DA_VERDADE.md) | Hierarquia, autoridade e validação de referências. |
| [01 — Baseline e estabilidade](01_BASELINE_E_ESTABILIDADE.md) | Base publicada, regressão e classificação de problemas. |
| [02 — Limpeza de legado](02_LIMPEZA_DE_LEGADO.md) | Inventário, classificação e arquivamento com preservação. |
| [03 — Fluxo de trabalho](03_FLUXO_DE_TRABALHO.md) | Etapas, contrato, responsabilidades e integração. |
| [04 — Handoff](04_HANDOFF_TEMPLATE.md) | Formato de passagem entre chats e sessões. |
| [05 — Auditoria e estresse](05_AUDITORIA_E_ESTRESSE.md) | Evidências, severidade, limites e testes seguros. |
| [06 — Design e artefatos](06_DESIGN_SYSTEM_E_ARTEFATOS.md) | Referência ativa, pipeline visual e paridade funcional. |
| [07 — Regressão e testes](07_REGRESSAO_E_TESTES.md) | Matriz de fluxos afetados e formas de verificação. |
| [08 — Arquiteto de Produto](08_PERSONA_ARQUITETO_DE_PRODUTO.md) | Problema, usuário, requisitos e critérios de aceite. |
| [09 — Executor](09_PERSONA_EXECUTOR.md) | Implementação mínima contra a spec aprovada. |
| [10 — Auditor](10_PERSONA_AUDITOR.md) | Reprodução, classificação e cobertura sem correção. |
| [11 — Curador de Documentação](11_PERSONA_CURADOR_DOCUMENTACAO.md) | Canônicos, decisões, referências e histórico. |
| [12 — Plano de sessão](12_PLANO_DE_SESSAO.md) | Resultados, marcos e fechamento do trabalho. |
| [13 — Checklist de entrega](13_CHECKLIST_DE_ENTREGA.md) | Condições para considerar uma tarefa entregue. |
| [14 — Coordenador](14_PROMPT_INICIAL_CEREBRO_DO_PROJETO.md) | Contexto inicial e coordenação dos papéis. |
| [15 — Reorganização inicial](15_PROCEDIMENTO_DE_REORGANIZACAO_INICIAL.md) | Preparação do acervo e primeiro ciclo do processo. |
| [16 — Modelos e escalonamento](16_MAPA_MODELOS_E_ESCALONAMENTO.md) | Seleção por função e escalonamento do problema específico. |

## Código e registros de trabalho

O código usa Next.js App Router, React e TypeScript, com Supabase para banco, autenticação
e armazenamento. Versões e comandos estão em [package.json](package.json); regras técnicas
e organização de `src/` estão em [AGENTS.md](AGENTS.md).

| Local | Conteúdo |
| --- | --- |
| [plans/specs/](plans/specs/) | Contratos dos itens; completar a spec existente antes de criar outra. |
| [plans/artefatos/](plans/artefatos/) | Artefatos visuais, utilizáveis somente com status e aprovação válidos. |
| [plans/auditorias/](plans/auditorias/) | Relatórios, evidências e limites de cobertura. |
| [plans/handoffs/](plans/handoffs/) | Passagens recentes no formato 04. |
| [plans/_arquivo/](plans/_arquivo/) | Histórico preservado, sem autoridade de requisito atual. |
| [templates/spec.md](templates/spec.md) | Ponto de partida para um contrato novo. |
| [templates/spec-redesign.md](templates/spec-redesign.md) | Inventário e preservação funcional em redesign. |

O foco vigente fica no Estado; o README não mantém uma segunda fila, matriz de testes ou
visão de produto. Valide status e data antes de usar qualquer documento encontrado por busca.
