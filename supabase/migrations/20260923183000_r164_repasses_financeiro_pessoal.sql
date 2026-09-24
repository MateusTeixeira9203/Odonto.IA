-- R-164: acordos de repasse e ganho profissional na clínica gerida.
-- O caixa continua pertencendo à clínica. Repasses previstos não criam despesa.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create table if not exists public.acordos_repasse (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  dentista_id uuid not null references public.dentistas(id) on delete cascade,
  modalidade text not null check (modalidade in ('percentual_recebido', 'diaria', 'mensal_fixo')),
  percentual numeric(5,2),
  valor_fixo numeric(12,2),
  vigente_desde date not null,
  vigente_ate date,
  ativo boolean not null default true,
  observacao text,
  criado_por_usuario_id uuid not null references auth.users(id),
  atualizado_por_usuario_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vigente_ate is null or vigente_ate >= vigente_desde),
  check (
    (modalidade = 'percentual_recebido' and percentual > 0 and percentual <= 100 and valor_fixo is null)
    or (modalidade in ('diaria', 'mensal_fixo') and valor_fixo > 0 and percentual is null)
  )
);

create table if not exists public.repasses (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  dentista_id uuid not null references public.dentistas(id) on delete cascade,
  acordo_id uuid not null references public.acordos_repasse(id) on delete restrict,
  origem text not null check (origem in ('percentual', 'diaria', 'mensal')),
  modalidade_snapshot text not null check (modalidade_snapshot in ('percentual_recebido', 'diaria', 'mensal_fixo')),
  percentual_snapshot numeric(5,2),
  valor_fixo_snapshot numeric(12,2),
  competencia date not null,
  periodo_inicio date,
  periodo_fim date,
  valor numeric(12,2) not null check (valor > 0),
  status text not null default 'previsto' check (status in ('previsto', 'pago', 'cancelado')),
  pago_em date,
  despesa_id uuid unique references public.despesas(id) on delete restrict,
  criado_por_usuario_id uuid not null references auth.users(id),
  pago_por_usuario_id uuid references auth.users(id),
  cancelado_por_usuario_id uuid references auth.users(id),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pago') = (pago_em is not null and despesa_id is not null)),
  check (periodo_inicio is null or periodo_fim is null or periodo_fim >= periodo_inicio)
);

create table if not exists public.repasse_pagamentos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  repasse_id uuid not null references public.repasses(id) on delete cascade,
  pagamento_id uuid not null references public.pagamentos(id) on delete restrict,
  valor_base numeric(12,2) not null check (valor_base > 0),
  percentual_snapshot numeric(5,2) not null check (percentual_snapshot > 0 and percentual_snapshot <= 100),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.repasse_diarias (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  acordo_id uuid not null references public.acordos_repasse(id) on delete restrict,
  dentista_id uuid not null references public.dentistas(id) on delete cascade,
  repasse_id uuid unique references public.repasses(id) on delete restrict,
  data_trabalhada date not null,
  valor_snapshot numeric(12,2) not null check (valor_snapshot > 0),
  estado text not null default 'ativo' check (estado in ('ativo', 'cancelado')),
  criado_por_usuario_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists acordos_repasse_clinica_dentista_idx
  on public.acordos_repasse (clinica_id, dentista_id, ativo, vigente_desde desc);
create index if not exists repasses_clinica_competencia_idx
  on public.repasses (clinica_id, competencia desc, status, dentista_id);
create index if not exists repasse_pagamentos_repasse_idx on public.repasse_pagamentos (repasse_id);
create unique index if not exists repasse_pagamento_ativo_unico_idx
  on public.repasse_pagamentos (pagamento_id) where ativo;
create unique index if not exists repasse_fixo_ativo_unico_idx
  on public.repasses (acordo_id, competencia, origem)
  where status <> 'cancelado' and origem in ('diaria', 'mensal');
create unique index if not exists repasse_diaria_ativa_unica_idx
  on public.repasse_diarias (acordo_id, data_trabalhada) where estado = 'ativo';

alter table public.acordos_repasse enable row level security;
alter table public.repasses enable row level security;
alter table public.repasse_pagamentos enable row level security;
alter table public.repasse_diarias enable row level security;
revoke all on table public.acordos_repasse, public.repasses, public.repasse_pagamentos, public.repasse_diarias from public, anon, authenticated;

create or replace function private.r164_tem_permissao_repasse(
  p_clinica_id uuid,
  p_membro_id uuid,
  p_permissao text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.clinica_vinculos_governanca v
    where v.clinica_id = p_clinica_id
      and v.membro_id = p_membro_id
      and v.papel = 'proprietario'
      and v.estado = 'ativo'
  ) or exists (
    select 1
    from public.clinica_acessos a
    cross join lateral jsonb_array_elements(a.acessos) item
    where a.clinica_id = p_clinica_id
      and a.membro_id = p_membro_id
      and item ->> 'permissao' = p_permissao
      and item -> 'escopo' ->> 'tipo' = 'clinica'
  );
$$;

create or replace function private.r164_validar_vigencia_acordo()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.ativo and exists (
    select 1
    from public.acordos_repasse a
    where a.clinica_id = new.clinica_id
      and a.dentista_id = new.dentista_id
      and a.ativo
      and a.id <> new.id
      and daterange(a.vigente_desde, coalesce(a.vigente_ate, 'infinity'::date), '[]')
        && daterange(new.vigente_desde, coalesce(new.vigente_ate, 'infinity'::date), '[]')
  ) then
    raise exception 'vigência do acordo sobreposta';
  end if;
  return new;
end;
$$;

drop trigger if exists r164_validar_vigencia_acordo on public.acordos_repasse;
create trigger r164_validar_vigencia_acordo
before insert or update of clinica_id, dentista_id, vigente_desde, vigente_ate, ativo
on public.acordos_repasse
for each row execute function private.r164_validar_vigencia_acordo();

create or replace function public.obter_repasses_clinica(
  p_clinica_id_esperada uuid,
  p_mes_referencia date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
  v_membro_id uuid;
  v_role text;
  v_inicio date;
  v_fim date;
  v_pode_ler boolean := false;
  v_pode_gerir boolean := false;
  v_repasses jsonb := '[]'::jsonb;
  v_profissionais jsonb := '[]'::jsonb;
begin
  if v_ator_id is null or p_clinica_id_esperada is null or p_mes_referencia is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso aos repasses da clínica.');
  end if;
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  select cu.id, cu.role into v_membro_id, v_role from public.clinica_usuarios cu
  where cu.usuario_id = v_ator_id and cu.clinica_id = v_clinica_id and cu.status = 'ativo' limit 1;
  if v_membro_id is null or v_role = 'secretaria' then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não tem acesso aos repasses da clínica.');
  end if;
  v_pode_ler := private.r164_tem_permissao_repasse(v_clinica_id, v_membro_id, 'repasses.ler')
    or private.r164_tem_permissao_repasse(v_clinica_id, v_membro_id, 'repasses.gerir');
  if not v_pode_ler then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não tem acesso aos repasses da clínica.');
  end if;
  v_pode_gerir := private.r164_tem_permissao_repasse(v_clinica_id, v_membro_id, 'repasses.gerir');
  v_inicio := date_trunc('month', p_mes_referencia)::date;
  v_fim := (v_inicio + interval '1 month')::date;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id::text, 'dentistaId', r.dentista_id::text, 'nome', d.nome,
    'origem', r.origem, 'competencia', to_char(r.competencia, 'YYYY-MM-DD'),
    'valor', r.valor, 'status', r.status, 'pagoEm', case when r.pago_em is null then null else to_char(r.pago_em, 'YYYY-MM-DD') end
  ) order by r.status = 'previsto' desc, r.competencia desc, d.nome), '[]'::jsonb)
  into v_repasses
  from public.repasses r join public.dentistas d on d.id = r.dentista_id and d.clinica_id = r.clinica_id
  where r.clinica_id = v_clinica_id and r.competencia >= v_inicio and r.competencia < v_fim;
  select coalesce(jsonb_agg(jsonb_build_object(
    'dentistaId', d.id::text, 'nome', d.nome,
    'acordo', case when a.id is null then null else jsonb_build_object('id', a.id::text, 'modalidade', a.modalidade, 'percentual', a.percentual, 'valorFixo', a.valor_fixo, 'vigenteDesde', to_char(a.vigente_desde, 'YYYY-MM-DD')) end,
    'previsto', coalesce((select sum(r.valor) from public.repasses r where r.clinica_id = v_clinica_id and r.dentista_id = d.id and r.competencia >= v_inicio and r.competencia < v_fim and r.status = 'previsto'), 0),
    'pago', coalesce((select sum(r.valor) from public.repasses r where r.clinica_id = v_clinica_id and r.dentista_id = d.id and r.competencia >= v_inicio and r.competencia < v_fim and r.status = 'pago'), 0)
  ) order by d.nome), '[]'::jsonb)
  into v_profissionais
  from public.dentistas d
  left join lateral (
    select a.* from public.acordos_repasse a
    where a.clinica_id = d.clinica_id and a.dentista_id = d.id and a.ativo
      and a.vigente_desde <= v_fim - 1 and (a.vigente_ate is null or a.vigente_ate >= v_inicio)
    order by a.vigente_desde desc limit 1
  ) a on true
  where d.clinica_id = v_clinica_id and d.ativo and d.role in ('admin', 'dentista');
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('clinicaId', v_clinica_id::text, 'mes', to_char(v_inicio, 'YYYY-MM'), 'podeGerir', v_pode_gerir, 'repasses', v_repasses, 'profissionais', v_profissionais));
exception when lock_not_available or query_canceled then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar os repasses agora.');
when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar os repasses agora.');
end;
$$;

create or replace function public.obter_meu_financeiro_gerido(
  p_clinica_id_esperada uuid,
  p_mes_referencia date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
  v_membro_id uuid;
  v_dentista_id uuid;
  v_inicio date;
  v_fim date;
  v_acordo jsonb;
  v_repasses jsonb;
begin
  if v_ator_id is null or p_clinica_id_esperada is null or p_mes_referencia is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso ao seu financeiro.');
  end if;
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  select cu.id into v_membro_id from public.clinica_usuarios cu
  where cu.usuario_id = v_ator_id and cu.clinica_id = v_clinica_id and cu.status = 'ativo' limit 1;
  if v_membro_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à clínica ativa.');
  end if;
  if not exists (select 1 from public.clinica_governanca g where g.clinica_id = v_clinica_id and g.modalidade = 'gerida') then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Este financeiro pessoal não usa repasses.');
  end if;
  select d.id into v_dentista_id from public.dentistas d
  where d.clinica_id = v_clinica_id and d.user_id = v_ator_id and d.ativo and d.role in ('admin', 'dentista') limit 1;
  if v_dentista_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Perfil clínico obrigatório.');
  end if;
  v_inicio := date_trunc('month', p_mes_referencia)::date;
  v_fim := (v_inicio + interval '1 month')::date;
  select case when a.id is null then null else jsonb_build_object('id', a.id::text, 'modalidade', a.modalidade, 'percentual', a.percentual, 'valorFixo', a.valor_fixo, 'vigenteDesde', to_char(a.vigente_desde, 'YYYY-MM-DD'), 'vigenteAte', case when a.vigente_ate is null then null else to_char(a.vigente_ate, 'YYYY-MM-DD') end) end
  into v_acordo
  from (select 1) x left join lateral (
    select a.* from public.acordos_repasse a where a.clinica_id = v_clinica_id and a.dentista_id = v_dentista_id and a.ativo and a.vigente_desde <= v_fim - 1 and (a.vigente_ate is null or a.vigente_ate >= v_inicio) order by a.vigente_desde desc limit 1
  ) a on true;
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id::text, 'origem', r.origem, 'competencia', to_char(r.competencia, 'YYYY-MM-DD'), 'valor', r.valor, 'status', r.status, 'pagoEm', case when r.pago_em is null then null else to_char(r.pago_em, 'YYYY-MM-DD') end) order by r.competencia desc), '[]'::jsonb)
  into v_repasses from public.repasses r where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.competencia >= v_inicio and r.competencia < v_fim;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'clinicaId', v_clinica_id::text, 'mes', to_char(v_inicio, 'YYYY-MM'),
    'producaoAprovada', coalesce((select sum(coalesce(o.valor_acordado, o.total, 0)) from public.orcamentos o where o.clinica_id = v_clinica_id and o.dentista_id = v_dentista_id and o.titular_financeiro = 'clinica' and o.status = 'aprovado' and o.updated_at >= v_inicio and o.updated_at < v_fim), 0),
    'pagamentosVinculados', coalesce((select sum(p.valor) from public.pagamentos p where p.clinica_id = v_clinica_id and p.dentista_id = v_dentista_id and p.titular_financeiro = 'clinica' and p.status = 'pago' and p.data_pagamento >= v_inicio and p.data_pagamento < v_fim), 0),
    'repassePrevisto', coalesce((select sum(r.valor) from public.repasses r where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.competencia >= v_inicio and r.competencia < v_fim and r.status = 'previsto'), 0),
    'repassePago', coalesce((select sum(r.valor) from public.repasses r where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.competencia >= v_inicio and r.competencia < v_fim and r.status = 'pago'), 0),
    'acordo', v_acordo, 'repasses', v_repasses
  ));
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar seu financeiro agora.');
end;
$$;

create or replace function public.salvar_acordo_repasse(
  p_clinica_id_esperada uuid,
  p_dentista_id uuid,
  p_modalidade text,
  p_percentual numeric,
  p_valor_fixo numeric,
  p_vigente_desde date,
  p_vigente_ate date,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid(); v_clinica_id uuid; v_membro_id uuid; v_role text; v_acordo public.acordos_repasse%rowtype;
begin
  if p_modalidade not in ('percentual_recebido', 'diaria', 'mensal_fixo') or p_vigente_desde is null or (p_vigente_ate is not null and p_vigente_ate < p_vigente_desde)
    or (p_modalidade = 'percentual_recebido' and (p_percentual is null or p_percentual <= 0 or p_percentual > 100 or p_valor_fixo is not null))
    or (p_modalidade <> 'percentual_recebido' and (p_valor_fixo is null or p_valor_fixo <= 0 or p_percentual is not null)) then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Revise a regra e a vigência do acordo.');
  end if;
  select active_clinica_id into v_clinica_id from public.users where id = v_ator_id;
  select id, role into v_membro_id, v_role from public.clinica_usuarios where usuario_id = v_ator_id and clinica_id = v_clinica_id and status = 'ativo' limit 1;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada or v_membro_id is null or v_role = 'secretaria' or not private.r164_tem_permissao_repasse(v_clinica_id, v_membro_id, 'repasses.gerir') then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não pode configurar repasses nesta clínica.');
  end if;
  if not exists (select 1 from public.clinica_governanca g where g.clinica_id = v_clinica_id and g.modalidade = 'gerida') or not exists (select 1 from public.dentistas d where d.id = p_dentista_id and d.clinica_id = v_clinica_id and d.ativo) then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Profissional ou modalidade inválida.');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_dentista_id::text, 164));
  update public.acordos_repasse set ativo = false, vigente_ate = least(coalesce(vigente_ate, p_vigente_desde - 1), p_vigente_desde - 1), atualizado_por_usuario_id = v_ator_id, updated_at = now()
  where clinica_id = v_clinica_id and dentista_id = p_dentista_id and ativo and vigente_desde < p_vigente_desde;
  if exists (select 1 from public.acordos_repasse where clinica_id = v_clinica_id and dentista_id = p_dentista_id and ativo and vigente_desde >= p_vigente_desde) then
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'Já existe um acordo que começa nesta data ou depois dela.');
  end if;
  insert into public.acordos_repasse (clinica_id, dentista_id, modalidade, percentual, valor_fixo, vigente_desde, vigente_ate, observacao, criado_por_usuario_id, atualizado_por_usuario_id)
  values (v_clinica_id, p_dentista_id, p_modalidade, p_percentual, p_valor_fixo, p_vigente_desde, p_vigente_ate, nullif(btrim(p_observacao), ''), v_ator_id, v_ator_id) returning * into v_acordo;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_acordo.id::text));
exception when exclusion_violation or unique_violation or raise_exception then
  return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A vigência deste acordo conflita com outro acordo ativo.');
when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível salvar o acordo agora.');
end;
$$;

create or replace function public.gerar_repasse_percentual(
  p_clinica_id_esperada uuid,
  p_acordo_id uuid,
  p_inicio date,
  p_fim date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid(); v_clinica_id uuid; v_membro_id uuid; v_role text; v_acordo public.acordos_repasse%rowtype; v_repasse_id uuid; v_valor numeric;
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Revise o período do repasse.'); end if;
  select active_clinica_id into v_clinica_id from public.users where id = v_ator_id;
  select id, role into v_membro_id, v_role from public.clinica_usuarios where usuario_id = v_ator_id and clinica_id = v_clinica_id and status = 'ativo' limit 1;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada or v_membro_id is null or v_role = 'secretaria' or not private.r164_tem_permissao_repasse(v_clinica_id, v_membro_id, 'repasses.gerir') then return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não pode gerar repasses nesta clínica.'); end if;
  select * into v_acordo from public.acordos_repasse where id = p_acordo_id and clinica_id = v_clinica_id and ativo and modalidade = 'percentual_recebido' for update;
  if v_acordo.id is null then return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Acordo percentual ativo não encontrado.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_acordo.id::text, 164));
  select coalesce(sum(p.valor * v_acordo.percentual / 100), 0) into v_valor
  from public.pagamentos p
  left join public.repasse_pagamentos rp on rp.pagamento_id = p.id and rp.ativo
  where p.clinica_id = v_clinica_id and p.dentista_id = v_acordo.dentista_id and p.titular_financeiro = 'clinica' and p.status = 'pago'
    and p.data_pagamento >= greatest(p_inicio, v_acordo.vigente_desde) and p.data_pagamento <= least(p_fim, coalesce(v_acordo.vigente_ate, p_fim)) and rp.id is null;
  if v_valor <= 0 then return jsonb_build_object('ok', false, 'codigo', 'SEM_ORIGEM', 'mensagem', 'Não há recebimentos elegíveis para este acordo no período.'); end if;
  insert into public.repasses (clinica_id, dentista_id, acordo_id, origem, modalidade_snapshot, percentual_snapshot, competencia, periodo_inicio, periodo_fim, valor, criado_por_usuario_id)
  values (v_clinica_id, v_acordo.dentista_id, v_acordo.id, 'percentual', v_acordo.modalidade, v_acordo.percentual, date_trunc('month', p_fim)::date, p_inicio, p_fim, round(v_valor, 2), v_ator_id) returning id into v_repasse_id;
  insert into public.repasse_pagamentos (clinica_id, repasse_id, pagamento_id, valor_base, percentual_snapshot)
  select v_clinica_id, v_repasse_id, p.id, p.valor, v_acordo.percentual from public.pagamentos p left join public.repasse_pagamentos rp on rp.pagamento_id = p.id and rp.ativo
  where p.clinica_id = v_clinica_id and p.dentista_id = v_acordo.dentista_id and p.titular_financeiro = 'clinica' and p.status = 'pago'
    and p.data_pagamento >= greatest(p_inicio, v_acordo.vigente_desde) and p.data_pagamento <= least(p_fim, coalesce(v_acordo.vigente_ate, p_fim)) and rp.id is null;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_repasse_id::text, 'valor', round(v_valor, 2)));
exception when unique_violation then return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'Um recebimento foi usado por outro repasse. Atualize e tente novamente.');
when others then return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível gerar o repasse agora.'); end;
$$;

create or replace function public.gerar_repasse_fixo(
  p_clinica_id_esperada uuid,
  p_acordo_id uuid,
  p_competencia date,
  p_data_trabalhada date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid(); v_clinica_id uuid; v_membro_id uuid; v_role text; v_acordo public.acordos_repasse%rowtype; v_repasse_id uuid; v_origem text;
begin
  if p_competencia is null then return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Informe a competência do repasse.'); end if;
  select active_clinica_id into v_clinica_id from public.users where id = v_ator_id;
  select id, role into v_membro_id, v_role from public.clinica_usuarios where usuario_id = v_ator_id and clinica_id = v_clinica_id and status = 'ativo' limit 1;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada or v_membro_id is null or v_role = 'secretaria' or not private.r164_tem_permissao_repasse(v_clinica_id, v_membro_id, 'repasses.gerir') then return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não pode gerar repasses nesta clínica.'); end if;
  select * into v_acordo from public.acordos_repasse where id = p_acordo_id and clinica_id = v_clinica_id and ativo and modalidade in ('diaria', 'mensal_fixo') for update;
  if v_acordo.id is null then return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Acordo fixo ativo não encontrado.'); end if;
  v_origem := case when v_acordo.modalidade = 'diaria' then 'diaria' else 'mensal' end;
  if v_acordo.modalidade = 'diaria' and p_data_trabalhada is null then return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'A diária exige a data trabalhada.'); end if;
  if p_competencia < v_acordo.vigente_desde or (v_acordo.vigente_ate is not null and p_competencia > v_acordo.vigente_ate) then return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'A competência está fora da vigência do acordo.'); end if;
  insert into public.repasses (clinica_id, dentista_id, acordo_id, origem, modalidade_snapshot, valor_fixo_snapshot, competencia, periodo_inicio, periodo_fim, valor, criado_por_usuario_id)
  values (v_clinica_id, v_acordo.dentista_id, v_acordo.id, v_origem, v_acordo.modalidade, v_acordo.valor_fixo, case when v_origem = 'mensal' then date_trunc('month', p_competencia)::date else p_data_trabalhada end, case when v_origem = 'mensal' then date_trunc('month', p_competencia)::date else p_data_trabalhada end, case when v_origem = 'mensal' then (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date else p_data_trabalhada end, v_acordo.valor_fixo, v_ator_id) returning id into v_repasse_id;
  if v_origem = 'diaria' then insert into public.repasse_diarias (clinica_id, acordo_id, dentista_id, repasse_id, data_trabalhada, valor_snapshot, criado_por_usuario_id) values (v_clinica_id, v_acordo.id, v_acordo.dentista_id, v_repasse_id, p_data_trabalhada, v_acordo.valor_fixo, v_ator_id); end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_repasse_id::text, 'valor', v_acordo.valor_fixo));
exception when unique_violation then return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'Este repasse já foi gerado.');
when others then return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível gerar o repasse agora.'); end;
$$;

create or replace function public.pagar_repasse(
  p_clinica_id_esperada uuid,
  p_repasse_id uuid,
  p_data_pagamento date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid(); v_clinica_id uuid; v_membro_id uuid; v_role text; v_repasse public.repasses%rowtype; v_despesa_id uuid;
begin
  if p_data_pagamento is null then return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Informe a data do pagamento.'); end if;
  select active_clinica_id into v_clinica_id from public.users where id = v_ator_id;
  select id, role into v_membro_id, v_role from public.clinica_usuarios where usuario_id = v_ator_id and clinica_id = v_clinica_id and status = 'ativo' limit 1;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada or v_membro_id is null or v_role = 'secretaria' or not private.r164_tem_permissao_repasse(v_clinica_id, v_membro_id, 'repasses.gerir') then return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não pode pagar repasses nesta clínica.'); end if;
  select * into v_repasse from public.repasses where id = p_repasse_id and clinica_id = v_clinica_id for update;
  if v_repasse.id is null or v_repasse.status <> 'previsto' then return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'Este repasse não está disponível para pagamento.'); end if;
  insert into public.despesas (clinica_id, dentista_id, valor, categoria, tipo, data, descricao)
  values (v_clinica_id, v_repasse.dentista_id, v_repasse.valor, 'repasse_profissional', 'variavel', p_data_pagamento, 'Repasse profissional ' || v_repasse.id::text)
  returning id into v_despesa_id;
  update public.repasses set status = 'pago', pago_em = p_data_pagamento, despesa_id = v_despesa_id, pago_por_usuario_id = v_ator_id, updated_at = now() where id = v_repasse.id;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_repasse.id::text));
exception when others then return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível pagar o repasse agora.'); end;
$$;

create or replace function public.cancelar_repasse(
  p_clinica_id_esperada uuid,
  p_repasse_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_ator_id uuid := auth.uid(); v_clinica_id uuid; v_membro_id uuid; v_role text; v_repasse public.repasses%rowtype;
begin
  select active_clinica_id into v_clinica_id from public.users where id = v_ator_id;
  select id, role into v_membro_id, v_role from public.clinica_usuarios where usuario_id = v_ator_id and clinica_id = v_clinica_id and status = 'ativo' limit 1;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada or v_membro_id is null or v_role = 'secretaria' or not private.r164_tem_permissao_repasse(v_clinica_id, v_membro_id, 'repasses.gerir') then return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não pode cancelar repasses nesta clínica.'); end if;
  select * into v_repasse from public.repasses where id = p_repasse_id and clinica_id = v_clinica_id for update;
  if v_repasse.id is null or v_repasse.status <> 'previsto' then return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'Apenas repasses previstos podem ser cancelados.'); end if;
  update public.repasses set status = 'cancelado', cancelado_por_usuario_id = v_ator_id, updated_at = now() where id = v_repasse.id;
  update public.repasse_pagamentos set ativo = false where repasse_id = v_repasse.id;
  update public.repasse_diarias set estado = 'cancelado', updated_at = now() where repasse_id = v_repasse.id;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_repasse.id::text));
exception when others then return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível cancelar o repasse agora.'); end;
$$;

revoke all on function public.obter_repasses_clinica(uuid, date), public.obter_meu_financeiro_gerido(uuid, date), public.salvar_acordo_repasse(uuid, uuid, text, numeric, numeric, date, date, text), public.gerar_repasse_percentual(uuid, uuid, date, date), public.gerar_repasse_fixo(uuid, uuid, date, date), public.pagar_repasse(uuid, uuid, date), public.cancelar_repasse(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.obter_repasses_clinica(uuid, date), public.obter_meu_financeiro_gerido(uuid, date), public.salvar_acordo_repasse(uuid, uuid, text, numeric, numeric, date, date, text), public.gerar_repasse_percentual(uuid, uuid, date, date), public.gerar_repasse_fixo(uuid, uuid, date, date), public.pagar_repasse(uuid, uuid, date), public.cancelar_repasse(uuid, uuid) to authenticated;
