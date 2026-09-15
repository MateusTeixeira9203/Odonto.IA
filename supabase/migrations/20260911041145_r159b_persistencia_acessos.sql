-- R-159b: persistência inerte de acessos por clínica.
--
-- Esta migration não ativa a nova governança. Ela só cria o armazenamento protegido
-- para fixtures do ambiente de teste e para a RPC autenticada deste recorte.
-- Não altera policies, guards, dados ou o significado dos cargos legados.

set local lock_timeout = '1500ms';
set local statement_timeout = '10s';

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;

-- A FK composta abaixo precisa de uma chave única não parcial. O índice ativo existente
-- (usuario_id, clinica_id) não serve porque memberships removidos são histórico.
create unique index if not exists uq_clinica_usuarios_clinica_id_id
  on public.clinica_usuarios (clinica_id, id);

create table public.clinica_governanca (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  responsavel_usuario_id uuid not null references public.users(id) on delete restrict,
  estado text not null default 'preparacao' check (estado = 'preparacao'),
  versao integer not null default 1 check (versao > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinica_acessos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  membro_id uuid not null,
  perfil text not null default 'personalizado' check (perfil = 'personalizado'),
  atua_clinicamente boolean not null default false,
  versao integer not null default 1 check (versao > 0),
  acessos jsonb not null default '[]'::jsonb check (jsonb_typeof(acessos) = 'array'),
  teto_delegacao jsonb not null default '[]'::jsonb
    check (jsonb_typeof(teto_delegacao) = 'array' and teto_delegacao = '[]'::jsonb),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinica_acessos_membro_clinica_fkey
    foreign key (clinica_id, membro_id)
    references public.clinica_usuarios (clinica_id, id) on delete restrict,
  constraint clinica_acessos_clinica_membro_key unique (clinica_id, membro_id)
);

create table public.clinica_acessos_auditoria (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  ator_usuario_id uuid not null references public.users(id) on delete restrict,
  membro_id uuid not null,
  versao_anterior integer not null check (versao_anterior > 0),
  versao_nova integer not null check (versao_nova > versao_anterior),
  acessos_antes jsonb not null check (jsonb_typeof(acessos_antes) = 'array'),
  acessos_depois jsonb not null check (jsonb_typeof(acessos_depois) = 'array'),
  motivo text not null check (char_length(motivo) between 1 and 500),
  chave_idempotencia uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object'),
  created_at timestamptz not null default now(),
  constraint clinica_acessos_auditoria_membro_clinica_fkey
    foreign key (clinica_id, membro_id)
    references public.clinica_usuarios (clinica_id, id) on delete restrict,
  constraint clinica_acessos_auditoria_chave_unica
    unique (clinica_id, ator_usuario_id, chave_idempotencia)
);

create index clinica_acessos_auditoria_clinica_membro_data_idx
  on public.clinica_acessos_auditoria (clinica_id, membro_id, created_at desc);
create index clinica_acessos_auditoria_clinica_ator_data_idx
  on public.clinica_acessos_auditoria (clinica_id, ator_usuario_id, created_at desc);

-- Converte uma coleção válida para sua forma canônica. NULL representa payload inválido;
-- a mutação pública traduz isso para o contrato tipado, sem expor erro interno.
create function private.normalizar_acessos(p_acessos jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_item jsonb;
  v_escopo jsonb;
  v_permissao text;
  v_tipo text;
  v_alvos jsonb;
  v_alvo_texto text;
  v_alvo uuid;
  v_permissoes text[] := array[]::text[];
  v_resultado jsonb := '[]'::jsonb;
begin
  if p_acessos is null
    or jsonb_typeof(p_acessos) <> 'array'
    or jsonb_array_length(p_acessos) > 42 then
    return null;
  end if;

  for v_item in select value from jsonb_array_elements(p_acessos)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or (select array_agg(key order by key) from jsonb_object_keys(v_item) as key)
           is distinct from array['escopo', 'permissao'] then
      return null;
    end if;

    if jsonb_typeof(v_item -> 'permissao') <> 'string'
      or jsonb_typeof(v_item -> 'escopo') <> 'object' then
      return null;
    end if;

    v_permissao := v_item ->> 'permissao';
    v_escopo := v_item -> 'escopo';
    v_tipo := v_escopo ->> 'tipo';

    if v_permissao = any(v_permissoes)
      or v_permissao not in (
        'pacientes.ler', 'pacientes.editar', 'agenda.ler', 'agenda.editar',
        'agenda.confirmar', 'contatos.whatsapp', 'acompanhamentos.ler',
        'acompanhamentos.gerir', 'clinico.ler', 'clinico.registrar',
        'orcamentos.ler', 'orcamentos.criar', 'orcamentos.aceite',
        'orcamentos.cancelar', 'precos.ler', 'precos.editar', 'precos.excecao',
        'descontos.solicitar', 'descontos.aprovar', 'cobrancas.ler',
        'cobrancas.gerir', 'recebimentos.registrar', 'recebimentos.corrigir',
        'recebimentos.estornar', 'financeiro.ler', 'financeiro.exportar',
        'despesas.ler', 'despesas.gerir', 'repasses.ler', 'repasses.gerir',
        'equipe.ler', 'equipe.convidar', 'equipe.remover', 'permissoes.gerir',
        'configuracoes.gerir', 'auditoria.ler', 'estoque.ler', 'estoque.gerir',
        'estoque.ajustar', 'kits.gerir', 'materiais.confirmar',
        'unidades.consolidar'
      ) then
      return null;
    end if;
    v_permissoes := array_append(v_permissoes, v_permissao);

    if v_tipo in ('nenhum', 'proprio', 'clinica') then
      if (select array_agg(key order by key) from jsonb_object_keys(v_escopo) as key)
           is distinct from array['tipo'] then
        return null;
      end if;
    elsif v_tipo = 'selecionados' then
      if (select array_agg(key order by key) from jsonb_object_keys(v_escopo) as key)
           is distinct from array['dentistaIds', 'tipo']
        or jsonb_typeof(v_escopo -> 'dentistaIds') <> 'array'
        or jsonb_array_length(v_escopo -> 'dentistaIds') not between 1 and 200 then
        return null;
      end if;

      v_alvos := '[]'::jsonb;
      for v_alvo_texto in select value from jsonb_array_elements_text(v_escopo -> 'dentistaIds')
      loop
        -- Espelha z.string().uuid(): forma canônica, versões RFC 1–8 e variante RFC.
        if v_alvo_texto is null
          or v_alvo_texto !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          return null;
        end if;
        v_alvo := lower(v_alvo_texto)::uuid;
        if v_alvos @> jsonb_build_array(to_jsonb(v_alvo::text)) then
          return null;
        end if;
        v_alvos := v_alvos || jsonb_build_array(to_jsonb(v_alvo::text));
      end loop;
      select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
        into v_alvos
      from jsonb_array_elements(v_alvos);
      v_escopo := jsonb_build_object('tipo', 'selecionados', 'dentistaIds', v_alvos);
    else
      return null;
    end if;

    if (v_permissao in ('pacientes.ler', 'pacientes.editar')
          and v_tipo not in ('nenhum', 'selecionados', 'clinica'))
      or (v_permissao = 'clinico.registrar' and v_tipo not in ('nenhum', 'proprio'))
      or (v_permissao in (
            'precos.ler', 'precos.editar', 'equipe.ler', 'equipe.convidar',
            'equipe.remover', 'permissoes.gerir', 'configuracoes.gerir',
            'auditoria.ler', 'unidades.consolidar'
          ) and v_tipo not in ('nenhum', 'clinica')) then
      return null;
    end if;

    v_resultado := v_resultado || jsonb_build_array(
      jsonb_build_object('permissao', v_permissao, 'escopo', v_escopo)
    );
  end loop;

  select coalesce(jsonb_agg(value order by value ->> 'permissao'), '[]'::jsonb)
    into v_resultado
  from jsonb_array_elements(v_resultado);

  return v_resultado;
exception
  when others then
    return null;
end;
$$;

create function private.validar_linha_clinica_acessos()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_acessos jsonb;
  v_perfil_clinico boolean;
  v_item jsonb;
  v_alvos uuid[];
  v_quantidade_alvos integer;
  v_quantidade_validos integer;
begin
  v_acessos := private.normalizar_acessos(new.acessos);
  if v_acessos is null then
    raise exception 'configuracao de acessos invalida';
  end if;
  if new.teto_delegacao <> '[]'::jsonb then
    raise exception 'teto de delegacao indisponivel neste recorte';
  end if;
  select exists(
    select 1
    from public.dentistas d
    join public.clinica_usuarios cu
      on cu.usuario_id = d.user_id
     and cu.clinica_id = d.clinica_id
     and cu.status = 'ativo'
     and cu.role in ('admin', 'dentista')
    join public.clinica_usuarios membro
      on membro.id = new.membro_id
     and membro.clinica_id = new.clinica_id
     and membro.usuario_id = d.user_id
     and membro.status = 'ativo'
    where d.clinica_id = new.clinica_id
      and d.ativo
      and d.role in ('admin', 'dentista')
  ) into v_perfil_clinico;
  new.atua_clinicamente := v_perfil_clinico;
  for v_item in select value from jsonb_array_elements(v_acessos)
  loop
    if v_item -> 'escopo' ->> 'tipo' = 'selecionados' then
      select array_agg(value::uuid), count(*)
        into v_alvos, v_quantidade_alvos
      from jsonb_array_elements_text(v_item -> 'escopo' -> 'dentistaIds');
      select count(*) into v_quantidade_validos
      from public.dentistas d
      join public.clinica_usuarios cu
        on cu.usuario_id = d.user_id
       and cu.clinica_id = d.clinica_id
       and cu.status = 'ativo'
       and cu.role in ('admin', 'dentista')
      where d.id = any(v_alvos)
        and d.clinica_id = new.clinica_id
        and d.ativo
        and d.role in ('admin', 'dentista');
      if v_quantidade_alvos <> v_quantidade_validos then
        raise exception 'profissionais selecionados invalidos para a clinica';
      end if;
    end if;
  end loop;
  new.acessos := v_acessos;
  return new;
end;
$$;

create trigger clinica_acessos_validar_linha
before insert or update on public.clinica_acessos
for each row execute function private.validar_linha_clinica_acessos();

create function private.validar_linha_clinica_governanca()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (
    select 1
    from public.users u
    join public.clinica_usuarios cu
      on cu.usuario_id = u.id
     and cu.clinica_id = new.clinica_id
     and cu.status = 'ativo'
    where u.id = new.responsavel_usuario_id
      and u.active_clinica_id = new.clinica_id
  ) then
    raise exception 'responsavel precisa ter vinculo ativo na clinica';
  end if;
  return new;
end;
$$;

create trigger clinica_governanca_validar_responsavel
before insert or update on public.clinica_governanca
for each row execute function private.validar_linha_clinica_governanca();

create function private.bloquear_alteracao_auditoria_acessos()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  raise exception 'auditoria de acessos e imutavel';
end;
$$;

create trigger clinica_acessos_auditoria_append_only
before update or delete on public.clinica_acessos_auditoria
for each row execute function private.bloquear_alteracao_auditoria_acessos();

create function private.preparar_acessos_membro(
  p_clinica_id uuid,
  p_membro_id uuid,
  p_versao_esperada integer,
  p_acessos jsonb,
  p_motivo text,
  p_chave_idempotencia uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid();
  v_ator_membro_id uuid;
  v_contexto_alterado boolean := false;
  v_ator_revalidado boolean := false;
  v_governanca public.clinica_governanca%rowtype;
  v_membro public.clinica_usuarios%rowtype;
  v_membro_bloqueado public.clinica_usuarios%rowtype;
  v_acesso public.clinica_acessos%rowtype;
  v_acessos_normalizados jsonb;
  v_payload jsonb;
  v_hash text;
  v_resultado jsonb;
  v_replay jsonb;
  v_motivo_normalizado text;
  v_alvos uuid[];
  v_quantidade_alvos integer;
  v_quantidade_validos integer;
  v_perfil_clinico boolean := false;
  v_item jsonb;
begin
  perform set_config('lock_timeout', '1500ms', true);
  perform set_config('statement_timeout', '10s', true);

  if v_ator_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
  end if;
  if p_clinica_id is null or p_membro_id is null or p_chave_idempotencia is null
    or p_versao_esperada is null or p_versao_esperada <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Dados de configuração inválidos.');
  end if;

  v_motivo_normalizado := btrim(coalesce(p_motivo, ''));
  if char_length(v_motivo_normalizado) not between 1 and 500 then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Informe um motivo entre 1 e 500 caracteres.');
  end if;

  v_acessos_normalizados := private.normalizar_acessos(p_acessos);
  if v_acessos_normalizados is null then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Configuração de acessos inválida.');
  end if;

  select cu.id
    into v_ator_membro_id
  from public.users u
  join public.clinica_usuarios cu
    on cu.usuario_id = u.id
   and cu.clinica_id = p_clinica_id
   and cu.status = 'ativo'
  where u.id = v_ator_id
    and u.active_clinica_id = p_clinica_id
  limit 1;

  if v_ator_membro_id is null then
    select exists(
      select 1 from public.users u
      where u.id = v_ator_id and u.active_clinica_id is distinct from p_clinica_id
    ) into v_contexto_alterado;
    if v_contexto_alterado then
      return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
    end if;
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
  end if;

  -- Ordem global de locks: governança, memberships por UUID, users, configuração.
  select * into v_governanca
  from public.clinica_governanca
  where clinica_id = p_clinica_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'Configuração da clínica não encontrada.');
  end if;

  for v_membro_bloqueado in
    select *
    from public.clinica_usuarios
    where clinica_id = p_clinica_id
      and id in (v_ator_membro_id, p_membro_id)
    order by id
    for update
  loop
    if v_membro_bloqueado.id = v_ator_membro_id then
      if v_membro_bloqueado.status <> 'ativo' or v_membro_bloqueado.usuario_id <> v_ator_id then
        return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
      end if;
      v_ator_revalidado := true;
    end if;
    if v_membro_bloqueado.id = p_membro_id then
      v_membro := v_membro_bloqueado;
    end if;
  end loop;

  if not v_ator_revalidado then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
  end if;
  select u.active_clinica_id = p_clinica_id
    into v_contexto_alterado
  from public.users u
  where u.id = v_ator_id
  for share;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
  end if;
  if v_contexto_alterado is not true then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  if v_governanca.responsavel_usuario_id <> v_ator_id then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
  end if;
  if v_membro.id is null or v_membro.status <> 'ativo' then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'Membro não encontrado na clínica ativa.');
  end if;
  if p_membro_id = v_ator_membro_id or v_membro.usuario_id = v_governanca.responsavel_usuario_id then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'O responsável não pode editar a própria configuração neste recorte.');
  end if;

  select * into v_acesso
  from public.clinica_acessos
  where clinica_id = p_clinica_id and membro_id = p_membro_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'Configuração do membro não encontrada.');
  end if;

  -- Selecionados aceitam exclusivamente profissionais clínicos ativos da própria clínica.
  for v_item in select value from jsonb_array_elements(v_acessos_normalizados)
  loop
    if v_item -> 'escopo' ->> 'tipo' = 'selecionados' then
      select array_agg(value::uuid), count(*)
        into v_alvos, v_quantidade_alvos
      from jsonb_array_elements_text(v_item -> 'escopo' -> 'dentistaIds');
      select count(*) into v_quantidade_validos
      from public.dentistas d
      join public.clinica_usuarios cu
        on cu.usuario_id = d.user_id
       and cu.clinica_id = d.clinica_id
       and cu.status = 'ativo'
       and cu.role in ('admin', 'dentista')
      where d.id = any(v_alvos)
        and d.clinica_id = p_clinica_id
        and d.ativo
        and d.role in ('admin', 'dentista');
      if v_quantidade_alvos <> v_quantidade_validos then
        return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Os profissionais selecionados não são válidos para esta clínica.');
      end if;
    end if;
  end loop;

  select exists(
    select 1
    from public.dentistas d
    join public.clinica_usuarios cu
      on cu.usuario_id = d.user_id
     and cu.clinica_id = d.clinica_id
     and cu.status = 'ativo'
     and cu.role in ('admin', 'dentista')
    where d.user_id = v_membro.usuario_id
      and d.clinica_id = p_clinica_id
      and d.ativo
      and d.role in ('admin', 'dentista')
  ) into v_perfil_clinico;

  if exists (
    select 1
    from jsonb_array_elements(v_acessos_normalizados) as acesso(value)
    where (
      acesso.value ->> 'permissao' in ('clinico.ler', 'clinico.registrar')
      and acesso.value -> 'escopo' ->> 'tipo' <> 'nenhum'
    ) or (
      acesso.value -> 'escopo' ->> 'tipo' = 'proprio'
      and acesso.value ->> 'permissao' not in ('acompanhamentos.ler', 'acompanhamentos.gerir')
    )
  ) and not v_perfil_clinico then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'O escopo próprio exige perfil profissional ativo para este recurso.');
  end if;

  v_payload := jsonb_build_object(
    'acessos', v_acessos_normalizados,
    'clinicaId', p_clinica_id::text,
    'membroId', p_membro_id::text,
    'motivo', v_motivo_normalizado,
    'versaoEsperada', p_versao_esperada
  );
  v_hash := encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');

  select resultado into v_replay
  from public.clinica_acessos_auditoria
  where clinica_id = p_clinica_id
    and ator_usuario_id = v_ator_id
    and chave_idempotencia = p_chave_idempotencia;
  if found then
    if exists (
      select 1 from public.clinica_acessos_auditoria
      where clinica_id = p_clinica_id
        and ator_usuario_id = v_ator_id
        and chave_idempotencia = p_chave_idempotencia
        and payload_hash = v_hash
    ) then
      return v_replay;
    end if;
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A chave de idempotência já foi usada com outra configuração.');
  end if;

  if v_acesso.versao <> p_versao_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A configuração foi alterada por outra pessoa.');
  end if;
  if v_acesso.versao = 2147483647 then
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A configuração precisa ser revisada antes de nova alteração.');
  end if;

  update public.clinica_acessos
  set acessos = v_acessos_normalizados,
      versao = versao + 1,
      updated_at = now()
  where id = v_acesso.id
    and clinica_id = p_clinica_id
  returning versao into v_acesso.versao;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível concluir a alteração agora.');
  end if;

  v_resultado := jsonb_build_object('ok', true, 'data', jsonb_build_object('versao', v_acesso.versao));
  insert into public.clinica_acessos_auditoria (
    clinica_id, ator_usuario_id, membro_id, versao_anterior, versao_nova,
    acessos_antes, acessos_depois, motivo, chave_idempotencia, payload_hash, resultado
  ) values (
    p_clinica_id, v_ator_id, p_membro_id, p_versao_esperada, v_acesso.versao,
    v_acesso.acessos, v_acessos_normalizados, v_motivo_normalizado,
    p_chave_idempotencia, v_hash, v_resultado
  );

  return v_resultado;
exception
  when lock_not_available or query_canceled then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível concluir a alteração agora.');
  when others then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível concluir a alteração agora.');
end;
$$;

-- A API exposta é invoker; a rotina privilegiada permanece no schema privado.
create function public.preparar_acessos_membro(
  p_clinica_id uuid,
  p_membro_id uuid,
  p_versao_esperada integer,
  p_acessos jsonb,
  p_motivo text,
  p_chave_idempotencia uuid
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.preparar_acessos_membro(
    p_clinica_id,
    p_membro_id,
    p_versao_esperada,
    p_acessos,
    p_motivo,
    p_chave_idempotencia
  );
$$;

alter table public.clinica_governanca enable row level security;
alter table public.clinica_acessos enable row level security;
alter table public.clinica_acessos_auditoria enable row level security;

-- Só o responsável ativo vê a governança. Não há policy de escrita direta.
create policy clinica_governanca_responsavel_select
on public.clinica_governanca
for select to authenticated
using (
  responsavel_usuario_id = (select auth.uid())
  and exists (
    select 1
    from public.users u
    join public.clinica_usuarios cu
      on cu.usuario_id = u.id
     and cu.clinica_id = clinica_governanca.clinica_id
     and cu.status = 'ativo'
    where u.id = (select auth.uid())
      and u.active_clinica_id = clinica_governanca.clinica_id
  )
);

-- O membro ativo lê somente a própria configuração; o responsável ativo lê a unidade.
create policy clinica_acessos_leitura_protegida
on public.clinica_acessos
for select to authenticated
using (
  exists (
    select 1
    from public.users ator
    join public.clinica_usuarios membro_ator
      on membro_ator.usuario_id = ator.id
     and membro_ator.clinica_id = clinica_acessos.clinica_id
     and membro_ator.status = 'ativo'
    where ator.id = (select auth.uid())
      and ator.active_clinica_id = clinica_acessos.clinica_id
  )
  and (
    exists (
      select 1
      from public.clinica_usuarios membro
      where membro.id = clinica_acessos.membro_id
        and membro.clinica_id = clinica_acessos.clinica_id
        and membro.usuario_id = (select auth.uid())
        and membro.status = 'ativo'
    )
    or exists (
      select 1
      from public.clinica_governanca g
      where g.clinica_id = clinica_acessos.clinica_id
        and g.responsavel_usuario_id = (select auth.uid())
    )
  )
);

create policy clinica_acessos_auditoria_responsavel_select
on public.clinica_acessos_auditoria
for select to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.clinica_usuarios cu
      on cu.usuario_id = u.id
     and cu.clinica_id = clinica_acessos_auditoria.clinica_id
     and cu.status = 'ativo'
    join public.clinica_governanca g
      on g.clinica_id = cu.clinica_id
     and g.responsavel_usuario_id = u.id
    where u.id = (select auth.uid())
      and u.active_clinica_id = clinica_acessos_auditoria.clinica_id
  )
);

revoke all on table public.clinica_governanca from public, anon, authenticated;
revoke all on table public.clinica_acessos from public, anon, authenticated;
revoke all on table public.clinica_acessos_auditoria from public, anon, authenticated;
grant select on table public.clinica_governanca to authenticated;
grant select on table public.clinica_acessos to authenticated;
grant select on table public.clinica_acessos_auditoria to authenticated;

revoke all on function private.normalizar_acessos(jsonb) from public, anon, authenticated;
revoke all on function private.validar_linha_clinica_acessos() from public, anon, authenticated;
revoke all on function private.validar_linha_clinica_governanca() from public, anon, authenticated;
revoke all on function private.bloquear_alteracao_auditoria_acessos() from public, anon, authenticated;
revoke all on function private.preparar_acessos_membro(uuid, uuid, integer, jsonb, text, uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.preparar_acessos_membro(uuid, uuid, integer, jsonb, text, uuid) to authenticated;

revoke all on function public.preparar_acessos_membro(uuid, uuid, integer, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.preparar_acessos_membro(uuid, uuid, integer, jsonb, text, uuid) to authenticated;
