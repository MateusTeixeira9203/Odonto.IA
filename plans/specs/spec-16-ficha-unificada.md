# Spec #16 — Ficha unificada (ficha = tratamento numa superfície só)

> Criado 2026-07-03 (sessão de planejamento). Escopo **fechado e aprovado** pelo fundador.
> Roadmap: item **#16** de `plans/roadmap/roadmap-polimento.md`.
> **Modo da execução:** este spec é o contrato; a implementação segue ele, não improvisa.

## 1. Problema

Hoje a ficha vive em dois momentos desconectados: você **cria** a evolução num painel
(`FichasTab`, painel "Nova Evolução") e **acompanha** o tratamento em outro lugar (o card
expandido, com odontograma-filtro + progresso + toggle de status). Isso força o dentista a
"clicar duas vezes" e rastreia o mesmo procedimento em **duas fontes de verdade**
(`fichas.procedimentos_status` na ficha vs `planejamento_procedimentos` no Apresentar).

A referência do fundador (ficha de papel odontológica) **não é o modelo** — ela é
desorganizada e sem controle de pagamento. O que se herda dela é a **coesão** (odontograma +
serviços + assinatura num lugar). A organização digital (orçamento/documentos separados) é o
diferencial e **fica**.

## 2. Objetivo

**Uma superfície só: a ficha É o acompanhamento.** Lançar o procedimento e marcar o estado é
o mesmo gesto, no mesmo lugar. O odontograma deixa de ser só seletor e vira o **mapa de
progresso** da boca.

## 3. Decisões travadas

| # | Decisão | Nota |
|---|---|---|
| D1 | **Superfície única** — a ficha tem modo **edição** (criar/editar) e modo **leitura** (acompanhar); é a mesma ficha, não duas telas | mata o clicar-duas-vezes |
| D2 | **1 ficha = 1 tratamento** | já vigente; mantido |
| D3 | **3 status:** `nao_iniciado` (cinza + borda escura) → `em_andamento` (âmbar `#f59e0b`) → `concluido` (teal `#2f9c85`, cor da marca) | substitui o toggle binário atual |
| D4 | **Fonte única de status:** `fichas.procedimentos_status` é a verdade; `planejamento_procedimentos` passa a **derivar** dela (ou é aposentado) | o `ApresentarPaciente` passa a ler da ficha |
| D5 | **Escopo de região:** dente · **quadrante (novo)** · arcada (sentinelas 97/98) · boca toda (99) | quadrante = raspagem/alisamento (caso perio comum) |
| D6 | Procedimento de região **não pinta dente a dente** — entra como linha própria com rótulo de escopo e **destaque de região** no odontograma | evita confundir "dente X" com "região" |
| D7 | **Odontograma reusável** (o atual, decíduos + permanentes) colorido por status; **significado da cor vem por prop** | mesma peça em consulta e ficha, sentidos diferentes |
| D8 | **Progresso derivado** dos status (sem contador manual) | |
| D9 | **Mantido:** assinatura (SignaturePad), impressão PDF, voz→IA preenchendo | |
| D10 | **Removido:** "DEX sugerindo orçamento" dentro da ficha (o modal analisa-enquanto-digita) | orçamento nasce automático fora da ficha |
| D11 | **Anexos NÃO entram na ficha** — ficam na aba Arquivos (pool, com data) | ficha magra; menos poluição |

**Fora do #16 (itens adjacentes, execução própria):**
- Orçamento "já estruturado, dentista só aprova" (fluxo do orçamento, não da ficha).
- Largura global pós-sidebar (**#18** no roadmap).

## 4. Fluxo de criação (edição → leitura)

1. "Nova evolução" → abre a ficha em **modo edição**: odontograma **seletor**, observação por
   voz (Groq→IA estrutura dentes + procedimentos), lançar procedimento por dente.
2. **Salvar** → a **mesma ficha** vira **modo leitura**: os procedimentos lançados entram como
   `nao_iniciado` (A fazer), progresso 0%.
3. Nas sessões seguintes o dentista abre a ficha e **avança o status** ali mesmo — os dentes
   acendem no odontograma, o progresso sobe.
4. "Editar" volta ao modo edição.

**Invariante:** todo procedimento nasce `nao_iniciado`. O dentista promove manualmente.

## 5. Modelo de dados (mudanças)

- **`fichas.procedimentos_status`** (`Record<procKey, status>`): enum muda
  `planejado | agendado | concluido` → **`nao_iniciado | em_andamento | concluido`**.
  - Migração: `planejado → nao_iniciado`, `agendado → nao_iniciado`, `concluido → concluido`.
  - `procKey` mantém o formato `${tooth}_${i}`. Default de leitura: `nao_iniciado`.
- **Escopo de quadrante:** definir sentinelas de quadrante seguindo o padrão de arcada
  (97/98/99). Proposta: `91`–`94` (sup-dir, sup-esq, inf-dir, inf-esq) — **confirmar na
  execução** contra `src/lib/arcadas.ts` para não colidir. Atualizar `ARCH_LABELS`.
- **Fonte única:** decidir na execução entre (a) `planejamento_procedimentos` vira **view/derivação**
  de `fichas.procedimentos_status`, ou (b) aposentar a tabela e o `usePlanejamentoPaciente`
  passa a montar do lado da ficha. Preferência: derivar, menos risco.
- **Anexos:** sem mudança de schema (anexos continuam em `paciente_documentos`, sem vínculo
  obrigatório à ficha).

## 6. UI / Componentes

- **Refatorar `FichasTab`** para a superfície única (edição ↔ leitura). Fundir o painel de
  criação com a visão expandida.
- **`Odontograma`**: adicionar prop de **significado de cor** (ex: `colorMode: 'status' | 'selection'`).
  Status: cinza/âmbar/teal. Aditivo — não quebra o uso atual da consulta.
- **Remover** da ficha: modal "orçamento sugerido pela IA" (o analisa-enquanto-digita) e a
  seção de anexos do painel de criação.
- **Limpar código órfão:** "episódio de tratamento" (comentário `FichasTab:1174`), modais
  órfãos, e `NovaEvolucaoPanel.tsx` se confirmado sem uso.

## 7. Impacto no Modo Consulta

- A consulta **grava dentes + procedimentos, não status** → D3/D4 = **zero impacto**.
- **Odontograma já compartilhado** ([`consulta-client:918`](src/app/consulta/[agendamentoId]/_components/consulta-client.tsx:918)) → D7 é **aditivo** (prop de cor). A consulta segue passando `detectedTeeth`/`confirmedTeeth`.
- **Cores por contexto:** na consulta âmbar = *detectado* / teal = *confirmado*; na ficha âmbar
  = *em andamento* / teal = *concluído*. Telas separadas — resolver via prop `colorMode`, nunca cor fixa.
- **Quadrante (D5):** o prompt [`formatar-evolucao`](src/app/api/dex/formatar-evolucao/route.ts:58) hoje sabe dente + arcada + boca, **não sabe quadrante**. → faseável.

## 8. Faseamento

- **v1:** superfície única + 3 status + fonte única + odontograma-mapa + limpeza de órfãos.
  Quadrante = **seleção manual** na ficha. Consulta intocada (só a prop de cor, aditiva).
- **v2:** quadrante **por voz** — ensinar o prompt `formatar-evolucao` e os chips a capturar
  quadrante (sentinelas 91–94).

## 9. Gates de aceite

- [ ] Criar evolução → salvar → a mesma ficha exibe os procedimentos como "A fazer", sem segunda tela.
- [ ] Avançar status A fazer → Em andamento → Concluído reflete no odontograma (cor) e no progresso.
- [ ] Odontograma na consulta continua funcionando (detectado/confirmado) sem regressão.
- [ ] Um único lugar grava status; o Apresentar reflete o mesmo estado da ficha.
- [ ] `tsc` + `eslint` limpos.

## 10. Achados durante o escopo (registrar como execução)

- **[BUG] Voz na ficha não insere o texto.** `FichasTab:354` lê `data.texto`, mas
  `/api/transcrever` (Groq) retorna `data.transcricao`. Fix de 1 palavra. O `NovaEvolucaoPanel`
  tem o mesmo erro (órfão). A consulta já está correta (`data.transcricao`).
