# Spec: Job B — Cockpit do tratamento (o novo modo consulta)

> **Status:** **APROVADA (estrutural) pelo Mateus em 16/07 — "spec 100%"** — escopo,
> decisões, invariantes e design de referência fechados; os contratos técnicos (§8)
> **congelam só depois que as Fatias A/B do v3 rodarem em prod** (regra de retomada na §8).
> Este documento existe pra decisão não evaporar — não pra fingir que dá pra especificar
> contrato sobre fundação que nunca executou (a lição de 16/07).
> **Data:** 2026-07-16
> **Origem:** desmembramento do modo consulta (14/07: Job A + Job B) · Spec 1 §7.1 ·
> reframe do Mateus em 16/07 (cockpit = a tela da consulta, não uma aba de leitura).
> **Modelo de execução:** Sonnet (quando os contratos congelarem)
> **⛔ Sequenciamento:** executa **depois** do v3 Fatias A/B (o mapa É o acumulado do v3;
> a confirmação/state machine vêm da Fatia A dele). Posição: após v3 → Job A → transcrição.

---

## 1. O job (na voz do dentista)

> *"Eu olho lá no tratamento e vejo que o canal já foi feito, aí libera pra mim continuar."*
> *"Precisamos pensar da ótica do dentista pra trazer algo útil DURANTE uma consulta."*
> — Mateus, 16/07

**A lei de design desta spec:** durante o atendimento, o dentista **consulta** informação
(mapa do caso, radiografia, alertas) e **produz** registro automaticamente (a transcrição
corre sozinha). Logo: o que ele consulta fica **grande**; o que ele produz fica **pequeno**.
O modo consulta atual inverte isso — um textarea protagonista que ninguém olha enquanto
atende. O cockpit desinverte.

As perguntas que a tela responde, em 5 segundos, com o paciente na cadeira:
1. **Onde o caso está** — o mapa de tratamento atual (boca acumulada) no centro.
2. **O que vim fazer hoje** — pendências corais em destaque, com autor e data.
3. **O que preciso ver** — radiografia/documento do paciente aberto ao lado, sem sair da tela.
4. **O que mudou desde minha última ficha** — o delta que libera o "posso continuar".

## 2. Decisões tomadas (16/07, com o Mateus)

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| **O cockpit É o novo modo consulta** — workspace de atendimento, não aba de leitura | Cockpit só no perfil + briefing (1ª forma desta spec, superada no mesmo dia) | Reframe do Mateus: o momento do job é DURANTE a consulta; a ótica é a de quem está com as mãos na boca do paciente |
| **Mapa de tratamento no centro; captura pequena** | Manter o textarea protagonista | O dentista fala, não digita — a transcrição é produto automático (widget compacto: mic, timer, último trecho, chips); a informação consultável domina a tela |
| **Radiografia/documentos abertos na consulta** | Corte de 14/07 ("PiP raio-x depois") | Revertido pelo dono do produto em 16/07 — faz parte do "útil durante a consulta". V1: lista dos docs do paciente + viewer lado a lado (signed URL, buckets existentes); anexar reusa o fluxo do DocumentosTab. Sem pipeline novo |
| **Cockpit DERIVADO — sem container manual** | Reviver `tratamentos` (criar "caso" e vincular fichas) | Dado de prod: **1 tratamento, 0 fichas vinculadas em 33** — container morreu na prática. Campo: "mal têm tempo de preencher ficha". Nasce sozinho de eventos+fichas |
| **Perfil ganha o mesmo cockpit (fatia própria)** | Só na consulta | Fora da consulta o caso também é consultado (planejamento, conversa com paciente); mesma agregação, duas casas |
| **Substitui o PendenciasTab** | Conviver com ele | Dois lugares dizendo "o que falta" divergem; o cockpit é o PendenciasTab adulto |
| **Fonte HÍBRIDA de dados** | Só `odontograma_eventos` | As 33 fichas atuais não têm eventos (v3 = sem backfill). V1 lê eventos + derivação legada de `dentes_observacoes`/`procedimentos_status` (como o PendenciasTab faz), evento vence empate. Sem isso, todo paciente atual nasceria com cockpit vazio |
| **Determinístico, zero LLM no cockpit** | Briefing gerado por IA | Agregação e template — previsível, instantâneo, custo zero. A IA da consulta continua onde sempre esteve: transcrever e organizar o relato |
| **Tabelas: drop das vazias** | Manter tudo | `planejamentos` (0) e `planejamento_etapas` (0) caem na migration do Job B. `tratamentos` (1 linha real): código para de referenciar, tabela deprecated até limpeza futura. `planejamento_procedimentos` (22 legadas) e `planejamento_secoes` (7, viva) intocadas |

## 3. Escopo

**Fatia 1 — O workspace da consulta** (o novo modo consulta):
- **Mapa de tratamento** central: boca acumulada (componente do v3 Fatia B) com pendências
  corais em destaque; toque no dente abre o painel de detalhe (v3) com histórico.
- **Documentos à mão**: painel lateral/overlay com os arquivos do paciente (radiografias em
  destaque), viewer lado a lado com o mapa; anexar = fluxo existente do DocumentosTab.
- **Captura compacta**: widget pequeno e persistente (mic + timer + último trecho + chips de
  detecção) — a `useCapturaLivre` do Job A, mesma peça. Expande se o dentista quiser digitar.
- **Delta no topo** (o antigo "briefing"): *"desde tua última ficha: Dr. Y realizou canal no
  26 · restam 3 pendências (2 tuas)"* — 2 linhas, dispensável.
- **Organizar + confirmação**: o pipeline do v3 Fatia A intacto — organizar pinta os eventos
  NOVOS sobre o mapa (preview), lista agrupada, data do procedimento, salvar.
- Alertas do paciente (alergias etc.): permanecem visíveis (herda da sidebar atual o que a
  consulta já mostra; o design decide a forma).

**Fatia 2 — Cockpit no perfil**: a seção "Tratamento" renasce com a mesma agregação
(progresso · mapa · o que falta com autor/data e badge "meu" · últimos movimentos · atalhos
Gerar orçamento/Marcar retorno). Remove o PendenciasTab e o código morto de `tratamentos`.

**NÃO cobre:**
- **Bloqueio de dependência** — o sistema **mostra, não bloqueia** (decisão do Mateus, Spec 1).
- Dinheiro de OUTROS dentistas — cockpit do X só mostra a parte financeira do X (099).
- Painel multi-paciente ("meu dia") — é o painel do Dex (fila #7).
- Editor/anotação sobre radiografia, medição, IA de imagem — viewer é viewer (v1).
- 3D, PiP flutuante persistente — o viewer lado a lado resolve; sofisticação visual é
  refinamento futuro se o campo pedir.
- Reviver `planejamentos`/`planejamento_etapas`/container manual.

## 4. Invariantes (congeladas já — não dependem do v3)

- [ ] **#1** O cockpit **nunca escreve** estado clínico por conta própria — o único caminho
      de escrita continua sendo o pipeline organizar→confirmar→salvar (invariante #1 do v3).
- [ ] **#2** **Mostra, não bloqueia** — zero pré-requisito modelado (herdada da Spec 1).
- [ ] **#3** Financeiro = **só do dentista logado**; pendência de colega aparece sem botão
      de orçar e sem valores.
- [ ] **#4** Lê a matriz de acesso da 099 como está — nenhuma policy nova.
- [ ] **#5** Zero passo manual novo — nenhum container, nenhum campo obrigatório, nenhum
      vínculo à mão. Se o cockpit pedir input pra existir, a spec falhou.
- [ ] **#6** Determinístico — zero LLM no caminho do cockpit (mapa/delta/pendências).
- [ ] **#7** Fonte híbrida transparente (evento novo e legado iguais pro usuário; evento
      vence empate).
- [ ] **#8** A captura compacta **não perde função**: auto-stop por silêncio, acúmulo de
      trechos, detecção ao vivo e organizar — tudo idêntico ao contrato do Job A/consulta.
      Encolheu o pixel, não o comportamento.
- [ ] **#9** O viewer de documentos é **leitura** (signed URL, buckets existentes); anexar
      reusa o fluxo do DocumentosTab sem fork.

## 5. Wireframe de referência (o design-brief da execução decide o pixel)

```
┌─ Consulta — José Silva ── alertas: alergia dipirona ─────────────┐
│ Δ desde tua última ficha: Dr. Y realizou canal no 26 (16/07) ×   │
│                                                                  │
│ ┌──────────────────────────────────┐  ┌───────────────────────┐  │
│ │   MAPA DE TRATAMENTO (acumulado) │  │ radiografia_26.jpg    │  │
│ │   corais destacadas = hoje       │  │ [viewer lado a lado]  │  │
│ │   toque no dente → detalhe       │  │ docs: rx_pan.jpg …    │  │
│ └──────────────────────────────────┘  └───────────────────────┘  │
│                                                                  │
│ ┌─ captura ────────────────────────────────────────────────────┐ │
│ │ ● 04:32 · "…iniciada instrumentação dos canais mesiais…"     │ │
│ │ chips: Canal – 26        [mic] [anexar]  [Organizar com Dex] │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## 6. Progresso — a régua

Conta por **procedimento** (evento): `realizados / (realizados + indicados)`. Pré-existente
(slate) não entra — é história, não trabalho do caso. Pendência legada conta pela derivação
de `procedimentos_status` (`concluido` = realizado). Evento vence derivação no mesmo
dente+procedimento.

## 7. Relação com o v3 (quem entrega o quê)

| Peça do cockpit | Vem de | Job B faz |
|---|---|---|
| Boca acumulada + painel de detalhe | v3 Fatias A/B (componente + endpoint) | reusa e posiciona |
| Pipeline organizar→confirmar | v3 Fatia A | intacto — muda a moldura, não o motor |
| Captura compacta | Job A (`useCapturaLivre` + VoiceUX) | re-embala em widget pequeno |
| Pendências com autor/data | eventos + derivação legada | a agregação (novo) |
| Delta "desde minha última ficha" | eventos + fichas | a agregação (novo) |
| Viewer de documentos | buckets + DocumentosTab existentes | o painel lado a lado (novo) |

## 8. Contratos técnicos — ⏳ CONGELAM PÓS-v3 (Fatia A/B em prod)

| Contrato | Depende de | Nota |
|---|---|---|
| Endpoint agregador (`cockpit`?) vs estender `odontograma-acumulado` (v3 §3.4) | forma final do acumulado | pode ser 1 extensão, não rota nova |
| Layout final do workspace (split do viewer, posição da captura, responsivo) | design-brief pós-v3-A (a confirmação remodelada já existirá) | wireframe §5 é referência, não pixel |
| Shape do delta (corte: minha última ficha) | `registrado_em` real em prod | calibra com uso |
| Migration (drops + deprecação) | numeração pós-102 | SQL trivial, escreve na hora |
| Gates finais | tudo acima | esboço em §9 |

**Regra de retomada:** com v3 A/B em prod, reabrir esta spec, congelar a §8 contra o que
existe, rodar design-brief do workspace, status vira `agreed-final`, e só então executa.

## 9. Gates de aceite (esboço — fecham com a §8)

- [ ] Consulta abre com mapa atual + delta correto após evento de colega (o caso do canal).
- [ ] Radiografia abre lado a lado sem sair da consulta; fechar volta ao mapa; nada persiste.
- [ ] Captura compacta: ditado, auto-stop, chips e organizar — comportamento idêntico ao
      gate do Job A (regressão zero).
- [ ] Organizar pinta os eventos novos SOBRE o mapa (preview) e a confirmação segue o v3.
- [ ] Paciente com fichas legadas + eventos: progresso bate com contagem manual.
- [ ] Dentista B vê pendências do A sem orçar/valores; badge "meu" só nas do logado.
- [ ] Paciente sem nada: cockpit vazio elegante (convite, não erro).
- [ ] PendenciasTab removido sem regressão do toggle de status (continua na ficha).
- [ ] Zero chamada de LLM no cockpit (network limpo fora do organizar/transcrever).

## 10. Riscos

| Risco | Mitigação |
|---|---|
| v3 muda contrato na execução | §8 não congela hoje — risco aceito e cercado |
| Workspace virar dashboard genérico (a doença que o CLAUDE.md proíbe) | O escopo é as 4 perguntas da §1; qualquer card além delas volta pro planejamento |
| Viewer lado a lado apertar o mapa em tela pequena | Design-brief decide o breakpoint (overlay em telas menores); gate de responsivo |
| Fonte híbrida diverge | Regra de empate (§6); some com o tempo |
| Re-layout da consulta mexer no motor de captura | Invariante #8 + gate de regressão explícito |
