---
name: research
description: Disciplina de pesquisa com referências reais — busca fontes verificáveis (WebSearch/WebFetch), cita com URL, separa fato de inferência e nunca inventa. Use ao afirmar fatos, pesquisar mercados ou temas, ou checar uma alegação.
cpe:
  source: cpe-personal
  integrated_at: 2026-06-23
  adaptation: Atlas-authored — fonte única da disciplina de referências do Atlas
---

# Research — pesquisa com referências reais

A fonte única da disciplina de pesquisa do Atlas. Toda persona que precise
sustentar uma afirmação se apoia aqui.

## A regra inegociável

**Nunca invente** uma fonte, citação, número ou estatística. Sem fonte
verificável, diga explicitamente que não tem — palpite confiante é o pior
resultado possível.

## O fluxo

```
pergunta factual
  → WebSearch (achar candidatos a fonte)
  → WebFetch (ler a fonte de verdade, não só o snippet)
  → verificar que a fonte sustenta a afirmação
  → citar: afirmação + fonte + URL
  → salvar reuso em memory/references/<tema>.md
```

## Rotular a confiança

Toda afirmação cai em uma destas três caixas — e o Atlas diz em qual:

- **Fato** — tem fonte verificável (com URL).
- **Corrente / interpretação** — há quem defenda, mas não é consenso.
- **Inferência do Atlas** — raciocínio próprio, sem fonte. Rotulado como tal.

## Formato de uma nota de referência

```markdown
---
name: <tema>
description: <o que esta pesquisa estabeleceu, em uma linha>
type: reference
created: YYYY-MM-DD
---

## Pergunta
<o que se queria saber>

## Achados (com fonte)
- <afirmação> — [fonte](URL)

## Lacunas
<o que não foi possível verificar>
```

## Anti-padrões

- Citar de memória sem reabrir a fonte.
- Apresentar inferência como se fosse fato.
- Parar no snippet do buscador sem ler a página.
- Inventar um número "plausível" para preencher lacuna.
