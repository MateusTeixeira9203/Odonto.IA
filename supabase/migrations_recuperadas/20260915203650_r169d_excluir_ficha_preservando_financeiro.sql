begin;
set local lock_timeout = '5s';

-- O autor pode excluir sua ficha; o vínculo clínico não leva o financeiro em cascade.
create function public.excluir_ficha_propria_preservando_financeiro(p_ficha_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_clinica uuid := public.get_my_clinica_id();
  v_autor uuid := public.get_my_dentista_id();
  v_ficha public.fichas%rowtype;
  v_eventos uuid[];
  v_orcamentos uuid[];
  v_pontes jsonb;
  v_evolucoes integer;
  v_nome text;
begin
  if auth.uid() is null or v_clinica is null or v_autor is null
     or coalesce(public.get_my_role(), '') not in ('dentista', 'admin') then
    raise exception 'exclusao_ficha_sem_permissao';
  end if;
  if not exists (select 1 from public.clinica_usuarios where usuario_id = auth.uid()
      and clinica_id = v_clinica and status = 'ativo' and role in ('dentista', 'admin'))
    or not exists (select 1 from public.dentistas where id = v_autor and clinica_id = v_clinica
      and user_id = auth.uid() and ativo = true) then
    raise exception 'exclusao_ficha_sem_permissao';
  end if;
  select * into v_ficha from public.fichas
  where id = p_ficha_id and clinica_id = v_clinica for update;
  if not found or v_ficha.dentista_id is distinct from v_autor then
    raise exception 'exclusao_ficha_sem_permissao';
  end if;
  if v_ficha.assinado_em is not null or v_ficha.assinatura_url is not null then
    raise exception 'exclusao_ficha_assinada';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_eventos from public.odontograma_eventos
  where ficha_id = p_ficha_id and clinica_id = v_clinica;
  perform id from public.orcamentos where clinica_id = v_clinica
    and (ficha_id = p_ficha_id or id in (select orcamento_id from public.orcamento_eventos
      where evento_id = any(v_eventos) and clinica_id = v_clinica)) order by id for update;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_orcamentos from public.orcamentos
  where clinica_id = v_clinica and (ficha_id = p_ficha_id or id in (
    select orcamento_id from public.orcamento_eventos where evento_id = any(v_eventos) and clinica_id = v_clinica));
  perform id from public.odontograma_eventos
  where ficha_id = p_ficha_id and clinica_id = v_clinica order by id for update;
  if exists(select 1 from public.odontograma_eventos
      where ficha_id = p_ficha_id and clinica_id = v_clinica and assinatura_id is not null)
    or exists(select 1 from public.assinaturas
      where ficha_id = p_ficha_id and clinica_id = v_clinica and tipo <> 'orcamento')
    or exists(select 1 from public.documentos_aceite
      where ficha_id = p_ficha_id and clinica_id = v_clinica and tipo <> 'orcamento') then
    raise exception 'exclusao_ficha_assinada';
  end if;

  if exists(select 1 from public.orcamentos where id = any(v_orcamentos)
      and (clinica_id is distinct from v_clinica or paciente_id is distinct from v_ficha.paciente_id)) then
    raise exception 'exclusao_ficha_contexto_invalido';
  end if;
  select coalesce(jsonb_agg(to_jsonb(oe)), '[]'::jsonb) into v_pontes
  from public.orcamento_eventos oe where evento_id = any(v_eventos) and clinica_id = v_clinica;
  select count(*) into v_evolucoes from public.ficha_evolucoes
  where ficha_id = p_ficha_id and clinica_id = v_clinica;

  -- Não há DELETE de orçamento, itens, cobranças, pagamentos ou documentos comerciais.
  update public.orcamentos set ficha_id = null where ficha_id = p_ficha_id and clinica_id = v_clinica;
  update public.assinaturas set ficha_id = null
  where ficha_id = p_ficha_id and clinica_id = v_clinica and tipo = 'orcamento';
  update public.documentos_aceite set ficha_id = null
  where ficha_id = p_ficha_id and clinica_id = v_clinica and tipo = 'orcamento';
  delete from public.orcamento_eventos where evento_id = any(v_eventos) and clinica_id = v_clinica;
  delete from public.fichas where id = p_ficha_id and clinica_id = v_clinica and dentista_id = v_autor;
  if not found then raise exception 'exclusao_ficha_sem_permissao'; end if;

  select nome into v_nome from public.dentistas where id = v_autor and clinica_id = v_clinica;
  insert into public.activity_logs(clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
  values (v_clinica, v_autor, v_nome, v_ficha.paciente_id, 'ficha', p_ficha_id::text, 'ficha.excluida',
    jsonb_build_object('eventos_antes', cardinality(v_eventos), 'eventos_depois', 0,
      'procedimentos_antes', v_ficha.procedimentos, 'procedimentos_depois', '[]'::jsonb,
      'orcamentos_preservados', v_orcamentos, 'vinculos_comerciais_anteriores', v_pontes));
  return jsonb_build_object('paciente_id', v_ficha.paciente_id, 'eventos', cardinality(v_eventos),
    'evolucoes', v_evolucoes, 'orcamentos_preservados', cardinality(v_orcamentos));
end;
$$;
revoke all on function public.excluir_ficha_propria_preservando_financeiro(uuid) from public, anon;
grant execute on function public.excluir_ficha_propria_preservando_financeiro(uuid) to authenticated;
commit;
