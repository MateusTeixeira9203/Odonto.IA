# Spec — Precisão da extração no Modo Consulta (#10 dicionário + #11 "só o importante")

> Criado 2026-07-04 (sessão de planejamento). Origem: dores reportadas pelo fundador testando o Modo Consulta com clínica real.
> **Status: PRONTA para execução** — escopo validado com o fundador.
> Núcleo do produto (CLAUDE.md: "Modo Consulta é a principal experiência; a ficha estruturada é o principal ativo"). Melhorias de baixo/médio esforço, sem rearquitetura.

---

## 1. As 3 dores (priorizadas pelo fundador)

1. **Erra o dente / número** — a IA identifica dente errado ou não converte "vinte e seis" → 26.
2. **Traz coisa demais / ruído** — a ficha vem verbosa, com o que não é clínico.
3. **Não reconhece termos que eu falo** — procedimentos/materiais que a IA não entende ou mapeia errado.

> **Fora das dores:** "não vira orçamento" NÃO foi marcado → o vínculo extração↔catálogo/orçamento fica fora desta spec.

---

## 2. Pipeline atual (3 passos)

1. **Áudio → texto:** `src/app/api/transcrever/route.ts` — Groq **Whisper large-v3-turbo** (pt), com um `DENTAL_CONTEXT` inline.
2. **Texto → ficha JSON:** `src/app/api/dex/formatar-evolucao/route.ts` — Groq **Llama 3.3 70B** (`generateStructured`), injeta `buildDentalContext()`.
3. **JSON → validação FDI → `fichas`:** valida permanentes (11–48), decíduos (51–85) e sentinelas de arcada (97/98/99); salvo por `salvarFichaConsulta` (`consulta/[id]/actions.ts`).

**Contexto de providers:** o sistema roda **dois** modelos — Groq (transcrição + estruturação da consulta) e **Gemini 2.5 Flash** (demais features DEX: explicar, briefing, comunicacao, simplificar). O passo mais importante (estruturação) está no modelo legado (Llama).

---

## 3. Frentes de trabalho

> **Princípio — dicionário como fonte única (reforço do fundador):** Groq e Gemini devem ter **acesso direto e completo** ao `odonto-dictionary.ts`. Zero cópia inline divergente (hoje `transcrever` mantém um `DENTAL_CONTEXT` próprio → eliminar). Nuance por passo:
> - **Whisper (transcrição):** limite de **~224 tokens** de prompt → recebe uma versão **comprimida e priorizada** (FDI + conversão verbal + top termos), não o dicionário inteiro. Acesso direto, mas destilado.
> - **Llama / Gemini (estruturação):** sem limite prático → recebe o dicionário **completo** (por isso o `.slice(0,15)` sai).
> - **Robustez extra:** usar o dicionário também como **normalização determinística pós-IA** — mapear coloquial→clínico em código via `PROCEDIMENTOS_MAP`, em vez de confiar 100% que a IA mapeou. Mais consistente; aplicar com cuidado pra não sobrescrever um acerto da IA.

> **Ordem de execução (regra do fundador):** esgotar primeiro **tudo que der em prompt + dicionário** (Frentes 1–4, no Groq atual). **Só depois**, se ainda faltar precisão, mexer na IA em si (Frente 5 — trocar modelo/provider). Não trocar modelo antes de espremer o barato — é o que preserva a velocidade e o custo.

### Frente 1 — Transcrição com contexto FDI (ataca "erra o dente") · baixo
- `transcrever/route.ts` usa um `DENTAL_CONTEXT` inline **sem numeração FDI**. O dicionário já tem um `WHISPER_DENTAL_PROMPT` completo (FDI 11–48, faces, sisos) — **órfão**.
- **Ação:** usar `WHISPER_DENTAL_PROMPT` na transcrição; remover o `DENTAL_CONTEXT` duplicado.
- **Cuidado:** o Whisper usa só os **~224 primeiros tokens** do prompt. Priorizar no início: conversão verbal→FDI + numeração dos quadrantes (o que erra). Se o prompt exceder, encurtar mantendo FDI no topo.
- **Consolidar** as duas rotas de transcrição (`/api/transcrever` e `/api/transcricao`) — verificar se a 2ª é legado e remover.

### Frente 2 — Dicionário mais amplo (ataca "vocabulário") · baixo–médio
- `buildDentalContext()` corta em **15 procedimentos** (`.slice(0, 15)`, [odonto-dictionary.ts:126](src/lib/odonto-dictionary.ts)) — metade do `PROCEDIMENTOS_MAP` nunca chega à IA. **Remover o slice** (ou subir o limite com folga).
- **Expandir** `PROCEDIMENTOS_MAP` e `MATERIAIS_MAP` com curadoria (pedido do fundador):
  - **Mais procedimentos** e **variações de nome** por termo (coloquial, regional, abreviado → nome clínico) — hoje é 1 termo → 1 clínico; suportar vários sinônimos apontando pro mesmo procedimento.
  - **Conjuntos / por região:** "boca toda" (sentinela 99), "arcada" superior/inferior (97/98), "quadrante" — mapear explicitamente os termos que disparam cada sentinela; avaliar um conceito de quadrante se o relato usar ("quadrante superior direito").
- **Decíduos:** `DENTES_FDI` só tem permanentes (11–48), mas o validador já aceita decíduos (51–85). Adicionar os decíduos ao dicionário pra fechar a inconsistência.

### Frente 3 — Prompt "sinal, não ruído" (ataca "coisa demais") · médio
- [formatar-evolucao:43](src/app/api/dex/formatar-evolucao/route.ts) manda *"extraia TODAS as informações"* — o oposto do #11.
- **Ação:** reescrever o prompt com foco em relevância clínica:
  - Ignorar conversa não-clínica (saudação, divagação, interrupção).
  - `anotacoes`: enxutas (2–3 frases), sem repetição, sem encher linguiça.
  - **Não inferir/inventar** o que não foi dito (regra do CLAUDE.md: a IA não inventa diagnóstico).
  - Manter os campos estruturados sempre preenchidos quando houver sinal.
- **Trade-off:** concisão vs completude. Default conservador (não perder procedimento/dente/conduta); o dentista revisa e ajusta na UI.

### Frente 4 — Corrigir checagem de env (robustez) · trivial
- `formatar-evolucao` e `transcrever` são Groq, mas `formatar-evolucao` checa `GEMINI_API_KEY`. **Trocar pra `GROQ_API_KEY`**. Não é outage hoje (a key existe pras rotas Gemini), mas mascara falhas do Groq.

### Frente 5 — Estruturação em Gemini 2.5 Flash (upgrade medível) · médio
- A estruturação usa Llama 3.3 70B. **Correção do que eu disse antes:** as rotas DEX (`explicar`/`briefing`/etc.) NÃO são Gemini — são **Groq disfarçado** (checam a key do Gemini, mas rodam Groq; ver `spec-arquitetura-ia-providers.md` §3). O Gemini **real** vive em `sugerir-orcamento`/`receipt-handler` via `@google/genai`.
- **Ação (só se 1–3 não bastarem):** migrar `formatar-evolucao` pra **Gemini 2.5 Flash** via `@google/genai` — alinhado à estratégia de fusão (Gemini na precisão da extração, Groq no volume).
- **Gate de decisão:** rodar 1–4, testar com áudios reais, medir. Puxar a 5 só se a precisão ainda incomodar.
- Mapa de providers completo: `plans/specs/spec-arquitetura-ia-providers.md`.

---

## 4. Fora de escopo (registrado, não agora)

- **Vínculo extração ↔ catálogo/orçamento** (procedimento extraído casar com nome+preço do catálogo do dentista) — não foi dor marcada.
- **Dicionário customizável por dentista** (cada um cadastra seus termos/atalhos) — v2; conecta com o catálogo por-dentista (084). Alternativa barata a considerar: injetar os nomes dos procedimentos do catálogo do dentista no contexto do prompt, pra reconhecer os termos que ELE usa.
- **Trocar de provider pra Claude** — o sistema já tem Groq + Gemini; não abrir novo provider/custo agora.

---

## 5. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/app/api/transcrever/route.ts` | usar `WHISPER_DENTAL_PROMPT`; remover `DENTAL_CONTEXT` inline |
| `src/lib/odonto-dictionary.ts` | remover `.slice(0,15)`; expandir mapas; adicionar decíduos; revisar `WHISPER_DENTAL_PROMPT` (ordem/tamanho p/ limite 224 tokens) |
| `src/app/api/dex/formatar-evolucao/route.ts` | reescrever prompt (Frente 3); corrigir env `GEMINI`→`GROQ` (Frente 4); [Frente 5: migrar p/ Gemini 2.5 Flash] |
| `src/app/api/transcricao/route.ts` | verificar se é legado e consolidar/remover |

---

## 6. Critérios de aceite

- Áudio dizendo "vinte e seis" e "dente 36" → `dentes_afetados: [26, 36]` corretos.
- Relato com conversa fiada + clínica → `anotacoes` só com o clínico, enxuto, sem repetição.
- Termos coloquiais além dos 15 primeiros (ex: "gengivoplastia", "apicectomia") → mapeados corretamente.
- `formatar-evolucao` roda com `GROQ_API_KEY` presente mesmo se `GEMINI_API_KEY` faltar.
- **Verificação real:** testar com 3–5 áudios de consulta reais (não só sintéticos) antes de dar por pronto — precisão de voz não se valida sem áudio real.

---

## 7. Invariantes

1. A IA **não inventa** dente, procedimento ou diagnóstico não mencionado.
2. Dentes fora do FDI válido (+ sentinelas) são descartados, nunca "chutados".
3. A ficha estruturada continua sendo a saída canônica (JSON tipado `EvolucaoFormatada`), nunca texto livre.
