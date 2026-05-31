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

## Regras de Qualidade — Elevação 8/10 → 10/10

Estas regras determinam se a implementação atingiu o objetivo de transformar a Ficha Clínica em história clínica, e não apenas em um accordion bonito.

### Regra 1 — Escaneabilidade acima de tudo

O estado colapsado deve exibir obrigatoriamente:
- Tipo do registro (badge)
- Data e profissional
- Tags clínicas (procedimentos) ou fallback de texto

Teste: um dentista procurando "Canal D36" em 100 registros deve localizá-lo sem abrir nenhum card.

### Regra 2 — Hierarquia visual no estado colapsado

Prioridade visual decrescente no card colapsado:
1. Tipo do evento (badge)
2. Data
3. Tags clínicas

Bordas, ícones e containers não devem ter mais peso visual que o conteúdo.

### Regra 3 — Cada item expandido conta uma história

O card expandido responde "O que aconteceu?" — não "Quais campos foram preenchidos?".

Estrutura obrigatória no expandido:
- **Queixa Principal**: motivo da consulta
- **Avaliação Clínica**: achados, diagnóstico, evolução
- **Procedimentos**: o que foi realizado / indicado
- **Anexos**: evidências clínicas (quando existirem)

### Regra 4 — Sem parede de texto

Card expandido usa subtítulos de seção, separadores e espaçamento consistente. Nenhum bloco de texto sem contexto visual.

### Regra 5 — Diferenciação visual entre tipos de evento

Visualmente distinguível sem ler o conteúdo:
- Badge de tipo diferente para cada categoria (Avaliação / Evolução / Retorno / Urgência / Procedimento)
- Ícone discreto por tipo (opcional, via `lucide-react`)
- Sem cores agressivas — seguir Design System (teal, coral, amber, surface-alt)

Mapeamento sugerido:
| Tipo | Badge | Ícone |
|------|-------|-------|
| Avaliação | teal/10 text-teal | `Stethoscope` |
| Evolução | surface-alt text-text-secondary | `FileText` |
| Retorno | blue/10 text-blue | `RotateCcw` |
| Urgência | coral/10 text-coral | `AlertCircle` |
| Procedimento | emerald/10 text-emerald | `Zap` |

### Regra 6 — Ficha Clínica não compete com Tratamento

Ficha Clínica: "O que aconteceu?"  
Tratamento: "O que precisa ser feito?"

Qualquer elemento que pareça planejamento ou execução futura pertence ao módulo Tratamento. A Ficha é documentação e histórico.

### Regra 7 — Performance percebida

- Expansão/colapso: instantânea, sem jank
- `overflow: hidden` + `height: 0 → auto` via `motion` — sem reflow de layout
- O fato de 300 itens estarem no DOM não deve ser perceptível (apenas headers renderizados)

---

## Teste de aceitação final

Antes de considerar concluído, responder afirmativamente a todos:

| # | Cenário | Critério |
|---|---------|----------|
| 1 | Timeline com 100 registros | Localizo "Canal · D36" sem abrir nenhum card |
| 2 | Último atendimento | Entendo o que aconteceu em < 5 segundos |
| 3 | Impressão geral | Parece prontuário clínico moderno, não lista de accordions |
| 4 | Separação de módulos | Ficha Clínica claramente separada do Tratamento |
| 5 | Sensação do dentista | Sente que está navegando pela evolução clínica |

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
