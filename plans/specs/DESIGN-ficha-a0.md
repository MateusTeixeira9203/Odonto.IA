# DESIGN.md — Ficha A0 (3 camadas por especialidade)

> ## ⛳ BASE CANÔNICA (21/07): [`ficha-definitiva-2026-07-21-artefato.html`](ficha-definitiva-2026-07-21-artefato.html)
> **A implementação COPIA aquele arquivo — não adapta.** Decisão do Mateus 21/07: o definitivo *é* o design
> da ficha. Ele consolida os 2 mockups aprovados + as decisões da sessão (5 zonas · odontograma-navegação
> substituindo o seletor v2 · perfil do dente e da região · decíduos · obs por procedimento · encaminhamento
> · assinatura por procedimento · 8 regras). Este documento continua valendo para **como traduzir** (tokens,
> `-ink`, fontes); o **o quê** vem do artefato. Divergência → atualiza o artefato primeiro.

_Gerado 2026-07-20 · Complementa [`DESIGN-odontograma-v3.md`](DESIGN-odontograma-v3.md) (dente/odontograma, aprovado 18/07)_

> **Este NÃO é um brief exploratório.** A direção visual já foi aprovada pelos dentistas do piloto
> no [artefato-base](odontograma-v3-preview-dentistas-artefato.html). Este documento **traduz** o
> artefato pros tokens do produto (`src/app/globals.css`) e fixa as regras de fidelidade. Não há
> escolha de paleta/estilo/fonte — herda-se o que existe. `design-shotgun` seria erro aqui.

---

## 1. Achado central: o artefato JÁ é o design system do produto

O artefato foi construído sobre a paleta do `globals.css`. A tradução é quase 1:1 — não há
recoloração, só troca de nome de variável (hex literal do artefato → token do produto).

| Papel | Artefato (hex literal) | Token do produto (usar SEMPRE este) | Igual? |
|---|---|---|---|
| A fazer / indicado | `#e57373` | `--color-coral` | ✅ |
| Feito nesta clínica | `#2f9c85` | `--color-teal` | ✅ |
| Pré-existente | `#64748b` | `--color-slate` | ✅ |
| Alerta periodontal (bolsa ≥4mm) | `#f59e0b` | `--color-warning` | ✅ |
| Fundo tingido a fazer | `#fce8e8` | `--color-coral-pale` | ✅ |
| Fundo tingido feito | `#e4f4f1` | `--color-teal-pale` | ✅ |
| Fundo da ficha | `#f6f7f6` | `--color-bg` (`#f4f4f6`) | ~ (imperceptível) |
| Card/surface | `#ffffff` | `--color-surface` | ✅ |
| Borda | `#dfe2df` | `--color-border` (`#c2c2c6`) | → **usar o do produto** (bordas mais definidas, decisão a11y) |
| Texto primário | `#1b1c1b` | `--color-text-primary` | → **usar o do produto** (`#09090b`, mais escuro) |

**Regra:** nenhum hex do artefato entra no código. Todo valor vem de `var(--color-*)`. O artefato é
referência de **forma e cor semântica**, não de string hex.

## 2. A ÚNICA divergência obrigatória do CSS literal do artefato — texto tingido usa `-ink`

O artefato usa `--teal`/`--coral`/`--slate` **cheios como cor de texto** em vários lugares (rótulos
de canal, "CT", números destacados). **Isso reprova WCAG AA** sobre fundo tingido — é o mesmo bug de
contraste que o produto já corrigiu **duas vezes** (Bloco 0 e auditoria UX 19/07, e de novo no
`CapturaLivreCard` em 20/07).

> **Fill, borda e ponto** do dente → `--color-teal` / `--color-coral` (cor cheia, como o artefato).
> **Texto** (rótulo, número, "CT", nome do canal) sobre fundo claro/tingido → `--color-teal-ink` /
> `--color-coral-ink` / `--color-slate-ink`. Nunca a cor cheia como texto.

Os tokens `-ink` já existem no `globals.css` (light: teal-ink=`#1e7060`, coral-ink=`#b3261e`,
slate-ink=`#334155`; dark: remapeados). Este é o item nº1 de qualquer design-review da ficha.

## 3. Tipografia — trocar as fontes de sistema do artefato pelas do produto

O artefato usa `system-ui` + `ui-monospace`. O produto tem fontes próprias — usar **elas**:

| Uso | Token | Fonte | Onde na ficha |
|---|---|---|---|
| Heading | `--font-heading` | DM Serif Display | "Odontograma", "Ficha endodôntica", "Exame periodontal" |
| Corpo / rótulo | `--font-sans` | Outfit | labels, chips, texto de card |
| **Número** | `--font-mono` | DM Mono | **CT, comprimento, lima (#35), PS/MG/NIC, nº do dente** — sempre com `font-variant-numeric: tabular-nums` |

Números clínicos **sempre** em mono tabular — colunas de endo e periograma têm que alinhar dígito a
dígito (o artefato já faz isso via `.num`/`.mm`; herdar o comportamento, trocar a fonte).

## 4. Componentes das 3 camadas (forma vem do artefato §11/§4/§8/§10)

### Camada 1 — Odontograma-índice
Reusa `Odontograma.tsx` + `ToothDetailPanel.tsx` (D3 da spec). **Zero CSS novo** — os componentes já
carregam os tokens e a a11y (faces por teclado, auditoria 19/07). O container só posiciona.

### Camada 2 — Card de registro §11 (`registro-card.tsx`, novo)
Espelha o card que o Mateus printou. Estrutura fixa:
- **Linha 1:** `<b>` tipo + âncora ("Restauração MOD · dente 36") · pill de estado (Realizado/Planejado)
- **Linha 2 (meta, `--color-text-secondary`):** "Realizado em `<data>`" · "Registrado em `<data>` (retroativo)" só quando `registrado_em > realizado_em` · autor + CRO
- **Linha 3:** "Assinatura do paciente: coletada ✓" quando assinada
- Pill: `Realizado` = fundo `--color-teal-pale` + texto `--color-teal-ink` + ponto `--color-teal`. `Planejado` = coral. (Nunca texto em cor cheia — §2.)
- Variante **agrupada** (`grupo_id`): título "Exodontia · dentes 31–41", colapsa N eventos num card.

### Camada 3 — Cards de especialidade (só quando há dado — I2)
- **Endo (A1) — tabela §4:** colunas Canal · Ponto de referência · Comprimento da raiz · CT · Lima final; números em DM Mono tabular, alinhados à direita; "CT" destacado com `--color-teal-ink`. Rodapé: técnica de obturação + cimento (`--color-text-secondary`).
- **Orto (A0) — chips §10:** cartão "Manutenção · `<data>` — arcada `<x>`" com linhas Arco / Ativação / Elástico corrente / Intermaxilar; botão "⟳ Igual à última". Chip = `--color-surface-alt` + borda `--color-border`.
- **Perio (A2) — periograma §8:** grade 6 sítios/dente; célula com número em mono; bolsa ≥4mm em `--color-coral-ink`; pontinhos BOP(`#e11d48`→token)/supuração(`--color-warning`)/placa; selo âmbar deriva. NIC calculado, nunca input.

## 5. Do's and Don'ts

**Do:**
- Todo valor de cor via `var(--color-*)`; testar light **e** dark (o produto tem os dois mapeados).
- Número clínico em `--font-mono` + `tabular-nums`, alinhado à direita na tabela.
- Texto sobre fundo tingido → sempre `-ink`.
- Card/tabela de especialidade **só monta quando há dado** (I2) — nada de tabela de endo vazia.
- Herdar o `ToothDetailPanel`; se precisar de comportamento novo, é sinal de que a camada 1 extrapolou o escopo A0.

**Don't:**
- ❌ Copiar hex do artefato pro código (o artefato tem `#2f9c85` literal; o código usa `--color-teal`).
- ❌ `--color-teal`/`--color-coral` cheios como **cor de texto** — reprova AA (o erro recorrente da casa).
- ❌ `bg-white`/`text-black`/gray hardcoded — quebra dark mode (CLAUDE.md).
- ❌ Inventar espaçamento/raio novo — herdar a densidade do `FichasTab` atual (composição aditiva, não redesenho do zero).
- ❌ Rodar `design-shotgun`/variantes — a direção está aprovada; o trabalho é fidelidade.

## 6. Dimensões resolvidas (todas herdadas — nenhuma escolhida do zero)

| Dimensão | Valor | Fonte |
|---|---|---|
| palette | tokens `globals.css` (= artefato) | herdada — produto |
| estilo | clínico premium, denso, tabular (o do artefato) | herdada — artefato aprovado |
| tipografia | DM Serif Display / Outfit / DM Mono | herdada — `layout.tsx` |
| layout | 3 camadas verticais sobre o form do Job A | spec A0 §2.6 |
| density | `balanced` (a do `FichasTab` atual) | herdada — composição aditiva |
| radius | herdado dos componentes atuais | herdada |
| motion | `subtle` — herda `ToothDetailPanel`/AnimatePresence do FichasTab | herdada |
| constraints | dark-mode obrigatório · a11y AA · zero cor hardcoded | CLAUDE.md |

---

**Gate de design (fim do Roadmap A, antes do push):** `design-review` sobre a ficha renderizada,
com o artefato ao lado como referência. Item nº1 do review: caça a texto em cor cheia (§2).
