# Spec 3 — Protético + Marcar retorno

> **Status:** draft — aguardando aprovação do Mateus
> **Data:** 2026-07-16
> **Plano de origem:** `plans/roadmap/roadmap-3.1-2026-07-14.md` (§5, Spec 3)
> **Depende de:** Spec 1 (`2026-07-16-hierarquia-3.1-nucleo-clinico-spec.md`) — a migration 099
> precisa estar aplicada. O `is_clinic_staff()` dela é o que impede o protético de herdar o
> prontuário (invariante #10). **Não executar esta spec antes da 099 estar em prod.**
>
> **Modelo de execução:** **Sonnet** — as decisões ambíguas foram fechadas na discussão de 16/07 e
> estão congeladas aqui. Subir pra Opus só se o refactor do `NovaConsultaModal` → `MarcarRetorno`
> encostar no `paciente-detail-client.tsx` (arquivo grande, muitos estados) e sair ruim na 1ª.
>
> **Origem:** discussão de 16/07 com o Mateus, direto da observação de campo. Falas dele estão
> citadas ao longo do documento — são o contrato de produto, não decoração.

---

## 1. O que é isto, em uma frase

> **O dentista marca o retorno e, no mesmo gesto, diz ao protético o que precisa até lá.
> O protético vê o prazo e clica em pronto.**

Duas ações no sistema inteiro. *"O protético é apenas uma tabela, uma tela de agendamento — onde
ele vai poder acompanhar os horários que foram agendados e quando ele precisa entregar o trabalho
dele."*

### As duas fatias

| | O quê | Entrega valor sozinha? |
|---|---|---|
| **A** | **Marcar retorno** — renomeia o modal, mata o botão morto, tira a sugestão da IA e **conserta o bug do agendamento que some** | ✅ **Sim** — corrige um bug de produção mesmo se a Fatia B nunca acontecer |
| **B** | **Protético** — papel, tabela, ordem, tela, notificação | Depende da A (o gatilho vive no modal dela) |

**Executar A antes de B.** A Fatia A é pré-requisito e paga por si.

---

## 2. Escopo

**Cobre:**
- Fatia A: o modal de agendar do perfil vira "Marcar retorno" e ganha o campo do protético;
  remoção do botão morto da ficha; remoção de `retorno_sugerido` do schema da IA; correção do
  agendamento invisível fora do mês corrente.
- Fatia B: papel `protetico`, provisionamento, ordem de trabalho, tela do protético, e o "pronto"
  que notifica o dentista.

**NÃO cobre (registrado pra não reabrir):**
- **Painel do Dex / central de notificações** — spec própria. Esta spec **publica** em
  `notificacoes` (que já existe, 106 linhas em prod) e para por aí. **Não** conserta o problema de
  que **0 de 48 notificações de dentista foram lidas** — isso é o passo 1 da spec do painel.
- **Furo de silo em `notificacoes`** — a RLS filtra por `para_role` e **ignora `para_dentista_id`**;
  hoje um dentista vê notificação endereçada a outro. **Herdado, não criado aqui.** A spec do
  painel resolve. Registrar em §9.
- **Gestão de laboratório** — sem catálogo de peças, sem preço, sem histórico de produção.
  *"Se a clínica usar, ótimo; se não, ótimo."*
- **Encaminhar caso pro colega dentista** — o roadmap 3.1 dizia que era "o mesmo primitivo" do
  protético. **Não é mais:** com a Spec 1, o colega já lê a ficha e cria a dele. Não sobrou
  operação a construir. Ver §10.

---

## 3. Assunções

- **`dentistas` é, na prática, "membros da clínica"** — a secretária já tem registro lá com
  `role='secretaria'` (confirmado no `provision_secretaria`). O protético segue o mesmo caminho.
  **Consequência boa:** `is_clinic_staff()` (099) já o barra do prontuário sem nenhum trabalho extra.
- **O protético é seat GRÁTIS** — *"não é cobrado, mesma lógica da secretária"* (Mateus, 16/07).
  Nada de billing nesta spec.
- O texto livre é escrito pelo dentista **em português, pra um humano ler**. Sem parser, sem IA,
  sem estrutura.

---

## 4. FATIA A — Marcar retorno

### 4.1 O bug que ela conserta (confirmado por forense em 16/07)

`agendamentos/page.tsx` busca `.gte('data_hora', inicioMes).lte('data_hora', fimMes)` e, sem
`?mes=` na URL, **abre no mês atual**. Agendamento marcado pra outro mês **existe e não aparece**.

**Prova:** existe **1 agendamento em todo o banco** criado num mês pra outro — o do Mateus,
**28/04 → 14/05**, `scheduled`, **nunca tocado em 3 meses**. Ele marcou, o toast disse "Consulta
agendada", a agenda abriu em abril, e o compromisso nunca existiu pra ninguém.

**É determinístico, não aleatório:** dispara toda vez que a data cai fora do mês corrente. **Um
retorno de 30 dias cai no mês seguinte por definição** — então, com "Marcar retorno" virando o
fluxo principal, o bug deixa de ser exceção e vira regra. Por isso está nesta fatia e não na dívida.

**Descartados na investigação (verificados, todos OK):** `dentista_id` grava certo (12/12 —
não é silo) · `buildClinicDatetime` aplica `-03:00` · `status` nasce `scheduled` · a action tem
`revalidatePath`.

### 4.2 Mudanças

| # | O quê | Onde |
|---|---|---|
| A1 | **"Nova Consulta" → "Marcar retorno"** (título, descrição, botão, CTA). O paciente já está no perfil: toda consulta nova ali **é** retorno | `modals/nova-consulta-modal.tsx` → renomear arquivo p/ `marcar-retorno-modal.tsx`; `paciente-detail-client.tsx` (2 gatilhos, ~1199 e ~1627) |
| A2 | **Toast com a data + link pro mês certo** — o fix do §4.1 | `paciente-detail-client.tsx` (`handleNovaConsulta`) |
| A3 | **Remover o botão morto** "Agendar retorno" do card da ficha + a prop `onAgendarRetorno` + `agendarRetornoParaFicha` (ficam órfãos) | `FichasTab.tsx` (~1194–1210, 1275), `paciente-detail-client.tsx` (~1109, ~1467) |
| A4 | **Tirar `retorno_sugerido` do JSON Schema do Gemini** + a UI dele. **A rota FICA** — ela extrai queixa, dentes e procedimentos, que são o núcleo do modo consulta. Sai **só o campo** | `api/dex/formatar-evolucao/route.ts`, `consulta-client.tsx` (~913-917), `FichasTab.tsx` (badge) |

> **A3 + A4 juntos:** com o campo fora do schema, o badge "Retorno em 15 dias" perde a fonte e
> morre junto. Coerente: **quem decide o retorno é o dentista, sempre.** O botão foi amarrado a um
> palpite da IA — era esse o erro de conceito.
>
> **A coluna `fichas.retorno_sugerido` NÃO é dropada** — 2 fichas têm dado. Ela só deixa de ser
> escrita e lida. Dropar é irreversível e não paga.

### 4.3 Contratos — Fatia A

```ts
// modals/marcar-retorno-modal.tsx
export interface MarcarRetornoForm {
  data: string;         // yyyy-MM-dd
  hora: string;         // HH:mm
  duracao: string;      // minutos
  observacoes: string;
  /** Fatia B: o que o protético precisa fazer até a data acima. Vazio = não envia ordem. */
  ordemProtetico: string;
  /** Fatia B: null = não envia. Só aparece se a clínica tiver protético ativo. */
  proteticoId: string | null;
}

/** Resultado do agendamento — a data volta pra o toast poder falar dela (fix A2). */
export type MarcarRetornoResult =
  | { ok: true; agendamentoId: string; dataHora: string; mes: string /* 'yyyy-MM' */ }
  | { ok: false; error: string };
```

```tsx
// A2 — o toast não pode mais mentir por omissão.
// "Consulta agendada" sem a data foi tecnicamente verdade e praticamente mentira por 3 meses.
toast.success(`Retorno marcado para ${formatarDataBR(dataHora)}`, {
  action: mesDoAgendamento !== mesAtual
    ? { label: 'Ver na agenda', onClick: () => router.push(`/dashboard/agendamentos?mes=${mes}`) }
    : undefined,
});
```

---

## 5. FATIA B — Protético

### 5.1 O papel

| | |
|---|---|
| **Molde** | O da secretária (`provision_secretaria`) — **não** o do dentista, que arrasta onboarding de especialidade, foco principal e catálogo |
| **Cada um na sua** | Tabela `proteticos` própria. **`secretarias` fica intacta** — não generalizar |
| **Senha** | **Troca opcional**: `proteticos` **não tem** `must_change_password`. O guard do dashboard (`if role === 'secretaria'`) continua igual — o protético não passa por ele. **Zero refactor** |
| **Acesso** | Uma tela. Nada de prontuário |

> **Por que senha opcional (decisão do Mateus, com o trade-off na mesa):** o risco é
> **proporcional ao acesso**. A secretária vê financeiro, agenda inteira e pacientes — forçar a
> troca lá se paga. O protético vê uma lista de prazos cujo conteúdo é **o texto que o próprio
> dentista escreveu**. O admin saber a senha dele não abre nada que o admin já não tenha.
> Contraponto registrado e **descartado conscientemente**: senha criada pelo admin e nunca trocada
> tende a circular — mas o estrago possível é o mesmo de mandar a ordem por WhatsApp, que é o que
> se faz hoje.

### 5.2 Database

```sql
-- ─────────────────────────────────────────────────────────────────────
-- 100 — Protético (Spec 3, Fatia B)
-- PRÉ-REQUISITO: 099 aplicada (is_clinic_staff existe e barra papel não-clínico).
-- ─────────────────────────────────────────────────────────────────────
begin;

-- 1. O papel novo. is_clinic_staff() NÃO o inclui, de propósito (invariante #10 da Spec 1):
--    ele nasce sem ver nada do prontuário e ganha só o que esta spec conceder.
alter table public.dentistas        drop constraint if exists dentistas_role_check;
alter table public.dentistas        add  constraint dentistas_role_check
  check (role in ('admin','dentista','secretaria','protetico'));
alter table public.clinica_usuarios drop constraint if exists clinica_usuarios_role_check;
alter table public.clinica_usuarios add  constraint clinica_usuarios_role_check
  check (role in ('admin','dentista','secretaria','protetico'));
alter table public.convites         drop constraint if exists convites_role_check;
alter table public.convites         add  constraint convites_role_check
  check (role in ('dentista','secretaria','protetico'));

-- 2. Perfil. Espelha `secretarias` MENOS must_change_password (senha opcional).
create table if not exists public.proteticos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  clinica_id  uuid not null references public.clinicas(id) on delete cascade,
  nome        text not null,
  telefone    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (usuario_id, clinica_id)
);
comment on table public.proteticos is
  'Perfil do protético. Espelha `secretarias` MENOS must_change_password: a troca de senha é
   opcional porque o acesso dele é uma tela de prazos, não o prontuário (Spec 3 §5.1).';

alter table public.proteticos enable row level security;

create policy proteticos_select on public.proteticos
  for select using (belongs_to_active_clinic(clinica_id));
create policy proteticos_write_admin on public.proteticos
  for all
  using      (belongs_to_active_clinic(clinica_id) and get_my_role() = 'admin')
  with check (belongs_to_active_clinic(clinica_id) and get_my_role() = 'admin');

-- 3. A ordem de trabalho.
create table if not exists public.ordens_protetico (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinicas(id) on delete cascade,
  -- REFERENCIA o agendamento: é o que faz remarcação e cancelamento saírem de graça.
  -- NUNCA copiar a data — copiada, ela envelhece em silêncio quando a consulta se move.
  agendamento_id  uuid not null references public.agendamentos(id) on delete cascade,
  protetico_id    uuid not null references public.dentistas(id) on delete cascade,
  dentista_id     uuid not null references public.dentistas(id) on delete cascade,
  -- O contrato inteiro. O sistema não decide o que o protético vê: o dentista decide ao escrever.
  descricao       text not null check (length(trim(descricao)) > 0),
  -- 'atrasada' é só um SINAL (decisão do Mateus, 16/07: "só sinaliza"). Sem data nova, sem
  -- negociação — o protético não escreve nada em lugar nenhum. O dentista vê o sinal e liga.
  status          text not null default 'enviada'
                  check (status in ('enviada','pronta','atrasada')),
  concluida_em    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_ordens_protetico_protetico on public.ordens_protetico (protetico_id, status);
create index if not exists idx_ordens_protetico_agendamento on public.ordens_protetico (agendamento_id);
create index if not exists idx_ordens_protetico_dentista on public.ordens_protetico (dentista_id);

alter table public.ordens_protetico enable row level security;

-- O dentista autor: total sobre as dele. O protético: NÃO lê a tabela direto (usa a função §5.3).
create policy ordens_protetico_dentista on public.ordens_protetico
  for all
  using      (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

-- Só o protético endereçado altera o status — e SÓ o status (gate na action + na função §5.4).
create policy ordens_protetico_destinatario on public.ordens_protetico
  for update
  using      (belongs_to_active_clinic(clinica_id) and protetico_id = get_my_dentista_id())
  with check (belongs_to_active_clinic(clinica_id) and protetico_id = get_my_dentista_id());

commit;
```

### 5.3 A agenda do protético — função, não SELECT direto

> ⚠️ **O protético NÃO pode ler `agendamentos`.** A RLS de lá é silo estrito, e abrir a tabela pra
> ele expõe junto `observacoes` — campo livre onde o dentista escreve sobre o paciente. Isso
> furaria o princípio de que **o texto da ordem é o contrato inteiro**. Mesmo padrão do
> `paciente_tem_conflito_agenda` (099): `SECURITY DEFINER`, devolve só o necessário.

```sql
create or replace function public.listar_ordens_protetico()
  returns table (
    id             uuid,
    descricao      text,
    prazo          timestamptz,   -- vem de agendamentos.data_hora → move sozinho ao remarcar
    status         text,
    concluida_em   timestamptz
  )
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select o.id, o.descricao, a.data_hora, o.status, o.concluida_em
    from public.ordens_protetico o
    join public.agendamentos a on a.id = o.agendamento_id
   where o.protetico_id = public.get_my_dentista_id()
     and o.clinica_id   = public.get_my_clinica_id()
     -- Cancelou → some da lista dele. "Cancelou, acabou."
     and a.status not in ('cancelled','no_show')
   order by a.data_hora asc
$$;

comment on function public.listar_ordens_protetico is
  'Agenda do protético. SECURITY DEFINER de propósito: ele precisa do PRAZO (agendamentos.data_hora)
   sem poder ler `agendamentos`, que carrega `observacoes` do paciente. Devolve APENAS as 5 colunas
   acima — PROIBIDO evoluir para retornar paciente, dentista ou observações (Spec 3 §5.3).
   O prazo vem do JOIN, nunca copiado: remarcar move a data dele sozinho.';

revoke execute on function public.listar_ordens_protetico() from anon, public;
grant  execute on function public.listar_ordens_protetico() to authenticated;
```

### 5.4 Contratos — Fatia B

```ts
// src/types/protetico.ts

/** O que o protético vê. Deliberadamente sem paciente, sem dentista, sem observações. */
export interface OrdemProtetico {
  id: string;
  descricao: string;
  prazo: string;                       // ISO — data_hora do agendamento
  /** 'atrasada' é só um sinal — sem data nova. O protético não escreve nada. */
  status: 'enviada' | 'pronta' | 'atrasada';
  concluidaEm: string | null;
}

export interface EnviarOrdemInput {
  agendamentoId: string;
  proteticoId: string;
  descricao: string;                   // texto livre, obrigatório
}

export type OrdemResult = { ok: true; id: string } | { ok: false; error: string };
```

| Action | Arquivo | Regra |
|---|---|---|
| `enviarOrdemProtetico` | `dashboard/pacientes/[id]/protetico-actions.ts` | Chamada junto do `criarAgendamento` da Fatia A, com o `agendamentoId` retornado. `dentistaId` **explícito** (invariante #7 da Spec 1). Valida que `proteticoId` é protético **ativo da clínica** |
| `marcarOrdemPronta` | idem | Só o destinatário. `status='pronta'`, `concluida_em=now()`. **Notifica o dentista** (§5.5) |
| `marcarOrdemAtrasada` | idem | Só o destinatário. `status='atrasada'` e **nada mais** — sem data, sem texto, sem argumento além do `ordemId`. **Notifica o dentista** |

> **Todas as três usam `.select()` e conferem se a linha voltou** — UPDATE barrado por RLS não
> retorna erro no Supabase (invariante #9 da Spec 1). Nenhuma tela afirma o que o banco negou.

### 5.5 A notificação — o keystone

`notificacoes` já existe e já tem a forma certa. Só entram dois tipos novos:

```ts
// src/lib/notificacoes.ts — adicionar ao union existente
export type TipoNotificacao =
  | ...
  // Operacional — protético → dentista
  | 'ordem_protetico_pronta'
  | 'ordem_protetico_atrasada';
```

```ts
await inserirNotificacao(supabase, {
  clinicaId,
  paraRole: 'dentista',
  paraDentistaId: ordem.dentista_id,   // o autor da ordem
  deDentistaId: proteticoId,
  tipo: 'ordem_protetico_pronta',
  titulo: 'Trabalho pronto',
  mensagem: `${proteticoNome}: ${truncar(ordem.descricao, 60)}`,
  href: `/dashboard/agendamentos?mes=${mesDoAgendamento}`,  // leva pro mês certo (lição da Fatia A)
});
```

> ⚠️ **Realidade a encarar:** **0 de 48 notificações de dentista foram lidas** em produção (35
> agendamento criado, 10 pagamento confirmado, 3 cancelamento). A secretária lê ~1/3 das dela.
> **O keystone desta spec depende de um canal que hoje o dentista não vê.** Esta spec publica na
> tabela — não conserta o canal. Se o painel do Dex não resolver isso, o "pronto" vira a 4ª
> notificação que ninguém lê. **Não é motivo pra travar a Spec 3**, mas é motivo pra o painel vir
> logo depois.

### 5.6 A tela do protético

*"A tela dele eu acredito que tem que ser bem básica: uma agenda e também uma forma dele marcar
que está entregue/concluído."*

```
/protetico  (rota nova, fora de /dashboard — o dashboard é do staff clínico)
  └─ ProteticoAgendaPage        ← Server Component: chama listar_ordens_protetico()
       └─ OrdensList            ← Client: os 2 botões
```

| Item | Regra |
|---|---|
| **Layout** | Lista cronológica por prazo. Sem abas, sem filtro, sem busca. `design-brief` **não** é necessário — não é tela de marca, é utilitária; usar tokens do design system |
| **Cada ordem** | O texto livre (protagonista) + o prazo + o status |
| **Urgência** | Prazo hoje/amanhã em destaque; vencido em vermelho. Tokens, nunca cor hardcoded |
| **Ações** | `Pronto` (fluxo normal) · `Vai atrasar` — **um clique, sem formulário**: ele não digita data nem texto |
| **Depois de pronta** | Ordem sai do topo, com `concluida_em`. Não some — ele confere o que entregou |
| **Guard** | `role === 'protetico'` → só `/protetico`. Qualquer outra rota do dashboard redireciona pra cá. Um dentista/secretária que abrir `/protetico` vai pro `/dashboard` |

---

## 6. Invariantes

- [ ] **#1 — O texto da ordem é o contrato inteiro.** O protético vê `{descricao, prazo, status}`
      e **nada mais**. Nunca paciente, nunca dentista, nunca `observacoes` do agendamento. É
      **proibido** evoluir `listar_ordens_protetico` pra retornar mais. Quem decide o que ele vê é
      o dentista, ao escrever.
- [ ] **#7 — O protético não escreve, só sinaliza.** As duas ações dele são cliques sem
      formulário: `pronto` e `vai atrasar`. Ele **não digita data, não digita texto, não negocia
      prazo**. Adicionar campo pra ele preencher exige decisão explícita registrada — foi
      descartado em 16/07 de propósito.
- [ ] **#2 — Protético não é `is_clinic_staff()`.** Ele não entra no helper da 099 e portanto não
      lê ficha, paciente, planejamento, documento nem tratamento. Adicionar o papel lá exigiria
      decisão explícita registrada — e não há motivo pra isso existir.
- [ ] **#3 — O prazo vem do JOIN, nunca copiado.** `ordens_protetico` guarda `agendamento_id`, não
      data. Remarcar move o prazo sozinho; cancelar tira da lista. Copiar a data reintroduz a
      classe de bug que esta spec existe pra evitar.
- [ ] **#4 — Nenhuma tela afirma o que o banco negou.** Toda ação confirma com `.select()` e
      reverte se não voltou linha (invariante #9 da Spec 1).
- [ ] **#5 — Toast de agendamento sempre diz a data.** Nunca mais um "Consulta agendada" mudo: foi
      exatamente isso que escondeu um compromisso por 3 meses.
- [ ] **#6 — A ordem nasce com `dentista_id` explícito** (invariante #7 da Spec 1) — nunca deixar
      o registro se prender ao perfil de quem chamou.

---

## 7. Gates de aceite

**Fatia A**
- [ ] O modal do perfil se chama "Marcar retorno" nos 2 gatilhos.
- [ ] Marcar um retorno para **o mês seguinte** → o toast diz a data **e** oferece "Ver na agenda";
      clicar leva pra `/dashboard/agendamentos?mes=YYYY-MM` **com o agendamento visível**.
      *(É o caso 28/04 → 14/05 que ficou invisível 3 meses.)*
- [ ] Marcar dentro do mês corrente → toast com a data, **sem** o link (não há pra onde ir).
- [ ] Nenhuma ficha mostra "Agendar retorno"; `grep -r "onAgendarRetorno" src/` → **0 resultados**.
- [ ] `grep -r "retorno_sugerido" src/` → **0 resultados** (a coluna fica no banco, o código não a usa).
- [ ] O modo consulta continua extraindo queixa, dentes e procedimentos — só o campo de retorno sumiu.

**Fatia B**
- [ ] Admin convida um protético; ele loga **sem** passar por `/primeiro-acesso`.
- [ ] Logado como protético: `/protetico` lista as ordens dele. `/dashboard/*` redireciona pra `/protetico`.
- [ ] Logado como protético: `select * from fichas` → **0 linhas**. Idem `pacientes`, `orcamentos`,
      `agendamentos`, `planejamento_*`, `paciente_documentos`, `tratamentos`. **(invariante #2)**
- [ ] `listar_ordens_protetico()` devolve **5 colunas** — sem paciente, sem dentista, sem observações.
- [ ] Protético clica "Vai atrasar" → **nenhum formulário abre**; o status vira `atrasada` e o
      dentista é notificado. **(invariante #7)**
- [ ] Marcar retorno + enviar ordem → ela aparece na tela do protético com o prazo certo.
- [ ] **Remarcar a consulta de 20 pra 27 → o prazo do protético vira 27 sozinho**, sem nenhuma ação.
- [ ] **Cancelar a consulta → a ordem some da lista dele.**
- [ ] Protético clica "Pronto" → o dentista recebe notificação em `notificacoes` com
      `para_dentista_id` = o autor.
- [ ] Protético A tenta marcar pronta a ordem do protético B → **0 linhas afetadas**, e a UI reverte.
- [ ] `npm run typecheck` + `lint` + `build` limpos, sem regressão nos 24 eslint pré-existentes.

---

## 8. Ordem de execução

1. **Fatia A inteira** (A1–A4) — independente, conserta o bug de produção, entrega valor sozinha.
2. Migration **100** — ⚠️ prod = dev, exige confirmação explícita do Mateus nomeando projeto + ação.
3. Provisionamento (`provision_protetico`) + guard de rota.
4. Ordem: actions + campo no modal da Fatia A.
5. Tela `/protetico`.
6. Notificação (`ordem_protetico_pronta` / `_atrasada`).
7. Auditoria: `typescript-reviewer` + `ux-reviewer` antes do commit.

---

## 9. Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| **O keystone não chega:** o "pronto" vira a 4ª notificação que o dentista não vê (**0/48 lidas hoje**) | **alta** | Fora do escopo aqui; é o passo 1 da spec do painel do Dex. **Se o painel demorar, o valor da Fatia B fica pela metade** |
| **Furo herdado:** RLS de `notificacoes` filtra por `para_role` e **ignora `para_dentista_id`** — o dentista B vê a notificação do A | média | **Não criado aqui** (35 notificações já sofrem disso). A spec do painel resolve. Não piora com esta spec |
| Renomear "Nova Consulta" perde o caso "agendar consulta que não é retorno" | baixa | O paciente já está no perfil: toda consulta ali **é** retorno. Se aparecer caso real, o nome volta — é uma string |
| Adicionar `'protetico'` ao CHECK quebra código que assume 3 papéis | média | `grep -rn "'secretaria'\|'dentista'\|'admin'" src/` antes de mexer; `is_clinic_staff()` e `is_own_clinical_record()` já tratam papel desconhecido como `false` (fail-safe) |
| Protético externo com senha nunca trocada | baixa | Aceito conscientemente (§5.1) — o acesso dele é uma lista de prazos cujo texto o dentista escolheu |

---

## 10. O que morreu do plano original (registrar)

**"Encaminhar caso pro colega" e "mandar pro protético" NÃO são mais o mesmo primitivo.** O
roadmap 3.1 (14/07) chamava a unificação de "a melhor sacada da sessão" e mandava protegê-la.

Ela morreu — e por um bom motivo. Com a **Spec 1**, o colega **já lê a ficha** e **já cria a dele**.
Encaminhar virou uma conversa (*"olha o 26 do José"*), não uma operação de sistema. Não sobrou nada
pra construir do lado do dentista → não há o que unificar. **Sobrou só o protético**, que é o único
que precisa de fato de um objeto novo — porque ele não tem acesso a nada e o trabalho dele tem prazo.

Mesmo padrão da Spec 2, que morreu pelo mesmo tipo de razão: **a arquitetura entregou de graça o
que o plano queria construir como feature.**
