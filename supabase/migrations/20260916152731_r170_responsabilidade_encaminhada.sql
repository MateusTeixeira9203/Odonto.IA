begin;
set local lock_timeout = '5s';

-- R-170: encaminhar não transfere autoria. Depois de aceito, o destino é o único
-- profissional que pode mutar o evento; a origem preserva leitura clínica.
create or replace function public.bloquear_mutacao_de_evento_encaminhado()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_caller uuid := public.get_my_dentista_id();
begin
  if old.encaminhado_para is not null
     and v_caller is distinct from old.encaminhado_para then
    raise exception 'responsavel_do_encaminhamento';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_odontograma_evento_responsavel on public.odontograma_eventos;
create trigger trg_odontograma_evento_responsavel
before update or delete on public.odontograma_eventos
for each row execute function public.bloquear_mutacao_de_evento_encaminhado();

-- A RPC incremental já valida todo o payload antes de inserir. Só abrimos a ficha
-- para quem de fato recebeu ao menos um evento dela, preservando autoria dos itens novos.
do $r170_add$
declare
  v_def text;
  v_from text := $$if v_ficha.dentista_id is distinct from v_caller then
    raise exception 'sem_permissao';
  end if;$$;
  v_to text := $$if v_ficha.dentista_id is distinct from v_caller
     and not exists (
       select 1 from public.odontograma_eventos e
       where e.ficha_id = p_ficha_id
         and e.clinica_id = v_clinica_id
         and e.encaminhado_para = v_caller
         and e.retirado_em is null
     ) then
    raise exception 'sem_permissao';
  end if;$$;
begin
  select pg_get_functiondef('public.adicionar_procedimentos_ficha(uuid,uuid,uuid,jsonb)'::regprocedure)
    into v_def;
  if position(v_from in v_def) = 0 then
    raise exception 'r170: contrato de adicionar procedimentos inesperado';
  end if;
  execute replace(v_def, v_from, v_to);
end;
$r170_add$;

-- Assinatura pertence ao responsável clínico de cada evento, não ao autor da ficha.
do $r170_sign$
declare
  v_def text;
  v_from text := $$and (to_jsonb(e)->>'retirado_em') is null;$$;
  v_to text := $$and (to_jsonb(e)->>'retirado_em') is null
    and coalesce(e.encaminhado_para, e.dentista_id) = v_caller;$$;
begin
  select pg_get_functiondef('public.assinar_procedimentos(uuid[],text,text)'::regprocedure)
    into v_def;
  if position(v_from in v_def) = 0 then
    raise exception 'r170: contrato de assinatura inesperado';
  end if;
  v_def := replace(v_def, v_from, v_to);
  v_def := replace(
    v_def,
    $$select f.dentista_id, d.cro into v_autor_id, v_cro
  from public.fichas f join public.dentistas d on d.id = f.dentista_id
  where f.id = v_ficha_id and f.clinica_id = v_clinica_id;

  if v_autor_id is null or (v_autor_id <> v_caller and v_role <> 'secretaria') then
    raise exception 'sem_permissao';
  end if;$$,
    $$select d.cro into v_cro
  from public.dentistas d
  where d.id = v_caller and d.clinica_id = v_clinica_id;

  if v_cro is null then
    raise exception 'sem_permissao';
  end if;$$
  );
  v_def := replace(v_def, $$v_ficha_id, v_autor_id, p_assinado_por, v_cro, p_assinatura_ref$$, $$v_ficha_id, v_caller, p_assinado_por, v_cro, p_assinatura_ref$$);
  if position($$v_ficha_id, v_caller, p_assinado_por, v_cro, p_assinatura_ref$$ in v_def) = 0 then
    raise exception 'r170: autoria de assinatura inesperada';
  end if;
  execute v_def;
end;
$r170_sign$;

-- A RPC de edição já limita detalhe técnico por tipo e registra auditoria. Depois de
-- encaminhar, a autoria passa a ser somente leitura: só quem recebeu pode editar o detalhe.
do $r170_detail$
declare
  v_def text;
  v_from text := $$if v_caller is distinct from v_evento.dentista_id and v_caller is distinct from v_evento.encaminhado_para then
    raise exception 'sem_permissao';
  end if;
  if v_caller is distinct from v_evento.dentista_id and (p_alterar_nome or p_alterar_observacao) then
    raise exception 'sem_permissao';
  end if;$$;
  v_to text := $$if v_evento.encaminhado_para is null then
    if v_caller is distinct from v_evento.dentista_id then
      raise exception 'sem_permissao';
    end if;
  elsif v_caller is distinct from v_evento.encaminhado_para
     or p_alterar_nome
     or p_alterar_observacao
     or not p_alterar_detalhe then
    raise exception 'sem_permissao';
  end if;$$;
begin
  select pg_get_functiondef(
    'public.editar_detalhes_evento_odontograma(uuid,jsonb,boolean,text,boolean,text,boolean,jsonb)'::regprocedure
  ) into v_def;
  if position(v_from in v_def) = 0 then
    raise exception 'r170: contrato de edição de detalhes inesperado';
  end if;
  execute replace(v_def, v_from, v_to);
end;
$r170_detail$;

revoke all on function public.bloquear_mutacao_de_evento_encaminhado() from public, anon;
grant execute on function public.adicionar_procedimentos_ficha(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.assinar_procedimentos(uuid[], text, text) to authenticated;
grant execute on function public.editar_detalhes_evento_odontograma(uuid, jsonb, boolean, text, boolean, text, boolean, jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
