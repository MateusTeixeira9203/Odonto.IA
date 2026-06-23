# Redesign do Prontuário — Ficha Única (Tratamento embutido)

**Data:** 2026-06-15
**Objetivo:** Simplificar drasticamente a área do paciente para o dentista leigo (feedback real: "complicado mexer"). Fundir Ficha Clínica + Tratamento num documento único (1 ficha = 1 tratamento), eliminar abas e cliques intermediários, e fazer o Modo Consulta nascer no mesmo formato da ficha.

Princípio-guia (Krug): *não me faça pensar.* Menos abas, menos escolhas, ação principal óbvia, zero "⋮".

---

## Decisões fechadas (discussão de 2026-06-15)

- **1 ficha = 1 tratamento.** O dentista adiciona procedimentos (por dente, vários por dente), nunca cria outra ficha dentro do tratamento. 80–90% dos dentistas usam assim.
- **A ficha absorve o tratamento** (não o contrário): a ficha vira o documento rico; odontograma + procedimentos por dente viram seções dela.
- **Procedimentos amarrados ao dente**, marcáveis como realizado. O dado já existe: `dentes_observacoes` (dente → "proc1\nproc2", cada linha marcável) + `procedimentos_concluidos`.
- **Abas 6 → 4:** Prontuário · Agenda · Orçamentos · Arquivos. Somem: Resumo, Tratamento, Ficha Clínica.
- **Prontuário** = lista cronológica de fichas (mais recente no topo; em andamento com destaque âmbar; clica → abre a ficha).
- **Ficha lê de cima pra baixo:** quem/quando → queixa → odontograma → procedimentos por dente → anotações → **assinatura só no rodapé**.
- **Ações diretas** (Editar/Imprimir no topo); **fim dos menus "⋮"**.
- **Modo Consulta** (confirmar evolução) passa a espelhar o layout da ficha — mesmo formato em que nasce e em que é lida.
- **Trial 7 → 14 dias** (corrigir duração + copy; o doc de estratégia já diz 14).

---

## Estado atual (verificado)

- Abas hoje: Resumo · Tratamento · Ficha Clínica · Agenda · Orçamentos · Arquivos (`paciente-detail-client.tsx:962`).
- `FichasTab.tsx` (~1400 linhas): lista de evoluções, editor por dente, assinatura, PDF, menu "⋮" (Editar/Imprimir/Excluir em `~1368`).
- `PlanejamentoTab.tsx` (~1800 linhas): Mapa (odontograma `Odontograma` + `Q_LABELS` quadrantes), planejamento, ApresentarPanel.
- Tabela `tratamentos` + `fichas.tratamento_id` (FK, 1 tratamento : N fichas hoje). `tratamento-actions.ts` tem criar/adicionar/encerrar.
- Modo Consulta: `EvolucaoFormatada` (`/api/dex/formatar-evolucao/route.ts`) tem `dentes_observacoes` (por dente, já markable) + `procedimentos` (lista solta, redundante).
- Trial: `planos/actions.ts:42` → `setDate(getDate() + 7)`. Copy "7 dias" em `page.tsx`, `cadastro-form.tsx`, `planos-client.tsx`.

---

## Abordagem de dados (sem migração destrutiva)

- **Procedimentos por dente:** fonte da verdade = `dentes_observacoes` (já existe) + `procedimentos_concluidos` (já existe). A lista solta `procedimentos` vira **derivada** (gerada a partir do por-dente) — mantida por compatibilidade, não editada direto na UI.
- **1:1 ficha:tratamento:** a UI **para de agrupar** várias fichas num tratamento. Cada ficha é autônoma; status "em andamento/concluída" vem do próprio `procedimentos_concluidos` (todos feitos = concluída). A tabela `tratamentos` **não é dropada** agora (evita migração arriscada) — só deixa de ser usada para agrupar; a feature "adicionar fichas ao tratamento" é removida da UI.
- **Sem migração de schema nova** além do trial. Mudança é de UI + de qual campo é a fonte da verdade.

---

## Fases (ordem de execução)

### Fase 0 — Trial 7 → 14 dias *(isolada, segura)*
- `src/app/planos/actions.ts:42`: `+ 7` → `+ 14`.
- Copy `7 dias` → `14 dias`: `src/app/page.tsx` (linhas ~39, 41, 51, 53, 672), `src/app/(auth)/cadastro/_components/cadastro-form.tsx:118`, `src/app/planos/_components/planos-client.tsx` (~189, 247).
- **NÃO mexer** em `onboarding-emails.ts:90` ("termina em 7 dias" = D7 de um trial de 14 = faltam 7 dias, agora correto).
- Verificação: `npx tsc --noEmit` limpo nesses arquivos.

### Fase 1 — Abas 6 → 4
- `paciente-detail-client.tsx:962-980`: remover entradas `resumo`, `tratamento`, `ficha-clinica`; adicionar `prontuario` (label "Prontuário"). Resultado: Prontuário · Agenda · Orçamentos · Arquivos.
- `activeTab` default → `'prontuario'`.
- Remover o `TabsContent value="resumo"` inteiro (Atividade + Financeiro + Histórico). **Realocar a timeline (Histórico)** — opção: mover para um rodapé recolhível no Prontuário OU descartar (decidir na execução; o Atividade/Financeiro são redundantes e saem).
- Verificação: abrir paciente → 4 abas, default Prontuário.

### Fase 2 — Lista do Prontuário → **FUNDIDA na Fase 3**
Decisão (2026-06-15): a lista vive no mesmo `FichasTab` que a Fase 3 reescreve — feita junto pra evitar retrabalho.
- **Já existe hoje:** timeline cronológica + status âmbar "X/Y realizados" / verde "✓ Concluído".
- **Falta (entra na Fase 3):** achatar o agrupamento por tratamento (modelo 1:1, hoje separa "fichas avulsas"); card **clicável** (⋮→Abrir, hoje obrigatório usar o ⋮ pra editar — dor do usuário); **"Iniciar consulta"** no topo (requer ação nova: criar atendimento sem agendamento prévio).

### Fase 3 — Área clínica unificada: lista (Prontuário) + ficha única *(grande, inclui a Fase 2)*

**Parte A — Lista (Prontuário):** achatar o agrupamento por tratamento (lista cronológica plana, mais recente no topo); card **clicável → abre a ficha** (⋮ guarda só Imprimir/Excluir); destaque âmbar em andamento (já existe); **[Iniciar consulta]** no topo (ação nova: cria atendimento ad-hoc → `/consulta/[novo]`); renomear a aba para **"Prontuário"**.

**Parte B — Ficha única (documento):** a ficha aberta vira o documento unificado, lendo de cima pra baixo:
1. **Cabeçalho:** paciente · data · profissional · status. Ações: **Editar · Apresentar · Imprimir** (topo). Sem "⋮".
   - **Apresentar:** reusar o `ApresentarPanel` (já é controlado por `open`/`onClose`). Trabalho real = repontar a fonte dos slides: em vez das `sections` do planejamento, montar a apresentação a partir dos dados da própria ficha (procedimentos por dente + odontograma + valores). Fecha o ciclo de conversão: Apresentar → paciente vê o plano → assina.
2. **Queixa principal.**
3. **Odontograma** (reusar `Odontograma` + `Q_LABELS` do PlanejamentoTab): clica no dente → painel do dente.
4. **Procedimentos por dente:** no painel do dente, adicionar vários procedimentos; cada um marcável **realizado ↔ pendente** (`procedimentos_concluidos`). Odontograma reflete feito/pendente.
5. **Anotações e conduta** + retorno sugerido.
6. **Assinatura no rodapé** (reusar `ConsultaAssinaturaModal` + `assinado_em`). Só aqui, nunca no topo.
- **Remover o menu "⋮"** (`FichasTab ~1368`): "Editar" e "Imprimir" viram ações diretas do topo; "Excluir" vira ação secundária (ícone discreto ou dentro de Editar).
- Migrar a UI de procedimentos da lista solta para o por-dente (`dentes_observacoes` como fonte).
- Aposentar `PlanejamentoTab`/`ApresentarPanel` como aba (o que sobrar de planejamento/apresentação é decidido aqui — provável: a "apresentação ao paciente" vira a impressão/visualização da própria ficha).

### Fase 4 — Modo Consulta espelha a ficha + hub pós-consulta
- A tela "Confirmar evolução" (`consulta-client.tsx`) passa a ter a **mesma estrutura** da ficha (queixa → odontograma → procedimentos por dente → anotações).
- Consolidar a saída do DEX no por-dente; `procedimentos` (solta) deixa de ser o foco da UI.
- O que o dentista confirma ali é idêntico ao que vira a ficha no Prontuário.
- **Hub pós-consulta:** a tela "salvo" (hoje countdown de 5s) vira o **hub de decisão**: "Ficha salva ✓ — e agora?" com **"Apresentar ao paciente"** como botão hero (teal cheio) + "Concluir" secundário. Sem auto-redirect; só redireciona no "Concluir".

### Fase 5 — Modo Apresentação first-class + ensino na demo
- **Fluxo de trabalho confirmado:** Modo Consulta → Organizar com DEX → Confirmar → Salvar → **hub** → Apresentar ao paciente → Modo Apresentação (slides auto-gerados da ficha) → **Aceitar e assinar** (o fecho/aceite) → Prontuário. Quem pula a apresentação assina no hub (opcional).
- **Assinatura é o fecho** (após apresentar = aceite), nunca antes.
- **Modo Apresentação = par do Modo Consulta** (captura ↔ conversão). Não é aba; é experiência full-screen lançada da ficha/hub.
- **Ensino:** estender a demo guiada (`DexGuide` + `/consulta/demo`) — depois que a demo monta a ficha e cai no hub, o DEX continua: "agora a melhor parte" → abre a **apresentação demo** → "assina" demo. Dentista aprende captura + conversão numa tacada.

---

## Fase 3 — execução incremental (cada passo: checkpoint `tsc` + teste manual)

Descoberta na leitura: `FichasTab` tem o card **duplicado em ~3 renderizações** (`fichasAvulsas`, `fichasDoTratamentoAtivo`, histórico) por causa do subsistema de episódios de tratamento (modais iniciar/adicionar/encerrar + estados `tratamentoAtivo`, `historicoTratamentos`, etc.). Por isso a ordem é: achatar antes de mexer no card.

**Parte A — Lista (Prontuário):**
1. **Achatar:** remover o subsistema de episódios de tratamento → uma lista cronológica plana, **uma** renderização de card. Remove modais/estados de tratamento. *(grande, alto cuidado)*
2. **Card clicável:** `onClick → handleEdit(evo)` no card único; `e.stopPropagation()` nos botões internos (Assinar, ⋮); ⋮ guarda só Imprimir/Excluir.
3. **Renomear aba** `ficha-clinica` → `prontuario` (label "Prontuário") em `paciente-detail-client.tsx`.
4. **"Iniciar consulta"** no topo (ação nova: atendimento ad-hoc → `/consulta`).

**Parte B — Ficha documento (painel editor):**
5. Reestruturar o painel pra ordem: quem/quando → queixa → odontograma → procedimentos por dente (marcável) → anotações → **assinatura no rodapé**.
6. Fold do `Odontograma` + quadrantes do `PlanejamentoTab` no painel.
7. **Apresentar** elevado no cabeçalho + reusar `ApresentarPanel` apontando pros dados da ficha.

**Parte C — Limpeza:**
8. Remover `TabsContent` órfãos (`resumo`, `tratamento`) e aposentar `PlanejamentoTab` como aba.
9. **Verificação final:** assinatura, PDF, criar/editar ficha, marcar procedimento, odontograma — tudo OK.

## Riscos & cuidados

- **Legal/prontuário:** cada ficha continua datada, assinável e imprimível (preservar `assinado_em` + PDF `/api/fichas/[id]/pdf`). Não quebrar isso.
- **Fases 3 e 4 são refactors grandes** de arquivos de ~1400–1800 linhas. Executar com checkpoints de `tsc` e testes manuais frequentes.
- **`tratamentos` não é dropada** — só desuso na UI. Decidir remoção do schema só depois, com dados em mãos.
- **Multi-visita (10–20%)** perde o acompanhamento "um tratamento ao longo de meses". Aceito pela decisão 1:1.

## Pós-redesign (lembrete)
- Revisar **design do Modo Consulta** (pedido explícito do usuário) — ver memória `project_modo_consulta_design`.
