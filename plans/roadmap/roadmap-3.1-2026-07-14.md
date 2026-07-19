# Roadmap 3.1 — Núcleo clínico compartilhado

**Criado** 14/07 · **Atualizado** 18/07 (099 aplicada + Spec 1/Fatia A deployadas) · Supersede `roadmap-3-fases-2026-07.md`

> **Este arquivo é o MAPA.** Ele diz o que vem, em que ordem, e onde está o detalhe.
> O detalhe mora nas specs em `plans/specs/` — se está lá, aqui é só um ponteiro.

---

# ▶ AGORA

### Onde estamos — **099 no ar, Spec 1 + Fatia A deployadas (18/07)**
A tranca abriu. Migration 099 **aplicada em prod e verificada** (dry-run 66/66 · funções, colunas, backfill 0 órfãos, policies, invariante #10 = 0 · advisor sem regressão nova). Código commitado (`b80edf6`) e **deployado** (Vercel `READY` em dentia.app.br · sem erro de runtime).

| Frente | Estado |
|---|---|
| **Spec 1 — núcleo clínico** | ✅ **099 aplicada + código no ar** (`b80edf6`). Leitura clínica aberta, escrita travada no autor, conflito de paciente por RPC. `tornarPrincipal` blindado (valida autoria das 2 pontas → nunca 2 principais). |
| **Spec 3 · Fatia A — marcar retorno** | ✅ **deployada junto**: rename do modal, `retorno_sugerido` da IA e botão morto extintos, indicador fora-da-janela na agenda. |

> ### ✅ Gate comportamental (passo 4) — RODADO ao vivo 18/07
> QA sênior com os 3 logins reais (clínica QA `odontoia-test.local`, assistente dirigindo via
> Claude-in-Chrome, Mateus batendo as senhas). **PASS:** S2 (B vê a ficha de A "somente leitura",
> sem editar/excluir) · S4 (espelho: A vê a de B como leitura) · S5 (secretária vê as duas) · S7
> (indicador fora-da-janela — light+dark, contraste OK, link navega, dado real confirmado). Deferidos,
> bem suportados por código+harness: S1 write path, S3 status de proc, S6 conflito de agenda.
> **1 bug achado e já corrigido:** o botão `Assinar` aparecia pro não-autor (outro dentista + secretária)
> e o handler não checava `.select()` → falso "Assinatura salva" + PNG órfão no storage. Fix `f7f4b4e`
> (gate com `podeEditarFicha` + `.select()` que remove o órfão e falha alto).

### O próximo passo — nesta ordem
| | Passo | Se falhar |
|---|---|---|
| 1 | **Aplicar 100–103 na sequência** (Job A `data_atendimento` · v3 101–102 · **103 notificações destinatário-pessoa** — SQL na spec do painel §3, +2 asserções no harness). Aditivas; o código que as usa vem depois, por frente | qualquer uma falhar: para, investiga — nada de "segue o baile" |
| 2 | **Só então** escrever a Fatia B do protético (spec final) | — |

> ✅ **Limpeza feita:** os dados de teste do passo 4 (paciente + 2 fichas + 1 agendamento) foram apagados. A clínica QA `odontoia-test.local` + as 3 contas seguem de pé (reusáveis; débito de limpeza na seção Dívidas).

> ### ✅ A tranca "código não sobe sem a migration" — resolvida
> Era o motivo de 099 + código subirem juntos. Subiram juntos (18/07). A janela de código-antigo +
> RLS-nova — que barrava criar documento/tratamento/seção de planejamento porque o código antigo
> não setava `dentista_id` — **fechou** no instante do deploy.

---

# 📋 A FILA

| # | O quê | Status | Detalhe em |
|---|---|---|---|
| **1** | **Spec 1 — Núcleo clínico compartilhado** | ✅ **aplicada + deployada 18/07** (`b80edf6`) · **gate comportamental PASS** (S2/S4/S5/S7 ao vivo) · bug do "Assinar" achado e corrigido (`f7f4b4e`) | [`2026-07-16-hierarquia-3.1-nucleo-clinico-spec.md`](../specs/2026-07-16-hierarquia-3.1-nucleo-clinico-spec.md) |
| **2** | **Spec 3 · Fatia A — Marcar retorno** — renomeia o modal, mata o botão morto da ficha, tira a sugestão da IA e mitiga o agendamento que some | ✅ **deployada 18/07** junto com a 099 · **aparência confirmada** (light+dark) no passo 4 | [`2026-07-16-protetico-marcar-retorno-spec.md`](../specs/2026-07-16-protetico-marcar-retorno-spec.md) §4 |
| **3** | **Odontograma v3** — event-log + boca pintada + fiscalização + perio + **Endo (Fatia D, 18/07)**. Fatias A→B→C→**D**, **"trabalho só com isso"** | 🟢 **EM EXECUÇÃO (18/07).** Fatia A **backend pronto** (migration **101 `odontograma_eventos` aplicada** · Motor A emite eventos+orto · `detectar-consulta` c/ status · types · eval 8 casos · token slate) — typecheck/lint limpos. **UI em VALIDAÇÃO DE CAMPO:** catálogo anatômico + tabelas Endo/Perio foram pros dentistas do piloto (preview artifact 18/07). **Componentes React pausados** até as obs. **Fatia D (Endo odontometria)** = escopo novo decidido 18/07 (espelha perio) | [`spec-modo-consulta-v3-odontograma.md`](../specs/spec-modo-consulta-v3-odontograma.md) · [`DESIGN-odontograma-v3.md`](../specs/DESIGN-odontograma-v3.md) |
| **4** | **Job A — ficha rápida no perfil** — campo mágico no form existente + voz completa (extração da consulta) + anexo de arquivo (áudio/pdf/docx) + `data_atendimento` retroativa (migration 100) + estado denso (Fatia C) | 🟡 **spec APROVADA 16/07** (escopo + design) · executa **depois do v3** — a extração sai da state machine já refatorada e a Fatia C reusa o `tooth-group-list` | [`2026-07-16-job-a-ficha-rapida-spec.md`](../specs/2026-07-16-job-a-ficha-rapida-spec.md) |
| **5** | **Transcrição tratada** — relato da consulta tratado por IA → `fichas.transcricao` (coluna virgem, zero migration) · aberta pra clínica · fail-soft no save | 🟡 **spec APROVADA 16/07** · pós-v3, **não simultânea com Job A** (mesmos arquivos) | [`2026-07-16-transcricao-tratada-spec.md`](../specs/2026-07-16-transcricao-tratada-spec.md) |
| **6** | **Spec 3 · Fatia B — Protético** — papel, ordem de trabalho, tela, notificação | 🔴 spec final **pós-099 em prod** (mantida) · decisões novas 16/07: vê **primeiro nome + trabalho + prazo** · **depende do painel (#7)** pro keystone | mesma spec, §5 + painel §6 |
| **7** | **Painel do Dex** — o canal consertado: destinatário-pessoa · sino no mobile · lida por item · RLS 103 | 🟢 **spec APROVADA 16/07** · causa dos 0/48 **diagnosticada e provada** (3 camadas) · painel do Dex (temporal · 3 famílias · mobile) · fonte "sem retorno 30/60" (híbrida, dono 2 linhas) · **Fatia 0 = migration 103 no SÁBADO** · Fatias 1–2 em qualquer janela pós-gate (arquivos disjuntos) | [`2026-07-16-painel-dex-notificacoes-spec.md`](../specs/2026-07-16-painel-dex-notificacoes-spec.md) |
| **8** | **Job B — cockpit do tratamento = O NOVO MODO CONSULTA** (reframe do Mateus 16/07) — mapa de tratamento central + radiografia/docs lado a lado + captura compacta + delta · derivado sem container · substitui PendenciasTab · fonte híbrida · perfil ganha o mesmo cockpit (Fatia 2) | 🟢 **spec estrutural APROVADA 16/07 ("spec 100%")** · **contratos §8 congelam pós-v3 A/B** (regra de retomada escrita) · executa depois de v3 → Job A → transcrição | [`2026-07-16-job-b-cockpit-tratamento-spec.md`](../specs/2026-07-16-job-b-cockpit-tratamento-spec.md) |
| **9** | **Correção completa Financeiro / Orçamentos** — 5 lugares quebrados pelo embed ambíguo de `dentistas` (⚠️ **tela Orçamentos vazia em PROD ~2 meses**, PDF 404, timeline sem eventos) · recebível fantasma → **status de pagamento por trigger + Situação única** (fecha o "redesenho de status" do backlog) · receita ignora recusado · `registrarRecebimento` blindado · dedup de pacientes + trava | 🟢 **spec escrita 17/07** (QA ao vivo em prod) · ⚠️ **Frente 1 é prod-down e NÃO depende da 099 — pode subir já** · migrações de dados sob confirmação | [`2026-07-17-financeiro-correcao-completa-spec.md`](../specs/2026-07-17-financeiro-correcao-completa-spec.md) |
| ❌ | ~~Spec 2 — Ficha compartilhada / co-autoria~~ | **MORTA** — event-log entrega co-autoria de graça; não havia feature | §Notas |

---

# ⏳ ESPERANDO VOCÊ

**Nada.** Todas as pendências de decisão foram respondidas em 16/07. 🎉

> **Billing:** o Mateus **já decidiu o modelo** e vai informar *"quando estiver 100%"* (16/07).
> **Não perguntar de novo** — quando ele trouxer, reorganizar o backlog de pagamento (§Backlog).

### ✅ Respondidas em 16/07
| O quê | Resposta | Aplicado |
|---|---|---|
| Editar o `CLAUDE.md` c/ a convenção `plans/concluidos/` | **Sim** | ✅ feito — e aproveitei pra registrar "roadmap é mapa, spec é conteúdo" |
| Arquivar as specs da fase 1? | **Sim** | ✅ as 5 (`spec-fase1-1..5`) foram pra `concluidos/`. O link do odontograma v3 (que "estende" a fase1-5) foi corrigido pro novo caminho |
| Protético: seat pago ou grátis? | **Grátis** — *"não é cobrado, mesma lógica da secretária"* | ✅ na Spec 3 §3 |
| Quer a transcrição tratada? | **Sim** — *"seria um acréscimo muito grande pro sistema"* | ✅ saiu de "congelado" pra fila #6 |
| Botão de atraso: data nova ou só sinaliza? | **Só sinaliza** | ✅ na Spec 3 — `nova_data_prevista` removida do schema, do tipo e da action |
| Billing | **Já decidido** — informa quando estiver 100% | ⏳ aguarda ele trazer |

> ⚠️ **`perguntas-clinica-piloto-odontograma-2026-07-13.md` NÃO foi arquivada** — você falou "as
> specs da fase 1" e ela não é uma delas. Ela é a **validação de campo pós-Fatia A/C do odontograma
> v3**, que está congelado (não concluído): arquivar seria enterrar uma pendência viva. Se quiser
> que vá junto, é só falar.

---

# 📐 A REGRA — núcleo clínico

> ## Registro clínico é da CLÍNICA (todo dentista lê).
> ## Trabalho é do AUTOR (só ele escreve).
> ## Dinheiro e agenda continuam PRIVADOS.

**O caso que dirige tudo (sua fala, 16/07):** X atende o José, identifica que precisa de canal,
chama Y. Y abre a ficha, **vê o que X fez**, faz a própria anamnese e adiciona os próprios
procedimentos. *"Ele não mexe no meu, eu não mexo no dele. Eu só vejo."*

| ABRE pra clínica | CONTINUA privado |
|---|---|
| `fichas` · `pacientes` · `planejamento_procedimentos` · `planejamento_secoes` · `paciente_documentos` · `tratamentos` | `orcamentos` · `orcamento_itens` · `pagamentos` · `agendamentos` · `procedimentos` · `horarios_disponiveis` |

### As 5 regras que saíram disso — não reabrir
1. **Uma ficha = um dentista.** A timeline é o histórico. Nunca "ficha com seções de vários" — a
   assinatura de X passaria a cobrir o trabalho de Y.
2. **O tratamento é o caso do paciente, compartilhado.** Quem criou só controla o container.
3. **O dente tem UM estado clínico**, não um por dentista. Aceita N procedimentos de N dentistas.
4. **O sistema não gerencia dependência** entre procedimentos. Mostra; o dentista decide.
5. **`pacientes.dentista_id` é etiqueta** ("quem cadastrou"), sem poder de acesso.

---

# 🗂 BACKLOG — depois da fila

> **Pagamento (status 14/07):** as clínicas de hoje são **testadoras, de graça por decisão** — Pix
> pro Mateus só pra custear infra. Trial infinito é **intencional**. Billing **não é urgente**.

- **Registro de pagamento pela secretária** — próximo pedido esperado. **Não auditado:** a RLS de
  `pagamentos` (`is_own_finance_record`) parece mais permissiva que a de `orcamentos` era.
  > 17/07: QA confirmou que a RLS de `pagamentos` usa `is_own_clinical_record` (secretária vê tudo, split por dentista bate). Auditoria financeira virou fila #9.
- [x] **Redesenho de status do orçamento** — a discussão de 13/07 **virou spec 17/07** (Frente 2 da fila #9): status de pagamento por trigger + Situação única (ciclo × pagamento). Detalhe na spec.
- **Alertas de vencimento** — **é a fonte "recebimentos" do painel do Dex** (fila #4). Base pronta.
- **Recorrência — manutenção mensal:** 1 motor (≠ assinatura do SaaS). Spec própria.
- **WhatsApp** (destravado pelo CNPJ): credenciais Meta, 4 stubs do `meta.ts`, cron de lembretes.
- **Retenção:** régua D1/D3/D7/D14/D30; relatório do DEX; onboarding repensado.
- **Apresentação:** present mode fullscreen, fechar `apresentar→aceitar→agendar`.
- **Endurecimento:** CI mínimo; Sentry; bump `next` 16.x; `supabase gen types` (mata 59 casts);
  god-components (`orcamentos-client` 2k linhas); limpar contas de teste em prod.

---

# ✅ FEITO — não re-trabalhar

| Quando | O quê |
|---|---|
| **18/07** | **Spec 1 (núcleo clínico) + Fatia A — APLICADAS, DEPLOYADAS e VERIFICADAS.** Migration 099 em prod (dry-run 66/66 → aplicada → verificada: funções/colunas/backfill/policies/inv#10/advisor). Commit `b80edf6` + push + Vercel `READY`. Fix do `tornarPrincipal` (nunca 2 principais) entrou antes do deploy. **Gate comportamental (passo 4) rodado ao vivo:** S2/S4/S5/S7 PASS (silo de leitura/escrita simétrico + indicador fora-da-janela light/dark). QA achou 1 bug — botão "Assinar" visível pro não-autor com falso sucesso + PNG órfão — **corrigido e deployado** (`f7f4b4e`). |
| **16/07** | **Spec 3 · Fatia A executada** (A1–A4) — modal `marcar-retorno-modal.tsx`, toast com data + link pro mês, botão morto e `retorno_sugerido` extintos. Typecheck/lint/build limpos, greps do §7 zerados. **Não aplicado, não commitado, não testado em sessão real** |
| **16/07** | Spec 1 **aprovada** + Spec 3 **escrita**. Migration 099, harness e código prontos — **nada aplicado** |
| **15/07** | Secretária cria orçamento + procedimento — `ca1b4a4`, **em prod** (migration 098) |
| **14/07** | Bugs secretária/agenda (`7b79a90`) · parcelamento (`cf8b836`, migration 097) — **em prod** · reorg do `plans/` |
| **Julho** | Ficha #16 · Largura #18 · Cluster orçamento · Workstreams K/L · Spec-9 perf · IA (5 rotas Groq + Gemini 2.5) · Silo 3 camadas (089–096) |
| **085/086** | Multi-especialidade — **já aplicadas** (o roadmap listava como pendente; confirmado 16/07) |

---

# 📝 NOTAS — decisões de 16/07 que não têm spec ainda

<details>
<summary><b>Painel do Dex</b> (fila #4) — já existe pela metade, e tem um problema antes de crescer</summary>

**Decisão:** é **spec própria**, não parte da Spec 3. A atribuição de ficha é só **1 das 4 fontes**.

**Já existe:** tabela `notificacoes` (**106 linhas em prod**) com `tipo`/`titulo`/`mensagem`/`href`/
`lida`/`para_dentista_id` · `notification-bell.tsx` · `/api/dex/alerts` · `lib/notificacoes.ts`.
A UI já tem ícone pra `follow_up` — tipo previsto, nunca gerado.

**⚠️ O problema (passo 1 da spec):**

| Destinatário | Notificações | Lidas |
|---|---|---|
| Secretária | 58 | 17 |
| **Dentista** | **48** | **0** |

Zero de 48. **Não é "ele ignora" — é sinal de que não chega.** Adicionar uma 4ª fonte a um canal
invisível dá 4 coisas invisíveis. Descobrir a causa vem antes de desenhar.

**Furo de silo (herdado):** a RLS filtra `para_role` e **ignora `para_dentista_id`** — o dentista B
vê a notificação do A.

**As 4 fontes:** mudança de agenda ✅ já funciona · follow-up 🟡 coluna+ícone existem, 0 pendentes ·
recebimentos 🟡 é o "alertas de vencimento" (**0 pagamentos com vencimento — o parcelamento de
14/07 nunca foi usado**) · atribuição de ficha 🔴 nova (vem da Spec 3).
</details>

<details>
<summary><b>Transcrição tratada</b> (fila #6) — ✅ confirmada 16/07 · 1 decisão de arquitetura pendente</summary>

**Confirmada:** *"acredito que seria um acréscimo muito grande pro sistema"* (Mateus, 16/07).

Hoje a transcrição **some 100%** — 0 de 13 fichas do modo consulta a guardaram, e
`fichas.transcricao` existe no schema desde sempre **sem nunca ter sido preenchida uma vez**. O
áudio idem: `audio_url` zerado em 33/33, apesar do bucket `audios` existir com policies prontas.
Decisão: **não salvar bruta, passar por tratamento**.

**A decisão que a spec dela NÃO pode tomar por acidente:** se virar coluna de `fichas`, ela herda
"aberto pra clínica" **de graça** — RLS filtra linha, não coluna. Pra ser privada do autor, tem que
nascer em tabela separada. **E separar duas coisas que se confundem:** a **transcrição tratada da
consulta** (documento clínico → pode ir pra ficha) do **rascunho de planejamento do dentista** (como
ele pensou o caso → anotação privada dele).
</details>

<details>
<summary><b>Por que a Spec 2 morreu</b> — e por que a unificação do protético morreu junto</summary>

O roadmap original (14/07) recomendava a **Leitura B** (silo-padrão + compartilhamento explícito),
apoiada em uma visita e uma frase. Em 16/07, depois de **dias** observando fluxo, você desenhou uma
terceira — nem A nem B, e mais simples que as duas.

**A razão técnica que fechou o caso:** num event-log a co-autoria é **propriedade, não feature**.
Cada dentista só anexa; o estado do dente é o evento mais recente; o registro de quem veio antes
fica intacto. A Spec 2 queria construir com código o que a arquitetura já dava.

**A unificação "encaminhar pro colega = mandar pro protético"** (que o roadmap chamava de "a melhor
sacada da sessão") morreu pelo mesmo motivo: com a Spec 1, o colega **já lê a ficha e já cria a
dele**. Encaminhar virou conversa, não operação. Sobrou só o protético.
</details>

<details>
<summary><b>Achados da auditoria de 16/07</b> — três coisas que este roadmap afirmava e eram falsas</summary>

1. **O silo "A vê ZERO de B" já era falso.** As policies de `storage.objects` (`fichas`,
   `radiografias`, `audios`) filtram por `clinica_id`, **nunca por dentista** — o Dr. Y sempre pôde
   ler o áudio e a radiografia do Dr. X. **O harness 63/63 nunca testou storage.** E `tratamentos`
   já era aberto **e editável por qualquer dentista**. A 099 fecha a escrita.
2. **Migrations 085/086 já estavam aplicadas** — listadas aqui como pendentes.
3. **Tabelas mortas:** `planejamentos` (0 linhas), `planejamento_etapas` (0),
   `planejamento_procedimentos` (22 legadas, **não é mais escrita** — o planejamento deriva de
   `fichas.dentes_observacoes`), `tratamentos` (1 linha, **0 fichas vinculadas**).

**Dado real de prod (16/07):** 72 pacientes / 3 clínicas / 7 dentistas (≈24 por clínica → **filtro
"meus/todos" não é urgente**) · 33 fichas (20 manuais, 13 modo consulta) · **0 com transcrição, 0
com áudio** · 4 assinadas · `fichas.procedimentos` é `text[]` com o status **dentro da string**
(`"Confecção de prótese - planejado"`) — **não existe a entidade "procedimento"**.
</details>

<details>
<summary><b>Bug de classe nova que a leitura aberta cria</b> — ler antes de escrever tela sobre RLS</summary>

**UPDATE barrado por RLS não retorna erro no Supabase** — devolve sucesso com 0 linhas. Com update
otimista, a tela afirma o que o banco negou, até o refresh.

Corrigido em `FichasTab.updateProcStatus` e `usePlanejamentoPaciente.saveSectionToDb` (usam
`.select()` e revertem). É a **invariante #9** da Spec 1. Ao escrever tela nova sobre tabela com RLS
por autoria, procurar esse padrão **primeiro**. Esconder o controle na UI é necessário mas **não
suficiente** — a RLS é a fronteira real.
</details>

---

# 🐛 DÍVIDAS

**De 16/07**
- [x] ✅ **A RPC `paciente_tem_conflito_agenda` falhava ABERTO** — **corrigido 16/07.** Os 3 call
      sites (`agendamentos/actions.ts`) desestruturavam só `data` e descartavam o `error`: se a RPC
      falhasse, `pacienteOcupado` virava `null`, o `=== true` dava false e **o agendamento nascia sem
      checagem, em silêncio**. Agora **falha fechado**: captura o `error` e recusa a operação.
      No `criarEncaixe` isso vale dobrado — aquele fluxo **tem** override (`forcarEncaixe`), e o
      conflito de paciente é justo o que ele não pode furar; a checagem sumir em silêncio faria do
      encaixe a porta dos fundos.
- [x] ✅ **A Fatia A mitigava o agendamento invisível, não consertava** — **corrigido 16/07** com um
      indicador de descoberta na agenda: *"N agendamentos depois deste mês — o próximo em 14/05 ·
      Ver"*, que leva pro mês certo. O toast cobre *"acabei de marcar"*; o indicador cobre *"marquei
      semana passada e esqueci"* — que era o buraco real. Nasce acima das views (vale nos 3 modos)
      e some sozinho quando não há nada fora da janela.
      **Validado por query contra prod** (não por navegador — hoje ninguém tem agendamento depois
      de julho, então a tela estaria vazia): aberta em **abril**, retorna **3, próximo em 14/05** —
      exatamente a informação que faltou por 3 meses. Aberta em julho: 0, não renderiza.
      ⚠️ **Falta ver a aparência** (dark mode, contraste, encaixe no espaço) — precisa de sessão
      real + dado futuro. Entra no **gate comportamental (passo 4)**, agora que a 099 está no ar.
- [x] ✅ **Harness e migration 099 — RODARAM 18/07.** Aplicada via dry-run (099+harness numa transação
      revertida → 66/66) → aplicada de verdade → re-verificada (funções/colunas/backfill/policies/inv#10/
      advisor). Sem ambiente local ainda: o dry-run rodou via MCP contra prod, com rollback.
- [x] ✅ **`tornarPrincipal` criava 2 principais** (achado 17/07, corrigido 18/07 antes do deploy) —
      valida a autoria das duas pontas ANTES de escrever e aborta limpo se alguma não for do logado.
- [x] ✅ **Botão "Assinar" da ficha visível pro não-autor** (achado no QA ao vivo 18/07, não estava no
      débito) — aparecia pra outro dentista E secretária; assinar sobe PNG pro storage mas o UPDATE é
      barrado em silêncio → falso "Assinatura salva" + órfão. **Corrigido** (`f7f4b4e`): gate com
      `podeEditarFicha` + `.select()` que remove o órfão e falha alto.
- [ ] **Invariante #9 nos caminhos AINDA não cobertos (cosmético, não corrompe):** dentista tentando
      ESCREVER no registro de OUTRO é barrado pela RLS — correto — mas em algumas telas a UI mostra
      "sucesso" e só corrige no refresh: `DocumentosTab` (apagar doc do colega), `usePlanejamentoPaciente`
      (apagar seção), `tratamentos` renomear/encerrar/excluir por não-dono. FichasTab (editar/excluir/proc/
      **assinar**) e save de seção JÁ cobertos. Não trava o autor nem a secretária. Polir quando `tratamentos`
      sair do deprecated.
- [ ] **`atualizarAgendamento` não valida conflito de DENTISTA no servidor** (só o client checa).
      A Spec 1 fechou só o de *paciente*. POST direto ainda permite 2 pacientes no mesmo horário.
- [ ] **`pacientes.dentista_id` virou coluna zumbi** — mitigado com `COMMENT` + invariante #5.
- [ ] **Storage aberto por clínica** — assumido de propósito; o harness não cobre storage.
- [x] ✅ **Tabelas mortas — DECIDIDO 16/07** (spec do Job B §2): `planejamentos` + `planejamento_etapas`
      (0 linhas) caem na migration do Job B; `tratamentos` (1 linha real) vira deprecated — código para
      de referenciar, drop fica pra limpeza futura; `planejamento_procedimentos`/`_secoes` intocadas.
      Executa junto com o Job B.
- [ ] 🔍 **Varrer features escondidas atrás de campo que a IA raramente preenche** — `retorno_sugerido`
      tinha 2/35 e escondia um botão; ✅ extinto pela Fatia A (a coluna fica no banco, o código não a
      usa). **`fichas.conduta` tem exatamente os mesmos 2/35** e continua de pé. Suspeito.

**Herdadas**
- [ ] Tipos `Pagamento`/`OrcamentoComItens` duplicados client↔server.
- [ ] Redis Upstash offline em prod (rate-limit em fallback de memória).
- [ ] Senha vazada (HaveIBeenPwned) desligada — 1 clique no dashboard Auth do Supabase.
- [ ] 24 eslint `set-state-in-effect` · 59 casts · `openai` órfão · bump next 16.x.
- [ ] `spec-hierarquia-papeis-planos.md` — parcialmente superseded pela Spec 1; auditar o resto.
- [ ] Contas de teste em prod — limpar: `test-diag-0712@` **e** a clínica QA `odontoia-test.local`
      (`qa-teste-admin/dentista2/secretaria@`, senha `QaTeste2026!`) da sessão financeiro 17/07 — o delete
      direto esbarra no trigger `prevent_last_admin_removal`. Reusáveis pro gate comportamental (passo 4).
