-- =====================================================================
-- 099 — Núcleo clínico compartilhado (Spec 1 — Hierarquia 3.1)
--
-- Spec: plans/specs/2026-07-16-hierarquia-3.1-nucleo-clinico-spec.md
--
-- A DECISÃO, EM UMA FRASE:
--   Registro clínico é da CLÍNICA (todo dentista lê).
--   Trabalho é do AUTOR (só ele escreve).
--   Dinheiro e agenda continuam PRIVADOS.
--
-- Esta migration NÃO reverte o silo das migrations 089–096 — ela reclassifica
-- o que é silo. Orçamento, pagamento, agenda, catálogo de procedimentos e
-- horários continuam intocados.
--
-- Auditado em prod (16/07) antes de escrever: 0 pacientes sem dentista_id,
-- 0 linhas ficariam órfãs no backfill. Ninguém ganha nem perde acesso no dia 1.
-- =====================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────
-- 0. "Clínica" = quem é CLÍNICO, não qualquer membro
--
-- belongs_to_active_clinic() só checa membership ativa — NÃO checa papel.
-- Enquanto os únicos papéis eram admin/dentista/secretaria (CHECK das migrations
-- 018 e 054), isso era inofensivo. Mas o protético entra como MEMBRO DA EQUIPE na
-- Spec 3 — e passaria nesse teste, herdando ficha, paciente, planejamento,
-- documento e tratamento da clínica inteira. Ele só precisa de uma caixa de texto.
--
-- O silo antigo protegia isso por acidente: is_own_clinical_record() exigia ser o
-- dono OU secretária, então papel novo caía em false naturalmente. Trocar por
-- "qualquer membro" removeu essa proteção. Este helper devolve ela, de propósito.
--
-- HOJE NÃO MUDA NADA: os 3 papéis existentes retornam true. É prevenção — barato
-- agora (migration não aplicada), caro depois (nova migration + risco de esquecer
-- uma policy e vazar prontuário pra um laboratório).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.is_clinic_staff()
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select public.get_my_role() in ('admin', 'dentista', 'secretaria')
$$;

comment on function public.is_clinic_staff is
  'É membro CLÍNICO da clínica (admin/dentista/secretaria)? Portão da leitura aberta do núcleo
   clínico — belongs_to_active_clinic() sozinho aceita QUALQUER membro, inclusive papéis
   não-clínicos (protético, Spec 3). Papel novo que não seja clínico NÃO entra aqui sem decisão
   explícita. Ver invariante #10 da spec 2026-07-16.';

revoke execute on function public.is_clinic_staff() from anon, public;
grant  execute on function public.is_clinic_staff() to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Autoria própria nas 4 tabelas clínicas que herdavam do paciente
--
-- Padrão desfeito aqui: essas tabelas nunca tiveram dono porque o paciente
-- era do dentista, então tudo pendurado nele era dele por transitividade.
-- Cortar essa transitividade (paciente vira da clínica) deixa as 4 sem
-- âncora de uma vez. Ver invariante #6 da spec.
-- ─────────────────────────────────────────────────────────────────────
alter table public.planejamento_procedimentos
  add column if not exists dentista_id uuid references public.dentistas(id) on delete set null;
alter table public.planejamento_secoes
  add column if not exists dentista_id uuid references public.dentistas(id) on delete set null;
alter table public.paciente_documentos
  add column if not exists dentista_id uuid references public.dentistas(id) on delete set null;
alter table public.tratamentos
  add column if not exists dentista_id uuid references public.dentistas(id) on delete set null;

-- Backfill: herda o dono ATUAL do paciente. Preserva o acesso exato de hoje.
update public.planejamento_procedimentos pp
   set dentista_id = pc.dentista_id
  from public.pacientes pc
 where pc.id = pp.paciente_id
   and pp.dentista_id is null;

update public.planejamento_secoes ps
   set dentista_id = pc.dentista_id
  from public.pacientes pc
 where pc.id = ps.paciente_id
   and ps.dentista_id is null;

update public.paciente_documentos pd
   set dentista_id = pc.dentista_id
  from public.pacientes pc
 where pc.id = pd.paciente_id
   and pd.dentista_id is null;

update public.tratamentos t
   set dentista_id = pc.dentista_id
  from public.pacientes pc
 where pc.id = t.paciente_id
   and t.dentista_id is null;

create index if not exists idx_planejamento_procedimentos_dentista
  on public.planejamento_procedimentos (dentista_id);
create index if not exists idx_planejamento_secoes_dentista
  on public.planejamento_secoes (dentista_id);
create index if not exists idx_paciente_documentos_dentista
  on public.paciente_documentos (dentista_id);
create index if not exists idx_tratamentos_dentista
  on public.tratamentos (dentista_id);

comment on column public.tratamentos.dentista_id is
  'Dono do CONTAINER (quem abriu o caso) — só ele renomeia/encerra. O tratamento em si é
   COMPARTILHADO: qualquer dentista da clínica lê e anexa a própria ficha nele (fichas.tratamento_id).
   Anexar ficha NÃO é mexer no tratamento. Ver §3 da spec 2026-07-16.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. A coluna zumbi: pacientes.dentista_id perde o poder de RLS
-- ─────────────────────────────────────────────────────────────────────
comment on column public.pacientes.dentista_id is
  'INFORMATIVO — quem cadastrou o paciente. NÃO governa visibilidade desde a migration 099
   (Spec 1 Hierarquia 3.1): o paciente é da clínica. NUNCA usar como filtro de RLS nem como
   filtro implícito de query "meus pacientes" sem intenção explícita.
   Ver plans/specs/2026-07-16-hierarquia-3.1-nucleo-clinico-spec.md, invariante #5.';

-- ─────────────────────────────────────────────────────────────────────
-- 3. pacientes: split do FOR ALL em leitura aberta + escrita da clínica
--    (dentista, secretária e bot criam — o paciente é da clínica)
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists pacientes_access on public.pacientes;

create policy pacientes_select on public.pacientes
  for select
  using (belongs_to_active_clinic(clinica_id) and is_clinic_staff());

-- is_clinic_staff() aqui também: sem ele o protético poderia CRIAR e APAGAR paciente.
create policy pacientes_write on public.pacientes
  for all
  using      (belongs_to_active_clinic(clinica_id) and is_clinic_staff())
  with check (belongs_to_active_clinic(clinica_id) and is_clinic_staff());

-- ─────────────────────────────────────────────────────────────────────
-- 4. fichas: abre SÓ a leitura.
--
-- A escrita já está correta e NÃO é tocada: fichas_write_own (FOR ALL) segue
-- com dentista_id = get_my_dentista_id(). Policies permissivas são OR por
-- comando, então abrir fichas_select não afrouxa UPDATE/DELETE.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists fichas_select on public.fichas;

create policy fichas_select on public.fichas
  for select
  using (belongs_to_active_clinic(clinica_id) and is_clinic_staff());

-- ─────────────────────────────────────────────────────────────────────
-- 5. planejamento_procedimentos: leitura clínica, escrita do autor
--
-- can_act_as_dentista (migration 098) já significa "posso agir em nome deste
-- dentista?" — true pro próprio E pra secretária agindo por dentista ativo.
-- Reuso, não abstração nova.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists planejamento_procedimentos_select    on public.planejamento_procedimentos;
drop policy if exists planejamento_procedimentos_write_own on public.planejamento_procedimentos;

create policy planejamento_procedimentos_select on public.planejamento_procedimentos
  for select
  using (belongs_to_active_clinic(clinica_id) and is_clinic_staff());

create policy planejamento_procedimentos_write_own on public.planejamento_procedimentos
  for all
  using      (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

-- ─────────────────────────────────────────────────────────────────────
-- 6. planejamento_secoes: leitura clínica, escrita do autor
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists planejamento_secoes_select    on public.planejamento_secoes;
drop policy if exists planejamento_secoes_write_own on public.planejamento_secoes;

create policy planejamento_secoes_select on public.planejamento_secoes
  for select
  using (belongs_to_active_clinic(clinica_id) and is_clinic_staff());

create policy planejamento_secoes_write_own on public.planejamento_secoes
  for all
  using      (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

-- ─────────────────────────────────────────────────────────────────────
-- 7. paciente_documentos: leitura clínica, escrita do autor
--
-- Nota: o STORAGE desses arquivos (buckets fichas/radiografias/audios) JÁ era
-- aberto por clinica_id — nunca houve silo de arquivo. Isto aqui só torna a
-- tabela coerente com o que os objetos já faziam. Ver §6 da spec.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists paciente_documentos_access on public.paciente_documentos;

create policy paciente_documentos_select on public.paciente_documentos
  for select
  using (belongs_to_active_clinic(clinica_id) and is_clinic_staff());

create policy paciente_documentos_write_own on public.paciente_documentos
  for all
  using      (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

-- ─────────────────────────────────────────────────────────────────────
-- 8. tratamentos: FECHA a escrita no autor.
--
-- Furo corrigido: tratamentos_update_dentistas deixava QUALQUER dentista da
-- clínica editar/encerrar o tratamento de qualquer outro, sem autoria — a
-- invariante "A vê ZERO de B" já era falsa aqui antes desta spec.
-- A leitura continua aberta (já era) — o tratamento é o caso do paciente.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists clinica_isolamento                on public.tratamentos;
drop policy if exists tratamentos_select_clinic_members on public.tratamentos;
drop policy if exists tratamentos_insert_dentistas      on public.tratamentos;
drop policy if exists tratamentos_update_dentistas      on public.tratamentos;
drop policy if exists tratamentos_delete_dentistas      on public.tratamentos;

create policy tratamentos_select on public.tratamentos
  for select
  using (belongs_to_active_clinic(clinica_id) and is_clinic_staff());

create policy tratamentos_write_own on public.tratamentos
  for all
  using      (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

-- ─────────────────────────────────────────────────────────────────────
-- 9. Conflito de agenda por PACIENTE, sem vazar a agenda alheia
--
-- Problema que a leitura aberta cria: dois dentistas passam a enxergar o mesmo
-- paciente e podem agendá-lo no mesmo horário. A detecção atual é client-side e
-- filtra por dentista_id — o dentista A literalmente não tem os agendamentos do
-- B em memória (RLS da agenda é silo e CONTINUA sendo).
--
-- SECURITY DEFINER de propósito: é o único jeito de ter as duas coisas — silo da
-- agenda intacto E conflito barrado. Retorna boolean e NADA MAIS.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.paciente_tem_conflito_agenda(
  p_paciente_id uuid,
  p_inicio      timestamptz,
  p_duracao_min integer,
  p_ignorar_id  uuid default null
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
       and a.status in ('scheduled', 'confirmed', 'checked_in', 'in_progress')
       and (p_ignorar_id is null or a.id <> p_ignorar_id)
       and tstzrange(a.data_hora, a.data_hora + make_interval(mins => a.duracao_minutos))
        && tstzrange(p_inicio,    p_inicio    + make_interval(mins => p_duracao_min))
  )
$$;

comment on function public.paciente_tem_conflito_agenda(uuid, timestamptz, integer, uuid) is
  'Responde APENAS "esse paciente já tem compromisso nesse intervalo? sim/não". SECURITY DEFINER
   de propósito: o chamador não pode ver a agenda de outro dentista (silo mantido), mas precisa
   ser barrado se ela colidir. PROIBIDO evoluir esta função para retornar horário, dentista ou
   procedimento do conflito — invariante #3 da spec 2026-07-16. Escopo travado na clínica ativa
   do chamador via get_my_clinica_id().';

-- Helper de RLS/SECURITY DEFINER precisa de EXECUTE para authenticated.
-- Revogar de anon/public é o correto (padrão das migrations 091/093/095);
-- revogar de authenticated QUEBRARIA o fluxo.
revoke execute on function public.paciente_tem_conflito_agenda(uuid, timestamptz, integer, uuid) from anon, public;
grant  execute on function public.paciente_tem_conflito_agenda(uuid, timestamptz, integer, uuid) to authenticated;

commit;
