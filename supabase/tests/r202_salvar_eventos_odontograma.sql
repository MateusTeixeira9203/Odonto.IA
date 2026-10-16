-- R-202 — gate de banco em schema completo local, com fixtures exclusivamente sintéticas.
-- Pré-requisitos do executor: schema-only equivalente já restaurado, auth.uid() local
-- configurada pela sessão e a migration R-202 aplicada. Executar como superuser local.
\set ON_ERROR_STOP on
\pset pager off

create temporary table r202_resultados (
  criterio text primary key,
  status text not null,
  detalhes jsonb not null
) on commit preserve rows;

create or replace function pg_temp.r202_uuid(n integer) returns uuid
language sql immutable as $$
  select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;

do $$
declare
  v_clinica_a uuid := pg_temp.r202_uuid(1);
  v_clinica_b uuid := pg_temp.r202_uuid(2);
  v_usuario_a uuid := pg_temp.r202_uuid(10);
  v_usuario_b uuid := pg_temp.r202_uuid(11);
  v_dentista_a uuid := pg_temp.r202_uuid(20);
  v_dentista_b uuid := pg_temp.r202_uuid(21);
  v_paciente_a uuid := pg_temp.r202_uuid(30);
  v_paciente_b uuid := pg_temp.r202_uuid(31);
  v_ficha_a uuid := pg_temp.r202_uuid(40);
  v_ficha_b uuid := pg_temp.r202_uuid(41);
  v_ficha_assinada uuid := pg_temp.r202_uuid(42);
  v_ficha_contexto uuid := pg_temp.r202_uuid(43);
begin
  -- As contas abaixo são sintéticas e existem somente neste cluster descartável.
  perform set_config('session_replication_role', 'replica', true);
  insert into auth.users (id, aud, role, email) values
    (v_usuario_a, 'authenticated', 'authenticated', 'r202-a@example.test'),
    (v_usuario_b, 'authenticated', 'authenticated', 'r202-b@example.test');
  perform set_config('session_replication_role', 'origin', true);

  insert into public.clinicas (id, nome) values
    (v_clinica_a, 'R202 Clínica A'),
    (v_clinica_b, 'R202 Clínica B');
  insert into public.users (id, email, active_clinica_id) values
    (v_usuario_a, 'r202-a@example.test', v_clinica_a),
    (v_usuario_b, 'r202-b@example.test', v_clinica_b);
  insert into public.clinica_usuarios (usuario_id, clinica_id, role, status) values
    (v_usuario_a, v_clinica_a, 'dentista', 'ativo'),
    (v_usuario_b, v_clinica_b, 'dentista', 'ativo');
  insert into public.dentistas (id, clinica_id, user_id, nome, role, ativo) values
    (v_dentista_a, v_clinica_a, v_usuario_a, 'Dentista R202 A', 'dentista', true),
    (v_dentista_b, v_clinica_b, v_usuario_b, 'Dentista R202 B', 'dentista', true);
  insert into public.pacientes (id, clinica_id, nome, nome_busca, dentista_id) values
    (v_paciente_a, v_clinica_a, 'Paciente R202 A', 'paciente r202 a', v_dentista_a),
    (v_paciente_b, v_clinica_a, 'Paciente R202 B', 'paciente r202 b', v_dentista_a);
  insert into public.fichas (id, clinica_id, paciente_id, dentista_id, anotacoes, origem, data_atendimento) values
    (v_ficha_a, v_clinica_a, v_paciente_a, v_dentista_a, 'volume sintético', 'manual', current_date),
    (v_ficha_b, v_clinica_a, v_paciente_a, v_dentista_a, 'retry sintético', 'manual', current_date),
    (v_ficha_assinada, v_clinica_a, v_paciente_a, v_dentista_a, 'assinada sintética', 'manual', current_date),
    (v_ficha_contexto, v_clinica_a, v_paciente_b, v_dentista_a, 'outro contexto', 'manual', current_date);
  update public.fichas set assinado_em = now() where id = v_ficha_assinada;

  -- Volume suficiente para verificar que o guard consulta os IDs do payload, mantendo
  -- constraints, RLS e helpers reais do dump schema-only.
  insert into public.odontograma_eventos (
    id, clinica_id, paciente_id, dentista_id, ficha_id, tipo, status, origem, nivel,
    arcada, quadrante, dente, faces, observacao, procedimento_nome
  )
  select
    ('70000000-0000-4000-8000-' || lpad(gs::text, 12, '0'))::uuid,
    v_clinica_a, v_paciente_a, v_dentista_a, v_ficha_a,
    'outro', 'indicado', 'clinica', 'dente', 'inferior', 3, 35, '{}',
    'volume sintético R202', format('Volume R202 %s', gs)
  from generate_series(1, 12000) as gs;

  insert into public.odontograma_eventos (
    id, clinica_id, paciente_id, dentista_id, ficha_id, tipo, status, origem, nivel,
    arcada, quadrante, dente, faces, observacao, procedimento_nome
  ) values
    (pg_temp.r202_uuid(100), v_clinica_a, v_paciente_a, v_dentista_a, v_ficha_b,
      'outro', 'indicado', 'clinica', 'dente', 'inferior', 3, 35, '{}', 'manter', 'Manter'),
    (pg_temp.r202_uuid(101), v_clinica_a, v_paciente_a, v_dentista_a, v_ficha_b,
      'outro', 'indicado', 'clinica', 'dente', 'inferior', 3, 36, '{}', 'remover via sync', 'Remover'),
    (pg_temp.r202_uuid(102), v_clinica_a, v_paciente_a, v_dentista_a, v_ficha_b,
      'outro', 'indicado', 'clinica', 'dente', 'inferior', 3, 37, '{}', 'retirado', 'Retirado'),
    (pg_temp.r202_uuid(103), v_clinica_a, v_paciente_b, v_dentista_a, v_ficha_contexto,
      'outro', 'indicado', 'clinica', 'dente', 'inferior', 3, 38, '{}', 'outro contexto', 'Outro contexto');
  update public.odontograma_eventos set retirado_em = now(), retirado_por = v_dentista_a
  where id = pg_temp.r202_uuid(102);
end;
$$;

-- O volume foi inserido neste banco agora. Atualiza apenas estatísticas locais antes
-- de medir, para que o ensaio represente uma tabela analisada, não um plano frio.
analyze public.odontograma_eventos;
analyze public.fichas;
analyze public.procedimentos;
analyze public.dentistas;
analyze public.clinica_usuarios;
analyze public.users;

-- AC01: chamada integral como authenticated e plano do trecho interno exato da função.
do $$
declare
  v_inicio timestamptz := clock_timestamp();
  v_duracao interval;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', pg_temp.r202_uuid(10)::text, true);
  perform public.salvar_eventos_odontograma(
    pg_temp.r202_uuid(40), pg_temp.r202_uuid(1), pg_temp.r202_uuid(30),
    jsonb_build_array(jsonb_build_object(
      'id', pg_temp.r202_uuid(200), 'clinica_id', pg_temp.r202_uuid(1),
      'paciente_id', pg_temp.r202_uuid(30), 'dentista_id', pg_temp.r202_uuid(20),
      'ficha_id', pg_temp.r202_uuid(40), 'tipo', 'outro', 'status', 'indicado',
      'origem', 'clinica', 'nivel', 'dente', 'arcada', 'inferior', 'quadrante', 3,
      'dente', 35, 'faces', jsonb_build_array(), 'observacao', 'rpc completa',
      'procedimento_nome', 'RPC completa', 'momento_planejado', 'sessao_atual'
    )), false
  );
  v_duracao := clock_timestamp() - v_inicio;
  if v_duracao >= interval '8 seconds' then
    raise exception 'r202_ac01_duracao_acima_do_limite:%', v_duracao;
  end if;
  reset role;
  insert into r202_resultados values ('AC01', 'PASSA', jsonb_build_object(
    'rpc_ms', round(extract(epoch from v_duracao) * 1000, 3),
    'volume_eventos', 12004,
    'caller', 'authenticated com claim sintético'
  ));
end;
$$;

-- AC03/AC07: retry com os mesmos IDs não cria outro evento e conserva a ficha existente.
do $$
declare
  v_payload jsonb;
  v_antes uuid;
  v_depois uuid;
  v_total integer;
begin
  v_antes := pg_temp.r202_uuid(41);
  v_payload := jsonb_build_array(jsonb_build_object(
    'id', pg_temp.r202_uuid(201), 'clinica_id', pg_temp.r202_uuid(1),
    'paciente_id', pg_temp.r202_uuid(30), 'dentista_id', pg_temp.r202_uuid(20),
    'ficha_id', v_antes, 'tipo', 'outro', 'status', 'realizado', 'origem', 'clinica',
    'nivel', 'dente', 'arcada', 'inferior', 'quadrante', 3, 'dente', 36,
    'faces', jsonb_build_array(), 'observacao', 'retry idempotente',
    'procedimento_nome', 'Retry R202', 'realizado_em', current_date::text,
    'momento_planejado', 'sessao_atual'
  ));
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', pg_temp.r202_uuid(10)::text, true);
  perform public.salvar_eventos_odontograma(v_antes, pg_temp.r202_uuid(1), pg_temp.r202_uuid(30), v_payload, false);
  perform public.salvar_eventos_odontograma(v_antes, pg_temp.r202_uuid(1), pg_temp.r202_uuid(30), v_payload, false);
  reset role;
  select ficha_id into v_depois from public.odontograma_eventos where id = pg_temp.r202_uuid(201);
  select count(*) into v_total from public.odontograma_eventos where id = pg_temp.r202_uuid(201);
  if v_depois is distinct from v_antes or v_total <> 1 then
    raise exception 'r202_retry_duplicou_ou_trocou_ficha';
  end if;
  if (select count(*) from public.fichas where id = v_antes) <> 1 then
    raise exception 'r202_retry_criou_ou_removeu_ficha';
  end if;
  insert into r202_resultados values ('AC03', 'PASSA', jsonb_build_object('ficha_id', v_antes, 'evento_id', pg_temp.r202_uuid(201), 'eventos_com_mesmo_id', v_total));
  insert into r202_resultados values ('AC07', 'PASSA', jsonb_build_object('repeticoes', 2, 'fichas', 1, 'eventos', v_total));
end;
$$;

-- AC04: update e sync preservam retirado, removem somente o ativo ausente e não alteram vínculo.
do $$
declare
  v_payload jsonb := jsonb_build_array(jsonb_build_object(
    'id', pg_temp.r202_uuid(100), 'clinica_id', pg_temp.r202_uuid(1),
    'paciente_id', pg_temp.r202_uuid(30), 'dentista_id', pg_temp.r202_uuid(20),
    'ficha_id', pg_temp.r202_uuid(41), 'tipo', 'outro', 'status', 'indicado',
    'origem', 'clinica', 'nivel', 'dente', 'arcada', 'inferior', 'quadrante', 3,
    'dente', 35, 'faces', jsonb_build_array(), 'observacao', 'mudança solicitada',
    'procedimento_nome', 'Manter atualizado', 'encaminhado_para', null,
    'momento_planejado', 'sessao_atual'
  ));
  v_null_inicio timestamptz;
  v_null_duracao interval;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', pg_temp.r202_uuid(10)::text, true);
  v_null_inicio := clock_timestamp();
  perform public.salvar_eventos_odontograma(pg_temp.r202_uuid(41), pg_temp.r202_uuid(1), pg_temp.r202_uuid(30), v_payload, true);
  v_null_duracao := clock_timestamp() - v_null_inicio;
  if v_null_duracao >= interval '8 seconds' then
    raise exception 'r202_encaminhamento_null_timeout:%', v_null_duracao;
  end if;
  if not exists (select 1 from public.odontograma_eventos where id = pg_temp.r202_uuid(100) and observacao = 'mudança solicitada' and ficha_id = pg_temp.r202_uuid(41) and encaminhado_para is null) then
    raise exception 'r202_sync_nao_atualizou_evento';
  end if;
  if exists (select 1 from public.odontograma_eventos where id = pg_temp.r202_uuid(101)) then
    raise exception 'r202_sync_nao_removeu_evento_ausente';
  end if;
  if not exists (select 1 from public.odontograma_eventos where id = pg_temp.r202_uuid(102) and retirado_em is not null) then
    raise exception 'r202_sync_removeu_evento_retirado';
  end if;
  reset role;
  insert into r202_resultados values ('AC04', 'PASSA', jsonb_build_object('atualizado', pg_temp.r202_uuid(100), 'removido_por_sync', pg_temp.r202_uuid(101), 'retirado_preservado', pg_temp.r202_uuid(102), 'encaminhamento_null', true, 'encaminhamento_null_ms', round(extract(epoch from v_null_duracao) * 1000, 3)));
end;
$$;

-- AC05: assinatura, retirada e contexto incompatível devem falhar sem efeito parcial.
do $$
declare
  v_antes integer;
  v_payload_assinado jsonb := jsonb_build_array(jsonb_build_object(
    'id', pg_temp.r202_uuid(300), 'clinica_id', pg_temp.r202_uuid(1), 'paciente_id', pg_temp.r202_uuid(30),
    'dentista_id', pg_temp.r202_uuid(20), 'ficha_id', pg_temp.r202_uuid(42), 'tipo', 'outro', 'status', 'indicado',
    'origem', 'clinica', 'nivel', 'dente', 'arcada', 'inferior', 'quadrante', 3, 'dente', 35,
    'faces', jsonb_build_array(), 'observacao', 'proibido', 'procedimento_nome', 'Proibido'
  ));
  v_payload_retirado jsonb := jsonb_build_array(jsonb_build_object(
    'id', pg_temp.r202_uuid(102), 'clinica_id', pg_temp.r202_uuid(1), 'paciente_id', pg_temp.r202_uuid(30),
    'dentista_id', pg_temp.r202_uuid(20), 'ficha_id', pg_temp.r202_uuid(41), 'tipo', 'outro', 'status', 'indicado',
    'origem', 'clinica', 'nivel', 'dente', 'arcada', 'inferior', 'quadrante', 3, 'dente', 37,
    'faces', jsonb_build_array(), 'observacao', 'retirado', 'procedimento_nome', 'Retirado'
  ));
  v_payload_misto jsonb := jsonb_build_array(
    jsonb_build_object('id', pg_temp.r202_uuid(202), 'clinica_id', pg_temp.r202_uuid(1), 'paciente_id', pg_temp.r202_uuid(30), 'dentista_id', pg_temp.r202_uuid(20), 'ficha_id', pg_temp.r202_uuid(41), 'tipo', 'outro', 'status', 'indicado', 'origem', 'clinica', 'nivel', 'dente', 'arcada', 'inferior', 'quadrante', 3, 'dente', 35, 'faces', jsonb_build_array(), 'observacao', 'não deve gravar', 'procedimento_nome', 'Misto'),
    jsonb_build_object('id', pg_temp.r202_uuid(103), 'clinica_id', pg_temp.r202_uuid(1), 'paciente_id', pg_temp.r202_uuid(30), 'dentista_id', pg_temp.r202_uuid(20), 'ficha_id', pg_temp.r202_uuid(41), 'tipo', 'outro', 'status', 'indicado', 'origem', 'clinica', 'nivel', 'dente', 'arcada', 'inferior', 'quadrante', 3, 'dente', 35, 'faces', jsonb_build_array(), 'observacao', 'contexto inválido', 'procedimento_nome', 'Misto')
  );
begin
  select count(*) into v_antes from public.odontograma_eventos where ficha_id = pg_temp.r202_uuid(41);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', pg_temp.r202_uuid(10)::text, true);
  begin perform public.salvar_eventos_odontograma(pg_temp.r202_uuid(42), pg_temp.r202_uuid(1), pg_temp.r202_uuid(30), v_payload_assinado, false); raise exception 'r202_assinada_aceita'; exception when others then if sqlerrm not like '%ficha_assinada%' then raise; end if; end;
  begin perform public.salvar_eventos_odontograma(pg_temp.r202_uuid(41), pg_temp.r202_uuid(1), pg_temp.r202_uuid(30), v_payload_retirado, false); raise exception 'r202_retirado_aceito'; exception when others then if sqlerrm not like '%evento_contexto_invalido%' then raise; end if; end;
  begin perform public.salvar_eventos_odontograma(pg_temp.r202_uuid(41), pg_temp.r202_uuid(1), pg_temp.r202_uuid(30), v_payload_misto, false); raise exception 'r202_misto_aceito'; exception when others then if sqlerrm not like '%evento_contexto_invalido%' then raise; end if; end;
  reset role;
  if (select count(*) from public.odontograma_eventos where ficha_id = pg_temp.r202_uuid(41)) <> v_antes
     or exists (select 1 from public.odontograma_eventos where id = pg_temp.r202_uuid(202)) then
    raise exception 'r202_rejeicao_teve_efeito_parcial';
  end if;
  insert into r202_resultados values ('AC05', 'PASSA', jsonb_build_object('ficha_assinada', 'rejeitada', 'evento_retirado', 'rejeitado', 'lote_misto', 'atômico'));
end;
$$;

-- AC06: segunda identidade de clínica distinta não acessa nem altera a Ficha da clínica A.
do $$
declare
  v_antes integer;
begin
  select count(*) into v_antes from public.odontograma_eventos where ficha_id = pg_temp.r202_uuid(41);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', pg_temp.r202_uuid(11)::text, true);
  begin
    perform public.salvar_eventos_odontograma(pg_temp.r202_uuid(41), pg_temp.r202_uuid(1), pg_temp.r202_uuid(30), '[]'::jsonb, false);
    raise exception 'r202_outra_clinica_aceita';
  exception when others then
    if sqlerrm not like '%ficha_nao_encontrada%' then raise; end if;
  end;
  reset role;
  if (select count(*) from public.odontograma_eventos where ficha_id = pg_temp.r202_uuid(41)) <> v_antes then
    raise exception 'r202_outra_clinica_alterou';
  end if;
  insert into r202_resultados values ('AC06-authenticated', 'PASSA', jsonb_build_object('conta_a', pg_temp.r202_uuid(10), 'conta_b', pg_temp.r202_uuid(11), 'efeito_cruzado', false));
end;
$$;

select criterio, status, detalhes from r202_resultados order by criterio;
