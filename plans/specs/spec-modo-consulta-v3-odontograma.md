# Spec — Modo Consulta v3: Odontograma Multi-Especialidade

> **Status:** **APROVADA pelo Mateus em 16/07** — após revisão do mesmo dia: modelo de
> acesso 099 (núcleo clínico), validação por pesquisa (Manual CFO 2026 · SDCEP · AAP/EFP
> 2018 — §Fontes), catálogo estendido pra 12 tipos (`fratura`, `pino_nucleo`), perio com
> recessão/sítio + CAL + supuração, orto com elásticos corrente/intermaxilar + atalho
> "igual à última", seção Cobertura por especialidade e mapeamentos por observação.
> Design de referência aprovado em artifact (16/07). **1ª execução pós-gate da 099.**
> **Data:** 2026-07-13
> **Modelo de execução:** Sonnet (padrão do projeto) como base das **3 fatias** — toda
> decisão ambígua (arquitetura do event-log, caminho técnico do ditado perio, cor do
> pré-existente, forma da âncora hierárquica, JSON Schema do organizador) foi fechada
> **nesta spec**, então a execução é implementar contra um contrato já congelado, não julgar.
> Exceções pontuais onde Opus compensa estão na tabela **"Modelos de IA por fatia"** abaixo.
> Se durante a execução aparecer uma decisão que este documento não cobre, a regra do
> projeto vale: volta pro planejamento antes de codar.
>
> **Estende:** `plans/concluidos/spec-fase1-5-consulta-ia-v2.md` (implementada, em produção —
> transcrição, organizador Gemini, dicionário, fluxo de conclusão). Este documento **não
> re-abre** nenhuma decisão de lá; o Motor A descrito abaixo é um adendo aditivo ao
> organizador já existente (`/api/dex/formatar-evolucao`).
> **Origem:** discussão de 13/07 (handoff `plans/handoffs/handoff-2026-07-13-execucao-consulta-ia-v2.md`)
> + decisões fechadas diretamente pelo Mateus (dentista, dono do produto). A pesquisa de
> campo na clínica piloto (`plans/specs/perguntas-clinica-piloto-odontograma-2026-07-13.md`)
> fica como **validação pós-Fatia A/C**, não bloqueia a escrita da spec.

---

## Modelos de IA por fatia

Duas colunas distintas — não confundir: **execução** é o modelo do Claude Code que escreve
o código da fatia (regra do projeto: Sonnet = execução contra contrato congelado, Opus =
trecho ambíguo/denso); **runtime** é a IA que roda dentro do produto quando o dentista usa.

| Etapa | Execução (Claude Code) | Quando subir pra Opus 4.8 | IA em runtime (produto) |
|---|---|---|---|
| `design-brief` (pré-Fatia A e pré-C) | **Opus 4.8** | Já é Opus — decisão estética é aberta por natureza, não contrato congelado | — |
| **Fatia A** — fundação | **Sonnet** | Só em 2 pontos, se a 1ª tentativa do Sonnet sair ruim: (1) o refactor da state machine do `consulta-client.tsx` (arquivo grande, 4 estados entrelaçados, risco de regressão no fluxo em produção); (2) o SVG do `ToothDetailPanel` (geometria das 5 zonas + raiz) | Gemini 2.5 Flash com schema forçado (organizador/Motor A) + Whisper `large-v3` via Groq (transcrição) — **os mesmos já em produção, nenhum modelo novo** |
| **Fatia B** — acumulado, ponte, orçamento | **Sonnet** | Não deve precisar — CRUD, query com `DISTINCT ON` e render do bracket, tudo especificado | Nenhuma IA nova — o enum do organizador só ganha `ponte`/`esfoliacao`; rota de acumulado é SQL puro |
| **Fatia C** — periodontograma | **Sonnet** | Na máquina de estados do auto-avanço + parser do ditado (`usePerioVoice`) — lógica densa de edge cases (dente ausente, "volta", grade parcial); se os testes do parser falharem em loop, sobe | Web Speech API do Chrome (reconhecimento nativo de comando, **não-LLM**) — zero LLM no caminho dos números, por invariante (#2). Whisper/Gemini **não entram** aqui |
| Eval (casos novos, Parte 7) | **Sonnet** | Não — escrever casos JSON e rodar o harness é mecânico | Gemini 2.5 Flash (é o modelo sob teste) |
| Auditoria (gate de cada fatia) | `typescript-reviewer` / `ux-reviewer` / `design-polish` nos modelos dos próprios agentes | — | — |

Regra prática: começa tudo em Sonnet; os pontos de "quando subir" são gatilhos definidos,
não licença pra trocar de modelo no meio por impaciência. Troca de modelo em execução é
decisão registrada no handoff da sessão.

---

## Visão

O odontograma vira o **hub visual do registro clínico**: em vez de uma lista de texto por
dente, a boca do paciente se pinta sozinha conforme o dentista narra ou dita a consulta.

> **Enquadramento corrigido em 16/07 (pesquisa):** o CFO reconhece **23 especialidades**
> (não 8 — [Simples Dental](https://www.simplesdental.com/blog/areas-da-odontologia/); a
> contagem varia com adições recentes como Odontologia Hospitalar/2024). O que o v3 cobre
> é o **núcleo dente-registrável** — as ~9 especialidades cujo registro clínico ancora em
> dente/face e por isso pinta odontograma. As demais ou são **contextos de prática** (usam a
> mesma ficha, sem símbolo novo) ou registram em **tecido mole/articulação/face** (fora do
> odontograma por natureza). O mapa completo está na seção **"Cobertura por especialidade"**. Dois motores de IA alimentam esse
desenho: um narrativo (prosa -> JSON -> pintura) e um determinístico exclusivo da sondagem
periodontal (número falado -> célula, zero inferência de LLM). O resultado esperado:
o dentista fala/dita como já faz hoje, a ficha e o odontograma se organizam sozinhos, e o
paciente enxerga a própria boca — não uma tabela — quando o plano é apresentado.

## Não-escopo (registrar para não reabrir depois)

| Item | Por quê fica de fora |
|---|---|
| Documentação ortodôntica inicial (Angle, giroversão, apinhamento, setas, galeria de fotos) | Feature própria, relacional e visual — vira spec separada (v2 do módulo orto). Nesta spec, orto só cobre **manutenção mensal** (§Fluxo d). |
| HOF (botox, preenchimento, bichectomia) no odontograma | Já cabe no dicionário/ficha em texto (D7 da spec fase1-5); não é um registro visual no dente — não ganha símbolo. |
| App mobile / React Native | Fora do radar desta spec; nenhuma decisão aqui deve impedir migração futura. |
| Backfill de fichas antigas sem odontograma | Fichas existentes (`dentes_afetados`/`dentes_observacoes` legado) ficam como estão. Nenhuma migração de dados retroativa gera `odontograma_eventos` a partir de texto histórico — ver Riscos. |
| Materializar o "estado atual" do odontograma em tabela própria | Decisão tomada: reduce por query (`DISTINCT ON`), não tabela de cache. Ver Modelo de dados. |
| Triagem por sextante (PSR) como alternativa ao perio completo | O Mateus confirmou (decisão #5) que o exame é sondagem completa de 6 pontos. |
| **Prótese removível (PPR/PT) como símbolo visual** *(adicionado 16/07)* | Não ancora em dente individual — segue registrada em texto na ficha via sentinelas de arcada (97/98), como hoje. Desenhá-la no odontograma tem valor clínico baixo vs. custo; se demanda real aparecer, é extensão do catálogo, não desta spec. |
| ~~Supuração na sondagem perio~~ | **ENTROU em 16/07** — o checklist de especialidades do Mateus pediu explicitamente ("sangramento e supuração"). Ver §1.6. |
| **Braquetes/bandas/attachments por dente, apinhamento, diastema, giroversão** *(16/07)* | É documentação ortodôntica (aparelho/oclusão), não estado clínico do dente — pertence à spec futura do módulo orto, junto de fotos/cefalometria. Braquete descolado no mensal vai em observação da manutenção. |
| **Enxerto ósseo / levantamento de seio como marcação visual** *(16/07)* | Registro em REGIÃO (não dente) exigiria camada de render nova (overlay de gengiva/osso). V1: ficha texto + tomografia anexa. Revisitar se implantodontistas do piloto pedirem. |
| **Mantenedor de espaço (pedo) como símbolo** *(16/07)* | Aparelho multi-dente, não estado do dente. Ficha texto no v1. |
| **Estados transitórios (sutura pós-cirúrgica)** *(16/07)* | O event-log registra estado DURÁVEL; sutura se resolve em dias — é acompanhamento (ficha + marcar retorno), não odontograma. Poluir o log permanente com efêmero quebra a leitura pericial. |
| **Desgaste de bruxismo / faceta de desgaste como símbolo** *(16/07)* | Achado de DTM — texto na ficha no v1; candidato a tipo futuro se houver demanda de campo. |
| **Faceta/lente de contato como símbolo próprio** *(16/07)* | Mapeia `carie_restauracao` na face V + observação "faceta/lente" (pinta a face V igual). Símbolo distinto só se o piloto estético pedir. |
| **Cálculo/tártaro e flúor como marcação visual** *(16/07)* | Procedimento/achado sem estado durável no dente — ficha (`procedimentos`) e índice de placa do perio cobrem. |

## Assunções (para o Mateus validar; nenhuma bloqueia a Fatia A)

- A ordem real dos 6 sítios por dente (pergunta crítica do roteiro de campo, Bloco 1) segue
  a convenção clínica padrão (vestibular MV->V->DV, depois lingual/palatal DL->L->ML) até
  que a visita à clínica piloto confirme ou corrija — é uma constante nomeada, troca é 1 linha.
- Web Speech API (Chrome/Edge) tem precisão aceitável para dígitos isolados em PT-BR
  ditados em sequência rápida — não validado em campo; Fatia C tem gate explícito de
  teste com ditado real antes de virar o único caminho.
- Clínicas do Mateus operam em desktop/Chrome no consultório (não Safari/Firefox) — premissa
  necessária para a Fatia C funcionar sem fallback manual como caminho principal.

---

## Cobertura por especialidade *(adicionado 16/07, com pesquisa)*

Das **23 especialidades reconhecidas pelo CFO**, o v3 cobre integralmente as que registram
no dente, cobre parcialmente 2 por decisão deliberada, e deixa fora as que não são
dente-ancoradas. Este mapa é a resposta canônica a "o odontograma atende quais
especialidades e de que forma":

| Especialidade | O v3 registra | De que forma | Cobertura |
|---|---|---|---|
| **Dentística / Clínico Geral** | Cárie/restauração por face (5 faces), selante, **fratura** e **pino/núcleo intracanal** (aprovados 16/07 — kit do clínico geral, decisão do Mateus) | Eventos `carie_restauracao`/`selante` em face; `fratura` (achado) e `pino_nucleo` (raiz) em dente; MOD = 1 evento multi-face | ✅ total |
| **Endodontia** | Canal a tratar/tratado, lesão periapical | `endodontia` (linha na raiz, tracejada→sólida), `lesao_periapical` (círculo no ápice) | ✅ total |
| **Cirurgia (nível dente)** | Extração indicada/feita, dente incluso | `exodontia` (X → ausente), `inclusao` (contorno tracejado) | ✅ no dente · cirurgia de tecido mole/osso vai em texto na ficha |
| **Implantodontia** | Implante planejado/instalado | `implante` (parafuso na raiz) | ✅ total · peri-implantite = refinamento futuro registrado |
| **Prótese dentária (fixa)** | Coroa, ponte pilar-pôntico | `coroa` (contorno duplo), `ponte` (bracket multi-dente, Fatia B) | ✅ fixa · **removível (PPR/PT) fora do visual** — ver Não-escopo |
| **Periodontia** | Sondagem 6 sítios, BOP, placa, recessão/sítio, **CAL derivado**, mobilidade, furca + selo de bolsa no odontograma | Fatia C — `perio_exames`/`perio_medidas`, Motor B determinístico | ✅ total (com o ajuste de CAL de 16/07 — §1.6) |
| **Odontopediatria** | Decíduos 51–85 com o mesmo catálogo + esfoliação + dentição mista | Abas Permanentes/Decíduos + evento `esfoliacao` (Fatia B) | ✅ total |
| **Ortodontia** | Manutenção mensal (arco, ativação, elástico) por arcada | `orto_manutencao` (chips na ficha, não pinta odontograma) | 🟡 parcial deliberado — documentação inicial (Angle, apinhamento, fotos) é spec própria futura |
| **Radiologia (achados dentários)** | Lesão periapical e achados que ancoram em dente | Via narrativa → eventos | 🟡 achados; laudo radiológico completo fora |
| **Odontologia Legal** | — (não registra tipo novo) | **É servida pelo v3, não coberta**: odontograma anatômico preciso + event-log imutável + autoria por evento = exatamente o que perícia/identificação pede ([Manual CFO 2026](https://website.cfo.org.br/wp-content/uploads/2026/03/CFO_Manual_do_Prontuario_Ebook.pdf), §Odontograma) | ✅ como consumidora |
| Estomatologia · Patologia Oral | Lesões de mucosa/tecido mole | Não ancoram em dente — ficam em texto (`anotacoes`); módulo de mucosa é possível futuro, não v3 | ⛔ fora por natureza |
| DTM e Dor Orofacial | Articulação/músculo | Idem — texto | ⛔ fora por natureza |
| HOF · Prótese buco-maxilo-facial | Face | Já era não-escopo (D7 fase1-5) | ⛔ fora por natureza |
| Odontogeriatria · Pacientes especiais · Esporte · Trabalho · Saúde Coletiva · Hospitalar · Estética · Laserterapia · Homeopatia · Acupuntura | — | São **contextos de prática**, não tipos de registro dentário: usam a mesma ficha e o mesmo odontograma quando tocam dente | — n/a |

**Leitura honesta do claim:** o v3 não "atende 23 especialidades" — ele atende **todas as
que têm registro dente-ancorado** (o núcleo clínico do dia a dia de uma clínica geral
multi-especialidade), serve a odontologia legal por consequência da arquitetura, e nomeia
explicitamente o que fica fora e por quê.

### Mapeamentos por observação *(16/07 — checklist de especialidades)*

Itens do dia a dia que **não ganham símbolo próprio** mas têm registro canônico: o evento
certo + a informação na `observacao` (o prompt do Motor A ensina cada um; a execução os
adiciona ao glossário):

| Narrativa | Evento canônico | Observação carrega |
|---|---|---|
| "restaurei com **amálgama/resina/ionômero**" | `carie_restauracao` realizado | o material |
| "restauração **infiltrada/defeituosa** no 25" | evento antigo fica; NOVO `carie_restauracao` **indicado** (troca) | "substituição — infiltração" |
| "extração do 14 **pra ganhar espaço** (orto)" | `exodontia` indicado | "finalidade ortodôntica" |
| "siso **mesioangulado** incluso" | `inclusao` | classificação (Winter) |
| "implante **Straumann 4.1×10** no 36" | `implante` realizado | marca/diâmetro/comprimento (estruturar = refinamento futuro) |
| "**pulpotomia** no 74" | `endodontia` realizado (decíduo) | "pulpotomia" |
| "**coroa de aço** no 75" | `coroa` realizado | "coroa de aço" |
| "**faceta/lente** no 11" | `carie_restauracao` face V | "faceta/lente de contato" |

---

## Parte 1 — Modelo de dados

### 1.1 Âncora hierárquica

Todo registro clínico do odontograma aponta para exatamente um nível da hierarquia
`boca > arcada > quadrante > dente > face`. O nível "boca" não é usado pelos novos
eventos — boca-toda continua representada pelo sentinela legado `99` em
`fichas.dentes_afetados` (não duplicar caminho). Face lingual/palatina é armazenada sempre
como `'L'` internamente; a UI decide o rótulo ("Palatina" em dente superior, "Lingual" em
inferior) — mesma zona geométrica, é rótulo contextual, não estado novo.

```ts
// src/types/odontograma.ts

/** Nível da âncora hierárquica. 'boca' não é emitido por eventos novos (sentinela 99 legado). */
export type NivelAncora = 'arcada' | 'quadrante' | 'dente' | 'face';

export type Arcada = 'superior' | 'inferior';

/** Quadrante FDI: 1-4 permanente, 5-8 decíduo. */
export type QuadranteFDI = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Face dental — 5 canônicas. Palatina é 'L' com rótulo contextual (ver faceLabel). */
export type FaceDental = 'O' | 'M' | 'D' | 'V' | 'L';

export interface AncoraClinica {
  nivel: NivelAncora;
  arcada?: Arcada;
  quadrante?: QuadranteFDI;
  dente?: number;
  faces?: FaceDental[];
}
```

```ts
/**
 * Rótulo de face contextual ao dente (superior -> Palatina, inferior -> Lingual;
 * anteriores -> Incisal em vez de Oclusal — revisado 16/07, checklist de especialidades).
 * Mesma zona geométrica, rótulo contextual — não é estado novo.
 */
export function faceLabel(face: FaceDental, dente: number): string {
  const labels: Record<FaceDental, string> = { O: 'Oclusal', M: 'Mesial', D: 'Distal', V: 'Vestibular', L: 'Lingual' };
  if (face === 'L') {
    const superior = (dente >= 11 && dente <= 28) || (dente >= 51 && dente <= 65);
    return superior ? 'Palatina' : 'Lingual';
  }
  if (face === 'O') {
    const anterior = dente % 10 >= 1 && dente % 10 <= 3; // incisivos e caninos
    return anterior ? 'Incisal' : 'Oclusal';
  }
  return labels[face];
}
```

### 1.2 Registro clínico — dois eixos ortogonais, não um enum de "estado"

Em vez de guardar uma cor diretamente, cada evento guarda dois eixos independentes — essa
é a base de por que 3 cores (vermelho/azul/pré-existente) não colidem nem duplicam dado:

- **`status`** — o que aconteceu com a intervenção: `'indicado'` (a fazer) ou `'realizado'` (feito).
- **`origem`** — quem/quando: `'clinica'` (feito aqui) ou `'preexistente'` (já estava assim
  quando o paciente chegou — trabalho de outro dentista, ou achado antigo ainda sem
  intervenção).

A cor renderizada é derivada, nunca persistida:

```ts
export type StatusRegistro = 'indicado' | 'realizado';
export type OrigemRegistro = 'clinica' | 'preexistente';

/**
 * Cor semântica — função pura de status+origem. 'indicado' é SEMPRE coral, não importa
 * quem achou o problema (não existe 4a cor "pendência pré-existente"). 'realizado' vira
 * teal (fizemos aqui) ou slate (já estava pronto quando o paciente chegou).
 */
export function corDoRegistro(status: StatusRegistro, origem: OrigemRegistro): 'coral' | 'teal' | 'slate' {
  if (status === 'indicado') return 'coral';
  return origem === 'preexistente' ? 'slate' : 'teal';
}
```

### 1.3 Tipo de registro (decide o símbolo)

```ts
export type TipoRegistroOdontograma =
  | 'carie_restauracao'   // achado cárie (indicado) -> restauração (realizado). Ancora em face.
  | 'exodontia'            // indicado = "a extrair"; realizado = some da renderização normal (catálogo #6)
  | 'endodontia'           // indicado = "a tratar"; realizado = canal tratado. Ancora em dente (raiz).
  | 'lesao_periapical'     // achado radiográfico — quase sempre 'indicado'. Ancora em dente (ápice).
  | 'implante'             // quase sempre 'realizado'; 'indicado' = implante planejado.
  | 'coroa'                // coroa total protética. Ancora em dente.
  | 'ponte'                // MULTI-DENTE — grupo_id/papel_no_grupo. Fatia B liga o render.
  | 'selante'              // preventivo, quase sempre 'realizado'. Ancora em face (sempre 'O').
  | 'inclusao'             // achado estrutural (dente incluso/impactado). Ancora em dente.
  | 'esfoliacao'           // decíduo caiu — Fatia B. Ancora em dente (51-85).
  | 'fratura'              // trauma dentário (achado, como lesao_periapical) — aprovado 16/07. Ancora em dente.
  | 'pino_nucleo';         // pino intrarradicular/núcleo — aprovado 16/07. Ancora em dente (raiz).

export type PapelNoGrupo = 'pilar' | 'pontico';
```

### 1.4 Evento de odontograma (event-log)

```ts
export interface OdontogramaEvento {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string;
  ficha_id: string | null;
  grupo_id: string | null;
  tipo: TipoRegistroOdontograma;
  status: StatusRegistro;
  origem: OrigemRegistro;
  ancora: AncoraClinica;
  papel_no_grupo: PapelNoGrupo | null;
  observacao: string | null;
  /**
   * Data CLÍNICA em que o procedimento foi realizado (fiscalização CRO/judicial).
   * Regras: status='realizado' + origem='clinica' → obrigatória (default = data da
   * consulta, editável na confirmação); origem='preexistente' → null permitido
   * ("anterior ao cadastro") ou data aproximada se o paciente informar;
   * status='indicado' → sempre null (nada foi feito ainda).
   * NUNCA inferida pela IA — ver §1.10 e invariante #13.
   */
  realizado_em: string | null;
  /** Data em que o evento entrou no prontuário (ordena o reduce do acumulado). */
  registrado_em: string;
  created_at: string;
}
```

```ts
/** Estado atual reduzido — 1 linha por (dente, tipo, face|null). Saída do endpoint de acumulado. */
export interface OdontogramaEstadoAtual {
  dente: number;
  tipo: TipoRegistroOdontograma;
  face: FaceDental | null;
  status: StatusRegistro;
  origem: OrigemRegistro;
  grupo_id: string | null;
  papel_no_grupo: PapelNoGrupo | null;
  realizado_em: string | null;
  registrado_em: string;
}
```

**Por que event-log (reduce em query) e não tabela materializada** — decisão explícita: um
paciente acumula, na prática, dezenas a poucas centenas de eventos ao longo de anos (32
dentes x 5 faces x handful de tipos é o teto teórico, nunca alcançado). Um
`DISTINCT ON (dente, tipo, face) ... ORDER BY registrado_em DESC` é instantâneo nesse
volume com o índice certo (ver 1.6 do schema SQL), e o odontograma é renderizado por
page-load, não em polling de alta frequência. Materializar exigiria um segundo caminho de
escrita (trigger ou código de aplicação) que pode divergir do log — exatamente o tipo de
bug de consistência que o invariante "event-log nunca sobrescrito" existe pra evitar. Se o
volume real algum dia justificar cache, isso é otimização de fase futura, não desta spec.

### 1.5 Ortodontia — manutenção não pinta odontograma

```ts
export interface OrtoManutencaoInfo {
  arcada: 'superior' | 'inferior' | 'ambas';
  fio: string | null;
  /** Inclui a troca de ligadura ("borrachinhas") — rotina que acompanha a ativação. */
  ativacao: string | null;
  /**
   * Dois tipos de elástico DISTINTOS (correção do Mateus, 16/07 — mecânicas e registros
   * diferentes; um campo único misturava os dois):
   */
  elastico_corrente: string | null;      // cadeia elastomérica na arcada (ex: "corrente de 13 a 23")
  elastico_intermaxilar: string | null;  // entre arcadas, uso domiciliar (ex: "3/16 Classe II, 13→46")
}
```

Quando o relato é só manutenção de aparelho, o Motor A preenche este campo (chips na
ficha) e não gera nenhum `OdontogramaEvento` — decisão #8, o odontograma não aparece
nessa consulta (ver Fluxos UX, cenário d).

### 1.6 Perio — sondagem de 6 pontos

```ts
// src/types/perio.ts

export type SitioPerio = 'MV' | 'V' | 'DV' | 'DL' | 'L' | 'ML';

/** Ordem padrão de sondagem — convenção clínica assumida (ver Assunções); 1 linha pra trocar. */
export const SEQUENCIA_SITIOS_PADRAO: SitioPerio[] = ['MV', 'V', 'DV', 'DL', 'L', 'ML'];

export interface PerioMedidaSitio {
  sitio: SitioPerio;
  profundidade_mm: number;
  sangramento: boolean;
  placa: boolean;
  /** Supuração no sítio. ENTROU em 16/07 (checklist de especialidades do Mateus — antes
   *  estava em não-escopo). Indicador visual próprio; cores dos 3 pontos (sangramento/
   *  supuração/placa) fecham no design-brief da Fatia C. */
  supuracao: boolean;
  /**
   * Recessão gengival do sítio (mm). REVISADO 16/07: era 1 valor por dente — insuficiente.
   * Sem recessão por sítio não existe CAL por sítio, e o estadiamento de periodontite
   * (AAP/EFP 2018) é dirigido por CAL INTERDENTAL (1–2mm=I, 3–4=II, ≥5=III/IV).
   * Opcional: preenchida por TOQUE na revisão (não entra no ditado contínuo — o fluxo
   * de voz da sondagem continua só profundidade+modificadores).
   */
  recessao_mm: number | null;
}

export interface PerioMedidaDente {
  dente: number;
  ausente: boolean;
  sitios: PerioMedidaSitio[];
  mobilidade: 0 | 1 | 2 | 3 | null;
  furca: 0 | 1 | 2 | 3 | null;
}

/**
 * CAL (nível de inserção clínica) = profundidade + recessão — DERIVADO, nunca persistido.
 * "Most computerised clinical systems will calculate CAL automatically" (SDCEP).
 * Null quando a recessão do sítio não foi medida.
 */
export function calDoSitio(s: PerioMedidaSitio): number | null {
  return s.recessao_mm == null ? null : s.profundidade_mm + s.recessao_mm;
}
```

```ts
export type PerioExameStatus = 'em_andamento' | 'revisado_pendente' | 'concluido';

export interface PerioExame {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string;
  ficha_id: string | null;
  status: PerioExameStatus;
  observacoes_gerais: string | null;
  data_exame: string;
  medidas: PerioMedidaDente[];
  created_at: string;
  concluido_em: string | null;
}

/** true se o dente tem >=1 sítio com bolsa >= 4mm — vira selo no odontograma (catálogo #17). */
export function temBolsaAtiva(m: PerioMedidaDente): boolean {
  return !m.ausente && m.sitios.some(s => s.profundidade_mm >= 4);
}
```

### 1.7 Schema SQL — migração aditiva (Fatia A)

> **⚠️ REVISADO 16/07 — modelo de acesso trocado.** Esta seção foi escrita (13/07) sobre o
> silo por dentista, que **morreu em 16/07** (Spec 1 / migration 099): registro clínico é
> da CLÍNICA (todo staff lê), trabalho é do AUTOR (só ele escreve). Além de acompanhar a
> 099, há um motivo clínico próprio: o **acumulado (Fatia B) reduz eventos de TODOS os
> dentistas** pra desenhar a boca — regra #3 do núcleo, "o dente tem UM estado clínico,
> não um por dentista". Com silo no SELECT, o odontograma do dentista B esconderia o canal
> que A fez: **a boca renderizada mentiria**.

RLS segue o modelo do **núcleo clínico compartilhado** (migration
`20260716000000_099_hierarquia_nucleo_clinico_compartilhado.sql`):
`belongs_to_active_clinic(clinica_id) and is_clinic_staff()` pra SELECT (dentistas +
secretária; o protético — Spec 3 Fatia B — fica fora do prontuário), e
`dentista_id = get_my_dentista_id()` pra escrita — mesmo padrão de `fichas` pós-099.
Não inventar um padrão de RLS novo. As tabelas novas ganham **asserções no harness
`supabase/tests/matriz_acesso_clinico.sql`** (leitura cruzada permitida, escrita cruzada
negada) quando a fatia for executada. Número de migração: **próximo disponível** (na data
desta revisão: 100 é do Job A → odontograma = 101, perio = 102).

```sql
-- 097_odontograma_eventos.sql
create table if not exists public.odontograma_eventos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  dentista_id uuid not null references public.dentistas(id) on delete cascade,
  ficha_id uuid references public.fichas(id) on delete set null,
  grupo_id uuid,
  tipo text not null check (tipo in (
    'carie_restauracao','exodontia','endodontia','lesao_periapical',
    'implante','coroa','ponte','selante','inclusao','esfoliacao',
    'fratura','pino_nucleo'
  )),
  status text not null check (status in ('indicado','realizado')),
  origem text not null default 'clinica' check (origem in ('clinica','preexistente')),
  nivel text not null check (nivel in ('arcada','quadrante','dente','face')),
  arcada text check (arcada in ('superior','inferior')),
  quadrante smallint check (quadrante between 1 and 8),
  dente smallint,
  faces text[] not null default '{}',
  papel_no_grupo text check (papel_no_grupo in ('pilar','pontico')),
  observacao text,
  realizado_em date,
  registrado_em date not null default current_date,
  created_at timestamptz not null default now()
);

comment on column public.odontograma_eventos.realizado_em is
  'Data clínica em que o procedimento foi REALIZADO (fiscalização). Distinta de
   registrado_em (quando entrou no prontuário) e created_at (timestamp de auditoria).
   Null quando status=indicado, ou quando pré-existente com data desconhecida.';

-- indicado nunca tem data de realização
alter table public.odontograma_eventos add constraint odontograma_eventos_realizado_em_coerente check (
  status = 'realizado' or realizado_em is null
);
```

```sql
-- invariante de âncora: nivel decide quais campos são obrigatórios
alter table public.odontograma_eventos add constraint odontograma_eventos_ancora_valida check (
  (nivel = 'arcada'    and arcada is not null and quadrante is null and dente is null) or
  (nivel = 'quadrante' and quadrante is not null and dente is null) or
  (nivel = 'dente'     and dente is not null and faces = '{}') or
  (nivel = 'face'      and dente is not null and faces <> '{}')
);

alter table public.odontograma_eventos add constraint odontograma_eventos_dente_fdi check (
  dente is null or
  (dente between 11 and 18) or (dente between 21 and 28) or
  (dente between 31 and 38) or (dente between 41 and 48) or
  (dente between 51 and 55) or (dente between 61 and 65) or
  (dente between 71 and 75) or (dente between 81 and 85)
);

create index if not exists idx_odontograma_eventos_paciente on public.odontograma_eventos(paciente_id, dente);
create index if not exists idx_odontograma_eventos_clinica on public.odontograma_eventos(clinica_id);
create index if not exists idx_odontograma_eventos_ficha on public.odontograma_eventos(ficha_id);
create index if not exists idx_odontograma_eventos_grupo on public.odontograma_eventos(grupo_id) where grupo_id is not null;
-- suporta o reduce "estado atual" via DISTINCT ON paciente+dente+tipo+registrado_em desc
create index if not exists idx_odontograma_eventos_acumulado on public.odontograma_eventos(paciente_id, dente, tipo, registrado_em desc);
```

```sql
alter table public.odontograma_eventos enable row level security;

drop policy if exists "odontograma_eventos_select" on public.odontograma_eventos;
-- Núcleo clínico (099): a clínica lê — o acumulado precisa ver eventos de TODOS os dentistas.
create policy "odontograma_eventos_select" on public.odontograma_eventos for select
  using (belongs_to_active_clinic(clinica_id) and is_clinic_staff());

drop policy if exists "odontograma_eventos_write_own" on public.odontograma_eventos;
create policy "odontograma_eventos_write_own" on public.odontograma_eventos for all
  using (belongs_to_active_clinic(clinica_id) and dentista_id = get_my_dentista_id())
  with check (belongs_to_active_clinic(clinica_id) and is_clinic_dentista() and dentista_id = get_my_dentista_id());

comment on table public.odontograma_eventos is
  'Event-log auditável do odontograma. Convenção de aplicação: append-only — correção de
   erro clínico é um NOVO evento, nunca UPDATE do passado. RLS permite UPDATE/DELETE (mesmo
   padrão de fichas) só como via de escape pra erro de digitação imediato; a UI da Fatia A/B
   não expõe edição de eventos antigos.';
```

Essa tabela é aditiva: nenhuma coluna de `fichas`, `orcamentos` ou `pacientes` muda.
`tipo = 'ponte'` já existe no schema desde a Fatia A (formato final coberto), mas o
**prompt** do organizador só ensina o modelo a emitir esse tipo a partir da Fatia B, quando
o componente sabe desenhar o bracket — evita evento "órfão" visualmente sem suporte.

### 1.8 Schema SQL — migração aditiva (Fatia C, perio)

Migração separada (aplicada só quando a Fatia C começa) — número sugerido: **próximo
disponível na hora**. `perio_medidas` segue o padrão de `orcamento_itens` (RLS via `exists`
na tabela-mãe, já que a linha em si não carrega `dentista_id` direto).

```sql
create table if not exists public.perio_exames (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  dentista_id uuid not null references public.dentistas(id) on delete cascade,
  ficha_id uuid references public.fichas(id) on delete set null,
  status text not null default 'em_andamento' check (status in ('em_andamento','revisado_pendente','concluido')),
  observacoes_gerais text,
  data_exame date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  concluido_em timestamptz
);

create index if not exists idx_perio_exames_paciente on public.perio_exames(paciente_id);
create index if not exists idx_perio_exames_clinica on public.perio_exames(clinica_id);

alter table public.perio_exames enable row level security;
drop policy if exists "perio_exames_select" on public.perio_exames;
-- Núcleo clínico (099): exame perio é registro clínico — a clínica lê, o autor escreve.
create policy "perio_exames_select" on public.perio_exames for select
  using (belongs_to_active_clinic(clinica_id) and is_clinic_staff());
drop policy if exists "perio_exames_write_own" on public.perio_exames;
create policy "perio_exames_write_own" on public.perio_exames for all
  using (belongs_to_active_clinic(clinica_id) and dentista_id = get_my_dentista_id())
  with check (belongs_to_active_clinic(clinica_id) and is_clinic_dentista() and dentista_id = get_my_dentista_id());

drop trigger if exists perio_exames_updated_at on public.perio_exames;
create trigger perio_exames_updated_at
  before update on public.perio_exames
  for each row execute function update_updated_at();
```

```sql
create table if not exists public.perio_medidas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  exame_id uuid not null references public.perio_exames(id) on delete cascade,
  dente smallint not null,
  ausente boolean not null default false,
  -- [{sitio, profundidade_mm, sangramento, placa, recessao_mm}] x6 · recessao_mm nullable
  -- (REVISADO 16/07: recessão POR SÍTIO — CAL deriva na leitura, nunca persiste)
  sitios jsonb not null default '[]',
  mobilidade smallint check (mobilidade between 0 and 3),
  furca smallint check (furca between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exame_id, dente)
);

create index if not exists idx_perio_medidas_exame on public.perio_medidas(exame_id);
create index if not exists idx_perio_medidas_clinica on public.perio_medidas(clinica_id);

alter table public.perio_medidas enable row level security;
drop policy if exists "perio_medidas_select" on public.perio_medidas;
-- Leitura herda o modelo da tabela-mãe: clínica lê (099); a linha não carrega dentista_id.
create policy "perio_medidas_select" on public.perio_medidas for select
  using (belongs_to_active_clinic(clinica_id) and is_clinic_staff());
drop policy if exists "perio_medidas_write_own" on public.perio_medidas;
create policy "perio_medidas_write_own" on public.perio_medidas for all
  using (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from perio_exames e where e.id = perio_medidas.exame_id and e.dentista_id = get_my_dentista_id()
  ))
  with check (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from perio_exames e where e.id = perio_medidas.exame_id and e.dentista_id = get_my_dentista_id()
  ));

drop trigger if exists perio_medidas_updated_at on public.perio_medidas;
create trigger perio_medidas_updated_at
  before update on public.perio_medidas
  for each row execute function update_updated_at();
```

### 1.9 Token novo — `--color-slate` (pré-existente)

O design system tem `--color-teal` (marca), `--color-coral` (negativo/pendência —
"substitui rose/red nos valores financeiros negativos", já reaproveitado aqui pra
"a fazer") e `--color-warning` (atenção). Não existe um terceiro tom neutro pra
"trabalho de outra clínica" sem colidir semanticamente com os três já em uso — ver
justificativa completa na seção de decisões do sumário desta spec. `src/app/globals.css`
ganha, no mesmo padrão dos tokens existentes:

```css
:root {
  --color-slate: #64748b;
  --color-slate-pale: #e2e8f0;
}
.dark {
  --color-slate: #94a3b8;
  --color-slate-pale: #334155;
}
```

E entra no bloco `@theme` junto dos demais (`--color-slate: var(--color-slate);` etc.) e no
comentário de governança de tokens no topo do arquivo (atualizar a linha do `--color-coral`
pra registrar o novo uso de `--color-coral` em pendência de odontograma, e documentar
`--color-slate` como "histórico pré-existente / trabalho de outro profissional").

### 1.10 Fiscalização — data do procedimento e assinatura (requisito do Mateus, 13/07)

Prontuário odontológico em fiscalização (CRO) ou disputa judicial precisa responder, por
procedimento: **o que foi feito, em que data, por quem, e com que atestado**. O modelo
cobre isso com três datas de papéis distintos + a cadeia de assinatura já existente:

> **Validação normativa (pesquisa 16/07)** — o [Manual do Prontuário do CFO (1ª ed., 2026)](https://website.cfo.org.br/wp-content/uploads/2026/03/CFO_Manual_do_Prontuario_Ebook.pdf)
> confirma este desenho ponto a ponto:
> - A evolução deve conter *"a data de execução do trabalho, o dente ou região, o
>   procedimento em si, o profissional executor e vistos/assinaturas, principalmente do
>   paciente, mas também do Cirurgião-dentista (nome e número de inscrição no CRO)"* —
>   é exatamente `realizado_em` + `dentista_id` + a assinatura por ficha + nome/CRO no PDF.
> - Registro clínico *"sem emendas ou rasuras"*; digitalização deve proteger contra
>   *"alteração não autorizada"* — é o event-log append-only (invariantes #4/#14).
> - O odontograma **anatômico** é o ideal: *"um modelo que exponha as cinco faces
>   coronárias e possibilite a visualização integral de coroa e raiz"* — é o
>   `ToothDetailPanel` (5 zonas + raiz) sobre o componente anatômico existente.
> - Recomenda **dois odontogramas** — Inicial (condição em que o paciente chegou) e Final
>   (planejado + executado), *"para que valham como provas específicas e não se macule
>   cada um dos registros"* — é o eixo `origem: preexistente|clinica` + `status:
>   indicado|realizado` + modo `exame_inicial` (3.1.3).
> - O registro preciso importa em *"análises sobre o tratamento de cada Cirurgião-dentista
>   que tenha assistido o paciente, assim como se um terceiro interferiu"* — é o
>   `dentista_id` por evento no modelo do núcleo clínico (099).
> - Moldura legal do prontuário digital: **Lei 13.787/2018 + LGPD**; guarda mínima de
>   **20 anos** a partir do último registro (manual recomenda guarda por tempo
>   indeterminado — ex.: identificação humana). Reforça a decisão de nunca deletar eventos.

| Campo | Papel | Quem preenche |
|---|---|---|
| `realizado_em` | Data CLÍNICA do procedimento (o que a fiscalização pergunta) | Default = data da consulta; dentista edita na confirmação. **Nunca a IA** |
| `registrado_em` | Quando entrou no prontuário (pode diferir — registro retroativo) | Sistema (`current_date`) |
| `created_at` | Timestamp imutável de auditoria | Sistema (`now()`) |

**Regras de `realizado_em`:**
- `status='realizado'` + `origem='clinica'` → obrigatória na UI. A confirmação ganha um
  campo único **"Data do procedimento"** (default = data do agendamento/hoje) aplicado a
  todos os eventos `realizado` da ficha; override por evento no `ToothDetailPanel` (caso
  raro: documentar hoje procedimentos de datas diferentes).
- `origem='preexistente'` → null permitido, renderiza "anterior ao cadastro"; se o paciente
  informar ("fiz esse canal uns 5 anos atrás"), o dentista pode registrar data aproximada
  (dia 01 do mês/ano informado) — a `observacao` guarda o texto original.
- `status='indicado'` → sempre null (constraint SQL). Quando o indicado virar realizado
  (Fatia B), o evento NOVO carrega a data da execução.
- **A IA nunca preenche `realizado_em`** — o campo NÃO existe no JSON Schema do Gemini
  (3.1.1). "Restaurei ontem" narrado NÃO vira data inferida; o dentista ajusta o campo na
  confirmação. Dado legal não pode nascer de inferência probabilística (invariante #13).

**Cadeia de assinatura (aproveita o que existe, amarra o que falta):**
- **Autoria profissional:** todo evento carrega `dentista_id` (RLS garante que só o próprio
  dentista escreve). O prontuário impresso/PDF exibe nome + CRO do responsável por evento.
- **Atestado do paciente:** a assinatura por ficha já existe (`fichas.assinatura_url` +
  `assinado_em`, modal `consulta-assinatura-modal.tsx`, storage `fichas/`). O vínculo:
  eventos apontam pra ficha via `ficha_id` → **a assinatura da ficha cobre os eventos dela**.
  Obrigação nova: o modal de assinatura e o PDF (`src/lib/prontuario-html.ts`,
  `/api/fichas/[id]/pdf`) passam a listar **os procedimentos realizados com suas datas**
  acima da assinatura — o paciente atesta conteúdo explícito, não uma ficha genérica.
- **Pós-assinatura, a ficha congela:** com `assinado_em` preenchido, nem a "via de escape"
  de UPDATE (comment de 1.7) se aplica aos eventos daquela ficha — correção posterior é
  evento novo em ficha nova, com `observacao` de retificação apontando o evento original
  (invariante #14). O que foi assinado permanece exatamente como assinado.
- **Perio:** `perio_exames` já tem `data_exame`, `dentista_id` e `concluido_em`; exame
  vinculado a ficha é coberto pela assinatura dela. Exame avulso (perfil do paciente) fica
  com autoria + data próprias — assinatura do paciente opcional via mesmo modal.
- **Fora de escopo, registrado:** assinatura digital qualificada ICP-Brasil e carimbo de
  tempo criptográfico — se algum dia a exigência regulatória subir, o event-log imutável
  com `created_at` já é a fundação certa. UI badge: ficha sem assinatura mostra "pendente
  de assinatura" no perfil (`FichasTab.tsx`), sem bloquear o fluxo.

---

## Parte 2 — Catálogo de símbolos do odontograma

### 2.1 Desenho-base do dente e sistema de 2 camadas

O `Odontograma.tsx` atual já desenha dentes anatômicos (coroa + raiz, path SVG curvo) em
2 fileiras (arcada superior/inferior), ~30-50px de largura por dente — ótimo pra visão
geral rápida, pequeno demais pra marcar 5 faces com precisão de toque. Em vez de forçar
5 zonas clicáveis dentro de um SVG de 40px (ilegível, toque impreciso), a v3 usa **2
camadas**, sem forkar o componente:

1. **Visão geral da arcada** (o componente atual, estendido) — cada dente mostra a cor
   "dominante" (pior estado entre os registros daquele dente: `indicado` > `realizado` >
   `preexistente` > hígido) como preenchimento da coroa inteira, igual ao componente hoje.
   Serve pra escanear a boca inteira rápido. Multi-dente (ponte) desenha um bracket
   conectando os dentes do grupo por cima da fileira.
2. **Detalhe do dente** (novo painel, abre ao tocar um dente) — mini-diagrama clássico de
   5 zonas em visão oclusal (quadrado central = O, 4 trapézios ao redor = M/D/V/L, formato
   "jogo da velha") + uma raiz estilizada abaixo/ao lado pra endo/implante/lesão
   periapical. Aqui cada face é clicável individualmente, e é onde o dentista corrige por
   toque (item 2.3 da spec-mãe do briefing).

Isso resolve "organização > densidade" (item 11): a arcada fica limpa e escaneável; a
precisão fica a 1 toque de distância, não empilhada na visão geral. O `design-brief` da
Fatia A decide a estética exata (espaçamento, ícones, raio de borda) — esta spec define
a semântica e a interação, não o pixel.

### 2.2 Catálogo completo

Legenda de cor: **coral** = `--color-coral` (a fazer) · **teal** = `--color-teal` (feito
nesta clínica) · **slate** = `--color-slate` (pré-existente) · **neutro** = `--color-text-secondary`/`--color-border` (achado estrutural, sem pendência financeira) · **warning** = `--color-warning` (selo perio, reaproveita o "atenção" já usado no produto).

| # | Estado | Âncora | Representação visual | Cor | Frase que gera | Correção por toque |
|---|---|---|---|---|---|---|
| 1 | Hígido / sem registro | dente (default) | Coroa preenchida neutra, contorno fino — estado `'default'` já existente no componente | `--color-surface-alt` fill / `--color-border` stroke | (nenhuma — ausência de evento) | Toca o dente → abre painel de detalhe vazio, pronto pra lançar registro manual |
| 2 | Cárie / a-restaurar (por face) | face | No painel de detalhe, a(s) zona(s) afetada(s) preenchida(s) sólidas; na arcada, o dente ganha o fill dominante | coral | "tem cárie oclusal no catorze" / "vou restaurar o vinte e seis na próxima" | Toca a zona no painel → cicla sem-registro → a-fazer → feito → remove |
| 3 | Restauração feita (por face) | face | Zona preenchida sólida no painel | teal | "restaurei com resina o quatorze oclusal" | Idem #2 |
| 4 | Restauração pré-existente (por face) | face | Zona preenchida + textura pontilhada leve (reforço não-só-cor, acessibilidade) | slate | Exame inicial: "paciente já tem uma restauração no vinte e seis" | Painel mostra badge "Pré-existente"; toque permite reclassificar pra "feito nesta clínica" |
| 5 | Extração indicada (X vermelho) | dente | X sobreposto na coroa; coroa mantém fill neutro por baixo (ainda está lá) | coral (traço) | "vou extrair o vinte e oito na próxima" | Toque no dente na arcada já alterna (não precisa abrir painel — é nível dente inteiro) |
| 6 | Extraído / ausente | dente | Coroa e raiz ocultas — só contorno tracejado fino, sem preenchimento ("buraco" na arcada) | neutro (`--color-border`) | "o quarenta e seis é resto radicular, extraí" | Toque reabre o dente (desfaz "ausente") |
| 7 | Incluso (contorno tracejado) | dente | Contorno TRACEJADO em `--color-text-secondary`, preenchimento normal por baixo | neutro | "o trinta e oito está incluso, indicação de exposição cirúrgica" | Toque abre painel → toggle "Incluso" + associar exodontia/exposição se houver indicação |
| 8 | Canal a tratar | dente (raiz) | Linha vertical fina TRACEJADA no meio da raiz estilizada | coral | "pulpite no quarenta e seis, vou fazer o canal" | Toque na raiz no painel de detalhe alterna estado do canal |
| 9 | Canal tratado | dente (raiz) | Mesma linha, mas CONTÍNUA (sólida) | teal (feito aqui) / slate (pré-existente) | "terminei o canal do quarenta e seis hoje" / exame inicial: "já tem canal tratado no vinte e seis" | Idem #8. **Retratamento** *(16/07)*: novo evento `indicado` sobre um `realizado` anterior — a arcada volta a tracejado coral e o painel rotula "Retratamento" **derivando do log** (existe realizado anterior), sem símbolo novo |
| 10 | Lesão periapical (círculo no ápice) | dente (ápice) | Círculo VAZADO (só contorno) na ponta da raiz | coral | "radiografia mostrou lesão periapical no vinte e cinco" | Toque na região do ápice no painel de detalhe |
| 11 | Implante (parafuso na raiz) | dente | Raiz estilizada substituída por ícone de parafuso/rosca (retângulo com linhas horizontais, afunilado na ponta) | coral indicado / teal feito / slate pré-existente | "implante osseointegrado no trinta e seis" / "planejar implante no espaço do trinta e sete" | Toque no dente no painel de detalhe |
| 12 | Coroa total (coroa preenchida) | dente | Coroa inteira com contorno DUPLO/mais grosso (+2px) além do fill de cor — distingue de restauração de face | coral/teal/slate conforme status/origem | "coroa de zircônia no vinte e seis" / exame inicial: "paciente já tem coroa no vinte e seis" | Toque no dente |
| 13 | Ponte (colchete pilar-pôntico-pilar) | MULTI-dente (`grupo_id`) | Traço/bracket horizontal conectando os dentes do grupo por cima das coroas na arcada; pôntico com fill hachurado (dente ausente naturalmente, preenchido pela ponte) | coral/teal/slate conforme status/origem predominante do grupo | "ponte do treze ao quinze, pilares no treze e no quinze" | Toque em qualquer dente do grupo → abre painel do GRUPO (papéis, desfazer grupo inteiro ou 1 pilar) — **Fatia B** |
| 14 | Selante | face (sempre 'O') | Ponto/textura pontilhada pequena na zona O do painel de detalhe | teal (quase sempre realizado) | "apliquei selante no dezesseis" | Toque na zona O |
| 15 | Decíduo presente | — (contexto de aba) | Sem símbolo próprio — dentes 51-85 usam o MESMO catálogo acima (cárie/restauração/coroa/etc.), só ancorados em números decíduos | conforme o registro | — | Aba "Decíduos" do componente (já existe) |
| 16 | Esfoliado | dente (decíduo) | Mesmo tratamento de "ausente" (#6) + badge pequeno de seta indicando sucessor permanente ativo | neutro | "o setenta e quatro já caiu, o permanente já irrompeu" | Toque → deep-link pra aba Permanentes destacando o dente correspondente — **Fatia B** |
| 17 | Selo perio (bolsa >=4mm) | dente | Badge extra no canto da coroa (pontinho/anel) — NÃO é `odontograma_eventos`, é derivado de `perio_medidas` | warning | (não vem de narração — vem do exame perio estruturado) | Toque abre o exame perio daquele dente — **Fatia C** |
| 18 | Fratura dentária *(aprovado 16/07)* | dente | Traço em zigue-zague sobre a coroa; achado como #10 (quase sempre `indicado` — o tratamento vira evento próprio: restauração/coroa/exo). `observacao` distingue coronária/radicular | coral | "o paciente caiu e fraturou o onze" / "fratura coronária no vinte e um" | Toque no dente no painel de detalhe |
| 19 | Pino/núcleo intrarradicular *(aprovado 16/07)* | dente (raiz) | Retângulo estreito vertical no terço coronal da raiz estilizada — convive com a linha de canal (#8/#9) | coral indicado / teal feito / slate pré-existente | "cimentei pino no treze" / exame inicial: "já tem núcleo no vinte e cinco" | Toque na raiz no painel de detalhe |

---

## Parte 3 — Contratos de API

### 3.1 `POST /api/dex/formatar-evolucao` — Motor A estendido

Todos os campos v2 vivos (`queixa_principal`, `anotacoes`, `dentes_afetados`, `dentes_observacoes`,
`procedimentos`, `conduta`, `alerta_novo` — `retorno_sugerido` foi **extinto em 16/07** pela
Fatia A da Spec 3, quem decide retorno é o dentista) **permanecem intactos** —
esta é uma extensão aditiva, não uma troca de contrato. `dentes_afetados`/`dentes_observacoes`
continuam alimentando orçamento e sidebar exatamente como hoje; `odontograma_eventos` é a
camada nova, rica, que alimenta o componente visual.

**Request (novo campo opcional):**
```ts
interface FormatarEvolucaoRequest {
  texto: string;
  pacienteNome?: string;
  /** 'exame_inicial' força origem='preexistente' em TODOS os eventos emitidos (ver 3.1.3). */
  modo?: 'consulta' | 'exame_inicial';
}
```

**Response — `EvolucaoFormatada` ganha 2 campos:**
```ts
export interface EvolucaoFormatada {
  // ... campos v2 inalterados ...
  odontograma_eventos: OdontogramaEventoInput[];
  orto_manutencao: OrtoManutencaoInfo | null;
}

/** Formato de entrada pro client — grupo_id já resolvido pra uuid real pela rota. */
export interface OdontogramaEventoInput {
  tipo: TipoRegistroOdontograma;
  status: StatusRegistro;
  origem: OrigemRegistro;
  ancora: AncoraClinica;
  grupo_id: string | null;
  papel_no_grupo: PapelNoGrupo | null;
  observacao: string;
}
```

**3.1.1 — JSON Schema literal (Gemini `Schema`/`Type`) do novo campo:**

```ts
const ODONTOGRAMA_EVENTO_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ['tipo', 'status', 'nivel', 'faces', 'observacao'],
  properties: {
    tipo: { type: Type.STRING, enum: [
      'carie_restauracao','exodontia','endodontia','lesao_periapical',
      'implante','coroa','selante','inclusao','fratura','pino_nucleo',
    ] }, // 'ponte' e 'esfoliacao' só entram no enum a partir da Fatia B (ver 1.4);
         // 'fratura'/'pino_nucleo' entram na A (dente único, painel já desenha)
    status: { type: Type.STRING, enum: ['indicado', 'realizado'] },
    nivel: { type: Type.STRING, enum: ['arcada', 'quadrante', 'dente', 'face'] },
    arcada: { type: Type.STRING, enum: ['superior', 'inferior'], nullable: true },
    quadrante: { type: Type.INTEGER, nullable: true },
    dente: { type: Type.INTEGER, nullable: true },
    faces: { type: Type.ARRAY, items: { type: Type.STRING, enum: ['O', 'M', 'D', 'V', 'L'] } },
    grupo_id: { type: Type.STRING, nullable: true }, // tag curta do modelo (ex: "g1") — rota troca por uuid
    observacao: { type: Type.STRING },
  },
};
```

`EVOLUCAO_SCHEMA` (v2, já em produção) ganha:
```ts
odontograma_eventos: { type: Type.ARRAY, items: ODONTOGRAMA_EVENTO_SCHEMA },
orto_manutencao: {
  type: Type.OBJECT,
  nullable: true,
  properties: {
    arcada: { type: Type.STRING, enum: ['superior', 'inferior', 'ambas'] },
    fio: { type: Type.STRING, nullable: true },
    ativacao: { type: Type.STRING, nullable: true },
    elastico_corrente: { type: Type.STRING, nullable: true },
    elastico_intermaxilar: { type: Type.STRING, nullable: true },
  },
},
```
Todos os campos v2 (`queixa_principal` etc.) continuam `required` como já são hoje — o
schema só ganha 2 propriedades novas, nenhuma existente muda de tipo ou obrigatoriedade.

**3.1.2 — Regras novas de prompt (adendo ao prompt C3 já em produção, não substitui):**

1. Pra cada achado/procedimento já extraído em `dentes_observacoes` (lógica v2 inalterada),
   emitir TAMBÉM o(s) evento(s) de `odontograma_eventos` correspondente(s), usando o
   catálogo de `tipo` da Parte 2. "Achado sem intervenção dita" (ex: "tem cárie no 14")
   gera `status:'indicado'` do mesmo jeito que "vou restaurar o 14" — o glossário já
   ensina achado -> intervenção correspondente (regra v2 mantida), estendemos pra também
   gerar o evento visual, não só o texto.
2. **MOD e multi-face**: uma restauração que cobre mais de uma face gera 1 evento por
   face (`faces` do MESMO evento pode conter várias — ex: MOD = `faces: ['M','O','D']`
   num único evento, não 3 eventos separados) — um evento, várias faces, é 1 ato clínico.
3. **Ponte** (só a partir da Fatia B, quando o `tipo` entrar no enum do schema): 2+ eventos
   com o MESMO `grupo_id` (tag curta tipo `"g1"`), `papel_no_grupo` distinguindo pilar de
   pôntico.
4. **status deriva do vocabulário já existente**: "planejado"/"vou fazer"/"indiquei" ->
   `indicado`; "fiz"/"realizei"/verbo no passado -> `realizado` — mesma distinção que a
   regra "PLANEJADO TAMBÉM CONTA" (D6/adendo G) já usa pros campos v2, sem vocabulário novo
   pra aprender.
5. **Negação explícita** ("não fiz o canal, só o curativo") nunca gera evento com
   `status:'realizado'` pro que foi negado — vira, no máximo, `status:'indicado'` (o
   curativo é um passo intermediário, o canal continua pendente).

**3.1.3 — Modo `exame_inicial`:** a ROTA (não o modelo) força `origem:'preexistente'` em
TODOS os eventos emitidos quando `modo==='exame_inicial'` — decisão deliberada de não
confiar essa classificação por-item ao LLM (o objetivo do modo é justamente narrar
condições que já existiam; se o dentista também executar algo novo na mesma sessão, a
orientação de UX é dizer isso numa dictation SEPARADA, com o modo desligado — ver Fluxos,
cenário b).

**3.1.4 — Pós-processamento na rota (mesmo espírito do backstop de órfão já existente):**
- Filtra `tipo`/`status`/`nivel`/`faces` fora do enum (defesa contra alucinação de valor,
  mesmo padrão de `isValidFDI`).
- Troca cada tag curta de `grupo_id` (`"g1"`, `"g2"`...) por um `crypto.randomUUID()` real,
  mantendo o mapeamento consistente dentro da mesma resposta.
- Valida `dente` contra `isValidFDI` (função já existente, reaproveitada) quando presente.
- `odontograma_eventos` malformado ou ausente no wire -> `[]` (nunca quebra a resposta;
  os campos v2 continuam valendo mesmo se a camada visual falhar — igual ao espírito de
  D5 da spec fase1-5, erro na parte nova não derruba o que já funciona).

| | |
|---|---|
| Auth | obrigatório (dentista da clínica ativa) |
| Rate limit | sim — mesmo bucket já existente (`dex:formatar-evolucao`, 20/60s) |

**Erros:** inalterados da v2 (400 body/texto vazio, 401 não autenticado, 500 sem `GEMINI_API_KEY`
ou erro de IA).

### 3.2 `POST /api/dex/detectar-consulta` — chip ganha status

```ts
export interface ProcedimentoDetectado {
  descricao: string;
  dentes: number[];
  status: 'indicado' | 'realizado';   // NOVO — dirige a cor do chip (coral/teal) no painel ao vivo
}
```
Schema ganha `status` como propriedade `required` com `enum: ['indicado','realizado']`.
Sem granularidade de face/âncora completa aqui — o preview ao vivo continua
deliberadamente leve (mesmo espírito de design original da rota: "sem tabela de preços,
sem ficha"). Auth/rate-limit/erros inalterados.

### 3.3 Rotas do exame perio (Fatia C, CRUD sem LLM)

Route Handlers (não Server Actions) — reutilizadas por 2 entry points (consulta E perfil
do paciente), o que favorece uma superfície de API compartilhada em vez de duplicar
`actions.ts`. Auth via `requireClinicContext()`; RLS na tabela cobre o isolamento por
dono; sem rate-limit (não chama LLM, mesmo padrão de `salvarFichaConsulta`).

**`POST /api/perio/exames`** — cria exame, status inicial `'em_andamento'`.
Request: `{ pacienteId: string; fichaId?: string }` · Response: `{ exameId: string }`.

**`GET /api/perio/exames?pacienteId=...`** — lista exames do paciente (histórico).
Response: `{ exames: Pick<PerioExame,'id'|'status'|'data_exame'|'concluido_em'>[] }`.

**`GET /api/perio/exames/[exameId]`** — detalhe completo (tela de revisão/edição).
Response: `PerioExame` completo (com `medidas`).

**`PUT /api/perio/exames/[exameId]/medidas`** — upsert de 1 dente (chamado ao completar
os 6 sítios de um dente ou marcá-lo ausente — não por sítio individual, avanço de célula é
100% local até fechar o dente).
Request: `PerioMedidaDente` · Response: `{ ok: true }`.

**`POST /api/perio/exames/[exameId]/concluir`** — valida server-side que todo dente
não-ausente tem os 6 sítios preenchidos; marca `status:'concluido'`, `concluido_em:now()`.
Response: `{ ok: true }` ou `400 { error: 'dentes incompletos: [...]' }`.

| | |
|---|---|
| Auth | obrigatório, `is_clinic_dentista()` (secretária não escreve, mesmo padrão de fichas) |
| Rate limit | não (CRUD puro) |

**Erros comuns às 5 rotas:** 401 não autenticado · 403 secretária tentando escrever · 404
exame/paciente fora da **clínica ativa** (RLS bloqueia — nunca vaza existência; dentro da
clínica todo staff lê, modelo 099) · 400 body inválido ou (na rota de concluir) grade
incompleta.

### 3.4 `GET /api/pacientes/[id]/odontograma-acumulado` — Fatia B

Reduz `odontograma_eventos` (mais recente por dente+tipo+face) + resumo de selos perio.
Implementação sugerida (view ou query direta na rota, não tabela):

```sql
-- estado atual a nível dente inteiro
select distinct on (dente, tipo)
  dente, tipo, status, origem, faces, grupo_id, papel_no_grupo, registrado_em
from odontograma_eventos
where paciente_id = $1 and nivel = 'dente'
order by dente, tipo, registrado_em desc, created_at desc;

-- estado atual por face (unnest pra reduzir por dente+tipo+face individual)
select distinct on (dente, tipo, face)
  dente, tipo, status, origem, face, grupo_id, registrado_em
from odontograma_eventos, unnest(faces) as face
where paciente_id = $1 and nivel = 'face'
order by dente, tipo, face, registrado_em desc, created_at desc;
```

**Response:**
```ts
interface OdontogramaAcumuladoResponse {
  estados: OdontogramaEstadoAtual[];
  perio_selos: { dente: number; bolsa_max_mm: number }[];  // só dentes com bolsa >= 4mm
  atualizado_em: string;
}
```

| | |
|---|---|
| Auth | obrigatório |
| Rate limit | não (leitura, sem LLM) |

**Erros:** 401 não autenticado · 404 paciente não encontrado ou fora da clínica ativa
(RLS — nunca 403 explícito, pra não confirmar existência de paciente de outra clínica).

---

## Parte 4 — Fluxos UX

### (a) Consulta comum, boca pintada

1. Dentista dita/digita como já faz hoje (textarea + Ditar, inalterado).
2. Toca "Organizar com DEX" → `formatar-evolucao` (modo padrão `'consulta'`).
3. Tela de confirmação (remodelada — ver cenário f): coluna esquerda = textos (igual hoje);
   coluna direita = odontograma pintado (visão geral) + lista compacta AGRUPADA por
   dente/região (substitui a lista plana atual).
4. Confirma → `salvarFichaConsulta` grava a ficha (campos v2 inalterados) **e** insere os
   `odontograma_eventos` (novo, Fatia A) com `dentista_id`/`clinica_id`/`ficha_id` da
   sessão, `origem:'clinica'`.
5. Aparece: odontograma. Não aparece: nada novo além do já existente — este É o caso base.

### (b) Exame inicial, paciente novo com pré-existentes

1. Na tela de captura (mesma tela, texto/voz), um toggle **"Exame inicial"** fica visível
   só quando o paciente ainda não tem nenhum `odontograma_eventos` (heurística: 1ª consulta
   ou perfil "zerado" — evita o dentista esquecer de desligar em consultas seguintes).
2. Dentista narra o estado da boca inteira ("paciente apresenta coroa no 26, implante no
   46, restauração antiga no 14...").
3. `formatar-evolucao` chamado com `modo:'exame_inicial'` → todos os eventos saem
   `origem:'preexistente'` (3.1.3).
4. Confirmação mostra a boca já pintada em **slate** predominante (não coral/teal) —
   reforço visual de que é histórico herdado, não trabalho de hoje.
5. Se o dentista também tratar algo nessa mesma visita, a orientação de UX (tooltip no
   toggle) é: narrar o exame inicial primeiro, desligar o toggle, narrar o procedimento de
   hoje numa segunda passada — mantém a classificação `origem` confiável sem pedir ao LLM
   uma decisão por-item que ele erraria com frequência maior do que um toggle binário.
6. Aparece: odontograma majoritariamente slate. Não aparece: nenhuma cobrança de orçamento
   nova (pré-existente não gera pendência — só "realizado" bloqueia coral).

### (c) Exame perio dentro da consulta

Coberto em detalhe na Parte 5 (Periodontograma). Resumo do fluxo: botão "Exame
periodontal" na tela da consulta → grade toma a tela inteira (`PerioExameOverlay`,
mantém `agendamentoId`/`fichaId` em contexto) → sondagem com grade/ditado → revisão
OBRIGATÓRIA da grade inteira → salva → volta ao fluxo normal da consulta. Também acessível
direto do perfil do paciente, fora de uma consulta ativa (`fichaId: null`).

### (d) Manutenção de orto por arcada

1. Dentista dita "troquei o arco superior, ativei, troquei as borrachinhas, corrente do
   treze ao vinte e três, mantive o intermaxilar três dezesseis".
2. `formatar-evolucao` preenche `orto_manutencao` (1.5) — chips fio/ativação/corrente/
   intermaxilar na ficha, âncora = arcada.
3. **Nenhum** `odontograma_evento` é gerado.
3b. **Atalho "igual à última"** *(proposto 16/07 — dor de campo: "mal têm tempo de
   preencher ficha")*: um toque pré-preenche os chips com a manutenção anterior do
   paciente; o dentista ajusta só o que mudou. A consulta mensal recorrente vira 2 toques
   + salvar. Sem última manutenção, o atalho não aparece.
4. Tela de confirmação: coluna direita mostra os chips de manutenção, **não mostra o
   odontograma vazio** — condição explícita: `odontograma_eventos.length === 0 && orto_manutencao != null` esconde o card do odontograma e substitui por um card compacto de
   manutenção (evita "boca vazia inútil" citado no briefing).

### (e) Criança / dentição mista

1. Idade do paciente (`pacientes.data_nascimento`, já existe) decide a aba default do
   componente: **< 6 anos** → Decíduos; **6-12 anos** → Decíduos com indicador de mista
   (ver abaixo); **> 12 anos** → Permanentes. Constantes nomeadas, não mágicas espalhadas.
2. Narrativa usa números decíduos normalmente (51-85, já suportado desde a spec fase1-5).
3. Evento `tipo:'esfoliacao'` (Fatia B) marca o decíduo como "ausente" (mesmo visual do
   catálogo #6) + badge de seta pro sucessor permanente.
4. MVP explícito (não constrói chart mesclada numa única fileira): dentição mista fica nas
   2 abas já existentes (Permanentes/Decíduos) com o indicador de contagem já existente no
   componente; o badge de esfoliação é o elo entre elas. Chart única mesclada por posição
   anatômica fica registrada como possível refinamento futuro, não obrigação da v3.

### (f) Correção por toque na confirmação

1. Tela de confirmação (remodelada): lista agrupada por dente/região em vez de lista plana
   (resolve o caso de 20+ procedimentos virando lista ingerenciável).
2. Toca um dente (na lista OU no odontograma) → abre o painel de detalhe (2.1) com as 5
   zonas + raiz.
3. Corrige: muda `status`/`origem`, ajusta `faces`, remove o evento inteiro.
4. Fecha o painel → lista agrupada e odontograma refletem a mudança imediatamente (estado
   local, só persiste no `Confirmar e salvar`).

---

## Parte 5 — Periodontograma (Fatia C) em detalhe

### 5.1 Layout da grade

2 fileiras de dentes (superior/inferior, mesma ordem FDI do odontograma principal), 6
células por dente (uma por `SitioPerio`), organizadas em 2 sub-linhas por dente — 3
sítios vestibulares (MV, V, DV) numa sub-linha, 3 linguais/palatinos (DL, L, ML) na outra,
espelhando fisicamente como o dentista sonda (lado de fora, depois lado de dentro). Cada
célula mostra: profundidade em mm (número grande), e 2 indicadores pequenos
(sangramento = ponto vermelho, placa = ponto amarelo). Dente ausente colapsa as 6 células
numa faixa cinza "ausente" (não ocupa espaço de sondagem). Mobilidade/furca ficam num
mini-resumo abaixo de cada dente (fora da grade de 6 pontos), preenchíveis por toque (não
fazem parte do ditado numérico contínuo). **Recessão é POR SÍTIO** (revisado 16/07 — ver
§1.6): linha opcional na grade preenchível por toque na sondagem ou na revisão; quando
preenchida, a célula exibe também o **CAL derivado** (`profundidade + recessão`) — nunca
digitado, nunca persistido. A gramática de voz (5.3) NÃO ganha token de recessão: o ditado
contínuo segue sendo só profundidade + modificadores, pra não dobrar o ritmo da sondagem.
**Linhas gengivais** *(16/07)*: com PD + recessão por sítio, os dados sustentam desenhar a
**margem gengival e a linha de CAL** sobre os dentes (o visual clássico de periograma que
periodontistas esperam — ex. perio-tools). Se o v1 desenha as linhas ou fica na grade
numérica é decisão do **design-brief da Fatia C** — o modelo de dados já habilita as duas.

### 5.2 Caminho técnico do ditado — Web Speech API, não Whisper

**Decisão: `window.SpeechRecognition`/`webkitSpeechRecognition` (nativo do browser,
`continuous:true`, `interimResults:true`, `lang:'pt-BR'`), zero LLM, zero round-trip de
servidor no caminho quente.**

Trade-off considerado e descartado — **Whisper com parsing determinístico** (reusar o
hook de gravação+corte-por-silêncio já existente, encurtando o threshold pra utterances
curtas): teria round-trip de upload+transcrição de ~300-800ms POR NÚMERO, mais o próprio
delay de detecção de silêncio pra saber que a utterance acabou — inviável pro ritmo real
de sondagem (dentista falando ~1 número por 0,5-1s). Web Speech API dá resultados
`interim` quase instantâneos (100-300ms no Chrome) porque não há upload de blob nem espera
de silêncio — ela já roda como reconhecimento de comando contínuo, exatamente o perfil de
uso aqui (vocabulário curto e fechado: dígitos + ~6 palavras-comando).

**Risco assumido e mitigado:** cobertura de browser (Chrome/Edge só; Safari/Firefox sem
suporte confiável) e precisão de dígito isolado em PT-BR sob ruído de consultório —
**não validados em campo**. Por isso a grade **sempre** suporta toque/teclado puro como
caminho garantido (não é fallback de segundo nível, é o caminho SEMPRE disponível); voz é
acelerador opt-in. Isso também resolve a preocupação do Bloco 4/pergunta 14 do roteiro de
campo (constrangimento de ditar na frente do paciente) — quem não quiser falar, não fala.

### 5.3 Gramática de voz (vocabulário fechado, determinístico)

| Token falado | Efeito |
|---|---|
| dígitos `zero`-`quinze` (ou dígito puro reconhecido, ex. "3") | Preenche `profundidade_mm` do sítio ATUAL |
| "sangrou" / "sangramento" | Marca `sangramento:true` no sítio recém-preenchido (ANTES do próximo número) |
| "placa" | Marca `placa:true` no sítio recém-preenchido |
| "ausente" | Marca o DENTE atual como `ausente:true`, pula os 6 sítios, avança pro próximo dente |
| "volta" / "anterior" | Move o cursor 1 sítio pra trás (corrige o último número) |
| "pula" / "pula pra [número FDI]" | Move o cursor pro dente citado (reusa o parser FDI já existente no dicionário) |
| "cancela último" | Desfaz a última entrada sem mover o cursor |

Nenhum desses tokens passa por LLM — é `switch`/regex sobre o texto reconhecido pelo Web
Speech API, com uma tabela de sinônimos fixa (ex.: `["sangrou","sangramento","sangra"]`).

### 5.4 Máquina de estados do auto-avanço

Cursor = `{ dente_idx, sitio_idx }`, sequência de sítios = `SEQUENCIA_SITIOS_PADRAO` (1.6).

- Um **número** reconhecido: grava `profundidade_mm` no sítio atual. **Não avança
  imediatamente** — fica numa janela curta (~700ms) aceitando modificadores ("sangrou",
  "placa") pro MESMO sítio.
- A janela fecha (por timeout OU por chegar um NOVO número, o que vier primeiro) → avança
  o cursor pro próximo sítio; ao fechar o 6º sítio de um dente, avança pro próximo dente.
- Ao fechar o último sítio do último dente presente → `status` do exame vira
  `'revisado_pendente'` e a tela de revisão obrigatória abre sozinha.
- "ausente" e "pula" são imediatos (não esperam janela).

### 5.5 Revisão obrigatória

Tela cheia, somente leitura + editável por toque (não por voz — a revisão é
deliberadamente um modo mais lento e visual). Mostra a grade inteira preenchida; qualquer
célula pode ser corrigida por toque/teclado. Botão "Concluir exame" só habilita quando
todo dente não-ausente tem os 6 sítios preenchidos (mesma validação do servidor, 3.3) —
gate duplo (client UX + servidor), nunca confiar só no client pra um invariante clínico.

### 5.6 Edge cases

- **Dente ausente**: comando "ausente" ou toque direto na faixa cinza da grade — os 6
  sítios não existem, não bloqueiam a conclusão.
- **Implante**: sondagem de peri-implante é clinicamente válida mas usa limiares
  diferentes — v3 trata implante como dente normal na grade (mesma UI), sem lógica
  especial de limiar; registrado como possível refinamento futuro, não bloqueia a Fatia C.
- **Dentes pulados** (ex. sisos ausentes de nascença): grade permite pular via toque direto
  em qualquer dente, sem exigir ordem sequencial estrita — só a validação final de
  "todo dente PRESENTE tem 6 sítios" é obrigatória, não a ordem de preenchimento.
- **Erro de reconhecimento** (número errado): "volta" ou correção por toque durante a
  sondagem; a revisão obrigatória é a rede de segurança final.

---

## Parte 6 — Invariantes

Lista testável — cada item deve ser verificável por eval, teste manual ou leitura de código:

1. **A IA nunca persiste sozinha.** `formatar-evolucao`/`detectar-consulta` só retornam
   propostas; `salvarFichaConsulta` (ação do dentista, botão "Confirmar e salvar") é o
   único caminho de escrita em `odontograma_eventos`/`fichas`.
2. **Motor B (perio) tem zero inferência de LLM no caminho dos números.** Web Speech API →
   parser determinístico → grade. Nenhuma chamada a `generateStructuredGemini`/Groq no
   loop de sondagem.
3. **Revisão da grade perio é obrigatória antes de `concluir`**, validada client E servidor
   (5.5) — nunca só uma das duas camadas.
4. **`odontograma_eventos` é conceitualmente append-only** — correção de erro clínico
   confirmado é um evento novo, não um `UPDATE` do passado (1.4/1.7).
5. **Toda query nas tabelas novas passa por `clinica_id` + o modelo do núcleo clínico
   (099)** — SELECT: `belongs_to_active_clinic` + `is_clinic_staff()` (a clínica lê;
   o acumulado depende de ver eventos de todos os dentistas); escrita:
   `dentista_id = get_my_dentista_id()` (só o autor). Nunca uma query sem esse filtro,
   nem em rota de API nem em Server Action. *(Revisado 16/07 — era "silo por dentista".)*
6. **Dark mode obrigatório** — todo componente novo usa tokens (`bg-surface`,
   `text-text-primary`, `--color-coral`/`--color-teal`/`--color-slate`/`--color-warning`),
   nunca hex hardcoded nem `dark:` condicional.
7. **TypeScript estrito, zero `any`** nos tipos/rotas novos.
8. **Âncora sempre válida na hierarquia** — a constraint SQL (`odontograma_eventos_ancora_valida`,
   1.7) e a validação da rota concordam: `nivel` decide quais campos são
   obrigatórios/proibidos, nunca uma combinação inconsistente chega ao banco.
9. **Decíduo <-> permanente consistente** — um evento `tipo:'esfoliacao'` só é aceito pra
   dente 51-85; não existe esfoliação de dente permanente.
10. **`dentes_afetados`/`dentes_observacoes` legados nunca mudam de contrato** por causa
    desta spec — Motor A escreve os campos v2 exatamente como hoje, em paralelo aos
    eventos novos.
11. **`tipo='ponte'`/`tipo='esfoliacao'` só entram no `enum` do prompt/schema quando a
    fatia que sabe renderizá-los estiver no ar** (Fatia B) — nunca gerar dado que a UI
    ainda não sabe desenhar.
12. **Migração é sempre aditiva** — nenhuma coluna existente de `fichas`, `pacientes`,
    `orcamentos`, `procedimentos` muda de tipo, nome ou obrigatoriedade nesta spec.
13. **Dado legal nunca nasce de IA** — `realizado_em` e qualquer campo de assinatura NÃO
    existem no JSON Schema do Gemini nem em prompt algum; data vem do contexto da consulta
    + edição manual do dentista (1.10). A IA organiza relato clínico, não atesta fatos
    legais.
14. **Ficha assinada congela seus eventos** — com `fichas.assinado_em` preenchido, os
    `odontograma_eventos` daquela ficha ficam imutáveis inclusive pra "via de escape";
    correção posterior é evento novo em ficha nova com `observacao` de retificação (1.10).

---

## Parte 7 — Plano de eval

Estende `plans/specs/eval/formatar-evolucao-casos.json` e `run-formatar-evolucao.mjs` (não
cria harness novo). Checks novos no runner: `odontograma_eventos_contem` (lista de
`{tipo, status, dente, faces?}` esperados), `odontograma_eventos_nao_contem` (mesma forma,
pra negação), `grupo_consistente` (todos os eventos de um `grupo_id` compartilham o mesmo
`grupo_id` resolvido — não checa o UUID exato, checa que agruparam).

| Caso novo | O que valida |
|---|---|
| `mod-multiface-36` | "restaurei MOD no trinta e seis" → 1 evento `carie_restauracao`, `faces:['M','O','D']`, `status:'realizado'` |
| `ponte-13-15` (só válido a partir da Fatia B) | "ponte do treze ao quinze, pilares no treze e no quinze" → 3 eventos `tipo:'ponte'` mesmo `grupo_id`, papéis pilar/pontico/pilar corretos |
| `exame-inicial-preexistentes` | Narrativa de exame inicial com `modo:'exame_inicial'` → 100% dos eventos com `origem:'preexistente'` |
| `orto-manutencao-arcada` | "troquei o arco superior, ativei" → `orto_manutencao` preenchido, `odontograma_eventos: []` |
| `deciduo-restauracao-74` | "restaurei o setenta e quatro com ionômero" → evento âncora dente 74 (decíduo), mesmo `tipo` de um permanente |
| `reab-boca-20-procedimentos` (reusa o caso pesado 17-dentes já existente, estendido) | `odontograma_eventos` cobre os mesmos dentes de `dentes_afetados`, sem órfão nem duplicata |
| `negacao-canal-so-curativo` | "não fiz o canal, só o curativo" → `odontograma_eventos_nao_contem: [{tipo:'endodontia', status:'realizado'}]` |
| `fratura-trauma-11` *(16/07)* | "paciente caiu e fraturou o onze" → evento `fratura`, dente 11, `status:'indicado'` — e NÃO gera `carie_restauracao` fantasma |
| `pino-nucleo-13` *(16/07)* | "cimentei pino no treze" → evento `pino_nucleo`, dente 13, `status:'realizado'` |

**Critérios de PASS** (mesmo espírito do gate já em produção — spec fase1-5 §F):
- >= 8/9 casos novos PASS (eram 7; `fratura-trauma-11` e `pino-nucleo-13` entraram em
  16/07) · zero órfão em `odontograma_eventos` (evento com `dente` fora de
  `dentes_afetados` quando aplicável) · zero alucinação de `tipo`/`status`/`face` fora
  do enum.
- Latência p95 da rota continua < 6s (mesmo gate — o campo novo não deve estourar o
  teto já validado; se estourar, primeira ação é revisar `maxOutputTokens`, não relaxar o
  gate).
- Caso não-PASS admissível: variação benigna de interpretação (ex.: MOD vira 2 eventos de
  1 face cada em vez de 1 evento de 2 faces) — falha de forma, não de conteúdo clínico;
  registrar e decidir se vale ajuste de prompt ou tolerância no check.

---

## Parte 8 — Fatiamento em 3 fatias

### Fatia A — Fundação: schema, Motor A, odontograma base, confirmação remodelada

**Entrega:** schema/types + organizador estendido + componente odontograma com overlays
narrativos + confirmação remodelada + exame inicial pré-existentes + fix do briefing
preto.

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<next>_odontograma_eventos.sql` | NOVO — tabela + RLS (1.7) |
| `src/app/globals.css` | Token `--color-slate`/`--color-slate-pale` (1.9) |
| `src/types/odontograma.ts` | NOVO — tipos da Parte 1 |
| `src/app/api/dex/formatar-evolucao/route.ts` | Schema+prompt estendidos (3.1), modo `exame_inicial` |
| `src/app/api/dex/detectar-consulta/route.ts` | Chip ganha `status` (3.2) |
| `src/components/odontograma/Odontograma.tsx` | Novas props: `eventos?`, `colorMode='clinico'` |
| `src/components/odontograma/ToothDetailPanel.tsx` | NOVO — painel 5 zonas + raiz (2.1) |
| `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` | Fase única (state machine, ver fix abaixo), toggle "Exame inicial", grid remodelado, campo "Data do procedimento" (1.10) |
| `src/app/consulta/[agendamentoId]/_components/tooth-group-list.tsx` | NOVO — lista agrupada por dente/região |
| `src/app/consulta/[agendamentoId]/actions.ts` | `salvarFichaConsulta` grava `odontograma_eventos` com `realizado_em`; guard de ficha assinada (invariante #14) |
| `src/app/consulta/[agendamentoId]/_components/consulta-assinatura-modal.tsx` | Lista procedimentos realizados + datas acima da assinatura (1.10) |
| `src/lib/prontuario-html.ts` + `src/app/api/fichas/[id]/pdf/route.ts` | PDF exibe eventos com `realizado_em`, nome+CRO do responsável, assinatura (1.10) |
| `plans/specs/eval/formatar-evolucao-casos.json`, `run-formatar-evolucao.mjs` | Casos novos (Parte 7) |

**Fix do "briefing preto"** — diagnóstico: `ConsultationSidebar` some por condicional dura
(`!(evolucao && !saved)`, linha ~443 de `consulta-client.tsx`) no MESMO render em que o
overlay `bg-bg/90` (linha ~480, `isFormatando`) ainda pode estar presente e o
`AnimatePresence mode="wait"` troca a chave "input" -> "confirm" — em dark mode, `--color-bg`
é quase preto e a sobreposição de 90% de opacidade some do DOM sem crossfade sincronizado
com o desaparecimento da sidebar, gerando um frame de tela quase-preta. **Correção
prescrita**: substituir os 3 booleanos/nullable soltos (`isFormatando`, `evolucao`,
`saved`) por um único estado `fase: 'captura' | 'organizando' | 'confirmando' | 'salvo'`,
e derivar TANTO a visibilidade da sidebar QUANTO a chave do `AnimatePresence` do MESMO
valor — elimina a janela onde os dois se movem em renders diferentes.

**Verificável:** `npm run typecheck`/`lint`/`build` limpos · eval >= 6/7 casos novos PASS
(Parte 7) · dogfood manual na clínica do Mateus (dictar consulta comum + exame inicial,
conferir odontograma pintado e sem flash preto na transição).
**Dependências:** nenhuma (parte-base de tudo).
**Risco principal:** precisão do Motor A em multi-face (MOD) — mitigado pelo eval + revisão
sempre visível/editável na confirmação (nunca é "confiar cegamente na IA").

### Fatia B — Acumulado, ponte, vínculo com orçamento, dentição mista

**Entrega:** acumulado no perfil do paciente + prótese/ponte (relação multi-dente) +
vínculo vermelho->orçamento + dentição mista/esfoliação.

| Arquivo | Mudança |
|---|---|
| `src/app/api/pacientes/[id]/odontograma-acumulado/route.ts` | NOVO (3.4) |
| `src/server/patients/get-patient-workspace-data.ts` | Busca o acumulado pro perfil |
| `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` | Nova seção/aba com o odontograma acumulado |
| `src/components/odontograma/Odontograma.tsx` | Render do bracket de ponte (multi-dente), esfoliação (badge) |
| `src/app/api/dex/formatar-evolucao/route.ts` | `tipo` ganha `'ponte'`/`'esfoliacao'` no enum do prompt/schema (agora que a UI renderiza) |
| `src/app/api/sugerir-orcamento/route.ts` | Itens vermelhos (`status:'indicado'`) chegam já vinculados a dente/face via `odontograma_eventos`, não adivinhados por texto |
| `supabase/migrations/<next>_orcamento_itens_face.sql` | Coluna aditiva `face text` em `orcamento_itens` (já existe `dente text`) |

**Verificável:** eval (casos `ponte-13-15`) PASS · dogfood: perfil do paciente mostra boca
acumulada correta após 2+ consultas · orçamento gerado a partir de item vermelho já chega
com dente+face preenchidos, sem heurística de texto.
**Dependências:** Fatia A (tabela, componente base, Motor A já emitindo eventos).
**Risco principal:** query de acumulado (3.4) ficar lenta em pacientes com histórico muito
longo — mitigado pelo índice `idx_odontograma_eventos_acumulado` (1.7); se algum dia isso
não bastar, materializar é a válvula de escape já registrada como não-decisão desta spec.

### Fatia C — Periodontograma completo + Motor B

**Entrega:** grade de 6 pontos, ditado por Web Speech API, revisão obrigatória, selos no
odontograma principal.

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<next>_perio_exames.sql` | NOVO — `perio_exames` + `perio_medidas` + RLS (1.8) |
| `src/types/perio.ts` | NOVO — tipos da Parte 1.6 |
| `src/app/api/perio/exames/route.ts` | NOVO — POST criar, GET listar (3.3) |
| `src/app/api/perio/exames/[exameId]/route.ts` | NOVO — GET detalhe |
| `src/app/api/perio/exames/[exameId]/medidas/route.ts` | NOVO — PUT upsert por dente |
| `src/app/api/perio/exames/[exameId]/concluir/route.ts` | NOVO — POST concluir (valida grade completa) |
| `src/hooks/usePerioVoice.ts` | NOVO — wrapper Web Speech API + parser determinístico (5.2-5.4) |
| `src/components/perio/PerioGrade.tsx` | NOVO — grade 6-pontos + máquina de estados |
| `src/components/perio/PerioReview.tsx` | NOVO — tela de revisão obrigatória |
| `src/components/perio/PerioExameOverlay.tsx` | NOVO — overlay full-screen, os 2 entry points montam este componente |
| `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` | Botão "Exame periodontal" -> monta `PerioExameOverlay` |
| `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` | Idem, entry point fora de consulta ativa |
| `src/components/odontograma/Odontograma.tsx` | Selo de bolsa >=4mm (catálogo #17) via `perio_selos` |

**Verificável:** revisão obrigatória testada (não deixa concluir com grade incompleta,
client E servidor) · teste com ditado real (Chrome, ambiente com ruído de fundo simulado)
valida ou derruba a premissa da Web Speech API — se falhar consistentemente, o fallback
já é o caminho garantido (toque/teclado), não é um bloqueador de entrega, é um dado que
decide se a voz vira feature "beta" ou "padrão".
**Dependências:** Fatia A (componente odontograma base, entry point na tela de consulta já
existente). Fraco acoplamento com Fatia B (não depende do acumulado nem de ponte).
**Risco principal:** cobertura de browser da Web Speech API e precisão de dígito isolado
em ambiente real — ver 5.2. Mitigação dupla: toque sempre disponível + gate de teste real
antes de declarar a fatia pronta.

### Fatia D — Ficha endodôntica / odontometria *(escopo novo, decidido 18/07)*

> **Origem:** o Mateus apontou (18/07) que a spec modelava endodontia como **um evento só**
> (a linha do canal, catálogo #8/#9) e faltava a **ficha endodôntica** — a odontometria dos
> canais, por dente. Decisão: entra no v3 como **Fatia D**, paralela ao Perio (Fatia C) —
> ambos são "fichas clínicas detalhadas" que o evento do odontograma resume.
>
> **A distinção que dirige o design (analogia do Mateus):** Perio = "alicerce/terreno" (osso,
> gengiva, ligamento — **boca inteira**, 6 pontos por dente). Endo = "encanamento" (polpa e
> canais **dentro de um dente** — um dente por vez). Tabelas e fluxos completamente distintos.

**Entrega:** tabela de odontometria por dente + persistência + linha vermelha nos canais
(o desenho já nasce na Fatia A como evento `endodontia`; a Fatia D adiciona o **detalhe**).

**Modelo de dados (espelha o do perio — 1.8):**
- `endo_tratamentos` (por dente/ficha): `paciente_id`, `dentista_id`, `ficha_id`, `dente`,
  `ponto_referencia`, `tecnica_obturacao`, `cimento`, `status`, `data`, `concluido_em`.
  RLS = núcleo clínico (099): clínica lê, autor escreve. Mesmo padrão de `perio_exames`.
- `endo_canais` (linhas): `tratamento_id`, `canal` (nome: MV/DV/Palatino/…),
  `comprimento_raiz_mm` (**decisão do Mateus 18/07:** UMA medida só — substitui o par
  CAD/CRD da proposta original), `ct_mm` (trabalho), `lima_final`.
  `ct` NÃO é derivado no banco (é decisão clínica ≈ comprimento−1mm, mas o dentista define).
- **Visual do canal (decisão 18/07, feedback sobre o preview):** o canal NÃO é uma linha
  fina — é a silhueta do canal **desenhada por inteiro dentro da raiz** + a raiz tingida
  pelo estado: contorno vazio coral = a tratar · preenchido teal = tratado aqui · preenchido
  slate = pré-existente. Legibilidade para qualquer idade/tela — linha fina reprovada.

**Contratos (a detalhar pós-validação):** rotas CRUD `/api/endo/tratamentos*` no molde das
rotas perio (§3.3), sem LLM. Componente `EndoOdontometria` (painel por-dente, abre do
`ToothDetailPanel` via ação "Tratamento de canal"). Migração aditiva (próximo número livre).

**Invariantes herdadas:** #5 (RLS núcleo clínico), #6 (dark/tokens), #7 (TS estrito),
#13 (dado clínico não nasce de IA — a odontometria é digitada/medida, zero Gemini).

**✅ RESOLVIDO — validação de campo (retorno em 19/07):** o design das tabelas (Endo + Perio)
e o catálogo anatômico foram para os **dentistas do piloto** (preview em artifact, 2026-07-18)
e o retorno foi **positivo — "tava tudo correto"**. Efeito: as colunas da odontometria
(`comprimento_raiz_mm`, `ct_mm`, `lima_final`) **congelam como especificado**, a **Fatia D está
destravada** e a **UI da Fatia A é final**.
**⚠️ Ressalva:** foi validação de **preview estático**, não de uso sob pressão de tempo — ela
congela o **modelo de dados** (o caro de reverter depois que há dado gravado), mas **não** valida
o fluxo. O fluxo continua pendente de dogfood real, e endodontistas variam na ficha.
**Dependências:** Fatia A (evento + `ToothDetailPanel`).

---

## Parte 9 — Pipeline de design

Esta spec define **semântica** (catálogo de símbolos, âncora, cores por token, interação
de 2 camadas) — não define pixel, espaçamento ou estilo exato. Antes de qualquer
componente novo das Fatias A e C, roda `design-brief` (produz `DESIGN.md`) cobrindo
especificamente: o `ToothDetailPanel` (5 zonas + raiz), a lista agrupada por dente/região
da confirmação remodelada, e a grade perio (`PerioGrade`/`PerioReview`). Critério de
aceite do brief: o dentista "bate o olho e entende" sem treinamento — organização acima de
densidade, mesmo padrão já usado no resto do produto. Depois do brief, implementação segue
`tailwind-shadcn` + `design-system-tokens` (telas de produto, não de marca). Auditoria
(`design-review` + `design-polish`) roda antes do commit/merge de cada fatia, como em
qualquer outra feature — não é um passo extra desta spec, é o gate padrão do projeto.

---

## Parte 10 — Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Motor A erra âncora em multi-dente (ponte) ou multi-face (MOD) | média | Eval dedicado (Parte 7) + revisão sempre visível/editável antes de salvar (invariante #1) — erro de IA nunca vira dado silencioso |
| Latência do ditado perio (Web Speech API) não sustenta o ritmo real de sondagem | média | Gate de teste real na Fatia C (não teórico) · fallback de toque é caminho garantido, não plano B envergonhado |
| Migração de fichas antigas sem odontograma | alta (é esperado) | **Decisão explícita: fichas antigas ficam como estão, sem backfill.** O componente degrada graciosamente — dente sem `odontograma_eventos` renderiza como hígido/sem-registro, nunca como erro |
| Cobertura de browser da Web Speech API (Safari/Firefox) | média-alta | Toque/teclado é o caminho principal garantido; voz é acelerador, não requisito — consultórios do Mateus já operam em Chrome desktop (assunção registrada) |
| `--color-slate` novo token confundir com `--color-teal` em telas pequenas/baixo contraste | baixa | Reforço não-só-cor no catálogo (textura pontilhada pra pré-existente, item 2.2 #4) — acessibilidade não depende só de matiz |
| Query de acumulado (Fatia B) degradar em paciente com histórico muito longo | baixa | Índice dedicado (1.7) + reduce por query é suficiente no volume real; materializar é válvula de escape já registrada, não pré-otimização |
| `origem:'preexistente'` forçado por toggle (não por item) classificar errado um procedimento feito na mesma sessão do exame inicial | baixa-média | Orientação de UX explícita (narrar em 2 passadas, cenário b) — troca-se confiabilidade de um switch binário por uma inferência de LLM por-item, que erraria mais |
| Ordem real dos 6 sítios de sondagem divergir da convenção assumida | média | Constante nomeada (`SEQUENCIA_SITIOS_PADRAO`), 1 linha pra corrigir após a visita à clínica piloto — não está espalhada pelo código |

---

## Fontes — validação de 16/07 (pesquisa)

| Fonte | O que sustenta |
|---|---|
| [Manual do Prontuário do Paciente em Odontologia — CFO, 1ª ed., 2026](https://website.cfo.org.br/wp-content/uploads/2026/03/CFO_Manual_do_Prontuario_Ebook.pdf) | Odontograma anatômico (5 faces + coroa/raiz) como ideal · dois odontogramas Inicial/Final · evolução com data, executor, CRO e assinatura do paciente · "sem emendas ou rasuras" · FDI 2 dígitos · Lei 13.787/2018 + LGPD · guarda ≥20 anos (recomendada indeterminada) |
| [SDCEP — Full periodontal examination: periodontal parameters](https://www.periodontalcare.sdcep.org.uk/guidance/assessment/special-tests/full-periodontal-examination/what-should-be-recorded/periodontal-parameters/) | Sondagem em 6 sítios/dente · CAL = profundidade + recessão (a partir da JCE) · "sistemas informatizados calculam CAL automaticamente" · supuração como registro opcional |
| [Tonetti, Greenwell, Kornman — Staging and grading of periodontitis (J Periodontol, 2018)](https://aap.onlinelibrary.wiley.com/doi/full/10.1002/JPER.18-0006) · [guia Periospot](https://www.periospot.com/blog/the-2018-aapefp-periodontal-classification-a-clinicians-complete-guide-to-staging-and-grading) | Estadiamento I–IV dirigido por **CAL interdental** (1–2mm=I, 3–4=II, ≥5=III/IV) — a razão do ajuste de recessão por sítio (§1.6) |
| [Simples Dental — 23 áreas reconhecidas pelo CFO](https://www.simplesdental.com/blog/areas-da-odontologia/) | Contagem e lista das especialidades (base da seção "Cobertura por especialidade"); contagem varia com reconhecimentos recentes |

**Nota de confiança:** convenção de cores de odontograma (vermelho=a fazer / azul=feito)
**não é normatizada pelo CFO** (ausente do manual — verificado) — coral/teal/slate é escolha
livre de produto; o slate (pré-existente) tem apoio indireto no interesse pericial do manual
em distinguir o trabalho de cada profissional. A ordem exata dos 6 sítios na sondagem segue
como assunção a validar em campo (constante nomeada).
