# Roadmap 3.1 — Núcleo clínico compartilhado (14/07/2026)

> **Criado:** 2026-07-14. **Supersede** `roadmap-3-fases-2026-07.md` (12/07), que continua em
> `plans/roadmap/` como referência até o Mateus validar este — depois vai pra `plans/concluidos/`.
> **Origem:** um dia numa clínica de referência (Mateus, 14/07) → **3 mudanças estruturais de fluxo**
> que o roadmap anterior não previa. Não invalida o 3-fases; reprioriza em cima dele.
> **Status:** RASCUNHO pra leitura do Mateus (manhã 15/07). Contém **1 decisão-chave marcada ⚠️**
> que precisa do "confirmo" dele antes de virar spec.
> **Vivo, não contrato:** append no fim; decisões grandes adaptam aqui. `plans/` é memória —
> concluídos vão pra `plans/concluidos/` (**arquivados, nunca apagados** — evolução da regra
> append-only do CLAUDE.md, ver §"Setup" no fim).
> Legenda: 🔴 a fazer · 🟡 em andamento · ✅ feito · ⏸️ adiado · ⚠️ decisão pendente.

---

## ⚠️ A DECISÃO QUE TRAVA TUDO — hierarquia: silo-padrão + compartilhamento explícito

Tudo abaixo depende disto. Precisa do teu "confirmo" antes de virar spec.

**O que já está no ar (não é rascunho — é produção):** `spec-hierarquia-papeis-planos` +
`spec-seguranca-silo-validacao` implementaram **silo estrito por dentista** — migrations 089–096
aplicadas, harness `silo_dois_dentistas.sql` passando 63/63. Invariante viva: **"dentista A vê
ZERO do B"**; só a secretária vê tudo.

**O que a visita pediu:** dentistas da mesma clínica **compartilharem fichas** — atribuir a ficha
a um colega, dois dentistas anexando no mesmo caso, o outro vendo o que foi feito.

**As duas leituras (escolhi a B — confirma):**

| | Leitura A — clínica vê tudo | **Leitura B — silo-padrão + compartilhamento fácil** ✅ |
|---|---|---|
| Padrão | Todo dentista vê toda ficha da clínica | Cada um o seu (silo continua) |
| Compartilhar | Não precisa (tudo aberto) | Ação explícita: "adicionar co-responsável" → aí sim os dois veem/anexam |
| Segurança | Reverte o silo shipado por completo | **Mantém o silo**; abre só o que foi compartilhado |
| Harness | Reescrever do zero (A passa a ver B) | **Sobrevive** — A vê 0 de B *por padrão*, vê a ficha X *quando B compartilha* |
| Origem | — | É a §10 da spec-hierarquia ("compartilhamento explícito dentista→dentista, sempre consentido, nunca automático") **puxada do futuro pra agora** |

**Por que B:** foi o que teu dentista de referência validou ("cada um o seu" + "garante
segurança"), reaproveita quase tudo que está em produção, e o compartilhamento vira um recurso
**a favor** (não um buraco default). "Compartilhar de forma fácil" = ação de 1 clique, não
ausência de silo.

**Consequência da co-autoria (invariante nova):** compartilhado = **os dois ANEXAM eventos; nenhum
reescreve o que o outro assinou** (herda a fiscalização do odontograma v3, invariante #14). "Editar
a mesma ficha" vira "anexar à mesma ficha". O terceiro dentista que não é co-responsável **vê**
(se compartilhado) e **cria a própria** ficha atribuída a ele — nunca altera a alheia.

---

## As 3 mudanças estruturais da visita

### 1. Hierarquia → co-autoria / compartilhamento de ficha
Silo continua o padrão (Leitura B). Adiciona:
- **Co-responsável:** dentista dono adiciona outro dentista a uma ficha/paciente → ambos anexam.
- **Encaminhamento intra-clínica** (ex.: "preciso de um especialista em canal") = adicionar
  co-responsável + (opcional) uma **ordem de trabalho** dizendo o que precisa (ver §3 — mesmo primitivo).
- Filtro por **especialidade** ao escolher o colega (destrava a `multi-especialidade`, migrations 085/086).
- **Débito de silo relacionado:** `criarOrcamento` ainda não passa `dentistaId` explícito (mesma
  classe do bug já corrigido em `criarPacienteRapido`/`gerarParcelas`) — auditar dentro desta frente.

### 2. Modo Consulta desmembrado em dois jobs
Hoje o "modo consulta" faz tudo. Vira dois:

- **Job A — Ficha rápida no perfil do paciente.** Botão no perfil → painel de **texto livre** →
  estrutura a ficha (reusa o pipeline de IA que já existe). **Sem agenda, sem agendamento.**
  Serve o dentista **migrando agora** que quer despejar histórico/última ficha rápido. Backfill =
  data no passado, digitada pelo dentista (bate com a invariante #13 do v3: IA nunca infere `realizado_em`).
- **Job B — Cockpit do tratamento ativo** (o que o `roadmap-3-fases` chamava de superfície
  "Tratamento", Fx1). O modo consulta vira útil de verdade: **briefing com % de progresso**, mapa
  do tratamento (odontograma dos dentes em jogo), **última data + procedimentos**, aba de imagens
  (raio-x/exames), e uma **área de transcrição = rascunho de planejamento do dentista** (como ele
  pensou o caso — **NÃO é prontuário**, é anotação mutável dele; parede clara entre os dois).

**Cortes já decididos do doc `Modo consulta.md`** (enxuto por padrão): odontograma **3D fora**
(2D que já existe fica); **PiP arrastar raio-x** = experimento pra depois (ideia do Gemini, não
prioridade); automação de orçamento = **mantém o que já tem**, não reconstrói.

### 3. Protético + ordem de trabalho (primitivo unificado)
O "encaminhar caso pro colega" (§1) e o "mandar pro protético" são **a mesma operação**: uma
**ordem de trabalho anexada à ficha**, endereçada a um membro da equipe, com dente + descrição +
foto opcional (+ prazo/status). Um sistema, dois destinos.

- **Protético** = papel novo (nasce **dentro** da hierarquia da §1, não colado por fora). Escopo
  enxuto: **1–2 telas** — agenda dos prazos de entrega + confirmação. "Se a clínica usar, ótimo;
  se não, ótimo."
- **Micro-form do dentista** (dente + o que precisa + foto + "mandar") — poucos cliques, on-brand.
- **Keystone:** cada item da agenda tem toggle **"entregue"** → **pinga o dentista** que a peça
  chegou. É a única parte que serve o *dentista* (não só o protético) — fecha o loop sem ele ligar
  no laboratório. Estados mínimos: enviado → em produção → pronto/entregue.
- **Pendente (decisão de produto, não trava a spec):** protético é seat pago ou grátis no plano?

### (base) Odontograma v3 — reconciliado como FUNDAÇÃO, não "mais um modo consulta"
A `spec-modo-consulta-v3-odontograma` (aguardando aprovação) **não morre** — ela vira o **motor de
odontograma** por baixo dos Jobs A e B. **Sobrevive:** motor event-log, perio, fiscalização/assinatura
(#13/#14), fix do "briefing preto". **Reenquadra:** a camada "modo consulta" dela passa a ser o Job B.

---

## Mapa de specs (ordem por dependência)

| # | Spec | Depende de | Status |
|---|---|---|---|
| 1 | **Hierarquia 3.1** — co-autoria + compartilhamento explícito (revisa `spec-hierarquia` + o harness de `spec-seguranca-silo`) | — (fundação) | ⚠️ trava na decisão acima |
| 2 | **Ficha compartilhada / co-autoria** — modelo de append, adicionar co-responsável, visibilidade | 1 | a escrever |
| 3 | **Ordem de trabalho + protético** — primitivo unificado + agenda/confirmação do protético | 1, 2 | a escrever |
| — | **Odontograma v3** — aprovar como fundação (já escrita) | — | aguardando aprovação |
| 5 | **Job A — ficha rápida no perfil** | 1, 2, v3 | a escrever |
| 6 | **Job B — cockpit do modo consulta** (briefing %, aba imagens, rascunho de planejamento) | v3 (lê de 2) | a escrever |

Paralelizável depois da 1: a 2 destrava a 3, a 5 e alimenta a 6. A v3 (aprovação) pode andar em paralelo à 1.

---

## FASE ATUAL — fundação + fechar o que está no meio do caminho
**Objetivo:** destravar o núcleo clínico compartilhado + amarrar as pontas soltas de curto prazo.

| It. | O quê | Nota |
|---|---|---|
| 🔴 | **Commit + push do parcelamento** de pagamentos | Código pronto/verificado, migração 097 já em prod, só falta subir (handoff 14/07) |
| 🔴 | **Aplicar migrations 085/086** (multi-especialidade) | Feature em código, migração pendente; destrava odontograma-por-especialidade. ⚠️ prod=dev, confirmação explícita |
| 🔴 | **Aprovar/ajustar odontograma v3** | Mateus terminando de ler; vira fundação (não "modo consulta" isolado) |
| 🔴 | **Spec 1 — Hierarquia 3.1** (após a decisão ⚠️) | Revisa `spec-hierarquia` + reescreve a assertiva do harness pra "A vê X quando compartilhado" |
| 🔴 | Auditar `criarOrcamento` sem `dentistaId` (débito de silo) | Entra junto da frente de hierarquia |

## PRÓXIMA — o que a visita pediu
| It. | O quê | Nota |
|---|---|---|
| 🔴 | **Spec 2 + build** — ficha compartilhada / co-autoria | append + co-responsável |
| 🔴 | **Spec 3 + build** — ordem de trabalho + protético | 1–2 telas, loop de entrega |
| 🔴 | **Spec 5 + build** — Job A ficha rápida no perfil | quick win pra migração de dentistas |
| 🔴 | **Spec 6 + build** — Job B cockpit (+ odontograma v3 Fatia A como fundação) | design-brief antes de componente |

## DEPOIS — carregado do 3-fases (ainda válido, não re-trabalhar)
> **Pagamento — status real (14/07):** as clínicas usando hoje são **testadoras, de graça por
> decisão** — passam Pix direto pro Mateus só pra custear a infra. O "trial infinito" (`trial_ends_at
> = NULL`) é **intencional por enquanto**, não um buraco. Logo, o fix de trial/billing **não é
> urgente agora**. Mateus vai fazer uma **pesquisa completa do modelo de cobrança (15/07)** e
> reorganiza esta seção depois — não priorizar pagamento antes disso.

- **Pagamento/trial:** decidir modelo de trial + corrigir `activateTrial` (força CLINICA, rota morta) [B2]; Zod nas actions de dinheiro; provider (AbacatePay?); billing por-dentista.
- **Recorrência — manutenção mensal:** 1 motor de recorrência (não confundir com assinatura do SaaS); agenda recorrente + cobrança mensal do paciente. Spec própria.
- **WhatsApp** (destravado pelo CNPJ): credenciais Meta, 4 stubs do `meta.ts`, cron de lembretes, beco da secretária (bot→planos).
- **Retenção:** régua de e-mails D1/D3/D7/D14/D30; relatório do DEX; reativar onboarding repensado (do zero, com brief).
- **Apresentação** (spec própria): present mode fullscreen, abrir no odontograma, imagens grandes, fechar loop `apresentar→aceitar→agendar`.
- **Endurecimento:** CI mínimo (typecheck+lint+build); Sentry; bump `next` 16.x; a11y do card de ficha; `supabase gen types` (mata 59 casts); 24 eslint `set-state-in-effect`; god-components (orcamentos-client 2k linhas etc.); limpar contas de teste em prod.

---

## O que JÁ ESTÁ FEITO (não re-trabalhar)
- **14/07:** bugs secretária/agenda em prod (commit `7b79a90` — logout, config liberada p/ dentista, secretária não edita ficha, fuso do agendamento, cadastro rápido com `dentistaId`); parcelamento de pagamentos (código pronto, **não commitado**, migração 097 em prod).
- **Leva de julho:** Ficha #16 **layout de leitura** (a unificação criar↔acompanhar e odontograma-input **NÃO** — vira Job B); Largura #18; Cluster orçamento #13/#14/#15; Leva do loop clínico; Workstreams K/L (demo + Apresentar elevado); Spec-9 perf; IA (5 rotas Groq corrigidas + visão Gemini 2.5 consolidada); **Segurança: silo 3 camadas, migrations 089–096, harness 63/63** (é o que a hierarquia 3.1 vai revisar).

## Dívidas técnicas (herdadas)
- [ ] Parcelamento commitado localmente? não — **push pendente** (banco já migrado).
- [ ] Tipos `Pagamento`/`OrcamentoComItens` duplicados client↔server.
- [ ] `criarOrcamento` sem `dentistaId` explícito (silo).
- [ ] Alertas de vencimento pro dentista (base de dados pronta, feature não desenhada).
- [ ] Redis Upstash offline em prod (rate-limit em fallback de memória).
- [ ] Senha vazada (HaveIBeenPwned) desligada — 1 clique no dashboard Auth do Supabase.
- [ ] 24 eslint `set-state-in-effect`; 59 casts; `openai` órfão; bump next 16.x.

---

## Setup — mudança na convenção de `plans/`
A regra do CLAUDE.md diz "`plans/` é append-only, nunca apague". Continua verdade pra **história**
(handoffs, decisões). Evolução: **specs/roadmaps/auditorias concluídos vão pra `plans/concluidos/`**
(arquivados, não apagados) pra manter a visão ativa limpa. Proposta de edição do CLAUDE.md pra
refletir isso está **pendente do teu ok** — não editei o arquivo mestre sozinho.

Handoffs (`plans/handoffs/`) **nunca** se movem — são o log.
