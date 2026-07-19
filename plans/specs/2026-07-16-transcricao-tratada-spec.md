# Spec: Transcrição tratada da consulta

> **Status:** agreed — aprovada pelo Mateus em 16/07 (acesso, geração no save, posição na ficha)
> **Data:** 2026-07-16
> **Origem:** `plans/roadmap/roadmap-3.1-2026-07-14.md` fila #6 · confirmada pelo Mateus 16/07
> (*"seria um acréscimo muito grande pro sistema"*)
> **Modelo de execução:** Sonnet
> **⛔ Sequenciamento:** sem migration própria, mas mexe em `consulta-client.tsx`,
> `consulta/actions.ts` e `FichasTab.tsx` — a mesma árvore não commitada da Spec 1/Fatia A.
> Executa **pós-gate de sábado** (099 + harness + commit) e **não simultânea com o Job A**
> (mesmos arquivos — uma frente de cada vez; a ordem entre elas é livre).

---

## 1. Problema

Hoje a transcrição da consulta **some 100%**: 0 de 13 fichas do modo consulta guardaram o
relato; `fichas.transcricao` existe no schema desde sempre e **nunca foi preenchida uma vez**
(auditado 16/07 — nada no código lê nem escreve a coluna). O dentista dita a consulta inteira,
a IA estrutura a ficha (resumo), e o relato completo — o documento mais fiel do que aconteceu —
é jogado fora no F5.

A ficha resume (2–6 frases). O relato completo serve pro que o resumo não cobre: relembrar o
caso meses depois, defender uma conduta, e dar ao colega que assume o caso (regra 3.1) o
contexto integral, não só a manchete.

**Decisão de produto já tomada (16/07):** não salvar a transcrição **bruta** — ela vem cheia
de small talk, erro fonético e ruído. Salvar a versão **tratada**.

## 2. Escopo

**Cobre:**
- **Tratamento IA do relato** no salvar da consulta: o `textoLivre` acumulado (ditado e/ou
  digitado) passa por uma limpeza fiel e vira `fichas.transcricao`.
- **Exibição:** seção colapsável "Relato da consulta" na expansão da ficha (FichasTab) +
  seção no PDF da ficha individual. Com rótulo explícito de tratamento por IA.
- **Acesso:** herda a RLS da ficha (099) — clínica lê, autor escreve. **Zero migration,
  zero policy nova** (decisão do Mateus 16/07: registro clínico é da clínica; o colega que
  assume o canal lê o relato completo).

**NÃO cobre (fora de escopo):**
- **Áudio.** `audio_url` continua zerado e o bucket `audios` sem uso. Persistir a voz do
  **paciente** tem peso LGPD/consentimento que ninguém decidiu + custo de storage. Se entrar
  um dia, é decisão explícita do Mateus com termo de consentimento junto — não um upsert.
- **Rascunho de planejamento privado do dentista** ("como pensei o caso") — é a outra metade
  da nota do roadmap e **não é isto**: seria conteúdo privado do autor, nasceria em tabela
  própria. Fica pra quando houver demanda real.
- **Job A / ficha rápida:** continua NÃO persistindo relato (invariante #7 da spec dela,
  inalterada). Se o Mateus quiser transcrição tratada lá também, é revisão daquela spec.
- Edição do texto tratado, busca no texto, prontuário compacto (só o PDF da ficha individual).

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| **Aberta pra clínica** — preenche `fichas.transcricao` existente | Tabela nova privada do autor (+migration 101 +RLS +harness) | Decisão do Mateus 16/07. Coerente com a regra 3.1; a ficha aberta já deriva do mesmo relato; zero migration |
| **Gera no SALVAR**, dentro da `salvarFichaConsulta`, awaited | (a) mesma chamada do organizar; (b) rota própria disparada em paralelo com o organizar; (c) fire-and-forget pós-save | (a) engorda o contrato compartilhado e roda a cada re-organizar; (b) trata versão do texto que ainda pode mudar; (c) em serverless o pós-return pode morrer. No save = trata a versão final, 1× por consulta |
| **Fail-soft:** falha do tratamento NÃO bloqueia o save | Falhar o save junto | O documento anexo não pode fazer a ficha de refém. Ficha salva sem transcrição + toast informando. (≠ do fail-open de segurança da RPC — aqui não há decisão de acesso em jogo) |
| **Sem rota HTTP nova** — lib `tratarTranscricao()` chamada pela server action | `POST /api/dex/tratar-transcricao` | A action já é autenticada e o tratamento só acontece dentro dela; rota pública seria superfície à toa |
| **Imutável no v1** | Texto tratado editável | Documento gerado, rotulado como IA. A correção clínica acontece na FICHA (que é o registro oficial e editável). Editável = reabrir discussão de autoria/assinatura |
| **Tratar ≠ resumir** | "Resumo expandido" | A ficha já resume. O tratado preserva o conteúdo clínico INTEGRAL, na ordem falada — só remove ruído e corrige fonética |

## 4. TypeScript — contratos

```typescript
// ── NOVO · src/lib/ai/tratar-transcricao.ts ─────────────────────────────────
// Chamada SÓ por server actions (nunca client). Nunca lança pro caller: falha → null.
export async function tratarTranscricao(params: {
  texto: string;          // textoLivre acumulado (voz e/ou digitado), cap 50_000 chars
  pacienteNome?: string;
}): Promise<string | null>;

// Wire interno (Gemini structured output, mesma infra do formatar-evolucao):
interface TranscricaoTratadaWire { transcricao_tratada: string }
// generateStructuredGemini + buildDentalContext() + logAICall({ feature: 'tratar-transcricao', … })

// ── ALTERADO · salvarFichaConsulta (consulta/actions.ts) ────────────────────
// Param novo, opcional — chamadas antigas continuam válidas:
{ …paramsAtuais; relato_bruto?: string }
// Comportamento: relato_bruto?.trim() → transcricao = await tratarTranscricao(…);
// insert ganha …(transcricao && { transcricao }). Falha/ausência → coluna fica null.
// O retorno ganha um aviso opcional: { fichaId?, error?, avisoTranscricao?: string }

// ── ALTERADO · FichasTab ─────────────────────────────────────────────────────
// FichaDB e Evolution ganham: transcricao: string | null  (+ coluna no select)
```

**Contrato do prompt** (o que "tratado" significa — regras não-negociáveis do prompt):
1. Preservar TODO conteúdo clínico, na ordem em que foi falado. **Proibido resumir.**
2. Remover: saudação, small talk, interrupção, divagação não-clínica, fala do paciente sem
   valor clínico.
3. Corrigir erro fonético de transcrição pelo contexto + glossário (`buildDentalContext`),
   como o organizador já faz. **Proibido inventar** conteúdo, diagnóstico ou dente ausente.
4. Manter a primeira pessoa do dentista; parágrafos legíveis; pt-BR técnico.
5. Entrada digitada (não ditada) recebe o mesmo tratamento — fonte é indiferente.

## 5. Database

**Nenhuma mudança.** `fichas.transcricao text NULL` já existe (auditado 16/07: coluna virgem,
zero leitores no código). Acesso herda as policies de linha da 099. `NULL` = estado normal
(todas as 33 fichas atuais, fichas manuais e do Job A).

## 6. Componentes / UI

```
consulta-client
  └─ handleSave: passa textoLivre como relato_bruto + estado de espera
       ("Dex está arquivando o relato…" — o salvar ganha ~2–6s de tratamento)
FichasTab › expansão da ficha
  └─ seção "Relato da consulta" ← NOVA · colapsável, fechada por padrão
       ├─ POSIÇÃO: última seção da expansão, DEPOIS do grid odontograma/procedimentos.
       │    Motivo: a expansão é operacional (togglar status é a ação frequente); o relato
       │    é leitura ocasional/arquivística — não pode empurrar a operação pra baixo
       ├─ header da seção: chevron + "Relato da consulta" + badge "tratado por IA"
       ├─ só renderiza quando transcricao != null (fichas antigas/manuais: seção não existe)
       ├─ texto em parágrafos, sem controles de edição (imutável)
       └─ rodapé de procedência: "Gerado a partir do relato ditado na consulta de
            {data_atendimento} · o registro oficial é a ficha — sem edição"
api/fichas/[id]/pdf
  └─ seção "Relato da consulta" ao final, quando existir
```

## 7. Invariantes

- [ ] **#1** O relato **bruto** nunca persiste — em nenhuma coluna, storage ou log
      (`logAICall` só grava metadados, nunca payload).
- [ ] **#2** O tratamento **nunca bloqueia o save**: IA falhou → ficha salva com
      `transcricao = null` + toast. A ficha nunca é refém do documento anexo.
- [ ] **#3** Tratado = **fiel e integral**: proibido resumir, proibido inventar. `anotacoes`
      resume; `transcricao` documenta. (Gate de fidelidade em §8.)
- [ ] **#4** Acesso herda a RLS de `fichas` — nenhuma policy nova, nenhuma migration.
- [ ] **#5** Imutável no v1 — sem UPDATE de `transcricao` fora do insert; correção clínica
      acontece na ficha.
- [ ] **#6** `audio_url` permanece intocado — áudio não persiste (LGPD/consentimento).
- [ ] **#7** Rotas IA existentes intocadas — o tratamento é lib nova com feature própria na
      telemetria (`tratar-transcricao`).
- [ ] **#8** Job A continua não persistindo relato (invariante #7 daquela spec, inalterada).
- [ ] **#9** Ficha sem transcrição renderiza sem a seção — ausência é estado normal, não erro.
- [ ] **#10** Cap de entrada de 50k chars no `tratarTranscricao` — relato acima disso é
      truncado com aviso, nunca estoura a chamada.

## 8. Gates de aceite

- [ ] Consulta **ditada** com small talk plantado ("bom dia, como vai a família…") + erro
      fonético plantado ("reza no 14") → salvar → `fichas.transcricao` preenchida: small talk
      **ausente**, "resina no 14" **corrigido**, conteúdo clínico completo na ordem falada.
- [ ] Gate de fidelidade: relato de teste com 6 itens clínicos distintos → os 6 presentes no
      tratado (não resumido pra 2).
- [ ] Consulta **digitada** (sem voz) → mesmo comportamento.
- [ ] Falha de IA simulada → ficha salva normal, `transcricao` null, toast informativo
      (`avisoTranscricao`), console sem stack não tratada.
- [ ] Expansão da ficha: seção "Relato da consulta" colapsada, com rótulo de IA; ficha sem
      transcrição (as 33 atuais) **não** mostra a seção.
- [ ] PDF da ficha com transcrição tem a seção; sem, não tem.
- [ ] Dentista B abre a ficha do A e **lê** o relato (herda a leitura de clínica da 099).
- [ ] Salvar com relato longo (~1.5k palavras): estado de espera visível ("arquivando o
      relato"), UI não trava, save completa.
- [ ] Consulta demo: não gera (sem chamada de IA).
- [ ] `ai_logs` (telemetria) registra `tratar-transcricao` com latência e sucesso.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Latência no salvar (+2–6s de Gemini em relato longo) | Microcopy + spinner no botão; gate de UX cobre; se medir >8s em relato típico, reavaliar pra pós-save com `after()` — **atualizando esta spec primeiro** |
| Tratamento "resumidor" (o modelo adora condensar) | Proibição explícita no prompt + gate de fidelidade com 6 itens |
| Custo por consulta dobra (2ª chamada Gemini com o mesmo input) | Aceito — 1 chamada extra por consulta salva, telemetria própria permite medir |
| Dentista estranha texto "IA" no prontuário | Rótulo explícito de tratamento + a ficha continua sendo o registro oficial editável |

## 10. Assunções

- O modo consulta é o único produtor no v1 (ficha manual e Job A não geram).
- `salvarFichaConsulta` segue sendo o único ponto de insert do modo consulta (confirmado no
  código 16/07 — `finalizarConsulta` foi removida).
- A seção no PDF reusa o layout de seção existente da rota — sem redesign do PDF aqui.
