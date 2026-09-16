-- R165: conclui inicialização de novos cadastros. Não altera clínicas existentes.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create or replace function public.iniciar_onboarding_r165(
  p_modalidade text,
  p_modelo_clinica text,
  p_atua_clinicamente boolean,
  p_nome_clinica text,
  p_nome_usuario text,
  p_cro text default null,
  p_especialidades text[] default '{}',
  p_telefone text default null,
  p_cidade text default null,
  p_estado text default null,
  p_foco_principal text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_clinica_id uuid := gen_random_uuid();
  v_membro_id uuid := gen_random_uuid();
  v_dentista_id uuid;
  v_assinatura_id uuid;
  v_role text;
  v_plano text;
  v_email text;
begin
  if v_usuario_id is null then
    raise exception 'UNAUTHENTICATED: usuário não autenticado' using errcode = 'P0401';
  end if;
  if p_modalidade is null or p_modalidade not in ('individual', 'centralizada') then
    raise exception 'INVALID_INPUT: modalidade inválida' using errcode = 'P0400';
  end if;
  if p_modelo_clinica is null or p_modelo_clinica not in ('colaborativa', 'gerida') then
    raise exception 'INVALID_INPUT: modelo clínico inválido' using errcode = 'P0400';
  end if;
  if p_atua_clinicamente is null then
    raise exception 'INVALID_INPUT: informe se você atende pacientes' using errcode = 'P0400';
  end if;
  if char_length(trim(coalesce(p_nome_clinica, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_nome_usuario, ''))) not between 2 and 120 then
    raise exception 'INVALID_INPUT: nome inválido' using errcode = 'P0400';
  end if;
  if p_foco_principal is not null and p_foco_principal not in ('economizar_tempo', 'crescer') then
    raise exception 'INVALID_INPUT: foco inválido' using errcode = 'P0400';
  end if;
  if p_modalidade = 'centralizada' and p_modelo_clinica <> 'gerida' then
    raise exception 'INVALID_INPUT: cobrança centralizada exige responsável da clínica' using errcode = 'P0400';
  end if;
  if not p_atua_clinicamente and p_modelo_clinica <> 'gerida' then
    raise exception 'INVALID_INPUT: proprietário não clínico exige clínica gerida' using errcode = 'P0400';
  end if;
  if p_atua_clinicamente and (
    char_length(trim(coalesce(p_cro, ''))) not between 1 and 60
    or coalesce(array_length(p_especialidades, 1), 0) not between 1 and 10
    or exists (select 1 from unnest(p_especialidades) as especialidade
               where char_length(trim(coalesce(especialidade, ''))) not between 1 and 80)
  ) then
    raise exception 'INVALID_INPUT: dados clínicos obrigatórios' using errcode = 'P0400';
  end if;
  if char_length(trim(coalesce(p_telefone, ''))) > 40
    or char_length(trim(coalesce(p_cidade, ''))) > 120
    or (p_estado is not null and char_length(trim(p_estado)) <> 2) then
    raise exception 'INVALID_INPUT: contato inválido' using errcode = 'P0400';
  end if;
  select email into v_email from public.users where id = v_usuario_id for update;
  if v_email is null then
    raise exception 'USER_NOT_FOUND: registro em public.users ausente' using errcode = 'P0404';
  end if;
  if exists (select 1 from public.clinica_usuarios where usuario_id = v_usuario_id and status = 'ativo') then
    raise exception 'ALREADY_ONBOARDED: usuário já possui uma clínica ativa' using errcode = 'P0409';
  end if;

  v_role := case when p_atua_clinicamente then 'admin' else 'gestor' end;
  v_plano := 'CLINICA';
  insert into public.clinicas (id, nome, plano, status, limite_dentistas, telefone, cidade, estado)
  values (
    v_clinica_id, trim(p_nome_clinica), v_plano, 'ativa', 8,
    nullif(trim(coalesce(p_telefone, '')), ''), nullif(trim(coalesce(p_cidade, '')), ''),
    nullif(trim(coalesce(p_estado, '')), '')
  );
  update public.users set active_clinica_id = v_clinica_id where id = v_usuario_id;
  insert into public.clinica_usuarios (id, usuario_id, clinica_id, role, status)
  values (v_membro_id, v_usuario_id, v_clinica_id, v_role, 'ativo');

  if p_atua_clinicamente then
    v_dentista_id := gen_random_uuid();
    insert into public.dentistas (
      id, clinica_id, user_id, nome, cro, especialidade, telefone, email, role, ativo, foco_principal
    ) values (
      v_dentista_id, v_clinica_id, v_usuario_id, trim(p_nome_usuario), trim(p_cro), p_especialidades,
      nullif(trim(coalesce(p_telefone, '')), ''), v_email, 'admin', true, p_foco_principal
    );
  end if;
  -- A configuração inicial acompanha o modelo escolhido. Em colaborativas,
  -- responsavel_usuario_id identifica o criador técnico; não o torna proprietário.
  insert into public.clinica_governanca (
    clinica_id, responsavel_usuario_id, estado, modelo_clinica, modelo_estoque, estoque_ativo
  ) values (v_clinica_id, v_usuario_id, 'preparacao', p_modelo_clinica, p_modelo_clinica, true);
  -- Nome é dado de apresentação; autorização nunca depende de user_metadata.
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('nome', trim(p_nome_usuario)) where id = v_usuario_id;

  insert into public.configuracoes_comerciais_clinica (clinica_id, modalidade, criado_por_usuario_id)
  values (v_clinica_id, p_modalidade, v_usuario_id);

  if p_modalidade = 'centralizada' then
    insert into public.assinaturas_comerciais (
      clinica_id, modalidade, pagador_usuario_id, dentista_id, status, quantidade_contratada
    ) values (
      v_clinica_id, p_modalidade, v_usuario_id, null, 'aguardando_checkout', null
    ) returning id into v_assinatura_id;
  elsif v_dentista_id is not null then
    insert into public.assinaturas_comerciais (
      clinica_id, modalidade, pagador_usuario_id, dentista_id, status, quantidade_contratada
    ) values (
      v_clinica_id, p_modalidade, v_usuario_id, v_dentista_id, 'aguardando_checkout', 1
    ) returning id into v_assinatura_id;
  end if;

  -- Não há cobertura, Stripe nem liberação neste sublote. O checkout legítimo é
  -- o único fluxo posterior que pode iniciar trial/ativação e inserir cobertura.
  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'clinicaId', v_clinica_id,
      'membroId', v_membro_id,
      'dentistaId', v_dentista_id,
      'assinaturaId', v_assinatura_id,
      'modalidade', p_modalidade,
      'checkoutPendente', true
    )
  );
end;
$$;

notify pgrst, 'reload schema';
