-- OD-015b1 M3b: volta segura; preserva copias, policy, gatilho e revoke DELETE.
-- pg_get_functiondef capturado SOMENTE no odonto-qa; md5 66385c83a5ca541027363a0d8ca88575.
-- Preservar os finais CRLF do corpo capturado para a conferencia exata do md5.
begin;
CREATE OR REPLACE FUNCTION public.excluir_ficha_clinica(p_ficha_id uuid, p_motivo text, p_motivo_detalhe text, p_nome_paciente text, p_confirma_orcamento_aceito boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller     uuid := public.get_my_dentista_id();
  v_role       text := public.get_my_role();
  v_ficha      public.fichas%rowtype;
  v_nome       text;
  v_detalhe    text := nullif(btrim(coalesce(p_motivo_detalhe, '')), '');
  v_eventos    uuid[];
  v_orcs       uuid[];
  v_mantidos   uuid[];
  v_apagados   int;
  v_pontes     int;
  v_visitas    uuid[];
  v_vazias     uuid[] := '{}';
  v_id         uuid;
  v_resumo     jsonb;
  v_exclusao   uuid;
begin
  if v_clinica_id is null or v_caller is null
     or coalesce(v_role, '') not in ('admin', 'dentista')
     or not public.has_active_membership() then
    raise exception 'sem_permissao';
  end if;
  -- fichas tem a policy RESTRITIVA commercial_write_fichas; SECURITY DEFINER passa por cima da RLS.
  if not private.commercial_write_allowed(v_clinica_id) then
    raise exception 'cobranca_bloqueada';
  end if;

  select * into v_ficha from public.fichas f
  where f.id = p_ficha_id and f.clinica_id = v_clinica_id
  for update;
  if not found then raise exception 'ficha_nao_encontrada'; end if;
  if v_ficha.dentista_id <> v_caller then raise exception 'sem_permissao'; end if;

  -- 1. Prova clínica: sempre recusa. O aceite DO ORÇAMENTO não é prova clínica (tratado no passo 5).
  if v_ficha.assinado_em is not null or v_ficha.assinatura_url is not null
     or exists (select 1 from public.odontograma_eventos e
                where e.ficha_id = v_ficha.id and e.assinatura_id is not null)
     or exists (select 1 from public.assinaturas a
                where a.ficha_id = v_ficha.id and a.tipo <> 'orcamento')
     or exists (select 1 from public.documentos_aceite d
                where d.ficha_id = v_ficha.id and d.tipo <> 'orcamento') then
    raise exception 'ficha_assinada';
  end if;

  -- 2. Procedimentos da ficha, travados.
  perform 1 from public.odontograma_eventos e
  where e.ficha_id = v_ficha.id and e.clinica_id = v_clinica_id
  order by e.id for update;
  select coalesce(array_agg(e.id), '{}') into v_eventos
  from public.odontograma_eventos e
  where e.ficha_id = v_ficha.id and e.clinica_id = v_clinica_id;

  -- 3. Os gatilhos da prova clínica barram apagar procedimento retirado ou encaminhado a outro
  --    dentista. Recusa clara antes, em vez do erro do gatilho.
  if exists (select 1 from public.odontograma_eventos e
             where e.id = any(v_eventos) and e.retirado_em is not null) then
    raise exception 'ficha_com_retirado';
  end if;
  if exists (select 1 from public.odontograma_eventos e
             where e.id = any(v_eventos)
               and e.encaminhado_para is not null and e.encaminhado_para <> v_caller) then
    raise exception 'ficha_com_encaminhamento';
  end if;

  -- 4. Motivo e nome do paciente (confirmação forte conferida no banco).
  if p_motivo is null or p_motivo not in
       ('paciente_errado', 'ficha_duplicada', 'aberta_por_engano', 'registro_incompleto', 'outro')
     or (p_motivo = 'outro' and (v_detalhe is null or char_length(v_detalhe) not between 5 and 200)) then
    raise exception 'motivo_invalido';
  end if;
  if p_motivo <> 'outro' then v_detalhe := null; end if;

  select p.nome into v_nome from public.pacientes p
  where p.id = v_ficha.paciente_id and p.clinica_id = v_clinica_id;
  if v_nome is null
     or lower(regexp_replace(btrim(coalesce(p_nome_paciente, '')), '\s+', ' ', 'g'))
        <> lower(regexp_replace(btrim(v_nome), '\s+', ' ', 'g')) then
    raise exception 'confirmacao_invalida';
  end if;

  -- 5. Orçamentos da ficha (pelo ficha_id ou pelas pontes), travados.
  perform 1 from public.orcamentos o
  where o.clinica_id = v_clinica_id
    and (o.ficha_id = v_ficha.id
         or o.id in (select oe.orcamento_id from public.orcamento_eventos oe
                     where oe.evento_id = any(v_eventos)))
  order by o.id for update;
  select coalesce(array_agg(o.id), '{}') into v_orcs
  from public.orcamentos o
  where o.clinica_id = v_clinica_id
    and (o.ficha_id = v_ficha.id
         or o.id in (select oe.orcamento_id from public.orcamento_eventos oe
                     where oe.evento_id = any(v_eventos)));

  if exists (select 1 from public.orcamentos o
             where o.id = any(v_orcs) and o.paciente_id is distinct from v_ficha.paciente_id) then
    raise exception 'ficha_contexto_invalido';
  end if;

  -- Orçamento com aceite ou com movimento financeiro: é MANTIDO, e só se apaga a ficha
  -- com a caixa de confirmação marcada.
  select coalesce(array_agg(o.id), '{}') into v_mantidos
  from public.orcamentos o
  where o.id = any(v_orcs)
    and (o.status = 'aprovado' or o.aprovado_em is not null
         or exists (select 1 from public.orcamento_itens i where i.orcamento_id = o.id and i.aprovado)
         or exists (select 1 from public.assinaturas a where a.orcamento_id = o.id)
         or exists (select 1 from public.documentos_aceite d where d.orcamento_id = o.id)
         or exists (select 1 from public.pagamentos p where p.orcamento_id = o.id)
         or exists (select 1 from public.orcamento_cobrancas c where c.orcamento_id = o.id));

  if cardinality(v_mantidos) > 0 and p_confirma_orcamento_aceito is not true then
    raise exception 'confirmar_orcamento_aceito';
  end if;

  -- Orçamento sem aceite e sem movimento, ligado à ficha: sai junto, como antes.
  select count(*) into v_apagados from public.orcamentos o
  where o.id = any(v_orcs) and not (o.id = any(v_mantidos)) and o.ficha_id = v_ficha.id;
  select count(*) into v_pontes from public.orcamento_eventos oe where oe.evento_id = any(v_eventos);

  select coalesce(array_agg(distinct s.x), '{}') into v_visitas from (
    select fe.atendimento_id as x from public.ficha_evolucoes fe
    where fe.ficha_id = v_ficha.id and fe.atendimento_id is not null
    union
    select ae.atendimento_id from public.atendimento_eventos ae
    where ae.evento_id = any(v_eventos)
  ) s;

  -- RESUMO: só contagens, datas e ids. Nada de texto, dente ou nome de procedimento.
  v_resumo := jsonb_build_object(
    'data_atendimento',  v_ficha.data_atendimento,
    'ficha_criada_em',   v_ficha.created_at,
    'origem',            v_ficha.origem,
    'evolucoes',         (select count(*) from public.ficha_evolucoes fe where fe.ficha_id = v_ficha.id),
    'procedimentos',     cardinality(v_eventos),
    'procedimentos_realizados',
                         (select count(*) from public.odontograma_eventos e
                          where e.id = any(v_eventos) and e.status = 'realizado'),
    'arquivos',          (select count(*) from public.ficha_arquivos a where a.ficha_id = v_ficha.id),
    'planejamentos',     (select count(*) from public.planejamentos p where p.ficha_id = v_ficha.id),
    'orcamentos_apagados',            v_apagados,
    'orcamentos_mantidos',            cardinality(v_mantidos),
    'orcamentos_mantidos_ids',        to_jsonb(v_mantidos),
    'vinculos_orcamento_desligados',  v_pontes,
    'confirmou_orcamento_aceito',     cardinality(v_mantidos) > 0);

  -- 6. Desliga o orçamento mantido da ficha. Nada comercial é apagado.
  update public.orcamentos set ficha_id = null
  where id = any(v_mantidos) and ficha_id = v_ficha.id;
  update public.documentos_aceite set ficha_id = null
  where ficha_id = v_ficha.id and tipo = 'orcamento';
  delete from public.orcamento_eventos where evento_id = any(v_eventos);

  delete from public.fichas where id = v_ficha.id;

  foreach v_id in array v_visitas loop
    delete from public.atendimentos_clinicos a
    where a.id = v_id and a.clinica_id = v_clinica_id and a.dentista_id = v_caller
      and not exists (select 1 from public.atendimento_eventos ae where ae.atendimento_id = a.id)
      and not exists (select 1 from public.ficha_evolucoes fe where fe.atendimento_id = a.id)
      and not exists (select 1 from public.estoque_usos eu where eu.atendimento_id = a.id);
    if found then v_vazias := v_vazias || v_id; end if;
  end loop;

  insert into public.prontuario_exclusoes
    (clinica_id, tipo, paciente_id, ficha_id, excluido_por, excluido_por_usuario,
     motivo, motivo_detalhe, resumo)
  values
    (v_clinica_id, 'ficha', v_ficha.paciente_id, v_ficha.id, v_caller, auth.uid(),
     p_motivo, v_detalhe,
     v_resumo || jsonb_build_object('visitas_descartadas', cardinality(v_vazias)))
  returning id into v_exclusao;

  return jsonb_build_object('exclusao_id', v_exclusao,
                            'visitas_descartadas', cardinality(v_vazias),
                            'orcamentos_mantidos', cardinality(v_mantidos));
end;
$function$
;
-- A tabela prontuario_exclusoes_copias, policy e gatilho FICAM.
-- DELETE em fichas NAO e devolvido: nao restaurar o bypass de auditoria/confirmacao.
notify pgrst, 'reload schema';
commit;
