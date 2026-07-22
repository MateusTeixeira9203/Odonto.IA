# R-13 — Agenda: a janela que mente, o dentista invisível e o clique que falta

> **SPEC** · **R-13** · 🔵 ativo · **Modelo:** Sonnet (execução; direção visual já decidida)
> **Aberto:** 2026-07-22 · **Fechado:** — · **Fase:** aprovada
> **Aprovada por:** Mateus, 2026-07-22 · artefato `R-13-agenda.html` aprovado junto

## 1. Problema

Três defeitos na mesma tela, achados em 22/07 investigando "na secretária não aparece nada".

**1. A janela de busca mente.** O servidor busca **um mês por vez** — `page.tsx:64` filtra
`data_hora` entre início e fim do mês da URL. Mas a visão padrão é a **semanal**, e a navegação
dela é estado local puro: `selectedWeek` nasce em `new Date()` (`agendamentos-client.tsx:294`) e
a seta só chama `setSelectedWeek` (`:1053`). Quem refaz a busca é `goToMonth`, chamado **apenas**
pelas setas da visão de Mês (`:1075-1076`) e pelo banner de fora-da-janela (`:992`).
**A seta de semana nunca recarrega.** Dois modos de falha:

- Avança as semanas até cruzar o fim do mês → grade **vazia**, sem aviso. Os dados nunca vieram.
- Vai pra agosto no Mês, volta pra Semana → o `key={mesAtual}` (`page.tsx:140`) remonta o
  componente, `selectedWeek` **reseta pra hoje** enquanto os dados carregados são de agosto.
  Grade vazia de novo, agora pelo motivo inverso.

Confirmado em produção: a Portaria criou 60 agendamentos desde 21/07 — **14 caem em agosto** e a
agenda de julho nunca os devolve. Não é RLS: a sessão dela, simulada no banco, enxerga 171
agendamentos, 6 dentistas e 160 pacientes. Não é crash: zero erro de runtime na rota em 48h.

**2. O dentista é invisível.** No filtro "Todos", os agendamentos de 4 dentistas caem na **mesma
coluna**, repartidos por `calcularFaixas` só por sobreposição de horário. Na visão de **Semana o
nome do dentista não aparece em lugar nenhum**. Na de Dia aparece como linha minúscula, e só se
`height > 70` (`day-view.tsx:287`). A recepção não tem como saber de quem é a consulta sem clicar,
nem onde um dentista específico tem buraco.

**3. Não dá pra clicar no horário.** Marcar às 14h de quinta exige abrir o drawer e digitar data e
hora na mão — com a grade da quinta-feira às 14h visível na tela.

## 2. Escopo

**Cobre:**
- A URL passa a ser a fonte única da janela visível; o servidor busca o que a visão pede.
- Cor fixa por dentista, a mesma no Dia e na Semana.
- Visão de Dia com **uma coluna por dentista** (secretária, filtro "Todos").
- Clique no vazio da grade abre o agendamento com dia, hora — e dentista, quando a coluna diz qual.

**Não cobre:**
- Arrastar para remarcar (drag-and-drop). Nova sessão, se pedido.
- Redimensionar o card pra mudar duração.
- Horários de atendimento por dentista (`horarios_disponiveis` existe e a grade ignora) — a grade
  segue 07h–20h fixa pra todo mundo. Vira item próprio se incomodar no dogfooding.
- Qualquer mudança em RLS, schema ou migration. **Este item não tem migration.**
- Dashboard da secretária (bug do fuso em `dashboard/page.tsx:26-29`) → **R-14**, separado.

## 3. Como funciona

### 3.1 A janela

Hoje a URL carrega `?mes=YYYY-MM` e o cliente navega por semana/dia sem contar pra ninguém. Passa
a carregar **âncora + visão**, e toda navegação escreve na URL:

```
/dashboard/agendamentos?v=semana&d=2026-08-05
```

O servidor deriva a janela da visão — não existe mais "o mês" como unidade. Navegar uma seta é um
round-trip com `startTransition` (a tela atual fica no ar enquanto carrega), igual ao que as setas
de Mês já fazem hoje e o usuário aceita.

**Trade-off assumido:** cada clique de seta vai ao servidor. A alternativa (buscar uma janela
folgada e só recarregar ao sair dela) é mais rápida e mais cara de manter — e exige controle de
range que hoje não existe em lugar nenhum. Fica pra quando o dogfooding provar que incomoda.

### 3.2 Cor por dentista

O card tem **um** fundo e duas coisas querem ele: hoje a cor é o **status**
(`STATUS_CONFIG[].timeline`), e o status é informação de trabalho da recepção. Não se tira.

**Resolução: status fica no preenchimento, dentista vai pra borda esquerda.** Faixa vertical de
4px na aresta esquerda do card = dentista. Fundo e texto = status. Os dois canais convivem.

A cor é atribuída por **posição do dentista ordenado por `created_at`** na clínica — não por nome
(renomear ou entrar alguém no meio do alfabeto embaralharia tudo) e não por hash do `id` (com 8
slots e 8 dentistas, colisão é quase certa). Entrando um dentista novo, ele pega o próximo slot e
**ninguém muda de cor**.

### 3.3 Coluna por dentista

Só na visão de **Dia**, e só quando faz sentido: secretária, filtro em "Todos", mais de um
dentista. Nos outros casos a coluna é uma só — exatamente o comportamento de hoje.

`calcularFaixas` continua valendo **dentro** da coluna de cada dentista: mesmo dentista com dois
horários sobrepostos segue repartindo lado a lado. O algoritmo não muda.

### 3.4 A Semana tem dois estados — e "Todos" não desenha consulta

**Corrigido em 22/07, depois do print do Mateus.** A primeira versão punha os 4 dentistas na mesma
coluna de dia, separados só pela cor. Não funciona, e a razão é aritmética: **a coluna de um dia
tem ~104px; 4 dentistas viram 4 faixas de 26px**, e nome de paciente não cabe em 26px. Com
`calcularFaixas` correto o texto para de se atropelar, mas vira sliver ilegível — no máximo
**2 faixas** por dia são legíveis. A conta não fecha, então o modelo muda:

| chip | o que a Semana mostra | pergunta que responde |
|---|---|---|
| **Todos** | **mapa de carga** — uma linha por dentista, 7 colunas de dia, barra + contagem. **Zero card, zero horário.** | "quem está lotado, em que dia?" |
| **um dentista** | grade cheia, card de largura inteira | "que horário está livre?" |

**Clique numa célula do mapa de carga → troca a Semana pra grade cheia daquele dentista**, na
mesma semana, com a coluna do dia clicado destacada. Não expande no lugar e **não** sai pro Dia.

O motivo é o telefone: a recepção quase nunca tem um dia só na mão. Ela precisa oferecer *"quinta
às 14h, ou sexta às 9h"* — mantendo a semana à vista ela responde as duas sem clicar de novo. Sair
pro Dia obrigaria a voltar ao mapa a cada alternativa. Expandir a linha resolveria a espiada, mas
lista não tem vazio clicável: pra **marcar**, a grade é obrigatória.

Trocar o chip limpa o destaque. Célula com 0 consultas não é clicável.

`calcularFaixas` continua valendo na grade de um dentista — o mesmo dentista pode ter dois
horários sobrepostos, e aí sim duas faixas cabem.

### 3.5 Clique na grade

Clique em espaço vazio → abre o drawer já preenchido com data e hora do ponto clicado, arredondado
pra baixo em blocos de **15 min**. Na visão de Dia por coluna, a coluna clicada **pré-seleciona o
dentista** — é o ganho real: some o passo em que a recepção escolhe o profissional errado.

## 4. Assunções

- Fuso da clínica é BRT fixo (`CLINIC_TZ_OFFSET`, `date-helpers.ts:16`). A janela do servidor passa
  a ser construída com offset explícito — hoje `startOfMonth(...).toISOString()` roda no fuso do
  **servidor**, que na Vercel é UTC, e as bordas do mês andam 3h. Mesmo defeito do `feb4b68`.
- A grade 07h–20h cobre a Clindent. Consulta fora disso hoje não é desenhada por ninguém.
- 8 dentistas é o teto prático de colunas legíveis. Acima disso a grade rola na horizontal.
- O `?novo=1` continua funcionando como hoje (o dashboard linka pra ele).

## 5. Contrato técnico

### 5.1 URL e janela (servidor)

```ts
// src/app/dashboard/agendamentos/page.tsx
type VisaoAgenda = 'dia' | 'semana' | 'mes';

interface PageProps {
  searchParams: Promise<{
    v?: string;    // VisaoAgenda — default 'semana'
    d?: string;    // 'yyyy-MM-dd' — default: hoje no fuso da clínica
    novo?: string; // inalterado
  }>;
}

/** Janela [de, ate) em ISO com offset BRT explícito. Nunca usa o fuso do servidor. */
export function janelaDaVisao(visao: VisaoAgenda, ancora: string): { de: string; ate: string };
```

Regra por visão, com a âncora sempre no fuso da clínica:

| `v` | de | ate |
|---|---|---|
| `dia` | âncora 00:00 | âncora +1 dia 00:00 |
| `semana` | domingo da semana 00:00 | +7 dias 00:00 |
| `mes` | dia 1 00:00 | 1º do mês seguinte 00:00 |

`?mes=YYYY-MM` **deixa de existir**. Não há link externo pra ele fora do próprio componente
(conferido: `goToMonth` e o banner são os únicos emissores).

### 5.2 Cor do dentista

```ts
// src/app/dashboard/agendamentos/_components/cor-dentista.ts
export interface DentistaAgenda {
  id: string;
  nome: string;
  /** Índice do slot de cor — posição por created_at na clínica. */
  slot: number;
}

/** Faixa esquerda do card. Determinística, estável sob entrada de dentista novo. */
export function corDoDentista(slot: number): string;
```

`page.tsx` passa a ordenar `dentistasClinica` por `created_at` (hoje é por `nome`) e a mandar o
`slot` junto. A ordem de **exibição** dos chips de filtro continua alfabética — ordem de leitura e
ordem de cor são coisas diferentes.

**Paleta — fechada no artefato, contraste medido em 22/07.** Piso: 3:1 (WCAG 1.4.11, elemento
gráfico não-textual), contra `--color-surface` nos dois temas (`#ffffff` / `#111112`).

| slot | cor | hex | vs. claro | vs. escuro |
|---|---|---|---|---|
| 0 | azul | `#2563eb` | 5.17:1 | 3.65:1 |
| 1 | laranja | `#c2410c` | 5.18:1 | 3.64:1 |
| 2 | verde | `#15803d` | 5.02:1 | 3.76:1 |
| 3 | fúcsia | `#c026d3` | 4.71:1 | 4.01:1 |
| 4 | ciano | `#0e7490` | 5.36:1 | 3.52:1 |
| 5 | lima | `#4d7c0f` | 4.99:1 | 3.78:1 |
| 6 | rosa | `#db2777` | 4.60:1 | 4.11:1 |
| 7 | índigo | `#6366f1` | 4.47:1 | 4.22:1 |

**A ordem dos slots é parte do contrato**, não estética: os 4 primeiros são os mais distantes
entre si em matiz, porque quase toda clínica para em 4 dentistas. Os pares mais próximos
(azul/índigo, fúcsia/rosa) ficam nos extremos da ordem e só coexistem numa clínica com 8.

`#4338ca` foi o índigo original e **reprovou** — 2.39:1 no escuro. Não voltar a ele.

### 5.3 Props que mudam

```ts
// week-view.tsx
interface WeekViewProps {
  // ... existentes
  /** Mapa dentistaId → slot de cor. Vazio = sem faixa (dentista vendo a própria agenda). */
  slotPorDentista: Record<string, number>;
  /**
   * 'todos' → renderiza o mapa de carga (§3.4), NUNCA cards.
   * dentistaId → grade cheia daquele dentista.
   */
  filtroDentistaId: string;
  dentistas: DentistaAgenda[];
  /** Só existe na grade de um dentista — no mapa de carga não há slot. */
  onSlotVazioClick: (data: Date, hora: string) => void;
  /**
   * Célula do mapa de carga → troca `filtroDentistaId` pra esse dentista e destaca o dia.
   * Não navega de rota: a Semana continua sendo a Semana. Célula com 0 consultas não chama.
   */
  onCargaClick: (dentistaId: string, dia: Date) => void;
}

// day-view.tsx
interface DayViewProps {
  // ... existentes
  slotPorDentista: Record<string, number>;
  /** Colunas a renderizar. Length <= 1 → comportamento atual, coluna única. */
  colunas: DentistaAgenda[];
  /** `dentistaId` vem preenchido quando o clique caiu numa coluna de dentista. */
  onSlotVazioClick: (data: Date, hora: string, dentistaId?: string) => void;
}
```

### 5.4 Abertura do drawer com valores

```ts
// agendamentos-client.tsx — substitui abrirNovoAgendamento()
function abrirNovoAgendamento(pre?: {
  data?: string;        // 'yyyy-MM-dd'
  hora?: string;        // 'HH:mm'
  dentistaId?: string;
}): void;
```

Sem argumento, comportamento idêntico ao de hoje (data = hoje, hora = 09:00, dentista =
`dentistaPadraoForm()`). O atalho `N` continua chamando sem argumento.

## 6. Trava de segurança — o que NÃO muda

Apresentação e navegação mudam. O resto não.

- **`criarAgendamento` e `criarEncaixe`**: assinatura, `dentistaAlvo`, e a exigência de
  `dentistaId` explícito pra secretária (correção de 14/07 — sem ela o registro nasce preso ao
  perfil de quem criou). Intocados.
- **Checagem de conflito**: dentista com override (`forcarConflitoDentista`), paciente **sem**
  override, RPC `paciente_tem_conflito_agenda` falhando fechado. Intocado.
- **RLS, schema, migration**: nada. Este item não toca o banco.
- **`buildClinicDatetime`**: todo horário nascido de clique passa por ele. Nenhuma data montada na
  mão em lugar nenhum.
- **Vocabulário de status** e `STATUS_CONFIG`: inalterados. A cor de status continua sendo a cor
  de status.
- **`calcularFaixas`**: nem o algoritmo nem a assinatura. Passa a ser aplicado por coluna.

## 7. Referência visual

`plans/artefatos/R-13-agenda.html` — gerado 22/07, **aguardando aprovação visual**.

Cobre as três visões (Dia com colunas, Semana com faixa de cor, Mês com carga por dentista), com
alternância claro/escuro e alternância secretária/dentista. Tokens copiados de `globals.css`
(44–83 claro, 121–131 escuro) e de `status-config.ts` — nada de cor inventada fora da paleta
acima, que está medida na própria página.

Pacientes no artefato são **fictícios**; horários e nomes de dentista espelham a densidade real da
Clindent em 22/07 só pra a grade não mentir sobre lotação.

Fatia 0 **não depende** do artefato — não tem pixel novo.

## 8. Fatias e gates

Cada fatia commita sozinha.

### Fatia 0 — A janela (o bug)

Sem UI nova. Sai primeiro e sozinha porque é o que está sangrando em produção.

- **G1** — Visão Semana, clicar ">" atravessando 31/07: os agendamentos de agosto aparecem.
  Hoje a grade fica vazia.
- **G2** — Ir pra agosto na visão Mês, trocar pra Semana: mostra uma semana **de agosto** com os
  dados dela. Hoje mostra a semana de hoje, vazia.
- **G3** — Recarregar a página em `?v=semana&d=2026-08-05` cai na mesma tela. A URL é a verdade.

### Fatia 1 — Cor por dentista

- **G4** — Com filtro "Todos", cada card tem faixa esquerda colorida; dois dentistas nunca têm a
  mesma cor. Vale no Dia **e** na Semana.
- **G5** — O preenchimento do card continua sendo o status: confirmar uma consulta muda o fundo e
  **não** muda a faixa.

### Fatia 2 — Coluna por dentista (Dia) e os dois estados da Semana

- **G6** — Secretária, visão Dia, filtro "Todos": uma coluna por dentista ativo, com nome no
  cabeçalho. Filtrando num dentista, volta pra coluna única.
- **G7** — Dentista logado (não secretária) vê Dia e Semana **exatamente** como hoje.
- **G8** — Semana com "Todos": mapa de carga, **zero card de consulta na tela**. Clicar na célula
  Renato/quinta troca pra grade cheia do Renato **na mesma semana**, com a coluna de quinta
  destacada; trocar o chip depois limpa o destaque. Célula vazia não responde ao clique.
- **G9** — Semana com um dentista: nenhum par de cards se sobrepõe, e o card mais estreito
  comporta hora + primeiro nome. **Medido no artefato: 154px** (o modelo antigo dava 26px).

### Fatia 3 — Clique na grade

- **G10** — Clicar no vazio às 14h de quinta abre o drawer com 14:00 e a data da quinta.
- **G11** — Na visão Dia por coluna, clicar na coluna do Armando pré-seleciona o Armando no campo
  Dentista. Clicar num card existente continua abrindo o detalhe, não o drawer.

## 9. Como isso é verificado

Localhost, **logado como secretária** — typecheck e build não pegam nada disso (`ESTADO.md`,
seção 🟡). A conta `qa-teste-secretaria@odontoia-test.local` existe na clínica QA TESTE.
G1–G3 precisam de dados nos dois lados de uma virada de mês; a clínica QA precisa de seed ou os
gates rodam contra a Clindent **em leitura, sem clicar em nada que grave**.
