-- R-181: Gestão passa a ser a porta canônica do estoque.
-- Habilita o domínio para governanças já configuradas e faz o RPC consumir
-- capabilities canônicas, preservando concessões antigas de estoque durante a transição.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

update public.clinica_governanca
set modelo_estoque = coalesce(modelo_estoque, modalidade),
    estoque_ativo = true,
    updated_at = now()
where modalidade in ('colaborativa', 'gerida')
  and (modelo_estoque is null or estoque_ativo is false);

create or replace function private.r181_habilitar_estoque_governanca()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if new.modalidade in ('colaborativa', 'gerida') then
    new.modelo_estoque := coalesce(new.modelo_estoque, new.modalidade);
    new.estoque_ativo := true;
  end if;
  return new;
end;
$$;

drop trigger if exists r181_habilitar_estoque_governanca on public.clinica_governanca;
create trigger r181_habilitar_estoque_governanca
before insert or update of modalidade on public.clinica_governanca
for each row execute function private.r181_habilitar_estoque_governanca();

create or replace function private.obter_contexto_estoque(p_clinica_id_esperada uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_ator uuid := auth.uid();
  v_clinica uuid;
  v_membro public.clinica_usuarios%rowtype;
  v_governanca public.clinica_governanca%rowtype;
  v_dentista uuid;
  v_todas jsonb := '["estoque.ajustar","estoque.consumir","estoque.descartar","estoque.gerir","estoque.ler","estoque.receber"]';
  v_compartilhadas jsonb := '[]';
  v_gerenciar boolean := false;
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

  v_gerenciar := exists (
    select 1 from public.clinica_vinculos_governanca vg
    where vg.clinica_id=v_clinica and vg.membro_id=v_membro.id
      and vg.estado='ativo' and vg.papel = 'proprietario'
  );

  if v_gerenciar then
    v_compartilhadas := v_todas;
  else
    select coalesce(jsonb_agg(permissao order by permissao),'[]'::jsonb)
    into v_compartilhadas
    from (
      select distinct item->>'permissao' as permissao
      from public.clinica_acessos ca
      cross join lateral jsonb_array_elements(ca.acessos || ca.acessos_estoque_ativos) item
      where ca.clinica_id=v_clinica and ca.membro_id=v_membro.id
        and item->>'permissao' in (
          'estoque.ler','estoque.gerir','estoque.receber',
          'estoque.consumir','estoque.descartar','estoque.ajustar'
        )
        and item->'escopo'->>'tipo'='clinica'
    ) permissoes;
  end if;

  return jsonb_build_object('ok',true,'data',jsonb_build_object(
    'clinicaId',v_clinica,
    'membroId',v_membro.id,
    'modelo',v_governanca.modelo_estoque,
    'dentistaId',v_dentista,
    'permissoesPessoais',case when v_dentista is null then '[]'::jsonb else v_todas end,
    'permissoesCompartilhadas',v_compartilhadas,
    'podeGerenciarCompartilhado',v_gerenciar
  ));
end;
$$;

revoke all on function private.r181_habilitar_estoque_governanca() from public, anon, authenticated, service_role;
