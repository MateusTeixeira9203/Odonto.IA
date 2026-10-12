# Fonte da Verdade e Hierarquia Documental

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: hierarquia documental anterior das versões pré-V2 de AGENTS.md e CLAUDE.md
CANONICAL_FOR: hierarquia documental e validação de referências

## Objetivo

Impedir que decisões antigas, handoffs antigos ou artefatos de design superados voltem a dirigir o desenvolvimento.

## Hierarquia

Esta ordem classifica evidência sobre o **estado implantado** e sua regressão. Para decidir
uma mudança, prevalecem a instrução atual do usuário e a spec aprovada do item; produção
mostra o que existe, mas não veta a correção deliberada de um defeito. Em conflito entre
registros sobre o estado implantado, prevalece a fonte de maior prioridade:

1. **Estado confirmado de produção / baseline estável**
2. **Documento canônico atual da área**
3. **Especificação aprovada da tarefa atual**
4. **Decisões registradas no ciclo atual**
5. **Código atual**
6. **Handoffs recentes**
7. **Artefatos ativos**
8. **Documentos históricos**
9. **Handoffs arquivados**
10. **Artefatos superados**

## Status obrigatório para documentos e artefatos

Todo documento relevante deve possuir um status:

- `ACTIVE` — válido e utilizável.
- `SUPERSEDED` — substituído por outro documento.
- `ARCHIVED` — mantido apenas como histórico.
- `DRAFT` — ainda não aprovado.
- `REFERENCE_ONLY` — pode fornecer contexto, mas não requisitos.

## Cabeçalho recomendado

```text
STATUS: ACTIVE
OWNER: <área ou agente responsável>
LAST_REVIEWED: YYYY-MM-DD
REPLACES: <arquivo anterior, se existir>
CANONICAL_FOR: <tema>
```

## Regra de conflito

Se um documento antigo disser A e a especificação atual disser B:

- implementar B;
- não "misturar" A e B;
- marcar o documento antigo como `SUPERSEDED` ou `ARCHIVED`;
- registrar a decisão no handoff.

## Regra de busca

Antes de usar uma referência encontrada por busca textual:

1. verificar status;
2. verificar data;
3. verificar se é canônica para o assunto;
4. confirmar se não foi substituída.

Busca sem validação de status não pode decidir requisito.

## Aplicação no repositório

Instruções atuais e explícitas do usuário prevalecem sobre documentos. A hierarquia acima
resolve conflitos entre registros; produção prova o comportamento implantado e é referência
de regressão, não autorização para perpetuar um defeito. Uma mudança deliberada exige spec
aprovada e indicação do comportamento alterado. Conflito ainda não resolvido volta ao usuário.

`STATUS` descreve autoridade documental. Estado de tarefa, resultado de teste e classificação
de achado são campos distintos; `DONE` local não significa publicação verificada.
`DELETE_CANDIDATE` é disposição de triagem; `EXPLORATION_ONLY` é finalidade de artefato.
Nenhum dos dois concede autoridade de requisito. Usar os status documentais acima.

O pacote V2 foi incorporado como documentos 00–16 e regras conciliadas em `AGENTS.md`.
O original fornecido é referência de origem; alterações futuras ocorrem no canônico específico,
sem manter outra cópia concorrente do pacote inteiro no repositório.
