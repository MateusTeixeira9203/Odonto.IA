# Roadmap de Polimento — pré-lançamento

> Criado 2026-07-03. A camada de UX da Fase 1 (A/B/E/F/K/L + bugs) está no ar (deploy `7ba634e`, dentia.app.br).
> Junta três blocos: (1) sobras da Fase 1, (2) Parte 2 (gated na verificação E2E), (3) lista do fundador (16 itens) a discutir ponto a ponto.
> Append-only. Legenda: 🔴 a fazer · 🟡 em andamento · ✅ feito · ⏸️ gated/adiado · 🗣️ a discutir.

## 1. Sobras da Fase 1 (retenção)
| # | Item | Prioridade | Status | Nota |
|---|---|---|---|---|
| C | Régua de e-mails D1/D3/D7/D14/D30 (idempotente) | Alta | 🔴 | Destravou: deploy é Vercel → **Vercel Cron**. Precisa migration `onboarding_email_log` + rota `/api/jobs/onboarding-emails` (CRON_SECRET) + templates por persona + `vercel.json` |
| D | Relatório de valor recorrente | Alta | 🔴 | = item **4** do fundador ("relatório do DEX"). Cron + template + card in-app; métrica-âncora por persona |
| F3 | `design-review` + `impeccable-design-polish` (DEX/Apresentar/demo) | Média | 🔴 | Passo 4 do sprint, nunca rodado |
| — | Verificação E2E (gate p/ Parte 2) | Média | 🟡 | Fundador testando (03/07 à noite) |
| — | Limpar contas de teste `test-*-0630@` (+ `test-k-0630@`) | Baixa | 🔴 | SQL pronto sob demanda |

## 2. Parte 2 (gated na verificação E2E)
| WS | Item | Nota |
|---|---|---|
| G | Repaginação do Modo Consulta | Já mordido em 03/07 (multi-proc por dente, arcada, decíduos, odontograma de referência) |
| H | Dicionário odontológico / precisão de extração | = itens **10 e 11** do fundador |
| I | Secretária | = item **7** |
| J | Fluxo de convites | = item **6** |
| Billing | Trial com cartão (provider em aberto — AbacatePay?) | Fundador conduz; duração 7/14d a decidir |

## 3. Lista do fundador (16 itens) — 🗣️ a discutir ponto a ponto
| # | Item (transcrito) | Mapeia p/ | Status |
|---|---|---|---|
| 1 | Up no onboarding — modo consulta bem explicado + peculiaridades (criar paciente p/ marcar consulta, geral do sistema) | A/K (onboarding) + B2 | 🗣️ |
| 2 | Esqueci a senha | **Novo** (auth) | ✅ Site URL do Supabase corrigida (era o domínio morto `dent-ia-gamma.vercel.app` → `dentia.app.br`). Fallback: `verifyOtp` na `redefinir-senha` se cair em "Link Expirado" |
| 3 | Melhorar a recompensa (personalizada por persona) | B1 | 🗣️ |
| 4 | Relatório do DEX | = **D** | 🗣️ |
| 5 | Demo tá boa — organizar pequenos pontos de disposição | K (polish/design) | 🗣️ |
| 6 | Reavaliar o fluxo dos convites | = **J** | 🗣️ |
| 7 | Ver a integração da secretária | = **I** | 🗣️ |
| 8 | Unificar o DEX (2 designs hoje) + animações leves | F + motion (adiado) | 🗣️ |
| 9 | Otimizar o site ao máximo (carregamento) — **foco APP** (landing → #17) | **Novo** (perf) | ✅ **escopado** → `plans/specs/spec-9-performance-app.md`: fundo Opção A (partículas animam na entrada e congelam + blobs estáticos) · optimizePackageImports · lazy recharts/pdf · remover framer-motion |
| 10 | Melhorar o dicionário de odontologia | = **H** | 🗣️ |
| 11 | Modo consulta identificar só o importante | = **H** (parte já em 03/07) | 🗣️ |
| 12 | Criar paciente novo — barra de ações flutuando + sucesso silencioso | **Bug** | ✅ Barra → rodapé ancorado (full-bleed + blur + elevação, light/dark) + toast de sucesso. Falta eyeball visual |
| 13 | Valor no orçamento — input corrompe ao editar (zero grudado + 250→289) | Orçamento | 🗣️→**decidido (Opção B)**: input decimal normal, parse no blur ("250"=R$250), guarda número. Raiz: `value=formatCents` + onChange `replace(/\D/g,'')` (linhas 1224/1228 editar, 1869/1875 novo). Trocar nos 2 + alinhar input de pagamento. Sem migration |
| 14 | Status do orçamento — 'pago' órfão + falha silenciosa | Orçamento | 🗣️→**decidido (Opção A)**: 2 dimensões (comercial vs pagamento derivado). SEM migration (constraint já exclui 'pago'). Remover 'pago' do type + refs órfãs, rotular as 2 dimensões, toast no erro, verificar recusado. Vai no spec do cluster |
| 15 | Scroll travado (novo orçamento + apresentação) — não era "abas" | UI/scroll | 🗣️→**escopado**: unificar container de scroll dos slides (ApresentarPanel 472/480/513) + confirmar modal novo orç (empírico); polish visual da apresentação dobra no F3. No spec do cluster |
| 16 | Ficha unificada — criar+acompanhar numa superfície · 3 status (não iniciado/em andamento/concluído) · odontograma-mapa · quadrante · sai DEX-sugere-orçamento e anexos | Ficha/tratamento | ✅ **escopado** → `plans/specs/spec-16-ficha-unificada.md` (execução pendente; v1 sem tocar consulta) |
| 17 | **Landing** — redesenho completo + botão "Continuar com Google" direto no hero (reduz fricção de entrar→depois Google; OAuth **já existe** em `login`/`cadastro`, é reuso) + perf da landing (hoje `'use client'` total: ParticleNetwork/motion/blobs, absorve a parte "landing" do #9). Bug de copy: hero diz "7 dias", planos/FAQ dizem "14". | Landing/aquisição | 🗣️ **design-first** (brief→shotgun antes de código, regra 4) · **paralelo/pós-teste** — topo de funil, NÃO bloqueia o teste da clínica |
| 18 | **Largura global (pós-sidebar)** — sistema foi montado com sidebar (removida), mas os containers seguem em `max-w-7xl` (~1280px) e sobra tela nas laterais. Alargar o aproveitamento no sistema todo (perfil do paciente + abas, listas, agenda, dashboard). Critério: telas **densas** alargam e ganham colunas; **leitura/formulário** mantêm medida confortável. Largura extra exige **plano de uso** (colunas/painéis), não esticar vazio. Mecânico = trocar container; bem-feito = decidir layout por tela. Transversal, casa com o polish/F3. | Layout/UI | 🗣️ |

> Ao discutir cada item: definir escopo/abordagem, mover de 🗣️ p/ um passo concreto (com arquivos), e priorizar. Itens que já são C/D/F/H/I/J consolidam com o bloco 1/2.

## Transversais (descobertos na discussão)
- **Feedback de sucesso consistente** 🔴 — o form de novo paciente redirecionava **em silêncio** (corrigido com toast). Auditar outros forms que redirecionam sem confirmar: **editar paciente, agendamento, orçamento, configurações, convites**. Padronizar toast de sucesso — é sinal de confiança ("salvou mesmo?").

## Prioridade (03/07 — pré-teste com clínica grande)
**Foco hoje = funcional** (o que a clínica grande vai exercitar): **#2** (senha), **#12** (confirmar paciente), **#13/#14/#15** (orçamento), **#16** (ficha→tratamento) + testar o que mudou hoje no Modo Consulta (multi-proc, arcada, decíduos).
**Depois (pós-teste):** **#1** (onboarding — **por último**, decisão do fundador), #3 (recompensa), #5 (demo), #8 (DEX+motion), #6/#7 (convites/secretária — precisam brief), #4/C/D (réguas — features grandes), #9 (performance).
