# Estado — Odonto.IA

> **ESTADO** · atualizado 2026-07-22 · sessão de investigação → planejamento
> **Item ativo:** R-13 · **Modo da última sessão:** planejamento

## Agora

**R-13 — Agenda: janela de busca, multi-dentista e clique na grade.**
Spec: `plans/specs/R-13-agenda-janela-multidentista.md` · fase `contrato`, **aguardando aprovação**.

Três defeitos na mesma tela. **A janela de busca mente** — o servidor busca por mês, a visão
semanal navega em estado local e nunca recarrega; a recepção da Clindent tem 14 agendamentos em
agosto que a agenda de julho não devolve. **O dentista é invisível** — no filtro "Todos" quatro
dentistas caem na mesma coluna, e na visão de Semana o nome não aparece em lugar nenhum. **Não dá
pra clicar no horário** — marcar às 14h de quinta exige digitar data e hora com a grade da quinta
às 14h na tela.

**Feito**

- [x] Causa dos três achada, com arquivo e linha, escrita na spec.
- [x] RLS descartada com prova: sessão da Portaria simulada no banco enxerga 171 agendamentos,
      6 dentistas, 160 pacientes. Zero erro de runtime na rota em 48h.
- [x] Direção do multi-dentista decidida: **coluna por dentista no Dia + cor fixa nas duas visões**.
- [x] Conflito de canal resolvido no contrato: status fica no preenchimento, dentista na borda.
- [x] **Artefato das 3 visões pronto** (`plans/artefatos/R-13-agenda.html`), claro e escuro, com
      paleta de 8 slots medida em tela — 0 reprovações no piso de 3:1. O índigo original
      (`#4338ca`) reprovou no escuro (2.39:1) e foi trocado por `#6366f1`.

**Observado na tela em 22/07 (print do Mateus, registrado em texto):**
Na visão de **Semana com "Todos"**, os cards se atropelam — texto sobre texto, card sem nome
visível, bloco de 13:00 e 13:30 no mesmo retângulo. Duas causas somadas:

1. **Erro do artefato:** ele não aplicou `calcularFaixas` na Semana (todo card com
   `left:4px;right:4px`). A produção aplica desde o `c4ff7bb` — o artefato ficou pior que o app.
2. **Erro do modelo, e este é o que importa:** mesmo com as faixas certas, 4 dentistas numa
   coluna de ~104px dão 4 faixas de ~26px. Nome de paciente não cabe em 26px. **A Semana com
   "Todos" não é utilizável, com ou sem o conserto.**

Confirma o risco que já estava na spec: a cor resolve "de quem é" e não resolve "onde tem buraco".

**Resolvido no mesmo dia.** A Semana ganhou **dois estados** (spec §3.4): "Todos" virou **mapa de
carga** (linha por dentista × 7 dias, barra e contagem, zero card) e o chip num dentista abre a
**grade cheia**. Artefato refeito com o `calcularFaixas` real portado; verificado por geometria:
**0 sobreposições** no Dia e na Semana, menor card da Semana **154px** (era 26px).

**Falta**

Spec **aprovada** em 22/07, com o artefato. Execução por fatias, cada uma commitando sozinha.

- [ ] **Fatia 0 — a janela.** Sem UI nova. Sai primeiro e sozinha: é o que está quebrando na cara
      da recepção hoje. URL vira `?v=dia|semana|mes&d=yyyy-MM-dd`, `?mes=` morre, janela montada
      com offset BRT explícito (não com o fuso do servidor).
      - **G1** Semana atravessando 31/07 mostra agosto · **G2** Mês→Semana em agosto cai em agosto
      - **G3** recarregar em `?v=semana&d=2026-08-05` cai na mesma tela
- [ ] **Fatia 1 — cor por dentista.** Faixa de 4px na borda esquerda; status continua no
      preenchimento. Paleta de 8 slots por `created_at`, hexes na spec §5.2.
      - **G4** cores distintas nas duas visões · **G5** confirmar consulta muda o fundo, não a faixa
- [ ] **Fatia 2 — coluna por dentista (Dia) + os dois estados da Semana.**
      - **G6** Dia/"Todos" = coluna por dentista; filtrado = coluna única
      - **G7** dentista logado vê Dia e Semana idênticos a hoje
      - **G8** Semana/"Todos" = mapa de carga, zero card; clique abre a semana do dentista com o
        dia destacado; célula vazia inerte
      - **G9** Semana de um dentista: zero sobreposição, card mínimo comporta hora + nome
- [ ] **Fatia 3 — clique na grade.**
      - **G10** clique no vazio preenche dia e hora · **G11** coluna do Armando pré-seleciona
        Armando; clique em card existente continua abrindo o detalhe

## Travado

Nada travado.

## No ar sem verificação 🟡

Subiram em `c4ff7bb..b318e0f`. Typecheck e build passam; **nenhum foi exercitado com login**.

- 🟡 **Agenda recarrega ao abrir o modal** (`d62a5b4`) — a hipótese é que o aviso de conflito
  fantasma vinha da lista local, que só recarregava no `focus` da janela. **Confirmar com a
  recepção:** se o aviso âmbar ainda aparecer sobre um horário claramente livre, a hipótese caiu.
- 🟡 **Card "A receber" removido** do painel da secretária (`b318e0f`) — confirmar que sumiu e
  que o grid ficou com 3 colunas.

A saudação do dashboard (`feb4b68`) está ✅ — provada por simulação do dia inteiro.

## Esperando você

- [ ] **Aprovar a spec do R-01** — pronta desde 21/07, voltou pra fila em 22/07 sem perder nada.
- [ ] **Perguntar pra Portaria:** o mapa de carga mostra o dia inteiro num número só — não
      distingue "4 consultas espalhadas" de "4 grudadas de manhã com a tarde vazia". Se ela
      precisar dessa granularidade, a barra vira por turno (manhã/tarde). Fora do escopo até ela
      dizer que faz falta.
- [ ] **Resíduo de dado na Clindent:** 1 agendamento de 14/07 com `dentista_id` = Portaria (a
      secretária) em vez de um dentista. Sobra do bug já corrigido — os 60 que ela criou desde
      21/07 foram todos pro dentista certo. Corrigir a linha na mão é escrita em produção: só
      com seu ok.
- [ ] **Chips do formulário de agendamento** — o pedido era "tirar os chips de horário
      predefinido", mas o campo de hora já é livre (`input type="time"`). Os únicos chips são de
      **duração** (9 opções fixas). São esses, ou é outra tela?
- [ ] **Material de base de cada especialidade** — insumo pra R-05 a R-08. Sem ele, é chute.
- [ ] **Organizar os commits.** ~100 arquivos sem commit desde o reset do `plans/` em 21/07,
      agora mais a spec do R-13. Rode `/commit`.

## Próximo da fila

`R-01` (ficha, spec pronta) e `R-14` (fuso do dashboard da secretária, achado hoje, peso P).
Fila completa e ordem em `plans/ROADMAP.md`.
