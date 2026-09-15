begin;
set local lock_timeout = '5s';

-- Atualiza exclusivamente a narrativa da consulta escolhida, sob as policies existentes.
create function public.editar_evolucao_clinica(
  p_paciente_id uuid, p_ficha_id uuid, p_atendimento_id uuid,
  p_evolucao_id uuid, p_texto_original text, p_texto text
) returns text
language plpgsql security invoker set search_path = public
as $$
declare
  v_clinica uuid := public.get_my_clinica_id();
  v_autor uuid := public.get_my_dentista_id();
  v_ficha public.fichas%rowtype;
  v_evolucao public.ficha_evolucoes%rowtype;
  v_data date;
  v_texto text := nullif(btrim(p_texto), '');
begin
  if auth.uid() is null or v_clinica is null or v_autor is null
     or coalesce(public.get_my_role(), '') not in ('dentista', 'admin') then
    raise exception 'evolucao_sem_permissao';
  end if;
  if p_paciente_id is null or p_ficha_id is null or p_texto is null
     or char_length(p_texto) > 20000 then raise exception 'evolucao_invalida'; end if;

  select * into v_ficha from public.fichas
  where id = p_ficha_id and clinica_id = v_clinica and paciente_id = p_paciente_id for update;
  if not found then raise exception 'evolucao_sem_permissao'; end if;
  if v_ficha.assinado_em is not null or v_ficha.assinatura_url is not null then
    raise exception 'evolucao_assinada';
  end if;

  if p_evolucao_id is not null then
    select * into v_evolucao from public.ficha_evolucoes
    where id = p_evolucao_id and ficha_id = p_ficha_id and clinica_id = v_clinica
      and atendimento_id is not distinct from p_atendimento_id for update;
    if not found or v_evolucao.dentista_id is distinct from v_autor
       or v_evolucao.automatica then raise exception 'evolucao_sem_permissao'; end if;
    if v_evolucao.texto is distinct from p_texto_original then raise exception 'evolucao_conflito'; end if;
    update public.ficha_evolucoes set texto = v_texto, updated_at = now()
    where id = p_evolucao_id and clinica_id = v_clinica;
    if not found then raise exception 'evolucao_sem_permissao'; end if;
  elsif p_atendimento_id is null then
    -- O leitor usa anotacoes apenas quando não existe linha de evolução.
    if v_ficha.dentista_id is distinct from v_autor then raise exception 'evolucao_sem_permissao'; end if;
    if exists(select 1 from public.ficha_evolucoes where ficha_id = p_ficha_id and clinica_id = v_clinica)
      then raise exception 'evolucao_conflito'; end if;
    if v_ficha.anotacoes is distinct from p_texto_original then raise exception 'evolucao_conflito'; end if;
    update public.fichas set anotacoes = v_texto, updated_at = now()
    where id = p_ficha_id and clinica_id = v_clinica and paciente_id = p_paciente_id;
    if not found then raise exception 'evolucao_sem_permissao'; end if;
  else
    select data_atendimento into v_data from public.atendimentos_clinicos
    where id = p_atendimento_id and clinica_id = v_clinica
      and paciente_id = p_paciente_id and dentista_id = v_autor;
    if not found or not exists (
      select 1 from public.atendimento_eventos ae
      join public.odontograma_eventos e on e.id = ae.evento_id and e.clinica_id = v_clinica
      where ae.atendimento_id = p_atendimento_id and ae.clinica_id = v_clinica
        and e.ficha_id = p_ficha_id and e.paciente_id = p_paciente_id
    ) then raise exception 'evolucao_sem_permissao'; end if;
    if p_texto_original is not null or exists (
      select 1 from public.ficha_evolucoes where ficha_id = p_ficha_id and clinica_id = v_clinica
        and atendimento_id = p_atendimento_id
    ) then raise exception 'evolucao_conflito'; end if;
    insert into public.ficha_evolucoes(clinica_id, ficha_id, atendimento_id, dentista_id, data, texto, automatica)
    values (v_clinica, p_ficha_id, p_atendimento_id, v_autor, v_data, v_texto, false);
  end if;
  return v_texto;
end;
$$;
revoke all on function public.editar_evolucao_clinica(uuid, uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.editar_evolucao_clinica(uuid, uuid, uuid, uuid, text, text) to authenticated;
commit;
