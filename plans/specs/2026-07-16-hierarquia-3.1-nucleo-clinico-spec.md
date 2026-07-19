# Spec 1 — Hierarquia 3.1: núcleo clínico compartilhado

> **Status:** **agreed** — aprovada pelo Mateus em 2026-07-16. Contrato congelado: qualquer
> desvio durante a execução atualiza esta spec **primeiro**.
> **Data:** 2026-07-16
> **Plano de origem:** `plans/roadmap/roadmap-3.1-2026-07-14.md` (§"A DECISÃO QUE TRAVA TUDO")
> **Modelo de execução:** **Sonnet** — todas as decisões ambíguas (o que abre, o que não abre,
> onde a autoria mora, como o conflito de agenda não vaza) foram fechadas nesta spec e na
> discussão de 16/07. A execução implementa contra contrato congelado, não julga.
> Exceção: se o refactor de `paciente-detail-client.tsx` (arquivo grande) sair ruim na 1ª
> tentativa do Sonnet, subir pra Opus. Troca de modelo em execução vira registro no handoff.
>
> **Supersede parcialmente:** `plans/specs/spec-hierarquia-papeis-planos.md` e
> `plans/specs/spec-seguranca-silo-validacao.md` (ambas em produção, migrations 089–096).
> Esta spec **não reverte** o silo — reclassifica *o que* é silo. Ver §1.
>
> **Decisão de origem (Mateus, 16/07):** a Leitura B do roadmap 3.1 (silo-padrão +
> compartilhamento explícito, com co-responsável e event-log de co-autoria) foi **descartada**.
> O modelo aprovado é mais simples: **a ficha é documento da clínica; o procedimento é do
> dentista.** Não existe ação de "compartilhar" — a leitura já é aberta por padrão.

---

## 1. A decisão, em uma frase

**Registro clínico é da clínica (todo dentista lê). Trabalho é do autor (só ele escreve).
Dinheiro e agenda continuam privados.**

Validação: Mateus passou dias numa clínica de referência observando fluxo (não uma visita
e uma frase, como o roadmap 3.1 supunha). O caso concreto que dirige tudo: X atende o José,
identifica que precisa de canal, chama Y (especialista); Y faz a própria anamnese e adiciona
os próprios procedimentos; **nenhum dos dois mexe no do outro; ambos veem tudo.**

### A matriz de autorização (contrato central)

| Recurso | SELECT | INSERT/UPDATE/DELETE | Muda? |
|---|---|---|---|
| `pacientes` | **clínica** | clínica (dentista, secretária, bot) | ✅ abre |
| `fichas` | **clínica** | só o autor (`dentista_id`) | ✅ abre leitura |
| `planejamento_procedimentos` | **clínica** | só o autor | ✅ abre + coluna nova |
| `planejamento_secoes` | **clínica** | só o autor | ✅ abre + coluna nova |
| `paciente_documentos` | **clínica** | só o autor | ✅ abre + coluna nova |
| `tratamentos` | clínica (já era) | **só o autor** | ✅ fecha escrita + coluna nova |
| `agendamentos` | só o autor | só o autor | ⛔ nada muda (+ função de conflito) |
| `orcamentos`, `orcamento_itens` | só o autor | só o autor | ⛔ nada muda |
| `pagamentos` | só o autor | só o autor | ⛔ nada muda |
| `procedimentos` (catálogo) | só o autor | só o autor | ⛔ nada muda |
| `horarios_disponiveis` | só o autor | só o autor | ⛔ nada muda |
| storage (`fichas`/`radiografias`/`audios`) | clínica (**já era**) | clínica (já era) | ⛔ nada muda — ver §6 |

Secretária: `is_own_clinical_record()` já retorna `true` pra ela em tudo. Nada nesta spec
altera o que ela vê. Ela continua vendo tudo da clínica.

> ### ⚠️ "Clínica" = quem é CLÍNICO, não qualquer membro (adicionado 16/07, pós-aprovação)
> `belongs_to_active_clinic()` **só checa membership ativa — não checa papel**. Enquanto os
> únicos papéis eram admin/dentista/secretaria (CHECK das migrations 018 e 054), abrir a leitura
> pra "a clínica" era inofensivo. **Mas o protético entra como membro da equipe na Spec 3**
> (decisão do Mateus, 16/07) — e passaria nesse teste, herdando ficha, paciente, planejamento,
> documento e tratamento da clínica inteira. Ele só precisa de uma caixa de texto livre.
>
> O silo antigo protegia isso **por acidente**: `is_own_clinical_record()` exigia ser o dono OU
> secretária, então papel novo caía em `false` naturalmente. Trocar por "qualquer membro" removeu
> essa proteção sem ninguém perceber — na hora que a spec foi escrita, o protético não existia.
>
> **Fix:** helper `is_clinic_staff()` (= `get_my_role() in ('admin','dentista','secretaria')`) em
> **7 pontos** da 099: as 6 policies de SELECT **+ `pacientes_write`** (sem ele o protético
> criaria e apagaria paciente). **Não muda nada hoje** — os 3 papéis existentes retornam `true`.
> É prevenção: barato agora (migration não aplicada), caro depois (migration nova + risco de
> esquecer uma policy e vazar prontuário pra um laboratório). Ver invariante #10.

---

## 2. Escopo

**Cobre:**
- Abrir SELECT de `fichas`, `pacientes`, `planejamento_procedimentos`, `planejamento_secoes`,
  `paciente_documentos` para toda a clínica; manter escrita trancada no autor.
- Dar autoria própria (`dentista_id`) às 4 tabelas clínicas que hoje herdam do paciente:
  `planejamento_procedimentos`, `planejamento_secoes`, `paciente_documentos`, `tratamentos`.
- Impedir que dois dentistas agendem o mesmo paciente no mesmo horário **sem** abrir a agenda
  de um pro outro.
- Reescrever o harness `supabase/tests/silo_dois_dentistas.sql` — a asserção central deixa de
  ser "A vê ZERO de B" e vira a matriz do §1.
- Tornar a autoria visível na UI (timeline de fichas e listas do perfil do paciente).
- **Declarar o contrato de autoria que `odontograma_eventos` obedece quando nascer** (§7).

**NÃO cobre (registrado pra não reabrir):**
- Odontograma v3 inteiro — adiado por decisão do Mateus (16/07). Ele trata design +
  "por especialidade" quando for mexer nele.
- Assinatura e data por procedimento — **depende do event-log**, viaja com o odontograma v3.
  A spec v3 §1.10 já resolve (`realizado_em`, invariantes #13/#14).
- Transcrição tratada salva na ficha — modo consulta, não hierarquia.
- Filtro "meus / todos" na lista de pacientes — só vira necessário quando uma clínica grande
  migrar (hoje: 72 pacientes / 3 clínicas ≈ 24 por clínica). Ver §8.
- `planejamentos` e `planejamento_etapas` — **tabelas vazias (0 linhas)**. Continuam siloed;
  o silo delas não incomoda ninguém. Ver §8.
- Encaminhamento formal / ordem de trabalho / protético (Specs 2 e 3 do roadmap 3.1).
- **Gestão de dependência entre procedimentos** — decisão explícita do Mateus (16/07): o
  sistema **não** bloqueia o procedimento de X até o de Y estar concluído, não modela
  pré-requisito, não tem máquina de estados de "liberado". Ele **mostra** o que foi feito e
  por quem; o dentista lê e decide. *"Caso interfira o meu... se não interferir, isso aí vai
  do dentista, é individual, ele não vai delimitar dentro do sistema."*
- **A visão consolidada do tratamento** (progresso do caso, "o que falta", briefing com %) —
  é o **Job B / cockpit** do roadmap 3.1, spec própria. Ver §7.1 pro que isso significa na
  prática.

---

## 2.1 CORREÇÃO DE ROTA — 16/07, achados da leitura do código (pós-aprovação)

A spec foi aprovada com base na auditoria do **banco**. A leitura do **código de app**, ao
começar a execução, revelou três coisas que o schema não contava. Registradas aqui porque
mudam o contrato — nenhuma delas invalida a decisão de produto do §1.

### (a) `planejamento_procedimentos` está MORTA — nem lida, nem escrita

`src/hooks/usePlanejamentoPaciente.ts:162`, textual: *"sem tabela intermediária
(**planejamento_procedimentos deixou de ser escrita**)"*. O planejamento deriva de
`fichas.dentes_observacoes` + `fichas.procedimentos_status`, com IDs sintéticos
(`${ficha.id}::${dente}_${idx}`). As 22 linhas em prod são legado — mesma situação de
`planejamentos` e `planejamento_etapas`.

**Consequência:** a coluna `dentista_id` nela é **preventiva, não funcional**. Mantida na
migration (custo já pago, e a policy velha joina em `pacientes.dentista_id`, que virou coluna
zumbi — deixar como está seria plantar o bug da invariante #6 pra quem reusar a tabela depois).
**Não gastar código de app nela.**

### (b) A autoria do procedimento JÁ existe — vem da ficha

Como o procedimento deriva da ficha, `fichas.dentista_id` **já é** a autoria dele. Não há
coluna a criar nem action a mudar. E `fetchPlanProcs` já busca **todas** as fichas do paciente
(`.eq('paciente_id', patientId)`, sem filtro de dentista) — é só a RLS que restringe hoje.

**Consequência:** depois da 099, o planejamento passa a mostrar os procedimentos de todos os
dentistas **sem mudança de código**. O caso do §3.1 (mesmo dente, dois dentistas) resolve-se
sozinho. `FichasTab.tsx` já seleciona `dentista: { nome }` e exibe como `professional`.

### (c) ⚠️ A migration CRIA um bug: escrita silenciosa em ficha alheia

`src/components/pacientes/FichasTab.tsx:533` (`updateProcStatus`):

```ts
setEvolutions(...);                                  // otimista: UI já mostra "concluído"
const { error } = await supabase.from('fichas')
  .update({ procedimentos_status: updatedStatus })   // RLS barra → 0 linhas afetadas
  .eq('id', fichaId).eq('clinica_id', clinicaId);
if (error) console.error('[proc-status]', error);    // NUNCA dispara
```

Com a leitura aberta, A passa a ver a ficha de B e a conseguir clicar no toggle de status dela.
O state atualiza, a RLS recusa, e **o Supabase não retorna erro para UPDATE que afeta 0 linhas**
— devolve sucesso com array vazio. A tela afirma o que o banco negou, até o refresh.

**Hoje o bug não existe** (A nunca vê a ficha de B). É criado pela 099 e **tem que ser corrigido
na mesma leva.** Defesa dupla, obrigatória:
1. **UI:** não renderizar o controle de status em ficha de outro dentista (gate do §9).
2. **Código:** `.update(...).select('id')` e verificar se voltou linha; se não voltou, reverter
   o update otimista e avisar. **Só a UI não basta** — a RLS é a fronteira real, e nenhuma tela
   pode afirmar o que o banco recusou.

**Vira gate de aceite e invariante #9.**

---

## 3. Assunções (inferido, não confirmado explicitamente)

- **`pacientes.dentista_id` continua preenchido e NOT-mexido**, mas perde o poder de decidir
  visibilidade. Vira etiqueta de "quem cadastrou". Não vira NULL (destruiria informação e
  quebraria o followup) e não é renomeado pra `cadastrado_por_id` (toca 9 arquivos; o ganho
  não paga). Mitigação da ambiguidade: `COMMENT ON COLUMN` + esta spec.
- **O tratamento é o caso do paciente, compartilhado — não o caso de um dentista**
  (confirmado pelo Mateus, 16/07). A ficha do Y anexa **no tratamento do X**, não abre um
  tratamento novo. O tratamento **cresce** com a contribuição de todos: canal do Y →
  restauração do X → aparelho do Z. O `dentista_id` dele é só o dono do *container* (quem
  abriu o caso; só ele renomeia/encerra). Anexar ficha ≠ mexer no tratamento — por isso isso
  não fere o "ele não mexe no meu, eu não mexo no dele", que vale pra **ficha e procedimento**,
  nunca pro caso.
- **Backfill de autoria = `pacientes.dentista_id` de hoje** nas 4 tabelas. Preserva exatamente
  o acesso atual: ninguém ganha nem perde nada no dia da migração.
- O bot cria paciente com `dentista_id` do dentista-alvo (comportamento atual mantido). Se um
  dia criar com NULL, o backfill futuro precisa de outra âncora — ver invariante #6.

### 3.1 O mesmo dente, várias vezes, por dentistas diferentes (requisito do Mateus, 16/07)

*"O dentista encaminha pro outro; quando voltar, ele tem que mexer no mesmo dente."*

**Já funciona hoje — e há dado real em prod provando.** `planejamento_procedimentos` não tem
nenhuma constraint de unicidade (só PK em `id` + CHECK de status), e existe paciente com o
**dente 21 registrado 4×**: `extração → implante → provisório → coroa de porcelana`; outro com
o dente 33 2×. A tabela sempre foi linha-a-linha.

O que **esta spec** acrescenta é a autoria por linha: a sequência do dente 21 passa a ser
`extração (X) → implante (Y) → provisório (X) → coroa (Z)` — cada um escreve só a sua, todos
leem todas. **Nenhuma mudança estrutural é necessária pra isso;** é consequência direta do §4.2.

**Onde isso pode ser implementado errado (registrar):**
- `fichas.dentes_observacoes` é um mapa `{"21": "extração\nimplante"}` — **uma** entrada por
  dente, com `\n` separando. É feio, mas é **por ficha**, e cada dentista tem a própria ficha,
  então não colide entre dentistas. Não mexer nisso aqui.
- A UI de planejamento **precisa** listar N linhas do mesmo dente em ordem, com autoria — não
  colapsar por dente. Ver gate no §11.

---

## 4. Database

### 4.1 Estado atual (auditado em prod, 16/07 — `zenfemoxvwerplrjgfqz`)

| Tabela | Linhas | Autoria hoje | Órfãos no backfill |
|---|---|---|---|
| `fichas` | 33 | ✅ `dentista_id` NOT NULL (33/33) | — |
| `planejamento_procedimentos` | 22 | ❌ herda `pacientes.dentista_id` | **0** |
| `paciente_documentos` | 16 | ❌ herda `pacientes.dentista_id` | **0** |
| `planejamento_secoes` | 7 | ❌ herda `pacientes.dentista_id` | **0** |
| `tratamentos` | 1 | ❌ nenhuma (só `clinica_id`) | **0** |
| `pacientes` | 72 | `dentista_id` (0 NULL) | — |

Volume total é pequeno e **zero linhas ficam órfãs** — a migração não muda nada no dia 1.

### 4.2 Migration `099_hierarquia_nucleo_clinico_compartilhado.sql`

> **O arquivo real é `supabase/migrations/20260716000000_099_hierarquia_nucleo_clinico_compartilhado.sql`.**
> O bloco abaixo é o desenho aprovado; o arquivo tem, além dele, o `is_clinic_staff()` do §1
> (adicionado depois da aprovação) aplicado em 7 pontos. Em divergência, **o arquivo vale**.

```sql
-- ─────────────────────────────────────────────────────────────────────────
-- 099 — Núcleo clínico compartilhado (Spec 1 — Hierarquia 3.1)
--
-- Registro clínico passa a ser da CLÍNICA (leitura aberta); trabalho continua
-- do AUTOR (escrita trancada). Financeiro e agenda permanecem silo estrito.
--
-- NÃO reverte o silo — reclassifica o que é silo. Ver plans/specs/2026-07-16-*.
--
-- "Clínica" = is_clinic_staff() (admin/dentista/secretaria), NUNCA "qualquer
-- membro" — o protético entra como membro na Spec 3. Ver §1 e invariante #10.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. Autoria própria nas 4 tabelas que herdavam do paciente ────────────
alter table public.planejamento_procedimentos add column if not exists dentista_id uuid references public.dentistas(id) on delete set null;
alter table public.planejamento_secoes        add column if not exists dentista_id uuid references public.dentistas(id) on delete set null;
alter table public.paciente_documentos        add column if not exists dentista_id uuid references public.dentistas(id) on delete set null;
alter table public.tratamentos                add column if not exists dentista_id uuid references public.dentistas(id) on delete set null;

-- Backfill: herda o dono ATUAL do paciente. Preserva o acesso exato de hoje.
update public.planejamento_procedimentos pp
   set dentista_id = pc.dentista_id
  from public.pacientes pc
 where pc.id = pp.paciente_id and pp.dentista_id is null;

update public.planejamento_secoes ps
   set dentista_id = pc.dentista_id
  from public.pacientes pc
 where pc.id = ps.paciente_id and ps.dentista_id is null;

update public.paciente_documentos pd
   set dentista_id = pc.dentista_id
  from public.pacientes pc
 where pc.id = pd.paciente_id and pd.dentista_id is null;

update public.tratamentos t
   set dentista_id = pc.dentista_id
  from public.pacientes pc
 where pc.id = t.paciente_id and t.dentista_id is null;

create index if not exists idx_planejamento_procedimentos_dentista on public.planejamento_procedimentos (dentista_id);
create index if not exists idx_planejamento_secoes_dentista        on public.planejamento_secoes (dentista_id);
create index if not exists idx_paciente_documentos_dentista        on public.paciente_documentos (dentista_id);
create index if not exists idx_tratamentos_dentista                on public.tratamentos (dentista_id);

-- ── 2. A coluna zumbi: pacientes.dentista_id perde poder de RLS ──────────
comment on column public.pacientes.dentista_id is
  'INFORMATIVO — quem cadastrou o paciente. NÃO governa visibilidade desde a migration 099
   (Spec 1 Hierarquia 3.1): o paciente é da clínica. NUNCA usar como filtro de RLS ou como
   filtro de query "meus pacientes" sem intenção explícita. Ver plans/specs/2026-07-16-*.';

-- ── 3. pacientes: split do FOR ALL em leitura aberta + escrita da clínica ─
drop policy if exists pacientes_access on public.pacientes;

create policy pacientes_select on public.pacientes
  for select using (belongs_to_active_clinic(clinica_id));

create policy pacientes_write on public.pacientes
  for all
  using      (belongs_to_active_clinic(clinica_id))
  with check (belongs_to_active_clinic(clinica_id));

-- ── 4. fichas: abre a leitura. A escrita JÁ está correta (fichas_write_own) ──
-- Policies permissivas são OR por comando: fichas_write_own (FOR ALL) continua
-- trancando UPDATE/DELETE em dentista_id = get_my_dentista_id().
drop policy if exists fichas_select on public.fichas;

create policy fichas_select on public.fichas
  for select using (belongs_to_active_clinic(clinica_id));

-- ── 5. planejamento_procedimentos: leitura clínica, escrita do autor ─────
drop policy if exists planejamento_procedimentos_select    on public.planejamento_procedimentos;
drop policy if exists planejamento_procedimentos_write_own on public.planejamento_procedimentos;

create policy planejamento_procedimentos_select on public.planejamento_procedimentos
  for select using (belongs_to_active_clinic(clinica_id));

create policy planejamento_procedimentos_write_own on public.planejamento_procedimentos
  for all
  using      (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

-- ── 6. planejamento_secoes: idem ────────────────────────────────────────
drop policy if exists planejamento_secoes_select    on public.planejamento_secoes;
drop policy if exists planejamento_secoes_write_own on public.planejamento_secoes;

create policy planejamento_secoes_select on public.planejamento_secoes
  for select using (belongs_to_active_clinic(clinica_id));

create policy planejamento_secoes_write_own on public.planejamento_secoes
  for all
  using      (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

-- ── 7. paciente_documentos: idem ────────────────────────────────────────
drop policy if exists paciente_documentos_access on public.paciente_documentos;

create policy paciente_documentos_select on public.paciente_documentos
  for select using (belongs_to_active_clinic(clinica_id));

create policy paciente_documentos_write_own on public.paciente_documentos
  for all
  using      (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

-- ── 8. tratamentos: fecha a escrita no autor (hoje qualquer dentista edita) ──
drop policy if exists clinica_isolamento            on public.tratamentos;
drop policy if exists tratamentos_select_clinic_members on public.tratamentos;
drop policy if exists tratamentos_insert_dentistas  on public.tratamentos;
drop policy if exists tratamentos_update_dentistas  on public.tratamentos;
drop policy if exists tratamentos_delete_dentistas  on public.tratamentos;

create policy tratamentos_select on public.tratamentos
  for select using (belongs_to_active_clinic(clinica_id));

create policy tratamentos_write_own on public.tratamentos
  for all
  using      (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

-- ── 9. Conflito de agenda por PACIENTE sem vazar a agenda alheia ─────────
create or replace function public.paciente_tem_conflito_agenda(
  p_paciente_id   uuid,
  p_inicio        timestamptz,
  p_duracao_min   integer,
  p_ignorar_id    uuid default null
) returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (
    select 1
      from public.agendamentos a
     where a.paciente_id = p_paciente_id
       and a.clinica_id  = public.get_my_clinica_id()
       and a.status in ('scheduled','confirmed','checked_in','in_progress')
       and (p_ignorar_id is null or a.id <> p_ignorar_id)
       and tstzrange(a.data_hora, a.data_hora + make_interval(mins => a.duracao_minutos))
        && tstzrange(p_inicio,    p_inicio    + make_interval(mins => p_duracao_min))
  )
$$;

comment on function public.paciente_tem_conflito_agenda is
  'Responde APENAS "esse paciente já tem compromisso nesse intervalo? sim/não". SECURITY
   DEFINER de propósito: o chamador não pode ver a agenda de outro dentista (silo mantido),
   mas precisa ser barrado se ela colidir. NUNCA retornar dado do agendamento — só boolean.
   Escopo travado na clínica ativa do chamador via get_my_clinica_id().';

-- Helpers de RLS/SECURITY DEFINER precisam de EXECUTE p/ authenticated (ver migration 091/093/095:
-- revogar de anon/public é o certo; revogar de authenticated QUEBRA o fluxo).
revoke execute on function public.paciente_tem_conflito_agenda(uuid, timestamptz, integer, uuid) from anon, public;
grant  execute on function public.paciente_tem_conflito_agenda(uuid, timestamptz, integer, uuid) to authenticated;
```

### 4.3 Por que `can_act_as_dentista` e não `dentista_id = get_my_dentista_id()`

`can_act_as_dentista(uuid)` (migration 098) já significa exatamente "posso agir em nome deste
dentista?" — retorna `true` pro próprio dentista **e** pra secretária agindo por um dentista
ativo da clínica. Usar ela nas 4 tabelas novas mantém a secretária funcional (ela cria
orçamento e procedimento hoje) sem policy extra. Reuso, não abstração nova.

---

## 5. TypeScript — contratos

```ts
// src/types/database.ts — colunas novas (adicionar aos tipos existentes)
export interface PlanejamentoProcedimento {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string | null;   // NOVO — autor. null só em linha legada sem backfill possível.
  descricao: string;
  dente: number | null;
  status: string;
  ficha_ref: string | null;
  ordem: number;
  created_at: string;
}

export interface PacienteDocumento {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string | null;   // NOVO — quem anexou
  nome: string;
  url: string;
  categoria: string;
  tipo_documento: string | null;
  thumbnail: string | null;
  origem: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tratamento {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string | null;   // NOVO — dono do caso (só ele renomeia/encerra)
  nome: string | null;
  status: string;
  created_at: string;
  encerrado_em: string | null;
}
```

```ts
// src/types/agenda.ts — contrato da checagem de conflito
export interface ConflitoPacienteInput {
  pacienteId: string;
  dataHora: string;        // ISO
  duracaoMinutos: number;
  ignorarAgendamentoId?: string;
}

/** Deliberadamente sem detalhe: quem/o quê é silo do outro dentista. */
export type ConflitoPacienteResult =
  | { ok: true; conflito: boolean }
  | { ok: false; error: string };
```

```ts
// Autoria visível — o que a UI precisa junto de cada registro clínico
export interface AutoriaResumo {
  dentistaId: string;
  dentistaNome: string;
  ehMeu: boolean;          // dentistaId === dentista do usuário logado
}
```

## 5.1 Server Actions — mudanças de contrato

| Action | Arquivo | Mudança |
|---|---|---|
| `criarAgendamento`, `criarEncaixe` | `src/app/dashboard/agendamentos/actions.ts` | Chamar `paciente_tem_conflito_agenda` **antes** do insert. Conflito de paciente **bloqueia** (não tem "forçar" — dois dentistas não atendem o mesmo paciente ao mesmo tempo). Conflito de *dentista* mantém o comportamento atual (`forcarEncaixe`). |
| `atualizarAgendamento` | idem | **ADICIONADO 16/07 durante a execução** (não estava na spec aprovada). Ver nota abaixo. |
| `salvarPlanejamento*` | `src/app/dashboard/pacientes/[id]/actions.ts` | Gravar `dentista_id` explícito no insert (nunca deixar a policy inferir). |
| upload de documento | `src/app/dashboard/pacientes/[id]/actions.ts` | Gravar `dentista_id` = autor do upload. |
| criar tratamento | onde existir | Gravar `dentista_id` = criador. |

> **Débito de silo conhecido (memória do projeto, 3 ocorrências em 14–15/07):** action que
> insere sem `dentistaId` explícito faz o registro nascer preso ao perfil de quem chamou —
> quebra quando é a secretária. Toda action tocada aqui passa `dentistaId` explícito.

**Nota sobre `atualizarAgendamento` (adicionado na execução, 16/07):** a spec aprovada só
listava `criarAgendamento`/`criarEncaixe`. A leitura do código mostrou que
`atualizarAgendamento` **não valida conflito nenhum hoje — nem o de dentista**; a checagem
existe só client-side (`conflitoEdicao` em `agendamentos-client.tsx`). É lacuna pré-existente,
mas **a abertura do paciente a torna explorável**: reagendar seria a porta dos fundos pra furar
a invariante fechada no criar (A reagenda o paciente P pras 14:00 onde B já tem P). Fechar o
criar e deixar o reagendar aberto não fecha nada.

Escopo do fix: **só o conflito de paciente** (o que esta spec introduz). O conflito de *dentista*
no reagendamento continua sem validação server-side — é dívida anterior, fica registrada no §13,
**não** é ampliada aqui. Usa `p_ignorar_id` pra o agendamento não conflitar consigo mesmo, e só
revalida quando `dataHora`/`pacienteId`/`duracaoMinutos` mudam (chamada que só muda `status`
não paga a query).

---

## 6. Achados da auditoria de 16/07 (registrar — não são mudanças)

Três coisas que a auditoria em prod revelou e que a spec precisa deixar escrito, porque
contradizem o que o roadmap 3.1 e a `spec-seguranca-silo-validacao` afirmam:

1. **O silo de arquivos nunca existiu.** Todas as policies de `storage.objects` (buckets
   `fichas`, `radiografias`, `audios`) filtram por `clinica_id`, nunca por dentista. O Dr. Y
   **já lê hoje, em produção**, o áudio e a radiografia da consulta do Dr. X — desde que tenha
   a URL. O silo só existia na camada da tabela. Consequência: abrir `fichas` **não expõe nada
   novo** no storage; só torna a tabela coerente com o que os arquivos já faziam. O harness
   63/63 nunca testou storage.
2. **`tratamentos` já era aberto** — `tratamentos_select_clinic_members` é só
   `belongs_to_active_clinic(clinica_id)`, e `tratamentos_update_dentistas` deixava **qualquer**
   dentista da clínica editar o tratamento de qualquer outro, sem autoria. A invariante
   "A vê ZERO de B" já era falsa em produção antes desta spec. Esta migration **fecha** isso.
3. **`planejamentos` e `planejamento_etapas` estão vazias** (0 linhas). Ficam siloed, fora de
   escopo. Se voltarem a ser usadas, precisam entrar nesta matriz antes.

---

## 7.1 O que esta spec entrega do fluxo real — e o que fica faltando

O fluxo que dirige a decisão (Mateus, 16/07): *"eu olho lá no tratamento e vejo que o canal já
foi feito, aí libera pra mim continuar."*

**Auditoria em prod (16/07):** das 33 fichas, **0 têm `tratamento_id`**; existe **1** tratamento
cadastrado, com **0** fichas ligadas. A tabela existe desde a migration 069, a UI nunca amarrou
nela. **O tratamento como visão do caso não funciona hoje** — não por RLS, por falta de produto.

| O fluxo | Quem entrega | Status |
|---|---|---|
| X abre o José e **lê a ficha do Y**, onde está escrito que o canal foi feito | **esta spec** | ✅ resolve o caso na prática — a informação chega |
| X vê **quem** fez cada coisa, sem confundir com o dele | **esta spec** (§9) | ✅ |
| X **não consegue** alterar o que o Y fez | **esta spec** (invariante #1) | ✅ |
| X vê a **visão consolidada** do caso: progresso, o que falta, briefing com % | **Job B / cockpit** (spec própria) | ⛔ fora de escopo |
| Sistema **bloqueia** X até o canal do Y estar concluído | **ninguém** | ⛔ não-escopo por decisão (§2) |

Ou seja: esta spec destrava a informação; o cockpit é que a organiza. Não inchar a Spec 1 pra
fazer as duas — quando o Job B for escrito, ele lê desta matriz de acesso, não a redefine.

---

## 7. Contrato de autoria pro odontograma v3 (declarado por antecipação)

O odontograma v3 está adiado (decisão do Mateus, 16/07), mas a `spec-modo-consulta-v3-odontograma`
**já prevê `dentista_id` em `OdontogramaEvento`** (§1.4). Esta spec congela a RLS que aquela
tabela obedece quando nascer, pra ela não nascer sem autor e forçar uma segunda migração:

```sql
-- NÃO aplicar agora — contrato pra quando a Fatia A do v3 criar a tabela.
create policy odontograma_eventos_select on public.odontograma_eventos
  for select using (belongs_to_active_clinic(clinica_id));

create policy odontograma_eventos_insert on public.odontograma_eventos
  for insert with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

-- Sem UPDATE, sem DELETE: event-log nunca é sobrescrito (invariante do v3).
```

**O reduce do acumulado NUNCA filtra por dentista.** O `DISTINCT ON (dente, tipo, face)
ORDER BY registrado_em DESC` da v3 §1.4 é por dente/tipo/face e mais nada — **o dente tem UM
estado clínico, não um por dentista.** Canal do Y e restauração do X coexistem no 26 porque são
`tipo` diferentes; se dois dentistas mexem no mesmo `tipo` do mesmo dente (X restaura, Y refaz),
o mais recente é o estado e o do X fica no histórico, intacto. **É proibido** implementar
"cada dentista vê o próprio odontograma" — o odontograma é do paciente. Ver invariante #8.

**Por que isso importa:** num event-log ninguém sobrescreve nada por construção — cada dentista
só anexa, e o estado do dente é o evento mais recente. Se X registrou "cárie no 26 — indicado"
e Y registrou "restauração no 26 — realizado", o dente aparece restaurado e o registro do X
continua intacto no histórico. **A co-autoria que o roadmap 3.1 queria construir como feature
inteira (co-responsável, permissão negociada) sai de graça como propriedade da arquitetura.**
É a razão técnica pela qual a Leitura B foi descartada.

---

## 8. Invariantes

Regras que a implementação **nunca** pode quebrar:

- [ ] **#1 — Ninguém edita o registro clínico de outro dentista.** UPDATE/DELETE em `fichas`,
      `planejamento_procedimentos`, `planejamento_secoes`, `paciente_documentos`, `tratamentos`
      exige `can_act_as_dentista(dentista_id)`. Leitura aberta **nunca** implica escrita aberta.
- [ ] **#2 — Dinheiro é silo estrito.** `orcamentos`, `orcamento_itens`, `pagamentos` e o
      catálogo `procedimentos` não são tocados por esta spec. Nenhuma tela pode exibir valor,
      item ou existência de orçamento de outro dentista — nem indiretamente pela ficha aberta.
- [ ] **#3 — A agenda alheia nunca é revelada.** `paciente_tem_conflito_agenda` retorna
      **boolean e nada mais**. É proibido evoluir essa função pra devolver horário, dentista
      ou procedimento do conflito.
- [ ] **#4 — Assinatura cobre só o trabalho de quem assinou.** Uma ficha = um dentista. É
      proibido introduzir "ficha com seções de vários dentistas" — quebraria
      `fichas.assinatura_url` (a assinatura de X passaria a cobrir o trabalho de Y).
- [ ] **#5 — `pacientes.dentista_id` não governa acesso.** Proibido usar como filtro de RLS
      ou como filtro implícito de query. É etiqueta informativa.
- [ ] **#6 — Tabela clínica nova pendurada em paciente nasce com `dentista_id` próprio.**
      Nunca herdar autoria via join em `pacientes.dentista_id` — foi exatamente o padrão que
      esta spec teve que desfazer em 4 tabelas.
- [ ] **#7 — Action de escrita clínica passa `dentistaId` explícito.** Nunca deixar o registro
      nascer preso ao perfil de quem chamou (quebra pra secretária — 3 ocorrências em 14–15/07).
- [ ] **#8 — O dente tem um estado clínico, não um por dentista.** Nenhuma query de registro
      clínico por dente pode filtrar/agrupar por `dentista_id` pra montar o estado. O mesmo
      dente aceita N procedimentos, de N dentistas, em sequência — a UI lista todos com autoria,
      **nunca colapsa por dente** nem esconde o do colega. Ver §3.1.
- [ ] **#9 — Nenhuma tela afirma o que o banco negou.** Todo update otimista em registro
      clínico confirma com `.select()` que a linha foi realmente afetada e reverte se não foi.
      **UPDATE barrado por RLS não retorna erro no Supabase** — devolve sucesso com 0 linhas.
      Esconder o controle na UI é necessário mas **não suficiente**: a RLS é a fronteira, a UI é
      conveniência. Ver §2.1(c).
- [ ] **#10 — "Clínica" nunca significa "qualquer membro".** Leitura de registro clínico exige
      `belongs_to_active_clinic() AND is_clinic_staff()` — **nunca** `belongs_to_active_clinic()`
      sozinho. Papel novo (protético na Spec 3, e qualquer outro depois) **não entra em
      `is_clinic_staff()` sem decisão explícita registrada**: o default de um papel novo é ver
      **nada** do prontuário, e ele ganha só o que a spec dele conceder, item a item.

---

## 9. UI — autoria visível

Não é tela nova, então **não precisa de `design-brief`** — é adicionar atribuição a listas que
já existem, com tokens do design system.

| Onde | Arquivo | O quê |
|---|---|---|
| Timeline de fichas | `src/components/pacientes/FichasTab.tsx` | Nome do dentista em cada ficha. Ficha de outro dentista: sem ações de edição, badge sutil "Dr. Y". Ficha própria: como hoje. |
| Perfil do paciente | `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` | Planejamento, documentos e tratamentos mostram autor; controles de edição só no que é meu. |
| Agenda | `src/app/dashboard/agendamentos/_components/agendamentos-client.tsx` | Erro de conflito de paciente: "Este paciente já tem um horário nesse intervalo." — **sem** dizer com quem. |

**Gate de UX:** um dentista tem que conseguir distinguir, em < 1 segundo e sem clicar, o que é
dele do que é do colega. Sem isso, leitura aberta vira confusão em vez de contexto.

---

## 10. Harness — reescrita de `supabase/tests/silo_dois_dentistas.sql`

O harness atual (378 linhas, 63 assertivas, seed descartável + `ROLLBACK`) tem boa arquitetura:
`pg_temp.silo_assert(persona, check, expected, actual, ok)` acumula tudo numa temp table e
impersona via `SET LOCAL request.jwt.claims`. **Mantém a estrutura; troca as asserções.**

Renomear para `supabase/tests/matriz_acesso_clinico.sql` — o nome "silo_dois_dentistas" passa
a mentir sobre o que o arquivo prova.

| Asserção hoje | Vira |
|---|---|
| `fichas: vê 0 de B` | `fichas: vê 1 de B` ✅ |
| `pacientes: vê 0 de B` | `pacientes: vê 1 de B` ✅ |
| `planejamento_procedimentos: vê 0 de B` | `vê 1 de B` ✅ |
| `paciente_documentos: vê 0 de B` | `vê 1 de B` ✅ |
| `planejamento_secoes: vê 0 de B` | `vê 1 de B` ✅ |
| `orcamentos: vê 0 de B` | **inalterada** ⛔ |
| `orcamento_itens: vê 0 de B` | **inalterada** ⛔ |
| `pagamentos: vê 0 de B` | **inalterada** ⛔ |
| `agendamentos: vê 0 de B` | **inalterada** ⛔ |
| `procedimentos: vê 0 de B` | **inalterada** ⛔ |
| `horarios_disponiveis: vê 0 de B` | **inalterada** ⛔ |

**Asserções novas (o que a leitura aberta obriga a provar):**

- [ ] `dentista_a` faz UPDATE na ficha de B → **0 linhas afetadas** (lê mas não escreve)
- [ ] `dentista_a` faz DELETE na ficha de B → **0 linhas afetadas**
- [ ] `dentista_a` faz UPDATE em `planejamento_procedimentos` de B → **0 linhas**
- [ ] `dentista_a` faz UPDATE em `paciente_documentos` de B → **0 linhas**
- [ ] `dentista_a` faz UPDATE em `tratamentos` de B → **0 linhas** (fecha o furo do §6.2)
- [ ] `dentista_a` faz INSERT de ficha com `dentista_id` = B → **rejeitado**
- [ ] `dentista_a` faz INSERT em `planejamento_procedimentos` com `dentista_id` = B → **rejeitado**
- [ ] `paciente_tem_conflito_agenda(paciente_b, <horário do agendamento de B>, 30)` chamada
      **como dentista A** → **`true`** (barra) **e** `select count(*) from agendamentos` como
      A continua **1** (a agenda de B não vazou)
- [ ] `secretaria` continua vendo tudo (contagens inalteradas vs. hoje)

---

## 11. Gates de aceite

- [ ] `supabase/tests/matriz_acesso_clinico.sql` roda inteiro e **todas** as assertivas passam.
- [ ] Migration 099 aplicada: `select count(*) from planejamento_procedimentos where dentista_id is null` → **0**. Idem para `planejamento_secoes`, `paciente_documentos`, `tratamentos`.
- [ ] **Invariante #10 — nenhuma policy de leitura clínica com `belongs_to_active_clinic()` solto.**
      Estrutural: verificável no catálogo, sem o papel protético precisar existir (o CHECK das
      migrations 018/054 impede criá-lo hoje, então o harness não consegue impersonar um).
      Está automatizada no `matriz_acesso_clinico.sql` §8:
      ```sql
      select tablename, policyname from pg_policies
       where schemaname = 'public'
         and tablename in ('fichas','pacientes','planejamento_procedimentos',
                           'planejamento_secoes','paciente_documentos','tratamentos')
         and cmd in ('SELECT','ALL')
         and qual like '%belongs_to_active_clinic%'
         and qual not like '%is_clinic_staff%'       -- portão da leitura clínica
         and qual not like '%can_act_as_dentista%'   -- portão da escrita (autor/secretária)
         and qual not like '%get_my_dentista_id%';   -- escrita trancada no dono (já barra papel novo)
      -- Esperado DEPOIS da 099: 0 linhas. Qualquer linha = prontuário aberto a qualquer membro.
      ```
      **Validado contra prod em 16/07 (pré-099):** a query acusou
      `tratamentos_select_clinic_members` como **furo real** — era `belongs_to_active_clinic()`
      puro. As outras 5 estavam protegidas por acidente (via `is_own_clinical_record`), e a 099
      as troca pelo portão explícito. Ou seja: a asserção **prova que detecta**, não é decorativa.
- [ ] Logado como dentista A: o perfil de um paciente cadastrado por B abre, mostra as fichas de B em modo leitura, **sem** nenhum controle de edição.
- [ ] Logado como dentista A: nenhuma tela exibe orçamento, item ou pagamento de B.
- [ ] Agendar o paciente P às 14:00 como A, quando B já tem P às 14:00 → erro "Este paciente já tem um horário nesse intervalo", **sem** citar B.
- [ ] Agendar o paciente P às 15:00 como A, com B tendo P às 14:00 (30min) → **sucesso**.
- [ ] **Mesmo dente, vários dentistas:** o paciente com o dente 21 (`extração → implante →
      provisório → coroa`, dado real em prod) mostra as **4** linhas em ordem, cada uma com o
      autor, e o dentista A consegue editar só a dele. Nenhuma some, nenhuma colapsa.
- [ ] **§2.1(c) — a tela não mente:** logado como A, na ficha de B, o toggle de status do
      procedimento **não aparece**. E se for chamado à força (via console/devtools), o state
      **não** fica marcado como concluído — o update confirma com `.select()`, vê 0 linhas e
      reverte. Recarregar a página mostra o valor original.
- [ ] Logado como dentista A: adicionar um 5º procedimento **no mesmo dente 21** que o B já
      usou → **funciona**, sem erro de constraint.
- [ ] Logado como secretária: tudo que ela via antes continua visível (nenhuma regressão).
- [ ] `npm run typecheck` + `lint` + `build` limpos (sem regressão nos 24 eslint
      `set-state-in-effect` pré-existentes).

---

## 12. Ordem de execução

1. Migration 099 — **prod = dev, exige confirmação explícita do Mateus nomeando projeto + ação**
   (classificador bloqueou via MCP em 14/07 e 15/07; padrão: ele aplica pelo SQL Editor).
2. Harness reescrito + rodado **antes** de qualquer código de app (é o gate).
3. Tipos + actions (`dentistaId` explícito em toda escrita clínica).
4. Função de conflito + integração na agenda.
5. UI de autoria.
6. Auditoria: `typescript-reviewer` + `ux-reviewer` antes do commit.

### 12.1 DESVIO REGISTRADO — 16/07: migration não aplicada, harness não rodado

**Decisão do Mateus (16/07):** guardar a migration 099 e o harness no repo **sem aplicar**.
Os passos 3–5 (código de app) seguem **antes** dos passos 1–2, invertendo a ordem acima.

**Contexto que forçou a escolha:** não existe ambiente local nesta máquina — Docker, Supabase
CLI e `psql` ausentes; `supabase/config.toml` existe mas `supabase start` precisa de Docker.
O único banco é o DentAi (`zenfemoxvwerplrjgfqz`), que é dev **e** prod.

**O que isso custa (aceitar conscientemente):**
- O harness `matriz_acesso_clinico.sql` **não foi executado nenhuma vez**. Todas as ~65
  asserções são hipótese até a 099 ser aplicada. A migration também nunca rodou — erro de
  sintaxe ou de policy só aparece na aplicação (mitigado: ela é `begin/commit`, então falha
  atômica; e a expressão de `tstzrange`/`make_interval` foi validada isolada contra o banco).
- O código de app (3–5) é escrito contra uma RLS **que nunca foi exercitada**. A verificação
  fica estática (`typecheck`/`lint`/`build` + leitura) até a migração acontecer.
- **Os gates de aceite do §11 permanecem TODOS em aberto.** Esta spec não pode ser marcada
  `implemented` enquanto o harness não passar.

**Condição de saída do desvio:** aplicar a 099 no DentAi e rodar o harness. Enquanto isso não
acontece, o trabalho está *escrito*, não *verificado* — e o handoff da sessão precisa dizer
exatamente isso, sem hedge.

---

## 13. Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| `pacientes.dentista_id` vira coluna zumbi e alguém volta a usar como filtro | média | `COMMENT ON COLUMN` + invariante #5 + o harness quebra se a RLS voltar a depender dela |
| Ficha aberta expõe algo financeiro indiretamente (ex.: UI da ficha puxando orçamento vinculado por `orcamentos.ficha_id`) | baixa | RLS de `orcamentos` já barra no banco; invariante #2 + gate de aceite explícito |
| Dentista se perde vendo ficha de todo mundo | média | Gate de UX §9; se doer, filtro "meus/todos" entra (fora de escopo hoje: 24 pacientes/clínica) |
| Reescrever o harness perde uma asserção real de segurança no meio | média | Tabela do §10 é 1:1 com as asserções atuais — nenhuma some sem estar na coluna "vira" |
| **`atualizarAgendamento` não valida conflito de DENTISTA no servidor** (dívida anterior a esta spec — só o client checa via `conflitoEdicao`) | média | **Não corrigido aqui de propósito** — fora do escopo. Esta spec só fecha o conflito de *paciente*, que é o que ela introduz. Registrar como dívida: um POST direto na action ainda permite dois pacientes no mesmo horário do mesmo dentista |
| Migration aplicada em prod sem rollback fácil | baixa | Reversível: as policies antigas estão em 089; o backfill não destrói dado (só preenche) |
