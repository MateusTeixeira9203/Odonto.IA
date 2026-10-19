---
name: artefato-visual
description: >
  Lê um artefato HTML (mockup gerado pelo Codex) e o usa como base real da
  implementação — serve por HTTP local, abre no browser, extrai os tokens exatos
  (cores, fontes, espaçamentos) por JavaScript e escreve na spec. Também compara a tela
  implementada contra o artefato. Use quando o usuário disser "faz igual o artefato",
  "usa o artefato como base", "compara com o mockup", "extrai as cores do artefato",
  "o artefato está em plans/artefatos", ou quando uma spec tiver Referência visual
  apontando pra um .html.
---

# Artefato visual como base da implementação

Um artefato é um mockup HTML renderizado — a decisão de design feita visível. Ele só
serve de base se for **lido de verdade**. Ler errado é a causa nº 1 de "a IA não fez o
que eu mostrei".

## A regra que não muda

| Nunca | Sempre |
|---|---|
| `Read` no `.html` (60–90 KB, quase tudo CSS — enche o contexto e você ainda não *viu* nada) | Servir por HTTP local e abrir no browser |
| Abrir por `file://` | `http://localhost:PORT` |
| Deduzir cor de screenshot ("parece um verde-água") | Extrair o hex por JavaScript |
| Deixar o artefato como única fonte | Escrever os tokens **em texto na spec** |

`file://` renderiza um snapshot que o **usuário** vê e a automação **não alcança** —
screenshot e leitura falham com "No site is open". Só HTTP funciona.

## 1. Servir

Se o projeto já tem dev server rodando e o artefato está numa rota servida, use essa URL.
Senão, sirva a pasta de artefatos:

```bash
cd plans/artefatos && cat > _serve.mjs <<'EOF'
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
createServer(async (req, res) => {
  try {
    const buf = await readFile('.' + decodeURIComponent(req.url.split('?')[0]));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nao encontrado'); }
}).listen(8899, () => console.log('http://localhost:8899'));
EOF
node _serve.mjs &
```

Depois abra com `preview_start` na URL `http://localhost:8899/{arquivo}.html`.
**Apague o `_serve.mjs` ao terminar** — é andaime, não código do projeto.

## 2. Ver

`screenshot` pra ter a composição geral. Role a página pelas seções principais —
uma tela só raramente cabe em um screenshot.

## 3. Extrair os tokens (o passo que ninguém pula)

Rode no browser, não no olho:

```javascript
(() => {
  const vars = {};
  for (const sh of document.styleSheets) {
    try {
      for (const rule of sh.cssRules) {
        if (rule.selectorText === ':root' || rule.selectorText === 'html') {
          for (const p of rule.style) if (p.startsWith('--'))
            vars[p] = rule.style.getPropertyValue(p).trim();
        }
      }
    } catch (e) {}
  }
  const el = document.querySelector('h1') || document.body;
  return {
    tokens: Object.entries(vars),
    displayFont: getComputedStyle(el).fontFamily,
    bodyFont: getComputedStyle(document.body).fontFamily,
  };
})()
```

Se o artefato não declara custom properties, meça os elementos direto:
`getComputedStyle(el).backgroundColor / color / padding / borderRadius / fontSize`
nos componentes-chave (card, botão, input, cabeçalho de tabela).

## 4. Escrever na spec — o artefato não é o contrato

Preencha a seção **Referência visual** da spec com o que extraiu:

```markdown
## 5. Referência visual   ← seção da SPEC, não desta skill

- **Artefato:** `plans/artefatos/R-NN-{slug}.html`
- **Rota alvo:** `/dashboard/…` · **Componente alvo:** `src/…`

| Token | Valor |
|---|---|
| `--teal` | `#2f9c85` |
| `--surface` | `#ffffff` |
| Display | `DM Serif Display, Georgia, serif` |

**Comportamento que o artefato mostra e o token não captura:**
- {ex: card colapsa em 1 linha quando não tem procedimento}
```

> **Por que em texto:** o HTML não entra em contexto durante a execução. O que a
> implementação segue é esta tabela. O artefato é a prova visual; a spec é o contrato.

## 5. Planejamento — artefato como insumo de spec

Quando o artefato existe **antes** da spec, ele acelera muito o planejamento. Mas ele
cobre metade do documento, e a outra metade é a que quebra na produção.

| Seção da spec | O artefato dá? |
|---|---|
| §3 Objetivo e como funciona | **Sim** — a organização das zonas, a ordem, o que é primário |
| §4 Contrato: árvore de componentes | **Sim** — quais existem, quais variantes |
| §4 Contrato: types, API, schema | **Não.** Os dados são string fixa no HTML |
| §5 Referência visual | **Sim** — é a fonte |
| §6 Invariantes | **Não.** Permissão e regra não são visíveis |
| §7 Gates de aceite | **Só os visuais.** Os de comportamento, não |

### Extração estruturada (além dos tokens)

1. **Zonas** — liste as seções na ordem em que aparecem, com uma linha do papel de cada.
2. **Componentes** — inventário, e **quais estados o artefato mostra** (e quais não mostra).
3. **Interações reais** — clique tudo que é clicável no artefato e registre o que acontece.
   Mockup com JS mostra comportamento de verdade; mockup estático não — diga qual é o caso.
4. **Microcópia** — os rótulos exatos, porque copy inventada na implementação é divergência.

### A lista de lacunas — a parte mais útil

Percorra o artefato **elemento por elemento** e, para cada um, produza as perguntas que ele
não responde:

| Elemento no artefato | De onde vem o dado? | E se vazio? | Quem pode ver/editar? | Qual o limite? |
|---|---|---|---|---|
| Card "Restauração MOD · resina" | ? | ? | ? | ? |

Essa tabela vira as perguntas do planejamento e, respondida, vira §4 e §6 da spec.
**É o maior valor do artefato no planejamento: ele torna a lista de perguntas exaustiva**,
em vez de depender de alguém lembrar o que perguntar.

### Casos de borda que o artefato sempre esconde

Levante explicitamente, porque o mockup nunca os mostra: coleção vazia · **uma** entrada ·
volume grande (200 linhas) · texto longo que estoura o container · carregando · erro ·
sem permissão · dado desatualizado ou parcial.

> **Risco de lavagem:** o artefato foi gerado por mim. Especificar contra ele é especificar
> contra a minha própria saída anterior — uma decisão ruim vira contrato sem nunca ter
> passado por você. O que torna um artefato autoritativo é **você ter aprovado**, não ele
> existir. Artefato com `status: rascunho` no cabeçalho não governa implementação.

## 6. Comparar depois de implementar

Duas abas: artefato servido e a tela real rodando. Compare **na mesma largura** e nos
**dois temas**. Reporte divergência como lista específica — "espaçamento do card é 12px,
artefato usa 16px" —, nunca como "está diferente".

## 7. Regras

- Artefato desatualizado é **pior que artefato nenhum** — vira mentira que parece
  contrato. Se o design mudou no código, ou atualize o artefato ou marque o cabeçalho
  dele como superado.
- Nova versão é **arquivo novo**, não edição do antigo: `R-NN-{slug}-v2.html`.
- Cabeçalho obrigatório no topo do artefato:
  ```html
  <!-- ARTEFATO · R-NN · rota: /… · componente: src/… · 2026-07-21 · status: aprovado -->
  ```
- Destino e retenção do artefato seguem AGENTS.md e a decisão atual do usuário. Não criar acervo histórico automaticamente.
