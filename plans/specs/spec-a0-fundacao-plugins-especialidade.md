# Spec A0 — Fundação de plugins de especialidade + reorganização da ficha

> **Status:** ✅ **APROVADA 20/07 (Mateus)** — D1 (persistência híbrida), D2 (detecção derivada) e D3 (reusa painel) ratificadas · migration 105 = gate na Fase 3 (pedir na hora) · acumulado fora da A0 aceito · **design: o artefato-base é a referência visual canônica (aprovado pelos dentistas — não redesenhar direção, herdar)** · **Data:** 2026-07-20
> **Roadmap:** [`roadmap-A-plugins-especialidade-2026-07-20.md`](../roadmap/roadmap-A-plugins-especialidade-2026-07-20.md)
> **Base canônica:** [`odontograma-v3-preview-dentistas-artefato.html`](odontograma-v3-preview-dentistas-artefato.html) (§11 = card de registro; §12 = casos por fala)
> **Estende (não reabre):** [`spec-modo-consulta-v3-odontograma.md`](spec-modo-consulta-v3-odontograma.md) (event-log, âncora, cor derivada, fiscalização §1.10) · [`DESIGN-odontograma-v3.md`](DESIGN-odontograma-v3.md) (aprovado 18/07)
> **Job A (em cima do qual isto senta):** [`2026-07-16-job-a-ficha-rapida-spec.md`](2026-07-16-job-a-ficha-rapida-spec.md) (`CapturaLivreCard`, `useCapturaLivre`, `data_atendimento`)
>
> **Modelo de execução:** **Sonnet** — este documento congela o contrato do plugin, o pipeline 2-pass e o layout das 3 camadas; portar é implementar contra contrato, não julgar. **Exceção → Opus 4.8** só se o refactor das 3 camadas dentro do `FichasTab` (~1300 linhas, em produção, form recém-mexido pelo Job A) começar a regredir — mesmo critério que a spec v3 aplicou ao `consulta-client`. Se aparecer decisão que este documento não cobre: volta pro planejamento antes de codar.
> **IA em runtime:** nenhuma nova nesta fatia — o pass 1 (`formatar-evolucao`, Gemini 2.5 Flash com schema forçado) só ganha a instrução de `grupo_id`. Extractors de IA (pass 2) entram na A1.

---

## Visão geral

A A0 troca a ficha atual (odontograma básico + lista de procedimentos por dente) por uma ficha de **3 camadas** e cria a **fundação de plugins de especialidade**: um registry onde cada especialidade é um contrato de 5 peças, um pipeline de extração em 2 passos, e a detecção determinística de quais especialidades um relato contém. A0 não entrega nenhuma ficha de especialidade rica (endo/perio) — entrega a **estrutura** que A1–A3 preenchem, e prova essa estrutura ponta a ponta com **orto** (o plugin sem IA nova) e com o **`grupo_id` vivo** (agrupamento multi-dente que hoje está morto).

## Escopo

**Cobre:**
- Interface TS do plugin (5 peças) + registry + detecção de especialidades.
- Pipeline 2-pass: contrato de request/response dos extractors + rota de despacho (sem extractor de IA — stub que A1 preenche).
- Ficha em 3 camadas no `FichasTab`, reusando `ToothDetailPanel` e `Odontograma`.
- Card de registro §11 (genérico) + card agrupado por `grupo_id`.
- Instrução de `grupo_id` no prompt do pass 1.
- Plugin orto completo (dados + persistência + form + card; sem render de odontograma) — fecha o furo de persistência do `orto_manutencao`.

**Não cobre:**
- Ficha endodôntica / periograma / ponte / esfoliação — A1/A2/A3.
- Coluna `detalhe jsonb` no evento — desce com a A1 (1º consumidor).
- O polimento visual final da ficha — a A0 entrega a **estrutura** de 3 camadas; o acabamento é gate do próprio Roadmap A (design-brief → design-review, ancorados no artefato-base). *(O antigo #4b/Ficha v2 do 3.1 foi absorvido pelo Roadmap A em 20/07 — não existe mais como item separado.)*
- Acumulado histórico entre fichas (`GET .../odontograma-acumulado`, spec v3 §3.4) — é Fatia B; A0 renderiza os eventos **da ficha corrente** (draft ou recém-salva). Ver Invariante I11 e Risco.
- Materializar estado do odontograma; backfill de fichas antigas; qualquer das especialidades de §13.

## Assunções (validar; nenhuma bloqueia a A0)

- **A1:** `orto_manutencao` é extraído pelo pass 1 mas **não é persistido** hoje (confirmado no código: `salvarFichaConsulta` não o insere, não há coluna). A0 fecha isso. Se o Mateus lembrar de um caminho de persistência que eu não achei, ajustar a migration.
- **A2:** a Fatia A do odontograma (event-log) está em produção-**código**, não deployada (push adiado). A0 assume o event-log como fundação disponível localmente; **o push acontece no FIM do Roadmap A** (decisão do Mateus, 20/07).
- **A3:** o Job A precisa passar no dogfood ao vivo (gates §10, login-gated) **antes** de a A0 refatorar o `FichasTab` — evita empilhar não-verificado sobre não-verificado no mesmo arquivo.

---

## Decisões em aberto — recomendações

### D1 · Persistência do dado de plugin — **híbrido, decidido pela forma da consulta**

Recomendação: o campo `persistencia` do plugin declara **uma de duas formas**, e o registry trata as duas de modo uniforme.

- **`evento-detalhe` (padrão) — JSONB no próprio evento do odontograma**, validado por um Zod por-plugin. Para detalhe estruturado que pertence a **um** evento e é lido de volta **com** ele. **Endo vai aqui:** a odontometria é o `detalhe` do evento `endodontia`. Por quê: herda de graça o event-log — append-only, congela na assinatura (invariante #14), RLS núcleo clínico, `realizado_em`/autoria (exatamente o que a fiscalização §1.10 exige). Retratamento = evento novo com detalhe novo; o histórico do canal cai do log sozinho. Não cria um 2º caminho de escrita que possa divergir do log.
- **`tabela-satelite` — tabela própria com FK.** Para dado com ciclo próprio, cardinalidade "N por exame" ou **comparação entre instâncias**. **Perio vai aqui:** `perio_exames`/`perio_medidas` (já especcadas na v3 §1.8) porque precisa de série temporal comparável entre exames e tem 6 sítios × N dentes — absurdo como um JSONB num único evento.

**Por que não um dos dois pra tudo:** JSONB pra perio mataria a comparação entre exames; tabela satélite pra endo duplicaria o guard de imutabilidade/assinatura que o evento já dá. A disciplina da casa (constraint SQL forte) fica preservada onde importa — a tabela satélite tem constraint plena; o `evento-detalhe` ganha um CHECK grosso (jsonb válido; não-nulo quando o tipo exige) e o **Zod do plugin** como contrato de forma no servidor. Trade-off aceito: no `evento-detalhe` o banco não constrange o interior do payload — mas o ganho (herdar append-only + freeze da assinatura, sem 2º caminho de escrita) vale mais pra um dado legal do que a constraint de forma.

**A0 NÃO aplica a coluna `detalhe jsonb`** — declara o contrato; a A1 aplica (é o 1º consumidor). Gate de migration lá.

### D2 · Detecção de especialidades — **derivada dos eventos do pass 1, sem campo novo no modelo**

Recomendação: uma função pura `especialidadesDetectadas(evolucao)` que mapeia cada evento emitido → o plugin dono do seu `tipo` (via `tiposEvento` do registry) **+** `orto_manutencao != null` → orto. **Nenhum campo novo preenchido pelo modelo.**

- **Contra o campo novo no schema do Gemini:** seria mais uma coisa pra o modelo errar, mais superfície de eval, e duplicaria informação já implícita nos eventos (que já passam no harness). O princípio da casa é "IA operacional > conversacional; previsibilidade" — classificação preenchida por LLM é exatamente o que hallucina/deriva.
- **A favor da derivação:** determinística, zero superfície nova de modelo, e o registry **já** declara o `tiposEvento` de cada plugin — então a derivação é de graça. O conjunto detectado é o que dispara quais extractors do pass 2 rodam. Endo: o pass 1 emite `endodontia` → endo detectada → extractor de endo roda no relato original. Sem canal narrado, sem evento, sem extração — a presença de evento é gatilho sólido.

### D3 · Painel de dente na ficha — **reusa `ToothDetailPanel`, container fino, sem forkar**

Recomendação: **não** criar componente novo de painel. O `ToothDetailPanel` já tem as props exatas: `readOnly`, `eventos: OdontogramaEventoDraft[]`, `onChange`, `dataPadrao`. A ficha ganha um **container fino** (parte da camada 1) que:
- guarda qual dente está selecionado;
- mapeia os eventos da ficha (draft, no manual; recém-salvos, na visualização) pra `OdontogramaEventoDraft[]`;
- decide `readOnly` pela regra do núcleo clínico (ficha assinada **ou** usuário não-autor → readOnly).

Sem wrapper que reimplemente o painel — só fiação de estado/dado. O caminho `readOnly` do `ToothDetailPanel` já renderiza a lista de eventos sem chips/ciclo (perfeito pra visualização). Único limite: numa ficha salva o painel mostra os eventos **daquela ficha**; o estado acumulado entre fichas é Fatia B (§3.4) — fora da A0.

---

## Parte 1 — Plano de implementação

### Mudanças de arquitetura

| Arquivo | O que muda |
|---|---|
| `src/lib/especialidades/plugin.ts` | **NOVO** — interface TS `EspecialidadePlugin` (5 peças) + tipos de apoio (`EspecialidadeId`, `PersistenciaPlugin`, `PluginFormProps`, `PluginCardProps`, contrato dos extractors). |
| `src/lib/especialidades/registry.ts` | **NOVO** — o array de plugins registrados + `especialidadesDetectadas(evolucao)` + lookup `tipo → plugin`. A0 registra **orto** (completo) e stubs de metadados dos outros 7 (só `id`/`label`/`tiposEvento`/`render`, sem form/card/extractor ainda). |
| `src/lib/especialidades/orto.ts` | **NOVO** — o plugin orto: schema Zod, mapeamento do `orto_manutencao` do pass 1, card de chips, form manual. |
| `src/app/api/dex/extrair-especialidade/route.ts` | **NOVO** — rota de despacho do pass 2 (contrato §Parte 2). A0 entrega o esqueleto que valida entrada e devolve `{ ok:false, motivo:'sem-extractor' }` pros plugins sem extractor — A1 pluga o de endo. |
| `src/app/api/dex/formatar-evolucao/route.ts` | Instrução de `grupo_id` no prompt (§Parte 2 · grupo_id). Nada mais muda — `parseEventos` já resolve tag→uuid. |
| `src/components/pacientes/FichasTab.tsx` | Monta as 3 camadas (odontograma-índice + cards §11 + slot de plugins). Composição aditiva sobre o form do Job A, não reescrita. |
| `src/components/fichas/registro-card.tsx` | **NOVO** — card §11 genérico (por registro/grupo): tipo · âncora · estado · data · retroativo · CRO · assinatura. |
| `supabase/migrations/XXX_orto_manutencao_ficha.sql` | **NOVO (gate)** — persistência do orto (forma na §Parte 2 · Persistência do orto). Próximo número disponível (hoje 105). |

### Fases

#### Fase 1: Contrato + registry + detecção (Risco: BAIXO)
1. `src/lib/especialidades/plugin.ts` — interface e tipos (§Parte 2 · Plugin).
2. `src/lib/especialidades/registry.ts` — `EspecialidadeId`, o mapa `tiposEvento → plugin`, `especialidadesDetectadas`.
3. Registrar os 8 plugins com metadados mínimos (id/label/tiposEvento/render); form/card/extractor só onde já existem (orto na Fase 3).

**Verificável:** `especialidadesDetectadas` sobre a saída de eval do organizador devolve o conjunto certo por caso; typecheck estrito, zero `any`. **Dependências:** nenhuma.

#### Fase 2: `grupo_id` vivo + card §11 + card agrupado (Risco: BAIXO)
1. Instrução de `grupo_id` no prompt do pass 1 (§Parte 2).
2. `registro-card.tsx` — card §11 genérico + variante agrupada.
3. Verificar no eval (`grupo_consistente` já existe no harness).

**Verificável:** "extraí do 31 ao 41" → 1 grupo, 1 card. Eval do organizador sem regressão. **Dependências:** Fase 1 (tipos).

#### Fase 3: Plugin orto + persistência (Risco: MÉDIO — migration)
1. Migration do orto (gate — confirmar com Mateus).
2. `orto.ts` — schema, card de chips, form manual.
3. Persistir no `salvarFichaConsulta` (e no form manual da ficha) + ler de volta na render.

**Verificável:** manutenção narrada → card na ficha salva, sobrevive ao reload. **Dependências:** Fase 1.

#### Fase 4: Ficha 3 camadas no `FichasTab` (Risco: MÉDIO — arquivo grande)
1. Container do odontograma-índice reusando `ToothDetailPanel` (readOnly por autoria/assinatura).
2. Slot de camada 2 (cards §11) + camada 3 (cards de plugin detectado, só quando têm dado).

**Verificável:** ficha salva renderiza as 3 camadas; clicar num dente abre painel readOnly; plugin vazio não aparece. **Dependências:** Fases 1–3.

#### Fase 5: Pipeline 2-pass (esqueleto) (Risco: BAIXO)
1. `extrair-especialidade/route.ts` — valida entrada, despacha pelo registry, devolve `sem-extractor` onde não há.
2. Ponto de chamada no fluxo de organizar: após o pass 1, `Promise.all` dos extractors das detectadas (nenhuma na A0 — só o caminho existe).

**Verificável:** rota responde ao contrato; caminho de `Promise.all` compila e é no-op quando não há extractor. **Dependências:** Fase 1.

### Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Refactor do `FichasTab` regride o form do Job A | média | Dogfood do Job A antes; composição aditiva; Opus se regredir |
| `orto_manutencao` sem persistência era premissa falsa do prompt | alta (confirmado) | Fase 3 fecha; migration gated |
| Instrução de `grupo_id` regride casos do eval | baixa | Gate: `run-formatar-evolucao.mjs` verde antes de fechar |
| Contrato do plugin vira abstração especulativa | média | Só 2 formas de persistência e 3 formas de extractor — todas já exigidas por orto/endo/perio; nada além do que A1/A2 consomem |

---

## Parte 2 — Contrato técnico (Spec)

> Esta seção é a fonte da verdade. A implementação segue estes contratos. Desvio → atualiza aqui primeiro, depois implementa.

### 2.1 · O plugin (5 peças) — `src/lib/especialidades/plugin.ts`

```typescript
import type { z } from 'zod';
import type { ComponentType } from 'react';
import type {
  TipoRegistroOdontograma,
} from '@/types/odontograma';

/** As 8 especialidades dente-ancoradas do artefato (§3–10). Fechado — 9ª = plugin novo, não item de roadmap. */
export type EspecialidadeId =
  | 'dentistica'      // Dentística / Clínico Geral (§3)
  | 'endodontia'      // §4
  | 'cirurgia'        // Cirurgia oral (§5)
  | 'implantodontia'  // §6
  | 'protese_fixa'    // §7
  | 'periodontia'     // §8
  | 'odontopediatria' // §9
  | 'ortodontia';     // §10 — manutenção mensal

// ── Peça 1 — dados / persistência (D1) ──────────────────────────
export type PersistenciaPlugin =
  | { forma: 'evento-detalhe' }                    // JSONB em odontograma_eventos.detalhe (endo)
  | { forma: 'tabela-satelite'; tabela: string }   // FK própria, série temporal (perio)
  | { forma: 'ficha-coluna'; coluna: string };     // coluna em fichas — dado POR-FICHA, não por-evento (orto)

// ── Peça 2 — extractor do pass 2 ────────────────────────────────
export interface ExtractorRequest {
  especialidade: EspecialidadeId;
  /** Relato ORIGINAL do dentista (não a saída do pass 1) — o extractor lê a narrativa crua. */
  texto: string;
  /** Contexto do pass 1: dentes que esta especialidade tocou (endo: dentes com canal). */
  contexto: { dentes: number[] };
}
export type ExtractorResult<TDetalhe> =
  | { ok: true; especialidade: EspecialidadeId; itens: Array<{ dente: number; detalhe: TDetalhe }> }
  | { ok: false; motivo: 'sem-extractor' | 'nada-extraido' | 'erro'; mensagem?: string };

/** IA pequena: schema forçado = o `detalheSchema` do plugin. Nunca infere campo não-dito (I5). */
export interface ExtractorIA<TDetalhe> {
  modo: 'ia';
  extrair(input: ExtractorRequest): Promise<ExtractorResult<TDetalhe>>;
}
/** Motor determinístico: ZERO LLM no caminho do dado (perio — I6). Roda na UI, não na rota de despacho. */
export interface ExtractorDeterministico {
  modo: 'deterministico';
}
export type ExtractorPlugin<TDetalhe> = ExtractorIA<TDetalhe> | ExtractorDeterministico | null;

// ── Peças 3/4 — form manual e card readOnly (props uniformes) ───
export interface PluginFormProps<TDetalhe> {
  valor: TDetalhe | null;
  onChange: (v: TDetalhe) => void;
  dente?: number;
  readOnly?: boolean;
}
export interface PluginCardProps<TDetalhe> {
  /** Card NUNCA recebe null — só é montado quando há dado (I2). */
  valor: TDetalhe;
  dente?: number;
}

// ── Peça 5 — render no odontograma ──────────────────────────────
// (revisado na execução Fase 1: `camadas` é ARRAY — dentística pinta face+coroa+raiz ao mesmo tempo)
export type PluginRender =
  | { pinta: false }                                                   // orto não pinta
  | { pinta: true; camadas: Array<'coroa' | 'raiz' | 'face' | 'selo'> };

/** Shape mínimo pra detecção — evita acoplar o registry ao tipo completo do pass 1. */
export interface EvolucaoDetectavel {
  odontograma_eventos: Array<{ tipo: TipoRegistroOdontograma }>;
  orto_manutencao: unknown | null;
}

// ── O contrato ──────────────────────────────────────────────────
export interface EspecialidadePlugin<TDetalhe = unknown> {
  id: EspecialidadeId;
  label: string;
  /** Eventos que este plugin possui — base da detecção default (D2) e do dispatch de render (peça 5). */
  tiposEvento: TipoRegistroOdontograma[];
  persistencia: PersistenciaPlugin;
  /** Zod do detalhe estruturado; null pra plugins cujo dado É o próprio evento (dentística/cirurgia). */
  detalheSchema: z.ZodType<TDetalhe> | null;
  extractor: ExtractorPlugin<TDetalhe>;
  Form: ComponentType<PluginFormProps<TDetalhe>> | null;
  Card: ComponentType<PluginCardProps<TDetalhe>> | null;
  render: PluginRender;
  /** Detecção: default = algum evento com tipo em `tiposEvento`. Override pra sinal não-evento (orto). */
  detecta?: (evo: EvolucaoDetectavel) => boolean;
}
```

**Preenchimento das 5 peças por especialidade (A0):**

| Plugin | tiposEvento | persistencia | extractor | Form/Card | render |
|---|---|---|---|---|---|
| dentistica | `carie_restauracao`,`selante`,`fratura`,`pino_nucleo` | evento-detalhe¹ | null² | null (usa o painel/§11) | face/coroa/raiz |
| endodontia | `endodontia`,`lesao_periapical` | evento-detalhe | IA (**A1**) | tabela §4 (**A1**) | raiz/selo |
| cirurgia | `exodontia`,`inclusao` | evento-detalhe¹ | null² | null | coroa |
| implantodontia | `implante` | evento-detalhe¹ | null² | null | raiz |
| protese_fixa | `coroa`,`ponte` | evento-detalhe¹ | null² | null (ponte=**A3**) | coroa/bracket |
| periodontia | — (selo derivado) | tabela-satelite (**A2**) | determinístico (**A2**) | periograma (**A2**) | selo |
| odontopediatria | `esfoliacao` (**A3**) | evento-detalhe¹ | null² | null | coroa |
| ortodontia | — (não-evento) | **ficha-coluna** `orto_manutencao` | null² | **chips + form (A0)** | `{pinta:false}` |

¹ Sem detalhe estruturado próprio na A0 — o dado é o evento. A coluna `detalhe jsonb` só nasce na A1 (endo). ² Sem extractor de IA porque o dado já vem completo do pass 1 (eventos) — nada a enriquecer no pass 2.

### 2.2 · Registry + detecção — `src/lib/especialidades/registry.ts`

```typescript
import type { EspecialidadePlugin, EspecialidadeId, EvolucaoDetectavel } from './plugin';
import type { TipoRegistroOdontograma } from '@/types/odontograma';
import { ortoPlugin } from './orto';
// ...demais plugins (A0 = metadados mínimos; A1/A2/A3 preenchem form/card/extractor)

// (revisado na execução Fase 1) — TDetalhe é INVARIANTE (Form/onChange contravariantes),
// então um plugin com detalhe concreto (orto) não é assignable a EspecialidadePlugin<unknown>[]
// direto. Apaga-se o tipo na fronteira do registry (tipo existencial), com cast localizado e
// seguro: o registry só LÊ id/tiposEvento/detecta/persistencia/render — nunca invoca
// Form/Card/extractor por este tipo. O TDetalhe concreto só importa no site que resolve o
// plugin por id (ficha, Fase 3+).
export type PluginRegistrado = EspecialidadePlugin<unknown>;
const registrar = <T>(p: EspecialidadePlugin<T>): PluginRegistrado => p as PluginRegistrado;

export const PLUGINS: PluginRegistrado[] = [
  registrar(dentisticaPlugin), registrar(endodontiaPlugin), registrar(cirurgiaPlugin), registrar(implantoPlugin),
  registrar(proteseFixaPlugin), registrar(periodontiaPlugin), registrar(odontopediatriaPlugin), registrar(ortoPlugin),
];

/** tipo de evento → plugin dono. Construído uma vez; assert de unicidade (um tipo, um dono). */
const DONO_DO_TIPO: Map<TipoRegistroOdontograma, EspecialidadeId> = (() => {
  const m = new Map<TipoRegistroOdontograma, EspecialidadeId>();
  for (const p of PLUGINS) for (const t of p.tiposEvento) {
    if (m.has(t)) throw new Error(`tipo ${t} reivindicado por 2 plugins`); // invariante de build
    m.set(t, p.id);
  }
  return m;
})();

/** D2 — detecção determinística: eventos (via tiposEvento) + sinais não-evento (orto). Sem campo de modelo. */
export function especialidadesDetectadas(evo: EvolucaoDetectavel): EspecialidadeId[] {
  const set = new Set<EspecialidadeId>();
  for (const ev of evo.odontograma_eventos) {
    const dono = DONO_DO_TIPO.get(ev.tipo);
    if (dono) set.add(dono);
  }
  for (const p of PLUGINS) if (p.detecta?.(evo)) set.add(p.id);
  return [...set];
}
```

**Nota de detecção:** o `detecta` override cobre o que não é evento — orto (`orto_manutencao != null`) na A0, perio (exame presente) na A2. O default (tipos) cobre os outros 6. Nenhuma detecção passa por LLM.

### 2.3 · Pipeline 2-pass — contrato da rota de despacho

O pass 1 (`formatar-evolucao`) fica quase intocado (só o prompt de `grupo_id`). Depois dele, o client computa `especialidadesDetectadas` e, para cada detectada cujo `extractor.modo === 'ia'`, chama a rota de despacho em paralelo (`Promise.all`). Plugins determinísticos (perio) rodam na UI, não nesta rota. Plugins com `extractor: null` (dentística/cirurgia/…) não chamam nada — o dado deles já veio do pass 1.

#### `POST /api/dex/extrair-especialidade`

| | |
|---|---|
| Auth | required (dentista; secretária 403) |
| Rate limit | sim — mesmo padrão de `formatar-evolucao` (`withRateLimit`) |

**Request:**
```typescript
{
  especialidade: EspecialidadeId;
  texto: string;                 // relato ORIGINAL (narrativa crua, não a saída do pass 1)
  contexto: { dentes: number[] } // dentes que a especialidade tocou no pass 1
}
```

**Response (sucesso):** `ExtractorResult<TDetalhe>` na forma `{ ok: true, especialidade, itens: [{ dente, detalhe }] }` — um `detalhe` por dente (endo: uma odontometria por dente com canal).

**Erros:**
| Status | Condição |
|---|---|
| 400 | body inválido / `especialidade` fora do enum / `texto` vazio |
| 401 | não autenticado |
| 403 | secretária (sem permissão de escrita clínica) |
| 200 + `{ok:false, motivo:'sem-extractor'}` | plugin sem extractor de IA (caso da A0 pra todos) |
| 429 | rate limit |
| 500 | erro do provider (fail-soft no client: a ficha salva sem o detalhe, dentista preenche pelo form) |

**A0 entrega o esqueleto:** valida entrada, resolve o plugin pelo registry, e devolve `{ ok:false, motivo:'sem-extractor' }` (nenhum plugin da A0 tem extractor de IA). A1 pluga o `endodontiaPlugin.extractor.extrair`. O caminho de `Promise.all` no client já existe e é no-op quando não há extractor — A1 não mexe na orquestração, só preenche a peça.

**Invariante do 2-pass (I4):** o pass 2 só **enriquece** (grava `detalhe` estruturado). Nunca cria/apaga evento nem reescreve o texto do pass 1. Se o extractor falhar, o evento e o texto do pass 1 permanecem íntegros (fail-soft, espírito do event-log da v3).

### 2.4 · `grupo_id` vivo — mudança de prompt do pass 1

Hoje o schema, o banco e a resolução tag→uuid existem (`OdontogramaEventoWire.grupo_id`, `parseEventos` com `grupoMap`), mas o **prompt nunca instrui o modelo a emitir** — agrupamento multi-dente está morto. A0 acende **só a instrução**; nenhuma mudança de código na rota (o `parseEventos` já converte a tag curta em uuid e mantém um uuid por tag).

Adicionar à seção ODONTOGRAMA do prompt (`formatar-evolucao/route.ts`):

```
- GRUPO (multi-dente do MESMO procedimento): quando um único procedimento abrange
  vários dentes de uma vez (ex: "extraí do 31 ao 41", "restaurei 21, 22 e 23 na
  mesma sessão de faceta"), marque TODOS os eventos desse procedimento com o MESMO
  grupo_id — uma tag curta e estável ("g1", "g2"…). Procedimentos distintos = tags
  distintas. Se o dente é isolado (procedimento só nele), grupo_id: null.
  NÃO agrupe dentes só por estarem próximos — agrupa a MESMA intervenção, não a região.
```

- **Escopo A0:** apenas agrupamento do mesmo tipo/procedimento (ex: exodontia de 31–41). `papel_no_grupo` (pilar/pôntico) continua `null` — é ponte, Fatia A3.
- **Verificação:** o harness já tem o check `grupo_consistente` (`run-formatar-evolucao.mjs`) — todos os dentes do grupo caem sob um único `grupo_id`. Adicionar 1 caso "exodontia 31–41" ao `formatar-evolucao-casos.json` com `grupo_consistente: [{tipo:'exodontia', dentes:[31,41]}]` (e os intermediários que o relato citar).
- **Gate:** rodar o eval completo pós-mudança — zero regressão nos casos existentes (a instrução nova não pode fazer o modelo agrupar onde não deve).

### 2.5 · Persistência do orto — migration (gate)

`orto_manutencao` é dado **por-ficha** (uma manutenção por consulta/arcada), não um evento de odontograma (não pinta dente). Forma recomendada: **coluna JSONB em `fichas`** — herda a RLS e a assinatura de `fichas` de graça (é registro clínico do autor, lido pela clínica; coerente com o núcleo clínico 099).

```sql
-- XXX_orto_manutencao_ficha.sql  (próximo número disponível — hoje 105; GATE: confirmar com Mateus)
alter table public.fichas
  add column if not exists orto_manutencao jsonb;

comment on column public.fichas.orto_manutencao is
  'Manutenção ortodôntica da consulta (arco/ativação/elástico corrente/intermaxilar,
   OrtoManutencaoInfo). Registro clínico por-ficha: herda RLS e assinatura de fichas.
   null quando a consulta não foi de manutenção de orto.';
```

- **Sem RLS nova** — herda a de `fichas` (invariante I9 satisfeito pela herança). A forma `ficha-coluna` do `PersistenciaPlugin` aponta pra cá.
- **Escrita:** `salvarFichaConsulta` passa a incluir `orto_manutencao` no insert (hoje ele é montado no draft e **perdido**); o form manual da ficha grava o mesmo shape. Validado por `ortoManutencaoSchema` (Zod) antes de gravar.
- **Leitura:** a camada 3 da ficha renderiza o `ortoPlugin.Card` quando `fichas.orto_manutencao != null`.

### 2.6 · Layout das 3 camadas da ficha

> **Âncora visual (decisão Mateus 20/07):** cores, tipografia, forma dos cards e das tabelas vêm do
> [artefato-base](odontograma-v3-preview-dentistas-artefato.html) — foi ISSO que os dentistas
> aprovaram. O design-brief da ficha traduz o artefato pros tokens do produto; não inventa direção nova.

Composição aditiva sobre o form do Job A no `FichasTab` — não reescrita. Ordem visual de cima pra baixo numa ficha salva/em-edição:

```
Ficha (paciente, dentista, data_atendimento — Job A)
 ├─ CAMADA 1 · Odontograma-índice
 │    <Odontograma>            ← arcada; clicar num dente seleciona
 │    <ToothDetailPanel        ← REUSA (D3); readOnly = ficha assinada || não-autor
 │       readOnly eventos dataPadrao onChange />
 ├─ CAMADA 2 · Cards de registro (§11)  — genérico, 1 por registro/grupo
 │    <RegistroCard>           ← "Restauração MOD · dente 36 · Realizado"
 │       · data clínica (realizado_em) · badge "retroativo" se registrado_em > realizado_em
 │       · CRO do autor · estado de assinatura da ficha
 │    <RegistroCard grupo>     ← "Exodontia · dentes 31–41" (colapsa N eventos do grupo_id)
 └─ CAMADA 3 · Cards de especialidade — 1 por plugin DETECTADO com dado (I2)
      {detectadas.map(p => p.Card && valor(p) && <p.Card valor=… />)}
      · orto (A0): chips arco/ativação/elásticos
      · endo (A1): tabela §4 · perio (A2): periograma · …
```

- **Camada 1** reusa `Odontograma` (índice) + `ToothDetailPanel` (detalhe). O container mapeia os eventos da ficha corrente pra `OdontogramaEventoDraft[]`. `readOnly` pela regra do núcleo clínico.
- **Camada 2** é o card §11 — **fiscalização legível**: o que foi feito, dente, data clínica, retroativo, autor+CRO, assinatura. Um por registro; multi-dente do mesmo `grupo_id` colapsa num card. É genérico (todo evento tem um), independente de plugin.
- **Camada 3** é por-plugin e **condicional ao dado** (I2): só a especialidade detectada e com valor renderiza seu card. Orto aparece **só** aqui (não tem evento → não tem card na camada 2). Endo aparece nas duas (evento na 2, odontometria na 3).
- **Vazio:** ficha sem eventos e sem orto não mostra odontograma vazio inútil (herda o comportamento do DESIGN §4.2).
- **Dark mode + tokens + a11y:** herdados do `ToothDetailPanel`/`Odontograma` (sem cor hardcoded; faces navegáveis por teclado — já garantido pela auditoria UX 19/07).

### 2.7 · Zod do orto (peça 1 do plugin orto)

Espelha `OrtoManutencaoInfo` (já em `src/types/odontograma.ts` §1.5). O schema é o contrato de forma na escrita (server) e a validação do form manual.

```typescript
// src/lib/especialidades/orto.ts
import { z } from 'zod';

export const ortoManutencaoSchema = z.object({
  arcada: z.enum(['superior', 'inferior', 'ambas']),
  fio: z.string().trim().min(1).nullable(),
  ativacao: z.string().trim().min(1).nullable(),
  elastico_corrente: z.string().trim().min(1).nullable(),
  elastico_intermaxilar: z.string().trim().min(1).nullable(),
});
export type OrtoManutencaoDetalhe = z.infer<typeof ortoManutencaoSchema>;
```

### 2.8 · Invariantes (numeradas — a implementação nunca quebra)

- [ ] **I1 — Especialidade nova = 5 peças, zero core.** Registrar um plugin não muda registry/pipeline/layout. Se uma especialidade exige mudança no core, o contrato falhou → volta pro planejamento.
- [ ] **I2 — Plugin só renderiza (card + selo) quando tem dado.** Ficha de profilaxia nunca mostra tabela de endo vazia; `PluginCardProps.valor` nunca é null.
- [ ] **I3 — Detecção é derivada, nunca de campo de modelo.** `especialidadesDetectadas` sai dos eventos do pass 1 (via `tiposEvento`) + sinais não-evento (orto). Nenhum campo novo preenchido pelo LLM.
- [ ] **I4 — Pass 2 só enriquece.** Extractor grava `detalhe`; nunca cria/apaga evento nem reescreve o texto do pass 1. Falha do pass 2 deixa pass 1 íntegro.
- [ ] **I5 — Extractor nunca infere campo não-dito.** Campo não ditado = null/vazio (endo: comprimento não dito ≠ raiz−1).
- [ ] **I6 — Zero LLM no número de sondagem perio.** A peça 2 do perio é motor determinístico (herdado da Fatia C).
- [ ] **I7 — IA nunca preenche data clínica nem autoria.** `realizado_em`, `dentista_id`/CRO ficam com o dentista/sistema (herdado §1.10, invariante #13 da v3).
- [ ] **I8 — Detalhe herda o event-log.** `evento-detalhe` é append-only; congela na assinatura (invariante #14); correção = retificação (evento novo), nunca UPDATE do passado.
- [ ] **I9 — Toda tabela satélite de plugin: `clinica_id` + RLS núcleo clínico** (clínica lê / autor escreve), mesmo padrão de `perio_medidas`/`odontograma_eventos`. `ficha-coluna` herda a RLS de `fichas`. Nenhum padrão de RLS novo.
- [ ] **I10 — `grupo_id` agrupa eventos multi-dente do MESMO procedimento** sob um card; `papel_no_grupo` (pilar/pôntico) fica null até a A3 (ponte).
- [ ] **I11 — A ficha reusa `ToothDetailPanel`** (readOnly quando assinada ou não-autor). Não forka o painel. O estado acumulado entre fichas (§3.4) é Fatia B — A0 mostra a ficha corrente.

### 2.9 · Gates de aceite (o que define "A0 feita")

- [ ] `especialidadesDetectadas` sobre a saída do eval do organizador devolve o conjunto certo por caso (endo/orto/cirurgia…). Typecheck estrito, zero `any`; assert de unicidade `tipo → 1 plugin` no build do registry.
- [ ] Ficha salva renderiza as 3 camadas; clicar num dente abre `ToothDetailPanel` em `readOnly`.
- [ ] Card §11 (camada 2) mostra: tipo · âncora · estado · data clínica · badge retroativo (quando `registrado_em > realizado_em`) · autor+CRO · estado de assinatura.
- [ ] Relato "extraí do 31 ao 41" → **1 card agrupado** "Exodontia · dentes 31–41"; `run-formatar-evolucao.mjs` verde (novo caso `grupo_consistente` passa, casos existentes sem regressão).
- [ ] Manutenção de aparelho narrada → **card de orto na ficha salva**, sobrevive ao reload (persistência fechada).
- [ ] Plugin vazio não renderiza (ficha de profilaxia → sem card de endo/perio/orto).
- [ ] `POST /api/dex/extrair-especialidade` responde ao contrato: 401 sem auth, 403 secretária, 400 body inválido, `{ok:false,'sem-extractor'}` pros plugins da A0; caminho de `Promise.all` no-op quando não há extractor.
- [ ] Dark mode + tokens (sem cor hardcoded) + a11y (faces por teclado) — herdados, conferidos no card §11 e no card de orto novos.
- [ ] Migration do orto aplicada **só após confirmação do Mateus** (dev=prod).

### 2.10 · Não over-specar (o que o stack já garante, não repito aqui)

TypeScript estrito e proibição de `any` (CLAUDE.md); tokens do design system e dark mode (globals.css + DESIGN §1); RLS por `clinica_id` e event-log imutável (spec v3 §1.7/§1.10); padrão de eval (harness `plans/specs/eval/`); rate-limit e `logAICall` das rotas de IA (padrão de `formatar-evolucao`). A A0 só especifica o que é próprio dela: o contrato do plugin, o 2-pass, o `grupo_id` vivo, a persistência do orto e as 3 camadas.
