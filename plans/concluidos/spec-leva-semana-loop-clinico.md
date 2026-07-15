# Spec — Leva da semana: loop clínico (fricções observadas)

> **Modo:** execução (este spec é o contrato; a próxima sessão implementa, não re-escopa).
> **Criado:** 2026-07-07 (sessão de planejamento, madrugada).
> **Origem:** `plans/handoffs/handoff-2026-07-06-discussao.md` + `plans/roadmap/roadmap-polimento.md` (itens #2, #5, #6, #7, #10, #11).
> **Estado do código:** branch `feat/fase1-onboarding-persona-loop`. Nenhuma mudança de schema — tudo reusa tabela/action existente.
> **Gate de contexto:** o teste com a clínica 2 secretárias + 5 dentistas é a régua. Cada mudança é bug em potencial na véspera — **mexer pouco, dogfoodar antes.**

---

## 1. Objetivo

Remover as fricções **observadas em teste real** no loop clínico do dentista (`consulta → ficha → assinar → orçamento → retorno`), sem tocar o fluxo de dinheiro nem desestabilizar o que já funciona. Norte único:

> **Menos cliques até o resultado final.** O botão certo é sempre o próximo passo. Nada escondido em menu.

### Lentes transversais (valem pra todos os itens)
1. **Dois loops.** Clínico (dentista: produz ficha/orçamento) ≠ balcão (secretária/checkout: entrega, envia, agenda). A fricção nasce quando o balcão vaza pro clínico. O dentista **produz**; o dado **flui pra frente**; o balcão **entrega**.
2. **Oferecer, não forçar.** Nada de wizard obrigatório.
3. **O dado flui pra frente** — nunca redigitar o que o sistema já sabe (paciente, procedimentos, prazo de retorno).
4. **Affordance explícito** (persona = dentista veterano): botão rotulado > ícone mudo, mas sem poluir (clareza calma, máx. 2 botões grandes por superfície).
5. **Auto-gerar + refinar** — o sistema faz o peso, o dentista põe a alma.

---

## 2. Escopo

**Dentro (6 itens):** #2 walk-in · #5 botões visíveis · #6 ficha→orçamento · #7 alerta de catálogo · #10 marcar retorno · #11 reordenar abas.

**Fora (deferido — não fazer nesta leva):**
- Auto-limpeza do agendamento-fantasma abandonado (#2). Fica na agenda, limpeza manual.
- Dedup / fuzzy-match de procedimento no catálogo (#7 metade difícil). Post-teste.
- Remover a aba Agenda (#11). Só reordenar; remoção fica pra depois.
- Fluxo "secretária assina na recepção" (dono/onde da assinatura) — **radar da visita**, não construir no escuro.
- Deep-link "gerar orçamento" no fim do Modo Consulta — a entrada pelo card de ficha é o núcleo; o fim-da-consulta fica pro pós-teste.
- `#6b` auto-preço por nome falado, `#7` similaridade.

---

## 3. Arquitetura compartilhada (ler antes de codar)

### 3.1 O card de ficha é a superfície de #5 + #6 + #7 + #10
O componente `FichasTab` (`src/components/pacientes/FichasTab.tsx`) renderiza cada ficha/evolução. A barra de ações desse card concentra **quatro** itens desta leva. **Desenhe a barra inteira de uma vez**, não item a item:
- #5 → disposição/hierarquia dos botões (estado por assinatura).
- #6 → botão `Gerar orçamento`.
- #7 → vive dentro do modal de orçamento (contexto), não no card.
- #10 → botão `Agendar retorno` (aparece quando há `retorno_sugerido`).

### 3.2 Fronteira de componente: `FichasTab` → pai
`FichasTab` é importado **dinâmico** e é autocontido (`paciente-detail-client.tsx:59`). O modal de orçamento (`NovoOrcamentoModal`) e o modal de nova consulta vivem no **pai** (`paciente-detail-client.tsx`). Logo, #6 e #10 precisam de **callbacks do FichasTab pro pai** — mesmo padrão pros dois:
```ts
// props novas em FichasTab
onGerarOrcamento?: (fichaId: string) => void;   // #6
onAgendarRetorno?: (fichaId: string, prazo: string | null) => void; // #10
```
O pai passa handlers que abrem os modais já pré-preenchidos. **Não** duplicar os modais dentro do FichasTab.

### 3.3 Única action nova
`criarPacienteRapido({ nome, telefone })` para o #2 — todo o resto reusa action existente. Seguir o padrão de `criarProcedimentoRapido` (`src/app/dashboard/orcamentos/actions.ts:594`): `'use server'`, `requireClinicContext`, insert mínimo com `clinica_id`, retorno `{ id?, error? }`.

---

## 4. Itens

### #2 — Iniciar consulta sem pré-agendamento (walk-in)

**Objetivo.** Permitir começar o Modo Consulta **sem agendar antes**. Caso real: família chega junto — a mãe estava agendada, o pai e a filha (novos, sem cadastro) querem ser atendidos no mesmo horário livre.

**O que temos.**
- Consulta é a rota `/consulta/[agendamentoId]` — 100% amarrada a um agendamento; sem ele, redireciona pra agenda (`src/app/consulta/[agendamentoId]/page.tsx:38`).
- A consulta escreve status de volta no agendamento: `in_progress` ao abrir (`consulta-client.tsx:218` → `iniciarAtendimentoConsulta`), `completed` ao salvar ficha (`actions.ts:57`).
- `criarEncaixe(dados)` já existe (`src/app/dashboard/agendamentos/actions.ts:477`): cria agendamento no horário atual, detecta conflito, exige `pacienteId` **existente**; retorna `{ id }`.
- Autocomplete de paciente por nome já existe (`agendamentos-client.tsx:656` `buscarEncaixePacientes`).
- "Nova Consulta" na página do paciente (`paciente-detail-client.tsx:963` `handleNovaConsulta`) **só agenda** (exige data+hora) — não entra na consulta.

**O que construir.**
1. **Popup "Atender agora" (núcleo).** Busca-primeiro:
   - Campo de busca → reusa o padrão `buscarEncaixePacientes`. Achou → usa o `pacienteId` (traz histórico/alertas na consulta). Este é o caminho que **desduplica e preserva o histórico** — a busca não é atrito, é o ativo.
   - Não achou → **criar rápido** com **nome + telefone** (só isso) via `criarPacienteRapido`.
2. **Criar agendamento implícito** com `dataHora = agora` via `criarEncaixe` (reusa a detecção de conflito/override que já existe) → recebe `id`.
3. `router.push('/consulta/${id}')` → entra no Modo Consulta.
4. **Entrada.** Botão "Atender agora" na **agenda** (`dashboard/agendamentos`, ao lado do encaixe) e/ou no **dashboard**. Bônus opcional: atalho "Atender agora" ao lado de "Nova Consulta" na página do paciente (thin — reusa o mesmo fluxo com o `pacienteId` já conhecido).

**Arquivos & mudanças.**
- **Novo:** `criarPacienteRapido` em `src/app/dashboard/pacientes/[id]/actions.ts` (ou em `pacientes/actions.ts`) — insert `{ clinica_id, nome, telefone }`, retorna `{ id }`.
- **Novo componente:** popup de walk-in (busca + criar rápido). Reaproveitar visual do modal de encaixe.
- **Wiring:** botão "Atender agora" na agenda/dashboard; ao confirmar → `criarEncaixe({ pacienteId, dataHora: now, duracaoMinutos: 30, ... })` → push.

**Invariantes.**
- Paciente novo é criado no `clinica_id` ativo (multi-tenant).
- Walk-in só entra na consulta com o `id` retornado (nunca navega sem agendamento).
- Nada de auto-marcar horário fixo além de "agora".

**Risco.** Médio (o mais pesado da leva — popup + action novos). O "fantasma" abandonado (walk-in sem ficha) **fica na agenda** como qualquer encaixe; cancelar/no-show manual (ações já existem). Sem auto-limpeza nesta leva.

**Aceite.**
- [ ] De um paciente **existente**: "Atender agora" → busca → seleciona → cai no Modo Consulta com histórico/alertas carregados.
- [ ] De um paciente **novo**: "Atender agora" → não acha → cria com nome+telefone → cai no Modo Consulta.
- [ ] O agendamento implícito aparece na agenda com horário = agora.
- [ ] Abandonar a consulta não quebra nada; o agendamento pode ser cancelado na agenda.

---

### #5 — Botões visíveis e organizados (card de ficha + header)

**Objetivo.** O dentista veterano não achava a edição (ícone mudo). Tornar as ações **visíveis e com hierarquia**, **sem menu escondido** (o "•••" foi rejeitado — esconder vai contra "menos cliques"). Máx. **2 botões grandes** por superfície pra não poluir.

**O que temos.**
- Card de ficha (`FichasTab.tsx:1043-1086`): `Assinar` (rotulado, ícone `PenLine`) **ou** selo "Assinado em..." · `Editar` (ícone `PenLine`, só `canWrite`) · `Imprimir` (ícone `Download` → `/api/fichas/[id]/pdf`) · `Excluir` (ícone `Trash2`) · chevron. **Assinar e Editar usam o mesmo ícone de caneta** → confunde.
- Header do paciente (`paciente-detail-client.tsx:1006-1048`): `Editar paciente` (ícone `Edit2`) · `Exportar prontuário` (ícone `FileDown`) · `Emitir documento` (ícone `FilePlus`, `canWriteClinical`) · `Apresentar` (rotulado) · `Nova Consulta` (rotulado).

**O que construir.**
- **Card de ficha — ação principal muda com o estado (desacoplada da assinatura, ver #6):**
  - **Não assinada:** `[Gerar orçamento]` (teal, primário) + `[Assinar]` (contorno) — **lado a lado**.
  - **Assinada:** selo "Assinado DD/MM" (à esquerda) + `[Gerar orçamento]` (teal). O Assinar vira selo → sobra 1 botão grande.
  - **Divisor** fino, depois `[Editar] [Baixar] [Excluir] [chevron]` como **ícones** (não botões grandes).
  - **Editar ganha ícone distinto do Assinar** (Assinar = `ti-signature`/caneta de assinatura; Editar = lápis) pra matar a colisão de caneta.
  - **Sem "•••".** Tudo visível.
- **Header:** manter ícones visíveis, **sem menu**. Mudança mínima; opcional rotular "Editar" (baixa prioridade). Não auditar todos os ícones do app.

**Arquivos & mudanças.**
- `src/components/pacientes/FichasTab.tsx` — barra de ações do card (linhas ~1043-1086). Trocar ícone do Editar; inserir `Gerar orçamento` (ver #6); dispor por estado; adicionar divisor.
- `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` — header (opcional/mínimo).

**Invariantes.**
- Regras de permissão **inalteradas**: secretária não edita ficha; dentista só as próprias (`pacientes/[id]/actions.ts:100-113`).
- Máx. 2 botões grandes visíveis por card.
- Funciona em light/dark, tokens do design system (nada hardcoded).

**Risco.** ~zero (markup/disposição). Depende do #6 pro botão `Gerar orçamento`.

**Aceite.**
- [ ] Ficha não assinada mostra `Gerar orçamento` + `Assinar` lado a lado; assinada mostra selo + `Gerar orçamento`.
- [ ] Editar/Baixar/Excluir visíveis como ícones; nenhum menu "•••".
- [ ] Editar e Assinar têm ícones distintos.
- [ ] Light e dark corretos.

---

### #6 — Ficha → Orçamento pré-montado (entrada mirada)

**Objetivo.** Matar os "6 cliques + scroll" (`fechar ficha → orçamentos → novo → escolher ficha → scrollar`). Gerar o orçamento **a partir da ficha, já mirado**.

**O que temos (o motor já existe).**
- `NovoOrcamentoModal` (`src/app/dashboard/pacientes/[id]/_components/modals/novo-orcamento-modal.tsx`) — popup 2 colunas: esquerda procedimentos, direita resumo (total, valor negociado, desconto, criar). Etapas `selecionar` / `itens`.
- `fichaParaItens(ficha)` (`paciente-detail-client.tsx:731`) — agrupa dentes por procedimento (mesmo texto em N dentes → 1 item, quantidade N) e **casa com o catálogo** por nome (puxa preço). O que não casa → alerta âmbar (#7).
- `abrirNovoOrcamento` (`:768`): busca fichas; >1 → etapa `selecionar`; 0/1 → etapa `itens` já pré-preenchida.
- `handleCriarOrcamento` (`:841`): cria via `criarOrcamento`, **já dá toast de sucesso** ("Orçamento criado como rascunho") e fecha o modal, mantendo o contexto (`:895`).
- Hoje o gatilho é só "+ Novo Orçamento" na **aba Orçamentos** (`:1323`).
- Envio (balcão) já existe na aba Orçamentos: `BotaoDownloadPDF` (`src/components/orcamentos/botao-download-pdf.tsx:12`) e `BotaoEnviarWhatsApp` (`botao-enviar-whatsapp.tsx:48`, abre WhatsApp com link do PDF e marca "enviado").

**O que construir (leve — só a entrada).**
1. Botão `Gerar orçamento` no card de ficha (#5) → `onGerarOrcamento(fichaId)` (callback pro pai).
2. Handler novo no pai `abrirOrcamentoParaFicha(fichaId)`: setar `fichaOrcId`, pré-preencher `novoOrcItens = fichaParaItens(ficha)`, `etapaNovoOrc = 'itens'`, abrir modal — **pulando a etapa `selecionar` mesmo com múltiplas fichas**.
3. Ao `Criar`: **mantém o comportamento atual** (toast + fecha + fica na ficha; orçamento flui pra aba Orçamentos via `setOrcamentosState`). **Não** auto-navegar pro envio — enviar é balcão.
4. **Desacoplado da assinatura:** `Gerar orçamento` disponível assinada ou não.

**Fluxo final.**
> Clínico: ficha → **Gerar orçamento** → popup pré-preenchido → confere preço → **Criar** → toast, volta pra ficha.
> Balcão: pega o orçamento na aba Orçamentos → `Baixar PDF` / `Enviar WhatsApp`.

**Arquivos & mudanças.**
- `FichasTab.tsx` — botão + prop `onGerarOrcamento`.
- `paciente-detail-client.tsx` — `abrirOrcamentoParaFicha`, passar prop, garantir que `fichaParaItens` recebe os campos da ficha (`dentes_afetados`, `dentes_observacoes`); se o objeto ficha do FichasTab não os tiver, buscar por id (como `abrirNovoOrcamento` faz).

**Invariantes.**
- A entrada mirada sempre cai em `itens` com os procedimentos daquela ficha; `fichaOrcId` = a ficha clicada.
- Não remover o "+ Novo Orçamento" da aba (é entrada alternativa).
- Envio permanece na aba Orçamentos (balcão).

**Risco.** Baixo. Único ponto real = a callback através da fronteira do FichasTab.

**Aceite.**
- [ ] `Gerar orçamento` no card → popup abre **direto nos itens**, procedimentos da ficha preenchidos e precificados onde bate no catálogo.
- [ ] Paciente com várias fichas: **não** aparece a etapa "escolher ficha".
- [ ] `Criar` → toast, volta pra ficha, orçamento aparece na aba Orçamentos.
- [ ] Não navega pra tela de envio automaticamente.

---

### #7 — Alerta de procedimento sem catálogo (Opção B)

**Objetivo.** O aviso "não cadastrado no catálogo" existe, mas o "+ cadastrar" é um **link fraco**. Virar **botão de verdade** que salva na hora — sem confirm (o confirm não resolveria a poluição real, que é dedup, deferido; seria atrito à toa).

**O que temos.**
- Alerta âmbar em `novo-orcamento-modal.tsx:235-249` quando `!item.procedimentoId && item.descricao.trim()`: texto "Procedimento não cadastrado no catálogo" + link fraco "+ Cadastrar no catálogo" → `onCadastrarProcedimento(idx)`.
- `handleCadastrarProcedimento` (`paciente-detail-client.tsx:820`) → `criarProcedimentoRapido({ nome: stripDenteDoNome(descricao), precoPadrao })` → **salva na hora** + toast + vincula o item.

**O que construir (Opção B — empilhado).**
- Redesenhar a caixa âmbar: aviso "Não cadastrado no catálogo" **em cima**, botão **largo embaixo** rotulado dinamicamente: **`Cadastrar "{nome}" a R$ {valor} no catálogo`** — o rótulo **é** a conferência.
- Clique → `handleCadastrarProcedimento` (inalterado). **Sem modal de confirm.**
- Nome do botão usa `stripDenteDoNome(item.descricao)` + preço atual do item.

**Arquivos & mudanças.**
- `src/app/dashboard/pacientes/[id]/_components/modals/novo-orcamento-modal.tsx` — markup da caixa âmbar (só visual + rótulo dinâmico).

**Invariantes.** Salva com nome (sem referência de dente) + valor já digitado. Tokens amber do design system (`--bg-warning`/`--text-warning`/`--border-warning`). Nenhuma lógica nova.

**Risco.** ~zero. Dedup fica **fora** (post-teste).

**Aceite.**
- [ ] Item sem catálogo mostra caixa âmbar com botão largo escrito "Cadastrar '{nome}' a R$ {valor} no catálogo".
- [ ] Clique cadastra na hora, vincula o item, some o alerta, toast de sucesso.
- [ ] Nenhum passo de confirmação extra.

---

### #10 — Marcar retorno (Opção A)

**Objetivo.** O `retorno_sugerido` é capturado e exibido, mas **inerte** — nunca vira ação, e o "volta em 30 dias" morre numa anotação. Transformar em agendamento **com um clique**, com o paciente ainda na cadeira (a jogada de retenção mais forte). Opção A escolhida: o **dentista agenda na hora** (não depende do balcão, que pode estar ocupado, longe do PC, ou não existir em consultório solo).

**O que temos.**
- `retorno_sugerido` captado pela IA (`src/app/api/dex/formatar-evolucao/route.ts:62`), editável na consulta (`consulta-client.tsx:908`), salvo na ficha (`consulta/[agendamentoId]/actions.ts:46`), e **exibido** no card ("Retorno em {retornoSugerido}", `FichasTab.tsx:1125` e `:1191`).
- `finalize-consultation-dialog.tsx:104` tem "Data de retorno (opcional)" → hoje **só é registrada nas anotações** (`:112`). Inerte.
- Modal "Nova Consulta" já existe no pai (`isNovaConsultaOpen` / `consultaForm` / `handleNovaConsulta` `:963`) → `criarAgendamento`.

**O que construir (Opção A).**
1. Botão `Agendar retorno` ao lado do "Retorno em {X}" no card (`FichasTab.tsx`) → `onAgendarRetorno(fichaId, prazo)` (callback pro pai).
2. Handler no pai: abrir o modal "Nova Consulta" **pré-preenchido** — paciente = o do perfil (já conhecido); `data` = **hoje + prazo** (parse de `retorno_sugerido`); dentista ajusta o horário → `handleNovaConsulta` → `criarAgendamento` → salva na agenda.
3. **Parse do prazo** (pt-BR): "30 dias" → +30d; "1 mês"/"1 mes" → +1 mês; "7 dias" → +7d; "15 dias" → +15d. Não parseou → default +30d (ou deixa a data em branco pro dentista escolher). **Sempre** humano confirma o slot — nunca auto-marca cego.
4. Opcional (bônus): ligar o campo "Data de retorno" do `finalize-consultation-dialog` ao mesmo gatilho (se preenchido, oferecer criar o agendamento em vez de só anotar).

**Arquivos & mudanças.**
- `FichasTab.tsx` — botão `Agendar retorno` (só quando há `retornoSugerido`) + prop `onAgendarRetorno`.
- `paciente-detail-client.tsx` — handler que pré-preenche `consultaForm` (data calculada) e abre `isNovaConsultaOpen`; util de parse de prazo.

**Invariantes.** Paciente vem da ficha (não redigitar). Data é sugestão; o dentista confirma. Reusa `criarAgendamento` (mesma validação de conflito/GCal).

**Risco.** Baixo. Cuidado só no parse de prazo (strings pt-BR variadas).

**Aceite.**
- [ ] Ficha com `retorno_sugerido` mostra `Agendar retorno`.
- [ ] Clique abre "Nova Consulta" com paciente e data (hoje + prazo) preenchidos.
- [ ] Ajustar horário e salvar cria o agendamento na agenda do dentista.
- [ ] Ficha sem `retorno_sugerido` não mostra o botão.

---

### #11 — Reordenar abas do perfil do paciente

**Objetivo.** Colocar as abas na ordem de uso; Agenda por último (menos usada). Reordenar, **não remover** (a Agenda continua carregando de verdade; remoção fica pra depois).

**O que temos.**
- Array de abas em `paciente-detail-client.tsx:1122-1125`, ordem atual:
  `Prontuário (ficha-clinica)` · `Agenda (agenda)` · `Orçamentos (orcamentos)` · `Arquivos (arquivos, id de tour 'tab-documentos')`.
- Default `activeTab = 'ficha-clinica'` (`:178`).

**O que construir.**
- Reordenar o array para: **`Prontuário · Orçamentos · Arquivos · Agenda`** (Agenda por último).
- **Micro-decisão aberta:** manter o rótulo "Arquivos" ou renomear pra "Documentos" (é a mesma aba). Default = manter "Arquivos" até confirmação; renomear é trivial se decidir.

**Arquivos & mudanças.** `paciente-detail-client.tsx:1122-1125` (só a ordem do array).

**Invariantes.** Nenhuma aba removida. Default continua Prontuário. Lazy-fetch da Agenda (`:346`) inalterado.

**Risco.** Zero.

**Aceite.**
- [ ] Ordem visível: Prontuário → Orçamentos → Arquivos → Agenda.
- [ ] Todas funcionam; Agenda carrega ao abrir.

---

## 5. Ordem de execução sugerida

1. **#11** (reorder) — 5 min, aquece.
2. **#7** (markup da caixa âmbar) — isolado, sem dependência.
3. **#5 + #6 + #10 juntos** — mesma superfície (card de ficha do `FichasTab`); fazer a barra de ações inteira de uma vez, com as callbacks pro pai (`onGerarOrcamento`, `onAgendarRetorno`) e a disposição por estado.
4. **#2** por último (o mais pesado: `criarPacienteRapido` + popup de walk-in).

## 6. Notas de execução
- **Dogfood antes da visita.** Depois de codar, **rodar o loop inteiro como dentista** (walk-in → consulta → ficha → assinar → gerar orçamento → agendar retorno) antes de mostrar pra clínica. Versão mal-dogfoodada = bug na véspera.
- **Design.** #5/#6/#7 são também polish visual ("bonito e organizado"): tokens, light/dark, hierarquia, máx. 2 botões grandes. Rodar `design-review` no card de ficha renderizado antes de subir.
- **Radar da visita (não codar):** se a clínica assinar na recepção, surge a pergunta de dono/onde da assinatura (secretária consegue coletar?). Observar no teste.
- **Verificação:** `qa-web` no fluxo clínico após implementar.

## 7. Ponteiros
- Raciocínio completo (por que cada decisão): `plans/handoffs/handoff-2026-07-06-discussao.md` + o handoff de execução desta sessão.
- Roadmap mestre: `plans/roadmap/roadmap-polimento.md` (itens #2, #5, #6, #7, #10=parte, #11).
