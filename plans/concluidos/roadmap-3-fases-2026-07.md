> # ⚠️ ARQUIVADO 21/07/2026 — histórico
> Já estava superseded pelo roadmap 3.1 desde 14/07; ficou 7 dias na pasta ativa por engano.
> O mapa vivo é [`roadmap-mestre-2026-07-21.md`](../roadmap/roadmap-mestre-2026-07-21.md).

# Roadmap — 3 fases (julho/2026)

> **Criado:** 2026-07-12. Consolida TUDO que está pendente em `roadmap-polimento.md`, `plano-fase1-retencao.md`, `auditoria-2026-07-09.md` e `diagnostico-2026-07-12-tres-papeis.md` num plano único de 3 semanas.
> **Contexto:** Mateus estará **presente** nos testes desta semana → onboarding automático sai de cena; foco total em funcionalidade. Pagamento e WhatsApp são a frente pessoal dele na semana 2.
> **Vivo, não contrato:** grandes alterações vão surgir — adaptar aqui, mantendo o histórico (append no fim, não sobrescrever decisões).
> **Atualizado 12/07:** +adiantar pacientes (preencher vaga → Fase 1), +manutenção mensal (agenda+cobrança recorrente → Fase 2), +simplificação da tela da secretária (Fase 1 parcial / Fase 3 reorg).
> Legenda: 🔴 a fazer · 🟡 em andamento · ✅ feito · [B#] = achado do diagnóstico 12/07 · [#N] = item da lista do fundador no roadmap-polimento.

---

## FASE 1 — Esta semana (13–19/07) · "o sistema pronto pro teste presencial"

**Objetivo:** funcionalidades redondas pra testar com gente real ao lado. Zero fluxo guiado automático; DEX com uma cara só; animações que vendem o momento certo.

**Modelo por bloco** (o `/model` do thread é manual — troque antes de entrar em cada bloco):
| Blocos | Modelo | Por quê |
|---|---|---|
| A · B · F · C1 · C4 · D · E · G2 | **Sonnet 5** (`/model claude-sonnet-5`) | Execução mapeada (arquivo:linha no diagnóstico) ou visual coberto por `design-review`. Rápido/barato pra pilha de edições contidas |
| C2 · C3 · **spec do G1** | **Opus 4.8** (`/model claude-opus-4-8`) | Julgamento: afinar prompt/dicionário de IA, desenhar/ler o eval set, escrever o contrato da feature net-new |

> Alternativa: ficar em **Opus 4.8 + `/fast`** a fase toda (um modelo só, cuidado alto, sem micro-gerência). `/fast` acelera a saída sem downgradar de modelo.

### Bloco A — Desativações (reversíveis — código fica, comportamento sai)
| It. | O quê | Nota |
|---|---|---|
| A1 🔴 | **Onboarding encurtado:** `identidade → dashboard` direto. Após `iniciarOnboarding` com sucesso → `marcarOnboardingCompleto()` + redirect `/dashboard` (sem aha/demo/plano/procedimentos) | Neutraliza o [B1] (a retomada `ALREADY_ONboarded → dashboard` vira comportamento CERTO). Plano fica SOLO default; procedimentos/plano acessíveis via Configurações. **Não deletar** a máquina de passos — curto-circuito comentado, volta na fase 3 |
| A2 🔴 | **DexGuide desligado:** não montar o guia (dashboard-shell / useDexGuide retorna `done`) | Mata os 3 sintomas do [B9] (balão desorientado, toast coberto, persistência). Card "Primeiros passos" **fica** (sem pulse) — é o caminho pro catálogo agora que o passo procedimentos saiu do onboarding |

### Bloco B — Fixes de funcionalidade (do diagnóstico 12/07, todos com local mapeado)
| It. | O quê | Onde |
|---|---|---|
| B4 🔴 | Botão **"Agendar retorno" na visão expandida (D12)** da ficha — hoje só existe na colapsada | `FichasTab.tsx:1234` (bloco leitura) reusando o handler de `:1163` |
| B5 🔴 | Conflito de agenda: incluir `checked_in`/`in_progress` no `criarAgendamento` + validar paciente da clínica no `criarEncaixe` | `agendamentos/actions.ts:62` e `:501` |
| B7 🔴 | Guard de papel na rota do Modo Consulta (secretária → redirect) | `consulta/[agendamentoId]/page.tsx` |
| B8 🔴 | Pós-ficha: **sem auto-redirect enquanto há CTAs** (ou janela ≥15s com "Ficar aqui") — o countdown de 5s mata o momento do "Gerar plano" | `consulta-client.tsx:145,379` |
| B11 🔴 | Copy rápidos: "Limite de 1 dentista**s**" · botão "Iniciar consulta" → "Continuar atendimento" quando `in_progress` · tipo órfão `'pago'` em `orcamentos/page.tsx:30` | 3 arquivos, minutos |

### Bloco C — IA: limites e inconsistências (frente 2 da divisão de 12/07)
| It. | O quê | Nota |
|---|---|---|
| C1 🔴 | **[B3] Pós-processamento determinístico** em `formatar-evolucao`: todo dente em `dentes_afetados` sem chave em `dentes_observacoes` ganha entrada derivada de `procedimentos`/queixa | O fix do "canal do 26 sumiu do orçamento". Sem trocar modelo |
| C2 🔴 | Prompt/dicionário: diagnóstico ≠ procedimento ("Cárie oclusal" não é procedimento; a restauração é) + não deixar o diagnóstico (ex. pulpite) cair fora das anotações | `formatar-evolucao/route.ts` + `odonto-dictionary.ts` |
| C3 🔴 | **Eval set de consistência:** rodar a mesma narrativa N× via harness Playwright e comparar campos — régua objetiva ANTES de qualquer ajuste fino de prompt | Scripts base em `scratchpad/qa/` (sessão 12/07); salvar casos em `supabase/tests/` ou `plans/` |
| C4 🔴 | Rate-limit no `sugerir-orcamento` (única rota Gemini sem limite — a mais cara) | `withRateLimit`, padrão das outras 11 rotas |

### Bloco D — Unificação do DEX [#8 do fundador]
**Descoberta de 12/07:** o componente canônico **já existe** — `src/components/dex/dex-mark.tsx` (squircle/circle, expressões `neutro|pensando|feliz|atento`, motion + reduced-motion) — mas só o onboarding consome. Unificar = propagar e deletar os rivais.
| It. | O quê |
|---|---|
| D1 🔴 | Inventário confirmado: `DexAvatar` (`ui/dex-avatar.tsx`, círculo — usado em `consulta-client` e `dex-guide`) · `dex-mascot.tsx` (quadrado antigo — só `dex-guide`) · renders próprios em `dex-widget` (1.103 linhas), `dex-presence`, `dex-day-button` |
| D2 🔴 | Trocar todo consumo por `DexMark` (prop `shape` cobre círculo vs squircle); widget/presence/day-button passam a renderizar o DexMark como rosto |
| D3 🔴 | Deletar `dex-avatar.tsx` e `dex-mascot.tsx` quando zerar consumers (dex-guide está desligado pelo A2 — atualizar ou deixar apontando pro DexMark) |
| D4 🔴 | Gate: mesma cara em TODA superfície, dark/light, tamanhos 16–96px sem distorção |

### Bloco E — Animações [motion diferido do DESIGN-KL §3a/§4 + "animações leves" do #8]
Regra de intensidade (frequency gate do DESIGN-KL): **uso diário = sutil e rápido; nunca bloquear interação.**
| It. | O quê | Nota |
|---|---|---|
| E1 🔴 | **Moneyshot da estruturação** (consulta real): blocos da ficha estruturada entram em stagger ~60–80ms, fade + translateY 8px→0 | O "DEX encaixou cada peça". Total <500ms; `prefers-reduced-motion` → instantâneo |
| E2 🔴 | **DexMark reage ao processamento:** `pensando` durante o "Organizar com DEX", beat de `feliz/pronto` no settle | As expressões já existem no DexMark — é fiação |
| E3 🔴 | Micro-interações nas superfícies do loop (card de ficha, chips de status, modal de orçamento): hover/tap leves via `motion-react` | Skill `design-motion-principles` decide SE/QUANTO; nada de stagger em lista repetida |

### Bloco F — Higiene que protege o teste
| It. | O quê |
|---|---|
| F1 🔴 | **CI mínimo** (`.github/workflows`): typecheck + eslint + build em push/PR — fecha o buraco do `ignoreBuildErrors` [B6] |
| F2 🔴 | `npm audit fix` simples — fecha o `@xmldom/xmldom` HIGH |
| F3 🔴 | **[manual Mateus, 1 clique]** Ligar proteção de senha vazada — Supabase Dashboard → Auth → Password Security |

### Bloco G — Secretária & Agenda (novo, 12/07)
| It. | O quê | Nota |
|---|---|---|
| G1 🔴 | **Adiantar paciente = preencher vaga de cancelamento.** Ao cancelar/no-show um agendamento (slot livre), oferecer puxar um paciente já agendado **mais pra frente** (mesmo dentista) pra ocupar a vaga: lista os próximos agendamentos futuros → secretária escolhe → remarca pro slot livre (o antigo vira "movido"). **Versão thin, manual** — sem notificação automática ao paciente nesta fase (a secretária liga) | Reusa `criarEncaixe`/update de `agendamentos`. **Precisa mini-spec** (regra 2: feature nova). ⚠️ Único item net-new da agenda na véspera do teste — **se a semana apertar, desce pra Fase 3**. Ancoragem UTC do dia (mesmo cuidado do B5) |
| G2 🔴 | **Simplificação da tela da secretária — só cortar o óbvio agora.** Enxugar poluição evidente do dashboard/agenda da secretária. A **reorg de verdade fica pra Fase 3**, informada pelo teste presencial (X2) — simplificar fundo antes de ver a secretária real usar = refazer duas vezes | Escopo raso e reversível; nada de redesenho |

### Gate de saída da Fase 1
- [ ] Dogfood do loop inteiro (walk-in → consulta → ficha → orçamento → apresentar → retorno) nas 2 contas de teste.
- [ ] Adiantar paciente (G1) testado: cancelar um slot → puxar um futuro pra ele.
- [ ] `design-review` nos surfaces tocados (DEX unificado + animações + consulta) — o F3 do roadmap antigo acontece AQUI, desbloqueado pelo harness Playwright de 12/07.
- [ ] Eval set (C3) rodado com ≥5 narrativas × 3 repetições, resultado registrado.
- [ ] `tsc` + `eslint` + `next build` limpos; CI verde.

---

## FASE 2 — Semana que vem (20–26/07) · "dinheiro e canal" (frente do Mateus, apoio meu)

**Objetivo:** trial que expira, cobrança que existe, WhatsApp de verdade.

### Pagamento
| It. | O quê | Origem |
|---|---|---|
| P1 🔴 | **Decidir o modelo do trial:** quando `trial_ends_at` é setado (no onboarding? 7 ou 14 dias?) e corrigir `activateTrial` (hoje força CLINICA e vive numa rota morta) | [B2] — **12/12 clínicas hoje em trial infinito** |
| P2 🔴 | Backfill das clínicas existentes (decisão: começar o relógio de quem já usa?) | prod=dev — migration com confirmação explícita |
| P3 🔴 | Provider: manter AbacatePay ou trocar — decisão do fundador; billing por-dentista é a direção (spec-hierarquia §4) | handoff 10/07 |
| P4 🔴 | Gate de bloqueio revisado (Modo Consulta ao expirar) + tela/fluxo de assinatura | `consulta/[id]/page.tsx:22`, `/planos` |
| P5 🔴 | **Zod nas actions de dinheiro** (`criarOrcamento`, `marcarPagamentoPago`, `registrarPagamento`) — entra junto porque a frente mexe nelas | P1-2 da auditoria 09/07 |
| P6 🔴 | Copy do trial na landing (7 vs 14 dias — hoje contradiz) + CTAs param de propagar `?plano=CLINICA` | [B11]/[#17] |

### Recorrência — Manutenção mensal (novo, 12/07) · pacote ortodôntico (paciente-facing)
> **Ponto cego travado:** esta é a **3ª camada de recorrência** do sistema. Não confundir: (1) assinatura do SaaS = Odonto.IA cobra o dentista [P1–P4]; (2) **manutenção mensal = o dentista cobra o paciente dele** todo mês. Mecânica de "cobrança que se repete" é a mesma → **construir UM motor de recorrência**, não dois. Por isso vive na Fase 2, colada no pagamento, não na agenda da Fase 1.
| It. | O quê | Nota |
|---|---|---|
| M1 🔴 | **Spec primeiro** (feature grande, toca schema): plano de manutenção do paciente (valor mensal, dia de cobrança, início/fim), agendamentos recorrentes mensais, e cobrança recorrente. Casos: ortodontia (ajuste + mensalidade) | `plans/specs/` antes de codar |
| M2 🔴 | **Agenda recorrente:** ao marcar manutenção mensal, gerar as próximas N visitas automaticamente (dentista/dia fixo), com opção de ajustar/pular uma | Conversa com G1 (agenda) e B5 (conflito) |
| M3 🔴 | **Cobrança recorrente do paciente:** mensalidade que se repete no financeiro, derivada do plano de manutenção — reusando o motor de P1–P4, não um paralelo | Depende do provider decidido em P3 |
| M4 🔴 | Visão da recorrência: no perfil do paciente (plano ativo, próximas visitas, status de pagamento) e no financeiro (previsto vs recebido do mês) | |

### WhatsApp (destravado pelo CNPJ)
| It. | O quê | Origem |
|---|---|---|
| W1 🔴 | Credenciais Meta (WABA) + `WHATSAPP_APP_SECRET` em prod | P0-1/P0-2 da auditoria |
| W2 🔴 | Implementar os 4 stubs do `meta.ts` (`sendText`, `sendFile`, `sendInteractive`, `downloadMedia`) — ou fail-honest até lá (throw em vez de sucesso falso) | 13 TODOs |
| W3 🔴 | Cron de lembretes validado ao vivo (`vercel.json` já existe; disparo manual com `CRON_SECRET` primeiro) | |
| W4 🔴 | Beco da secretária: `/dashboard/bot` → `/planos?feature=whatsapp` que ela não pode assinar — rota/mensagem digna pro papel | diagnóstico §3 |
| W5 🔴 | Confirmar env em prod: `UPSTASH_REDIS_REST_*` (senão rate-limit é decorativo) e `CRON_SECRET` | auditoria §1.4 |

---

## FASE 3 — Última semana (27/07+) · "retenção, polimento e endurecimento"

**Objetivo:** o que faz o usuário FICAR + as dívidas que não podiam parar as fases 1–2. Aqui entram as "alterações grandes" que forem surgindo dos testes.

### Retenção (sobras da Fase 1 antiga)
| It. | O quê | Origem |
|---|---|---|
| R1 🔴 | **Régua de e-mails D1/D3/D7/D14/D30** — cron idempotente + `onboarding_email_log` + templates por persona | item C (alta) |
| R2 🔴 | **Relatório de valor recorrente** (relatório do DEX) — cron + card in-app, métrica-âncora por persona | item D / [#4] |
| R3 🔴 | **Reativar o onboarding** repensado (o A1 volta): escopo novo do fundador ("modo consulta bem explicado + peculiaridades") — do zero, com brief | [#1] + aprendizado do teste presencial |
| R4 🔴 | Recompensa pós-ficha personalizada por persona (refinar) | [#3] |

### Núcleo clínico — rebuild da ficha (visão de longo prazo, precisa spec própria)
> Origem: `handoff-2026-07-06-discussao.md` §"Rebuild" (#3/#9) + `spec-16-ficha-unificada.md` (v1 = layout de leitura, **já no ar**). O D12 unificou só a **leitura** — o criar↔acompanhar e o odontograma-como-input **nunca foram construídos**. Itens grandes, cada um passa por brief/spec antes de codar; informados pelo teste presencial.
> **Discutido 12/07 (fundador):** a fonte única de dados **já está pronta** (`usePlanejamentoPaciente.ts:161`, spec-16 D4 — apresentação e ficha derivam de `fichas.procedimentos_status`+`dentes_observacoes`). Logo, Fx1 e Fx3 são **trabalho de superfície/UX**, não rebuild de banco. Fx3 vira **spec própria, à parte** (não se funde com a ficha).
>
> **★ TRÊS SUPERFÍCIES (corrigido 12/07 — não confundir):**
> 1. **Ficha** = documentar a sessão (notas, voz, dentes, procedimentos feitos) — o dentista **escrevendo**.
> 2. **Tratamento** = **cockpit do dentista**: bate o olho e sabe o que foi feito, o andamento, e **a data de cada coisa** — o dentista **lendo o todo** (é temporal: uma linha do tempo do tratamento, não só o estado atual).
> 3. **Apresentação** = pro **paciente**, conversão — mundo à parte.
>
> **Sinergia em 2 níveis:** **Ficha ↔ Tratamento = fusão apertada** (mesmo dentista, mesmo momento — quase a mesma tela, dois modos: escrever/acompanhar). É o Fx1. **Cockpit ↔ Apresentação = mundos diferentes ligados pelo fio** — o **odontograma como fio condutor** atravessa os três pra o salto pro paciente não "parecer que mudou de tela do nada", mas a apresentação é deliberadamente outra expressão (grande, visual, persuasiva). Regra: mesmo esqueleto reconhecível (odontograma + arquitetura de info + tokens), **expressão por público**. Sinergia, não igualdade. Nenhum brief desenhado no vácuo.
| It. | O quê | Origem |
|---|---|---|
| Fx1 🗣️ | **Ficha + Tratamento numa superfície (o cockpit do dentista).** Mesclar **documentar** (ficha: notas/voz/dentes/procedimentos da sessão) com **acompanhar** (tratamento: o que foi feito · andamento/status · **data de cada coisa**), **sem sair da tela nem clicar duas vezes**. Norte: cockpit **completo, bonito, eficiente** — o dentista bate o olho e sabe tudo (odontograma = o quê/onde · progresso = quanto · **linha do tempo com datas** · narrativa · ações à mão). **Voz pra observação FICA** (adição de valor; já existe no `FichasTab` — integrar, não recriar; ≠ Modo Consulta inteiro). ⚠️ **Risco:** "melhor dos dois mundos" vira MAIS poluído se ingênuo → glanceável exige disciplina (abre no **acompanhar** limpo; documentar/editar **inline sob demanda**). **Design-first:** `design-brief` → `design-shotgun` (3-4 direções) → spec → build. **Coerência com a manutenção mensal (Fase 2):** a ficha É a linha do tempo de um tratamento que pode ser recorrente | handoff 06/07 #3 |
| ~~Fx2~~ ⏸️ | **Embutir o Modo Consulta na ficha — ADIADO (12/07).** Decisão do fundador: por ora o Modo Consulta fica **separado** da ficha. Reabre se o teste presencial mostrar que a troca de tela dói. Raciocínio preservado (handoff 06/07 #4) | handoff 06/07 #4 |

### Apresentação — spec própria (à parte da ficha, decisão 12/07)
> Superfície de **conversão** do paciente (CLAUDE.md: "ferramenta visual de conversão"). Spec dedicada + design-brief quando entrar; não folda na ficha. Fonte de dados já unificada.
| It. | O quê | Origem |
|---|---|---|
| Ap1 🗣️ | **Apresentação redesenhada:** present mode fullscreen, abrir no **odontograma** (não no card de quadrante), **imagens grandes** image-first, antes/depois, edição rica de conteúdo com layout templado. ⚠️ Esqueleto auto-gerado JÁ EXISTE (workstream L) — **proteger, nunca virar editor do zero** | handoff 06/07 #9 |
| Ap2 🗣️ | **Fechar o loop `apresentar → aceitar → agendar`** — o "sim" do paciente vira tratamento agendado + faturado sem esfriar (encosta na agenda e na manutenção mensal). Debate 12/07: é o pedaço mais alavancado do redesign — polish vende o sim, o loop **banca** o sim | handoff 06/07 #9 + diagnóstico |

### Fluxo e papéis (informado pelo teste presencial)
| It. | O quê | Origem |
|---|---|---|
| X1 🔴 | Repaginação do Modo Consulta (G) — tela própria, precisa brief; "já mordido" em 03/07. (Fx2 adiado → não se funde mais com a ficha por ora) | Parte 2 |
| X2 🔴 | **Reorg de verdade da tela da secretária** (I) + fluxo de convites (J) — informada pelo teste presencial; continua o G2 (que só cortou o óbvio). Precisa brief | [#6]/[#7] + G2 |
| X3 🔴 | Encaminhamento visível (hoje escondido no Editar Paciente) — elevar pra ação clara do papel secretária | diagnóstico §3 |
| X4 🔴 | Demo: pequenos pontos de disposição [#5] + decidir o destino da demo sem onboarding | |
| X5 🔴 | Feedback de sucesso consistente: auditar forms restantes que fecham sem toast (editar paciente, configurações, convites) | transversal 03/07 |

### Endurecimento e dívidas
| It. | O quê | Origem |
|---|---|---|
| H1 🔴 | Malha de testes: unidade nas actions de dinheiro → e2e do loop clínico (base: harness Playwright de 12/07) | debate 3 (09/07) |
| H2 🔴 | Sentry / error tracking (zero visibilidade de erro em prod hoje) | auditoria §5 |
| H3 🔴 | Bump `next` na linha 16.x (advisories: bypass de middleware, CSRF null-origin) — com CI já verde | [B6]/deps |
| H4 🔴 | Acessibilidade do card de ficha (clicável gigante com botões aninhados) + chips de status como `<button>` + `aria-label` nos ícones — junto de qualquer redesign do FichasTab | [B10] |
| H5 🔴 | `supabase gen types` (mata a maioria dos 59 casts) · remover `openai` órfão · atacar os 24 `set-state-in-effect` | dívidas |
| H6 🔴 | Landing [#17]: redesenho + perf (rAF contínuo ainda vivo lá) + "Continuar com Google" no hero — design-first, pós-teste | |
| H7 🔴 | Limpar contas de teste em prod: `test-*-0630@`, `test-k-0630@`, `test-diag-0712@`, `test-diag-sec-0712@` + paciente "Maria Souza Teste" (SQL pronto sob demanda) | |
| H8 🔴 | Documentar `PLAN_OVERRIDE_EMAIL` no `.env.example` · padronizar erro genérico (sem `err.message` cru) nas rotas/actions | diagnóstico §1.3 |

---

## O que JÁ ESTÁ FEITO (não re-trabalhar — verificado ao vivo em 12/07)
Ficha #16 **layout de leitura** (D12 2 colunas, 3 status, progresso) — ⚠️ a unificação criar↔acompanhar e o odontograma-input **NÃO** estão feitos (→ Fx1/Fx2 na Fase 3) · Largura #18 (PageContainer) · Cluster orçamento #13/#14/#15 · Leva do loop clínico (#2 walk-in, #5 botões, #6 ficha→orçamento, #7 alerta catálogo, #10 parcial, #11 abas) · Workstreams K/L (demo estendida + Apresentar elevado com seletor) · Spec-9 perf do app · IA: 5 rotas corrigidas + visão consolidada Gemini 2.5 · Segurança: silo 3 camadas, fail-closed webhook, migrations 089–096, error boundaries, cron registrado.

## Regras de adaptação
1. Item novo descoberto no teste → entra na fase da sua natureza (funcionalidade→1, dinheiro/canal→2, resto→3), registrado aqui com data.
2. O que sair de escopo NÃO é apagado — marca ⏸️ com motivo.
3. Specs continuam mandando: item grande novo passa por `plans/specs/` antes de codar (regra 2 do CLAUDE.md).
4. **Modelo no spec:** toda spec gerada carrega no cabeçalho o campo `> **Modelo:** <execução> · <spikes de julgamento>` (ex.: `Sonnet 5 (\`/model claude-sonnet-5\`) na execução; Opus 4.8 (\`/model claude-opus-4-8\`) pra decisões ambíguas/schema`). O thread principal não troca sozinho — o campo guia o `/model` manual; subagents disparados já nascem no modelo certo.
