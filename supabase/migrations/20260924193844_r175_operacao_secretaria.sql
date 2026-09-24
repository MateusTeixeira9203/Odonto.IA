-- R-175: filas operacionais da secretária e modelos locais de WhatsApp.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create table public.whatsapp_modelos_operacionais (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tipo text not null check (tipo in ('reativacao', 'cobranca', 'orcamento')),
  corpo text not null check (char_length(btrim(corpo)) between 10 and 1000),
  atualizado_por_usuario_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, tipo)
);

alter table public.whatsapp_modelos_operacionais enable row level security;
revoke all on table public.whatsapp_modelos_operacionais from public, anon, authenticated;

create or replace function private.r175_pode_ler_operacao(
  p_clinica_id uuid,
  p_ator_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clinica_usuarios cu
    where cu.clinica_id = p_clinica_id and cu.usuario_id = p_ator_id
      and cu.status = 'ativo' and cu.role in ('secretaria', 'admin', 'gestor')
  ) or private.r174_pode_gerir_financeiro_clinica(p_clinica_id, p_ator_id);
$$;

create or replace function public.obter_modelos_whatsapp_operacionais(
  p_clinica_id_esperada uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
begin
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_ator_id;
  if v_ator_id is null or v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada
    or not private.r175_pode_ler_operacao(v_clinica_id, v_ator_id) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso aos modelos da clínica.');
  end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'reativacao', coalesce((select m.corpo from public.whatsapp_modelos_operacionais m where m.clinica_id = v_clinica_id and m.tipo = 'reativacao'), 'Olá, {{nome_paciente}}. Tudo bem? A {{nome_clinica}} está à disposição para organizar seu retorno.'),
    'cobranca', coalesce((select m.corpo from public.whatsapp_modelos_operacionais m where m.clinica_id = v_clinica_id and m.tipo = 'cobranca'), 'Olá, {{nome_paciente}}. Identificamos uma pendência e estamos à disposição para ajudar pelo atendimento da {{nome_clinica}}.'),
    'orcamento', coalesce((select m.corpo from public.whatsapp_modelos_operacionais m where m.clinica_id = v_clinica_id and m.tipo = 'orcamento'), 'Olá, {{nome_paciente}}. Podemos ajudar com qualquer dúvida sobre seu planejamento na {{nome_clinica}}?')
  ));
end;
$$;

create or replace function public.salvar_modelos_whatsapp_operacionais(
  p_clinica_id_esperada uuid,
  p_modelos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
begin
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_ator_id;
  if v_ator_id is null or v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada
    or not private.r174_pode_gerir_financeiro_clinica(v_clinica_id, v_ator_id) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Apenas proprietário ou gestor edita modelos.');
  end if;
  if jsonb_typeof(p_modelos) <> 'object'
    or not (p_modelos ?& array['reativacao', 'cobranca', 'orcamento'])
    or (select count(*) from jsonb_object_keys(p_modelos)) <> 3
    or exists (
      select 1
      from jsonb_each_text(p_modelos) as modelo(tipo, corpo)
      where modelo.tipo not in ('reativacao', 'cobranca', 'orcamento')
        or char_length(btrim(modelo.corpo)) not between 10 and 1000
    ) then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Revise o texto do modelo.');
  end if;
  insert into public.whatsapp_modelos_operacionais (clinica_id, tipo, corpo, atualizado_por_usuario_id)
  select v_clinica_id, modelo.tipo, btrim(modelo.corpo), v_ator_id
  from jsonb_each_text(p_modelos) as modelo(tipo, corpo)
  on conflict (clinica_id, tipo) do update
    set corpo = excluded.corpo, atualizado_por_usuario_id = excluded.atualizado_por_usuario_id, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function private.r175_pode_ler_operacao(uuid, uuid) from public;
revoke all on function public.obter_modelos_whatsapp_operacionais(uuid) from public, anon, authenticated, service_role;
revoke all on function public.salvar_modelos_whatsapp_operacionais(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.obter_modelos_whatsapp_operacionais(uuid) to authenticated;
grant execute on function public.salvar_modelos_whatsapp_operacionais(uuid, jsonb) to authenticated;
