# Fase 1 do Playbook — Núcleo de Retenção (pré-lançamento)

> **ATUALIZAÇÃO 2026-06-30** — estado atual + sprint hoje→amanhã na seção ⭐ logo abaixo.
> Tudo abaixo de "═══ HISTÓRICO ═══" é preservado como referência (Context, Workstreams A–F, Parte 2).

---

## ⭐ Estado atual + Sprint hoje→amanhã (2026-06-30)

### ✅ Concluído
- **A** — onboarding persona→aha→plano (testado nas 2 personas hoje no app).
- **B** — recompensa pós-ficha por persona + card de primeiros passos como "investimento" com ordem por persona.
- **E** — camada de persona (`foco_principal`) plumbada via `getDentistaCached`.
- **F-limpeza** — removida a cena preta de welcome; DEX se apresenta só no `aha`.
- **Balão flutuante do DEX no Modo Consulta removido** (2026-06-30). Duplicava o mascote do header (`DexAvatar`) e cobria o botão "Organizar com DEX"; também mostrava "Clique em Iniciar Atendimento" (instrução inexistente na demo). `tsc` + `eslint` limpos, fluxo reverificado.
- **Bug do guard `must_change_password`** corrigido (`dashboard/layout.tsx`): secretária com troca pendente agora cai em `/primeiro-acesso` antes do dashboard.
- **Testes manuais hoje (passaram):** onboarding veterano completo; secretária (criar via Equipe → primeiro-acesso → dashboard com nav própria); agendamento (criar paciente → novo agendamento → status scheduled→confirmed→checked_in).

### 🔴 Bugs abertos (não-bloqueantes, corrigir no sprint)
- **Badge POPULAR** (tela de planos): só texto âmbar, sem estilo de pill (sem fundo/borda).
- **Saudação "Dr. Dr."**: `nome.split(' ')[0]` duplica o prefixo quando o nome cadastrado já começa com "Dr.".

### 🎯 Workstream K — Demo de onboarding: a simulação ensina  *(novo, desenhado 2026-06-30)*
**Decisões travadas:**
- **Slides: descartados.** Mostrar > contar — a simulação é a aula. No máx. **1 linha** de contexto no card do DEX.
- **Aha em 2 atos** (fluxo estendido, opt-in pra manter o 1º aha rápido):
  1. Card DEX → demo consulta (**aha 1: a ficha se monta**) — já existe.
  2. Tela pós-organizar deixa de parar em "Você viu o DEX em ação" → vira bifurcação: *"ver o que acontece com a ficha?"* → **assinatura (caminho demo/mock, sem gravar)** ou pular.
  3. Cai no **perfil demo** `/dashboard/pacientes/demo` (já existe — "Maria da Silva (Demonstração)") com a ficha visível.
  4. No perfil, **"Apresentar" em destaque → aha 2** (painel visual **mockado, dentista conduzindo**).
- **Remover o "falta verificação"** na demo (estado pendente confunde e tira o "tá pronto").
- Se não assinar → mesmo destino (perfil demo com a ficha aberta).
- **Arquivos prováveis:** `consulta-client.tsx` (branch `saved && isDemo`), `consulta/demo/page.tsx`, `pacientes/demo/page.tsx`, `ApresentarPanel` (modo mock).

### 🎯 Workstream L — Elevar o "Apresentar" no produto real  *(novo; a demo K espelha isto)*
**Problema:** hoje o Apresentar está **3 cliques fundo** (perfil → aba Fichas → expandir tratamento → botão `compact`, `FichasTab.tsx:1382`). É o 2º maior momento de valor, subexposto.
**Trava:** Apresentar é escopado a paciente+plano → **não vira menu global** (sem contexto abre painel vazio).
**Decisões travadas:**
- **Elevar em 2 momentos de alta intenção:**
  1. **Tela "Ficha salva!" do Modo Consulta** — adicionar CTA "Montar e apresentar o plano" (IA rascunha o plano a partir da ficha recém-salva → apresenta). Hoje a tela só oferece assinatura/emitir documento.
  2. **Header do perfil do paciente** — "Apresentar" como ação primária, **condicional a haver tratamento/orçamento**.
- **Seletor de fichas no Apresentar do header** (requisito do fundador, 2026-06-30): como não está preso a uma ficha, o painel **lista os prontuários/fichas** pra escolher qual apresentar — **mesma lógica do fluxo de orçamentos**.
- O Apresentar **contextual** (dentro de uma ficha) continua direto; **manter** o botão na `FichasTab`.
- **Prominência condicional:** só destaca quando há algo pra apresentar.
- **Arquivos prováveis:** `paciente-detail-client.tsx` (header), `consulta-client.tsx` (branch `saved && !isDemo`), `ApresentarPaciente`/`ApresentarPanel` (modo seletor), `FichasTab.tsx` (mantém).

### Ordem de execução — amanhã
1. **Spec + design-brief** de K+L (têm UI nova — regra 4 do setup; salvar spec em `plans/specs/`).
2. **Implementar L primeiro** (a demo K cai no Apresentar elevado — L é dependência de K).
3. **Implementar K** (demo estendida) + corrigir os 2 bugs abertos (badge POPULAR, "Dr. Dr.").
4. **`design-review` + `impeccable-design-polish`** no Apresentar/demo antes de fechar.
5. **Refazer TODOS os testes de hoje** (ver checklist abaixo) + os fluxos novos.

### Refazer amanhã (checklist de teste)
- Onboarding **veterano** e **iniciante** (ordem dos passos + recompensa por persona).
- Secretária: criação → primeiro-acesso → dashboard.
- Agendamento: criar paciente → agendar → avançar status.
- **Novos:** demo estendida (ficha → assinatura mock → perfil demo → aha 2 Apresentar); Apresentar elevado no produto real (tela Ficha salva + header com seletor de fichas).
- Recompensa pós-ficha na consulta **REAL** com áudio (microfone) — pendente do fundador.

### Fora deste sprint (não some — só fora da janela hoje→amanhã, com motivo)
- **C — régua de e-mails** e **D — relatório de valor:** travados na decisão de **gatilho de cron (Vercel?)** e são *verify-on-deploy*. Destravar a decisão antes.
- **Parte 2 (G/H/I/J + billing):** gate + decisões abertas (provider de pagamento, duração do trial). Multi-dia.

### Limpeza pendente
- Apagar contas de teste na prod: `test-vet-0630@`, `test-ini-0630@`, `test-sec-0630@example.com` (+ as `e2e-*-0628@` antigas, se ainda existirem). SQL pronto sob demanda.

---

═══════════════════════════ HISTÓRICO (referência) ═══════════════════════════

## Context

O Odonto.IA está em pré-lançamento e o playbook diz a coisa certa: antes de jogar
água no balde (tráfego), tapar os furos (retenção). Hoje existem 3 furos concretos
no código:

1. **Onboarding pede decisão comercial (plano) antes de entregar valor.** O "aha"
   real do produto — falar e ver a ficha se montar sozinha — só aparece depois, e a
   demo (`/consulta/demo`) ainda exige login. Isso atrasa o tempo-até-valor (TTV),
   o furo nº1 da Fase 1 (Product-Led Growth, pág. 9-10).
2. **A régua de acompanhamento existe morta.** `enviarEmailD1/D3/D7` estão definidos
   em `src/server/services/onboarding-emails.ts` mas **nunca são chamados** e não há
   cron. Só o D0 dispara. A "régua D1/D7/D14/D30" do Customer Success (pág. 14) não
   roda.
3. **Não há ritual de valor recorrente.** Nada lembra o dentista, semana a semana, do
   que ele ganhou — o gatilho externo que sustenta hábito e combate churn (Hooked +
   Customer Success).
4. **A apresentação do DEX está fraca e desconectada.** Hoje (`dex-guide.tsx`) é uma
   tela preta com um "rosto" que é um quadrado de olhos retangulares
   (`dex-mascot.tsx`) — lê como mascote de chatbot infantil, o oposto da diretriz de
   marca ("identidade inteligente premium, evitar infantil/futurista"). Pior: dispara
   como overlay no dashboard **depois** do onboarding, separada do aha. É o primeiro
   contato com a "inteligência" do produto e precisa carregar o fluxo, não atrapalhá-lo.

**Objetivo:** reformular (não apagar) o núcleo de retenção pra rodar o loop do Hook
inteiro na 1ª semana — *gatilho interno → ação sem esforço → recompensa visível →
investimento (valor acumulado)* — servindo **veterano** (dor = tempo/digitação) e
**iniciante** (dor = crescer/fechar caso) com a mesma base e recompensas diferentes.

## Decisões travadas (com o fundador)

- **Persona:** perguntada no onboarding, pelo *job* (não pela idade): "o que mais te
  ajudaria agora?" → `economizar_tempo` (veterano) vs `crescer` (iniciante). Isso
  calibra copy, recompensa e a ordem dos primeiros passos.
- **Ordem do aha:** `cadastro → identidade+perfil → AHA (demo guiada) → plano →
  procedimentos → sucesso`. Mantém login; inverte plano pra depois do valor.
- **Escopo agora:** retenção (onboarding + loop do Hook + régua de e-mails +
  relatório de valor + camada de persona). Posicionamento/landing (StoryBrand,
  Obviously Awesome) e templates de documento ficam pra um track posterior.

## Princípio de design transversal (Don't Make Me Think, pág. 11)

Toda tela reformulada passa pelo teste do outdoor: corta 50% do texto, uma ação óbvia
por tela, nomes na língua do dentista. Aplicado dentro de cada workstream, não como
etapa separada.

---

## Workstream A — Reformular o onboarding (ordem nova + persona)

**Arquivos:** `src/app/onboarding/_components/onboarding-client.tsx`,
`src/app/onboarding/actions.ts`, `src/app/onboarding/page.tsx`.

Nova máquina de passos no `OnboardingClient` (hoje: `plano → form → procedimentos →
sucesso`):

1. `identidade` — nome, CRO, especialidade, nome do consultório (form atual, enxugado)
   **+ 1 pergunta de perfil** ("O que mais te ajudaria agora?" → 2 cards:
   *Economizar tempo documentando* / *Crescer e fechar mais tratamentos*).
2. → chama **`iniciarOnboarding()`** (refatorar a partir de `completeOnboarding`):
   cria clínica+dentista em **trial, plano default `SOLO`**, grava `foco_principal`.
   Mantém a RPC transacional `complete_onboarding` (só passa `SOLO` como provisório);
   o plano vira preferência de billing ajustável no passo 4, não um gate (trial dá
   acesso total de qualquer forma).
3. `aha` — **o DEX se apresenta aqui** (Workstream F) e conduz o dentista pra **demo
   guiada** (`/consulta/demo`, já existe via `ConsultaClient isDemo`). Reusar o
   `DexGuide` (`point_demo → in_demo`) e a flag `DEMO_DONE_KEY`. Ao concluir a demo,
   retornar a `/onboarding?step=plano` (a CTA de fim da demo passa a rotear de volta).
   A apresentação deixa de ser overlay solto no dashboard e vira parte do fluxo.
4. `plano` — agora escolhe SOLO/CLINICA (cards atuais reaproveitados), atualiza
   `clinicas.plano` via nova action `definirPlano()`. CLINICA mantém o card "monte sua
   equipe" no sucesso.
5. `procedimentos` — passo atual, intacto.
6. `sucesso` — copy adaptada por `foco_principal` (veterano: "menos tempo digitando";
   iniciante: "primeiros casos prontos pra apresentar").

`enviarEmailD0` passa a ser disparado no fim do `iniciarOnboarding` (hoje no
`completeOnboarding`).

## Workstream B — Instrumentar o loop do Hook (recompensa + investimento)

**B1. Recompensa visível pós-ficha (hoje inexistente).** Após salvar uma ficha do
Modo Consulta, mostrar um momento de recompensa (toast/card no fim do
`finalize-consultation-dialog.tsx` / retorno da consulta), diferenciado por persona:
- `economizar_tempo`: "Ficha pronta. ~X min que você não digitou." (recompensa *da caça*)
- `crescer`: "Planejamento pronto pra apresentar — R$ Y em tratamento." (recompensa *do eu/tribo*)
O cálculo de "tempo economizado" pode ser uma heurística simples (nº de campos/caracteres
estruturados × constante) — definir no detalhamento.

**B2. Reformular o card de primeiros passos como "investimento", não deletar.**
**Arquivo:** `src/components/dashboard/primeiros-passos-card.tsx` +
`src/lib/onboarding-progress.ts`.
- Reenquadrar como depósito de valor acumulado ("Cada passo deixa o sistema mais seu").
- **Ordem dos passos por persona** (`foco_principal` passa a alimentar a ordenação em
  `getOnboardingProgresso`): veterano vê `consulta_real → paciente → planejamento`;
  iniciante vê `planejamento → paciente → consulta_real`.
- Não auto-some agressivamente: hoje some por `localStorage` dismiss e ao completar
  tudo — manter, mas suavizar (continuar acessível em local discreto após dispensar).

## Workstream C — Reativar e estender a régua de e-mails (idempotente)

**Arquivos:** novo `src/app/api/jobs/onboarding-emails/route.ts` (espelha o padrão de
`src/app/api/whatsapp/run-reminders/route.ts` — `GET` + `Bearer CRON_SECRET`), novo
`src/lib/jobs/onboarding-regua.ts` (lógica), `src/server/services/onboarding-emails.ts`
(já tem D1/D3/D7 — adicionar **D14, D30** + variantes por persona),
`src/lib/email/templates/onboarding.ts` (novos templates/variantes), `vercel.json`
(novo — schedule de cron diário; confirmar se o deploy é Vercel).

- O cron roda diário, calcula o "dia do trial" por `clinicas.created_at` (ou
  `trial_ends_at − 14d`), e envia o e-mail da etapa devida com as condições já
  previstas (`fezPrimeiraConsulta` etc., derivadas de `fichas origem=modo_consulta`).
- **Idempotência:** nova tabela `onboarding_email_log(clinica_id, etapa, enviado_em)`
  com unique `(clinica_id, etapa)` — não reenvia. (Invariante de job do
  `src/lib/jobs/index.ts`: sempre idempotente.)
- Copy das etapas adaptada por `foco_principal`.

## Workstream D — Relatório de valor recorrente (Customer Success, pág. 14)

**Arquivos:** novo `src/server/services/value-report.ts`, novo template em
`src/lib/email/templates/`, novo cron `src/app/api/jobs/value-report/route.ts`
(mesmo padrão CRON_SECRET), e uma **superfície in-app** leve (card no dashboard ou aba
no perfil) reusando os dados.

- Semanal (ou quinzenal): computa do banco — fichas estruturadas, pacientes novos,
  planejamentos, e a métrica-âncora por persona (veterano: **horas economizadas**;
  iniciante: **R$ em tratamento apresentado / casos**). Tudo já existe em `fichas`,
  `pacientes`, `planejamentos`, `orcamentos`.
- Sem novo armazenamento pesado: computa on-the-fly; grava só
  `clinicas.ultimo_relatorio_valor_em` pra agendar + log idempotente como na régua.

## Workstream E — Camada de persona (fundação dos demais)

- **Migração:** `dentistas.foco_principal text` (check `economizar_tempo|crescer`,
  nullable pra contas existentes).
- Propagar `foco_principal` para: onboarding (A), recompensa pós-ficha (B1), ordem dos
  passos (B2), copy da régua (C), âncora do relatório (D). Carregar junto do
  `getDentistaCached` (`src/lib/get-dentista.ts`) pra ficar disponível sem fetch extra.

## Workstream F — Reformular a apresentação do DEX (crítico pro fluxo)

**Arquivos:** `src/components/onboarding/dex-mascot.tsx` (identidade visual),
`src/components/onboarding/dex-guide.tsx` (cena + roteiro), `src/hooks/useDexGuide.ts`
(estados), `src/components/layout/dashboard-shell.tsx:141` (ponto de montagem),
e consistência com `src/components/layout/dex-widget.tsx` /
`dex-presence.tsx` / `consulta-client.tsx:945` (mesma identidade em toda parte).

**F1. Identidade visual premium.** Substituir o "rosto" quadrado-com-olhos por uma
marca do DEX condizente com a diretriz (inteligente, fluida, não infantil/futurista).
Reusar tokens do design system; funcionar em dark/light. Um único componente de marca
do DEX consumido por todas as superfícies (evitar divergência de identidade).

**F2. Roteiro reescrito e integrado ao aha.** A cena deixa de ser overlay no dashboard
pós-onboarding e passa a abrir o passo `aha` (Workstream A): o DEX se apresenta em 1-2
frases (cortar copy — Don't Make Me Think), com **promessa adaptada por persona**
(veterano: "nunca mais digitar uma ficha"; iniciante: "montar planejamento que fecha
caso"), e conduz pra demo. O DEX é também a **voz da recompensa** (B1) e do relatório
de valor (D) — mesmo tom em todo o loop.

**F3. Consistência e qualidade.** Passar o resultado por `design-review` +
`impeccable-design-polish` (regra 4 do setup: design não pode ter cara de IA) antes de
fechar. Respeitar `prefers-reduced-motion` (já tratado em `useDexGuide`).

## Mudanças de banco (via Supabase MCP — `apply_migration`)

1. `dentistas.foco_principal` (nullable).
2. `onboarding_email_log(clinica_id, etapa, enviado_em)` + unique `(clinica_id, etapa)`.
3. `clinicas.ultimo_relatorio_valor_em timestamptz null`.
4. Ajuste na RPC `complete_onboarding` **somente se necessário** pra aceitar
   `foco_principal` (ou gravar via update no `iniciarOnboarding` pra evitar mexer na
   RPC). Preferir o update — menor risco.

## Fora de escopo deste plano (tracks posteriores)

- Posicionamento e copy da landing (Obviously Awesome, StoryBrand) — item separado.
- Templates de documento (atestado/receita/exame) com identidade visual e assinatura —
  o item 4 original, tratado depois.
- Demo pública pré-cadastro — descartada agora (escolhido `cadastro → aha`).

## Verificação / validação antes do lançamento

1. **Onboarding end-to-end, as duas personas:** rodar o app (`skill run` / preview MCP),
   criar conta escolhendo cada perfil, confirmar a ordem `identidade+perfil → aha →
   plano → procedimentos → sucesso`, e que a copy/ordem dos passos muda por persona.
2. **Loop do Hook:** finalizar uma ficha na demo e numa consulta real e ver a
   recompensa diferenciada; conferir o card de primeiros passos refletindo o
   "investimento".
3. **Régua de e-mails:** disparar o cron manualmente
   (`GET /api/jobs/onboarding-emails` com `Bearer CRON_SECRET`) com clínicas de teste em
   D1/D3/D7/D14/D30; confirmar e-mail correto, variante por persona, e **não-reenvio**
   (idempotência via log).
4. **Relatório de valor:** disparar o cron, validar números contra o banco e a
   superfície in-app.
5. **Apresentação do DEX:** abrir o passo `aha` nas duas personas e confirmar que o
   DEX se apresenta com a identidade nova, promessa adaptada, e conduz à demo sem
   atrito — em dark e light. Aprovar em `design-review` + `impeccable-design-polish`.
6. **Regressão de usabilidade (Don't Make Me Think):** teste do outdoor de 5s em cada
   tela nova + walkthrough com `qa-web` / `design-review` antes de fechar.
6. **TS/lint:** `npm run typecheck` e `npm run lint` limpos.

---

# PARTE 2 — Alterações pós-validação (discutido 2026-06-28)

> **Estrutura em duas partes (decisão do fundador, 2026-06-28):**
> - **PARTE 1 = todo o conteúdo ACIMA** (Fase 1 retenção, workstreams A–F). Terminar,
>   o fundador testa o fluxo completo e **verifica tudo funcionando** — só então abre a Parte 2.
> - **PARTE 2 = esta seção.** **Gate:** não começa até a Parte 1 estar terminada +
>   testada + verificada. Mais organizado e evita espalhar trabalho pela metade.
>
> Sessão de discussão (sem código). Retomada de implementação: **segunda 29/06 à noite**.

## Decisões desta discussão
| Tema | Decisão | Observação |
|---|---|---|
| Modelo de billing | Trial **com cartão**, capturado **no passo do plano (pós-aha)** — não na porta | Cartão > trial-sem-cartão: compromisso + dados de pagante (vídeo "freemium é tiro no pé"). Usa a própria lógica do fundador: "assim que usar já vê que tem coisa boa" → cartão vem DEPOIS do aha |
| Provider de pagamento | **EM ABERTO** — fundador vai verificar AbacatePay e **talvez trocar de plataforma** | Não implementar billing até decidir o provider. AbacatePay hoje é checkout hospedado (redirect), PIX+CREDIT_CARD, `frequency MONTHLY`; **não confirmado** se faz trial-on-card (cobra só no dia 7) |
| PIX vs cartão | Trade-off registrado | "Cartão na ficha → auto-cobra" só funciona com **cartão** (PIX não é credencial guardada). Forçar cartão-only derruba quem usa PIX |
| Duração do trial | **7 ou 14 dias — fundador vai estudar** | Hoje hardcoded 14 em `activateTrial` (mudança de 1 linha) |
| Modelo de IA | **Manter Groq** (velocidade = parte da mágica) | Guard: vigiar a **qualidade do output do aha** (dentista é especialista, erro de dente custa confiança) |
| Alavanca do aha | **Visual**, não o modelo | Ver Workstream G |

## Backlog expandido (novos workstreams)

### G — Repaginação do Modo Consulta  *(núcleo do produto)*
Hoje "parece simples / fora do sistema / padrão visual baixo". É o núcleo do produto
**e** é o que roda no aha (mesma tela) — repaginar = melhorar conversão + experiência
central de uma vez. Começa por **`design-shotgun`** (3-4 direções) → `design-brief` →
implementar → `design-review`. **[needs-brief]** identificar a dor exata: moldura
(não usa o shell do sistema) / linguagem visual (tokens/espaçamento) / densidade /
motion. *Detalhar perto da implementação.*

### H — Dicionário odontológico / precisão de extração  *(substância — recomendo prioridade alta)*
O sistema precisa **entender melhor o que é dito**. Dois casos concretos:
- **(a) Mapear fala → catálogo existente:** cliente mantém a tabela padrão e só edita
  preço (não o nome) — o que ele falar tem que casar com o procedimento certo. Já existe
  um match fuzzy em `procedimentoCadastrado` (`consulta-client.tsx`); o trabalho é
  robustez.
- **(b) Procedimento vs observação ao vivo:** no Modo Consulta, separar com confiança o
  que é procedimento do que é observação. É o coração da estruturação (`formatar-evolucao`).
- Abordagem a decidir: **prompt + dicionário/ontologia odontológica curada + camada de
  validação** (vs fine-tune, descartável agora). **Testável via eval set** (consultas →
  saída esperada). *"Estudar certo, certinho" (fundador).*

### F (reforçado) — Apresentação do DEX
Refinar como o DEX **apresenta o Modo Consulta / a demo**. Já era F; o fundador reforçou.
Funde com G (visual) e o motion.

### I — Secretária
Revisar e refinar a experiência da secretária. **[needs-brief]**

### J — Fluxo de convites
Refinar o fluxo de convites. **[needs-brief; ver `docs/handoffs/2026-06-22-fluxo-convite.md`]**

## Ordem de execução (a confirmar segunda)

**PARTE 1 — terminar a Fase 1 (testar + verificar antes de abrir a Parte 2):**
1. **Travar o A** — fundador testa nas 2 personas + commitar (não perder de novo).
2. Workstreams restantes da Fase 1 — **F** (finalizar DEX), **B** (loop/recompensa),
   **C** (e-mails), **D** (relatório) — um por vez, com report/aprovação (cadência do fundador).
3. Fundador roda o **teste end-to-end completo** e verifica tudo.

**PARTE 2 — só depois da Parte 1 verificada:**
4. **H — precisão de extração** + **G/F — Modo Consulta** (substância + experiência-núcleo). *Recomendo começar a Parte 2 por aqui.*
5. **I — secretária**, **J — convites**.
6. **Billing** (talvez novo provider) — quando decidido (fundador conduz).

> Caveat registrado (Claude): a precisão de extração (H) fica na Parte 2, depois de C/D.
> Risco: construir e-mails/relatório (C/D) pra um produto cuja extração ainda não foi
> endurecida. **Mitigante: é exatamente o teste/verificação da Parte 1 que pega isso** —
> se ao rodar o fluxo real a extração sair fraca, H sobe pra Parte 1.

## Verificação manual pendente (fundador, ao chegar)
- Testar o Workstream A nas 2 personas em outro computador.
- Verificar bug #2 (badge POPULAR) visualmente.
