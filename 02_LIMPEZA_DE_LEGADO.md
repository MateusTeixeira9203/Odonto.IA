# Limpeza de Legado e Memória do Projeto

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: nenhum
CANONICAL_FOR: inventário, classificação e arquivamento de legado

## Objetivo

Reduzir ruído sem apagar conhecimento útil.

Não fazer "apagão" indiscriminado.

## Processo

### Etapa 1 — Inventário

Classificar:

- documentação;
- handoffs;
- ADRs/decisões;
- artefatos de design;
- arquivos temporários;
- relatórios de auditoria;
- planos antigos.

### Etapa 2 — Marcação

Cada item recebe um status:

- ACTIVE
- SUPERSEDED
- ARCHIVED
- REFERENCE_ONLY
- DRAFT

`DELETE_CANDIDATE` é uma disposição separada, não um status de autoridade. O item fica
`REFERENCE_ONLY` até revisão e autorização de remoção.

### Etapa 3 — Arquivamento

Mover conteúdo não ativo para estrutura explícita, por exemplo:

```text
/docs/archive/
/docs/handoffs/archive/
/design/archive/
/audits/archive/
```

### Etapa 4 — Evitar colisão semântica

Documentos arquivados devem conter no topo:

```text
STATUS: ARCHIVED
DO NOT USE AS CURRENT REQUIREMENT
```

### Etapa 5 — Remoção

Excluir apenas quando:

- duplicado sem valor histórico;
- gerado temporariamente;
- não referenciado;
- não necessário para auditoria ou rastreabilidade.

## GitHub

Preferir arquivar e versionar decisões importantes em vez de apagar agressivamente.

Se a limpeza incluir remoção, fazê-la em commit próprio com mensagem clara.

## Memória operacional

O contexto ativo deve caber em poucos documentos canônicos.

O agente não deve precisar ler a história inteira do produto para executar uma tarefa nova.

## Aplicação local

Reutilizar `plans/_arquivo/` para specs, artefatos e handoffs; não criar outra árvore de
arquivo só para reproduzir os exemplos acima. Arquivar caminhos rastreados com `git mv`.
Preservar evidências e edições de outros trabalhos. Exclusão exige revisão dos critérios
acima e autorização explícita; a instalação deste protocolo não autoriza limpeza em lote.
