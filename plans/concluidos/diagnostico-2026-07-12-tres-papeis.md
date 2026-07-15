# Diagnóstico completo — 3 papéis (Programador · Dentista · Secretária)

> **Data:** 2026-07-12 (madrugada) · **Método:** leitura de todos os handoffs/roadmaps/specs de `plans/` + varredura de código + **teste ao vivo em build de produção local** (Playwright, conta de teste real criada via signup: `test-diag-0712@example.com` / secretária `test-diag-sec-0712@example.com`, clínica "Consultório Diagnóstico").
> **Base de comparação:** `auditoria-2026-07-09.md`. Este documento NÃO repete o que já estava lá — verifica o que mudou e adiciona o que o teste ao vivo revelou.
> **Nada foi alterado em código de produto.** Artefatos criados: conta/paciente/ficha de teste em prod (dev=prod), `.claude/launch.json` ganhou config `prod`, screenshots em scratchpad.

---

## Sumário executivo

**O loop clínico central funciona de verdade — foi provado ao vivo, de ponta a ponta.** Walk-in → Modo Consulta → estruturação IA (dentes certos, alerta de alergia, retorno) → revisão → ficha unificada com progresso → orçamento mirado → Apresentar → assinatura. A fundação de segurança segue sólida (advisors limpos, silo intacto). As specs da leva de julho estão implementadas e operantes.

**Os problemas graves são de COSTURA, não de fundação:** o caminho de retomada do onboarding despeja o usuário no dashboard pulando demo/plano/procedimentos; o trial nunca expira para NINGUÉM (12/12 clínicas com `trial_ends_at = NULL`); a extração de IA é inconsistente entre rodadas (o procedimento principal pode sumir do orçamento); e integrações entre specs implementadas em paralelo se perderam (#10 × #16).

| # | Sev. | Achado | Papel que dói |
|---|---|---|---|
| 1 | 🔴 | Retomada do onboarding pula aha/plano/procedimentos e deixa `onboarding_completo=false` pra sempre | Dentista novo |
| 2 | 🔴 | Trial infinito: **nenhuma** conta tem `trial_ends_at`; gate do Modo Consulta nunca bloqueia; funil de pagamento inexistente | Negócio |
| 3 | 🔴 | IA: dente em `dentes_afetados` sem entrada em `dentes_observacoes` → tratamento principal some do progresso e do orçamento | Dentista |
| 4 | 🟠 | Botão "Agendar retorno" não existe na visão expandida (D12) da ficha — retorno volta a ser inerte | Dentista |
| 5 | 🟠 | `criarAgendamento` não detecta conflito com consulta `checked_in`/`in_progress` (dupla marcação em cima de atendimento em curso) | Secretária |
| 6 | 🟠 | Sem CI: nenhum workflow existe; `ignoreBuildErrors: true` → erro de tipo chega em prod sem gate | Programador |
| 7 | 🟠 | Rota `/consulta/[id]` sem guard de papel: secretária renderiza o Modo Consulta e roda o pipeline de IA (só o salvar bloqueia) | Coerência |
| 8 | 🟡 | Auto-redirect de 5s pós-ficha briga com os 3 CTAs (mata o momento do "Gerar plano") | Dentista |
| 9 | 🟡 | DexGuide: balão diz "botão brilhando 👇" apontando pra baixo com o botão no topo; cobre a área dos toasts; persiste em toda tela | Dentista novo |
| 10 | 🟡 | Acessibilidade: card de ficha é um clicável gigante com botões aninhados (engole cliques/leitores de tela); chips de status e ícones sem semântica | Todos |

---

## 1. PROGRAMADOR — código, segurança, desempenho

### 1.1 Verificado como CORRIGIDO desde a auditoria de 09/07 ✅

- **5 rotas Groq disfarçadas de Gemini** → todas checam `GROQ_API_KEY` agora; logs com provider correto (visto ao vivo: `[ai] {"feature":"formatar-evolucao","provider":"groq",...}`).
- **Visão consolidada em Gemini 2.5 Flash** (`extrair-imagem`, `receipt-handler`, `sugerir-orcamento`, `processar-documento`) — OpenAI fora do código (SDK órfão no package.json, ver 1.4).
- **Cluster orçamento #13/#14/#15**: `lib/valor-br.ts` (parse no blur) em todos os inputs; `StatusOrcamento` sem `'pago'`; `handleStatusChange` com `toast.error`. Sobra só o tipo `OrcamentoRow.status` em [page.tsx:30](src/app/dashboard/orcamentos/page.tsx:30) ainda listando `'pago'` (órfão inofensivo).
- **Fix de voz da ficha** (`data.transcricao`) aplicado.
- **Spec-9 performance**: partículas congelam após ~2.5s + `prefers-reduced-motion` + `document.hidden`; blobs estáticos; `optimizePackageImports`; `framer-motion` removido.
- **Spec-18**: `PageContainer` em uso (dashboard usa `variant="wide"`).
- **Webhook WhatsApp fail-closed + timingSafeEqual**; `error.tsx`/`not-found.tsx`; migrations 094–096 aplicadas; `vercel.json` com cron diário.
- **Advisors de segurança:** restam só os intencionais (11 helpers de RLS p/ `authenticated` — NÃO revogar, ver memória `project_rls_helpers_authenticated_execute` — e `billing_events` deny-all) + **senha vazada desligada (ação manual sua no dashboard Auth)**.
- **Harness de silo**: continua em `supabase/tests/silo_dois_dentistas.sql` (63/63 na última execução registrada).

### 1.2 Bugs NOVOS encontrados (com evidência ao vivo)

**B1 · 🔴 Retomada do onboarding quebrada** — `src/app/onboarding/`
Reproduzido ao vivo: se o passo `identidade` submete mas o cliente não transiciona (reload, rede, crash — no meu caso o hang aconteceu 2×), o usuário volta pro formulário VAZIO com a clínica já criada. Ao re-submeter, a RPC responde `ALREADY_ONBOARDED` → [onboarding-client.tsx:158](src/app/onboarding/_components/onboarding-client.tsx:158) redireciona pro `/dashboard` — **pulando aha (demo), plano e procedimentos**. Consequências em cascata confirmadas: `onboarding_completo=false` eternamente; card "Primeiros passos" marca "Configure seus procedimentos" como concluído (riscado) sem nunca ter sido; catálogo vazio → orçamento mirado nasce todo R$ 0,00 (ver B3).
*Fix sugerido:* o guard de `alreadyOnboarded` deveria **retomar do passo certo** (ler o estado da clínica: sem plano definido → `?step=aha` ou `plano`), não ir pro dashboard; e o `page.tsx` deveria detectar "dentista existe + onboarding_completo=false" e reabrir no passo pendente com os campos preenchidos.

**B2 · 🔴 Trial infinito (100% das contas)** — dados de produção
`select status_assinatura, trial_ends_at from clinicas` → **12/12 clínicas em `trial` com `trial_ends_at = NULL`**. O fluxo novo de onboarding (`iniciarOnboarding` → RPC) cria a clínica em trial **sem data**, e nada no fluxo seta a data depois (`definirPlano` só grava plano/limite). O gate de bloqueio ([consulta/[agendamentoId]/page.tsx:22-25](src/app/consulta/[agendamentoId]/page.tsx:22)) só bloqueia se `trial_ends_at != null && < now` → **nunca dispara**. O `activateTrial` (que setaria +14d) vive em `/planos` — rota que o onboarding novo não visita. Detalhe extra: `activateTrial` força `plano: 'CLINICA'` ao ativar, contradizendo a escolha do usuário no onboarding.
*Impacto:* nenhum usuário será bloqueado/convertido. **Insumo direto pra frente de pagamento de segunda.**

**B3 · 🔴 Extração IA inconsistente: dente sem observação some do funil** — `formatar-evolucao`
Evidência SQL da ficha real salva: `dentes_afetados: [26,14,15]` mas `dentes_observacoes: {"14": ..., "15": ...}` — **sem entrada pro 26** (o canal, procedimento principal). Na 1ª rodada (texto quase idêntico) o modelo GEROU a entrada do 26 com 3 procedimentos; na 2ª não. Como `fichaParaItens` e o progresso derivam de `dentes_observacoes`, o tratamento endodôntico ficou fora do orçamento (modal mostrou só "Cárie oclusal... (D14, D15) Qtd 2") e o card mostra "0/2 realizados" contando só as cáries.
*Fix sugerido (barato, determinístico):* pós-processamento na rota — todo dente em `dentes_afetados` sem chave em `dentes_observacoes` ganha entrada derivada de `procedimentos`/`queixa_principal` (o prompt já exige isso pra sentinelas 97/98/99, linha 71 da rota; falta para dentes individuais).
*Gap menor de qualidade:* "Cárie oclusal" entrou como *procedimento* (é diagnóstico; o procedimento é a restauração) — afinar prompt/dicionário.

**B4 · 🟠 #10 × #16: "Agendar retorno" ausente na superfície unificada**
O botão só é renderizado na visão colapsada clássica ([FichasTab.tsx:1163](src/components/pacientes/FichasTab.tsx:1163)); a visão expandida D12 renderiza "Retorno: 7 dias" como texto puro ([FichasTab.tsx:1234-1239](src/components/pacientes/FichasTab.tsx:1234)). Quem trabalha na superfície unificada (o destino da spec-16) perde a ação — o `retorno_sugerido` volta a ser inerte, exatamente o que o item #10 quis matar.

**B5 · 🟠 Conflito de agenda ignora atendimento em curso** — [agendamentos/actions.ts:62](src/app/dashboard/agendamentos/actions.ts:62)
`criarAgendamento` filtra conflitos com `scheduled|confirmed|completed` — **não inclui `checked_in` nem `in_progress`**. Dá pra marcar outro paciente em cima de uma consulta acontecendo agora. O `criarEncaixe` ([:506](src/app/dashboard/agendamentos/actions.ts:506)) inclui os dois — inconsistência entre as duas funções irmãs. Bonus: `criarEncaixe` não valida que o `pacienteId` pertence à clínica (o `criarAgendamento` valida — segunda inconsistência; risco real baixo por UUID+RLS). Ambas usam janela de dia em UTC (`dateOnly + T00:00Z`) — consultas 21h+ BRT caem no dia UTC seguinte e podem escapar da checagem de conflito.

**B6 · 🟠 Não existe CI** — `.github/workflows` não existe
Com `typescript.ignoreBuildErrors: true` no `next.config.ts` (justificado pra evitar OOM), o "tsc roda separado no CI" **não roda em lugar nenhum** — a auditoria de 09/07 pedia pra confirmar; confirmado que não há gate. Um erro de tipo hoje chega em produção. (`tsc --noEmit` local está limpo hoje.)
*Fix:* workflow mínimo (typecheck + eslint + build) em PR/push.

**B7 · 🟠 Rota do Modo Consulta sem guard de papel** — [consulta/[agendamentoId]/page.tsx](src/app/consulta/[agendamentoId]/page.tsx)
Reproduzido: secretária logada abre `/consulta/[id]` via URL e a tela renderiza inteira. Ela consegue gravar/transcrever/estruturar (as rotas de IA validam só autenticação — custam tokens) e só é barrada no `salvarFichaConsulta`. Não é vazamento (secretária vê tudo por design), mas viola "secretária não atende" e desperdiça IA. *Fix:* redirect no server component quando `role === 'secretaria'`.

**B8 · 🟡 Auto-redirect pós-ficha briga com os CTAs** — [consulta-client.tsx:145](src/app/consulta/[agendamentoId]/_components/consulta-client.tsx:145)
"Ficha salva!" mostra recompensa + 3 CTAs (Gerar plano / Assinatura / Emitir documento) com countdown de **5s** → `router.push` pro perfil. Clicar no wrapper do CTA primário cancela o timer, mas o dentista lendo as opções é puxado antes. O countdown compete com o momento de alta intenção que o workstream L construiu. *Sugestão:* sem auto-redirect quando há CTAs (ou 15s+ com "Ficar aqui").

**B9 · 🟡 DexGuide desorientado e por cima dos toasts**
(a) Balão diz "Clique no botão que está brilhando 👇" com seta pra BAIXO enquanto o botão pulsante ("Entrar no Modo Consulta") está no TOPO da página — screenshot 02. (b) O balão fica fixo sobre a região das notificações: o toast "Paciente cadastrado com sucesso!" apareceu PARCIALMENTE ATRÁS dele — screenshot 06. (c) O guia persiste em TODAS as telas (pacientes, agenda, config) até ser pulado/completado.

**B10 · 🟡 Acessibilidade (3 padrões)**
(a) O header do card de ficha é um clicável gigante contendo botões reais dentro — o accessible name do "botão" é o card inteiro (foi isso que quebrou a automação: qualquer `getByRole('button', {name: /gerar orçamento/})` casa o card). Leitores de tela sofrem o mesmo. (b) Chips de status ("A fazer" → "Em andamento") clicáveis que não são `<button>`. (c) Botões-ícone (baixar/editar/excluir) sem `aria-label`.

**B11 · 🟡 Copy/consistência**
- Landing: hero "Começar **7 Dias** Grátis" vs trial de 14 dias em todo o resto (bug já registrado no roadmap #17, segue vivo).
- CTAs da landing ainda propagam `?plano=CLINICA` — o fluxo novo escolhe plano no onboarding e ignora o param (spec-A 2.7 pedia remoção).
- "Limite de **1 dentistas** atingido" (plural).
- Métricas "00" zero-padded pra zero ("00 Consultas hoje") — estética questionável.
- Modal do agendamento: status "Em Atendimento" mas botão "**Iniciar** consulta" (deveria ser "Continuar").

### 1.3 Segurança — estado consolidado

| Item | Estado |
|---|---|
| Silo multi-tenant (RLS 3 camadas) | ✅ Sólido (advisors limpos; harness existente) |
| provision_secretaria / bucket avatars | ✅ Fechados (migration 096, verificado nos advisors) |
| Webhook WhatsApp | ✅ Fail-closed + timing-safe |
| Senha vazada (HaveIBeenPwned) | 🔴 **Desligada — toggle manual no dashboard Auth (único WARN acionável restante)** |
| `WHATSAPP_APP_SECRET` / `UPSTASH_REDIS_REST_*` / `CRON_SECRET` em prod | ❓ Não verificável por mim (dashboard Vercel) |
| CI/typecheck gate | 🔴 Inexistente (B6) |
| Zod nas server actions | 🔴 Continua zero nas 13 actions do dashboard (P1-2 da auditoria aberta) — `criarOrcamento` aceita item negativo/quantidade 0; `criarPacienteRapido` sem limite de tamanho |
| Rate-limit | 🟡 11 rotas de IA cobertas, mas **`sugerir-orcamento` (Gemini, a mais cara) sem limite**; PDF/prontuário/user sem throttle |
| Vulns npm | 🟡 3 restantes: `@xmldom/xmldom` HIGH (**fix disponível via `npm audit fix` simples** — rodar), `next` 16.1.6 HIGH (advisories reais: bypass de middleware via segment-prefetch, CSRF null-origin em Server Actions — bump da linha 16.x recomendado pós-teste), 1 moderate |
| Vazamento de mensagem interna | 🟡 `formatar-evolucao` retorna `err.message` cru no 500; `salvarAssinaturaConsulta` retorna `storageErr.message` — padronizar mensagem genérica + log |
| `PLAN_OVERRIDE_EMAIL` | ⚪ Backdoor de plano por env (orcamentos/financeiro pages) — legítimo, mas não documentado em lugar nenhum |

### 1.4 Desempenho e higiene

- **Build de produção passa** (usado no teste ao vivo). `tsc` limpo.
- **ESLint repo inteiro: 33 errors / 69 warnings** — 24 dos errors são `react-hooks/set-state-in-effect` espalhados por 17 arquivos (dex-widget 16×, command-palette 14×, ApresentarPanel 8×...). Dívida antiga conhecida, nunca atacada; em React 19 esses padrões causam re-render duplo real.
- **God-components:** orcamentos-client **2.083** linhas, agendamentos-client 1.874, paciente-detail-client 1.745, FichasTab 1.455, configuracoes-client 1.296. Qualquer mudança neles é arriscada — é onde os bugs de costura (B4) nascem.
- **Landing continua pesada** (#17 pendente): rAF contínuo das partículas + blobs animados só na landing; o app em si está ok (spec-9).
- **59 casts `as unknown as`** (inalterado — `supabase gen types` resolveria a maioria).
- **`openai` ^6.27.0 órfão** no package.json (zero imports) — remover.
- **12 TODOs** restantes (era 20) — todos os relevantes são os stubs Meta (pausados por decisão).

---

## 2. DENTISTA — avaliação funcional (testada ao vivo)

**Veredito: o loop clínico entrega a promessa.** A régua "menos cliques até o resultado" é real: walk-in em 2 cliques, ficha estruturada em 1, orçamento mirado em 1.

| Fluxo | Veredito | Nota |
|---|---|---|
| Cadastro → onboarding | 🔴 Quebra na retomada (B1); nome digitado no cadastro não flui pro onboarding (redigitação) |
| Dashboard | ✅ Limpo, métricas úteis, "Atenção hoje" com pendências | DexGuide desorientado (B9) |
| Walk-in "Atender agora" | ✅✅ Excelente — busca-primeiro, seleção → cai direto na consulta (nem precisa de confirmação extra) |
| Modo Consulta (captura) | ✅ Detecção ao vivo dos dentes enquanto digita ("vinte e seis" → 26 ✓); placeholder didático |
| Estruturação IA | ✅ com ressalvas — queixa/anotações/procedimentos/conduta/**alerta de alergia**/retorno todos captados; ressalvas: consistência entre rodadas (B3), diagnóstico ("pulpite irreversível") caiu fora das anotações na 1ª rodada, "cárie" listada como procedimento |
| Revisão pré-save | ✅ Odontograma de referência (Permanentes+Decíduos, badge de contagem), multi-procedimento por dente, chips PENDENTE, "Editar relato" |
| Ficha salva → recompensa | ✅ "≈ 2 min que você não digitou" (persona ✓); CTAs certos; **mas countdown de 5s briga com eles (B8)** |
| Ficha unificada (spec-16) | ✅✅ Header com barra de ações por estado, 2 colunas (odontograma-mapa + progresso), 3 status clicáveis, "0/2 realizados" | Retorno inerte na D12 (B4) |
| Ficha → Orçamento (#6) | ✅ Modal mirado com item agrupado (D14+D15 → Qtd 2 ✓), caixa âmbar #7 com botão "Cadastrar no catálogo" ✓, validação "sem valor" bloqueia com aviso vermelho ✓ | Perde o dente principal (B3); catálogo vazio (consequência de B1) faz tudo nascer R$ 0 |
| Apresentar (L) | ✅ Header condicional → seletor de fichas (padrão do orçamento) → painel "Gerar apresentação com IA" |
| Assinatura | ✅ Modal "vire a tela para o paciente", disponível também pra recepção |
| PDF/documentos | ✅ Presentes (baixar ficha, emitir receita/atestado/pedido) — não exercitei o conteúdo do PDF |

**O que mais atrapalharia um dentista de verdade hoje:** (1) cair no buraco do onboarding e nunca ver a demo; (2) confiar que o orçamento mirado tem tudo e mandar um orçamento sem o canal; (3) não conseguir agendar o retorno de dentro da ficha expandida.

---

## 3. SECRETÁRIA — avaliação funcional (testada ao vivo)

**Veredito: o papel está bem construído — o provisionamento e o dia-a-dia de balcão fluem.** O gap é de canal (WhatsApp mudo) e de descobribilidade (encaminhamento).

| Fluxo | Veredito | Nota |
|---|---|---|
| Criação pela Equipe | ✅✅ Modal com 2 papéis, cópia clara ("A conta é criada imediatamente. Você repassa as credenciais"), senha inicial |
| Primeiro acesso | ✅✅ Login → `/primeiro-acesso` força troca → dashboard. Impecável |
| Dashboard próprio | ✅ Métricas do dia, pendências operacionais, agenda com botão **Assinar** (recepção coleta assinatura ✓), ações rápidas |
| Agenda multi-dentista | ✅ Seletor de dentista, abas "Todos/Dr.", validação "Selecione um paciente" em vermelho ✓, ao salvar navega pra data do agendamento ✓ |
| Pacientes | ✅ Vê todos (silo correto); pode cadastrar |
| Perfil do paciente | ✅ Vê ficha completa; SEM "Nova Evolução"/"Gerar orçamento" (papéis corretos); "Agendar retorno" disponível pra ela (balcão agenda ✓) |
| Encaminhamento | 🟡 Existe ("Dentista responsável" no modal Editar Paciente) mas escondido — a spec-hierarquia pedia "de forma visível". Secretária não descobre sozinha |
| Financeiro | ✅ Acessível, "Registrar Recebimento", extrato/CSV |
| Configurações | ✅ Bloqueada (redirect) — correto |
| WhatsApp (conversas) | 🟡 Página funciona, mas 0 conversas possíveis — **canal inteiro é stub** (decisão: aguardando CNPJ). O balcão não tem confirmação/lembrete real |
| Bot (config) | 🟡 `/dashboard/bot` → redireciona pra **`/planos?feature=whatsapp`** — página de venda de plano que a secretária não pode assinar. Beco sem saída de papel |
| Modo Consulta | 🟠 Acessível via URL (B7) — deveria bloquear |

---

## 4. Recomendações priorizadas

### Agora (antes do onboarding de domingo / pagamento de segunda)
1. **B1 — retomada do onboarding.** É O bug do domingo: o trabalho de onboarding planejado assenta em cima de um fluxo que quebra no primeiro reload. Corrigir a retomada ANTES de polir o conteúdo.
2. **B2 — decidir o trial.** Segunda é a frente de pagamento; a decisão "quando `trial_ends_at` é setado, e por quem" é pré-requisito de qualquer gateway. Inclui corrigir o `activateTrial` que força CLINICA.
3. **Ligar senha vazada** (1 clique, dashboard Supabase Auth) + **`npm audit fix`** (fecha o xmldom HIGH).

### Semana que vem (junto da frente de pagamento)
4. **B3 — pós-processamento determinístico** em `formatar-evolucao` (dente detectado sempre ganha observação) — barato e ataca a dor nº 1 do fundador (precisão).
5. **B4 — botão de retorno na D12** (1 componente, reusar o handler existente).
6. **B5 — incluir `checked_in`/`in_progress`** no conflito de `criarAgendamento` + validar paciente no `criarEncaixe`.
7. **B6 — CI mínimo** (typecheck+lint+build). 20 linhas de YAML que fecham o buraco do `ignoreBuildErrors`.
8. **B7 — guard de papel na rota de consulta** (3 linhas).
9. **Zod nas 2 actions de dinheiro** (`criarOrcamento`, `registrarPagamento`/`marcarPagamentoPago`) + rate-limit no `sugerir-orcamento`.

### Quando encostar nas telas (F3 / polimento)
10. B8 (countdown), B9 (DexGuide), B10 (acessibilidade do card — resolver junto de qualquer redesign do FichasTab), B11 (copy). O F3 (design-review formal) segue pendente — este diagnóstico cobriu o funcional; o passe visual fino com screenshots dos 3 surfaces está agora **desbloqueado** (o harness Playwright desta sessão faz screenshot; scripts em scratchpad/qa).
11. Encaminhamento visível pro papel secretária (elevar do modal Editar pra ação no header do perfil).
12. Dívidas: `openai` órfão, `set-state-in-effect` (24), casts (59 → `supabase gen types`), landing #17.

### Registrado, sem ação agora
- WhatsApp stub (pausado por CNPJ — decisão de 10/07). Quando voltar: os pontos de venda do papel secretária (bot → planos) precisam de rota melhor.
- `PLAN_OVERRIDE_EMAIL` — documentar no `.env.example`.
- God-components — fatiar oportunisticamente quando cada tela for tocada, não em big-bang.

---

## Apêndice — artefatos desta sessão

- **Conta de teste:** `test-diag-0712@example.com` (Dr. Diagnóstico Teste, Consultório Diagnóstico, SOLO/trial) + `test-diag-sec-0712@example.com` (secretária). Paciente "Maria Souza Teste" com 1 ficha, 2 agendamentos. **Limpar junto com as `test-*-0630@`** (SQL sob demanda).
- **Harness de QA:** scripts Playwright + screenshots em `scratchpad/qa/` (login com storage state reutilizável — resolve o bloqueio de sessão autenticada do F3).
- **Descoberta de ambiente:** o painel de browser embutido congela a página quando ocluído (task queues suspensas) — inviável pra fluxos async; Playwright via `node` com o Chromium local é o caminho pra QA neste projeto.
- `.claude/launch.json`: adicionada config `prod` (`npm run start`).
