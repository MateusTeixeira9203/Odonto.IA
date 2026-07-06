# Handoff de execução — 2026-07-05 (madrugada)

> Sessão de **planejamento** longa. Saída: 4 specs novas + 1 atualizada + 1 doc de arquitetura de IA + 1 memória. Nada codado (correto pro modo).
> **Próxima sessão: EXECUÇÃO.** Este handoff é o checklist; o "porquê" e os contratos estão nos specs — **não repetir aqui, apontar**.

## Specs de referência (fonte da verdade)
- `plans/specs/spec-hierarquia-papeis-planos.md` — papéis, silo de visibilidade, planos 2–5. **PRONTA.**
- `plans/specs/spec-precisao-extracao-consulta.md` — dicionário + prompt do Modo Consulta. **PRONTA.**
- `plans/specs/spec-arquitetura-ia-providers.md` — fusão Groq+Gemini, limpeza, GPT-4o sai. **Mapa validado.**
- `plans/specs/spec-16-ficha-unificada.md` — +D12 (layout 2 colunas 40/60). **PRONTA.**
- `plans/specs/spec-18-largura-global.md` — PageContainer + wide/comfortable. **Classificação a confirmar.**

---

## Checklist de execução (pronto-pra-codar)

### 1. IA — precisão da consulta  → `spec-precisao-extracao-consulta.md`
**Regra de ordem (gravada na spec):** esgotar prompt+dicionário no Groq ANTES de trocar modelo.
- [ ] `src/app/api/transcrever/route.ts` — usar `WHISPER_DENTAL_PROMPT` (destilado, limite ~224 tokens); matar o `DENTAL_CONTEXT` inline.
- [ ] `src/lib/odonto-dictionary.ts` — remover `.slice(0,15)`; expandir (procedimentos, variações de nome, conjuntos/quadrante/boca-toda, decíduos); fonte única.
- [ ] `src/app/api/dex/formatar-evolucao/route.ts` — reescrever prompt "sinal, não ruído"; normalização determinística pós-IA (opcional).
- [ ] **Verificar com áudios reais** (não sintético). Só puxar Gemini 2.5 Flash se ainda doer.

### 2. IA — limpeza / arquitetura  → `spec-arquitetura-ia-providers.md`
- [ ] Limpar as **5 rotas Groq disfarçadas de Gemini** (env `GEMINI`→`GROQ`, log `provider` correto): formatar-evolucao, dex/explicar, dex/briefing, dex/comunicacao, dex/simplificar. → destrava métricas em `ai_usage_logs`.
- [ ] Consolidar **visão no Gemini 2.5 Flash** e **remover OpenAI/GPT-4o** — validar radiografia (`extrair-imagem`) no Gemini antes de apagar SDK + `OPENAI_API_KEY`.
- [ ] Helper Gemini único (espelhar `lib/ai/provider.ts`).

### 3. Ficha unificada  → `spec-16-ficha-unificada.md`
- [ ] Fix de 1 palavra: `FichasTab:354` lê `data.texto` → deve ser `data.transcricao` (§10).
- [ ] Superfície única (edição↔leitura) + 3 status + odontograma-mapa (prop `colorMode`) + fonte única `fichas.procedimentos_status`.
- [ ] **D12** — modo leitura em 2 colunas: odontograma 40% esq / procedimentos+progresso 60% dir; header full-width; empilha no mobile.

### 4. Largura global  → `spec-18-largura-global.md`
- [ ] **Fase A:** criar `PageContainer` (`wide` 1536 / `comfortable` 1280); migrar as ~15 páginas do `max-w-7xl` inline.
- [ ] **Fase B (por tela):** cada densa ganha coluna/conteúdo (§5). Sinergia: destrava a ficha D12.

### 5. Hierarquia  → `spec-hierarquia-papeis-planos.md`  ⚠️ maior risco
- [ ] Migration de RLS (silo por `dentista_id`: pacientes/fichas/orçamentos/agenda/planejamentos + catálogo + horários; secretária vê tudo) + **backfill** `pacientes.dentista_id`.
- [ ] `plano-actions.ts` — gate 3→2, teto 99→5; remover `BASICO` do CHECK + migrar clínicas existentes.
- [ ] `admin`→"Criador" na UI (mantém valor no banco; perde o "vê tudo").
- [ ] **Encaminhamento:** secretária troca `pacientes.dentista_id` (ficha NÃO acompanha).

---

## Decisões / pendências antes de codar
- **[#18] Confirmar a classificação** densa vs comfortable (§4 da spec) — foi o único ponto que ficou sem "sim" explícito.
- **[Hierarquia] Migration em produção** (dev=prod, ver memória `feedback_prod_db_writes`) — **exige confirmação do usuário** antes de aplicar.
- **[Billing]** números do desconto progressivo (2→5) + provider (AbacatePay?) — fora do escopo agora.
- **[WhatsApp]** bot nível-clínica + templates (secretária/dentista) — semana dedicada, decisão do fundador.

## Ordem sugerida (a abertura de execução decide)
1. **IA leve** (itens 1+2) — barato, ataca a dor testada, limpa métricas. Baixo risco.
2. **Ficha** (item 3) — UI isolada, contrato completo, bug de voz é 1 palavra.
3. **Largura Fase A** (item 4) — mecânica barata, destrava a ficha 2 colunas.
4. **Hierarquia** (item 5) — maior/arriscada (RLS + migration prod). Sessão dedicada + confirmação.

## O que eu estava cogitando
- Ordem barato-primeiro na IA é deliberada: preserva **velocidade** (Groq) enquanto ganha precisão; só paga o Gemini (mais lento) se medir que precisa. O híbrido (voz Groq → estrutura Gemini) esconde a latência no momento certo.
- O débito das 5 rotas disfarçadas pode estar **falseando as métricas de uso de IA** há tempo — quando limpar, o `ai_usage_logs` passa a refletir o real (pode surpreender).
- Ficha D12 e #18 são o mesmo movimento (ganhar coluna com largura) — fazer #18 Fase A perto da ficha.
- Não confirmei a classificação #18 nem a migration de hierarquia — são os dois gates antes de executar esses dois.

## Como retomar
```bash
cd "C:/Users/mateu/Desktop/Odonto.IA-main"
git status   # 4 specs novas + spec-16 modificada, nada commitado
# Branch feat/fase1-onboarding-persona-loop, 1 commit à frente de main (fix de voz 4d0a457 ainda não subiu)
# Ler os specs acima antes de codar. Confirmar os 2 gates (classificação #18, migration hierarquia).
```

## Dívidas técnicas / pendências que atravessam
- [ ] Fix de voz janela-de-corrida (`4d0a457`) segue commitado e **não em produção** (decisão do handoff anterior).
- [ ] Nada do dia de execução anterior (04/07) confirmado ao vivo pelo usuário ainda.
- [ ] Itens antigos: clínica morta com 23 procedimentos órfãos; índice em `procedimentos.dentista_id`; branch órfã `claude/brave-mccarthy-8c0d24`.

## Próxima sessão
- **Modo:** execução.
- **Ler primeiro:** este handoff + `plans/roadmap/roadmap-polimento.md` + os 5 specs referenciados. Confirmar os 2 gates antes de codar.
