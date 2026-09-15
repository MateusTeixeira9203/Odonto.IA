-- R-157: guarda prospectiva. Executar após a migration R157 guard; as fixtures
-- sintéticas são criadas com triggers/FKs temporariamente em replica e o arquivo
-- sempre termina em ROLLBACK. Não usa nem lê dados de pacientes.
\set ON_ERROR_STOP on
begin;

set local session_replication_role = replica;

do $$
declare
  v_clinica uuid := gen_random_uuid();
  v_paciente uuid := gen_random_uuid();
  v_dentista uuid := gen_random_uuid();
  v_ficha uuid := gen_random_uuid();
  v_grupo uuid := gen_random_uuid();
  v_global uuid := gen_random_uuid();
  v_historico uuid := gen_random_uuid();
  v_retirado uuid := gen_random_uuid();
  v_cobranca uuid := gen_random_uuid();
begin
  perform set_config('r157.guard.clinica', v_clinica::text, true);
  perform set_config('r157.guard.paciente', v_paciente::text, true);
  perform set_config('r157.guard.dentista', v_dentista::text, true);
  perform set_config('r157.guard.ficha', v_ficha::text, true);
  perform set_config('r157.guard.grupo', v_grupo::text, true);
  perform set_config('r157.guard.global', v_global::text, true);
  perform set_config('r157.guard.historico', v_historico::text, true);
  perform set_config('r157.guard.retirado', v_retirado::text, true);
  perform set_config('r157.guard.cobranca', v_cobranca::text, true);

  insert into public.orcamentos (
    id, clinica_id, paciente_id, dentista_id, ficha_id, total, valor_acordado, desconto, plano_forma
  )
  values
    (v_grupo, v_clinica, v_paciente, v_dentista, v_ficha, 100, null, 0, null),
    (v_global, v_clinica, v_paciente, v_dentista, v_ficha, 100, 100, 0, 'avista'),
    (v_historico, v_clinica, v_paciente, v_dentista, v_ficha, 100, 100, 5, 'avista'),
    (v_retirado, v_clinica, v_paciente, v_dentista, v_ficha, 100, null, 0, null);

  insert into public.orcamento_itens (
    clinica_id, orcamento_id, descricao, quantidade, preco_unitario, preco_total, composicao, retirado_em
  ) values
    (v_clinica, v_grupo, '__R157_GRUPO_ATIVO__', 1, 100, 100, '[]'::jsonb, null),
    (v_clinica, v_historico, '__R157_GRUPO_HISTORICO__', 1, 100, 100, '[]'::jsonb, null),
    (v_clinica, v_retirado, '__R157_GRUPO_RETIRADO__', 1, 100, 100, '[]'::jsonb, now());

  insert into public.orcamento_cobrancas (
    id, clinica_id, orcamento_id, paciente_id, dentista_id, subtotal, desconto, valor_final,
    numero_parcelas, primeiro_vencimento
  ) values (v_cobranca, v_clinica, v_grupo, v_paciente, v_dentista, 100, 0, 100, 1, current_date);
end;
$$;

set local session_replication_role = origin;

do $$
declare
  v_clinica uuid := current_setting('r157.guard.clinica')::uuid;
  v_paciente uuid := current_setting('r157.guard.paciente')::uuid;
  v_dentista uuid := current_setting('r157.guard.dentista')::uuid;
  v_ficha uuid := current_setting('r157.guard.ficha')::uuid;
  v_grupo uuid := current_setting('r157.guard.grupo')::uuid;
  v_global uuid := current_setting('r157.guard.global')::uuid;
  v_historico uuid := current_setting('r157.guard.historico')::uuid;
  v_retirado uuid := current_setting('r157.guard.retirado')::uuid;
  v_cobranca uuid := current_setting('r157.guard.cobranca')::uuid;
begin
  -- Caminhos das RPCs legadas: valor acordado, plano, desconto e pagamento global.
  begin
    update public.orcamentos set valor_acordado = 90 where id = v_grupo and clinica_id = v_clinica;
    raise exception 'r157_guard_aceitou_valor_acordado_global';
  exception when others then
    if sqlerrm not like '%grupo_orcamento_negociado%' then raise; end if;
  end;

  -- A cobrança por etapa continua sendo o único caminho que insere parcela nova.
  insert into public.pagamentos (
    clinica_id, orcamento_id, cobranca_id, paciente_id, dentista_id, valor, status
  ) values (v_clinica, v_grupo, v_cobranca, v_paciente, v_dentista, 100, 'pendente');

  begin
    update public.pagamentos set cobranca_id = null
     where orcamento_id = v_grupo and cobranca_id = v_cobranca;
    raise exception 'r157_guard_aceitou_etapa_convertida_em_global';
  exception when others then
    if sqlerrm not like '%grupo_orcamento_negociado%' then raise; end if;
  end;

  begin
    update public.orcamentos set plano_forma = 'avista' where id = v_grupo and clinica_id = v_clinica;
    raise exception 'r157_guard_aceitou_plano_global';
  exception when others then
    if sqlerrm not like '%grupo_orcamento_negociado%' then raise; end if;
  end;

  begin
    update public.orcamentos set desconto = 10 where id = v_grupo and clinica_id = v_clinica;
    raise exception 'r157_guard_aceitou_desconto_global';
  exception when others then
    if sqlerrm not like '%grupo_orcamento_negociado%' then raise; end if;
  end;

  begin
    insert into public.pagamentos (clinica_id, orcamento_id, paciente_id, dentista_id, valor, status)
    values (v_clinica, v_grupo, v_paciente, v_dentista, 100, 'pendente');
    raise exception 'r157_guard_aceitou_pagamento_global';
  exception when others then
    if sqlerrm not like '%grupo_orcamento_negociado%' then raise; end if;
  end;

  -- Inserir grupo em orçamento já negociado também falha antes da validação da composição.
  begin
    insert into public.orcamento_itens (
      clinica_id, orcamento_id, descricao, quantidade, preco_unitario, preco_total, composicao
    ) values (v_clinica, v_global, '__R157_GRUPO_BLOQUEADO__', 1, 100, 100, '[]'::jsonb);
    raise exception 'r157_guard_aceitou_grupo_em_orcamento_global';
  exception when others then
    if sqlerrm not like '%grupo_orcamento_negociado%' then raise; end if;
  end;

  -- Legado não é convertido: metadado e remoção dos campos globais permanecem possíveis.
  update public.orcamentos set condicoes_pagamento = '__R157_HISTORICO__'
   where id = v_historico and clinica_id = v_clinica;
  update public.orcamentos set valor_acordado = null, plano_forma = null, desconto = 0
   where id = v_historico and clinica_id = v_clinica;

  -- Grupo retirado pelo fluxo R169 não bloqueia um novo acordo para os itens ativos restantes.
  update public.orcamentos set valor_acordado = 100, plano_forma = 'avista'
   where id = v_retirado and clinica_id = v_clinica;

  raise notice 'R-157 guard: bloqueios de acordo/pagamento global e preservação de histórico passaram.';
end;
$$;

rollback;
