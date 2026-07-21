# Roadmap Mestre — Odonto.IA

**Atualizado:** 21/07/2026, após o push `65cf9cc`
**Substitui:** `roadmap-3-fases`, `roadmap-3.1` e `roadmap-A` — os três foram pra `plans/concluidos/` com aviso no topo.

---

## Como ler este arquivo

Este é o **único mapa**. Ele diz **o que está no ar, o que vem, e em que ordem** — nada mais.
O detalhe técnico mora nas specs em `plans/specs/`; quando há spec, aqui é só um link.

| Símbolo | Significa |
|---|---|
| ✅ | no ar em produção **e** verificado |
| 🟡 | codado e no ar, **mas ninguém testou com dado real** |
| 🔴 | não existe ainda |
| ⚠️ | tem armadilha — leia antes de mexer |

> **A regra que mais custou caro nesta casa:** _código escrito ≠ código verificado_.
> Typecheck, lint e build **não pegam** nada do que já quebrou aqui. Se está 🟡, trate como não-feito.

---

# 0. A SEMANA — o que fazer, em ordem

> **Prioridade definida pelo Mateus em 21/07:** primeiro **tudo que é funcionalidade do
> dentista** (ficha, odontograma, cockpit), depois **financeiro**, depois o resto.
> Meta declarada: _"matar tudo relacionado ao dentista esta semana"_.

### Bloco 1 — Hoje, enquanto os 5 testam

| | O quê | Custo | Por quê agora |
|---|---|---|---|
| **1** | **Verificar compartilhamento com 2 contas logadas** | 10 min | É o único que falha **em público**. A RLS está no ar desde 18/07 e nunca foi testada por login. Numa clínica de 5 que divide paciente, um furo aqui todos descobrem juntos |
| **2** | **Aviso de perda de dado** (§3.1) | baixo | Cada consulta ditada hoje que perde odontometria é um prontuário que **nunca mais** vai ter aquilo. Perda silenciosa é o pior modo de falha em registro clínico |

### Bloco 2 — Os consertos da ficha (o que já existe e está errado)

| | O quê | Custo | Nota |
|---|---|---|---|
| **3** | **`queixa_principal`** (§3.2) | baixo | Campo com peso legal (CFO); hoje o prompt pede a coisa errada |
| **4** | **Schema de endo** (§3.3) | baixo | ⚠️ **Antes** do extractor — senão ele nasce mirando um schema errado |
| **5** | **Vocabulário do prompt** (§3.8) | baixo | Destrava os 5 tipos que a 106 liberou e que hoje são inalcançáveis |
| **6** | **Ponte + esfoliação** (§3.10) | baixo-médio | Destrava 2 das 8 especialidades (prótese e odontopediatria) |

### Bloco 3 — Encher as tabelas pela voz

| | O quê | Custo | Nota |
|---|---|---|---|
| **7** | **Extractor de endo** (§3.4) | médio | A tabela existe desde ontem; falta a fala chegar nela. É a peça que o teste da anamnese provou faltar |
| **8** | **Extractor de implante** (§3.5) | médio | Mesmo padrão, menor |
| **9** | **`grupo_id` no prompt** (§3.9) | médio | ⚠️ Gate = rodar o eval, que exige **build de prod + Playwright**. Fazer em passada focada, sem dev server |

### Bloco 4 — A ficha que falta construir

| | O quê | Custo | Nota |
|---|---|---|---|
| **10** | **Densidade da tela de confirmação** (§3.6) | médio | Hoje os mesmos procedimentos aparecem em **5 formas** na mesma tela |
| **11** | **Encaminhar a outro dentista** (§4) | médio | Coluna já existe (106). ⚠️ Exige teste de RLS com 2 contas — um furo vaza prontuário |
| **12** | **Perfil da região** (§4) | médio | Depende do item 5 (vocabulário); sem ele não há onde salvar |

---

> ## ⚠️ O que NÃO cabe nesta semana — e por quê
>
> Isto não é pessimismo, é aritmética. Se a meta for literalmente "tudo do dentista",
> a semana estoura e o que sai fica pela metade. **Estes três são frentes próprias:**
>
> | Frente | Por que não cabe |
> |---|---|
> | **Periograma** (§5) | 192 células + motor de voz determinístico + **tabelas satélite novas**. É a maior peça do projeto inteiro e a única com premissa nunca validada em campo |
> | **Cockpit / Job B** (§6) | A própria spec manda **reabrir → congelar a §8 → rodar design-brief** antes de escrever código. E ele **consome** os plugins — faz sentido vir depois dos extractors (blocos 3) |
> | **Próxima fase da ficha** (§4: odontograma do paciente + revisão por exceção + split) | A revisão por exceção depende do odontograma do paciente, e **não pode subir sem teste contra boca real** — falso positivo repetido queima a confiança dos 5 em uma semana |
>
> **Minha recomendação:** blocos 1–3 são a semana realista. O bloco 4 entra se sobrar tempo.
> Periograma e cockpit começam **depois** do primeiro ciclo de feedback dos 5 — que é
> justamente quando você vai saber se o que construímos acerta o alvo.

---

# 1. Onde estamos — 21/07

**Tudo foi para produção hoje.** O lote que ficou represado desde 20/07 subiu num commit só
(`65cf9cc`, 54 arquivos): odontograma v3, ficha redesenhada, plugins de especialidade e as
migrations 100→106. Working tree limpo, exceto os ajustes de agenda de hoje (ver §6).

**O que muda no seu dia:** a clínica-piloto (5 dentistas, ~1 paciente/hora, 5 especialidades)
começa a usar hoje. O foco desta semana deixa de ser "construir" e passa a ser
**corrigir o que o uso real revelar**.

---

# 2. No ar — não re-trabalhar

| Frente | Estado | Onde |
|---|---|---|
| **Núcleo clínico compartilhado** (clínica lê, autor escreve) | ✅ migration 099, gate comportamental PASS 18/07 | [spec](../specs/2026-07-16-hierarquia-3.1-nucleo-clinico-spec.md) |
| **Odontograma v3** — event-log, boca pintada, 3 cores, fiscalização | ✅ migrations 101+104, dogfood E2E PASS 19/07 | [spec](../specs/spec-modo-consulta-v3-odontograma.md) |
| **Data do atendimento** (retroativa) | ✅ migration 100, 40/40 fichas coerentes | — |
| **Ficha rápida / campo mágico** (voz, anexo, "Organizar com Dex") | 🟡 no ar, dogfood ao vivo nunca feito | [spec](../specs/2026-07-16-job-a-ficha-rapida-spec.md) |
| **Ficha redesenhada** (organismo único, cards §11, merge de faces) | 🟡 no ar, ver §4 | [artefato](../specs/ficha-definitiva-2026-07-21-artefato.html) |
| **Plugin de orto** (manutenção mensal) | 🟡 migration 105 | [spec A0](../specs/spec-a0-fundacao-plugins-especialidade.md) |
| **Plugin de endo + implante** (tabelas) | 🟡 migration 106, **entrada só manual** | [spec 106](../specs/spec-106-detalhe-especialidade.md) |
| **Compartilhamento de ficha entre dentistas** | ⚠️ **RLS no ar desde 18/07, NUNCA testado com 2 contas logadas** | — |

> ### ⚠️ A verificação mais urgente, e leva 10 minutos
> Dentista A cria uma ficha → dentista B abre o mesmo paciente → **B consegue ler? B é barrado
> ao editar?** Numa clínica de 5 que divide paciente, se isso tiver furo os 5 descobrem juntos.
> Nunca foi testado por login — só por script.

> ### ⚠️ Não confie na tabela de controle de migrations
> `supabase_migrations.schema_migrations` em prod **tem buracos**: ela registra 087, 089–096 e
> 104–106, mas **não** as 097, 098, 099, 100, 101 e 103 — que **estão aplicadas** (verificado
> objeto por objeto em 21/07: coluna de parcelas, helper `belongs_to_active_clinic`,
> `fichas.data_atendimento`, tabela `odontograma_eventos`, policy `notificacoes_select`).
>
> Causa provável: só as aplicadas via MCP entram no registro; as feitas pelo editor SQL do
> dashboard não. **Para saber se algo está no ar, cheque o objeto no schema — nunca essa tabela.**

---

# 3. ⚠️ Achados do teste real (21/07) — a lista de correção

Teste com anamnese completa (Carlos Eduardo Silva) no **Modo Consulta**. Diagnóstico completo:
o relato tinha ~55 dados clínicos; o sistema guardou ~8 de forma estruturada. **O resto sumiu
sem avisar** — e perda silenciosa em prontuário é o pior modo de falha, porque ninguém percebe
até uma auditoria.

| Bloco ditado | Guardado | Causa |
|---|---|---|
| **Odontometria** — 3 canais × ref/aparente/real/trabalho/lima + obturação + cimento (~18 valores) | **zero** — só "Canal · Feito" | `endo.ts` tem `extractor: null`; o pass 1 não emite odontometria |
| **Periograma** — 6 sítios × PS/MG/placa/sangramento (24 valores) | **zero** — virou aviso "citado sem registro" | perio não existe; **e por decisão de projeto nunca virá por LLM** |
| **Implante** — marca, linha, 4.0×10, **torque 45N** | 4 como texto livre; torque perdido; estruturado zero | `implante.ts` tem `extractor: null` |
| **Enxerto** — 0,5g osso liofilizado | rótulo genérico; quantidade perdida | sem campo |
| **Orto** — Classe II Angle, apinhamento, diastema, arco NiTi 014, bypass no 36 | 1 rótulo, **duplicado** em sup + inf | plugin cobre só manutenção mensal; instalação/diagnóstico é fora de escopo |
| **Queixa principal** — "quer aparelho para alinhar os dentes" | virou lista de procedimentos | o prompt pede "título do procedimento principal" (linha 257) — o modelo obedeceu |

### Os itens de correção — referência

_A **ordem de execução** está na §0. Aqui é só o catálogo do que cada item é.
Os itens 3.1–3.7 vieram do teste da anamnese; 3.8–3.10 são achados da varredura de código
do mesmo dia — **não são continuação da fila**, são defeitos independentes._

| # | O quê | Custo |
|---|---|---|
| **3.1** | **Aviso de perda** — se o relato tem odontometria/sondagem e nada foi capturado, dizer na tela | baixo |
| **3.2** | **Queixa principal** — o prompt pede a queixa **do paciente**, não o procedimento | baixo |
| **3.3** | ⚠️ **Schema de endo** — ver caixa abaixo | baixo |
| **3.4** | **Extractor de endo por voz** (era a "A1" do roadmap antigo) | médio |
| **3.5** | **Extractor de implante** | médio |
| **3.6** | **Densidade da tela de confirmação** do Modo Consulta | médio |
| **3.7** | **Periograma** | **alto** — frente própria, ver §5 |
| **3.8** | **Vocabulário do prompt** desatualizado vs. banco | baixo |
| **3.9** | **`grupo_id`** nunca instruído — agrupamento morto | médio |
| **3.10** | **Ponte e esfoliação** proibidas por instrução | baixo-médio |

### ⚠️ 3.8 · O vocabulário do banco e o do Dex divergiram hoje

Achado ao reler o prompt depois de aplicar a 106. **A migration ampliou o banco; o prompt do
Dex ficou onde estava** — e nada mais foi ajustado:

| O que a 106 liberou no banco | O Dex emite? | Existe caminho manual? |
|---|---|---|
| `exame_periodontal`, `profilaxia`, `raspagem`, `clareamento`, `fluor` | ❌ não estão no enum do prompt | ❌ não existe UI de região |
| `nivel = 'boca'` | ❌ o enum do prompt tem só arcada/quadrante/dente/face | ❌ |

**Resultado: os cinco tipos novos são inalcançáveis.** Ampliei o banco e nada consegue
escrever lá. É o que explica "raspagem e alisamento radicular" ter virado texto solto no teste
de ontem — agora há tipo, mas continua sem caminho.

**Conserto:** ampliar o enum do prompt ([route.ts:78](../../src/app/api/dex/formatar-evolucao/route.ts))
**e** o validador `TIPOS_FATIA_A` (linha 140) — os dois, senão o evento é gerado e descartado
silenciosamente na validação.

### ⚠️ 3.9 · Agrupamento multi-dente está morto

A infraestrutura está pronta: o schema aceita `grupo_id` e a rota resolve tag curta (`"g1"`)
pra UUID real. **Mas não há uma linha no prompt ensinando o modelo a emitir a tag.**

Consequência: *"extraí do 31 ao 41"* vira **11 cards separados**, não um card agrupado.
Era a "Fase 2a" do roadmap A — ficou pendente porque o gate exige rodar o eval
`run-formatar-evolucao.mjs`, que precisa de build de prod + Playwright autenticado.

### ⚠️ 3.10 · Ponte e esfoliação estão proibidas por instrução explícita

[route.ts:298](../../src/app/api/dex/formatar-evolucao/route.ts) diz ao modelo, literalmente:
*"NÃO emita tipo 'ponte' nem 'esfoliacao'"*. Foi decisão consciente da Fatia A, mas o efeito
hoje é que **prótese com ponte e odontopediatria não podem ser ditadas** — duas das 8
especialidades do projeto.

> ### ⚠️ 3.3 — a tabela de endo que subiu hoje já nasce incompleta
> Achado ao comparar com um ditado real, não por typecheck:
> - O schema tem **`comprimentoRaiz`** (um campo). O dentista dita **dois**: comprimento
>   *aparente* **e** *real* — e eles divergem (no canal palatino: aparente 23, real 24).
> - **`limaFinal`** aceita 8 caracteres: comporta `#35`, mas **não** `35 reciprocante`.
>   A técnica (reciprocante / manual / rotatória) não tem onde ir.
>
> Corrigir **antes** de construir o extractor (3.4) — senão o extractor nasce mirando um
> schema errado.

---

# 4. A ficha clínica — o que falta

O redesenho de hoje entregou o layout de **coluna única** (campo mágico → odontograma →
registros → anotações). O artefato [`ficha-dois-modos`](../specs/ficha-dois-modos-2026-07-21-artefato.html)
desenhou a fase seguinte — **nada dele está codado**, é desenho aprovado em discussão.

### Decidido em discussão, zero código

| Item | O que é | Nota |
|---|---|---|
| **Odontograma do paciente** | Hoje a ficha desenha só os eventos **dela**. Passa a desenhar a boca inteira (histórico apagado + o de hoje com traço) | Exige query nova (por paciente) e resolver: tocar dente histórico **não pode** criar evento de hoje |
| **Revisão por exceção** | O sistema aponta o que merece atenção em vez de você varrer 8 cards | ⚠️ **Maior risco da fase.** Depende do item acima. Falso positivo repetido queima a confiança em uma semana — não sobe sem teste contra boca real |
| **Split de tela** | Odontograma à esquerda, registros/perfil à direita | ⚠️ Reavaliado 21/07: com manual ≈ 0 e 5 tabelas largas, a faixa compacta no topo pode ser melhor. **Decisão em aberto** |
| **Dois alvos no card** | Nº do dente → perfil do dente; título → detalhe do procedimento | Zero UI nova (o badge já existe) |
| **Perfil da região** | Profilaxia/raspagem/clareamento/flúor sem dente âncora | Migration 106 já habilita `tipo` e `nivel='boca'`; falta a UI |
| **Encaminhar a outro dentista** | Marcar planejados → escolher colega → observação → notificação | Coluna `encaminhado_para` já existe. ⚠️ Falta tudo o resto. Numa clínica de 5, um furo aqui **vaza prontuário pro dentista errado** — exige teste de RLS com 2 contas |
| **Assinatura por procedimento** | Vários de uma vez, com data própria | Migration **107**. Exige mudar a invariante #14 (hoje assinar congela a ficha inteira) |

### Perguntas ainda sem resposta sua

1. **Em que tela os 5 dentistas trabalham?** (notebook 1280 vs. monitor) — decide se o split sobrevive.
2. **Mini calendário de horários livres** no retorno: versão rápida (janela fixa 7–20h + conflito real) ou horário de expediente configurável (feature nova, spec própria)?

---

# 5. Periodontia — a peça grande

Registrada aqui porque é a única frente que **não cabe numa sessão** e precisa de planejamento próprio.

- **Volume:** 6 sítios × 32 dentes = 192 células, avanço de cursor, dente ausente colapsa, mobilidade e furca.
- **Duas vias de entrada:** teclado **e** Web Speech determinístico. A premissa "voz aceitável pra dígitos em PT-BR sob pressão" **nunca foi validada em campo** — é o único risco ALTO do projeto.
- ⚠️ **Não é JSONB.** O `detalhe` da 106 serve endo e implante. Perio precisa de série temporal comparável entre exames → tabelas satélite `perio_exames` / `perio_medidas`.
- **Invariante I6 — zero LLM nos números.** Isso significa que **ditar sondagem no campo mágico nunca vai funcionar**, por decisão de projeto. Ou o dentista sabe disso, ou o periograma existe. Não há meio-termo.
- **NIC = PS + MG, calculado na leitura, nunca persistido** — é ele que dirige o estadiamento AAP/EFP 2018.

**Consequência hoje:** perio aparece como procedimento na ficha (card + data + autor), **sem tabela de medidas**. **Diga isso aos 5 dentistas** — senão vira "está quebrado" no feedback.

---

# 6. Agenda — trilha separada

Mudanças de hoje, **ainda não commitadas**:

- ✅ Semana virou a view **padrão** ao abrir a agenda
- ✅ **Scroll interno da semana removido** — a grade renderiza 7h–20h por inteiro; se não couber, quem rola é a página (mesmo padrão que o Mês já usava)
- 🔴 **Mini calendário de horários livres** pro retorno — não começado, decisão pendente (§4)
- View de **Dia mantida** (decisão sua, 21/07)

⚠️ **Não existe conceito de "horário de funcionamento"** no sistema. O único campo parecido
(`bot_config.working_hours_start/end`) serve só ao bot do WhatsApp e não é lido pela agenda.
O que existe é checagem de **conflito**, não de **expediente**.

---

# 7. A fila — depois de tudo do dentista

_Revisada 21/07 lendo as 5 specs na íntegra. O que segue **é o que a spec diz**, não o que o
roadmap antigo supunha._

> **Ordem definida em 21/07:** ① tudo do dentista (§0, §3, §4, §5, §6) → ② **financeiro (7.1)**
> → ③ o resto (7.2, 7.4, 7.5). O cockpit/Job B saiu desta fila e virou item de dentista — está
> em **7.3**, mas pertence ao bloco 4 da §0.

### 7.1 · Financeiro / Orçamentos — o primeiro depois do dentista

[spec](../specs/2026-07-17-financeiro-correcao-completa-spec.md) · status `draft`

A tela de Orçamentos devolve **"Nenhum orçamento encontrado" para todos os papéis** desde
28/05 — a migration 067 criou uma 2ª FK pra `dentistas`, o embed do PostgREST virou ambíguo
(HTTP 300), e **o código não checa `error`** → `data` vira `null` e a tela mostra vazio.
Mesma causa derruba: PDF de orçamento (404 sempre), eventos de orçamento e de agendamento
na timeline, e a aba Agenda do perfil do paciente.

**6 frentes, nesta ordem** (a spec justifica): **1 → 4 → 2 → 3 → 5 → 6**

| Frente | O quê |
|---|---|
| 1 | Embeds ambíguos + erros de query engolidos — *destrava as telas, maior impacto, menor risco* |
| 4 | `registrarRecebimento`: dupla gravação + `dentista_id` NULL (isolada, latente) |
| 2 | Recebível fantasma (pendente criada na aprovação, nunca abatida) |
| 3 | Receita contando pagamento de orçamento recusado |
| 5 | Pacientes duplicados: mesclar + trava anti-duplicata |
| 6 | Higiene: dado de teste em prod + fuso na janela do mês — *explicitamente por último* |

⚠️ **Antes de executar:** a spec foi escrita contra o deploy `ca1b4a4`, quando a **099 ainda
não existia**. Hoje há 099 + 7 migrations depois dela. **Reconferir as assunções da spec**
antes de tocar a Frente 1.

⚠️ **Três escritas em prod, cada uma com gate próprio:** a migration nova (`pago_total` +
`situacao_pagamento` + trigger) com backfill · a limpeza das pendentes fantasma · o merge de
pacientes duplicados. A spec é explícita: *"nada de escrita em prod sem ok explícito, mesmo
com esta spec aprovada"*.

⚠️ **O DELETE das pendentes fantasma tem predicado perigoso** — só pode mirar pendentes **sem
`data_vencimento` e sem `parcela_numero`**. Parcelas reais têm os dois; errar o predicado
destrói o parcelamento de verdade.

**Decisão pendente sua:** a spec está `draft` e pede sua revisão do modelo da Frente 2
(recebível calculado por trigger, nunca materializado). E o paciente duplicado **"Mateus"** só
é apagado depois que você confirmar que é dado de teste.

---

### 7.2 · Painel do Dex

[spec](../specs/2026-07-16-painel-dex-notificacoes-spec.md) · **aprovada 16/07** · nenhuma decisão sua pendente

Dentista: **48 notificações enviadas, 0 lidas**. Secretária: 58/17. Não é "ele ignora" — é
sinal de que não chega.

✅ **A Fatia 0 já está feita** — a migration 103 (RLS destinatário-pessoa) **está aplicada em
prod**, verificada hoje. O roadmap antigo a listava como trabalho futuro. Restam as Fatias 1
(entrega: rota de alerts, sino no mobile, leitura por item, realtime) e 2 (fontes e render).

⚠️ **Consertar a entrega inunda o dentista com 48 notificações de backlog** de uma vez.
Mitigação prevista: marcar como lidas as > 30 dias.

⚠️ Realtime pode entregar payload **antes** da RLS filtrar → gate exige teste com 2 sessões reais.

**Ordem:** painel **antes** do protético — as duas specs concordam nisso.

---

### 7.3 · Job B — cockpit do tratamento 🔓 destravou hoje

[spec](../specs/2026-07-16-job-b-cockpit-tratamento-spec.md) · aprovada estruturalmente ("spec 100%")

> ### A regra de retomada desta spec **disparou com o push de hoje**
> A spec dizia: os contratos técnicos da §8 *"congelam só depois que as Fatias A/B do v3
> rodarem em prod"*. **O v3 está em prod desde hoje.** Então o próximo passo dela mudou de
> "esperar" para: **reabrir a spec → congelar a §8 → rodar design-brief → status vira
> `agreed-final` → só então executar.**

5 contratos estavam ⏳ esperando exatamente isso: endpoint agregador, layout do workspace,
shape do delta, migration (drops), gates finais.

⚠️ **Risco nomeado pela própria spec:** o workspace virar dashboard genérico — *"a doença que
o CLAUDE.md proíbe"*. Qualquer card além das 4 perguntas da §1 volta pro planejamento.

⚠️ O re-layout **não pode encostar no motor de captura** (auto-stop por silêncio, acúmulo de
trechos). *"Encolheu o pixel, não o comportamento."*

---

### 7.4 · Transcrição tratada — a menor das cinco

[spec](../specs/2026-07-16-transcricao-tratada-spec.md) · `agreed` · **zero migration**

A coluna `fichas.transcricao` existe desde sempre e **nunca foi preenchida uma vez** — 0 de 13
fichas do modo consulta guardaram o relato. Superfície pequena: 1 lib nova, 1 param opcional
no save, 1 seção na ficha, 1 no PDF.

⚠️ **Não simultânea com o Job A** — mesmos arquivos. A ordem entre as duas é livre.
⚠️ **Dobra o custo de Gemini por consulta** (2ª chamada com o mesmo input) — aceito na spec.
⚠️ Relato **bruto nunca persiste**; se o tratamento falhar, a ficha salva com `transcricao = null`.

---

### 7.5 · Protético

[spec](../specs/2026-07-16-protetico-marcar-retorno-spec.md) · ⚠️ **`draft` — a única das 5 que você ainda não aprovou**

✅ **A Fatia A já foi feita e deployada em 18/07** (modal "Marcar retorno", botão morto extinto,
`retorno_sugerido` fora do código — verificado hoje). A spec não foi atualizada e ainda diz
"nada implementado".

Falta a **Fatia B**: papel `protetico`, tabelas `proteticos` + `ordens_protetico`, tela
`/protetico`, notificação.

⚠️ **O número de migration da spec está queimado** — ela pede "migration 100", mas 100 é
`ficha_data_atendimento` e o repo já vai até 106. Renumerar pra **107+**.

⚠️ **Adicionar `'protetico'` ao CHECK de papéis quebra código que assume 3 papéis** — a spec
manda fazer `grep -rn "'secretaria'\|'dentista'\|'admin'" src/` antes.

⚠️ **Invariante dura:** o protético vê `{descricao, prazo, status}` e **nada mais** — é
*proibido* evoluir a função pra devolver mais campos (abrir `agendamentos` pra ele exporia
`observacoes` do paciente). E o prazo vem de JOIN, **nunca copiado** — copiado, envelhece em silêncio.

---

# 8. Dívidas

**Do teste de hoje**
- [ ] Schema de endo incompleto (aparente vs. real, técnica da lima) — §3.3
- [ ] Perda silenciosa de dado ditado — §3.1
- [ ] `queixa_principal` semanticamente errada — §3.2
- [ ] Vocabulário do prompt desatualizado vs. banco (5 tipos + `nivel='boca'`) — §3.8
- [ ] `grupo_id` nunca instruído no prompt — agrupamento morto — §3.9

**Herdadas da spec de hierarquia (arquivada 21/07 — só estes 2 itens sobreviveram)**
- [ ] **Plano `BASICO` nunca foi removido** — o CHECK de `clinicas.plano` e as RPCs de
      onboarding ainda o aceitam; o código contorna com backward-compat em ~5 pontos
      (`lib/planos.ts`, `access-control.ts`). Limpar = 1 migration + apagar os contornos
- [ ] **Fase B nunca iniciada** — varrer `permissions.ts` e as telas que ainda assumem
      "admin vê tudo". ⚠️ Precisa ser reescrita contra o modelo da **hierarquia 3.1**
      (clínica lê, autor escreve), não contra o silo antigo que ela pressupunha

**Higiene de documentação**
- [ ] ⚠️ **O campo `Status:` de várias specs mente** — a triagem de 21/07 achou 5 specs
      dizendo "PRONTA para execução" ou "draft" para coisas **em produção há semanas**.
      Ao ler qualquer spec, confie no código e no banco, não no cabeçalho dela

**Verificação que nunca aconteceu**
- [ ] ⚠️ Compartilhamento de ficha com 2 contas logadas
- [ ] Dogfood ao vivo do campo mágico (voz gravando, anexo de PDF, sobrescrita)
- [ ] Tabelas de endo/implante com dado real (round-trip salvar → recarregar)
- [ ] `design-review` completo da ficha — só contraste rodou; hierarquia e AI-slop pedem pixel real
- [ ] ⚠️ **O browser pane trava no screenshot** (bug recorrente do ambiente) — verificação visual depende de você

**Higiene**
- [ ] Paciente de teste não apagado — `Teste Design Review (apagar)`, id `0875d28a-223d-4821-be33-8c37b79b234e`
- [ ] Contas de teste em prod (`test-diag-0712@`, clínica QA `odontoia-test.local`)
- [ ] `AssinaturaRecepcaoModal.tsx:34` — 1 erro de lint `set-state-in-effect` (pré-existente)
- [ ] Touch targets do `CapturaLivreCard` (~28px vs. 44px recomendado) — decisão de design system

**Herdadas**
- [ ] `atualizarAgendamento` não valida conflito de **dentista** no servidor (só o client)
- [ ] Invariante #9 (UPDATE barrado por RLS devolve sucesso com 0 linhas) não coberta em `DocumentosTab`, `usePlanejamentoPaciente`, `tratamentos`
- [ ] Redis Upstash offline em prod · senha vazada (HaveIBeenPwned) desligada
- [ ] 59 casts (`supabase gen types` resolve) · bump next 16.x · `orcamentos-client` com 2k linhas

---

# 9. Backlog — sem data

- **Recorrência / manutenção mensal** (≠ assinatura do SaaS) — spec própria
- **WhatsApp** — credenciais Meta, 4 stubs do `meta.ts`, cron de lembretes
- **Retenção** — régua D1/D3/D7/D14/D30, relatório do Dex
- **Documentação ortodôntica inicial** (Angle, apinhamento, fotos, cefalometria) — spec própria
- **Billing** — Mateus já decidiu o modelo, informa "quando estiver 100%". **Não perguntar de novo**

---

# 10. Onde as coisas moram

```
plans/
├── roadmap/     ← SÓ este arquivo. Se aparecer outro, algo saiu do lugar
├── specs/       ← o conteúdo. Contratos técnicos e artefatos de design
├── handoffs/    ← o log da sessão. NUNCA se move, nunca se edita
└── concluidos/  ← arquivo morto. Só leia pra entender "por que decidimos assim"
```

**Specs ativas** (as que ainda dirigem trabalho):

| Spec | Cobre |
|---|---|
| [`spec-a0-fundacao-plugins-especialidade.md`](../specs/spec-a0-fundacao-plugins-especialidade.md) | Contrato dos plugins de especialidade (as 5 peças) |
| [`spec-106-detalhe-especialidade.md`](../specs/spec-106-detalhe-especialidade.md) | `detalhe` jsonb, schemas de endo/implante, o que ficou pra 107 |
| [`spec-modo-consulta-v3-odontograma.md`](../specs/spec-modo-consulta-v3-odontograma.md) | Event-log do odontograma, invariantes, fiscalização |
| [`ficha-definitiva-2026-07-21-artefato.html`](../specs/ficha-definitiva-2026-07-21-artefato.html) | Design da ficha **que está no ar** |
| [`ficha-dois-modos-2026-07-21-artefato.html`](../specs/ficha-dois-modos-2026-07-21-artefato.html) | Design da **próxima fase** (nada codado) |
| [`DESIGN-ficha-a0.md`](../specs/DESIGN-ficha-a0.md) · [`DESIGN-odontograma-v3.md`](../specs/DESIGN-odontograma-v3.md) | Como traduzir design pros tokens (`-ink`, DM Mono, zero hex) |
| As 5 da fila (§7) | Financeiro, painel do Dex, Job B, transcrição, protético |

**Arquivadas em 21/07** (estavam na pasta ativa dizendo-se pendentes, mas já em produção):
multi-especialidade · secretária cria orçamento · ficha unificada #16 · arquitetura de IA
providers · odontograma referência · precisão de extração · segurança do silo · perguntas da
clínica-piloto · hierarquia de papéis e planos. **`plans/specs/` foi de 24 para 16 arquivos.**

> ⚠️ **Dois artefatos de ficha convivem de propósito**: `ficha-definitiva` é o que está no ar,
> `ficha-dois-modos` é o desenho da próxima fase. **Quando a próxima fase for aprovada e codada,
> os dois se fundem num só** — manter dois documentos vivos descrevendo a mesma tela é como a
> confusão entre 3.1 e A começou.
