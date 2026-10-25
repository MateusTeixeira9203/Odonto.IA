-- OD-015b1: somente escrita local para revisão; NÃO aplicado pelo Dev.
-- Base = definição efetiva de produção em 24/10/2026, lida no odonto-qa; igualdade informada pelo DIFF-banco.
-- MD5 anterior assinar_procedimentos(uuid[],text,text): 249a57baa2a8fefdb42acc77f3299c2f
begin;
create or replace function public.assinar_procedimentos(p_evento_ids uuid[], p_assinado_por text, p_assinatura_ref text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ficha_id      uuid;
  v_clinica_id    uuid := get_my_clinica_id();
  v_caller        uuid := get_my_dentista_id();
  v_role          text := get_my_role();
  v_total         int  := coalesce(array_length(p_evento_ids, 1), 0);
  v_count         int;
  v_autores       int;
  v_autor_id      uuid;
  v_cro           text;
  v_assinatura_id uuid;
begin
  if v_caller is null or v_clinica_id is null or coalesce(v_role, '') not in ('admin','dentista','secretaria') then
    raise exception 'sem_permissao';
  end if;
  if v_total = 0 then raise exception 'status_invalido'; end if;

  select e.ficha_id into v_ficha_id
  from public.odontograma_eventos e where e.id = p_evento_ids[1] and e.clinica_id = v_clinica_id;

  perform 1 from public.fichas f
  where f.id = v_ficha_id and f.clinica_id = v_clinica_id for update;
  if not found then raise exception 'status_invalido'; end if;
  perform e.id from public.odontograma_eventos e
  where e.id = any(p_evento_ids) and e.clinica_id = v_clinica_id and e.ficha_id = v_ficha_id
  order by e.id for update;

  -- Autor de cada procedimento: quem recebeu o encaminhamento, senão quem registrou.
  select count(*),
         count(distinct coalesce(e.encaminhado_para, e.dentista_id)),
         min(coalesce(e.encaminhado_para, e.dentista_id)::text)::uuid
    into v_count, v_autores, v_autor_id
  from public.odontograma_eventos e
  where e.id = any(p_evento_ids)
    and e.clinica_id = v_clinica_id
    and e.ficha_id = v_ficha_id
    and e.status = 'realizado'
    and e.assinatura_id is null
    and (to_jsonb(e)->>'retirado_em') is null;

  if v_count <> v_total then raise exception 'status_invalido'; end if;
  if v_autores <> 1 then raise exception 'autores_diferentes'; end if;
  -- O próprio autor assina; a secretária assina pela recepção (o CRO é sempre o do autor).
  if v_autor_id <> v_caller and v_role <> 'secretaria' then raise exception 'sem_permissao'; end if;

  select d.cro into v_cro
  from public.dentistas d where d.id = v_autor_id and d.clinica_id = v_clinica_id;
  if v_cro is null then raise exception 'sem_permissao'; end if;

  insert into public.assinaturas
    (clinica_id, paciente_id, tipo, ficha_id, dentista_id, assinado_por, cro_no_ato, assinatura_ref)
  select v_clinica_id, e.paciente_id, 'procedimentos', v_ficha_id, v_autor_id, p_assinado_por, v_cro, p_assinatura_ref
  from public.odontograma_eventos e where e.id = p_evento_ids[1] and e.clinica_id = v_clinica_id
  returning id into v_assinatura_id;

  update public.odontograma_eventos set assinatura_id = v_assinatura_id
  where id = any(p_evento_ids) and clinica_id = v_clinica_id and ficha_id = v_ficha_id
    and (to_jsonb(odontograma_eventos)->>'retirado_em') is null;

  return v_assinatura_id;
end;
$function$;
notify pgrst, 'reload schema';
commit;
