# DESIGN.md — Componentes do Odontograma v3

_Gerado em 2026-07-18 (design-brief adaptado). Serve a `spec-modo-consulta-v3-odontograma.md` §9._

> **Escopo do brief:** este NÃO é um brief de marca. O design system do Odonto.IA já está
> fixado (tokens em `globals.css`, `DESIGN_PRINCIPLES.md`, `tailwind-shadcn`). Paleta, fonte
> e estilo são **herdados, não re-escolhidos**. O brief especifica a **semântica visual +
> interação** de 3 componentes de produto que a spec deixou em aberto ao nível do pixel.

> **✅ STATUS (18/07): APROVADO pelo Mateus — direção congelada, port pra React liberado.**
> Preview de referência: artifact `d5f66b1a-e93d-413d-9d53-5dc0ec75e252` (versão final:
> orientação de boca, 13 seções por especialidade, interação, endo com canal-silhueta).
> Revisões incorporadas no caminho: (1) dente anatômico real + oclusal contornado no lugar
> do quadrado geométrico; (2) orientação de boca (superiores coroa pra baixo); (3) canal
> endo = silhueta preenchida/vazia + raiz tingida (linha fina reprovada); (4) odontometria
> com UMA medida (comprimento da raiz, sem CAD/CRD). Observações dos dentistas do piloto,
> se vierem, entram como ajustes incrementais — não bloqueiam a implementação.

---

## 1. Herança do sistema (não re-decidir)

| Dimensão | Valor herdado | Fonte |
|---|---|---|
| **Estilo** | Premium / Swiss-minimal — princípios Linear · Notion · Attio · Vercel · Stripe | `DESIGN_PRINCIPLES.md` |
| **Paleta** | Tokens existentes: `--color-teal` (marca/feito), `--color-coral` (a fazer), `--color-slate` (pré-existente, §1.9), `--color-warning` (selo perio), superfícies `--color-surface`/`-alt`, `--color-border`, textos `--color-text-primary`/`-secondary`/`-muted` | `globals.css` |
| **Tipografia** | Sans do app para texto; **mono** (`ui-monospace`) para números de dente, mm e datas | `Odontograma.tsx` (números já em mono 11px) |
| **Densidade** | Balanced, tendendo a compacto no chart; **respiro generoso** nos painéis | `DESIGN_PRINCIPLES.md` |
| **Radius** | `default` 8px em cards/painéis; `rounded` 12px em overlays; SVG sem radius | app |
| **Motion** | **subtle** — transições 0.13–0.15s (fill/stroke/transform), sem bounce | `Odontograma.tsx` |
| **Dark mode** | Obrigatório, via tokens (nunca hex/`dark:` hardcoded) | invariante #6 |

**Regra-mãe (spec §9):** *"o dentista bate o olho e entende sem treinamento — organização
acima de densidade."* Todo trade-off deste brief resolve a favor de **clareza escaneável**,
não de mostrar tudo de uma vez.

### Orientação anatômica da arcada (decisão do Mateus, 18/07)

**Como numa boca:** superiores com a **raiz para cima e a coroa para baixo**; inferiores o
inverso. As faces oclusais se encontram no meio (plano oclusal), como numa boca fechada.

> ⚠️ **Afeta o `Odontograma.tsx` de PRODUÇÃO:** hoje o componente desenha o contrário —
> `upperCrownPath` põe a oclusal no topo e a raiz apontando para baixo, então **as raízes é
> que se encontram na linha média**. Ao portar a Fatia A, inverter a orientação das duas
> arcadas (flip vertical dos glyphs superiores ou troca upper↔lower paths — decidir na
> implementação, comportamento idêntico). Números dos dentes continuam do lado de fora
> (acima dos superiores, abaixo dos inferiores).

---

## 2. Cor semântica — a base dos 3 componentes

A cor é **derivada** (`corDoRegistro(status, origem)`), nunca persistida:

| Estado | Token | Reforço não-só-cor (a11y) | Frase |
|---|---|---|---|
| **A fazer** (`indicado`) | `--color-coral` | preenchimento sólido | "vou restaurar o 26" |
| **Feito aqui** (`realizado` + `clinica`) | `--color-teal` | preenchimento sólido | "restaurei o 14" |
| **Pré-existente** (`realizado` + `preexistente`) | `--color-slate` | **textura pontilhada** sobre o fill | "já tinha coroa no 26" |
| **Sem registro** | `--color-surface-alt` fill / `--color-border` stroke | — | ausência de evento |
| **Selo de bolsa perio** | `--color-warning` | anel no canto | vem do exame perio |

> **Invariante de acessibilidade:** slate (pré-existente) **sempre** carrega a textura
> pontilhada — nunca depende só do matiz para se distinguir do teal (Riscos §Parte 10).

---

## 3. Componente 1 — `ToothDetailPanel` (Fatia A)

Painel que abre ao tocar um dente na visão geral. É o coração visual da correção por toque.

### 3.1 Anatomia — dente REAL como figura, oclusal como editor de faces
**Revisado 18/07 (Mateus):** o painel usa o **dente anatômico real** (coroa + raiz, o mesmo
estilo/paths do `Odontograma.tsx`), não um quadrado geométrico. Layout de 2 figuras
coordenadas dentro de um card `--color-surface` radius 12px:

```
┌─ Dente 26 · 1º Molar ──────────────── [Pré-existente] ✕ ─┐
│                                                            │
│      ╱╲  dente ANATÔMICO        ┌───────────────┐          │
│     │  │  (coroa + 2 raízes,    │  V (vest.)    │          │   ← DIREITA: mapa OCLUSAL
│     │██│   estilo do            │ M │ ▒O▒ │ D   │          │     contornado (não quadrado)
│     ╱  ╲   Odontograma.tsx)     │  L (palatina) │          │     — as 5 faces clicáveis
│    │    │  ← canal/implante/    └───────────────┘          │
│    │pino│    pino/lesão na raiz                            │
│     ╲__╱   ← coroa tingida pelo estado dominante           │
│                                                            │
│  Coroa ·  Canal ·  Exodontia ·  Incluso  …  (ações dente)  │   ← ações a nível dente
└────────────────────────────────────────────────────────────┘
```

- **Figura principal (esquerda): dente anatômico** em visão vestibular — **reusa
  `upperCrownPath`/`lowerCrownPath`/`rootPath` do `Odontograma.tsx`** (não redesenha),
  ampliado (~110px). A coroa recebe o tint do estado dominante; a raiz carrega
  canal/implante/pino/lesão periapical (§3.4). É o que o dentista reconhece "do papel".
- **Editor de faces (direita): mapa oclusal contornado** — a única projeção onde as 5 faces
  aparecem juntas. Cada face é clicável (§3.5).
- **Por que duas figuras:** as 5 faces só se mapeiam de cima (oclusal); canal/raiz só se veem
  de lado (vestibular). Mostrar as duas é a convenção de software clínico — dente real +
  tabela oclusal, coordenados (tocar a face acende no dente e vice-versa).

### 3.2 Geometria do mapa oclusal (contornado, não quadrado)
Visão **oclusal** com **contorno anatômico por família** (`--color-border` outline), dividido
nas 5 faces por dentro. As zonas seguem a partição em cruz/diamante, mas **recortadas ao
contorno arredondado** do dente (via `clipPath`) — nunca um quadrado seco:

- **Contorno por família:** molar = quadrado arredondado com 4 lóbulos (cúspides); pré-molar
  = oval com 2 cúspides; anterior = cunha/triângulo arredondado (a face O vira "Incisal",
  uma borda fina). Fiel ao `TOOTH_FAMILY` já existente.
- **O (oclusal)** — região central, com **sulcos** leves desenhados (fóssa central do molar)
  — o detalhe que faz "parecer dente", não célula de planilha.
- **M/D/V/L** — bandas periféricas recortadas ao contorno; M sempre para a **linha média**
  (`mesialÉEsquerda(dente)` decide o espelhamento nos quadrantes 2/3 — constante, não hardcode).
- **Rótulo contextual** por `faceLabel(face, dente)`: V/L → "Vestibular"/"Palatina" (sup.) ou
  "Lingual" (inf.); O → "Incisal" em anteriores. Micro-caption `--color-text-muted`, aparece
  no hover/foco (não polui em repouso).
- **Técnica de implementação:** as 5 zonas são polígonos simples (partição confiável)
  renderizados com `clip-path` no contorno da família + sulcos por cima → orgânico e clicável
  ao mesmo tempo, sem tiling curvo frágil.

### 3.3 Render de estado por zona
- **fill** = cor semântica (§2) com opacidade sólida quando registrada; zona sem registro =
  `--color-surface-alt` com stroke `--color-border` 1px.
- **slate (pré-existente)** = fill slate + `<pattern>` de pontos (dot grid 2px, opacity 0.4)
  por cima — o reforço textural.
- **stroke** ativo/hover = cor semântica em 1.5–2px; repouso = `--color-border`.
- transição `fill/stroke 0.15s ease` (herdado).

### 3.4 Raiz — camada de dente inteiro
Reusa o `rootPath` anatômico do `Odontograma.tsx` (não reinventa a raiz), ampliado. Sobre ela:
- **Canal** (`endodontia`): linha vertical no eixo da raiz — **tracejada** (indicado) →
  **sólida** (tratado). Cor por status/origem.
- **Lesão periapical**: círculo **vazado** (só contorno) no ápice, coral.
- **Implante**: raiz substituída por ícone de parafuso (retângulos horizontais afunilando).
- **Pino/núcleo**: retângulo estreito vertical no terço coronal da raiz (convive com o canal).
- **Coroa total**: contorno **duplo** (+2px) na coroa inteira, distingue de restauração de face.

### 3.5 Interação
- **Toque numa zona** cicla: sem-registro → a-fazer (coral) → feito (teal) → **remove**.
  (origem `preexistente` entra só pelo modo exame_inicial ou pelo badge "reclassificar").
- **Toque na raiz** alterna o estado do canal (ou abre o mini-menu endo/implante/pino).
- Ações a nível **dente inteiro** (coroa, exodontia, incluso) ficam na barra inferior de chips.
- Cada mudança é **estado local** — só persiste no "Confirmar e salvar" (invariante #1).
- Foco visível (`focus-visible:ring-1 ring-teal`), navegável por teclado (a11y).

### 3.6 Dimensões
Card 320–360px largura · quadrado oclusal `S`≈168px · raiz ≈ 96px altura · gap 16px ·
chips de ação 28px altura. Mobile: card full-width, quadrado escala p/ `min(72vw, 220px)`.

---

## 4. Componente 2 — Confirmação remodelada + lista agrupada (Fatia A)

A tela de confirmação vira **2 colunas** (desktop; empilha no mobile):

- **Esquerda — textos** (igual hoje): queixa, anotações, conduta, observação. Não mexer.
- **Direita — visual:**
  1. **Odontograma pintado** (visão geral, o componente atual estendido com `eventos`).
  2. **Lista agrupada por dente/região** — substitui a lista plana atual.

### 4.1 Card de dente (a unidade da lista)
Um card compacto por dente, ordenado por quadrante (FDI). Anatomia:

```
┌ 26  1º Molar ───────────────────── ● ● ○ ┐   ← nº mono + nome + mini-dots de cor por evento
│ Restauração · O          coral  a fazer   │   ← 1 linha por evento: tipo · face/âncora · pílula de estado
│ Coroa total              slate  pré-exist. │
└────────────────────────────── tocar p/ editar ┘
```

- **Cabeçalho:** nº (mono, bold) + nome do dente + **mini-dots** resumindo as cores dos eventos.
- **Linhas de evento:** tipo (label) · âncora (face/dente) · **pílula de estado** colorida
  (coral/teal/slate) com o rótulo textual ao lado (reforço não-só-cor).
- **Densidade (o gate real):** com 20+ procedimentos, cards recolhem para **cabeçalho + N
  eventos**; regiões inteiras (sentinela 97/98/99) viram 1 card de arcada. Nunca um paredão.
- **Toque no card OU no dente** no odontograma → abre o `ToothDetailPanel` (§3). Fechar
  reflete a mudança na hora (estado local).

### 4.2 Orto e vazio
- Se `odontograma_eventos.length === 0 && orto_manutencao != null`: a coluna direita **não
  mostra odontograma vazio** — mostra um **card de manutenção** compacto (chips fio/ativação/
  corrente/intermaxilar). Evita "boca vazia inútil".
- Exame inicial: boca predominante **slate** (reforço de "histórico herdado, não trabalho de hoje").

---

## 5. Componente 3 — `PerioGrade` + `PerioReview` (Fatia C)

Grade de sondagem que toma a tela (overlay full-screen). Herda o layout FDI das 2 fileiras.

### 5.1 Célula
- **6 células por dente**, em 2 sub-linhas: vestibulares (MV·V·DV) em cima, linguais
  (DL·L·ML) embaixo — espelha como o dentista sonda (fora → dentro).
- Cada célula: **profundidade em mm** (número grande, mono, centralizado) + até 3
  **indicadores-ponto** no rodapé da célula: sangramento (vermelho), supuração (âmbar/warning),
  placa (amarelo claro). Pontos pequenos, alto contraste, com `title`/aria (não-só-cor).
- **Cursor ativo** (sítio sendo preenchido): anel teal + leve scale — o dentista/voz sabe onde está.
- **Bolsa ≥ 4mm**: número em coral/warning (escala de risco), não só cor de fundo.
- **Dente ausente**: as 6 células **colapsam** numa faixa `--color-surface-alt` "ausente".
- **Recessão + CAL** (opcional, por toque): linha fina abaixo da célula; CAL derivado exibido
  em `--color-text-muted` (menor, secundário — é derivado, não digitado).

### 5.2 Mobilidade/furca
Mini-resumo abaixo de cada dente (fora da grade de 6 pontos), preenchível por toque — 0–3.

### 5.3 Revisão obrigatória (`PerioReview`)
Tela cheia, **só leitura + editável por toque** (não por voz — modo lento e visual). Grade
inteira preenchida; célula incompleta destacada. Botão **"Concluir exame"** só habilita com
todos os dentes presentes completos (gate duplo client+servidor).

---

## 6. Motion (subtle — herdado)
- Abertura do `ToothDetailPanel`: fade + leve scale (0.96→1) em 150ms; sem bounce.
- Ciclo de estado da zona: cross-fade de fill 150ms.
- Auto-avanço do cursor perio: translate + fade 120ms (rápido, não distrai o ritmo).
- `prefers-reduced-motion`: sem scale/translate, só fade.

---

## 7. Do's & Don'ts

**Do:**
- Usar **exclusivamente** tokens (`var(--color-*)`); `color-mix` para tints, como o componente atual.
- Números (dente, mm, datas) em **mono** — consistência com o chart existente.
- Reforço não-só-cor **sempre**: textura no slate, pílula+texto no estado, pontos com aria no perio.
- Ordenar por FDI/quadrante — leitura clínica previsível.

**Don't:**
- ❌ Gradiente decorativo, sombra colorida gratuita, glow além do `drop-shadow` sutil já usado.
- ❌ 5 zonas como 5 retângulos iguais empilhados — tem que ser a **visão oclusal** reconhecível.
- ❌ Paredão de chips na lista densa (o anti-padrão que a Fatia C do Job A também combate).
- ❌ Depender de cor sozinha para status (daltonismo) — falha de a11y.
- ❌ Inventar 4ª cor para "pendência pré-existente" — `indicado` é sempre coral (spec §1.2).

---

## 8. Dimensões resolvidas
| Dimensão | Valor | Fonte |
|---|---|---|
| palette | tokens existentes (teal/coral/slate/warning) | herdado — sem nova paleta |
| estilo | premium/swiss-minimal | `DESIGN_PRINCIPLES.md` |
| tipografia | sans do app + mono p/ números | herdado |
| layout | painel (overlay) + 2 colunas na confirmação | spec §2.1/§4 |
| density | balanced (compacto no chart, respiro nos painéis) | herdado |
| radius | 8px cards / 12px overlays / 0 no SVG | herdado |
| motion | subtle (0.12–0.15s) | herdado |
| constraints | dark-mode obrigatório · desktop-primeiro (consultório) | spec §Assunções |
