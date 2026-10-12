-- R-182 / R182-EST-01
-- A conclusão de um encaminhamento precisa tornar explícito que o evento volta para
-- a sessão atual. Sem isso, um evento indicado para a próxima sessão viola a
-- constraint odontograma_eventos_momento_coerente ao passar para realizado.

begin;

create or replace function public.concluir_evento_encaminhado(
  p_evento_ids   uuid[],
  p_novo_status  text,
  p_realizado_em date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinica_id uuid := get_my_clinica_id();
  v_caller     uuid := get_my_dentista_id();
  v_role       text := get_my_role();
  v_count      int;
  v_actor_nome text;
begin
  if v_role not in ('admin', 'dentista') then
    raise exception 'sem_permissao';
  end if;
  if p_novo_status not in ('indicado', 'realizado') then
    raise exception 'status_invalido';
  end if;

  select d.nome into v_actor_nome
  from public.dentistas d
  where d.id = v_caller and d.clinica_id = v_clinica_id;

  if v_actor_nome is null then
    raise exception 'sem_permissao';
  end if;

  select count(*) into v_count
  from public.odontograma_eventos e
  left join public.fichas f on f.id = e.ficha_id
  where e.id = any(p_evento_ids)
    and e.clinica_id = v_clinica_id
    and e.encaminhado_para = v_caller
    and f.assinado_em is null;

  if v_count <> coalesce(array_length(p_evento_ids, 1), 0) then
    raise exception 'sem_permissao';
  end if;

  with alterados as (
    update public.odontograma_eventos
       set status             = p_novo_status,
           realizado_em       = case when p_novo_status = 'realizado' then p_realizado_em else null end,
           momento_planejado  = case when p_novo_status = 'realizado' then 'sessao_atual' else momento_planejado end
     where id = any(p_evento_ids)
       and clinica_id = v_clinica_id
    returning id, paciente_id
  )
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  )
  select
    v_clinica_id,
    v_caller,
    v_actor_nome,
    alterados.paciente_id,
    'odontograma_evento',
    alterados.id::text,
    case when p_novo_status = 'realizado'
      then 'odontograma_evento.marcado_realizado'
      else 'odontograma_evento.reaberto'
    end,
    jsonb_build_object('status', p_novo_status, 'realizado_em', p_realizado_em)
  from alterados;
end;
$$;

revoke execute on function public.concluir_evento_encaminhado(uuid[], text, date) from anon, public;
grant execute on function public.concluir_evento_encaminhado(uuid[], text, date) to authenticated;

commit;
