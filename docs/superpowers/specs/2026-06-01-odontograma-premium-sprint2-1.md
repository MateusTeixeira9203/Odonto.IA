# Spec — Sprint 2.1: Odontograma Premium

**Data:** 2026-06-01  
**Arquivo alvo:** `src/components/odontograma/Odontograma.tsx`  
**Escopo:** Puramente visual/UX — zero mudanças de lógica, props ou estados de negócio

---

## Objetivo

Transformar o odontograma de um "widget compacto" em uma ferramenta clínica protagonista. O dentista deve abrir a tela e imediatamente focar nos dentes — não nos filtros, não nos containers, não nos textos ao redor.

---

## Restrições Obrigatórias

- **0 mudanças de props** — interface `OdontogramaProps` permanece idêntica
- **0 novos estados clínicos** — manter `default | historical | shared | selected`
- **0 novos arquivos** — tudo em `Odontograma.tsx`
- **Não perseguir largura fixa** — escala visual sem quebrar notebooks ou layouts existentes
- Manter FDI numbering, quadrantes, lógica de filtros e tabs

---

## 1. Escala dos Dentes

### Fator de escala
Aplicar multiplicador **1.6x** sobre todos os valores de `DIMS`.

Isso resulta em:

| Classe     | w atual → novo | crownH atual → novo | rootH atual → novo |
|------------|---------------|---------------------|--------------------|
| central    | 22 → 35       | 30 → 48             | 22 → 35            |
| lateral    | 18 → 29       | 27 → 43             | 20 → 32            |
| canine     | 20 → 32       | 32 → 51             | 26 → 42            |
| premolar   | 23 → 37       | 28 → 45             | 21 → 34            |
| molar1     | 32 → 51       | 28 → 45             | 18 → 29            |
| molar2     | 30 → 48       | 26 → 42             | 17 → 27            |
| molar3     | 27 → 43       | 24 → 38             | 15 → 24            |
| dec_incisor| 15 → 24       | 20 → 32             | 15 → 24            |
| dec_canine | 16 → 26       | 22 → 35             | 17 → 27            |
| dec_molar  | 22 → 35       | 21 → 34             | 14 → 22            |

> Nota: valores finais arredondados para inteiros. O componente já tem `overflow-x-auto` — o layout existente é preservado.

### Gap entre dentes
`gap-[2px]` → `gap-[3px]` (proporcional ao novo tamanho, sem exagero)

---

## 2. Numeração

- Fonte: `8px` → **`10px`**
- Manter `font-mono bold`
- Espaço entre número e coroa (gap): `3px` → `5px`
- Transição de cor no hover já existente: mantida
- Cores por estado: mantidas

---

## 3. Labels de Quadrante

- Fonte: `8px` → **`9px`**
- `tracking-[0.18em]` → **`tracking-[0.22em]`**
- Margin bottom/top: `mb-1.5` / `mt-1.5` → **`mb-2` / `mt-2`**

---

## 4. Separador de Linha Média

- Altura: `1px` → **`2px`**
- Opacidade do gradiente: aumentar levemente para tornar a separação mais legível
- `my-[5px]` → **`my-[8px]`**

---

## 5. Estado Selected — Reforço Visual

Além da escala (manter `scale(1.04)` para ativo), adicionar:

### Crown
- Stroke width: `1.5px` → **`2px`**
- Adicionar `filter: drop-shadow(0 0 4px color-mix(in srgb, var(--color-teal) 45%, transparent))`

### Root
- Adicionar leve tint teal ao fill quando selected: `color-mix(in srgb, var(--color-teal) 18%, var(--color-surface-alt))`

### Número
- Peso: `700` → **`800`** (se disponível no sistema de fontes)

### Hover
- Scale: `1.12` → **`1.1`** (mais sutil com dentes maiores)

---

## 6. Estado Historical — Melhoria de Contraste

- Tint da crown: `14%` → **`20%`**
- Stroke opacity: `45%` → **`55%`**

---

## 7. Legenda — Popover Discreto

### Remoção
Remover completamente o bloco de legenda inline no rodapé do componente (as 3 divs com swatch + label).

### Adição
Adicionar botão **"Legenda"** no canto direito da tab bar, alinhado verticalmente com as tabs Permanentes/Decíduos.

```
[ Permanentes ][ Decíduos ]                    [ ≡ Legenda ]
```

- Componente: `Popover` + `PopoverTrigger` + `PopoverContent` do shadcn
- Botão: ícone `List` (lucide) + texto "Legenda", estilo secundário discreto
- `PopoverContent`: alinhado à direita (`align="end"`), largura `w-56`

### Conteúdo do popover

3 itens correspondentes aos estados atuais:

| Swatch | Nome | Descrição |
|--------|------|-----------|
| fill surface-alt, stroke border | Sem registro | Nenhum registro neste dente |
| fill teal/20, stroke teal/55 | Histórico | Dente com registros anteriores |
| fill teal, stroke teal + glow | Selecionado | Dente selecionado para esta consulta |

Swatch: `rect` SVG 10×10px com rx=2 — mesmos tokens visuais dos próprios dentes.

---

## 8. Filtros — Hierarquia Secundária

### Estilo ativo
- Base: `bg-surface-alt border-border` (mantido)
- Ativo: `bg-teal/10 border-teal/40 text-teal`

### Padding
- `px-2.5 py-1` → **`px-3 py-1.5`**

### Layout
- Filtros e botão Legenda ficam na mesma linha (tab bar + legenda à direita)
- Info bar (hover state) continua abaixo do chart
- Filtros ficam abaixo da info bar

---

## 9. Info Bar

- Fonte: `10px` mantida
- Manter placeholder "Clique para selecionar um dente" com itálico

---

## Critério de Sucesso

1. Ao abrir a tela, os dentes são o primeiro elemento visual dominante
2. Um dente selected é visualmente inconfundível — sem precisar ler a legenda
3. A legenda não ocupa espaço visual permanente
4. Os filtros não competem com o odontograma
5. Funciona sem scroll horizontal em viewport ≥ 900px
6. Dark mode e light mode sem regressão

---

## Arquivos Modificados

| Arquivo | Tipo |
|---------|------|
| `src/components/odontograma/Odontograma.tsx` | Modificação |
