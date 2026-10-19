---
name: spec-driven
description: Define o contrato de uma mudança não trivial antes da implementação, respeitando a fonte e o destino definidos pelo usuário.
---

# Contrato antes da implementação

Siga `AGENTS.md` e leia `plans/ESTADO.md`. Reutilize o contrato aprovado fornecido
pelo usuário; não criar uma segunda spec ou checklist. Não usar em ajustes triviais
ou quando o contrato já estiver definido.

## Destino nesta fase

O usuário decidiu manter o plano da atualização fora do repositório, em arquivo
para download/OneDrive. Não criar `plans/specs`, templates, IDs ou novas linhas de
backlog automaticamente. Entregar o documento externo quando o usuário pedir seu
fechamento. Para executar, receber a versão aprovada e a autorização do recorte.

## Conteúdo proporcional ao recorte

- Problema, usuário/papel, objetivo e limites dentro/fora do escopo.
- Comportamento atual verificado, resultado desejado e consumidores a preservar.
- Fluxo principal e estados pertinentes: vazio, carregando, sucesso, erro,
  validação, sem permissão, conflito e dados desatualizados.
- Contratos de dados/API/autorização e tipos somente quando necessários ao recorte;
  conferir nomes e comportamento no código/schema autorizado, sem inventar campos.
- Referência visual aprovada quando existir, separada das regras de negócio.
- Critérios observáveis: estado inicial, ação, resultado, efeito proibido e
  verificação segura. Dados e permissões exigem evidência proporcional ao risco.
- Dependências, responsável, pendências, ambiente de validação e reversão.

Só o usuário aprova o contrato. Distinguir decisão de hipótese e local de publicado.
Se houver incompatibilidade durante a implementação, trazer o achado antes de
mudar escopo. Não ditar implementação em prosa nem detalhar toda a atualização
antes de fechar as jornadas e decisões com o usuário.
