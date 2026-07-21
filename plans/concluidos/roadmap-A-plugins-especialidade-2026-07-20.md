> # ⚠️ ARQUIVADO 21/07/2026 — NÃO USE COMO REFERÊNCIA
> O conteúdo vivo foi **absorvido** pelo
> [`roadmap-mestre-2026-07-21.md`](../roadmap/roadmap-mestre-2026-07-21.md).
> A0 fechou e foi pro ar; A1 saiu **pela metade** (tabela de endo e campos de implante existem,
> o extractor de voz não); A2 (perio) e A3 (catálogo) continuam vivos **lá**.
>
> **O que aqui está desatualizado:** "push no fim do roadmap" — o push aconteceu em
> **21/07 (`65cf9cc`)**. Guardado como histórico do contrato de plugins (a spec A0 segue
> válida e ativa em `plans/specs/`).

# Roadmap A — Ficha por plugins de especialidade

> **Status:** ✅ **APROVADO 20/07 (Mateus)** — com as decisões: D1–D3 da spec A0 ratificadas · **push só no FIM do Roadmap A** (gate completo, lote único) · design ancorado no artefato-base (aprovado pelos dentistas) · **Criado** 2026-07-20
> **Interrompe:** [`roadmap-3.1-2026-07-14.md`](roadmap-3.1-2026-07-14.md) (#3 odontograma / #4b Ficha v2). O carro-chefe retoma **depois do A**.
> **Base canônica:** [`odontograma-v3-preview-dentistas-artefato.html`](../specs/odontograma-v3-preview-dentistas-artefato.html) (aprovado pelos dentistas do piloto, 19/07) · §3–10 = as 8 especialidades · §11 = card de registro/fiscalização · §12 = casos por fala · §13 = o que fica em texto de propósito.
> **Contrato da fundação:** [`spec-a0-fundacao-plugins-especialidade.md`](../specs/spec-a0-fundacao-plugins-especialidade.md) — a A0 é fonte da verdade; A1–A3 preenchem o contrato dela.
>
> **Este arquivo é MAPA.** O detalhe da A0 mora na spec. Fatia que ganhar spec própria (A1/A2) tira o detalhe daqui e vira link — roadmap é mapa, spec é conteúdo.

---

## Modelo de execução por fatia

| Fatia | Execução (Claude Code) | Quando subir pra Opus 4.8 | IA em runtime (produto) |
|---|---|---|---|
| **A0** — fundação + reorg da ficha | **Sonnet** | Só se o refactor das 3 camadas dentro do `FichasTab` (arquivo grande, ~1300 linhas, em produção) começar a regredir — mesmo risco que fez a spec v3 reservar Opus pro `consulta-client`. O contrato do plugin está congelado na spec A0; portar é implementar, não julgar | Nenhuma nova — o pass 1 (`formatar-evolucao`, Gemini 2.5 Flash) só ganha a instrução de `grupo_id` |
| **A1** — Endo | **Sonnet** na fiação (entrada no registry, rota de extração, form, card, render) | **Opus 4.8 no prompt+glossário do extractor de endo**: decimais e limas no Whisper ("#35"/"K35"/"lima trinta e cinco") são falha de transcrição genuinamente ambígua — desenhar o glossário e as regras anti-inferência é julgamento, não contrato congelado | Pass 2: Gemini 2.5 Flash com schema pequeno forçado (odontometria) + Whisper large-v3 (ditado) — modelos já em produção |
| **A2** — Perio | **Sonnet** (periograma + motor determinístico já congelados em DESIGN §5 e spec v3 §1.6) | Só se a máquina de auto-avanço do cursor / parser do ditado entrar em loop de edge case (dente ausente, "volta", grade parcial) — mesmo gatilho da Fatia C original | Web Speech API (Chrome, **não-LLM**) — invariante: zero LLM no caminho dos números |
| **A3** — catálogo restante | **Sonnet** | Não deve precisar — ponte (render do bracket), esfoliação, casos §12: tudo especificado no artefato + spec v3 | Enum do pass 1 ganha `ponte`/`esfoliacao`; sem modelo novo |

Regra da casa: começa em Sonnet; "quando subir" são gatilhos definidos, não licença pra trocar por impaciência. Troca de modelo em execução vira linha no handoff.

---

## Visão

A ficha clínica estruturada é o ativo central do produto. Hoje a camada rica do odontograma v3 (event-log por dente/face) vive no **Modo Consulta**; a ficha do prontuário (`FichasTab`) só tem odontograma básico + lista de procedimentos. O Modo Consulta está convergindo pra cima da ficha ("fase única") — o que se constrói na ficha serve os dois.

Este roadmap transforma a ficha para suportar **8 especialidades como plugins** — nem mais, nem menos: Dentística/Clínico Geral, Endodontia, Cirurgia oral, Implantodontia, Prótese fixa, Periodontia, Odontopediatria, Ortodontia. Cada especialidade é um **contrato de 5 peças** que se pluga num core que não muda. Especialidade nova = preencher as 5 peças; zero mudança no núcleo.

**Resultado esperado:** o dentista narra como sempre fez, a boca se pinta sozinha, e cada especialidade ganha sua ficha própria (odontometria de endo, periograma, chips de orto) sem inchar o core nem forçar o que é texto a virar desenho.

## As 3 camadas da ficha (o que a A0 monta)

1. **Odontograma como guia/índice** — a arcada (`Odontograma.tsx`); clicar num dente abre o painel (`ToothDetailPanel`, readOnly na ficha salva, edição no manual). **Reusa** o painel existente, não forka.
2. **Cards de registro colapsados** (§11 do artefato) — "Restauração MOD · dente 36 · Realizado", data clínica, retroativo, CRO, assinatura. Genérico, um por registro/grupo. Multi-dente do mesmo procedimento colapsa num card ("Exodontia · dentes 31–41") via `grupo_id`.
3. **Plugins de especialidade** — cada especialidade detectada renderiza seu card rico (peça 4). **Plugin só renderiza quando tem dado** — profilaxia não mostra tabela de endo vazia.

## Arquitetura (decidida — este roadmap contratualiza, não re-litiga)

- **Registry de plugins** — cada plugin = 5 peças: (1) dados (tipo TS + Zod + persistência), (2) extractor (IA pequena OU motor determinístico OU nenhum), (3) form manual, (4) card readOnly colapsado (§11), (5) selo/render no odontograma. Detalhe do contrato: spec A0.
- **Extração em 2 passos** — o organizador atual (`formatar-evolucao`, Gemini com schema forçado) fica quase intocado; das saídas dele deriva-se **quais especialidades o relato contém**; extractors pequenos rodam em paralelo (`Promise.all`) só pras detectadas.
- **Voz na endo: APROVADA** (mudança consciente vs. o artefato §4, que dizia "é medida, não narrativa"). Inegociável: campo não ditado = null, nunca inferido; tabela extraída passa por tela de revisão antes de salvar; MVP = preenche o que captou, dentista edita rápido.
- **Perio SEM LLM** — número de sondagem nunca passa por LLM; ditado determinístico (Web Speech / teclado). O registry acomoda: a peça 2 do perio é motor determinístico.

---

## Fatias

### A0 — Fundação + reorganização da ficha `Risco: MÉDIO`

**Escopo (o que entrega):**
- O **contrato do plugin** (interface TS das 5 peças) + o **registry** + a função de **detecção de especialidades** (derivada dos eventos do pass 1).
- O **pipeline 2-pass** contratualizado: contrato de request/response dos extractors + a rota de despacho (sem nenhum extractor de IA ainda — A1/A2 os preenchem).
- A **ficha em 3 camadas** montada no `FichasTab` (odontograma-índice reusando `ToothDetailPanel` + cards §11 + slot de plugins).
- **`grupo_id` vivo**: instrução no prompt do pass 1 + card agrupado. Hoje o schema+banco+resolução de UUID existem, mas o prompt nunca instrui o modelo a emitir — agrupamento multi-dente está morto. A0 acende.
- **Orto como 1º plugin** — o `orto_manutencao` já é extraído pelo pass 1; A0 registra o plugin orto (card de chips + form manual) **e fecha o furo de persistência** (ver Riscos: hoje o dado é exibido no draft da consulta e perdido no save). Valida card+form **sem IA nova**.

**Dependências:** nenhuma fatia anterior. Depende do event-log v3 (Fatia A, já em produção-código) e do `ToothDetailPanel` (existe).

**Migrations (gate — dev=prod, exigem confirmação do Mateus):**
- **Persistência do orto** (próximo número disponível, hoje 105) — fecha o furo. Recomendação de forma na spec A0.
- **NÃO** inclui o `detalhe jsonb` do evento — esse desce com a A1 (endo é o 1º consumidor). A0 declara o contrato de persistência; A1 aplica a coluna.

**Progresso:**
- ✅ **Fase 1 FEITA 20/07** (contrato + registry + detecção) — `src/lib/especialidades/{plugin,orto,registry}.ts`; typecheck+lint limpos; detecção 5/5 casos + unicidade (12 tipos, 0 dup). Desvios da spec (atualizados nela): `PluginRender.camadas` array; helper existencial `registrar()` (TDetalhe invariante).
- ✅ **Fase 5 (esqueleto do 2-pass) FEITA 20/07** — `src/app/api/dex/extrair-especialidade/route.ts` (despacho via registry, devolve `sem-extractor`) + `pluginPorId` no registry. typecheck+lint limpos; smoke test runtime: 401 sem auth, 405 no GET (prova que a cadeia de imports carrega sem estourar o assert). Falta o passo 2 (ponto de chamada `Promise.all` no client) — vai junto com a Fase 4 (toca o fluxo de organizar).
- ⏳ **Fase 2a (grupo_id no prompt)** — mudança pronta na spec §2.4; **gate = eval `run-formatar-evolucao.mjs`** que exige build de prod + Playwright autenticado (não roda no dev). Fazer em passada focada, sem dev server ativo.
- ✅ **Fase 2b (card §11) — componente FEITO 20/07** — `src/components/fichas/registro-card.tsx` (`RegistroCard`: título tipo+âncora, pill por `corDoRegistro`, retroativo, autor+CRO, assinatura, variante agrupada, corpo colapsável). typecheck+lint limpos. **Visual pendente** (montagem = Fase 4).
- ✅ **Fase 3 (orto) FEITA 20/07** — componentes `orto-card.tsx`+`orto-form.tsx` ligados no `ortoPlugin`; **migration 105 APLICADA em prod e verificada** (coluna `fichas.orto_manutencao jsonb` nullable, via MCP apply_migration — Mateus OK explícito); boundary server/client OK (rota 401 não 500).
- 🟢 **Fase 4 — camadas 2+3 FEITAS 20/07:**
  - **Camada 3 orto:** persistência end-to-end no `FichasTab` (tipo/captura/save/load/render `OrtoCard` guardado por presença I2).
  - **Camada 2 (§11 cards):** ficha rápida **passa a salvar `odontograma_eventos`** (decisão do Mateus) — captura no organize → persiste no save via `regravarEventosOdontograma` (RPC atômica da consulta, fail-soft) → busca eventos por ficha em `fetchFichas` → renderiza `RegistroCard` agrupado por `grupo_id`. Fonte híbrida: fichas v2 antigas (0 eventos) seguem no display legado.
  - **Verificação:** typecheck+lint limpos (1 erro lint pré-existente em AssinaturaRecepcaoModal, não meu) · **mount ao vivo** (ficha renderiza, busca de eventos sem erro de console/RLS) · agrupamento 7/7 (teste-espelho) · fichas sem evento → display legado, sem §11.
  - **NÃO verificado (= teste do Mateus):** §11 cards + OrtoCard renderizando COM dado, e o round-trip organize→save→eventos gravados. **Há 0 eventos no banco** → o end-test será a 1ª escrita real de eventos pela ficha rápida.
  - **Camada 1 (revisão) FEITA 20/07** (Mateus aprovou opção A — aditiva): quando o Dex organiza (`eventosDraft` > 0), o form mostra `<Odontograma eventos=…>` (boca pintada) + `<ToothDetailPanel>` editável (estado `denteAberto`, `dataPadrao = data_atendimento`) pra revisar/corrigir antes de salvar. typecheck+lint limpos; **form monta ao vivo, sem erro de console; bloco de revisão só aparece com eventos** (verificado). Polish flagado: 2 odontogramas no form (o seletor v2 + o de eventos) — resolve no design-review.
  - **✅ A0 CODE-COMPLETE (3 camadas):** fundação de plugins + pipeline 2-pass + ficha em 3 camadas (índice/revisão · §11 cards · orto). typecheck+lint 100% limpos em todo o A0.
  - **FALTA (pós-A0 ou polish):** (B) unificação total v2/v3 (substituir o seletor legado) · caminho 100% manual (dente→evento sem Dex) · `ToothDetailPanel` readOnly no display salvo · design-review final. **Eventos hoje vêm só do Dex organize.**
  - **NÃO verificado ao vivo (= teste do Mateus):** organize→salvar→§11 cards + OrtoCard + revisão renderizando com dado real (há 0 eventos no banco).
- ⏳ **Fase 4 (3 camadas no FichasTab)** — travada até o dogfood do Job A (voz/anexo).

**Gates de aceite:**
- [x] ✅ Registry compila com **orto registrado** como plugin; typecheck estrito, zero `any`.
- [ ] Ficha renderiza as 3 camadas; clicar num dente numa ficha **salva** abre o `ToothDetailPanel` em `readOnly`.
- [ ] Card §11 exibe data clínica + retroativo + CRO + estado de assinatura num registro `realizado`.
- [ ] Relato "extraí do 31 ao 41" → **1 card** "Exodontia · dentes 31–41" (grupo_id vivo). O harness já tem `grupo_consistente` — verde.
- [ ] Relato de manutenção de aparelho → **card de orto renderizado NA FICHA** (não só no draft) e **persistido** (sobrevive ao reload).
- [ ] Plugin vazio **não** renderiza (ficha de profilaxia sem card de endo).
- [ ] Eval do organizador continua verde após a instrução de `grupo_id` (rodar `run-formatar-evolucao.mjs`, sem regressão nos casos existentes).
- [ ] Dark mode + tokens + a11y herdados do `ToothDetailPanel` (sem cor hardcoded, faces navegáveis por teclado).

---

### A1 — Endodontia `Risco: MÉDIO`

**Escopo:** ficha endodôntica §4 completa — a tabela de odontometria (Canal · Ponto de referência · Comprimento da raiz · CT com sugestão raiz−1mm · Lima final; rodapé: técnica de obturação + cimento). Extractor por voz (pass 2, Gemini schema pequeno), glossário de endo no prompt de correção, retratamento (evento novo sobre realizado; canal na raiz já suportado no render). É o 1º plugin **com IA nova** — prova o padrão na variante que a A0 não exercitou.

**Dependências:** A0 (contrato do plugin + pipeline 2-pass). Aplica o **`detalhe jsonb`** no `odontograma_eventos` (migration, gate).

**Gates de aceite:**
- [ ] Relato de endo com odontometria ditada → tabela §4 preenchida **só nos campos ditados**; campo não dito = vazio, nunca inferido (comprimento não dito ≠ raiz−1).
- [ ] Tela de revisão obrigatória antes de salvar; salvar grava o `detalhe` no evento `endodontia` (append-only, congela na assinatura).
- [ ] **Dogfood com ditado REAL do Mateus** (áudio de consulta, com decimais e limas "#35"/"lima trinta e cinco") — a casa se queimou com "codado ≠ verificado"; endo não conta como feita sem o Mateus ditar ao vivo e conferir a tabela.
- [ ] Eval do extractor de endo (casos JSON no padrão da casa, `plans/specs/eval/`) — glossário reduz erro de decimal/lima a nível aceitável, medido, não afirmado.
- [ ] Plugin de endo só renderiza quando há evento `endodontia` com `detalhe`.

**Depois de A0 + A1 o padrão está provado nas duas variantes** (plugin sem IA = orto; plugin com IA = endo). O registry, o pipeline 2-pass e a ficha 3-camadas são a fundação que A2/A3 só preenchem.

---

### A2 — Periodontia `Risco: ALTO`

**Escopo:** periograma §8 — PS, MG, NIC (=PS+MG, **calculado, nunca digitado**), BOP/supuração/placa, mobilidade, furca, selo âmbar (bolsa ≥4mm), dente ausente colapsa. Motor **determinístico** (Web Speech / teclado, zero LLM nos números) como peça 2 do plugin. Série temporal comparável entre exames → **tabela satélite** (`perio_exames`/`perio_medidas`, já especcadas na spec v3 §1.8), não JSONB no evento.

**Dependências:** A0 (contrato — a peça 2 "motor determinístico" tem que existir no registry). Herda a spec v3 (Fatia C) e o DESIGN §5. É a maior e a única com premissa não validada (voz com ruído em campo).

**Gates de aceite:**
- [ ] Nenhum número de sondagem passa por LLM (invariante herdado da Fatia C).
- [ ] NIC derivado na leitura, nunca persistido; recessão por sítio.
- [ ] Selo âmbar nasce sozinho do exame concluído; dente ausente colapsa a coluna.
- [ ] Revisão obrigatória antes de concluir (gate client + servidor).
- [ ] Dogfood com ditado real (a premissa "Web Speech aceitável pra dígitos em PT-BR" nunca foi validada em campo).

> A2 ganha **spec própria** quando entrar em execução (herda muito da spec v3 §1.6/§1.8 + DESIGN §5). Ao escrevê-la, tirar o detalhe daqui e deixar só o link.

> ### ⚠️ ALERTA — o periograma é a maior peça e vai exigir uma passada dedicada
> _Registrado 21/07/2026 a pedido do Mateus, ao fechar a migration 106._
>
> A clínica-piloto tem **5 especialidades e ~1 paciente/hora por dentista**, e a periodontia
> entrou na lista de "preciso que apareça". A migration 106 destravou endo e implante no mesmo
> dia; **o perio não segue junto, e é deliberado** — não é dívida esquecida, é escopo que não
> cabe numa tarde:
>
> - **Volume de UI:** 6 sítios × 32 dentes = 192 células, com avanço de cursor, dente ausente
>   colapsando a coluna, mobilidade e furca por dente.
> - **Duas vias de entrada** (teclado + Web Speech determinístico) e a premissa de voz
>   **nunca validada em campo** — é o único risco ALTO de todo o Roadmap A.
> - **Não é JSONB.** O `detalhe` da 106 serve endo e implante; perio precisa de série temporal
>   comparável entre exames → tabelas satélite `perio_exames`/`perio_medidas` (decisão desta
>   seção, mantida). O evento `tipo='exame_periodontal'` / `nivel='boca'` (habilitado pela 106)
>   é só a **âncora** que faz o card aparecer na ficha; as medidas moram fora.
> - **NIC calculado, nunca persistido** — e é ele que dirige o estadiamento AAP/EFP 2018.
>
> **Consequência prática:** ao entregar pros 5 dentistas, perio aparece como procedimento na
> ficha (card + data + autor), mas **sem tabela de medidas**. Isso precisa ser dito a eles —
> senão vira "está quebrado" no feedback. A passada dedicada do periograma vem depois do
> primeiro ciclo de feedback, com spec própria.

---

### A3 — Catálogo restante `Risco: BAIXO`

**Escopo:** o que o artefato marcou como "2ª entrega" e os complementos — ponte (§7, `grupo_id` + papel pilar/pôntico + render do bracket), esfoliado/odontopediatria (§9, evento `esfoliacao` + seta pro sucessor), casos canônicos §12 (mapeamentos por observação que não ganham símbolo). Enum do pass 1 ganha `ponte`/`esfoliacao`.

**Dependências:** A0 (registry + card agrupado). Ponte reusa o `grupo_id` vivo da A0, agora com `papel_no_grupo`.

**Gates de aceite:**
- [ ] "ponte do 13 ao 15, pilares no 13 e 15" → 1 grupo, render de bracket, card agrupado com papéis.
- [ ] "o 74 já caiu" → esfoliação + deep-link pro permanente sucessor.
- [ ] Casos §12 (amálgama/resina, infiltração=substituição, siso Winter, implante marca/medida, pulpotomia, coroa de aço, faceta) caem no evento canônico + observação — eval verde.

**Push/deploy: no FIM deste roadmap** (decisão Mateus 20/07) — gate completo (eval → dogfood → auditoria → push) com o lote inteiro. Depois do A, o roadmap 3.1 retoma (Fatia B restante: acumulado §3.4 + vínculo com orçamento — e o Job B/cockpit, que consome os plugins prontos; se o Job B entra antes ou depois da A2, decide-se ao fechar a A1 — recomendação registrada: antes, porque o cockpit é a moldura da consulta e destrava valor com A0+A1 apenas).

---

## O que explicitamente NÃO entra (§13 do artefato — não tentar cobrir)

Segue em texto na evolução, com a mesma IA organizando — **forçar viraria poluição**:
- **Prótese removível (PPR/total)** — registro por arcada, não por dente.
- **Lesões de mucosa / estomatologia** — tecido mole, fora do odontograma.
- **DTM e dor orofacial** — articulação e músculo, em texto.
- **HOF** (botox, preenchimento) — região de face.
- **Enxerto ósseo / levantamento de seio** — região, com tomografia anexa.
- **Mantenedor de espaço** — aparelho, não estado do dente.
- **Sutura e pós-operatório** — acompanhamento passageiro; o event-log guarda o durável.
- **Desgaste de bruxismo** — achado em texto.
- **Tártaro e flúor** — procedimento da consulta; o índice de placa vive no periograma.
- **Documentação ortodôntica inicial** (Angle, apinhamento, giroversão, fotos, cefalometria) — spec própria futura; A cobre só a **manutenção mensal** da orto.

E o não-escopo estrutural do próprio A:
- **Materializar o "estado atual" do odontograma** — segue reduce por query (`DISTINCT ON`), não tabela de cache (decisão da spec v3 §1.4).
- **Backfill de fichas antigas** — nenhuma migração retroativa gera eventos a partir de texto histórico.
- **9ª especialidade / "todas as 23 do CFO"** — o A cobre exatamente as 8 dente-ancoradas do artefato. Especialidade nova é um plugin novo (5 peças), não um item deste roadmap.

---

## Próxima fase da ficha (UI) — depois do 1º teste com os 5 dentistas

> _Registrado 21/07/2026._ Design de referência: [`ficha-dois-modos-2026-07-21-artefato.html`](../specs/ficha-dois-modos-2026-07-21-artefato.html).
> **Nada nesta seção está codado** — é desenho aprovado em discussão, não implementação. O que
> sobe hoje (21/07) é o layout de coluna única existente (ficha-definitiva) + os plugins de
> endo/implante (migration 106). O que segue é o que ficou de fora **de propósito**, decidido
> em discussão com o Mateus pra não estrear feature não-testada no mesmo dia que os 5
> dentistas usam o app pela primeira vez.

- **Split de tela** (odontograma à esquerda + registros/perfil do dente à direita, em vez de
  empilhado). Largura alvo ainda não definida pelo Mateus (depende de em que tela os 5
  dentistas efetivamente trabalham — notebook vs. monitor).
- **Odontograma do paciente** — hoje a ficha só desenha os eventos DESTA ficha; a mudança é
  desenhar a boca inteira (histórico apagado + o de hoje com traço). Exige nova query (por
  paciente, não por ficha) e resolve o risco de tocar um dente do histórico criar evento por
  engano.
- **Revisão por exceção** — o item de **maior risco** de toda a próxima fase. Depende do item
  anterior (compara o relato contra o histórico do paciente pra detectar contradição, ex:
  "already tem canal no 26"). É lógica de detecção nova, zero linha escrita, e só pode ir pra
  produção depois de testada contra boca real — falso positivo repetido queima a confiança do
  dentista mais rápido do que a feature ajuda.
- **Dois alvos no card** — número do dente abre o perfil do dente; título/chevron abre o
  detalhe do procedimento. Hoje o card tem um alvo só (o card inteiro expande/colapsa).
- **Perfil da região** — profilaxia/raspagem/clareamento/flúor sem dente âncora. A migration
  106 já habilita `tipo`/`nivel='boca'`; falta toda a UI (chips de região abrindo um painel,
  hoje eles só selecionam pro modelo v2 legado).
- **Encaminhamento a outro dentista** (artefato original §06) — a coluna
  `odontograma_eventos.encaminhado_para` já existe (grátis na 106); falta **tudo**: UI de
  seleção de planejados + colega + observação, action de servidor, notificação cruzada entre
  dentistas, banner/badge de quem recebe. Risco alto numa clínica de 5 dentistas que dividem
  paciente — um furo aqui vaza prontuário pro dentista errado. Não entra sem teste dedicado de
  RLS com duas contas.
- **Assinatura por procedimento** (várias de uma vez, com data própria) — já escopada como
  migration 107 em [`spec-106-detalhe-especialidade.md`](../specs/spec-106-detalhe-especialidade.md)
  §2. Exige mudar a invariante #14 (hoje assinar congela a ficha inteira); fica pra depois do
  1º ciclo de feedback dos 5.

---

## Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| **"Orto de graça" era otimista** — `orto_manutencao` é extraído e exibido no draft da consulta, mas **não é persistido** (não está no insert de `salvarFichaConsulta`, sem coluna). Renderizar na ficha salva exige fechar isso primeiro | **alta** (confirmado no código) | A0 fecha o furo com persistência dedicada (gate de migration). Orto continua provando card+form sem IA nova — só não era "0 esforço" |
| Refactor das 3 camadas dentro do `FichasTab` (~1300 linhas, em produção) regride o form que acabou de mudar (Job A adicionou data/procedimentos/conduta) | média | A0 monta as camadas como composição aditiva, não reescrita; gate de dogfood do Job A **antes** da A0 tocar o arquivo; Opus se regredir |
| Whisper erra decimais/limas na endo ("#35" vs "K35" vs "lima 35") | alta | Glossário de endo no prompt de correção + eval com ditado real; regra dura: campo não dito = null; revisão obrigatória antes de salvar |
| Web Speech impreciso pra dígitos em PT-BR sob pressão de tempo (perio) | média | Premissa nomeada, não validada; A2 tem gate de dogfood com ditado real antes de virar caminho único; teclado é fallback de 1ª classe |
| `grupo_id` vivo regride os casos existentes do eval do organizador | baixa | Gate: rodar `run-formatar-evolucao.mjs` e exigir zero regressão antes de fechar a A0 |
| Migration em dev=prod aplicada sem querer | média | Toda migration marcada como **gate** — confirmação explícita do Mateus antes de aplicar |
| Deriva de dado entre draft da consulta e ficha (dois lugares mostram/salvam odontograma+orto) | média | A A0 unifica o caminho de render (mesmo registry + mesmas 3 camadas nos dois); o "fase única" que já converge o Modo Consulta pra cima da ficha reforça isso |
