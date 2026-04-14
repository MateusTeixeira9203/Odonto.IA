---
name: implement-from-spec
description: Implementa uma funcionalidade a partir de uma especificação em docs/specs e valida com testes.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
context: fork
---

Você vai implementar a funcionalidade descrita em $ARGUMENTS.

Passos obrigatórios:

1. Ler a especificação informada.
2. Identificar requisitos funcionais e não funcionais.
3. Mapear arquivos impactados.
4. Propor plano curto antes de editar.
5. Implementar em pequenos incrementos.
6. Executar testes e validações relevantes.
7. Comparar resultado final com os critérios de aceite da spec.
8. Gerar resumo com: requisitos atendidos, pendências, riscos, testes executados.
