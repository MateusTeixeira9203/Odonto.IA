-- R-159c: promoção mínima de permissões operacionais para a recepção do piloto.
-- Não aplica perfil clínico, orçamento ou ownership por cargo. Aplicar somente depois da
-- revisão dos consumidores Agenda/Pacientes/Financeiro desta entrega.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create or replace function private.membro_tem_permissao_operacional(
  p_clinica_id uuid,
  p_permissao text,
  p_dentista_id uuid default null
) returns boolean language sql stable security definer
set search_path = pg_catalog, public, private
as $$
  select p_clinica_id is not null
    and p_permissao in (
      'agenda.ler', 'agenda.editar', 'agenda.confirmar',
      'pacientes.ler', 'pacientes.editar',
      'financeiro.ler', 'financeiro.exportar', 'cobrancas.ler',
      'recebimentos.registrar', 'recebimentos.corrigir', 'recebimentos.estornar',
      'despesas.ler', 'despesas.gerir',
      'orcamentos.ler', 'contatos.whatsapp'
    )
    and (
      p_dentista_id is null
      or exists (
        select 1
        from public.dentistas d
        where d.id = p_dentista_id
          and d.clinica_id = p_clinica_id
          and d.ativo
          and d.role in ('admin', 'dentista')
      )
    )
    and exists (
      select 1
      from public.users u
      join public.clinica_usuarios cu
        on cu.usuario_id = u.id
       and cu.clinica_id = p_clinica_id
       and cu.status = 'ativo'
      join public.clinica_acessos ca
        on ca.clinica_id = cu.clinica_id
       and ca.membro_id = cu.id
      cross join lateral jsonb_array_elements(ca.acessos) acesso(value)
      where u.id = auth.uid()
        and u.active_clinica_id = p_clinica_id
        and acesso.value ->> 'permissao' = p_permissao
        -- Protético não recebe superfície de paciente nem financeira por grants antigos.
        -- O único recorte operacional permitido é consultar/confirmar a própria agenda.
        and (
          cu.role <> 'protetico'
          or p_permissao in ('agenda.ler', 'agenda.confirmar')
        )
        and (
          (p_dentista_id is null and acesso.value -> 'escopo' ->> 'tipo' = 'clinica')
          or (p_dentista_id is not null and (
            acesso.value -> 'escopo' ->> 'tipo' = 'clinica'
            or (
              acesso.value -> 'escopo' ->> 'tipo' = 'selecionados'
              and acesso.value -> 'escopo' -> 'dentistaIds'
                @> jsonb_build_array(to_jsonb(p_dentista_id::text))
            )
            or (
              acesso.value -> 'escopo' ->> 'tipo' = 'proprio'
              and exists (
                select 1
                from public.dentistas d
                where d.id = p_dentista_id
                  and d.clinica_id = p_clinica_id
                  and d.user_id = auth.uid()
                  and d.ativo
                  and d.role in ('admin', 'dentista')
              )
            )
          ))
        )
    );
$$;

create or replace function public.tem_permissao_operacional(
  p_clinica_id uuid,
  p_permissao text,
  p_dentista_id uuid default null
) returns boolean language sql stable security definer
set search_path = pg_catalog, public, private
as $$
  select private.membro_tem_permissao_operacional(p_clinica_id, p_permissao, p_dentista_id);
$$;

revoke all on function private.membro_tem_permissao_operacional(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.tem_permissao_operacional(uuid, text, uuid) from public, anon;
grant execute on function public.tem_permissao_operacional(uuid, text, uuid) to authenticated;

-- DTO mínimo para o seletor da Agenda. Só retorna profissionais que o membro efetivamente
-- pode consultar; não permite descobrir equipe fora do escopo pelo endpoint de recepção.
create or replace function public.listar_profissionais_agenda_operacional(
  p_clinica_id uuid
) returns table (id uuid, nome text) language sql stable security definer
set search_path = pg_catalog, public, private
as $$
  select d.id, d.nome
  from public.dentistas d
  where d.clinica_id = p_clinica_id
    and d.ativo
    and d.role in ('admin', 'dentista')
    and private.membro_tem_permissao_operacional(p_clinica_id, 'agenda.ler', d.id)
  order by d.created_at, d.id;
$$;

revoke all on function public.listar_profissionais_agenda_operacional(uuid) from public, anon;
grant execute on function public.listar_profissionais_agenda_operacional(uuid) to authenticated;

-- Um membro sem perfil em dentistas não pode herdar fichas, evoluções, documentos ou
-- orçamentos pelas policies clínicas que chamam is_clinic_staff(). Secretárias legadas
-- continuam no ramo observado até sua migração explícita para clinica_acessos.
create or replace function public.is_clinic_staff()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.users u
    join public.dentistas d
      on d.user_id = u.id
     and d.clinica_id = u.active_clinica_id
     and d.ativo
     and d.role in ('admin', 'dentista', 'secretaria')
    where u.id = auth.uid()
  );
$$;

revoke all on function public.is_clinic_staff() from anon, public;
grant execute on function public.is_clinic_staff() to authenticated;

-- Cargo de recepção não substitui identidade clínica em policies históricas.
create or replace function public.is_own_clinical_record(record_dentista_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select record_dentista_id is not null
    and exists (
      select 1 from public.dentistas d
      where d.id = record_dentista_id
        and d.user_id = auth.uid()
        and d.clinica_id = public.get_my_clinica_id()
        and d.ativo
        and d.role in ('admin', 'dentista')
    );
$$;

create or replace function public.is_my_patient(patient_dentista_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select patient_dentista_id is not null
    and exists (
      select 1 from public.dentistas d
      where d.id = patient_dentista_id
        and d.user_id = auth.uid()
        and d.clinica_id = public.get_my_clinica_id()
        and d.ativo
        and d.role in ('admin', 'dentista')
    );
$$;

revoke all on function public.is_own_clinical_record(uuid) from anon, public;
grant execute on function public.is_own_clinical_record(uuid) to authenticated;
revoke all on function public.is_my_patient(uuid) from anon, public;
grant execute on function public.is_my_patient(uuid) to authenticated;

-- Uma pessoa de recepção só lê/edita um paciente se houver relação operacional real com
-- profissional autorizado. pacientes.dentista_id sozinho não decide compartilhamento.
create or replace function private.membro_tem_acesso_paciente_operacional(
  p_clinica_id uuid,
  p_permissao text,
  p_paciente_id uuid
) returns boolean language sql stable security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.agendamentos a
    where a.clinica_id = p_clinica_id and a.paciente_id = p_paciente_id
      and private.membro_tem_permissao_operacional(p_clinica_id, p_permissao, a.dentista_id)
  ) or exists (
    select 1 from public.atendimentos_clinicos ac
    where ac.clinica_id = p_clinica_id and ac.paciente_id = p_paciente_id
      and private.membro_tem_permissao_operacional(p_clinica_id, p_permissao, ac.dentista_id)
  ) or exists (
    select 1 from public.orcamentos o
    where o.clinica_id = p_clinica_id and o.paciente_id = p_paciente_id
      and private.membro_tem_permissao_operacional(p_clinica_id, p_permissao, o.dentista_id)
  );
$$;

revoke all on function private.membro_tem_acesso_paciente_operacional(uuid, text, uuid) from public, anon, authenticated;

-- Grade de horário identifica disponibilidade do profissional. As policies antigas de
-- "todos os membros" deixariam uma recepção sem concessão descobrir toda a operação.
drop policy if exists "horarios_disponiveis_all_policy" on public.horarios_disponiveis;
drop policy if exists "horarios_select_clinic_members" on public.horarios_disponiveis;
drop policy if exists "horarios_access" on public.horarios_disponiveis;

create policy "horarios_operacionais_select" on public.horarios_disponiveis for select to authenticated
  using (
    public.belongs_to_active_clinic(clinica_id)
    and (
      public.is_own_clinical_record(dentista_id)
      or private.membro_tem_permissao_operacional(clinica_id, 'agenda.ler', dentista_id)
    )
  );

-- Entrada de recepção para paciente novo: a linha de paciente nunca fica visível sem uma
-- relação operacional real. Não recebe dados clínicos e não fabrica um perfil dentista para
-- representar quem está logado; created_by permanece nulo porque a autora é secretarias.
create or replace function public.criar_paciente_e_agendamento_operacional(
  p_clinica_id uuid,
  p_dentista_id uuid,
  p_nome text,
  p_telefone text,
  p_data_hora timestamptz,
  p_duracao_minutos integer,
  p_observacoes text default null
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_paciente_id uuid;
  v_agendamento_id uuid;
begin
  if p_nome is null or char_length(btrim(p_nome)) not between 2 and 160 then
    return jsonb_build_object('ok', false, 'code', 'NOME_INVALIDO');
  end if;

  if p_data_hora is null or p_duracao_minutos not between 5 and 480 then
    return jsonb_build_object('ok', false, 'code', 'AGENDA_INVALIDA');
  end if;

  -- Esta RPC é exclusivamente a identidade operacional sem perfil clínico. Secretária
  -- legada com dentistas continua no fluxo histórico, sem ganhar um bypass por esta função.
  if not exists (
    select 1
    from public.users u
    join public.clinica_usuarios cu
      on cu.usuario_id = u.id
     and cu.clinica_id = p_clinica_id
     and cu.status = 'ativo'
     and cu.role = 'secretaria'
    join public.secretarias s
      on s.usuario_id = u.id
     and s.clinica_id = p_clinica_id
    where u.id = auth.uid()
      and u.active_clinica_id = p_clinica_id
      and not exists (
        select 1 from public.dentistas d
        where d.user_id = u.id
          and d.clinica_id = p_clinica_id
          and d.ativo
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'SEM_ACESSO');
  end if;

  if not private.membro_tem_permissao_operacional(p_clinica_id, 'pacientes.editar', p_dentista_id)
     or not private.membro_tem_permissao_operacional(p_clinica_id, 'agenda.editar', p_dentista_id) then
    return jsonb_build_object('ok', false, 'code', 'SEM_ACESSO');
  end if;

  -- Paciente novo não tem agenda anterior; ainda assim nunca pode sobrepor um horário do
  -- profissional ou um bloqueio pessoal. Não há override operacional para a recepção.
  if exists (
    select 1 from public.agendamentos a
    where a.clinica_id = p_clinica_id
      and a.dentista_id = p_dentista_id
      and a.status in ('scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed')
      and tstzrange(a.data_hora, a.data_hora + make_interval(mins => a.duracao_minutos), '[)')
        && tstzrange(p_data_hora, p_data_hora + make_interval(mins => p_duracao_minutos), '[)')
  ) or exists (
    select 1 from public.agenda_bloqueios b
    where b.clinica_id = p_clinica_id
      and b.dentista_id = p_dentista_id
      and tstzrange(b.data_hora, b.data_hora + make_interval(mins => b.duracao_minutos), '[)')
        && tstzrange(p_data_hora, p_data_hora + make_interval(mins => p_duracao_minutos), '[)')
  ) then
    return jsonb_build_object('ok', false, 'code', 'CONFLITO_DENTISTA');
  end if;

  -- Sem grade configurada, mantém o comportamento legado (sem restrição). Existindo uma
  -- grade, a criação precisa caber no turno e fora do almoço no fuso da clínica.
  if exists (
    select 1 from public.horarios_disponiveis h
    where h.clinica_id = p_clinica_id and h.dentista_id = p_dentista_id and h.ativo
  ) and not exists (
    select 1 from public.horarios_disponiveis h
    where h.clinica_id = p_clinica_id
      and h.dentista_id = p_dentista_id
      and h.ativo
      and h.dia_semana = extract(dow from p_data_hora at time zone 'America/Sao_Paulo')::integer
      and (p_data_hora at time zone 'America/Sao_Paulo')::time >= h.hora_inicio
      and ((p_data_hora + make_interval(mins => p_duracao_minutos)) at time zone 'America/Sao_Paulo')::time <= h.hora_fim
      and (
        h.almoco_inicio is null
        or h.almoco_fim is null
        or (p_data_hora at time zone 'America/Sao_Paulo')::time >= h.almoco_fim
        or ((p_data_hora + make_interval(mins => p_duracao_minutos)) at time zone 'America/Sao_Paulo')::time <= h.almoco_inicio
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORA_EXPEDIENTE');
  end if;

  insert into public.pacientes (clinica_id, dentista_id, nome, telefone)
  values (p_clinica_id, p_dentista_id, btrim(p_nome), nullif(btrim(p_telefone), ''))
  returning id into v_paciente_id;

  insert into public.agendamentos (
    clinica_id, dentista_id, paciente_id, data_hora, duracao_minutos,
    observacoes, status, origem, created_by
  ) values (
    p_clinica_id, p_dentista_id, v_paciente_id, p_data_hora, p_duracao_minutos,
    nullif(btrim(p_observacoes), ''), 'scheduled', 'manual', null
  ) returning id into v_agendamento_id;

  return jsonb_build_object(
    'ok', true,
    'pacienteId', v_paciente_id::text,
    'agendamentoId', v_agendamento_id::text
  );
end;
$$;

revoke all on function public.criar_paciente_e_agendamento_operacional(uuid, uuid, text, text, timestamptz, integer, text) from public, anon;
grant execute on function public.criar_paciente_e_agendamento_operacional(uuid, uuid, text, text, timestamptz, integer, text) to authenticated;

-- Mesmo fluxo para paciente já visível dentro do escopo. A recepção não usa ações legadas
-- que pressupõem dentista logado; a relação operacional é conferida antes da inserção.
create or replace function public.criar_agendamento_operacional(
  p_clinica_id uuid,
  p_paciente_id uuid,
  p_dentista_id uuid,
  p_data_hora timestamptz,
  p_duracao_minutos integer,
  p_observacoes text default null
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_agendamento_id uuid;
begin
  if p_data_hora is null or p_duracao_minutos not between 5 and 480 then
    return jsonb_build_object('ok', false, 'code', 'AGENDA_INVALIDA');
  end if;

  if not exists (
    select 1 from public.users u
    join public.clinica_usuarios cu on cu.usuario_id = u.id and cu.clinica_id = p_clinica_id
      and cu.status = 'ativo' and cu.role = 'secretaria'
    join public.secretarias s on s.usuario_id = u.id and s.clinica_id = p_clinica_id
    where u.id = auth.uid() and u.active_clinica_id = p_clinica_id
      and not exists (
        select 1 from public.dentistas d
        where d.user_id = u.id and d.clinica_id = p_clinica_id and d.ativo
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'SEM_ACESSO');
  end if;

  if not private.membro_tem_acesso_paciente_operacional(p_clinica_id, 'pacientes.ler', p_paciente_id)
     or not private.membro_tem_permissao_operacional(p_clinica_id, 'agenda.editar', p_dentista_id) then
    return jsonb_build_object('ok', false, 'code', 'SEM_ACESSO');
  end if;

  if exists (
    select 1 from public.agendamentos a
    where a.clinica_id = p_clinica_id and a.dentista_id = p_dentista_id
      and a.status in ('scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed')
      and tstzrange(a.data_hora, a.data_hora + make_interval(mins => a.duracao_minutos), '[)')
        && tstzrange(p_data_hora, p_data_hora + make_interval(mins => p_duracao_minutos), '[)')
  ) or exists (
    select 1 from public.agenda_bloqueios b
    where b.clinica_id = p_clinica_id and b.dentista_id = p_dentista_id
      and tstzrange(b.data_hora, b.data_hora + make_interval(mins => b.duracao_minutos), '[)')
        && tstzrange(p_data_hora, p_data_hora + make_interval(mins => p_duracao_minutos), '[)')
  ) then
    return jsonb_build_object('ok', false, 'code', 'CONFLITO_DENTISTA');
  end if;

  if exists (
    select 1 from public.horarios_disponiveis h
    where h.clinica_id = p_clinica_id and h.dentista_id = p_dentista_id and h.ativo
  ) and not exists (
    select 1 from public.horarios_disponiveis h
    where h.clinica_id = p_clinica_id and h.dentista_id = p_dentista_id and h.ativo
      and h.dia_semana = extract(dow from p_data_hora at time zone 'America/Sao_Paulo')::integer
      and (p_data_hora at time zone 'America/Sao_Paulo')::time >= h.hora_inicio
      and ((p_data_hora + make_interval(mins => p_duracao_minutos)) at time zone 'America/Sao_Paulo')::time <= h.hora_fim
      and (h.almoco_inicio is null or h.almoco_fim is null
        or (p_data_hora at time zone 'America/Sao_Paulo')::time >= h.almoco_fim
        or ((p_data_hora + make_interval(mins => p_duracao_minutos)) at time zone 'America/Sao_Paulo')::time <= h.almoco_inicio)
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORA_EXPEDIENTE');
  end if;

  insert into public.agendamentos (
    clinica_id, dentista_id, paciente_id, data_hora, duracao_minutos,
    observacoes, status, origem, created_by
  ) values (
    p_clinica_id, p_dentista_id, p_paciente_id, p_data_hora, p_duracao_minutos,
    nullif(btrim(p_observacoes), ''), 'scheduled', 'manual', null
  ) returning id into v_agendamento_id;

  return jsonb_build_object('ok', true, 'agendamentoId', v_agendamento_id::text);
end;
$$;

revoke all on function public.criar_agendamento_operacional(uuid, uuid, uuid, timestamptz, integer, text) from public, anon;
grant execute on function public.criar_agendamento_operacional(uuid, uuid, uuid, timestamptz, integer, text) to authenticated;

create or replace function public.atualizar_status_agendamento_operacional(
  p_clinica_id uuid, p_agendamento_id uuid, p_status text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare v_dentista_id uuid; v_permissao text;
begin
  if p_status not in ('confirmed', 'cancelled') then return jsonb_build_object('ok',false,'code','STATUS_INVALIDO'); end if;
  select a.dentista_id into v_dentista_id from public.agendamentos a
    where a.id=p_agendamento_id and a.clinica_id=p_clinica_id;
  if v_dentista_id is null then return jsonb_build_object('ok',false,'code','NAO_ENCONTRADO'); end if;
  v_permissao := case when p_status='confirmed' then 'agenda.confirmar' else 'agenda.editar' end;
  if not private.membro_tem_permissao_operacional(p_clinica_id,v_permissao,v_dentista_id) then
    return jsonb_build_object('ok',false,'code','SEM_ACESSO');
  end if;
  update public.agendamentos set status=p_status,updated_at=now()
    where id=p_agendamento_id and clinica_id=p_clinica_id;
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.reagendar_agendamento_operacional(
  p_clinica_id uuid, p_agendamento_id uuid, p_data_hora timestamptz,
  p_duracao_minutos integer, p_observacoes text default null
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare v_dentista_id uuid;
begin
  if p_data_hora is null or p_duracao_minutos not between 5 and 480 then return jsonb_build_object('ok',false,'code','AGENDA_INVALIDA'); end if;
  select a.dentista_id into v_dentista_id from public.agendamentos a
    where a.id=p_agendamento_id and a.clinica_id=p_clinica_id for update;
  if v_dentista_id is null then return jsonb_build_object('ok',false,'code','NAO_ENCONTRADO'); end if;
  if not private.membro_tem_permissao_operacional(p_clinica_id,'agenda.editar',v_dentista_id) then return jsonb_build_object('ok',false,'code','SEM_ACESSO'); end if;
  if exists (select 1 from public.agendamentos a where a.clinica_id=p_clinica_id and a.dentista_id=v_dentista_id and a.id<>p_agendamento_id and a.status in ('scheduled','confirmed','checked_in','in_progress','completed') and tstzrange(a.data_hora,a.data_hora+make_interval(mins=>a.duracao_minutos),'[)') && tstzrange(p_data_hora,p_data_hora+make_interval(mins=>p_duracao_minutos),'[)'))
    or exists (select 1 from public.agenda_bloqueios b where b.clinica_id=p_clinica_id and b.dentista_id=v_dentista_id and tstzrange(b.data_hora,b.data_hora+make_interval(mins=>b.duracao_minutos),'[)') && tstzrange(p_data_hora,p_data_hora+make_interval(mins=>p_duracao_minutos),'[)')) then return jsonb_build_object('ok',false,'code','CONFLITO_DENTISTA'); end if;
  update public.agendamentos set data_hora=p_data_hora,duracao_minutos=p_duracao_minutos,observacoes=nullif(btrim(p_observacoes),''),updated_at=now() where id=p_agendamento_id and clinica_id=p_clinica_id;
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.atualizar_status_agendamento_operacional(uuid,uuid,text) from public,anon;
revoke all on function public.reagendar_agendamento_operacional(uuid,uuid,timestamptz,integer,text) from public,anon;
grant execute on function public.atualizar_status_agendamento_operacional(uuid,uuid,text) to authenticated;
grant execute on function public.reagendar_agendamento_operacional(uuid,uuid,timestamptz,integer,text) to authenticated;

drop policy if exists "agendamentos_all_policy" on public.agendamentos;
drop policy if exists "agendamentos_secretaria_policy" on public.agendamentos;
drop policy if exists "agendamentos_dentista_policy" on public.agendamentos;
drop policy if exists "agendamentos_all_clinic_members" on public.agendamentos;
drop policy if exists "agendamentos_access" on public.agendamentos;

create policy "agendamentos_operacionais_select" on public.agendamentos for select to authenticated
  using (
    public.belongs_to_active_clinic(clinica_id)
    and (
      public.is_own_clinical_record(dentista_id)
      or private.membro_tem_permissao_operacional(clinica_id, 'agenda.ler', dentista_id)
    )
  );

create policy "agendamentos_operacionais_write" on public.agendamentos for all to authenticated
  using (
    public.belongs_to_active_clinic(clinica_id)
    and (
      public.is_own_clinical_record(dentista_id)
      or private.membro_tem_permissao_operacional(clinica_id, 'agenda.editar', dentista_id)
    )
  )
  with check (
    public.belongs_to_active_clinic(clinica_id)
    and (
      public.is_own_clinical_record(dentista_id)
      or private.membro_tem_permissao_operacional(clinica_id, 'agenda.editar', dentista_id)
    )
  );

drop policy if exists "pacientes_all_policy" on public.pacientes;
drop policy if exists "pacientes_strict_policy" on public.pacientes;
drop policy if exists "pacientes_all_clinic_members" on public.pacientes;
drop policy if exists "pacientes_access" on public.pacientes;

create policy "pacientes_operacionais_select" on public.pacientes for select to authenticated
  using (
    public.belongs_to_active_clinic(clinica_id)
    and (
      public.is_my_patient(dentista_id)
      or private.membro_tem_acesso_paciente_operacional(clinica_id, 'pacientes.ler', id)
    )
  );

create policy "pacientes_operacionais_write" on public.pacientes for all to authenticated
  using (
    public.belongs_to_active_clinic(clinica_id)
    and (
      public.is_my_patient(dentista_id)
      or private.membro_tem_acesso_paciente_operacional(clinica_id, 'pacientes.editar', id)
    )
  )
  with check (
    public.belongs_to_active_clinic(clinica_id)
    and (
      public.is_my_patient(dentista_id)
      or private.membro_tem_acesso_paciente_operacional(clinica_id, 'pacientes.editar', id)
    )
  );
