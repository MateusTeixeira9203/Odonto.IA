# Spec #18 — Largura global (pós-sidebar)

> Criado 2026-07-05 (planejamento). Roadmap: item **#18** de `plans/roadmap/roadmap-polimento.md`.
> **Status: escopo definido; classificação a confirmar com o fundador.**
> Transversal — casa com o polish/F3 e com a ficha (spec-16 D12, já um caso de "ganhar coluna").

## 1. Problema

O sistema foi montado com sidebar (removida), mas os containers seguem em **`max-w-7xl` (~1280px)** e sobra tela nas laterais. Não há container de largura central: o `<main>` do `DashboardShell` é `w-full`, e **cada página se auto-limita** repetindo o wrapper `p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full` (~15 cópias). A sobra vem dessa repetição.

## 2. Decisões

| # | Decisão | Nota |
|---|---|---|
| L1 | **Teto conservador:** telas densas sobem 1280 → **~1536px** (`max-w-screen-2xl`, +1 coluna). Seguro em qualquer monitor | fundador, 2026-07-05 |
| L2 | **Leitura/formulário mantêm 1280px** (sem regressão) | "medida confortável" do roadmap |
| L3 | **Wrapper compartilhado**, não editar 15 strings soltas: `<PageContainer variant="wide \| comfortable">`. Um lugar controla largura + padding | o "bem-feito" vs "mecânico" |
| L4 | **Alargar exige plano de uso** (coluna/painel), nunca esticar vazio. Tela densa **ganha conteúdo** na largura extra, não ar | princípio do roadmap |

## 3. Mecânica

- Novo componente `PageContainer` (ex: `src/components/layout/page-container.tsx`):
  - `wide` → `max-w-screen-2xl` (~1536px)
  - `comfortable` → `max-w-7xl` (~1280px, default)
  - encapsula `p-4 sm:p-6 lg:p-8 mx-auto w-full` (o padding hoje repetido)
  - *(futura variante `narrow` ~768–896px para formulários puros — não agora)*
- Migrar cada página do `max-w-7xl` inline para `<PageContainer variant=…>`.

## 4. Classificação de telas *(a confirmar)*

| `wide` (densa — alarga + ganha coluna) | `comfortable` (leitura/form — mantém) |
|---|---|
| Perfil do paciente + abas | Novo / editar paciente (form) |
| Agenda (semana / mês) | Configurações |
| Dashboard | Perfil do dentista (form) |
| Listas: pacientes, orçamentos, financeiro | Onboarding |

- **Modo consulta:** tela própria (experiência à parte), fora deste ajuste.

## 5. Plano de uso por tela densa (o trabalho real — Fase B)

Alargar o container é o começo; cada densa precisa **aproveitar** a largura:

| Tela | Como usa os +256px |
|---|---|
| Perfil do paciente | dá respiro pra ficha 2 colunas (spec-16 D12) + abas mais largas |
| Agenda | mais slots/colunas de dia visíveis, menos scroll horizontal |
| Dashboard | mais cards por linha (ex: 3→4) |
| Listas / tabelas | **mostrar mais colunas de dados** (menos truncamento), não esticar as existentes |

## 6. Faseamento

- **Fase A (mecânica, baixo risco):** criar `PageContainer` + migrar páginas (wide/comfortable). Já entrega o alargamento das densas. `tsc`/`eslint` limpos.
- **Fase B (plano de uso, por tela):** dar a cada densa o layout de colunas (§5). Faseável tela a tela; a ficha (D12) já é a primeira.

## 7. Fora de escopo

- Redesign de qualquer tela — é ajuste de largura + colunas, não repaginação.
- Variante `narrow` para forms (refinamento futuro).
- Modo consulta e telas fullscreen próprias.

## 8. Gates de aceite

- [ ] Um `PageContainer` controla a largura; zero `max-w-7xl` solto nas páginas migradas.
- [ ] Telas densas ocupam ~1536px e **ganharam conteúdo** (coluna/cards/colunas de tabela), sem vácuo lateral.
- [ ] Leitura/formulário inalterados (1280px).
- [ ] Responsivo intacto (mobile/tablet sem regressão).
- [ ] `tsc` + `eslint` limpos.
