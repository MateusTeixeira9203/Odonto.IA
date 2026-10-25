-- OD-015b1 M3: SPEC FINAL revista + secao3b aprovada. So escrever/revisar nesta entrega.
-- Aplicacao SOMENTE pelo Orquestrador na janela autorizada do odonto-qa.
-- Assinatura unica de5argumentos; confirmacao do orcamento sem default.
-- Orcamento aceito/financeiro e preservado; r169d revogada e nunca chamada.
-- Base efetiva guardada em scratchpad/od015m3-effective-decoded.json.
-- Reaplicacao guarda auditoria e valida formato; volta nao devolve execute da r169d.
begin;

-- Auditoria de exclusões do prontuário: quem, quando, o quê e um RESUMO (só contagens e datas).
-- Nenhum texto clínico, número de dente ou nome de procedimento. Lida só por admin e dentista.
-- Idempotente: a volta mantém a tabela de auditoria; reaplicar não pode falhar nem apagar linhas.
create table if not exists public.prontuario_exclusoes (
  id                   uuid primary key default gen_random_uuid(),
  clinica_id           uuid not null references public.clinicas(id) on delete cascade,
  tipo                 text not null check (tipo in ('ficha', 'atendimento_vazio')),
  paciente_id          uuid,          -- sem FK: o registro sobrevive à exclusão do paciente
  ficha_id             uuid,          -- sem FK: a ficha não existe mais
  atendimento_id       uuid,          -- sem FK
  excluido_por         uuid not null, -- dentistas.id no ato
  excluido_por_usuario uuid not null, -- auth.uid() no ato
  motivo               text check (motivo in
                         ('paciente_errado', 'ficha_duplicada', 'aberta_por_engano', 'registro_incompleto', 'outro')),
  motivo_detalhe       text check (motivo_detalhe is null or char_length(motivo_detalhe) between 5 and 200),
  resumo               jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  constraint prontuario_exclusoes_alvo check (
    (tipo = 'ficha' and ficha_id is not null and motivo is not null)
    or (tipo = 'atendimento_vazio' and atendimento_id is not null and motivo is null)),
  constraint prontuario_exclusoes_detalhe_so_outro check (
    (motivo = 'outro') = (motivo_detalhe is not null))
);

-- Trava: se a tabela já existia com outro formato, para em vez de seguir em silêncio.
do $$
begin
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'prontuario_exclusoes'
        and column_name in ('id', 'clinica_id', 'tipo', 'paciente_id', 'ficha_id', 'atendimento_id',
                            'excluido_por', 'excluido_por_usuario', 'motivo', 'motivo_detalhe',
                            'resumo', 'created_at')) <> 12
     or (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'prontuario_exclusoes') <> 12
     or not exists (select 1 from pg_constraint
                    where conrelid = 'public.prontuario_exclusoes'::regclass
                      and conname in ('prontuario_exclusoes_alvo', 'prontuario_exclusoes_detalhe_so_outro')
                    having count(*) = 2) then
    raise exception 'prontuario_exclusoes_formato_inesperado';
  end if;
end $$;

comment on table public.prontuario_exclusoes is
  'OD-015b1-2 — auditoria de exclusão de ficha e de visita vazia. Resumo sem conteúdo clínico. '
  'Escrita só pelas funções excluir_ficha_clinica e descartar_atendimento_vazio; leitura só admin/dentista.';

create index if not exists prontuario_exclusoes_clinica_idx
  on public.prontuario_exclusoes (clinica_id, created_at desc);
create index if not exists prontuario_exclusoes_paciente_idx
  on public.prontuario_exclusoes (clinica_id, paciente_id, created_at desc);

alter table public.prontuario_exclusoes enable row level security;
revoke all on table public.prontuario_exclusoes from public, anon, authenticated;
grant select on table public.prontuario_exclusoes to authenticated;

drop policy if exists prontuario_exclusoes_select on public.prontuario_exclusoes;
create policy prontuario_exclusoes_select on public.prontuario_exclusoes
  for select to authenticated
  using (public.belongs_to_active_clinic(clinica_id) and public.is_clinic_dentista());
-- Sem policy de insert/update/delete: só as funções SECURITY DEFINER escrevem.

create or replace function public.descartar_atendimento_vazio(p_atendimento_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller     uuid := public.get_my_dentista_id();
  v_role       text := public.get_my_role();
  v_row        public.atendimentos_clinicos%rowtype;
begin
  if v_clinica_id is null or v_caller is null
     or coalesce(v_role, '') not in ('admin', 'dentista')
     or not public.has_active_membership() then
    raise exception 'sem_permissao';
  end if;

  select * into v_row
  from public.atendimentos_clinicos a
  where a.id = p_atendimento_id and a.clinica_id = v_clinica_id
  for update;
  if not found then raise exception 'atendimento_nao_encontrado'; end if;
  if v_row.dentista_id <> v_caller then raise exception 'sem_permissao'; end if;

  if exists (select 1 from public.atendimento_eventos ae where ae.atendimento_id = v_row.id)
     or exists (select 1 from public.ficha_evolucoes fe where fe.atendimento_id = v_row.id)
     or exists (select 1 from public.estoque_usos eu where eu.atendimento_id = v_row.id) then
    raise exception 'atendimento_com_conteudo';
  end if;

  delete from public.atendimentos_clinicos where id = v_row.id;

  insert into public.prontuario_exclusoes
    (clinica_id, tipo, paciente_id, atendimento_id, excluido_por, excluido_por_usuario, resumo)
  values
    (v_clinica_id, 'atendimento_vazio', v_row.paciente_id, v_row.id, v_caller, auth.uid(),
     jsonb_build_object('estado', v_row.estado, 'origem', v_row.origem,
                        'data_atendimento', v_row.data_atendimento, 'criado_em', v_row.created_at));
  return true;
end;
$$;

create or replace function public.excluir_ficha_clinica(
  p_ficha_id                  uuid,
  p_motivo                    text,
  p_motivo_detalhe            text,
  p_nome_paciente             text,
  p_confirma_orcamento_aceito boolean   -- sem default: quem chama tem de dizer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller     uuid := public.get_my_dentista_id();
  v_role       text := public.get_my_role();
  v_ficha      public.fichas%rowtype;
  v_nome       text;
  v_detalhe    text := nullif(btrim(coalesce(p_motivo_detalhe, '')), '');
  v_eventos    uuid[];
  v_orcs       uuid[];
  v_mantidos   uuid[];
  v_apagados   int;
  v_pontes     int;
  v_visitas    uuid[];
  v_vazias     uuid[] := '{}';
  v_id         uuid;
  v_resumo     jsonb;
  v_exclusao   uuid;
begin
  if v_clinica_id is null or v_caller is null
     or coalesce(v_role, '') not in ('admin', 'dentista')
     or not public.has_active_membership() then
    raise exception 'sem_permissao';
  end if;
  -- fichas tem a policy RESTRITIVA commercial_write_fichas; SECURITY DEFINER passa por cima da RLS.
  if not private.commercial_write_allowed(v_clinica_id) then
    raise exception 'cobranca_bloqueada';
  end if;

  select * into v_ficha from public.fichas f
  where f.id = p_ficha_id and f.clinica_id = v_clinica_id
  for update;
  if not found then raise exception 'ficha_nao_encontrada'; end if;
  if v_ficha.dentista_id <> v_caller then raise exception 'sem_permissao'; end if;

  -- 1. Prova clínica: sempre recusa. O aceite DO ORÇAMENTO não é prova clínica (tratado no passo 5).
  if v_ficha.assinado_em is not null or v_ficha.assinatura_url is not null
     or exists (select 1 from public.odontograma_eventos e
                where e.ficha_id = v_ficha.id and e.assinatura_id is not null)
     or exists (select 1 from public.assinaturas a
                where a.ficha_id = v_ficha.id and a.tipo <> 'orcamento')
     or exists (select 1 from public.documentos_aceite d
                where d.ficha_id = v_ficha.id and d.tipo <> 'orcamento') then
    raise exception 'ficha_assinada';
  end if;

  -- 2. Procedimentos da ficha, travados.
  perform 1 from public.odontograma_eventos e
  where e.ficha_id = v_ficha.id and e.clinica_id = v_clinica_id
  order by e.id for update;
  select coalesce(array_agg(e.id), '{}') into v_eventos
  from public.odontograma_eventos e
  where e.ficha_id = v_ficha.id and e.clinica_id = v_clinica_id;

  -- 3. Os gatilhos da prova clínica barram apagar procedimento retirado ou encaminhado a outro
  --    dentista. Recusa clara antes, em vez do erro do gatilho.
  if exists (select 1 from public.odontograma_eventos e
             where e.id = any(v_eventos) and e.retirado_em is not null) then
    raise exception 'ficha_com_retirado';
  end if;
  if exists (select 1 from public.odontograma_eventos e
             where e.id = any(v_eventos)
               and e.encaminhado_para is not null and e.encaminhado_para <> v_caller) then
    raise exception 'ficha_com_encaminhamento';
  end if;

  -- 4. Motivo e nome do paciente (confirmação forte conferida no banco).
  if p_motivo is null or p_motivo not in
       ('paciente_errado', 'ficha_duplicada', 'aberta_por_engano', 'registro_incompleto', 'outro')
     or (p_motivo = 'outro' and (v_detalhe is null or char_length(v_detalhe) not between 5 and 200)) then
    raise exception 'motivo_invalido';
  end if;
  if p_motivo <> 'outro' then v_detalhe := null; end if;

  select p.nome into v_nome from public.pacientes p
  where p.id = v_ficha.paciente_id and p.clinica_id = v_clinica_id;
  if v_nome is null
     or lower(regexp_replace(btrim(coalesce(p_nome_paciente, '')), '\s+', ' ', 'g'))
        <> lower(regexp_replace(btrim(v_nome), '\s+', ' ', 'g')) then
    raise exception 'confirmacao_invalida';
  end if;

  -- 5. Orçamentos da ficha (pelo ficha_id ou pelas pontes), travados.
  perform 1 from public.orcamentos o
  where o.clinica_id = v_clinica_id
    and (o.ficha_id = v_ficha.id
         or o.id in (select oe.orcamento_id from public.orcamento_eventos oe
                     where oe.evento_id = any(v_eventos)))
  order by o.id for update;
  select coalesce(array_agg(o.id), '{}') into v_orcs
  from public.orcamentos o
  where o.clinica_id = v_clinica_id
    and (o.ficha_id = v_ficha.id
         or o.id in (select oe.orcamento_id from public.orcamento_eventos oe
                     where oe.evento_id = any(v_eventos)));

  if exists (select 1 from public.orcamentos o
             where o.id = any(v_orcs) and o.paciente_id is distinct from v_ficha.paciente_id) then
    raise exception 'ficha_contexto_invalido';
  end if;

  -- Orçamento com aceite ou com movimento financeiro: é MANTIDO, e só se apaga a ficha
  -- com a caixa de confirmação marcada.
  select coalesce(array_agg(o.id), '{}') into v_mantidos
  from public.orcamentos o
  where o.id = any(v_orcs)
    and (o.status = 'aprovado' or o.aprovado_em is not null
         or exists (select 1 from public.orcamento_itens i where i.orcamento_id = o.id and i.aprovado)
         or exists (select 1 from public.assinaturas a where a.orcamento_id = o.id)
         or exists (select 1 from public.documentos_aceite d where d.orcamento_id = o.id)
         or exists (select 1 from public.pagamentos p where p.orcamento_id = o.id)
         or exists (select 1 from public.orcamento_cobrancas c where c.orcamento_id = o.id));

  if cardinality(v_mantidos) > 0 and p_confirma_orcamento_aceito is not true then
    raise exception 'confirmar_orcamento_aceito';
  end if;

  -- Orçamento sem aceite e sem movimento, ligado à ficha: sai junto, como antes.
  select count(*) into v_apagados from public.orcamentos o
  where o.id = any(v_orcs) and not (o.id = any(v_mantidos)) and o.ficha_id = v_ficha.id;
  select count(*) into v_pontes from public.orcamento_eventos oe where oe.evento_id = any(v_eventos);

  select coalesce(array_agg(distinct s.x), '{}') into v_visitas from (
    select fe.atendimento_id as x from public.ficha_evolucoes fe
    where fe.ficha_id = v_ficha.id and fe.atendimento_id is not null
    union
    select ae.atendimento_id from public.atendimento_eventos ae
    where ae.evento_id = any(v_eventos)
  ) s;

  -- RESUMO: só contagens, datas e ids. Nada de texto, dente ou nome de procedimento.
  v_resumo := jsonb_build_object(
    'data_atendimento',  v_ficha.data_atendimento,
    'ficha_criada_em',   v_ficha.created_at,
    'origem',            v_ficha.origem,
    'evolucoes',         (select count(*) from public.ficha_evolucoes fe where fe.ficha_id = v_ficha.id),
    'procedimentos',     cardinality(v_eventos),
    'procedimentos_realizados',
                         (select count(*) from public.odontograma_eventos e
                          where e.id = any(v_eventos) and e.status = 'realizado'),
    'arquivos',          (select count(*) from public.ficha_arquivos a where a.ficha_id = v_ficha.id),
    'planejamentos',     (select count(*) from public.planejamentos p where p.ficha_id = v_ficha.id),
    'orcamentos_apagados',            v_apagados,
    'orcamentos_mantidos',            cardinality(v_mantidos),
    'orcamentos_mantidos_ids',        to_jsonb(v_mantidos),
    'vinculos_orcamento_desligados',  v_pontes,
    'confirmou_orcamento_aceito',     cardinality(v_mantidos) > 0);

  -- 6. Desliga o orçamento mantido da ficha. Nada comercial é apagado.
  update public.orcamentos set ficha_id = null
  where id = any(v_mantidos) and ficha_id = v_ficha.id;
  update public.documentos_aceite set ficha_id = null
  where ficha_id = v_ficha.id and tipo = 'orcamento';
  delete from public.orcamento_eventos where evento_id = any(v_eventos);

  delete from public.fichas where id = v_ficha.id;

  foreach v_id in array v_visitas loop
    delete from public.atendimentos_clinicos a
    where a.id = v_id and a.clinica_id = v_clinica_id and a.dentista_id = v_caller
      and not exists (select 1 from public.atendimento_eventos ae where ae.atendimento_id = a.id)
      and not exists (select 1 from public.ficha_evolucoes fe where fe.atendimento_id = a.id)
      and not exists (select 1 from public.estoque_usos eu where eu.atendimento_id = a.id);
    if found then v_vazias := v_vazias || v_id; end if;
  end loop;

  insert into public.prontuario_exclusoes
    (clinica_id, tipo, paciente_id, ficha_id, excluido_por, excluido_por_usuario,
     motivo, motivo_detalhe, resumo)
  values
    (v_clinica_id, 'ficha', v_ficha.paciente_id, v_ficha.id, v_caller, auth.uid(),
     p_motivo, v_detalhe,
     v_resumo || jsonb_build_object('visitas_descartadas', cardinality(v_vazias)))
  returning id into v_exclusao;

  return jsonb_build_object('exclusao_id', v_exclusao,
                            'visitas_descartadas', cardinality(v_vazias),
                            'orcamentos_mantidos', cardinality(v_mantidos));
end;
$$;

revoke all on function public.descartar_atendimento_vazio(uuid) from public, anon;
grant execute on function public.descartar_atendimento_vazio(uuid) to authenticated;
revoke all on function public.excluir_ficha_clinica(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.excluir_ficha_clinica(uuid, text, text, text, boolean) to authenticated;

-- r169d: fica no banco (é a base da migração registrada em produção), mas ninguém do app chama mais.
-- Motivo: apaga sem motivo, sem nome e sem caixa de confirmação, e grava nomes de procedimento num log que a secretária lê.
revoke execute on function public.excluir_ficha_propria_preservando_financeiro(uuid)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
