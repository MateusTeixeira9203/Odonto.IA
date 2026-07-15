# Handoff — 2026-07-14 (noite → 15/07 00:07) — Discussão de features da clínica + reorg do plans/ + roadmap 3.1

> Sessão de **discussão/planejamento** (não execução de feature): o Mateus passou o dia numa
> clínica de referência e trouxe 3 mudanças de fluxo. Debatemos as três, achamos que uma delas
> reverte arquitetura já shipada, reorganizamos o `plans/` (arquivamos concluídos) e escrevemos um
> roadmap novo (3.1) como âncora. Dois commits **locais, não pushados**. Uma decisão-chave ficou
> **pendente pra amanhã de tarde**.

## Plano / spec de referência
- **Plano ativo (NOVO desta sessão):** `plans/roadmap/roadmap-3.1-2026-07-14.md` — supersede o
  `roadmap-3-fases-2026-07.md` (que segue em `plans/roadmap/` até o Mateus validar o 3.1).
- **Spec status:**
  - `spec-modo-consulta-v3-odontograma.md` — **aguardando aprovação** (Mateus terminando de ler).
  - `spec-hierarquia-papeis-planos.md` + `spec-seguranca-silo-validacao.md` — **implementadas/em prod**,
    mas prestes a serem **revisadas** (ver decisão pendente abaixo).
  - `2026-07-04-multi-especialidade` — código pronto, **migrations 085/086 pendentes**.

## O que trabalhamos
1. **Recap** dos 2 docs que o Mateus mandou (handoff do odontograma v3 + spec multi-especialidade).
2. **Discussão das 3 features da visita à clínica:** (a) ficha compartilhada / co-autoria entre
   dentistas; (b) protético como membro (agenda + confirmação de entrega); (c) modo consulta
   desmembrado em **Job A** (ficha rápida no perfil) + **Job B** (cockpit do tratamento).
3. **Achado grande:** a "ficha compartilhada" **reverte o silo estrito já em produção** — reenquadrou
   a spec de hierarquia inteira. Escolhi a **Leitura B** (silo continua padrão + compartilhamento
   explícito fácil), mas **não foi confirmada** — Mateus quer discutir amanhã.
4. **Reorg do `plans/`:** arquivei 12 concluídos em `plans/concluidos/` (não apaguei — regra
   append-only), esvaziei `plans/auditorias/`.
5. **Escrevi o `roadmap-3.1`** completo (âncora pro Mateus ler de manhã).
6. **2 commits locais:** parcelamento (`cf8b836`) + reorg do plans/. **Sem push** (push = deploy, fica pro ok dele).

## O que concluímos
**Status geral: Parcial.** Discussão aberta e mapeada, mas a decisão que trava tudo ficou pendente.
- ✅ Reorg do `plans/` feita (12 arquivados, auditorias limpas).
- ✅ `roadmap-3.1` escrito e commitado.
- ✅ Parcelamento commitado local (`cf8b836`) — **não pushado**, banco já migrado (097 em prod).
- ⚠️ **Pendente:** confirmação da Leitura B da hierarquia; leitura do odontograma v3; pesquisa de billing.

## Decisões tomadas
| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Hierarquia = **Leitura B** (silo-padrão + compartilhamento explícito fácil) — **A CONFIRMAR** | Leitura A (clínica vê tudo por padrão, reverte o silo) | Foi o que o dentista de referência validou ("cada um o seu" + segurança); reaproveita o silo shipado; compartilhar vira ação de 1 clique, não ausência de silo. É a §10 da spec-hierarquia puxada do futuro |
| Co-autoria = os dois **anexam**, ninguém reescreve o assinado do outro | "Os dois editam a mesma ficha" (fala original do Mateus) | Herda a fiscalização do odontograma v3 (invariante #14); "editar" vira "anexar" |
| Protético + "encaminhar caso" = **mesmo primitivo** (ordem de trabalho anexada à ficha) | Dois sistemas separados | Reduz atrito, não incha; um sistema com dois destinos (dentista-editor / protético-executor) |
| Protético = papel **dentro da hierarquia**, 1-2 telas, toggle "entregue" que pinga o dentista | Portal completo do protético / role avulso colado por fora | Serve o dentista (keystone = confirmação de volta), não vira ERP; papéis já são redesenho pendente |
| Modo consulta **desmembrado** em Job A (ficha rápida) + Job B (cockpit) | Manter "modo consulta" monolítico | Jobs distintos; Job A é quick-win pra migração de dentistas |
| Odontograma v3 = **fundação** (motor/perio/assinatura sobrevivem; camada "modo consulta" vira Job B) | Jogar a v3 fora e recomeçar | Perderia o event-log e a fiscalização já custados |
| Cortes do `Modo consulta.md`: 3D fora, PiP raio-x depois, orçamento reusa o que existe | Construir o doc inteiro | Enxuto por padrão; evita dashboard exagerado |
| `plans/` concluídos vão pra `plans/concluidos/` (arquivar, **não apagar**) | Apagar (pedido literal do Mateus) | Colide com a regra append-only do CLAUDE.md + vários arquivos untracked = perda irreversível |
| 2 commits **locais, sem push** | Push direto pra main (= deploy Vercel) | Rule 7: push/deploy é irreversível → confirmar antes |
| Pagamento/trial **não é urgente agora** | Priorizar o fix do trial infinito | Clínicas de hoje são testadoras de graça (Pix pro Mateus só pra infra); trial infinito é intencional. Mateus pesquisa billing em 15/07 |

## Desvios do plano original
| Item do plano | O que aconteceu na prática | Impacto |
|---|---|---|
| Handoff anterior: próxima sessão abriria no design-brief da Fatia A do odontograma | Mateus abriu com features novas da visita à clínica; odontograma v3 nem foi aprovado ainda | Odontograma pausado de novo; a spec continua válida esperando |
| Eu havia dito (turnos atrás) que "clínica-vê/autor-edita É o fix do bug de silo" | Ao LER as specs, vi que o silo largo (A não vê B) é **intencional e shipado**, não bug. Me corrigi na hora | Reenquadrou a hierarquia de "definir papéis" pra "reverter/estender o silo" — decisão bem maior |

## Erros encontrados e como pensei em resolver
| Erro / problema | Causa | Como resolvi | Resolvido? |
|---|---|---|---|
| Eu conflei "bug de silo" (secretária cria com dentista_id errado) com "modelo de silo" (A não vê B, intencional) | Falei de memória antes de ler as specs `hierarquia` + `seguranca-silo` | Li as duas, separei os conceitos, avisei o Mateus explicitamente da minha correção | Sim |
| Pedido de "apagar" o plans/ colide com append-only | Regra do CLAUDE.md + arquivos untracked (perda irreversível) | Propus arquivar em `plans/concluidos/`; Mateus topou ("concluídos, joga pra lá") | Sim |
| Nota do roadmap dizia que o trial infinito era "buraco de negócio" | Eu não sabia que as clínicas são testadoras grátis | Mateus esclareceu (Pix pra infra); editei a nota do roadmap pra refletir | Sim |

## Arquivos alterados
| Arquivo | Mudança |
|---|---|
| `plans/roadmap/roadmap-3.1-2026-07-14.md` | **NOVO** — roadmap-âncora (decisão da hierarquia, 2 jobs do modo consulta, protético/ordem de trabalho, odontograma v3 como fundação, mapa de 6 specs, 3 fases) |
| `plans/concluidos/` (12 arquivos) | **MOVIDOS** de roadmap/specs/auditorias — 2 roadmaps velhos, 2 auditorias, 8 specs feitas |
| `src/**` (8 arquivos) + `supabase/migrations/097` | Parcelamento — commitado em `cf8b836` |
| `plans/handoffs/handoff-2026-07-14-execucao-...` | Era untracked; entra no commit de reorg |

## O que ficou pra próxima sessão (amanhã de tarde)
1. **[CRÍTICO] Confirmar a Leitura B da hierarquia** — é o que destrava a spec 1. Sem isso, não escrevo spec. Está marcada ⚠️ no topo do `roadmap-3.1`.
2. **[ALTO] Mateus: pesquisa completa do modelo de billing** (tarefa dele, 15/07) → reorganizar a seção de pagamento do roadmap depois.
3. **[ALTO] Mateus: terminar de ler o odontograma v3** e aprovar/ajustar.
4. **[MÉDIO] Confirmar arquivar o grupo `spec-fase1-1..5`** (+ `perguntas-clinica-piloto`) — deixei ativos por dúvida; Mateus diz quais podem ir pra `concluidos/`.
5. **[MÉDIO] Aprovar a edição do CLAUDE.md** pra registrar a convenção `plans/concluidos/` (não editei o mestre sozinho).
6. **[MÉDIO] Push dos 2 commits** (`cf8b836` parcelamento + reorg do plans) quando o Mateus autorizar o deploy.
7. **[BAIXO] Aplicar migrations 085/086** (multi-especialidade) — destrava odontograma-por-especialidade.

## O que eu estava planejando / cogitando
- **Ordem que eu ia propor na retomada:** confirmação da Leitura B → acionar o `planner` pra escrever
  a **spec 1 (Hierarquia 3.1)** → depois spec 2 (ficha compartilhada) → spec 3 (ordem de trabalho + protético).
  A spec 1 reescreve a assertiva do harness `silo_dois_dentistas.sql` de "A vê 0 de B" pra "A vê X
  quando B compartilha" — esse é o ponto de maior cuidado (mexe em segurança viva).
- **Unificação que eu acho a melhor sacada da sessão:** "adicionar especialista de canal" e "mandar
  pro protético" são o mesmo objeto "ordem de trabalho". Se a spec 3 construir isso como UM primitivo,
  economiza um sistema inteiro. Vale proteger essa unificação na hora de escrever.
- **Job A como cavalo de Troia de aquisição:** o dentista migrando quer lançar histórico rápido; o Job A
  (ficha rápida no perfil, sem agenda) é o menor caminho pra ele sentir valor no dia 1. Eu priorizaria
  ele cedo, mesmo antes do cockpit (Job B), que é mais pesado.
- **Demo/marketing (herdado, ainda válido):** o momento "boca se pinta enquanto fala" (odontograma v3)
  é filmável — quando a Fatia A estiver no ar, sugerir vídeo de 15s pra Instagram.
- **Obsidian:** não salvei no vault — as decisões estão integralmente no `roadmap-3.1` (fonte da verdade),
  mesmo critério do handoff de 13/07.

## Como retomar
```bash
cd "C:/Users/mateu/Desktop/Odonto.IA-main"
git log --oneline -3   # cf8b836 (parcelamento) + o commit de reorg no topo — ambos LOCAIS, não pushados
git status --short     # deve estar limpo (working tree commitado)
# 1º passo: Mateus confirma a Leitura B no topo de plans/roadmap/roadmap-3.1-2026-07-14.md
# 2º passo (confirmada): acionar o planner pra spec 1 (Hierarquia 3.1)
```

## Dívidas técnicas registradas
- [ ] **2 commits locais não pushados** (`cf8b836` + reorg plans) — push = deploy, aguarda ok do Mateus.
- [ ] Migrations 085/086 (multi-especialidade) pendentes de aplicação.
- [ ] `criarOrcamento` sem `dentistaId` explícito (débito de silo) — auditar junto da hierarquia 3.1.
- [ ] Tipos `Pagamento`/`OrcamentoComItens` duplicados client↔server.
- [ ] Alertas de vencimento pro dentista (base pronta, feature não desenhada).
- [ ] Redis Upstash offline em prod; senha vazada (HaveIBeenPwned) desligada (1 clique).
- [ ] 24 eslint `set-state-in-effect`; 59 casts; `openai` órfão; bump next 16.x.
- [ ] Grupo `spec-fase1-1..5` + `perguntas-clinica-piloto` ainda em `specs/` — arquivar após confirmação.
