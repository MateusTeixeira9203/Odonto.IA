# Spec — Sprint 2 Bloco 3: Ficha Clínica → Timeline Clínica

**Data:** 2026-05-30  
**Contexto:** Bloco 2 concluído (Perfil do Paciente como Workspace Clínico). Bloco 3 transforma a aba Ficha Clínica de uma coleção de registros em uma história clínica navegável.

---

## Problema

A Ficha Clínica exibe todos os registros completamente expandidos. Com 50+ evoluções a tela vira uma parede de conteúdo. A leitura exige esforço. O contexto temporal não é claro. O formulário parece um agrupamento solto de campos sem hierarquia clínica.

---

## Objetivo

O dentista deve sentir:
> "Estou navegando pela evolução clínica deste paciente."

E não:
> "Estou abrindo vários formulários antigos."

---

## Escopo

**In-scope:**
- Task 8: Timeline colapsável com estado expandido/colapsado por card
- Task 9: Reorganização visual do formulário em seções clínicas

**Out-of-scope:**
- Novos campos no banco de dados
- Novas regras de negócio
- Virtualização de lista (DOM standard é suficiente com collapse)
- Alterações em outras abas

---

## Task 8 — Timeline Colapsável

### Comportamento

| Estado | Regra |
|--------|-------|
| Mais recente | Expandido por padrão ao montar |
| Demais registros | Colapsados por padrão ao montar |
| Clique no header | Toggle expand/collapse |

### State management

```tsx
const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() =>
  new Set(evolutions[0] ? [evolutions[0].id] : [])
);

const toggleExpand = (id: string) =>
  setExpandedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
```

Quando um novo registro é salvo, adicionar seu ID ao `expandedIds`.

### Estado colapsado — prioridade de exibição

**Prioridade 1 — Tags clínicas** (quando existem `teethNotes` com notas)

Gerar uma tag por nota de dente com formato: `Procedimento · DXX`

Exemplos:
- `[Canal · D36]`
- `[Restauração · D25]`
- Para arcadas: `[Profilaxia · Sup.]`
- Para arcada completa: `[Limpeza · Geral]`

Limite: máximo 4 tags visíveis + `+N mais` se exceder.

**Prioridade 2 — Preview de texto** (fallback quando sem procedimentos estruturados)

Primeira linha da `observation`, truncada com `line-clamp-1`.

**Prioridade 3 — Fallback vazio**

Se não há observation nem teethNotes: mostrar só o cabeçalho (type + date + professional).

### Anatomia visual do card colapsado

```
┌────────────────────────────────────────────────────────────┐
│ ● [EVOLUÇÃO]  27/05/2026 às 14:30  ·  Dr. Silva      ▾   │
│   [Canal · D36]  [Restauração · D25]  +1 mais             │
└────────────────────────────────────────────────────────────┘
```

### Anatomia visual do card expandido

```
┌────────────────────────────────────────────────────────────┐
│ ● [EVOLUÇÃO]  27/05/2026 às 14:30  ·  Dr. Silva      ▲   │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│   Texto da observação clínica completo...                  │
│                                                            │
│   [teeth notes com checkboxes]                            │
│                                                            │
│   [Assinar]  [⋮ menu]                                     │
└────────────────────────────────────────────────────────────┘
```

### Transição

`AnimatePresence` + `motion.div` com `overflow: hidden` e `initial={{ height: 0 }} → animate={{ height: "auto" }}`. Consistente com o padrão atual do formulário.

O header (primeira linha com type + date + professional + chevron) é sempre visível e clicável.

### Escalabilidade

Com collapse, 300 registros renderizam apenas cabeçalhos (~1 linha DOM cada). O DOM de conteúdo só existe para os registros expandidos. Não é necessária virtualização.

---

## Task 9 — Formulário em Seções Clínicas

### Princípio

Nenhum campo novo. Nenhuma regra nova. Reorganização visual e renomeação de labels para vocabulário clínico.

### Mapeamento DB → Seção

| DB field | Seção visual |
|----------|-------------|
| `queixa_principal` (`formData.type`) | Queixa Principal |
| `anotacoes` (`formData.observation`) | Avaliação Clínica |
| `dentes_afetados` + `dentes_observacoes` | Procedimentos |
| `paciente_documentos` | Anexos |

### Estrutura de seções

#### Seção 1 — Queixa Principal

Contém o select de tipo de registro, com label renomeado de "Tipo de Registro" para "Queixa Principal / Tipo de Consulta".

Placeholder/helper: "Ex: Dor no elemento 36, Consulta de retorno, Urgência"

#### Seção 2 — Avaliação Clínica

A textarea atual de "Observações Gerais" renomeada para "Avaliação Clínica". O botão de gravação de voz permanece alinhado ao título da seção.

DEX indicator permanece abaixo da textarea.

#### Seção 3 — Procedimentos

Seção existente — apenas adiciona header de seção com a label "Procedimentos" de forma mais proeminente. Odontograma permanece na coluna direita.

#### Seção 4 — Anexos

Área de upload de arquivos, movida para uma seção explícita com label "Anexos". Upload de arquivos, lista de anexos enviados, botão de adicionar.

Posição: abaixo de Procedimentos, antes dos botões de ação.

### Layout final do formulário

```
[QUEIXA PRINCIPAL]
  select + label clínico

[AVALIAÇÃO CLÍNICA]         [Gravar Voz (IA)]
  textarea

[PROCEDIMENTOS]
  tooth notes                    | Odontograma
                                 | (coluna direita)

[ANEXOS]
  file upload + lista

[Cancelar]               [Salvar Evolução]
```

### Separadores visuais

Cada seção tem:
- Label `text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary`
- Separador `border-t border-border/40 pt-4` entre seções

---

## Diretrizes visuais

- Mesma linguagem de tokens do Dashboard, Tratamento e Perfil do Paciente
- Cards da timeline: `bg-surface rounded-2xl border border-border/60 shadow-sm`
- Cursor do header colapsado: `cursor-pointer`
- Chevron: `ChevronDown` → rotaciona 180° quando expandido
- Transição do chevron: `transition-transform duration-200`
- Tags clínicas colapsadas: `bg-surface-alt border border-border/50 rounded-full px-2 py-0.5 text-[10px] font-medium text-text-secondary`

---

## Critérios de aprovação

1. A Ficha Clínica parece uma história clínica — não uma coleção de registros
2. A leitura é mais rápida — o dentista escaneia sem abrir cada card
3. Com 300 evoluções a experiência continua boa
4. Existe menos competição visual entre Ficha Clínica e Tratamento
5. O formulário tem hierarquia clínica clara

---

## Arquivos afetados

- `src/components/pacientes/FichasTab.tsx` — único arquivo a modificar
