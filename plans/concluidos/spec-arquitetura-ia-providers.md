# Spec — Arquitetura de IA: fusão de providers (mapa + estratégia)

> Criado 2026-07-04 (planejamento). Origem: decisão do fundador de manter a **fusão Groq + Gemini** (não provider único) e usar cada modelo onde ele é melhor — "a IA é o core do produto".
> **Status: mapa validado; ações a priorizar na execução.**

---

## 1. Decisão

**Objetivo (fundador, 2026-07-04):** explorar as **melhores características de cada modelo com máxima eficiência** — juntando os dois numa mesma tarefa (pipeline) ou usando um só, o que render melhor. A IA é o core do produto; nenhum modelo desperdiçado no lugar errado.

**Fusão estratégica**, não purismo — mas **eficiência ≠ complexidade**: a otimização vem de **poucos padrões claros** (abaixo), não de configurar rota por rota (isso seria over-engineering, contra o enxuto do CLAUDE.md). Máximo 3 padrões + 1 helper unificado por provider.

### Forças de cada modelo
- **Groq** (Whisper + Llama 3.3 70B) — velocidade extrema, custo baixíssimo. Melhor em **voz** e **texto de volume**. Fraco em extração estruturada PT-BR; sem visão robusta.
- **Gemini 2.5 Flash** — forte em PT-BR, instruction-following, JSON estruturado, **visão nativa**, contexto longo. Custo médio. Melhor em **precisão clínica** e **imagem**.
- **OpenAI GPT-4o** — visão muito forte, mas caro. **Decisão: excluir se o Gemini Vision cobrir** (validar no caso mais exigente — radiografia). Se sair, remove SDK + `OPENAI_API_KEY`.

### Padrões de uso (poucos, claros)
- **A — Groq puro:** voz + texto de volume (transcrição, textos pro paciente, briefing).
- **B — Gemini puro:** precisão de extração + toda a visão.
- **C — Híbrido (só onde vale):** Groq rápido → Gemini refina. **Caso claro: a consulta** — Groq transcreve a voz (barato/rápido), Gemini 2.5 Flash estrutura a ficha (preciso). Cada um no que é melhor, sem dobrar custo à toa.

---

## 2. Estado atual (mapa real — 3 providers)

| # | Feature / Rota | Tarefa | Provider hoje | Obs |
|---|---|---|---|---|
| 1 | `api/transcrever` | voz → texto | **Groq** Whisper large-v3-turbo | ✓ ideal. Não usa o prompt FDI do dicionário (ver spec-precisao) |
| 2 | `api/dex/formatar-evolucao` | **estruturação da consulta** (núcleo) | **Groq** Llama 3.3 70B | ⚠️ checa `GEMINI_API_KEY` (vestígio). As 3 dores moram aqui |
| 3 | `api/gerar-planejamento` | texto do plano p/ paciente | **Groq** Llama 3.3 70B | ✓ checa GROQ |
| 4 | `api/importar-procedimentos` | parsing de lista | **Groq** Llama 3.3 70B | — |
| 5 | `api/dex/explicar` | explicar procedimento p/ paciente | **Groq** Llama 3.3 70B | ⚠️ checa `GEMINI_API_KEY`; loga `gemini-2.5-flash` (falso) |
| 6 | `api/dex/briefing` | briefing clínico p/ dentista | **Groq** Llama 3.3 70B | ⚠️ mesmo vestígio Gemini |
| 7 | `api/dex/comunicacao` | mensagens p/ paciente | **Groq** Llama 3.3 70B | ⚠️ mesmo vestígio Gemini |
| 8 | `api/dex/simplificar` | simplificar linguagem | **Groq** Llama 3.3 70B | ⚠️ mesmo vestígio Gemini |
| 9 | `api/sugerir-orcamento` | evolução → itens de orçamento | **Gemini** 1.5 Flash | ✓ real; já injeta tabela de preços da clínica |
| 10 | `lib/whatsapp/receipt-handler` | comprovante PIX → dados | **Gemini** 1.5 Flash **Vision** | ✓ real (visão) |
| 11 | `dashboard/pacientes/[id]/actions` | imagem/documento → texto | **Gemini** 1.5 Pro (REST) | ✓ real (visão) |
| 12 | `api/extrair-imagem` | foto ficha / radiografia → texto | **OpenAI** GPT-4o Vision | ✓ real (visão) |

**Resumo:** Groq faz 8 (voz + todo o texto). Gemini faz 3 (1 texto + 2 visão). OpenAI faz 1 (visão).

---

## 3. Débito técnico achado

1. **5 rotas Groq "disfarçadas de Gemini"** (#2, 5, 6, 7, 8): checam `GEMINI_API_KEY` e/ou logam `provider: 'gemini'` — mas rodam Groq. Consequências:
   - **Métricas erradas** em `ai_usage_logs` (contam como Gemini o que é Groq).
   - **Dependência falsa:** se a `GEMINI_API_KEY` for removida, essas rotas quebram (500) mesmo com Groq ok.
   - **Fix:** trocar checagem p/ `GROQ_API_KEY` e corrigir o `provider`/`model` do log.
2. **Visão fragmentada em 2 providers** (Gemini em #10/#11, OpenAI em #12) — sem razão clara; dois SDKs, duas keys.
3. **Modelos Gemini defasados:** #9/#10 usam `gemini-1.5-flash`, #11 usa `gemini-1.5-pro` — versão antiga. Padronizar em **Gemini 2.5 Flash**.

---

## 4. Estratégia recomendada (por camada)

| Camada | Rotas | Provider recomendado | Racional |
|---|---|---|---|
| **Voz** | #1 | **Groq** Whisper | Imbatível em custo/velocidade. Só melhorar o prompt FDI |
| **Extração clínica** (precisão crítica) | #2 | **Groq afinado → Gemini 2.5 Flash se não bastar** | As 3 dores. Tentar prompt+dicionário no Groq (barato); subir p/ Gemini é a fusão mais benéfica |
| **Texto p/ paciente** (volume) | #3, 5, 7, 8 | **Groq** | Texto persuasivo, não extração; barato e bom o suficiente. Upgrade pontual a Gemini só se a escrita decepcionar |
| **Briefing/análise** | #6 | **Groq** (candidato a Gemini) | Resumo clínico; Groq serve, Gemini se precisar de nuance |
| **Orçamento** | #9 | **Gemini** (ok) ou baratear p/ Groq | Já funciona e usa catálogo; dentista revisa |
| **Visão** | #10, 11, 12 | **Consolidar tudo em Gemini 2.5 Flash Vision** | Barato e forte; remove o OpenAI (menos 1 provider/key). Reservar GPT-4o só se radiografia exigir |

**A fusão em 1 frase:** Groq carrega voz + texto de volume; Gemini entra na **precisão da extração** e em **toda a visão**; OpenAI sai (absorvido pelo Gemini), salvo exceção de radiografia.

---

## 5. Ações (priorizar na execução)

- [ ] **Limpar o débito** das 5 rotas Groq disfarçadas (env + log corretos) — destrava métricas reais e remove dependência falsa da key.
- [ ] **Consolidar visão no Gemini 2.5 Flash e remover o OpenAI/GPT-4o** — migrar `extrair-imagem` (#12) pro Gemini; subir #10/#11 de 1.5 → 2.5. **Validar antes:** Gemini Vision na radiografia (caso mais exigente). Se cobrir, apagar SDK + `OPENAI_API_KEY`; se não, GPT-4o fica **só** na radiografia.
- [ ] **Extração da consulta (#2):** executar `spec-precisao-extracao-consulta.md` (prompt+dicionário no Groq); medir; subir p/ Gemini 2.5 Flash se ainda doer.
- [ ] Padronizar o acesso ao Gemini num helper único (hoje: `@google/genai` em uns, REST em outro) — espelhar o `lib/ai/provider.ts` do Groq.
