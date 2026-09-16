-- R-140e2 / sublote 4A: kits de consumíveis e usos declarados na ficha.
-- Não inclui OCR, ativos individuais, ciclos, correção nem regularização.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

alter table public.estoque_movimentos
  drop constraint estoque_movimentos_origem_tipo_check,
  add constraint estoque_movimentos_origem_tipo_check
    check (origem_tipo in ('manual', 'contagem', 'correcao', 'uso_atendimento'));

alter table public.atendimentos_clinicos
  add constraint atendimentos_clinicos_clinica_id_key unique (clinica_id, id);

create table public.estoque_kits (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  titular_tipo text not null check (titular_tipo in ('clinica', 'dentista')),
  titular_dentista_id uuid,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  ativo boolean not null default true,
  versao_atual integer not null default 1 check (versao_atual > 0),
  created_at timestamptz not null default now(),
  constraint estoque_kits_titular_check check (
    (titular_tipo = 'clinica' and titular_dentista_id is null)
    or (titular_tipo = 'dentista' and titular_dentista_id is not null)
  ),
  constraint estoque_kits_clinica_id_key unique (clinica_id, id),
  constraint estoque_kits_titular_fkey foreign key (clinica_id, titular_dentista_id)
    references public.dentistas(clinica_id, id) on delete restrict
);

create table public.estoque_kit_versoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  kit_id uuid not null,
  versao integer not null check (versao > 0),
  nome_snapshot text not null check (char_length(btrim(nome_snapshot)) between 1 and 120),
  criado_por uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint estoque_kit_versoes_clinica_id_key unique (clinica_id, id),
  constraint estoque_kit_versoes_kit_fkey foreign key (clinica_id, kit_id)
    references public.estoque_kits(clinica_id, id) on delete restrict,
  constraint estoque_kit_versoes_kit_versao_key unique (clinica_id, kit_id, versao)
);

create table public.estoque_kit_componentes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  kit_versao_id uuid not null,
  item_id uuid not null,
  nome_snapshot text not null check (char_length(btrim(nome_snapshot)) between 1 and 120),
  unidade_snapshot text not null check (unidade_snapshot in ('unidade', 'g', 'ml')),
  quantidade_base numeric(18,6) not null check (quantidade_base > 0),
  created_at timestamptz not null default now(),
  constraint estoque_kit_componentes_versao_item_key unique (clinica_id, kit_versao_id, item_id),
  constraint estoque_kit_componentes_versao_fkey foreign key (clinica_id, kit_versao_id)
    references public.estoque_kit_versoes(clinica_id, id) on delete restrict,
  constraint estoque_kit_componentes_item_fkey foreign key (clinica_id, item_id)
    references public.estoque_itens(clinica_id, id) on delete restrict
);

create table public.estoque_usos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  atendimento_id uuid not null references public.atendimentos_clinicos(id) on delete restrict,
  linha_origem_id uuid not null,
  revisao integer not null default 1 check (revisao > 0),
  autor_usuario_id uuid not null references public.users(id) on delete restrict,
  snapshot_material text not null check (char_length(btrim(snapshot_material)) between 1 and 120),
  quantidade_declarada numeric(18,6) not null check (quantidade_declarada > 0),
  unidade_declarada text not null check (unidade_declarada in ('unidade', 'g', 'ml')),
  item_id uuid not null,
  lote_id uuid not null,
  kit_versao_id uuid,
  movimento_id uuid,
  operacao_id uuid,
  estado_operacional text not null default 'pendente_autorizacao'
    check (estado_operacional in ('pendente_autorizacao', 'confirmado', 'confirmado_divergente', 'substituido', 'cancelado')),
  created_at timestamptz not null default now(),
  constraint estoque_usos_linha_revisao_key unique (clinica_id, atendimento_id, linha_origem_id, revisao),
  constraint estoque_usos_clinica_id_key unique (clinica_id, id),
  constraint estoque_usos_atendimento_fkey foreign key (clinica_id, atendimento_id)
    references public.atendimentos_clinicos(clinica_id, id) on delete restrict,
  constraint estoque_usos_item_lote_fkey foreign key (clinica_id, item_id, lote_id)
    references public.estoque_lotes(clinica_id, item_id, id) on delete restrict,
  constraint estoque_usos_kit_versao_fkey foreign key (clinica_id, kit_versao_id)
    references public.estoque_kit_versoes(clinica_id, id) on delete restrict,
  constraint estoque_usos_movimento_fkey foreign key (clinica_id, item_id, lote_id, movimento_id)
    references public.estoque_movimentos(clinica_id, item_id, lote_id, id) on delete restrict,
  constraint estoque_usos_operacao_fkey foreign key (clinica_id, autor_usuario_id, operacao_id)
    references public.estoque_operacoes(clinica_id, ator_usuario_id, id) on delete restrict
);

create unique index estoque_movimentos_uso_unico_idx on public.estoque_movimentos(origem_id)
  where origem_tipo = 'uso_atendimento';
create index estoque_usos_atendimento_idx on public.estoque_usos(clinica_id, atendimento_id, created_at, id);

create function private.estoque_validar_kit_componente()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_kit public.estoque_kits%rowtype; v_item public.estoque_itens%rowtype;
begin
  select k.* into v_kit from public.estoque_kit_versoes kv
    join public.estoque_kits k on k.clinica_id=kv.clinica_id and k.id=kv.kit_id
    where kv.clinica_id=new.clinica_id and kv.id=new.kit_versao_id;
  select * into v_item from public.estoque_itens where clinica_id=new.clinica_id and id=new.item_id;
  if not found or v_kit.id is null or not v_item.ativo
    or new.nome_snapshot is distinct from v_item.nome or new.unidade_snapshot is distinct from v_item.unidade_base
    or (v_kit.titular_tipo='clinica' and v_item.titular_tipo <> 'clinica')
    or (v_kit.titular_tipo='dentista' and not (v_item.titular_tipo='clinica' or v_item.titular_dentista_id=v_kit.titular_dentista_id)) then
    raise exception 'ESTOQUE_KIT_COMPONENTE_INVALIDO' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger estoque_kit_componentes_validar before insert on public.estoque_kit_componentes
  for each row execute function private.estoque_validar_kit_componente();
create trigger estoque_kit_versoes_imutaveis before update or delete on public.estoque_kit_versoes
  for each row execute function private.estoque_impedir_alteracao_fato();
create trigger estoque_kit_componentes_imutaveis before update or delete on public.estoque_kit_componentes
  for each row execute function private.estoque_impedir_alteracao_fato();

create function private.estoque_validar_uso()
returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if tg_op='DELETE' then raise exception 'ESTOQUE_HISTORICO_PRESERVADO' using errcode='23514'; end if;
  if new.id<>old.id or new.clinica_id<>old.clinica_id or new.atendimento_id<>old.atendimento_id
    or new.linha_origem_id<>old.linha_origem_id or new.revisao<>old.revisao
    or new.autor_usuario_id<>old.autor_usuario_id or new.snapshot_material<>old.snapshot_material
    or new.quantidade_declarada<>old.quantidade_declarada or new.unidade_declarada<>old.unidade_declarada
    or new.item_id<>old.item_id or new.lote_id<>old.lote_id or new.kit_versao_id is distinct from old.kit_versao_id
    or new.created_at<>old.created_at then raise exception 'ESTOQUE_USO_IMUTAVEL' using errcode='23514'; end if;
  if old.estado_operacional<>'pendente_autorizacao'
    or new.estado_operacional not in ('confirmado','confirmado_divergente')
    or new.movimento_id is null or new.operacao_id is null then
    raise exception 'ESTOQUE_TRANSICAO_USO_INVALIDA' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger estoque_usos_preservar before update or delete on public.estoque_usos
  for each row execute function private.estoque_validar_uso();

-- O saldo manual continua estritamente não-negativo. A única exceção é a própria linha clínica
-- marcada como divergente antes do movimento, verificada no mesmo commit diferido.
create or replace function private.estoque_validar_saldo_final()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if (select coalesce(sum(m.quantidade),0) from public.estoque_movimentos m
      where m.clinica_id=new.clinica_id and m.item_id=new.item_id and m.lote_id=new.lote_id) < 0
    and not exists (
      select 1 from public.estoque_usos u
      where u.clinica_id=new.clinica_id and u.id=new.origem_id
        and new.origem_tipo='uso_atendimento' and u.estado_operacional='confirmado_divergente'
    ) then raise exception 'ESTOQUE_SALDO_INSUFICIENTE' using errcode='23514'; end if;
  return null;
end; $$;

create function private.estoque_tem_kit_gerir(p_contexto jsonb,p_titular_tipo text,p_titular_dentista_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.clinica_acessos ca cross join lateral jsonb_array_elements(ca.acessos) a(valor)
    where ca.clinica_id=(p_contexto#>>'{data,clinicaId}')::uuid
      and ca.membro_id=(p_contexto#>>'{data,membroId}')::uuid and a.valor->>'permissao'='kits.gerir'
      and (
        (p_titular_tipo='clinica' and a.valor#>>'{escopo,tipo}'='clinica')
        or (
          p_titular_tipo='dentista' and p_contexto#>>'{data,dentistaId}'=p_titular_dentista_id::text
          and (
            a.valor#>>'{escopo,tipo}'='proprio'
            or (a.valor#>>'{escopo,tipo}'='selecionados'
              and a.valor#>'{escopo,dentistaIds}' @> jsonb_build_array(p_titular_dentista_id::text))
          )
        )
      )
  );
$$;

create function private.operar_kits_estoque(p_acao text,p_entrada jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_ator uuid:=auth.uid(); v_clinica uuid; v_contexto jsonb; v_titular jsonb; v_kit public.estoque_kits%rowtype;
  v_chave uuid; v_hash text; v_replay public.estoque_operacoes%rowtype; v_operacao uuid:=gen_random_uuid();
  v_kit_id uuid:=gen_random_uuid(); v_versao_id uuid:=gen_random_uuid(); v_versao integer; v_nome text; v_componentes jsonb; v_c jsonb; v_item public.estoque_itens%rowtype; v_resultado jsonb;
begin
  if v_ator is null or p_acao not in ('cadastrar','editar') or jsonb_typeof(p_entrada)<>'object'
    or not private.estoque_chaves_exatas(p_entrada,case when p_acao='cadastrar' then array['clinicaIdEsperada','chaveIdempotencia','titular','nome','componentes'] else array['clinicaIdEsperada','chaveIdempotencia','kitId','versaoEsperada','nome','componentes'] end) then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Dados do kit inválidos.'); end if;
  v_clinica:=private.estoque_uuid(p_entrada->>'clinicaIdEsperada'); v_chave:=private.estoque_uuid(p_entrada->>'chaveIdempotencia');
  v_nome:=btrim(coalesce(p_entrada->>'nome','')); v_componentes:=p_entrada->'componentes';
  if v_clinica is null or v_chave is null or char_length(v_nome) not between 1 and 120
    or jsonb_typeof(v_componentes)<>'array' or jsonb_array_length(v_componentes) not between 1 and 50 then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Dados do kit inválidos.'); end if;
  v_contexto:=private.estoque_contexto_travado(v_clinica); if (v_contexto->>'ok')::boolean is not true then return v_contexto; end if;
  if p_acao='cadastrar' then v_titular:=private.estoque_titular(p_entrada->'titular');
    if v_titular is null then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Titular do kit inválido.'); end if;
  else
    select * into v_kit from public.estoque_kits where clinica_id=v_clinica and id=private.estoque_uuid(p_entrada->>'kitId') for update;
    v_versao:=private.estoque_versao(p_entrada->'versaoEsperada');
    if not found then return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Kit indisponível.'); end if;
    if v_versao is distinct from v_kit.versao_atual then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','O kit mudou. Atualize antes de salvar.'); end if;
    v_titular:=case when v_kit.titular_tipo='clinica' then jsonb_build_object('tipo','clinica') else jsonb_build_object('tipo','dentista','dentistaId',v_kit.titular_dentista_id::text) end;
    v_kit_id:=v_kit.id;
  end if;
  if not private.estoque_tem_kit_gerir(v_contexto,v_titular->>'tipo',private.estoque_uuid(v_titular->>'dentistaId'))
    or not private.estoque_tem_acao(v_contexto,v_titular->>'tipo',private.estoque_uuid(v_titular->>'dentistaId'),'estoque.ler') then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso ao kit.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_clinica::text||':'||v_ator::text||':'||v_chave::text,0)); v_hash:=private.estoque_hash('kit:'||p_acao,p_entrada);
  select * into v_replay from public.estoque_operacoes where clinica_id=v_clinica and ator_usuario_id=v_ator and chave_idempotencia=v_chave;
  if found then if v_replay.payload_hash is distinct from v_hash then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Chave já usada em outra operação.'); end if; return v_replay.resultado; end if;
  if exists(select 1 from jsonb_array_elements(v_componentes) c where jsonb_typeof(c.value)<>'object' or not private.estoque_chaves_exatas(c.value,array['itemId','quantidadeBase']) or private.estoque_uuid(c.value->>'itemId') is null or private.estoque_decimal_json(c.value->'quantidadeBase',true) is null)
    or (select count(*)<>count(distinct c.value->>'itemId') from jsonb_array_elements(v_componentes) c) then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Componentes do kit inválidos.'); end if;
  if p_acao='cadastrar' then insert into public.estoque_kits(id,clinica_id,titular_tipo,titular_dentista_id,nome) values(v_kit_id,v_clinica,v_titular->>'tipo',private.estoque_uuid(v_titular->>'dentistaId'),v_nome); v_versao:=1;
  else v_versao:=v_kit.versao_atual+1; update public.estoque_kits set nome=v_nome,versao_atual=v_versao where clinica_id=v_clinica and id=v_kit_id; end if;
  insert into public.estoque_kit_versoes(id,clinica_id,kit_id,versao,nome_snapshot,criado_por) values(v_versao_id,v_clinica,v_kit_id,v_versao,v_nome,v_ator);
  for v_c in select value from jsonb_array_elements(v_componentes) loop
    select * into v_item from public.estoque_itens where clinica_id=v_clinica and id=private.estoque_uuid(v_c->>'itemId') for share;
    if not found or not private.estoque_tem_acao(v_contexto,v_item.titular_tipo,v_item.titular_dentista_id,'estoque.ler') then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Componente indisponível.'); end if;
    insert into public.estoque_kit_componentes(clinica_id,kit_versao_id,item_id,nome_snapshot,unidade_snapshot,quantidade_base) values(v_clinica,v_versao_id,v_item.id,v_item.nome,v_item.unidade_base,private.estoque_decimal_json(v_c->'quantidadeBase',true));
  end loop;
  v_resultado:=jsonb_build_object('ok',true,'data',jsonb_build_object('kitId',v_kit_id::text,'kitVersaoId',v_versao_id::text,'versao',v_versao));
  insert into public.estoque_operacoes values(v_operacao,v_clinica,v_ator,v_chave,v_hash,v_resultado,now()); return v_resultado;
exception when lock_not_available or query_canceled then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Kits indisponíveis. Tente novamente.');
when others then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível concluir a operação.'); end;
$$;

create function public.operar_kits_estoque(p_acao text,p_entrada jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.operar_kits_estoque(p_acao,p_entrada); $$;

create function private.declarar_usos_estoque(p_entrada jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_ator uuid:=auth.uid(); v_clinica uuid; v_contexto jsonb; v_atendimento public.atendimentos_clinicos%rowtype;
  v_chave uuid; v_hash text; v_replay public.estoque_operacoes%rowtype; v_operacao uuid:=gen_random_uuid();
  v_linhas jsonb; v_linha jsonb; v_item public.estoque_itens%rowtype; v_lote public.estoque_lotes%rowtype;
  v_kit uuid; v_uso uuid; v_usos jsonb:='[]'::jsonb; v_existentes integer; v_resultado jsonb;
begin
  if v_ator is null or jsonb_typeof(p_entrada)<>'object' or not private.estoque_chaves_exatas(p_entrada,array['clinicaIdEsperada','atendimentoId','chaveIdempotencia','linhas']) then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Dados de materiais inválidos.'); end if;
  v_clinica:=private.estoque_uuid(p_entrada->>'clinicaIdEsperada'); v_chave:=private.estoque_uuid(p_entrada->>'chaveIdempotencia'); v_linhas:=p_entrada->'linhas';
  if v_clinica is null or v_chave is null or private.estoque_uuid(p_entrada->>'atendimentoId') is null
    or jsonb_typeof(v_linhas)<>'array' or jsonb_array_length(v_linhas) not between 1 and 50 then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Dados de materiais inválidos.'); end if;
  v_contexto:=private.estoque_contexto_travado(v_clinica); if (v_contexto->>'ok')::boolean is not true then return v_contexto; end if;
  select * into v_atendimento from public.atendimentos_clinicos where clinica_id=v_clinica and id=private.estoque_uuid(p_entrada->>'atendimentoId') for update;
  if not found or v_atendimento.dentista_id is distinct from private.estoque_uuid(v_contexto#>>'{data,dentistaId}') then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Atendimento indisponível.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_clinica::text||':'||v_ator::text||':'||v_chave::text,0)); v_hash:=private.estoque_hash('declarar_usos',p_entrada);
  select * into v_replay from public.estoque_operacoes where clinica_id=v_clinica and ator_usuario_id=v_ator and chave_idempotencia=v_chave;
  if found then if v_replay.payload_hash is distinct from v_hash then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Chave já usada em outra operação.'); end if; return v_replay.resultado; end if;
  if exists(select 1 from jsonb_array_elements(v_linhas) l where jsonb_typeof(l.value)<>'object' or not private.estoque_chaves_exatas(l.value,array['linhaOrigemId','itemId','loteId','quantidade','kitVersaoId']) or private.estoque_uuid(l.value->>'linhaOrigemId') is null or private.estoque_uuid(l.value->>'itemId') is null or private.estoque_uuid(l.value->>'loteId') is null or private.estoque_decimal_json(l.value->'quantidade',true) is null or jsonb_typeof(l.value->'kitVersaoId') not in ('string','null'))
    or (select count(*)<>count(distinct l.value->>'linhaOrigemId') from jsonb_array_elements(v_linhas) l) then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Linhas de materiais inválidas.'); end if;
  select count(*) into v_existentes from public.estoque_usos u where u.clinica_id=v_clinica and u.atendimento_id=v_atendimento.id and u.revisao=1 and u.linha_origem_id in (select private.estoque_uuid(l.value->>'linhaOrigemId') from jsonb_array_elements(v_linhas) l);
  if v_existentes>0 then
    if v_existentes<>jsonb_array_length(v_linhas) then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','As linhas de materiais mudaram.'); end if;
    select jsonb_agg(jsonb_build_object('usoId',u.id::text,'linhaOrigemId',u.linha_origem_id::text,'estado',u.estado_operacional) order by u.id) into v_usos from public.estoque_usos u where u.clinica_id=v_clinica and u.atendimento_id=v_atendimento.id and u.revisao=1 and u.linha_origem_id in (select private.estoque_uuid(l.value->>'linhaOrigemId') from jsonb_array_elements(v_linhas) l);
    v_resultado:=jsonb_build_object('ok',true,'data',jsonb_build_object('usos',v_usos)); insert into public.estoque_operacoes values(v_operacao,v_clinica,v_ator,v_chave,v_hash,v_resultado,now()); return v_resultado;
  end if;
  for v_linha in select value from jsonb_array_elements(v_linhas) loop
    select * into v_item from public.estoque_itens where clinica_id=v_clinica and id=private.estoque_uuid(v_linha->>'itemId');
    select * into v_lote from public.estoque_lotes where clinica_id=v_clinica and item_id=v_item.id and id=private.estoque_uuid(v_linha->>'loteId');
    if not found or v_item.id is null or not v_item.ativo then return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Material indisponível.'); end if;
    v_kit:=case when v_linha->'kitVersaoId'='null'::jsonb then null else private.estoque_uuid(v_linha->>'kitVersaoId') end;
    if v_kit is not null and not exists(select 1 from public.estoque_kit_componentes c where c.clinica_id=v_clinica and c.kit_versao_id=v_kit and c.item_id=v_item.id) then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Componente do kit inválido.'); end if;
    v_uso:=gen_random_uuid();
    insert into public.estoque_usos(id,clinica_id,atendimento_id,linha_origem_id,autor_usuario_id,snapshot_material,quantidade_declarada,unidade_declarada,item_id,lote_id,kit_versao_id)
      values(v_uso,v_clinica,v_atendimento.id,private.estoque_uuid(v_linha->>'linhaOrigemId'),v_ator,v_item.nome,private.estoque_decimal_json(v_linha->'quantidade',true),v_item.unidade_base,v_item.id,v_lote.id,v_kit);
    v_usos:=v_usos||jsonb_build_array(jsonb_build_object('usoId',v_uso::text,'linhaOrigemId',private.estoque_uuid(v_linha->>'linhaOrigemId')::text,'estado','pendente_autorizacao'));
  end loop;
  v_resultado:=jsonb_build_object('ok',true,'data',jsonb_build_object('usos',v_usos)); insert into public.estoque_operacoes values(v_operacao,v_clinica,v_ator,v_chave,v_hash,v_resultado,now()); return v_resultado;
exception when lock_not_available or query_canceled then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Materiais indisponíveis. Tente novamente.');
when others then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível registrar os materiais.'); end;
$$;

create function private.confirmar_usos_estoque(p_entrada jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_ator uuid:=auth.uid(); v_clinica uuid; v_contexto jsonb; v_atendimento public.atendimentos_clinicos%rowtype;
  v_chave uuid; v_hash text; v_replay public.estoque_operacoes%rowtype; v_operacao uuid:=gen_random_uuid();
  v_ids uuid[]; v_aceitos jsonb; v_aceitos_ids jsonb; v_insuficientes jsonb; v_uso public.estoque_usos%rowtype;
  v_item public.estoque_itens%rowtype; v_movimento uuid; v_resultado jsonb; v_resultados jsonb:='[]'::jsonb;
  v_plano jsonb:='[]'::jsonb; v_etapa jsonb; v_estado text;
begin
  if v_ator is null or jsonb_typeof(p_entrada)<>'object' or not private.estoque_chaves_exatas(p_entrada,array['clinicaIdEsperada','atendimentoId','usoIds','divergenciasAceitas','chaveIdempotencia']) then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Confirmação de materiais inválida.'); end if;
  v_clinica:=private.estoque_uuid(p_entrada->>'clinicaIdEsperada'); v_chave:=private.estoque_uuid(p_entrada->>'chaveIdempotencia'); v_aceitos:=p_entrada->'divergenciasAceitas';
  if v_clinica is null or v_chave is null or private.estoque_uuid(p_entrada->>'atendimentoId') is null or jsonb_typeof(p_entrada->'usoIds')<>'array' or jsonb_array_length(p_entrada->'usoIds') not between 1 and 50 or jsonb_typeof(v_aceitos)<>'array' then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Confirmação de materiais inválida.'); end if;
  select array_agg(private.estoque_uuid(value)) into v_ids from jsonb_array_elements_text(p_entrada->'usoIds');
  if array_position(v_ids,null) is not null or cardinality(v_ids)<>cardinality(array(select distinct unnest(v_ids))) or exists(select 1 from jsonb_array_elements(v_aceitos) d where jsonb_typeof(d.value)<>'object' or not private.estoque_chaves_exatas(d.value,array['usoId','versaoItemEsperada']) or private.estoque_uuid(d.value->>'usoId') is null or private.estoque_versao(d.value->'versaoItemEsperada') is null) then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Confirmação de materiais inválida.'); end if;
  v_contexto:=private.estoque_contexto_travado(v_clinica); if (v_contexto->>'ok')::boolean is not true then return v_contexto; end if;
  select * into v_atendimento from public.atendimentos_clinicos where clinica_id=v_clinica and id=private.estoque_uuid(p_entrada->>'atendimentoId') for update;
  if not found or v_atendimento.dentista_id is distinct from private.estoque_uuid(v_contexto#>>'{data,dentistaId}') then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Atendimento indisponível.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_clinica::text||':'||v_ator::text||':'||v_chave::text,0)); v_hash:=private.estoque_hash('confirmar_usos',p_entrada);
  select * into v_replay from public.estoque_operacoes where clinica_id=v_clinica and ator_usuario_id=v_ator and chave_idempotencia=v_chave;
  if found then if v_replay.payload_hash is distinct from v_hash then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Chave já usada em outra operação.'); end if; return v_replay.resultado; end if;
  if (select count(*) from public.estoque_usos where clinica_id=v_clinica and atendimento_id=v_atendimento.id and id=any(v_ids))<>cardinality(v_ids) then return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Material indisponível.'); end if;
  if (select count(*) from public.estoque_usos where clinica_id=v_clinica and atendimento_id=v_atendimento.id and id=any(v_ids) and autor_usuario_id=v_ator and estado_operacional in ('confirmado','confirmado_divergente'))=cardinality(v_ids) then
    select jsonb_build_object('ok',true,'data',jsonb_build_object('usos',jsonb_agg(jsonb_build_object('usoId',u.id::text,'movimentoId',u.movimento_id::text,'estado',u.estado_operacional) order by u.item_id,u.lote_id,u.id))) into v_resultado
      from public.estoque_usos u where u.clinica_id=v_clinica and u.atendimento_id=v_atendimento.id and u.id=any(v_ids);
    return v_resultado;
  end if;
  if exists(select 1 from public.estoque_usos where clinica_id=v_clinica and atendimento_id=v_atendimento.id and id=any(v_ids) and estado_operacional<>'pendente_autorizacao') then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Este material já foi confirmado.'); end if;
  select coalesce(jsonb_agg(u.id::text order by u.id::text),'[]'::jsonb) into v_insuficientes
    from public.estoque_usos u join (
      select candidato.item_id,candidato.lote_id
      from public.estoque_usos candidato
      where candidato.clinica_id=v_clinica and candidato.id=any(v_ids)
      group by candidato.item_id,candidato.lote_id
      having coalesce((select sum(m.quantidade) from public.estoque_movimentos m
        where m.clinica_id=v_clinica and m.item_id=candidato.item_id and m.lote_id=candidato.lote_id),0)
        - sum(candidato.quantidade_declarada)<0
    ) d on d.item_id=u.item_id and d.lote_id=u.lote_id
    where u.clinica_id=v_clinica and u.id=any(v_ids);
  select coalesce(jsonb_agg(d.value->>'usoId' order by d.value->>'usoId'),'[]'::jsonb) into v_aceitos_ids from jsonb_array_elements(v_aceitos) d;
  if v_insuficientes<>v_aceitos_ids
    or (select count(*)<>count(distinct d.value->>'usoId') from jsonb_array_elements(v_aceitos) d)
    or exists(select 1 from jsonb_array_elements(v_aceitos) d where not private.estoque_uuid(d.value->>'usoId')=any(v_ids)) then
    return jsonb_build_object('ok',false,'codigo','SALDO_INSUFICIENTE','mensagem','Confirme explicitamente cada consumo divergente.'); end if;
  for v_uso in select * from public.estoque_usos where clinica_id=v_clinica and id=any(v_ids) order by item_id,lote_id,id for update loop
    if v_uso.estado_operacional<>'pendente_autorizacao' then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Este material já foi confirmado.'); end if;
    if v_uso.autor_usuario_id is distinct from v_ator then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Atendimento indisponível.'); end if;
    select * into v_item from public.estoque_itens where clinica_id=v_clinica and id=v_uso.item_id for update;
    perform 1 from public.estoque_lotes where clinica_id=v_clinica and item_id=v_item.id and id=v_uso.lote_id for update;
    if not found or not private.estoque_tem_acao(v_contexto,v_item.titular_tipo,v_item.titular_dentista_id,'estoque.consumir') then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso ao material.'); end if;
    if exists(select 1 from jsonb_array_elements(v_aceitos) d where private.estoque_uuid(d.value->>'usoId')=v_uso.id and private.estoque_versao(d.value->'versaoItemEsperada')<>v_item.versao) then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','O estoque mudou. Atualize antes de confirmar.'); end if;
  end loop;
  -- IDs são definidos antes da operação para que o replay devolva exatamente o mesmo fato.
  for v_uso in select * from public.estoque_usos where clinica_id=v_clinica and id=any(v_ids) order by item_id,lote_id,id for update loop
    v_movimento:=gen_random_uuid();
    v_estado:=case when v_insuficientes @> jsonb_build_array(v_uso.id::text) then 'confirmado_divergente' else 'confirmado' end;
    v_plano:=v_plano||jsonb_build_array(jsonb_build_object('usoId',v_uso.id::text,'movimentoId',v_movimento::text,'estado',v_estado));
  end loop;
  v_resultado:=jsonb_build_object('ok',true,'data',jsonb_build_object('usos',v_plano));
  insert into public.estoque_operacoes values(v_operacao,v_clinica,v_ator,v_chave,v_hash,v_resultado,now());
  for v_etapa in select value from jsonb_array_elements(v_plano) loop
    select * into v_uso from public.estoque_usos
      where clinica_id=v_clinica and id=private.estoque_uuid(v_etapa->>'usoId') for update;
    v_movimento:=private.estoque_uuid(v_etapa->>'movimentoId'); v_estado:=v_etapa->>'estado';
    insert into public.estoque_movimentos(id,clinica_id,item_id,lote_id,tipo,quantidade,motivo,origem_tipo,origem_id,operacao_id,ator_usuario_id) values(v_movimento,v_clinica,v_uso.item_id,v_uso.lote_id,'consumo',-v_uso.quantidade_declarada,'Uso confirmado na ficha.','uso_atendimento',v_uso.id,v_operacao,v_ator);
    update public.estoque_usos set movimento_id=v_movimento,operacao_id=v_operacao,estado_operacional=v_estado where clinica_id=v_clinica and id=v_uso.id;
    update public.estoque_itens set versao=versao+1 where clinica_id=v_clinica and id=v_uso.item_id;
    insert into public.estoque_auditoria(clinica_id,ator_usuario_id,acao,item_id,antes,depois,motivo,operacao_id) values(v_clinica,v_ator,'uso_atendimento',v_uso.item_id,jsonb_build_object('saldo',private.estoque_decimal_text(coalesce((select sum(quantidade) from public.estoque_movimentos where clinica_id=v_clinica and item_id=v_uso.item_id),0)+v_uso.quantidade_declarada)),jsonb_build_object('usoId',v_uso.id::text,'movimentoId',v_movimento::text), 'Uso confirmado na ficha.',v_operacao);
    v_resultados:=v_resultados||jsonb_build_array(jsonb_build_object('usoId',v_uso.id::text,'movimentoId',v_movimento::text,'estado',v_estado));
  end loop;
  return v_resultado;
exception when lock_not_available or query_canceled then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Materiais indisponíveis. Tente novamente.');
when others then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível confirmar os materiais.'); end;
$$;

create function public.declarar_usos_estoque(p_entrada jsonb) returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.declarar_usos_estoque(p_entrada); $$;
create function public.confirmar_usos_estoque(p_entrada jsonb) returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.confirmar_usos_estoque(p_entrada); $$;

alter table public.estoque_kits enable row level security;
alter table public.estoque_kit_versoes enable row level security;
alter table public.estoque_kit_componentes enable row level security;
alter table public.estoque_usos enable row level security;
revoke all on public.estoque_kits,public.estoque_kit_versoes,public.estoque_kit_componentes,public.estoque_usos from public,anon,authenticated,service_role;
revoke all on function private.estoque_validar_kit_componente(),private.estoque_validar_uso(),private.estoque_tem_kit_gerir(jsonb,text,uuid),private.operar_kits_estoque(text,jsonb),private.declarar_usos_estoque(jsonb),private.confirmar_usos_estoque(jsonb),public.operar_kits_estoque(text,jsonb),public.declarar_usos_estoque(jsonb),public.confirmar_usos_estoque(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.operar_kits_estoque(text,jsonb),private.declarar_usos_estoque(jsonb),private.confirmar_usos_estoque(jsonb),public.operar_kits_estoque(text,jsonb),public.declarar_usos_estoque(jsonb),public.confirmar_usos_estoque(jsonb) to authenticated;
