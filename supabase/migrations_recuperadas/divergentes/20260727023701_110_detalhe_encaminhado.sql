create or replace function public.preencher_detalhe_encaminhado(
  p_evento_id  uuid,
  p_detalhe    jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := get_my_dentista_id();
  v_tipo   text;
begin
  select e.tipo into v_tipo
  from public.odontograma_eventos e
  left join public.fichas f on f.id = e.ficha_id
  where e.id = p_evento_id
    and e.clinica_id = get_my_clinica_id()
    and e.encaminhado_para = v_caller
    and f.assinado_em is null;

  if v_tipo is null then
    raise exception 'sem_permissao';
  end if;
  if v_tipo not in ('endodontia', 'implante') then
    raise exception 'tipo_nao_suportado';
  end if;

  update public.odontograma_eventos
     set detalhe = p_detalhe
   where id = p_evento_id;
end;
$$;

comment on function public.preencher_detalhe_encaminhado is
  'Escrita estreita do DESTINO de um encaminhamento (R-04b): so o detalhe (tabela clinica), restrita a tipo in (endodontia, implante). NUNCA toca observacao (do autor), status, tipo, ancora, autoria nem encaminhado_para -- marcar realizado continua em concluir_evento_encaminhado (migration 109).';

revoke execute on function public.preencher_detalhe_encaminhado(uuid, jsonb) from anon, public;
grant  execute on function public.preencher_detalhe_encaminhado(uuid, jsonb) to authenticated;