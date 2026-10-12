# Fluxo de Trabalho Padrão

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: nenhum
CANONICAL_FOR: ciclo de trabalho por tarefa

## Visão geral

```text
IDEIA
  ↓
ARQUITETO DE PRODUTO
  ↓
ESPECIFICAÇÃO APROVADA
  ↓
EXECUTOR
  ↓
VALIDAÇÃO LOCAL
  ↓
AUDITOR / QA
  ↓
CORREÇÃO (se necessária)
  ↓
TESTE DE REGRESSÃO
  ↓
CURADOR DE DOCUMENTAÇÃO
  ↓
HANDOFF FINAL
```

## Etapa 1 — Produto

O Arquiteto de Produto define:

- problema;
- usuário;
- objetivo;
- fluxo;
- requisitos;
- permissões;
- estados;
- erros;
- critérios de aceite;
- fora de escopo;
- risco de regressão.

## Etapa 2 — Plano técnico

Antes de editar:

- identificar arquivos;
- identificar contratos afetados;
- identificar dependências;
- listar testes;
- dividir em marcos.

## Etapa 3 — Implementação

O Executor:

- não redefine produto;
- não amplia escopo;
- não muda arquitetura sem justificativa;
- entrega por marcos;
- testa após cada marco relevante.

## Etapa 4 — Auditoria

O Auditor:

- tenta reproduzir;
- exige evidência;
- classifica severidade;
- evita falsos positivos;
- não altera código.

## Etapa 5 — Correção

Só corrigir achados `CONFIRMED`.

Máximo de duas tentativas automáticas por achado.

## Etapa 6 — Regressão

Rodar matriz dos fluxos potencialmente afetados.

## Etapa 7 — Documentação

O Curador:

- atualiza estado atual;
- arquiva decisões antigas;
- registra substituições;
- cria handoff final.

## Etapa 8 — Fechamento

A tarefa só fecha quando o checklist de entrega estiver completo.

## Contrato e responsabilidades locais

Usar a spec do item em `plans/specs/` como contrato único; completar a existente em vez de
criar checklist paralelo. Para item novo, partir de `templates/spec.md`; redesign usa
`templates/spec-redesign.md`. Feature com mais de um arquivo ou mudança de schema/API exige
spec antes do código. Critérios incluem estado inicial, ação, esperado, efeito proibido e
verificação segura. Registrar PASSA, NÃO PASSA ou NÃO TESTADO, ambiente e versão.

Antes de delegar: definir responsável, arquivos/módulos, dependências, limites e handoff 04.
Chats/subagentes compartilham arquivos quando usam o mesmo checkout. Só o integrador atualiza
o panorama; cada executor mantém evidências no seu item. A entrega fica READY_FOR_REVIEW
até a revisão do usuário, sem presumir aceite ou autorização de publicação.

Correção é trabalho do Executor, em etapa distinta. `design-polish` corrige apenas nessa
etapa; o Auditor coleta evidências sem editar código. Auditoria dirigida suficiente valida
o recorte e consumidores diretos; auditoria completa fica para marcos amplos/regressões
sistêmicas. Antes de integração conferir base, dependências, conflitos e regressões.
