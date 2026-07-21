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

### Ordem de correção — do mais barato ao mais caro

| # | O quê | Custo | Por quê primeiro |
|---|---|---|---|
| **3.1** | **Aviso de perda** — se o relato tem odontometria/sondagem e nada foi capturado, dizer na tela | baixo | Para de perder em silêncio. É o que mais protege por menos esforço |
| **3.2** | **Queixa principal** — ajustar o prompt pra pedir a queixa **do paciente**, não o procedimento | baixo | Campo tem peso legal (CFO); hoje está semanticamente errado |
| **3.3** | ⚠️ **Corrigir o schema de endo** — ver caixa abaixo | baixo | A tabela entregue hoje **perde dado mesmo preenchida à mão** |
| **3.4** | **Extractor de endo por voz** (era a "A1") | médio | A tabela já existe; falta encher pela fala |
| **3.5** | **Extractor de implante** | médio | Menor que endo, mesmo padrão |
| **3.6** | **Densidade da tela de confirmação** do Modo Consulta | médio | Os mesmos procedimentos aparecem em **5 formas** na mesma tela |
| **3.7** | **Periograma** | **alto** | A maior peça de todas — ver §5 |

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

# 7. A fila — depois da ficha

| # | O quê | Estado | Spec |
|---|---|---|---|
| **1** | **Financeiro / Orçamentos** — 5 lugares quebrados por embed ambíguo · status por trigger | ⚠️ **tela Orçamentos prod-down há ~2 meses** · spec escrita, **não executada** | [spec](../specs/2026-07-17-financeiro-correcao-completa-spec.md) |
| **2** | **Painel do Dex** — notificações que não chegam (dentista: 48 enviadas, **0 lidas**) | spec aprovada 16/07 | [spec](../specs/2026-07-16-painel-dex-notificacoes-spec.md) |
| **3** | **Job B — cockpit do tratamento** (o novo Modo Consulta) | spec aprovada · **consome os plugins**, monta peças prontas | [spec](../specs/2026-07-16-job-b-cockpit-tratamento-spec.md) |
| **4** | **Transcrição tratada** — hoje some 100% (0 de 13 fichas guardaram) | spec aprovada 16/07 | [spec](../specs/2026-07-16-transcricao-tratada-spec.md) |
| **5** | **Protético** — papel, ordem de trabalho, notificação | depende do painel (#2) | [spec](../specs/2026-07-16-protetico-marcar-retorno-spec.md) §5 |

> **A #1 é a mais antiga e a mais cara em dinheiro:** a tela de Orçamentos está vazia em produção
> há cerca de 2 meses. Não depende de nada da ficha — pode subir a qualquer momento.

---

# 8. Dívidas

**Do teste de hoje**
- [ ] Schema de endo incompleto (aparente vs. real, técnica da lima) — §3.3
- [ ] Perda silenciosa de dado ditado — §3.1
- [ ] `queixa_principal` semanticamente errada — §3.2

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

> ⚠️ **Dois artefatos de ficha convivem de propósito**: `ficha-definitiva` é o que está no ar,
> `ficha-dois-modos` é o desenho da próxima fase. **Quando a próxima fase for aprovada e codada,
> os dois se fundem num só** — manter dois documentos vivos descrevendo a mesma tela é como a
> confusão entre 3.1 e A começou.
