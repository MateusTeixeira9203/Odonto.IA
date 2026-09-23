-- R-140e1a: ativa somente o consumidor de estoque, nunca a governança geral em preparação.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create function private.normalizar_acessos_estoque(p_acessos jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
declare v_normalizado jsonb; v_item jsonb; v_ler boolean := false;
begin
  v_normalizado := private.normalizar_acessos(p_acessos);
  if v_normalizado is null then return null; end if;
  for v_item in select value from jsonb_array_elements(v_normalizado) loop
    if v_item->>'permissao' not in (
      'estoque.ler','estoque.gerir','estoque.receber','estoque.consumir','estoque.descartar','estoque.ajustar'
    ) or v_item->'escopo'->>'tipo' <> 'clinica' then return null; end if;
    v_ler := v_ler or v_item->>'permissao' = 'estoque.ler';
  end loop;
  if jsonb_array_length(v_normalizado) > 0 and not v_ler then return null; end if;
  return v_normalizado;
end;
$$;

alter table public.clinica_governanca
  add column modelo_estoque text check (modelo_estoque in ('colaborativa','gerida')),
  add column estoque_ativo boolean not null default false,
  add constraint clinica_governanca_estoque_modelo_check check (not estoque_ativo or modelo_estoque is not null);
alter table public.clinica_acessos
  add column acessos_estoque_ativos jsonb not null default '[]'::jsonb,
  add column versao_estoque integer not null default 1 check (versao_estoque > 0),
  add constraint clinica_acessos_estoque_validos_check check (
    private.normalizar_acessos_estoque(acessos_estoque_ativos) is not null
    and acessos_estoque_ativos = private.normalizar_acessos_estoque(acessos_estoque_ativos)
  );
alter table public.clinica_acessos_auditoria
  add column origem text not null default 'preparacao' check (origem in ('preparacao','estoque'));

create function private.obter_contexto_estoque(p_clinica_id_esperada uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_ator uuid := auth.uid(); v_clinica uuid; v_membro public.clinica_usuarios%rowtype;
  v_governanca public.clinica_governanca%rowtype; v_dentista uuid;
  v_todas jsonb := '["estoque.ajustar","estoque.consumir","estoque.descartar","estoque.gerir","estoque.ler","estoque.receber"]';
  v_compartilhadas jsonb := '[]'; v_gerenciar boolean := false;
begin
  if v_ator is null then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sessão obrigatória.');
  end if;
  if p_clinica_id_esperada is null then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Informe a clínica.');
  end if;
  select u.active_clinica_id into v_clinica from public.users u where u.id=v_ator;
  if v_clinica is distinct from p_clinica_id_esperada then
    return jsonb_build_object('ok',false,'codigo','CONTEXTO_ALTERADO','mensagem','A clínica ativa mudou.');
  end if;
  select * into v_membro from public.clinica_usuarios
    where clinica_id=v_clinica and usuario_id=v_ator and status='ativo';
  if not found then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Vínculo ativo obrigatório.');
  end if;
  select * into v_governanca from public.clinica_governanca
    where clinica_id=v_clinica and estoque_ativo and modelo_estoque is not null;
  if not found then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Estoque ainda não habilitado.');
  end if;
  if v_membro.role in ('dentista','admin') then
    select id into v_dentista from public.dentistas
      where clinica_id=v_clinica and user_id=v_ator and ativo and role in ('dentista','admin');
  end if;
  v_gerenciar := (v_governanca.modelo_estoque='gerida' and v_governanca.responsavel_usuario_id=v_ator)
    or (v_governanca.modelo_estoque='colaborativa' and v_dentista is not null);
  if v_gerenciar then
    v_compartilhadas := v_todas;
  else
    select coalesce(jsonb_agg(a.value->>'permissao' order by a.value->>'permissao'),'[]'::jsonb)
      into v_compartilhadas
    from public.clinica_acessos ca
    cross join lateral jsonb_array_elements(ca.acessos_estoque_ativos) a(value)
    where ca.clinica_id=v_clinica and ca.membro_id=v_membro.id;
  end if;
  return jsonb_build_object('ok',true,'data',jsonb_build_object(
    'clinicaId',v_clinica,'membroId',v_membro.id,'modelo',v_governanca.modelo_estoque,
    'dentistaId',v_dentista,'permissoesPessoais',case when v_dentista is null then '[]'::jsonb else v_todas end,
    'permissoesCompartilhadas',v_compartilhadas,'podeGerenciarCompartilhado',v_gerenciar
  ));
end;
$$;

create function private.configurar_acessos_estoque(
  p_clinica_id uuid,p_membro_id uuid,p_versao_esperada integer,
  p_acessos jsonb,p_motivo text,p_chave_idempotencia uuid
)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_ator uuid := auth.uid(); v_contexto jsonb; v_governanca public.clinica_governanca%rowtype;
  v_alvo public.clinica_usuarios%rowtype; v_acesso public.clinica_acessos%rowtype;
  v_acessos jsonb; v_motivo text := btrim(coalesce(p_motivo,'')); v_hash text;
  v_replay public.clinica_acessos_auditoria%rowtype; v_resultado jsonb;
begin
  perform set_config('lock_timeout','1500ms',true);
  if v_ator is null then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sessão obrigatória.');
  end if;
  if p_clinica_id is null or p_membro_id is null or p_chave_idempotencia is null
    or p_versao_esperada is null or p_versao_esperada <= 0 or char_length(v_motivo) not between 1 and 500 then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Revise os dados da concessão.');
  end if;
  v_acessos := private.normalizar_acessos_estoque(p_acessos);
  if v_acessos is null then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Revise as ações e a leitura obrigatória.');
  end if;
  -- Não bloquear uma clínica externa antes de conferir a sessão e a autoridade.
  v_contexto := private.obter_contexto_estoque(p_clinica_id);
  if not (v_contexto->>'ok')::boolean then return v_contexto; end if;
  if (v_contexto->'data'->>'podeGerenciarCompartilhado')::boolean is not true then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso para conceder ações.');
  end if;
  select * into v_governanca from public.clinica_governanca where clinica_id=p_clinica_id for update;
  perform 1 from public.clinica_usuarios cu
    where cu.clinica_id=p_clinica_id and (cu.usuario_id=v_ator or cu.id=p_membro_id)
    order by cu.id for update;
  perform 1 from public.users u where u.id in (
    select cu.usuario_id from public.clinica_usuarios cu
    where cu.clinica_id=p_clinica_id and (cu.usuario_id=v_ator or cu.id=p_membro_id)
  ) order by u.id for update;
  perform 1 from public.dentistas d where d.clinica_id=p_clinica_id and d.user_id in (
    select cu.usuario_id from public.clinica_usuarios cu
    where cu.clinica_id=p_clinica_id and (cu.usuario_id=v_ator or cu.id=p_membro_id)
  ) order by d.id for share;
  v_contexto := private.obter_contexto_estoque(p_clinica_id);
  if not (v_contexto->>'ok')::boolean then return v_contexto; end if;
  if (v_contexto->'data'->>'podeGerenciarCompartilhado')::boolean is not true then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','A autoridade foi alterada.');
  end if;
  select * into v_alvo from public.clinica_usuarios
    where clinica_id=p_clinica_id and id=p_membro_id and status='ativo';
  if not found then
    return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Membro indisponível.');
  end if;
  if v_alvo.usuario_id=v_ator
    or (v_governanca.modelo_estoque='gerida' and v_alvo.usuario_id=v_governanca.responsavel_usuario_id)
    or (v_governanca.modelo_estoque='colaborativa' and v_alvo.role in ('dentista','admin') and exists (
      select 1 from public.dentistas d where d.clinica_id=p_clinica_id and d.user_id=v_alvo.usuario_id
      and d.ativo and d.role in ('dentista','admin')
    )) then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','As permissões básicas deste membro não são editáveis.');
  end if;
  select * into v_acesso from public.clinica_acessos
    where clinica_id=p_clinica_id and membro_id=p_membro_id for update;
  if not found then
    return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Configuração do membro indisponível.');
  end if;
  v_hash := encode(extensions.digest(jsonb_build_object(
    'operacao','configurar_acessos_estoque','clinica',p_clinica_id,'membro',p_membro_id,
    'versao',p_versao_esperada,'acessos',v_acessos,'motivo',v_motivo
  )::text,'sha256'),'hex');
  select * into v_replay from public.clinica_acessos_auditoria
    where clinica_id=p_clinica_id and ator_usuario_id=v_ator and chave_idempotencia=p_chave_idempotencia;
  if found then
    if v_replay.origem <> 'estoque' or v_replay.payload_hash <> v_hash then
      return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Chave já usada em outra alteração.');
    end if;
    return v_replay.resultado;
  end if;
  if v_acesso.versao_estoque <> p_versao_esperada then
    return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','As permissões mudaram. Atualize antes de salvar.');
  end if;
  v_resultado := jsonb_build_object('ok',true,'data',jsonb_build_object('versao',v_acesso.versao_estoque+1));
  update public.clinica_acessos set acessos_estoque_ativos=v_acessos,versao_estoque=versao_estoque+1
    where clinica_id=p_clinica_id and membro_id=p_membro_id;
  insert into public.clinica_acessos_auditoria(
    clinica_id,ator_usuario_id,membro_id,versao_anterior,versao_nova,acessos_antes,acessos_depois,
    motivo,chave_idempotencia,payload_hash,resultado,origem
  ) values (
    p_clinica_id,v_ator,p_membro_id,v_acesso.versao_estoque,v_acesso.versao_estoque+1,
    v_acesso.acessos_estoque_ativos,v_acessos,v_motivo,p_chave_idempotencia,v_hash,v_resultado,'estoque'
  );
  return v_resultado;
exception when others then
  -- O sub-bloco PL/pgSQL reverte concessão e auditoria juntos, inclusive timeout/conflito.
  return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível salvar as permissões.');
end;
$$;

create function public.obter_contexto_estoque(p_clinica_id_esperada uuid)
returns jsonb language sql security invoker set search_path = pg_catalog
as $$ select private.obter_contexto_estoque(p_clinica_id_esperada); $$;
create function public.configurar_acessos_estoque(
  p_clinica_id uuid,p_membro_id uuid,p_versao_esperada integer,
  p_acessos jsonb,p_motivo text,p_chave_idempotencia uuid
)
returns jsonb language sql security invoker set search_path = pg_catalog
as $$ select private.configurar_acessos_estoque(
  p_clinica_id,p_membro_id,p_versao_esperada,p_acessos,p_motivo,p_chave_idempotencia
); $$;

revoke all on function private.normalizar_acessos_estoque(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.obter_contexto_estoque(uuid),public.obter_contexto_estoque(uuid),
  private.configurar_acessos_estoque(uuid,uuid,integer,jsonb,text,uuid),
  public.configurar_acessos_estoque(uuid,uuid,integer,jsonb,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function private.obter_contexto_estoque(uuid),public.obter_contexto_estoque(uuid),
  private.configurar_acessos_estoque(uuid,uuid,integer,jsonb,text,uuid),
  public.configurar_acessos_estoque(uuid,uuid,integer,jsonb,text,uuid) to authenticated;
