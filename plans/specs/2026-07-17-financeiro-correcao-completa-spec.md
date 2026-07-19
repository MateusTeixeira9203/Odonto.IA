# Spec: Correção completa do fluxo Financeiro / Orçamentos

> **Status:** draft
> **Data:** 2026-07-17
> **Modelo de execução:** Sonnet 5 (execução contra contrato); Opus para decisões de regra de negócio se surgirem
> **Origem:** QA ao vivo em produção (dentia.app.br) + auditoria de código e banco, sessão 2026-07-17
> **Plano de origem:** plans/roadmap/roadmap-3.1-2026-07-14.md

## Escopo

Cobre a correção de ponta a ponta do dinheiro no sistema — orçamento, pagamento, financeiro — nas três camadas (UI, código, banco), mais a deduplicação de pacientes que motivou a revisão.

**Cobre:**
- Frente 1 — Embeds ambíguos de `dentistas` + erros de query engolidos silenciosamente
- Frente 2 — Recebível fantasma (pendente auto-criada na aprovação que nunca é abatida)
- Frente 3 — Receita contando pagamento de orçamento recusado
- Frente 4 — `registrarRecebimento`: dupla gravação + `dentista_id` NULL
- Frente 5 — Pacientes duplicados: mesclar existentes + trava anti-duplicata
- Frente 6 — Higiene: dado de teste em produção, fuso horário na janela do mês

**NÃO cobre:**
- Redesenho visual das telas (só correções pontuais de UI que decorrem das frentes)
- WhatsApp / cobrança automática / gateway de pagamento (AbacatePay)
- Relatórios financeiros novos (DRE, fluxo de caixa projetado)
- O modelo de planos/hierarquia (migration 099) — trilha separada

## Assunções

- Produção = o commit `ca1b4a4` (deploy atual) e o banco Supabase `zenfemoxvwerplrjgfqz`. Migration 099 **não** está aplicada; nada nesta spec depende dela.
- `pagamentos` guarda tanto realizado (`status='pago'`) quanto agendado (`status='pendente'`); `receitas_manuais` é entrada avulsa sem orçamento.
- Toda linha de `pagamentos` pertence a um `orcamento_id` (NOT NULL). Não há pagamento "solto".
- Vercel roda em UTC; clínicas operam em BRT (UTC-3).
- A regra de negócio da Frente 2 (recebível calculado, não materializado) foi decidida nesta spec — o usuário revisa aqui.

---

## Frente 1 — Embeds ambíguos + erros de query silenciosos

### Causa raiz

A migration `067` (28/05) adicionou `orcamentos.aprovado_por_id → dentistas(id)`. A partir daí, `orcamentos` tem **2 FKs** para `dentistas` (`dentista_id`, `aprovado_por_id`). Um embed PostgREST sem qualificar a FK (`dentista:dentistas(...)`) vira ambíguo e o Supabase responde **HTTP 300 / `PGRST201`** — sem linha nenhuma.

Como o código faz `const { data } = await supabase...` **sem checar `error`**, `data` vira `null`, `null ?? []` vira lista vazia, e a tela mostra "vazio" em vez de estourar. Bug invisível há ~2 meses.

**Tabelas com 2+ FKs para `dentistas`** (todo embed sem qualificação nelas é ambíguo):

| Tabela | FKs para dentistas |
|--------|--------------------|
| `orcamentos` | `dentista_id`, `aprovado_por_id` |
| `agendamentos` | `dentista_id`, `created_by` |
| `pagamentos` | `dentista_id`, `marcado_por_id` |
| `notificacoes` | `de_dentista_id`, `para_dentista_id` |

### Pontos quebrados confirmados (reproduzidos em prod)

| # | Arquivo:linha | Sintoma |
|---|---------------|---------|
| 1 | [orcamentos/page.tsx:64](src/app/dashboard/orcamentos/page.tsx:64) | Tela **Orçamentos** sempre "Nenhum orçamento encontrado" (todos os papéis) |
| 2 | [api/orcamentos/[id]/pdf/route.ts:21](src/app/api/orcamentos/[id]/pdf/route.ts:21) | Download de PDF de orçamento devolve **404** sempre |
| 3 | [get-visible-timeline-events.ts:75](src/server/patients/get-visible-timeline-events.ts:75) | Eventos de **orçamento** somem da timeline do paciente |
| 4 | [get-visible-timeline-events.ts:66](src/server/patients/get-visible-timeline-events.ts:66) | Eventos de **agendamento** somem da timeline (agendamentos tem 2 FKs) |
| 5 | [paciente-detail-client.tsx:363](src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx:363) | Aba **Agenda** do perfil do paciente carrega vazia/erro |

### Correção

1. **Desambiguar todo embed** nas 4 tabelas acima: trocar `dentista:dentistas(...)` por `dentista:dentistas!{tabela}_dentista_id_fkey(...)` (dono) — e usar a FK correta quando o intuito for outro papel.
2. **Auditar 100% dos `.select()`** que embedam `dentistas` nessas tabelas (grep obrigatório no gate) — não confiar só nos 5 achados.
3. **Parar de engolir erro de query** nos caminhos de leitura financeiros/paciente: onde hoje é `const { data } = await...`, passar a checar `error` e (a) logar via `console.error` com contexto e (b) propagar/renderizar estado de erro em vez de "vazio" silencioso.

### Contrato de leitura (helper)

```typescript
// src/lib/supabase/assert.ts — novo
// Uso nos caminhos críticos: transforma erro-silencioso em erro visível.
export function unwrap<T>(
  res: { data: T | null; error: { message: string; code?: string } | null },
  ctx: string,
): T {
  if (res.error) {
    console.error(`[query] ${ctx}: ${res.error.code ?? ''} ${res.error.message}`);
    throw new Error(`Falha ao carregar ${ctx}`);
  }
  return res.data as T;
}
```

> Aplicar `unwrap` (ou checagem explícita de `error`) nas queries de: `orcamentos/page.tsx`, `financeiro/page.tsx` + `financeiro/actions.ts`, `get-visible-timeline-events.ts`, `get-patient-workspace-data.ts`, e a rota de PDF. **Não** é obrigatório reescrever o app inteiro nesta spec — só o fluxo financeiro/paciente.

---

## Frente 2 — Recebível fantasma (pendente materializada)

### Causa raiz

Ao aprovar um orçamento, [orcamentos/actions.ts:91-110](src/app/dashboard/orcamentos/actions.ts:91) cria automaticamente **uma linha `pendente` no valor total**. Quando o pagamento real é registrado (`registrarPagamento`), ele **insere uma linha `pago` nova e não abate a pendente**. Resultado: `pago + pendente > total`; o "a receber" fica inflado e o orçamento nunca aparece como quitado.

Reproduzido em prod (clínica QA): total R$1.000 → pendente R$1.000 (auto) + pago R$400 = R$1.400 de exposição. Presente nos dados reais da Clindent (ex.: "Vicente Vass" duplicado no extrato e na Receita Prevista).

### Decisão de modelo (aprovada 2026-07-17)

Dois eixos **ortogonais**, nunca fundidos num só enum:

- **Ciclo** (`orcamentos.status`): `rascunho → enviado → aprovado / recusado`. Mudado **à mão** pela pessoa. É a proposta.
- **Pagamento** (`orcamentos.situacao_pagamento` + `pago_total`): `nao_pago | parcial | quitado`. **Nunca escrito pela app** — mantido por **trigger** que deriva dos `pagamentos` reais. É o dinheiro.

> **Por que o pagamento vira coluna, mas mantida por trigger:** o usuário quer o status de pagamento no banco (filtrar, ordenar, relatório). O risco de guardar status era ele divergir dos pagamentos reais — que é a origem deste bug. A trava: a coluna é **derivada e mantida pelo próprio banco** a cada mudança em `pagamentos`; nenhum caminho de tela a escreve. Os pagamentos continuam sendo a **fonte única da verdade**; a coluna só os espelha. Queryabilidade sem drift.

Regras que decorrem:
- Aprovar um orçamento **não cria mais** nenhuma linha em `pagamentos` (fim do recebível fantasma).
- Linhas `pendente` em `pagamentos` significam **apenas parcela agendada real** — criadas por `gerarParcelas` ou `registrarPagamento` com `data_vencimento` futura. Toda pendente tem `data_vencimento NOT NULL`.
- `pago_total` e `situacao_pagamento` são **sempre** `f(pagamentos)`, computados pelo trigger — nunca setados por Server Action.

### Situação única (o que a clínica vê) + rótulos novos

A UI mostra **uma** Situação, combinando os dois eixos. Rótulos renomeados (só o texto exibido muda; os valores no banco continuam `enviado`/`recusado`):

| Situação exibida | Regra |
|---|---|
| Rascunho | ciclo = `rascunho` |
| **Aguardando aprovação** | ciclo = `enviado` (era "Enviado") |
| **Negado** | ciclo = `recusado` (era "Recusado") |
| A receber | ciclo = `aprovado` **e** `situacao_pagamento ≠ 'quitado'` |
| Quitado | ciclo = `aprovado` **e** `situacao_pagamento = 'quitado'` |

Aplicar a Situação derivada de forma consistente: coluna "Status" da lista de Orçamentos, cabeçalho do detalhe, filtros rápidos e métricas do dashboard. O seletor de ciclo (rascunho/enviado/aprovado/recusado) que a pessoa muda à mão continua existindo — mas "pago/quitado" **não** é opção clicável ali (é automático).

### Schema + trigger (fonte única = pagamentos)

```sql
-- orcamentos: dois campos mantidos SÓ pelo trigger, nunca pela app
alter table orcamentos add column if not exists pago_total numeric(10,2) not null default 0;
alter table orcamentos add column if not exists situacao_pagamento text not null default 'nao_pago'
  check (situacao_pagamento in ('nao_pago','parcial','quitado'));

create index if not exists idx_orcamentos_situacao_pagamento
  on orcamentos (clinica_id, situacao_pagamento);

-- Recalcula pago_total + situacao_pagamento de UM orçamento a partir dos pagamentos pagos.
create or replace function public.recalc_orcamento_pagamento(p_orcamento_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_pago numeric(10,2); v_total numeric(10,2); v_sit text;
begin
  select coalesce(sum(valor),0) into v_pago
    from pagamentos where orcamento_id = p_orcamento_id and status = 'pago';
  select coalesce(total,0) into v_total from orcamentos where id = p_orcamento_id;
  v_sit := case
    when v_pago <= 0            then 'nao_pago'
    when v_pago >= v_total      then 'quitado'
    else 'parcial' end;
  update orcamentos set pago_total = v_pago, situacao_pagamento = v_sit
   where id = p_orcamento_id;
end $$;

-- Dispara em qualquer mudança de pagamentos (e cobre troca de orcamento_id no UPDATE).
create or replace function public.trg_recalc_orcamento_pagamento()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalc_orcamento_pagamento(old.orcamento_id);
    return old;
  end if;
  perform public.recalc_orcamento_pagamento(new.orcamento_id);
  if tg_op = 'UPDATE' and new.orcamento_id is distinct from old.orcamento_id then
    perform public.recalc_orcamento_pagamento(old.orcamento_id);
  end if;
  return new;
end $$;

drop trigger if exists pagamentos_recalc_orcamento on pagamentos;
create trigger pagamentos_recalc_orcamento
  after insert or update or delete on pagamentos
  for each row execute function public.trg_recalc_orcamento_pagamento();

-- editarOrcamento muda o total → precisa recomputar a situação também.
-- (trigger análogo em orcamentos AFTER UPDATE OF total, ou chamar recalc na action de edição)
```

> **Backfill obrigatório** na mesma migration (sob confirmação): rodar `recalc_orcamento_pagamento` para todos os orçamentos existentes, pra `pago_total`/`situacao_pagamento` nascerem coerentes com o histórico.

### Alterações de código

| Arquivo | Mudança |
|---------|---------|
| **migration nova** | `pago_total` + `situacao_pagamento` + função `recalc` + trigger em `pagamentos` + backfill (bloco SQL acima) |
| `orcamentos/actions.ts` `atualizarStatusOrcamento` | Remover o bloco que insere pendente-total ao aprovar (linhas 91-110) |
| `orcamentos/actions.ts` `editarOrcamento` | Após mudar `total`, chamar `recalc_orcamento_pagamento` (o total mudou, a situação pode mudar) |
| `orcamentos/actions.ts` `marcar/registrar/excluir pagamento` | **Nada a fazer** — o trigger recalcula sozinho. Remover qualquer set manual de situação se existir |
| `lib/constants/orcamento-status.ts` | Renomear rótulos: `enviado → "Aguardando aprovação"`, `recusado → "Negado"`. Valores no banco intocados |
| `lib/orcamento-situacao.ts` (novo) | Helper puro `situacaoOrcamento(status, situacao_pagamento) → { key, label, cls }` — fonte única da Situação exibida |
| `orcamentos/page.tsx` + `orcamentos-client.tsx` | Coluna "Status" e filtros passam a usar a Situação derivada; `orcamentos` já traz `situacao_pagamento`/`pago_total` |
| `financeiro/actions.ts` `listarPagamentosPendentes` | Reescrever: retorna, por orçamento **aprovado** com `situacao_pagamento ≠ 'quitado'`, o saldo (`total − pago_total`) — não linhas cruas de `pendente` |
| `financeiro/_components/financeiro-client.tsx` | "Receita Prevista" consome o novo shape |
| `detalhe-orcamento-modal.tsx` | `restante`/`pctPago`/`quitado` passam a ler `pago_total`/`situacao_pagamento` do orçamento (coerente, sem recomputar do array) |

### Tipos

```typescript
// types de domínio — orcamentos ganha os 2 campos mantidos por trigger
export interface Orcamento {
  // ...campos existentes...
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';   // ciclo (à mão)
  total: number;
  pago_total: number;                                         // ← trigger
  situacao_pagamento: 'nao_pago' | 'parcial' | 'quitado';     // ← trigger
}

// Situação única exibida (derivada — nunca persistida)
export type SituacaoKey =
  | 'rascunho' | 'aguardando_aprovacao' | 'negado' | 'a_receber' | 'quitado';

export interface Situacao {
  key: SituacaoKey;
  label: string;   // "Aguardando aprovação", "A receber", "Quitado", ...
  cls: string;     // classes de cor do design system
}

// lib/orcamento-situacao.ts — fonte única
export function situacaoOrcamento(
  status: Orcamento['status'],
  situacaoPagamento: Orcamento['situacao_pagamento'],
): Situacao;

// financeiro/actions.ts — substitui PagamentoPendente
export interface OrcamentoAReceber {
  orcamento_id: string;
  paciente_id: string;
  paciente_nome: string;
  dentista_id: string;
  total: number;
  pago: number;                       // = pago_total
  saldo: number;                      // total − pago_total, sempre > 0 nesta lista
  proximo_vencimento: string | null;  // menor data_vencimento de parcela pendente, se houver
}
```

### Migração de dados (limpeza das pendentes fantasma existentes)

Apagar as linhas `pendente` que são recebível fantasma: pendentes **sem `data_vencimento`** (as auto-criadas na aprovação nasciam com `data_vencimento = null`). Parcelas reais têm `data_vencimento` e `parcela_numero` — essas ficam.

```sql
-- Só remove pendentes sem vencimento (auto-criadas na aprovação), preservando parcelas agendadas.
delete from pagamentos
 where status = 'pendente'
   and data_vencimento is null
   and parcela_numero is null;
```

> **Requer confirmação explícita do usuário antes de rodar em prod** (regra da casa: DB write confirmado). A spec só declara a query; a execução é um gate separado.

---

## Frente 3 — Pagamento de orçamento recusado conta como receita

### Causa raiz

O cálculo de receita (`calcularSaldoMes`, `listarPagamentosPagos`, `listarUltimosMeses`, `listarUltimos7Dias`) soma `pagamentos.status='pago'` **sem olhar o status do orçamento pai**. Um orçamento `recusado` com pagamento `pago` ainda entra na receita. Achado real: orçamento recusado na Império com R$105k "pago" (valor é sujeira de teste, mecanismo é real).

### Decisão

1. **Bloquear no ato:** `atualizarStatusOrcamento(id, 'recusado')` deve **falhar** se o orçamento tiver algum pagamento `pago` (mesma proteção que `excluirOrcamento` já tem para exclusão). Mensagem: _"Este orçamento tem pagamentos registrados. Estorne os pagamentos antes de recusar."_
2. **Blindar o cálculo:** receita realizada conta apenas pagamentos cujo orçamento **não** esteja `recusado`. Join obrigatório com `orcamentos.status`.

> Rascunho/enviado com pagamento pago continuam contando como receita (o dinheiro entrou) — `registrarPagamento` já auto-aprova quando quita. O alvo é só `recusado`.

### Alteração

Adicionar filtro `orcamentos.status != 'recusado'` (via join ou subquery) em toda soma de receita realizada no `financeiro/actions.ts`.

---

## Frente 4 — `registrarRecebimento`: dupla gravação + dentista NULL

### Causa raiz

[financeiro/actions.ts:693-751](src/app/dashboard/financeiro/actions.ts:693) (botão "Registrar Recebimento" da secretária no Financeiro):
1. Insere em `pagamentos` **sem `dentista_id`** → nasce NULL → some da visão do dentista dono (filtro `.eq('dentista_id', …)`).
2. Insere **também** em `receitas_manuais` → o mesmo dinheiro é contado 2× no saldo da secretária (`calcularSaldoMes` soma `pagamentos.pago + receitas_manuais`).

Latente: 0 uso em prod hoje. Consertar antes que alguém clique.

### Correção

Reescrever `registrarRecebimento` para ser idêntico a `registrarPagamento` no efeito:
- Inserir **só** em `pagamentos`, **com `dentista_id`** (do orçamento alvo).
- **Remover** o insert em `receitas_manuais`.
- Reaproveitar a lógica de auto-aprovação de orçamento `enviado` quitado.

```typescript
export async function registrarRecebimento(dados: {
  pacienteId: string;
  orcamentoId: string;
  valor: number;
  formaPagamento: FormaRecebimento;
  data: string;
  dentistaId: string;        // passa a ser OBRIGATÓRIO (vem do orçamento)
}): Promise<{ error?: string; id?: string }>;
```

> Alternativa a avaliar na execução: se `registrarPagamento` já cobre 100% do caso, **deletar** `registrarRecebimento` e apontar o botão para ela (YAGNI). Decidir ao implementar.

---

## Frente 5 — Pacientes duplicados

### Causa raiz

[pacientes/[id]/actions.ts:190](src/app/dashboard/pacientes/[id]/actions.ts:190) `criarPacienteRapido` (cadastro walk-in / novo agendamento) insere **sem checar** se já existe paciente com mesmo nome+telefone na clínica. Toda duplicata nasce "uma cheia + uma vazia".

Estado atual (Clindent, 3 casos, criados 13-15/07):

| Nome | Caso |
|------|------|
| Márcio Rodrigues de Almeida | mesmo telefone; um tem orçamento+ficha+agenda+2 pagamentos, outro vazio → **mesclar** |
| Jessica Souza Almeida Queiroz | mesmo dentista; um tem ficha+agenda, outro tem telefone+nascimento → **mesclar** |
| "Mateus" | dois dentistas diferentes, sem CPF/telefone → **provável dado de teste, confirmar antes de apagar** |

### Correção — prevenção (código)

Em `criarPacienteRapido` e `createPaciente`: antes de inserir, buscar paciente ativo na clínica com **mesmo telefone** (quando informado) ou **mesmo nome normalizado**. Se houver:
- Retornar `{ duplicataDe: { id, nome } }` para a UI oferecer "usar existente" vs "criar mesmo assim".
- Nunca bloquear de forma dura (homônimos reais existem) — é um **aviso com escolha**, não erro.

```typescript
export interface CriarPacienteResult {
  id?: string;
  error?: string;
  duplicata?: { id: string; nome: string; telefone: string | null };
}
```

### Correção — mesclagem (dados)

Procedimento de merge (registro **destino** = o que tem mais dados/histórico):

```sql
-- Reatribui todo filho do paciente ORIGEM para o DESTINO, depois apaga a ORIGEM.
-- Rodar por par (origem, destino), dentro de transação, com confirmação humana por caso.
update fichas        set paciente_id = :destino where paciente_id = :origem;
update orcamentos    set paciente_id = :destino where paciente_id = :origem;
update agendamentos  set paciente_id = :destino where paciente_id = :origem;
update pagamentos    set paciente_id = :destino where paciente_id = :origem;
update tratamentos   set paciente_id = :destino where paciente_id = :origem;
update paciente_documentos set paciente_id = :destino where paciente_id = :origem;
-- (auditar toda tabela com paciente_id antes de rodar)
delete from pacientes where id = :origem;
```

> **Cada merge exige confirmação do usuário** (dado clínico real). "Mateus" só é apagado após o usuário confirmar que é teste.

---

## Frente 6 — Higiene

- **Fuso na janela do mês:** [financeiro/actions.ts:100](src/app/dashboard/financeiro/actions.ts:100) `mesWindow` usa `toISOString()` (UTC). Pagamento lançado à noite em BRT pode cair no mês seguinte. Severidade baixa. Corrigir usando data local ou fixando o offset BRT no cálculo da janela. **Fora do caminho crítico — pode ficar por último.**
- **Dado de teste em prod:** o lançamento de R$104.999,99 no orçamento recusado da Império suja relatórios. Listar e remover sob confirmação.

---

## Invariantes

- [ ] **I1** — Nenhuma query de leitura no fluxo financeiro/paciente engole `error`: erro de query nunca vira lista vazia silenciosa.
- [ ] **I2** — Todo embed de `dentistas` em tabela com 2+ FKs é qualificado com o nome da constraint.
- [ ] **I3** — Para qualquer orçamento: `Σ pago + Σ pendente_agendada ≤ total`. Nunca existe "a receber" além do saldo.
- [ ] **I4** — "A receber" de um orçamento é sempre `max(0, total − pago_total)`. Não há linha de pagamento representando o total inteiro.
- [ ] **I10** — `orcamentos.pago_total` e `orcamentos.situacao_pagamento` são **sempre** iguais a `f(pagamentos pagos)`. Nenhum caminho de app os escreve; só o trigger. Setar à mão é violação.
- [ ] **I11** — A Situação exibida vem **exclusivamente** de `situacaoOrcamento()` (ciclo + `situacao_pagamento`). Nenhuma tela deriva "pago/quitado" por conta própria.
- [ ] **I5** — Receita realizada nunca inclui pagamento de orçamento `recusado`.
- [ ] **I6** — Todo `pagamentos` criado pela secretária nasce com `dentista_id` do dentista dono do orçamento (nunca NULL, nunca o id da secretária).
- [ ] **I7** — Um recebimento gera **uma** linha de receita (em `pagamentos` **ou** `receitas_manuais`, nunca nas duas).
- [ ] **I8** — Merge de paciente preserva 100% dos filhos (ficha, orçamento, agenda, pagamento, tratamento, documento); zero órfão.
- [ ] **I9** — O split "secretária vê tudo da clínica / dentista vê só o seu" continua íntegro após as mudanças (não regredir o que já funciona).

## Gates de aceite (QA — verificáveis)

Rodados via Playwright contra prod (contas QA) + queries de banco:

- [ ] **G1** — Secretária, dentista e admin abrem `/dashboard/orcamentos` e **veem a lista** dos orçamentos da clínica (não "0 de 0").
- [ ] **G2** — Download de PDF de um orçamento retorna **200 + HTML**, não 404.
- [ ] **G3** — Timeline do paciente mostra eventos de **orçamento e agendamento**.
- [ ] **G4** — `grep` não encontra nenhum `dentista:dentistas(` sem `!` em query sobre orcamentos/agendamentos/pagamentos/notificacoes.
- [ ] **G5** — Aprovar um orçamento **não cria** linha em `pagamentos` (count == 0 após aprovar); `situacao_pagamento = 'nao_pago'`, Situação exibida = **"A receber"**.
- [ ] **G6** — Aprovar (total 1000) → registrar pago 400 → banco: `pago_total = 400`, `situacao_pagamento = 'parcial'`; tela: "A receber R$600", "40% pago"; `Σ pago + pendente ≤ total`.
- [ ] **G7** — Pagar o restante → banco: `situacao_pagamento = 'quitado'` (via trigger, sem código setar); tela mostra **"Quitado"**, "a receber R$0", não some da lista.
- [ ] **G7b** — Excluir um pagamento pago volta `situacao_pagamento` pra `parcial`/`nao_pago` automaticamente (trigger no DELETE).
- [ ] **G7c** — Rótulos: `enviado` aparece como **"Aguardando aprovação"**, `recusado` como **"Negado"**, em lista, detalhe e filtros.
- [ ] **G8** — Recusar um orçamento com pagamento pago **falha** com mensagem clara; recusar sem pagamento funciona.
- [ ] **G9** — Receita do mês **não** conta pagamento de orçamento recusado.
- [ ] **G10** — Recebimento registrado pela secretária: aparece no Financeiro **dela e do dentista dono**; conta **uma** vez no saldo (não dobrado); `dentista_id` preenchido no banco.
- [ ] **G11** — Cadastrar paciente com telefone já existente na clínica → UI **avisa** e oferece usar o existente.
- [ ] **G12** — Após merge dos 3 casos: `select nome, count(*) ... having count(*)>1` retorna vazio; nenhum filho órfão.
- [ ] **G13** — Regressão: valores por dentista no Financeiro continuam batendo com o total da clínica (split íntegro).

## Ordem de execução sugerida

1. **Frente 1** (destrava as telas — maior impacto, menor risco) → G1–G4
2. **Frente 4** (isolada, latente) → G10
3. **Frente 2** (regra de negócio + migração de dados sob confirmação) → G5–G7
4. **Frente 3** → G8, G9
5. **Frente 5** (prevenção no código; merge de dados sob confirmação caso a caso) → G11, G12
6. **Frente 6** (higiene) — por último

> Cada migração de dados (Frentes 2, 5, 6) é um **gate de confirmação separado** — nada de escrita em prod sem "ok" explícito, mesmo com esta spec aprovada.
