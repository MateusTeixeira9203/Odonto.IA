# Definition of Done

Uma funcionalidade so pode ser considerada pronta quando todos os criterios abaixo forem atendidos.

## Criterios obrigatorios

- O fluxo esta acessivel pela interface principal, sem depender de URL manual, SQL manual ou chamada isolada de API.
- O comportamento funciona ponta a ponta: interface, validacao, persistencia, leitura posterior e feedback de sucesso/erro.
- O fluxo respeita autenticacao, permissao e isolamento por clinica quando aplicavel.
- O resultado nao quebra fluxos existentes relacionados; regressao visivel reprova a entrega.
- O estado documentado no README, no backlog e em `docs/mvp-status.md` bate com o que realmente foi entregue.
- Dependencias externas necessarias para o fluxo estao configuradas e validadas no ambiente de teste.
- Os principais estados de erro, vazio e loading foram exercitados manualmente.
- O checklist relevante em `docs/manual-test-checklist.md` foi executado e marcado.
- O time consegue repetir o fluxo do zero sem conhecimento implicito do autor da tarefa.

## Evidencias minimas esperadas

- Caminho de navegacao claro a partir da interface.
- Dados persistidos visiveis apos refresh ou nova sessao.
- Mensagens de erro compreensiveis quando algo falha.
- Sem afirmacoes exageradas no README ou no backlog.

## Nao considerar pronto quando

- Existe apenas tabela, migration, route handler ou componente isolado sem fluxo completo.
- A funcionalidade so funciona com dados inseridos manualmente no banco.
- O fluxo depende de terceiro nao configurado e isso nao esta explicitado.
- O comportamento existe parcialmente, mas o README vende como concluido.
