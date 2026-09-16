-- R-169c — exclusão física confirmada pelo dentista.
-- A interface exige ciência explícita; estas RPCs são a autoridade da transação e da clínica.

create or replace function public.bloquear_edicao_evento_assinado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Só as RPCs abaixo definem esta flag LOCAL antes de remover a ficha inteira.
  -- Fora da transação, o congelamento de evento assinado continua intacto.
  if current_setting('odonto.exclusao_confirmada', true) = 'on' then
    return coalesce(new, old);
  end if;
  if old.assinatura_id is not null then
    raise exception 'evento_assinado_imutavel';
  end if;
  if (to_jsonb(old)->>'retirado_em') is not null then
    raise exception 'evento_retirado_imutavel';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.excluir_orcamento_permanentemente(p_orcamento_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_paciente_id uuid;
  v_paciente_documento_ids uuid[];
begin
  if v_clinica_id is null or not public.is_clinic_dentista() then
    raise exception 'sem_permissao';
  end if;

  select o.paciente_id into v_paciente_id
  from public.orcamentos o
  where o.id = p_orcamento_id and o.clinica_id = v_clinica_id
  for update;
  if v_paciente_id is null then
    raise exception 'orcamento_nao_encontrado';
  end if;

  -- `documentos_aceite` usa RESTRICT; sua retirada explícita permite que o cascade do
  -- orçamento remova itens, cobranças, previsões, pagamentos e assinatura no mesmo commit.
  select array_agg(d.paciente_documento_id) into v_paciente_documento_ids
  from public.documentos_aceite d
  where d.clinica_id = v_clinica_id and d.orcamento_id = p_orcamento_id;

  delete from public.documentos_aceite d
  where d.clinica_id = v_clinica_id and d.orcamento_id = p_orcamento_id;

  delete from public.paciente_documentos pd
  where pd.id = any(v_paciente_documento_ids)
    and not exists (
      select 1 from public.documentos_aceite d
      where d.paciente_documento_id = pd.id
    );

  delete from public.orcamentos o
  where o.id = p_orcamento_id and o.clinica_id = v_clinica_id;
  if not found then
    raise exception 'orcamento_nao_encontrado';
  end if;
  return v_paciente_id;
end;
$$;

create or replace function public.excluir_ficha_permanentemente(p_ficha_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_paciente_id uuid;
  v_paciente_documento_ids uuid[];
begin
  if v_clinica_id is null or not public.is_clinic_dentista() then
    raise exception 'sem_permissao';
  end if;

  select f.paciente_id into v_paciente_id
  from public.fichas f
  where f.id = p_ficha_id and f.clinica_id = v_clinica_id
  for update;
  if v_paciente_id is null then
    raise exception 'ficha_nao_encontrada';
  end if;

  perform set_config('odonto.exclusao_confirmada', 'on', true);

  -- Remove a prova documental antes do cascade de ficha → orçamento/assinatura, pois as
  -- FKs de documento são RESTRICT. Todo o bloco participa da mesma transação da RPC.
  select array_agg(d.paciente_documento_id) into v_paciente_documento_ids
  from public.documentos_aceite d
  where d.clinica_id = v_clinica_id
    and (
      d.ficha_id = p_ficha_id
      or d.orcamento_id in (
        select o.id from public.orcamentos o
        where o.ficha_id = p_ficha_id and o.clinica_id = v_clinica_id
      )
    );

  delete from public.documentos_aceite d
  where d.clinica_id = v_clinica_id
    and (
      d.ficha_id = p_ficha_id
      or d.orcamento_id in (
        select o.id from public.orcamentos o
        where o.ficha_id = p_ficha_id and o.clinica_id = v_clinica_id
      )
    );

  delete from public.paciente_documentos pd
  where pd.id = any(v_paciente_documento_ids)
    and not exists (
      select 1 from public.documentos_aceite d
      where d.paciente_documento_id = pd.id
    );

  delete from public.fichas f
  where f.id = p_ficha_id and f.clinica_id = v_clinica_id;
  if not found then
    raise exception 'ficha_nao_encontrada';
  end if;
  return v_paciente_id;
end;
$$;

revoke all on function public.excluir_orcamento_permanentemente(uuid) from public, anon;
revoke all on function public.excluir_ficha_permanentemente(uuid) from public, anon;
grant execute on function public.excluir_orcamento_permanentemente(uuid) to authenticated;
grant execute on function public.excluir_ficha_permanentemente(uuid) to authenticated;
