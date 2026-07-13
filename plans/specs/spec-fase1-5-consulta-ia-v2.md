# Spec Fase 1 · #5 — Modo Consulta: IA v2 (transcrição + organização + fluxo)

> **Data:** 2026-07-13 · **Modelo (execução):** Fable 5 (thread principal, esta sessão)
> **Origem:** bug de prod encontrado pelo Mateus em 12/07 (ficha multi-dente não gerava) +
> requisito novo ("dentista dita em rajadas; organizador estrutura dezenas de dentes/procedimentos
> sem falhar") + decisões do bake-off de 13/07.
> **Evidência:** `plans/specs/eval/bakeoff-resultado-2026-07-13.json` (v1) e
> `bakeoff-resultado-v2-planejado.json` (v2) — runner `bakeoff-organizacao.mjs`, casos pesados em
> `bakeoff-casos-pesados.json`.

## Decisões (fechadas em discussão, 13/07)

| # | Decisão | Motivo |
|---|---|---|
| D1 | Transcrição: `whisper-large-v3` (Groq, cheio) no lugar do `-turbo` | turbo erra número falado/termo técnico; cheio é 1 linha e continua rápido |
| D2 | Gravador: bitrate fixo ~32kbps + corte automático por silêncio (~4s) | default do browser (~128kbps) estoura o limite de 4,5MB da Vercel em ~5min; mãos de luva → menos toques. Mic sempre-aberto é PROIBIDO (privacidade do consultório) |
| D3 | Organizador: `gemini-2.5-flash`, thinking OFF, temp 0.2, `responseSchema` | bake-off: 7/8 PASS, zero falha de conteúdo, zero órfão, zero alucinação, zero erro técnico, 2,1s méd / 4,4s p95 (thinking ON = 4,6x mais lento, sem ganho) |
| D4 | `gpt-oss-120b` (Groq) descartado | tier gratuito = 8k tokens/min; 1 chamada nossa ≈ 20k → 413 em 24/24 tentativas. Inviável sem pagar Dev Tier |
| D5 | Sem fallback de provider na organização; retry 3x e erro visível | em erro o texto ditado fica intacto na caixa (custo = 1 clique); fallback manteria caminho de qualidade imprevisível vivo pra sempre |
| D6 | Prompt v2: regra "PLANEJADO TAMBÉM CONTA" + anotações elásticas | metade da vitória do bake-off: modelo derrubava dentes com procedimento indicado p/ sessão futura (28/48/37/12/22 do caso monstro) |
| D7 | Dicionário aprofundado por especialidade (9 blocos) | sistema deve cobrir qualquer especialidade que o dentista ditar |
| D8 | Botão **"Concluir consulta" → perfil do paciente** + deletar dialog morto | dentista fica "preso" pós-assinatura; único exit hoje é link sublinhado. Destino corrigido pelo Mateus 13/07: perfil (não dashboard) |
| D9 | Casos pesados viram parte permanente da suíte de eval | proteção de regressão do requisito extremo |

## Escopo

**Entra:** itens A–F abaixo.
**NÃO entra:** organização incremental por rajada (plano B só se eval falhar — não falhou);
fallback Groq no organizador; mudanças na tabela de procedimentos da clínica (cadastro/preço);
troca do modelo de transcrição pra fora do Groq; qualquer mudança no odontograma (pendência
separada, ainda não descrita pelo Mateus).

**Experimento futuro registrado (não bloqueia):** áudio direto pro Gemini (rota 2 da discussão
13/07 — pula o Whisper). Gatilho: Mateus grava 3-5 áudios reais de ditado (incluindo 1 com
ruído de consultório) → bake-off de transcrição: `whisper-large-v3` vs `turbo` vs
`gemini áudio-direto`, mesmo critério declarado. Contra-argumentos registrados: perde a etapa
de conferência do texto pelo dentista (fonte auditável da ficha assinada) e re-abre o problema
de upload de áudio grande (mitigável via upload direto ao Supabase Storage).

---

## A. Transcrição — `src/app/api/transcrever/route.ts`

```ts
model: 'whisper-large-v3',        // era 'whisper-large-v3-turbo'
```
Contrato da rota inalterado (`{ transcricao: string }`). `WHISPER_DENTAL_PROMPT` atualizado (ver D).

## B. Gravador — `src/hooks/useAudioRecorder.ts`

```ts
new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 });
```

**Corte por silêncio** (novo, no mesmo hook):
- `AudioContext` + `AnalyserNode` no mesmo stream; RMS amostrado ~10x/s.
- Estado "houve fala": RMS acima do threshold ao menos 1x desde o início.
- Se houve fala e RMS < threshold por **4s contínuos** → chama `stopRecording()` internamente e
  dispara `onAutoStop(blob)`.
- Nunca re-inicia sozinho (sem modo always-on). Threshold inicial: calibrar empiricamente
  (~0.01–0.02 de RMS normalizado); constante nomeada no topo do hook.

```ts
interface UseAudioRecorderOptions {
  /** Chamado quando a gravação para sozinha por silêncio (~4s sem fala após ter havido fala). */
  onAutoStop?: (blob: Blob | null) => void;
  /** Desliga o corte automático (default: ligado). */
  silenceAutoStop?: boolean;
}
export function useAudioRecorder(options?: UseAudioRecorderOptions): UseAudioRecorderReturn;
```

`consulta-client.tsx`: `onAutoStop` reaproveita o mesmo caminho do stop manual (transcreve e
acumula no textarea). Timer/estados visuais idênticos ao stop manual.

## C. Organizador — `src/lib/ai/provider.ts` + `src/app/api/dex/formatar-evolucao/route.ts`

### C1. Provider (novo caminho Gemini estruturado)

```ts
// provider.ts — NOVO, ao lado do caminho Groq existente (que continua p/ outras rotas)
export interface GenerateStructuredGeminiOptions {
  prompt: string;
  responseSchema: object;          // OpenAPI-subset (formato @google/genai)
  feature: string;
  timeoutMs?: number;              // default 30_000
  maxOutputTokens?: number;        // default 16_384 (config validada no bake-off)
}
export async function generateStructuredGemini<T>(
  options: GenerateStructuredGeminiOptions
): Promise<AIResult<T>>;           // AIResult.provider passa a 'groq' | 'gemini'
```

Config fixa: `model: 'gemini-2.5-flash'`, `temperature: 0.2`,
`thinkingConfig: { thinkingBudget: 0 }`, `responseMimeType: 'application/json'`.
Retry: reusa `withRetry` (3x, backoff exponencial) para 429/503/timeout. JSON inválido
(quase impossível com responseSchema) → erro direto, sem retry, sem fallback (D5).
`GEMINI_API_KEY` ausente → 500 com mensagem clara (igual padrão atual).

### C2. Contrato modelo ↔ rota (novo formato interno de pares)

O schema strict não aceita chaves dinâmicas → o **modelo** devolve pares; a **rota** converte.

```ts
// formato que o MODELO devolve (interno à rota)
interface EvolucaoWire {
  queixa_principal: string;
  anotacoes: string;
  dentes_afetados: number[];
  dentes_observacoes: Array<{ dente: string; observacao: string }>;
  procedimentos: string[];
  conduta: string;
  retorno_sugerido: string | null;
  alerta_novo: string | null;
}
```

Conversão pares → `Record<string, string>`: chave = `String(Number(dente))`; duplicatas do
mesmo dente concatenam com `\n`. **O contrato da rota com o cliente (`EvolucaoFormatada`) NÃO
muda** — `consulta-client.tsx` não é tocado por este item.

`responseSchema` (Gemini): objeto com todos os campos acima; `retorno_sugerido`/`alerta_novo`
com `nullable: true` (referência funcional: `GEMINI_SCHEMA` no `bakeoff-organizacao.mjs`).

### C3. Prompt v2 (na rota)

Base = prompt C2 atual, com estas mudanças (1-3 validadas no bake-off v2):
1. Exemplo/regra de `dentes_observacoes` no formato de pares.
2. Regra nova: **"PLANEJADO TAMBÉM CONTA"** — procedimento indicado/planejado p/ sessão futura
   entra em `dentes_afetados` e `dentes_observacoes`, com status na observação
   (ex: `"Exodontia — planejado"`). Texto integral no `promptPares()` do bake-off.
3. Anotações: "2-3 frases **(caso extenso: até 6, cobrindo os principais diagnósticos)**".
4. Regra nova — **corretor de ASR** (discussão 13/07, rota 1 do Gemini): "O relato vem de
   transcrição de voz e pode ter erros fonéticos. Corrija-os pelo contexto clínico
   ('reza'→'resina', 'pério'→'periodontia', 'canal do 36' ouvido como 'canal do 26' NÃO —
   números só corrigir se o contexto tornar o erro inequívoco). Nunca invente conteúdo novo
   ao corrigir."
5. Regra nova — **generalização**: "Termo clínico fora do glossário → use o nome clínico
   padrão brasileiro do procedimento; o glossário ancora nomenclatura, não limita cobertura."

### C4. Pós-processamento (mantido, adaptado)

Validação FDI estrita + sentinelas 97/98/99 (inalterada) · backstop de órfão
("Procedimento a confirmar", inalterado) · coerções de tipo · `logAICall` com
`provider: 'gemini'` · `withRateLimit` 20/60s inalterado. Check de env da rota muda de
`GROQ_API_KEY` → `GEMINI_API_KEY`.

## D. Dicionário — `src/lib/odonto-dictionary.ts`

Novos blocos em `PROCEDIMENTOS_MAP` (termo coloquial → nome clínico), ~60 entradas:

- **Odontopediatria:** selante, aplicação de flúor, flúor verniz, pulpotomia, pulpectomia,
  mantenedor de espaço, ulectomia, ulotomia
- **Prótese fixa:** ponte, prótese fixa, ppf, onlay, inlay, overlay, bloco, overdenture,
  coroa sobre implante, coroa de zircônia, e-max, prótese adesiva
- **Cirurgia oral:** frenectomia (lingual/labial), biópsia, drenagem de abscesso,
  tracionamento, regularização de rebordo, alveoloplastia, exposição de dente incluso
- **Ortodontia:** instalação de aparelho, manutenção ortodôntica/do aparelho, remoção de
  aparelho, alinhadores, contenção fixa, documentação ortodôntica, botão ortodôntico
- **DTM/dor orofacial:** ajuste de placa, tratamento de DTM, agulhamento
- **Urgência:** pulpectomia de urgência, medicação intracanal, curativo de demora,
  ajuste oclusal, colagem de fragmento, dessensibilização
- **Periodontia cirúrgica:** enxerto gengival, recobrimento radicular, cunha distal, splintagem
- **HOF:** toxina botulínica/botox, preenchimento, bichectomia
- **Radiologia:** panorâmica, periapical, interproximal/bitewing, documentação completa

`WHISPER_DENTAL_PROMPT`: re-priorizar dentro do limite de ~224 tokens — FDI/quadrantes primeiro
(inalterado), depois termos mais confundíveis pelo ASR (pulpotomia/pulpectomia, onlay/inlay,
frenectomia, gengivoplastia/gengivectomia, bitewing…). Não precisa listar tudo — só o que o
Whisper erraria foneticamente.

## E. Fluxo Concluir — `consulta-client.tsx` + deleção

1. Na tela "Ficha salva!": o link sublinhado "Voltar ao perfil do paciente" vira **botão
   secundário visível "Concluir consulta"** → `router.push('/dashboard/pacientes/' + paciente.id)`.
   Hierarquia: "Gerar plano de tratamento" (primário, mantido) · "Concluir consulta"
   (secundário) · "Solicitar assinatura" e "Emitir documento" (mantidos).
2. Fluxo de assinatura: exits atuais já levam ao perfil (inalterado).
3. **Deletar** `src/app/consulta/[agendamentoId]/_components/finalize-consultation-dialog.tsx`
   (código morto — nenhum import no app; conferido 13/07).
4. Status do agendamento: já vira `completed` em `salvarFichaConsulta` — nada a fazer.

## F. Eval permanente

1. Mesclar os 3 casos de `bakeoff-casos-pesados.json` em `formatar-evolucao-casos.json`
   (com os checks novos `dentes_permitidos` e `alerta_novo_nao_null` suportados pelo runner
   `run-formatar-evolucao.mjs`).
2. Gate de aceite (rodando contra build de prod local, conta de teste):
   - **≥ 7/8 casos PASS · zero órfão · zero alucinação · zero erro técnico**
   - Latência p95 da rota < 6s
   - O caso não-PASS admissível é só variação benigna de interpretação (conteúdo sem falha)

## Invariantes

- `EvolucaoFormatada` (contrato rota→cliente) byte-a-byte igual — nenhuma mudança no client
  por causa do organizador.
- Erro de IA **nunca** perde o texto ditado (estado do textarea intacto — comportamento atual).
- Guard de secretária e `withRateLimit` inalterados.
- Groq continua nas demais rotas (transcrição, etc.) — nada de troca global de provider.
- Zero `any`; tipos explícitos nos contratos novos.

## Gates de verificação (ordem)

1. `npm run typecheck` + `npm run lint` + `npm run build` limpos
2. Eval suite completa (F) contra build local — números do gate
3. QA manual (Playwright local, conta test-diag): ditar (mic real não dá — colar texto) →
   organizar caso pesado → salvar → **Concluir consulta** aterrissa no perfil · assinatura →
   perfil · erro de rede simulado mantém texto
4. Commit único no fim da sessão (regra do Mateus), push após ok

## Riscos & rollback

- `GEMINI_API_KEY` já está em prod (rota de orçamento usa) — sem env novo. **Billing
  confirmado 13/07: conta Google Cloud post-pay (tier pago, Pix)** — teto de 10 req/min do
  free tier não se aplica; capacidade resolvida. (Paralelo, fora da spec: Mateus investiga
  cobrança fixa ~R$170/mês no billing — provável plano de suporte/assinatura, não uso de API.)
- Rollback do organizador = trocar a chamada `generateStructuredGemini` de volta pra
  `generateStructured` (Groq) na rota — 1 import + 1 função; caminho Groq permanece no código.
- Corte por silêncio com threshold ruim (consultório barulhento) → flag `silenceAutoStop`
  permite desligar por código; se incomodar em prod, desliga por default em patch trivial.

---

# Adendo 13/07 (noite) — feedback de campo do Mateus

> Teste real em prod: transcrição e organizador aprovados ("os milímetros que a gente
> comia agora vêm certos; errinho o corretor pega"). Três refinamentos pedidos:

## G. Nota de planejamento/coordenação ≠ procedimento orçável

Caso de campo: dentista dita "preparar o dente pra passar pro Dr. Fulano" / "planejar
implante futuramente". Precisa aparecer na ficha (no dente certo), mas NÃO é intervenção
executável — não pode virar linha de orçamento.

Taxonomia final (refina D6/“planejado também conta”):
| Fala | Destino | Orçamento |
|---|---|---|
| feito ("extraí o 18") | observação do dente | ✅ |
| intervenção indicada ("vou extrair o 28 na próxima") | observação "— planejado" | ✅ |
| coordenação/preparo ("preparar pro protesista", "avaliar implante depois") | observação prefixada **"Planejamento: "** | ❌ nunca |

Implementação: regra no prompt do organizador (coordenação vira "Planejamento: …" e
nunca entra em `procedimentos`) + regra no `sugerir-orcamento` (ignora linhas
"Planejamento:" e frases de coordenação/encaminhamento). Sem migração, contrato intacto.
Eval ganha caso novo + check `observacao_contem` no runner.

## H. Detecção ao vivo unificada (bug de campo: ao vivo ≠ ficha final)

Diagnóstico: o painel "DETECTANDO AO VIVO" tinha DOIS cérebros dessincronizados —
chips de dente por regex client-side que só cobria permanentes (`[1-4][1-8]`; o 51
decíduo sumia) e chips de procedimento reusando `/api/sugerir-orcamento` (máx. 10
itens, tela cortava em 6, agrupamento de orçamento — o canal do 15 sumia). A ficha
final (Gemini) acertava tudo; só o preview mentia.

Fix:
1. Regex de dentes cobre decíduos: `\b([1-4][1-8]|[5-8][1-5])\b` (instantâneo, mantém).
2. Nova rota leve **`/api/dex/detectar-consulta`**: `generateStructuredGemini`, schema
   mínimo `{ procedimentos: [{ descricao, dentes: number[] }] }`, glossário + regras
   essenciais (sentinelas, achado≠procedimento, planejado incluído, coordenação como
   "Planejamento: …"), sem tabela de preços, rate-limit próprio (30/60s). O painel
   passa a mostrar TODOS os procedimentos com seus dentes, da mesma família de prompt
   do organizador. `sugerir-orcamento` volta a ser só orçamento.

## I. UI da confirmação: full-width + grade de blocos

Ao clicar "Organizar" (`evolucao && !saved`), a `ConsultationSidebar` some (o briefing
fica vazio ocupando ~1/3 da tela justo na hora de maior densidade). O container da
confirmação vira `max-w` generoso centralizado com **grid 2 colunas** (lg+): textos
(queixa/anotações/procedimentos/conduta/alertas/retorno) à esquerda; odontograma +
procedimentos por dente à direita. Lista "procedimentos por dente" ganha grade interna
(md: 2 colunas) quando muitos dentes. Mobile permanece coluna única.

## Fora deste adendo
- Ortodontia ("parte de aparelho") — especialidade mais complexa por ser relacional;
  entra na spec do odontograma modular alimentada pelas respostas da clínica piloto
  (roteiro `perguntas-clinica-piloto-odontograma-2026-07-13.md`, Bloco 5).
