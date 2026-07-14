# Handoff — 2026-07-13 (noite) — Planejamento: Modo Consulta v3 / Odontograma

> Sessão de discussão + planejamento (zero código de produção, conforme regra 6).
> Fechou a arquitetura do odontograma multi-especialidade que estava pausada desde o
> handoff anterior, destravou a spec sem esperar a visita à clínica piloto (o Mateus
> respondeu as 3 perguntas críticas direto), e terminou com a spec-mãe escrita pelo
> planner + 3 adendos meus (modelos por fatia, fiscalização/data/assinatura, fixes de
> formatação). Spec **aguardando aprovação formal** — o Mateus não disse "aprovo" antes
> de encerrar; a leitura dele é o primeiro passo da próxima sessão.

## Plano / spec de referência
- **Spec desta sessão:** `plans/specs/spec-modo-consulta-v3-odontograma.md` (~1150 linhas)
  — **status: aguardando aprovação do Mateus.**
- **Roadmap ativo:** `plans/roadmap/roadmap-3-fases-2026-07.md` — esta spec **fura a fila
  da Fase 2** (pagamento/WhatsApp) conscientemente; trade-off debatido e aceito pelo
  Mateus ("sem odontograma perde demo hoje — buraco de aquisição").
- **Roteiro de campo** (`plans/specs/perguntas-clinica-piloto-odontograma-2026-07-13.md`):
  visita não aconteceu formalmente ("na correria"); o Mateus mandou "esquecer as
  perguntas" e respondeu as 3 críticas ele mesmo. Roteiro vira validação pós-fatia, não gate.

## O que trabalhamos
1. **Discussão de mercado/produto do odontograma** — o Mateus trouxe pesquisa (padrão
   Simples Dental/Codental: 5 faces, FDI, cores, JSON-não-PNG). Debati a inversão central:
   odontograma como **saída do pipeline de voz** (IA propõe, dentista corrige tocando) em
   vez de canvas de input manual como os concorrentes. Mateus topou.
2. **Insight que juntou dois problemas em um:** a dor "20+ procedimentos viram lista
   ingerenciável no pós-organizar" e o odontograma são o mesmo problema — a boca pintada
   É a solução de densidade da ficha.
3. **3 respostas de campo do Mateus** (via AskUserQuestion): perio = sondagem completa 6
   pontos (Motor B é real); clínicas marcam FACES (5 zonas desde o dia 1); "todo tipo de
   paciente, fluxo alto" (todos os overlays narrados entram).
4. **Spec-mãe escrita** pelo agente `planner` (sync, ~25min) e auditada por mim.
5. **3 adendos meus à spec** pós-planner, a pedido do Mateus: (a) tabela "Modelos de IA
   por fatia" (execução Claude vs runtime do produto); (b) seção 1.10 fiscalização —
   `realizado_em` + cadeia de assinatura + invariantes #13/#14; (c) fix de formatação
   (cabeçalhos de tabela duplicados no catálogo de símbolos).

## O que concluímos
**Status geral: Completo** para o escopo da sessão (discussão fechada + spec escrita).
Nenhum código de produção tocado. Nada commitado (2 untracked: handoff anterior + a spec).
- Arquitetura fechada: odontograma único (base + overlays), anexos irmãos (periodontograma,
  ficha orto v2), âncora hierárquica `boca > arcada > quadrante > dente > face`, dois
  motores (A narrativo Gemini já em prod; B determinístico perio, zero LLM nos números),
  diff por consulta + estado acumulado por paciente (event-log, reduce via DISTINCT ON).
- Spec com: types TS, SQL completo (odontograma_eventos, perio_exames/medidas, RLS),
  catálogo de 17 símbolos, JSON Schema literal do Gemini, 6 fluxos UX, gramática de voz do
  perio, 14 invariantes, 7 casos de eval novos, 3 fatias executáveis com arquivos exatos.

## Decisões tomadas
| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Odontograma-saída (IA pinta, dentista corrige) | Canvas manual estilo concorrente como entrada primária | Diferencial real + on-brand; canvas manual é table-stakes que vira Fatia de correção por toque, não o paradigma |
| Furar a fila da Fase 2 do roadmap | Seguir pagamento/WhatsApp primeiro | Sem odontograma perde demo hoje (aquisição); Mateus aceitou o trade-off explicitamente |
| 1 documento de spec, 3 fatias executáveis com gates | 1 spec = 1 entrega única ("tudo junto", pedido inicial do Mateus) | Bug na grade perio não pode segurar a boca pintada; Mateus aceitou |
| Perio = sub-modo DENTRO da consulta (botão → grade → volta ao fluxo) | Módulo separado | Fica gravado na mesma ficha; entry point extra no perfil pra consulta só-perio |
| Estado = 2 eixos ortogonais (status × origem), cor derivada por função pura | Enum de 3 cores persistido | Decisão do planner, auditada: evita 3º campo divergente; "indicado" é coral não importa quem achou |
| Pré-existente = token novo `--color-slate` + textura pontilhada | Reusar teal/coral/warning | Colisão semântica; não-só-cor por acessibilidade |
| Ditado perio via Web Speech API (Chrome), não Whisper | Whisper por número | Latência 100-300ms vs 300-800ms; sondagem real não espera; toque sempre disponível como caminho paralelo |
| Duas camadas de visualização: arcada geral (cor dominante) + painel de detalhe 5 zonas ao tocar | 5 zonas clicáveis no SVG de ~40px da arcada | Toque impreciso/ilegível; Odontograma.tsx atual já desenha a arcada |
| `realizado_em` NUNCA inferido pela IA (fora do schema Gemini) | Extrair "restaurei ontem" para data | Dado legal não nasce de inferência probabilística — invariante #13 |
| Ficha assinada congela eventos (invariante #14) | Manter via de escape de UPDATE | Fiscalização/judicial: o que foi assinado permanece como assinado; correção = evento novo com retificação |
| Execução: Sonnet nas 3 fatias com gatilhos definidos pra Opus 4.8; design-brief direto em Opus | Opus em tudo | Spec congelou ambiguidades; tabela "Modelos de IA por fatia" no topo da spec |

## Desvios do plano original
| Item do plano | O que aconteceu na prática | Impacto |
|---|---|---|
| Handoff anterior previa spec do odontograma SÓ após visita à clínica piloto | Mateus dispensou a visita e respondeu as 3 perguntas ⭐ ele mesmo | Spec destravada; ordem dos 6 sítios de sondagem ficou como assunção nomeada (1 linha pra corrigir) |
| Spec seria "escrever depois de ouvir a conversa sobre hierarquia de papéis" | Hierarquia nem foi mencionada pelo Mateus nesta sessão | Continua pendente do handoff anterior — não esquecer |

## Erros encontrados e como pensei em resolver
| Erro / problema | Causa (ou hipótese) | Como eu estava pensando em resolver | Resolvido? |
|---|---|---|---|
| "Briefing fica preto na hora do organizar" (relato do Mateus) | Diagnóstico do planner: 3 estados soltos (`isFormatando`, `evolucao`, `saved`) fazem sidebar sumir e overlay `bg-bg/90` trocar em renders dessincronizados — frame quase-preto em dark mode | Correção PRESCRITA na spec (Fatia A): state machine única `fase: 'captura'\|'organizando'\|'confirmando'\|'salvo'` derivando sidebar E chave do AnimatePresence do mesmo valor | Não — especificado, não implementado |
| Heredoc único estourou o limite do Bash ao planner escrever a spec | Documento de 1076 linhas > limite de comando | Planner reescreveu em ~25 blocos `cat >>` e validou (fences pares, numeração íntegra) | Sim |
| Catálogo de símbolos com cabeçalho de tabela repetido no meio (2×) | Artefato da escrita em blocos | Removi as 2 linhas duplicadas com Edit | Sim |

## Arquivos alterados
| Arquivo | Mudança |
|---|---|
| `plans/specs/spec-modo-consulta-v3-odontograma.md` | NOVO — spec-mãe (planner) + meus adendos: seção "Modelos de IA por fatia", seção 1.10 fiscalização, `realizado_em` no type/SQL/constraint, invariantes #13/#14, linhas novas na tabela da Fatia A (assinatura-modal, prontuario-html/pdf), fix tabelas |
| `plans/handoffs/handoff-2026-07-13-planejamento-odontograma-v3.md` | NOVO — este arquivo |

Nenhum arquivo de `src/` tocado. Working tree: só os 2 handoffs + spec untracked (o handoff da manhã, `handoff-2026-07-13-execucao-consulta-ia-v2.md`, também nunca foi commitado).

## O que ficou pra próxima sessão
1. **[CRÍTICO] Mateus ler e aprovar a spec** — ele pediu pra fechar o dia antes de dizer
   "aprovo". Sem aprovação formal, nada de código (regra 2). Atenção às 2 assunções que a
   spec pede pra ele validar: ordem dos 6 sítios de sondagem; consultórios rodam Chrome desktop.
2. **[ALTO] `design-brief` da Fatia A** (Opus 4.8, conforme tabela de modelos): ToothDetailPanel
   (5 zonas + raiz), lista agrupada da confirmação, e adiantar o da grade perio se sobrar.
   Produz DESIGN.md antes de QUALQUER componente.
3. **[ALTO] Execução Fatia A** (Sonnet): migração + types + Motor A estendido + componente
   + confirmação remodelada + fix briefing preto + exame inicial + realizado_em/assinatura.
   Gate: eval ≥6/7, build limpo, dogfood na clínica.
4. **[MÉDIO] Hierarquia de papéis** — pendência herdada de 2 handoffs: ouvir a conversa do
   Mateus antes de tocar `spec-hierarquia-papeis-planos.md`; auditar se a RLS silo (§3) já
   foi migrada.
5. **[MÉDIO] Redis Upstash offline em prod** — ação manual do Mateus (recriar banco ou
   remover envs), herdada do handoff anterior.
6. **[BAIXO] Commitar os handoffs/spec** — 3 arquivos de plans/ untracked; commit só
   com sinal do Mateus (regra de commit no fim de sessão de execução — esta foi planejamento).

## O que eu estava planejando / cogitando
- **Ordem que eu ia propor na retomada:** aprovação → design-brief Fatia A → executar Fatia A
  inteira numa sessão de execução dedicada (é grande: ~11 arquivos). Se a sessão apertar,
  o corte natural é: migração+types+Motor A+eval primeiro (backend puro, testável por eval),
  componente+confirmação depois — mas NÃO fatiar oficialmente, é só ordem de trabalho.
- **Risco que quero vigiar na Fatia A:** o refactor do `consulta-client.tsx` pra state
  machine é o ponto de maior chance de regressão (arquivo grande, fluxo em produção diária
  nas 3 clínicas). Gatilho de Opus 4.8 já registrado na spec se o Sonnet patinar.
- **Demo/marketing (não é da spec, é ideia de produto):** o momento "boca se pinta enquanto
  fala" é filmável — quando a Fatia A estiver no ar, sugerir ao Mateus gravar vídeo de 15s
  pra Instagram de dentista. Nenhum concorrente BR tem isso.
- **Dúvida em aberto que NÃO travei na spec:** o painel "Detectando ao vivo" (chips) poderia
  já pintar uma mini-boca em tempo real durante a captura — decidi deixar FORA da Fatia A
  (a rota detectar-consulta só ganha `status` no chip) pra não inflar; se o Mateus pedir,
  é extensão natural pós-A.
- **Obsidian:** não salvei nada no vault — a decisão de arquitetura está integralmente na
  spec (fonte da verdade). Se o Mateus quiser o resumo executivo no brain_m, fazer na retomada.

## Como retomar
```bash
cd "C:/Users/mateu/Desktop/Odonto.IA-main"
git log --oneline -3   # e6fb7bd no topo; working tree com 3 untracked de plans/
# 1º passo: Mateus lê plans/specs/spec-modo-consulta-v3-odontograma.md e aprova/ajusta
# 2º passo (aprovada): design-brief da Fatia A (Opus) → DESIGN.md → execução (Sonnet)
```

## Dívidas técnicas registradas
- [ ] Herdada: Redis Upstash offline em prod (rate-limit em fallback de memória).
- [ ] Herdada: auditar se spec-hierarquia-papeis já foi parcialmente implementada (RLS §3).
- [ ] Herdada: 24 erros eslint `set-state-in-effect`, `openai` órfão, 59 casts, bump next 16 — Fase 3/H5.
- [ ] Herdada: re-rodar eval do sentinela de arcada (97/98/99) contra o Gemini.
- [ ] Nova: handoff da manhã (`handoff-2026-07-13-execucao-consulta-ia-v2.md`) segue untracked junto com a spec — commitar os 3 arquivos de plans/ na próxima sessão de execução.
