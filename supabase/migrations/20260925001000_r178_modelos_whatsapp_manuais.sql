-- R-178: os cinco modelos operacionais manuais. Não integra API nem dispara mensagens.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

alter table public.whatsapp_modelos_operacionais
  drop constraint if exists whatsapp_modelos_operacionais_tipo_check;
alter table public.whatsapp_modelos_operacionais
  add constraint whatsapp_modelos_operacionais_tipo_check
  check (tipo in ('confirmacao', 'lembrete_24h', 'reativacao', 'cobranca', 'orcamento'));

create or replace function public.obter_modelos_whatsapp_operacionais(p_clinica_id_esperada uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ator_id uuid := auth.uid(); v_clinica_id uuid;
begin
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_ator_id;
  if v_ator_id is null or v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada
    or not private.r175_pode_ler_operacao(v_clinica_id, v_ator_id) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso aos modelos da clínica.');
  end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'confirmacao', coalesce((select corpo from public.whatsapp_modelos_operacionais where clinica_id = v_clinica_id and tipo = 'confirmacao'), 'Olá, {{nome_paciente}}. Confirmamos seu atendimento na {{nome_clinica}}. Qualquer imprevisto, conte com a gente.'),
    'lembrete_24h', coalesce((select corpo from public.whatsapp_modelos_operacionais where clinica_id = v_clinica_id and tipo = 'lembrete_24h'), 'Olá, {{nome_paciente}}. Passando para lembrar do seu atendimento amanhã na {{nome_clinica}}.'),
    'reativacao', coalesce((select corpo from public.whatsapp_modelos_operacionais where clinica_id = v_clinica_id and tipo = 'reativacao'), 'Olá, {{nome_paciente}}. Tudo bem? A {{nome_clinica}} está à disposição para organizar seu retorno.'),
    'cobranca', coalesce((select corpo from public.whatsapp_modelos_operacionais where clinica_id = v_clinica_id and tipo = 'cobranca'), 'Olá, {{nome_paciente}}. Identificamos uma pendência e estamos à disposição para ajudar pelo atendimento da {{nome_clinica}}.'),
    'orcamento', coalesce((select corpo from public.whatsapp_modelos_operacionais where clinica_id = v_clinica_id and tipo = 'orcamento'), 'Olá, {{nome_paciente}}. Podemos ajudar com qualquer dúvida sobre seu planejamento na {{nome_clinica}}?')
  ));
end; $$;

create or replace function public.salvar_modelos_whatsapp_operacionais(p_clinica_id_esperada uuid, p_modelos jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ator_id uuid := auth.uid(); v_clinica_id uuid;
begin
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_ator_id;
  if v_ator_id is null or v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada
    or not private.r174_pode_gerir_financeiro_clinica(v_clinica_id, v_ator_id) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Apenas proprietário ou gestor edita modelos.');
  end if;
  if jsonb_typeof(p_modelos) <> 'object'
    or not (p_modelos ?& array['confirmacao', 'lembrete_24h', 'reativacao', 'cobranca', 'orcamento'])
    or (select count(*) from jsonb_object_keys(p_modelos)) <> 5
    or exists (select 1 from jsonb_each_text(p_modelos) m(tipo, corpo) where m.tipo not in ('confirmacao', 'lembrete_24h', 'reativacao', 'cobranca', 'orcamento') or char_length(btrim(m.corpo)) not between 10 and 1000) then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Revise o texto do modelo.');
  end if;
  insert into public.whatsapp_modelos_operacionais (clinica_id, tipo, corpo, atualizado_por_usuario_id)
  select v_clinica_id, m.tipo, btrim(m.corpo), v_ator_id from jsonb_each_text(p_modelos) m(tipo, corpo)
  on conflict (clinica_id, tipo) do update set corpo = excluded.corpo, atualizado_por_usuario_id = excluded.atualizado_por_usuario_id, updated_at = now();
  return jsonb_build_object('ok', true);
end; $$;

revoke all on function public.obter_modelos_whatsapp_operacionais(uuid) from public, anon, authenticated, service_role;
revoke all on function public.salvar_modelos_whatsapp_operacionais(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.obter_modelos_whatsapp_operacionais(uuid) to authenticated;
grant execute on function public.salvar_modelos_whatsapp_operacionais(uuid, jsonb) to authenticated;
