# Spec: Job A — Ficha rápida no perfil

> **Status:** agreed — aprovada pelo Mateus em 16/07 (escopo + design)
> **Data:** 2026-07-16
> **Origem:** `plans/roadmap/roadmap-3.1-2026-07-14.md` fila #5 · discussão de 14/07 ("modo consulta desmembrado em Job A + Job B")
> **Modelo de execução:** Sonnet (escopo fechado nesta spec; nada ambíguo sobra pra execução)
> **⛔ Sequenciamento:** a execução SÓ começa depois de: migration **099 aplicada** + harness
> `matriz_acesso_clinico.sql` **verde** + **commit/push** da Spec 1 + Fatia A. Motivo: o Job A
> mexe nos MESMOS arquivos (`FichasTab.tsx`, `consulta-client.tsx`) que já carregam mudança
> não commitada — empilhar mais código não verificado neles repete o erro nomeado em 16/07.
> A migration **100** desta spec pode ser aplicada no mesmo sábado, DEPOIS da 099 (é aditiva;
> o código atual não a referencia, nada quebra se ela chegar antes do código).

---

## 1. Problema

O dentista migrando de outro sistema (ou de papel) precisa lançar o histórico dos pacientes —
e o dentista do dia a dia às vezes atende **sem agendamento** (encaixe informal, emergência)
e quer documentar na hora. Hoje os dois caminhos são ruins:

- **Modo consulta** exige um agendamento — não serve pra histórico nem pra atendimento avulso.
- **Form manual do perfil** (origem das 20/33 fichas de prod) é digitação estruturada campo a
  campo: tem até ditado por voz, mas a voz vira texto cru num campo — **sem a estruturação IA**
  que é o valor central do produto.
- Ambos datam a ficha com `created_at` — um atendimento de 2024 lançado hoje **aparece como
  hoje** na timeline. Pro caso de migração, o histórico inteiro nasceria com data mentirosa.

**Leitura de produto (14/07):** o Job A é o cavalo de Troia de aquisição — o menor caminho
pro dentista migrando sentir valor no dia 1.

## 2. Escopo

**Cobre:**
- **Campo mágico** no painel de nova evolução do perfil: relato livre (digitado, colado ou
  ditado) → "Organizar com Dex" → a IA **preenche o formulário existente** → dentista revisa
  no form → salva. O form é a tela de confirmação; não existe tela nova.
- **Voz completa do modo consulta** no perfil (decisão do Mateus, 16/07): gravação com
  auto-stop por silêncio, transcrição acumulada, **detecção ao vivo** em chips — via
  **extração** da orquestração do `consulta-client` pra um hook compartilhado.
- **Anexo de arquivo no campo mágico** (pedido do Mateus, 16/07): **áudio**
  (mp3/m4a/opus/wav → `/api/transcrever`, mesma rota do ditado) e **PDF/DOCX/TXT**
  (→ rota nova `extrair-texto`, reusando os parsers do `processar-documento`). O texto
  resultante **acumula no relato**, igual ao ditado. O arquivo é processado e **descartado**.
- **`data_atendimento`** (migration 100): a data clínica vira coluna própria, retroatível,
  e os pontos de leitura clínica passam a ordenar/exibir por ela.
- Form manual passa a salvar **`procedimentos` e `conduta`** (hoje só o modo consulta salva —
  a ficha rápida nasceria mais pobre sem isso).
- **Estado denso (Fatia C):** redesenho dos 3 lugares que quebram com muitos procedimentos —
  card recolhido, expansão e form de edição (incômodo reportado pelo Mateus, 16/07).

**NÃO cobre (fora de escopo):**
- **Foto/scan de ficha de papel (OCR por visão)** — decisão do Mateus 16/07: fora do v1.
  Não existe OCR hoje (os parsers só leem texto embutido); seria rota Gemini visão nova.
  Se entrar um dia, é **fatia própria** (prompt + validação de IA), não extensão da B.
- Persistir o relato bruto **ou o arquivo anexado** (`fichas.transcricao` / `audio_url` /
  storage / `ficha_arquivos` continuam intocados) — é a fila #6 (transcrição tratada), que
  decide inclusive SE isso mora em `fichas`. Anexar arquivo **à ficha** já existe e continua
  sendo o fluxo do DocumentosTab.
- Extração de data pela IA ("atendi em março de 2024" → preencher o campo) — campo de data é
  manual e determinístico. Prontuário não é lugar de data chutada por modelo.
- Job B (cockpit), painel do Dex, agendamento retroativo, qualquer mudança nos prompts/rotas IA.
- Filtro "minhas fichas / todas" no perfil (~24 pacientes por clínica — não é urgente).

## 3. Decisões tomadas (16/07, com o Mateus)

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Campo mágico **em cima do form existente**; form = tela de revisão | Fluxo separado (mini-consulta) com tela de confirmação própria | Menor código; dentista revisa onde já sabe editar; evita 3º caminho de criação de ficha |
| **`data_atendimento` coluna própria** (migration 100) | Escrever `created_at` retroativo (zero migration) | `created_at` é metadado de auditoria de um prontuário — falsificá-lo vai contra o event-log e a assinatura da 3.1 |
| **VoiceUX completa** (com detecção ao vivo) no perfil | Só o ditado simples que o FichasTab já tem | Decisão do Mateus. O Job A também cobre "atendi sem agendamento, documento agora" — mesma experiência de voz em todo o produto. Custo: extração do hook (§7) |
| `status` permanece **`'aberta'`** | `'concluida'` (como o modo consulta) | Nenhum código lê `fichas.status` pra lógica (auditado 16/07 — zero `.eq('status',…)` sobre fichas). Mantém o comportamento do form que ela estende |
| `origem` = **`'ficha_rapida'`** só quando o preenchimento veio do Dex | Marcar tudo que sai do painel | Métrica honesta: mede uso da IA, não do form. Manual puro continua `'manual'` |

## 4. Fatias

| Fatia | Entrega | Valor sozinha? |
|---|---|---|
| **A — Data do atendimento** | Migration 100 + campo de data no form + troca dos pontos de leitura clínica | Sim — qualquer ficha manual passa a poder ser retroativa (já serve migração, mesmo sem IA) |
| **B — Captura livre** | Extração `useCapturaLivre` + `VoiceUX` movida + campo mágico + **anexo de arquivo (áudio + pdf/docx/txt)** + IA preenche form + `procedimentos`/`conduta` no save | Sim — mas depende da A (o campo de data precisa existir no form) |
| **C — Estado denso** | Redesenho da ficha com muitos procedimentos nos 3 lugares (card recolhido · expansão · form), via pipeline de design (`design-review` diagnostica → `design-polish` aplica) | Sim — o problema já existe hoje; mas roda **depois** da B porque a ficha rápida é o rig de teste (cola relato longo → ficha densa na hora) |

Ordem: **A → B → C**. Todas atrás do gate da 099 (ver cabeçalho).

> **Fatia C não especifica pixels.** O contrato dela é o **gate de densidade** (§10) + o
> processo (auditoria no renderizado, não redesign às cegas). A direção visual sai do
> `design-review` sobre uma ficha densa real — os 3 pontos quebrados conhecidos: card
> recolhido empilha 4 blocos que quebram linha; expansão espreme mini-cards 2-col com
> rótulos de 10px na coluna de 40%; form repete o muro na lista de notas por dente.

## 5. TypeScript — contratos

```typescript
// ── REUSADOS SEM MUDANÇA (contrato compartilhado consulta ↔ perfil) ─────────
// EvolucaoFormatada       — src/app/api/dex/formatar-evolucao/route.ts (já exportada)
// ProcedimentoDetectado   — src/app/api/dex/detectar-consulta/route.ts (já exportada)
// RecorderStatus, useAudioRecorder — src/hooks/useAudioRecorder.ts (já compartilhado)

// ── NOVO: hook extraído do consulta-client ──────────────────────────────────
// src/hooks/useCapturaLivre.ts
export interface UseCapturaLivreOptions {
  /** Nome do paciente — vai no body do formatar-evolucao (contexto do prompt). */
  pacienteNome?: string;
  /** Desliga a detecção ao vivo (perfil demo / consulta demo não têm clínica real). */
  liveDetection?: boolean; // default true
}

export interface UseCapturaLivreReturn {
  texto: string;
  setTexto: (t: string) => void;
  /** Toggle: inicia gravação (com timer) ou para e transcreve. */
  toggleVoz: () => Promise<void>;
  micStatus: RecorderStatus;
  isTranscribing: boolean;
  liveTranscript: string;      // último trecho transcrito (feed do VoiceUX)
  elapsedSeconds: number;
  detectedProcs: string[];     // rótulos prontos ("Restauração – 14, 15")
  isDetecting: boolean;
}
```

Comportamentos que o hook **carrega do consulta-client sem alterar** (é extração, não reescrita):
- voz → `/api/transcrever` → texto **acumula** em `texto` (`prev + '\n' + novo`);
- auto-stop por silêncio (via `onAutoStop` do `useAudioRecorder`);
- detecção ao vivo: debounce **2s**, mínimo **20 chars**, máx **12 chips**, rótulo
  `descricao – dentes` via `denteLabel`, silenciosa em erro;
- travas de corrida do ditado (transcribing trava o botão entre stop e onstop).

```typescript
// ── ALTERADOS ────────────────────────────────────────────────────────────────
// src/types/database.ts — Ficha ganha:
data_atendimento: string; // date ISO 'YYYY-MM-DD'

// FichasTab: FichaDB e Evolution ganham dataAtendimento; formData ganha:
{ dataAtendimento: string; procedimentos: string[]; conduta: string }
```

**Mapeamento IA → form** (ao clicar "Organizar com Dex", `EvolucaoFormatada` preenche):

| Campo da IA | Destino no form |
|---|---|
| `queixa_principal` | `formData.type` |
| `anotacoes` (+ `alerta_novo` anexado no formato da consulta: `\n\n⚠️ Novo alerta detectado: …`) | `formData.observation` |
| `dentes_afetados` + `dentes_observacoes` | `selectedTeeth` + `formData.teethNotes` (split `'\n'` — mesmo parse do `mapFichaToEvolution`); sentinelas 97/98/99 entram como dente comum (o form já rotula via `ARCH_LABELS`) |
| `procedimentos` | `formData.procedimentos` (lista editável nova) |
| `conduta` | `formData.conduta` (textarea nova) |

Dentes preenchidos = dentes selecionados — o dentista **remove** o que não confirma (mesmo
princípio da auto-confirmação do consulta, invertido pro idioma do form).

## 6. API — rotas

**Reusadas, INTOCADAS:**

| Rota | Uso no Job A | Rate limit atual |
|---|---|---|
| `POST /api/dex/formatar-evolucao` | `{texto, pacienteNome}` → `EvolucaoFormatada` | 20/min |
| `POST /api/dex/detectar-consulta` | detecção ao vivo (chips) | 30/min |
| `POST /api/transcrever` | voz do ditado **e arquivo de áudio anexado** (a rota já recebe `File` genérico; Whisper aceita mp3/m4a/opus/wav) | 20/min |

**Nova (a única):**

### POST /api/extrair-texto

| Campo | Valor |
|---|---|
| Auth | required (mesmo guard do `transcrever`) |
| Rate limit | 20/min (bucket próprio `extrair-texto`) |
| Body | `FormData` com campo `arquivo: File` (`.pdf`, `.docx`, `.doc`, `.txt`) |
| Response 200 | `{ texto: string }` |
| Persistência | **NENHUMA** — processa em memória e descarta (≠ `processar-documento`, que grava em `ficha_arquivos`) |

| Status | Condição |
|---|---|
| 400 | sem arquivo · extensão não suportada · **PDF sem texto embutido** (escaneado → mensagem orienta: "sem texto — use áudio ou digite"; OCR está fora do v1) |
| 401 | não autenticado |
| 413 | arquivo acima do limite de upload (~4,5MB Vercel — vale também pro áudio anexado) |
| 500 | falha do parser |

**Implementação:** os parsers de `processar-documento` (mammoth/pdf-parse/TextDecoder) saem
pra `src/lib/extract-text.ts` (`extractTextFromFile(buffer, ext)`); as duas rotas passam a
consumir a função. Refactor extrativo — `processar-documento` se comporta idêntico.

Nenhum Zod novo (o save continua sendo o insert client-side do FichasTab, padrão existente,
protegido pela RLS da 099 — ver Assunções; a rota nova valida FormData na mão, como o
`transcrever` faz).

## 7. Database — migration 100

```sql
-- 100_ficha_data_atendimento.sql
-- Data CLÍNICA do atendimento (retroatível). created_at segue sendo auditoria
-- ("quando foi registrado"). Ordenação clínica: (data_atendimento desc, created_at desc).

alter table public.fichas
  add column data_atendimento date not null
  default ((now() at time zone 'America/Sao_Paulo')::date);

comment on column public.fichas.data_atendimento is
  'Data clínica do atendimento (pode ser retroativa — histórico migrado). '
  'created_at = quando foi registrado no sistema (auditoria). '
  'Toda escrita da aplicação envia o valor explícito no fuso da clínica; o default é rede de segurança.';

-- Backfill: nas fichas existentes o atendimento foi no dia do registro (fuso BRT)
update public.fichas
  set data_atendimento = (created_at at time zone 'America/Sao_Paulo')::date;
```

- **Sem índice novo** (33 fichas em prod; listas já filtram por `paciente_id + clinica_id`).
- **Sem mudança de RLS** — coluna herda as policies de linha da 099.
- Tipo `date`, não `timestamptz`: o dentista retroagindo sabe o **dia**, não a hora — hora
  falsa (meia-noite) só criaria ordenação mentirosa. Empate no mesmo dia desempata por
  `created_at`.

### 7.1 Pontos de leitura — quem troca pra `data_atendimento`

Regra: **semântica clínica** (ordenar/exibir histórico) troca; **semântica operacional**
("a ficha recém-criada", contadores) fica em `created_at`.

| Ponto | Semântica | Troca? |
|---|---|---|
| `FichasTab.tsx` fetch (lista do perfil) | clínica — order + exibição | ✅ |
| `PendenciasTab.tsx` (`fichaDate`) | clínica | ✅ |
| `server/patients/get-visible-timeline-events.ts` | clínica (timeline) | ✅ |
| `server/patients/get-patient-workspace-data.ts` | clínica | ✅ |
| `paciente-detail-client.tsx` (3 queries: :549, :559, :860) | clínica | ✅ |
| `consulta/[agendamentoId]/page.tsx` (histórico prévio) | clínica | ✅ |
| `lib/ai/context.ts` (contexto clínico pra IA) | clínica | ✅ |
| `pacientes/[id]/actions.ts:137` (resumo/queixa recente) | clínica | ✅ |
| `tratamento-actions.ts:189` (fichas sem tratamento) | clínica | ✅ |
| `orcamentos-client.tsx:251` (fichas pro orçamento) | clínica | ✅ |
| `dentista-dashboard.tsx:129` (última queixa) | clínica | ✅ |
| `api/pacientes/[id]/prontuario` + `api/fichas/[id]/pdf` (datas impressas) | clínica — documento | ✅ |
| `agendamentos/assinatura-actions.ts:15` (ficha recém-criada da consulta p/ assinar) | **operacional** | ❌ fica `created_at` |
| `lib/onboarding-progress.ts:34` (contador) | operacional | ❌ |

Troca = `order('data_atendimento', …)` com desempate `created_at` + incluir a coluna no
`select` + exibição. **Exibição:** quando `data_atendimento` = dia do `created_at` (BRT),
mantém o formato atual `DD/MM/AAAA às HH:MM`; quando retroativa, só `DD/MM/AAAA`.

### 7.2 Escritas que passam a enviar `data_atendimento` explícito

| Escrita | Valor |
|---|---|
| `FichasTab.handleSave` (insert **e** update) | o campo do form (default hoje, máx hoje) |
| `salvarFichaConsulta` (modo consulta) | hoje no fuso da clínica (1 linha — sem UI) |
| `fichas/nova/actions.ts` (`createFicha`, rota legado) | hoje (1 linha, por consistência) |

## 8. Componentes

> **Direção visual aprovada** (Mateus, 16/07, sobre mockup em conversa): um card, três
> entradas pares (digitar/colar · mic · anexar) no mesmo toolbar; anexo vira chip acima do
> toolbar e o texto entra no relato como qualquer fonte; hierarquia vertical 1-2-3
> (contar → datar → revisar); o teal do Dex é a única cor forte do painel (card de captura
> + CTA); dentes detectados nascem selecionados no odontograma; procedimentos são chips
> removíveis + "adicionar". O pixel final ainda passa pelo `design-review` no renderizado.

```
FichasTab (client, existente — já com podeEditarFicha/autoria da Spec 1)
  └─ painel "Nova evolução" (existente)
       ├─ CapturaLivreCard            ← NOVO · components/fichas/captura-livre-card.tsx
       │    ├─ textarea do relato + botão mic + botão anexar (1 input: audio/* + .pdf/.docx/.txt;
       │    │    roteia client-side — áudio → /api/transcrever, resto → /api/extrair-texto;
       │    │    resultado ACUMULA no relato, com loading e erro por arquivo)
       │    ├─ chips de detecção (detectedProcs)
       │    ├─ botão "Organizar com Dex" (loading = etapas progressivas, como na consulta)
       │    └─ consome useCapturaLivre
       ├─ campo "Data do atendimento"  ← NOVO · input date, default hoje, max hoje
       ├─ form existente (queixa, odontograma, notas por dente, observação)
       └─ campos novos: procedimentos (lista add/remove) + conduta (textarea)
  └─ VoiceUX                          ← MOVIDA · components/fichas/voice-ux.tsx (era
       consulta/_components/voice-ux.tsx — presentational, muda só o import)
consulta-client                        ← REFATORADO: consome useCapturaLivre + VoiceUX movida.
                                          Comportamento IDÊNTICO (invariante #2)
```

| Componente | Server/Client | Responsabilidade |
|---|---|---|
| `CapturaLivreCard` | Client | relato + voz + chips + disparo do organizar; **não salva nada** |
| `useCapturaLivre` | hook | orquestração voz/transcrição/detecção (extraído, §5) |
| `FichasTab` | Client | recebe `EvolucaoFormatada`, preenche formData, save (insert/update) |

### Fluxo do campo mágico

1. Dentista abre "Nova evolução" no perfil → CapturaLivreCard no topo do painel.
2. Digita/cola o relato, **ou** dita (toggleVoz → VoiceUX flutuante → auto-stop por silêncio
   → transcrição acumula no campo), **ou** anexa arquivo (áudio → transcrição; pdf/docx/txt →
   texto extraído — os dois acumulam no campo, dá pra combinar fontes). Chips de detecção
   aparecem enquanto o texto cresce.
3. "Organizar com Dex" → `formatar-evolucao` → resposta preenche o form (§5). O relato
   permanece no campo (editável; dá pra complementar e reorganizar).
4. **Se o form já tem conteúdo** (dirty — qualquer campo preenchido), "Organizar" pede
   confirmação antes de sobrescrever: `"Substituir o que já está no formulário?"`.
5. Dentista revisa/edita o form (inclusive a data, se retroativo) → "Salvar evolução" →
   insert existente estendido (`+ procedimentos, conduta, data_atendimento, origem`).
6. O relato bruto é **descartado** ao salvar/fechar o painel (invariante #7).

**Permissão/demo:** o card só renderiza com `canWrite` (mesma condição do painel);
no perfil demo (`patientId === 'demo'`) o card **não renderiza**.

## 9. Invariantes

- [ ] **#1** As rotas `formatar-evolucao`, `detectar-consulta` e `transcrever` não mudam —
      contrato compartilhado consulta↔perfil. Ajuste de prompt é spec própria.
- [ ] **#2** A extração (`useCapturaLivre` + `VoiceUX` movida) é **behavior-preserving**: o
      modo consulta se comporta idêntico, e os gates de captura/organizar/salvar da consulta
      re-rodam depois do refactor.
- [ ] **#3** Toda escrita clínica leva `dentista_id` explícito do dentista logado (herda a
      invariante da Spec 1).
- [ ] **#4** Ficha rápida **não** notifica secretária, **não** toca `agendamentos`, **não**
      cria consulta.
- [ ] **#5** `data_atendimento ≤ hoje` (validação no client + `max` do input; furo por POST
      direto tem consequência cosmética, não de segurança) e toda escrita da aplicação envia
      o valor **explícito no fuso da clínica** — o default do banco é rede de segurança.
- [ ] **#6** Ordenação/exibição clínica = `(data_atendimento desc, created_at desc)`;
      semântica operacional (assinatura pós-consulta, contadores) permanece `created_at`.
- [ ] **#7** Nem o relato bruto nem o **arquivo anexado** são persistidos — `transcricao`/
      `audio_url`/storage/`ficha_arquivos` intocados (fila #6). O arquivo é processado em
      memória e descartado; anexar arquivo À FICHA continua sendo o DocumentosTab.
- [ ] **#11** O refactor dos parsers (`lib/extract-text.ts`) é extrativo: `processar-documento`
      (DocumentosTab) se comporta idêntico depois dele.
- [ ] **#8** Nada entra na ficha sem passar pelos campos visíveis do form — a IA preenche,
      o dentista revisa e salva. Form = tela de confirmação.
- [ ] **#9** `origem='ficha_rapida'` só quando o preenchimento veio do Dex nesta edição;
      manual puro segue `'manual'`; update não altera `origem`.
- [ ] **#10** A aplicação nunca escreve `created_at` — é o metadado de auditoria, distinto
      da data clínica.

## 10. Gates de aceite

**Fatia A — data do atendimento**
- [ ] Migration 100 aplicada; `count(*) where data_atendimento is null` = 0; fichas antigas
      com `data_atendimento` = dia do `created_at` em BRT (conferir 2 por amostragem).
- [ ] Campo de data no painel: default hoje, não aceita data futura.
- [ ] Ficha salva com data 10/01/2025 ordena **abaixo** das fichas de 2026 na lista do perfil
      e exibe `10/01/2025` (sem horário).
- [ ] Ficha de hoje continua exibindo `DD/MM/AAAA às HH:MM`.
- [ ] PendenciasTab, timeline do paciente e PDF do prontuário mostram a data clínica da
      ficha retroativa (não a de criação).
- [ ] Ficha criada pelo modo consulta às 22h BRT ganha `data_atendimento` de **hoje** (fuso).
- [ ] Assinatura pós-consulta continua achando a ficha recém-criada (não regride).

**Fatia B — captura livre**
- [ ] Perfil → nova evolução → colar relato de teste → "Organizar com Dex" → form preenche
      queixa, observação, dentes selecionados com notas, procedimentos e conduta.
- [ ] Mesmo fluxo por voz: gravar → falar → 4s de silêncio param sozinhos → texto acumula no
      campo → chips de detecção aparecem com ≥20 chars.
- [ ] Salvar → ficha na lista com `origem='ficha_rapida'`, autor = dentista logado,
      procedimentos e conduta visíveis na visualização da ficha.
- [ ] Relato citando alergia nova → observação termina com `⚠️ Novo alerta detectado: …`.
- [ ] "Organizar" com form já preenchido pede confirmação antes de sobrescrever.
- [ ] Ficha manual sem usar o Dex salva com `origem='manual'`.
- [ ] `transcricao` e `audio_url` da ficha criada = null (relato bruto descartado).
- [ ] Anexar um **mp3/m4a** → transcrição acumula no relato (sem apagar o que já estava).
- [ ] Anexar um **PDF com texto** → texto extraído acumula no relato.
- [ ] Anexar **PDF escaneado** (sem texto embutido) → erro claro orientando ("sem texto —
      use áudio ou digite"), sem quebrar o painel.
- [ ] Arquivo acima do limite → mensagem clara com o limite (~4,5MB), não erro genérico.
- [ ] Após anexar e salvar: **nada persistiu** do arquivo (storage sem objeto novo,
      `ficha_arquivos` sem linha nova).
- [ ] **DocumentosTab re-verificado** após o refactor dos parsers (upload + extração de
      documento continuam funcionando).
- [ ] **Modo consulta re-verificado** após o refactor: captura por voz, detecção ao vivo,
      organizar, salvar, assinar — os gates de sempre passam.
- [ ] Dentista B vê a ficha rápida do A (leitura de clínica, 099) e **não** vê controles de
      edição nela (`podeEditarFicha`).

**Fatia C — estado denso**
- [ ] **Gate de densidade:** uma ficha com **10 dentes / 20 procedimentos** é legível nos 3
      lugares — card recolhido (altura contida, sem paredão de chips), expansão (procedimentos
      escaneáveis sem rótulo de 10px espremido), form de edição (lista por dente navegável).
- [ ] Card recolhido de ficha densa não passa de ~40% da altura da viewport (hoje empilha 4
      blocos sem teto).
- [ ] `design-review` roda no renderizado (ficha densa real criada pela ficha rápida) e as
      correções são aplicadas pelo `design-polish` — nota mínima B no relatório.
- [ ] Ficha **pouco densa** (1–2 dentes) não regride — o redesenho não pode piorar o caso comum.
- [ ] Dark mode e contraste verificados nos 3 lugares.

## 11. Riscos

| Risco | Mitigação |
|---|---|
| Refactor do `consulta-client` (1058 linhas) pra extrair o hook regride a consulta | Extração mecânica (mover, não reescrever); invariante #2 obriga re-rodar os gates da consulta; executa em chão commitado (pós-sábado) |
| `FichasTab` já tem 1467 linhas | `CapturaLivreCard` nasce em arquivo próprio; o diff no FichasTab é mapeamento + campos novos |
| Prompt do `formatar-evolucao` injeta "Data: hoje" — relato de histórico pode citar outra data | Sem risco de contrato: a IA não devolve data; a data vem do campo manual. Não mexer no prompt (invariante #1) |
| Troca de ordenação em ~12 pontos de leitura esquece algum | §7.1 é o checklist; gate do PDF/timeline cobre os visíveis |
| PDF escaneado (imagem) frustra o dentista migrando do papel | Mensagem de erro orienta o caminho (áudio/digitar); OCR por visão fica registrado como fatia futura — não improvisar no v1 |
| Fatia C vira redesign sem fim ("deixa bonito") | O contrato é o gate de densidade + nota do `design-review`, não gosto pessoal; caso comum (1–2 dentes) tem gate de não-regressão |

## 12. Assunções (declaradas, não confirmadas uma a uma)

- O save da ficha continua **insert client-side** no FichasTab (padrão existente; RLS da 099
  é a fronteira real). Migrar pra server action é refactor fora deste escopo.
- `fichas.status` é vestigial (nenhuma leitura lógica no app) — mantido `'aberta'`.
- O fuso da clínica é `America/Sao_Paulo` (mesmo pressuposto do resto do app — se a
  multi-clínica ganhar fuso por clínica um dia, é mudança transversal, não deste escopo).
- A rota legado `dashboard/fichas/nova|[id]` (páginas já redirecionam) não ganha o campo —
  só a linha do §7.2 pra não criar ficha com default do banco.
