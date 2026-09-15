-- Executar somente depois da migration R-140e1, com uma conexão privilegiada do ambiente de teste.
-- Usa as duas contas sintéticas de fixture.json e sempre descarta os fatos criados.
begin;

do $$
declare
  v_clinica_a uuid := '9ee9603b-9dd8-45da-8435-74fbf2bf45cd';
  v_clinica_b uuid := 'c4f5b5f7-12a6-4b1d-a7d2-7d71565ca987';
  v_usuario_a uuid := '65875816-02d9-4b21-bf9c-29626de20a31';
  v_usuario_b uuid := 'e5f2bc67-bd38-40f8-ba3f-0a4400251281';
  v_dentista_a uuid := '3a44b79c-cd69-4820-a34f-04001ffe7a9b';
  v_item_a uuid := gen_random_uuid();
  v_item_a_outro uuid := gen_random_uuid();
  v_item_b uuid := gen_random_uuid();
  v_lote_a uuid := gen_random_uuid();
  v_lote_a_outro uuid := gen_random_uuid();
  v_lote_b uuid := gen_random_uuid();
  v_op_entrada uuid;
  v_op_consumo uuid;
  v_op_correcao uuid;
  v_movimento_entrada uuid := gen_random_uuid();
  v_movimento_consumo uuid := gen_random_uuid();
  v_movimento_reversao uuid := gen_random_uuid();
  v_movimento_substituto uuid := gen_random_uuid();
  v_saldo numeric(18,6);
  v_nome_a text;
  v_nome_b text;
  v_email_a text;
  v_email_b text;
  v_constraint text;
begin
  select c.nome, u.email into v_nome_a, v_email_a
  from public.clinicas c join public.users u on u.id = v_usuario_a
  where c.id = v_clinica_a and u.active_clinica_id = c.id;
  select c.nome, u.email into v_nome_b, v_email_b
  from public.clinicas c join public.users u on u.id = v_usuario_b
  where c.id = v_clinica_b and u.active_clinica_id = c.id;

  if v_nome_a is null or v_nome_b is null or v_email_a is null or v_email_b is null
    or v_nome_a not like 'QA %' or v_nome_b not like 'QA %'
    or v_email_a not like 'qa%@odontoia.example'
    or v_email_b not like 'qa%@odontoia.example'
    or not exists (
      select 1 from public.dentistas d
      where d.id = v_dentista_a and d.clinica_id = v_clinica_a
        and d.user_id = v_usuario_a and d.ativo
    ) then
    raise exception 'r140e1_fixture_qa_invalida';
  end if;

  insert into public.estoque_itens (
    id, clinica_id, titular_tipo, titular_dentista_id, nome, unidade_base, controle_lote, minimo
  ) values
    (v_item_a, v_clinica_a, 'clinica', null, '__R140E1_ITEM_A__', 'unidade', true, 0),
    (v_item_a_outro, v_clinica_a, 'clinica', null, '__R140E1_ITEM_A_OUTRO__', 'unidade', false, 0),
    (v_item_b, v_clinica_b, 'clinica', null, '__R140E1_ITEM_B__', 'unidade', false, 0);

  insert into public.estoque_lotes (
    id, clinica_id, item_id, identificador_fabricante, origem_sem_identificacao
  ) values
    (v_lote_a, v_clinica_a, v_item_a, '__R140E1_LOTE_A__', false),
    (v_lote_a_outro, v_clinica_a, v_item_a_outro, null, true),
    (v_lote_b, v_clinica_b, v_item_b, null, true);

  select coalesce(sum(quantidade), 0) into v_saldo
  from public.estoque_movimentos
  where clinica_id = v_clinica_a and item_id = v_item_a and lote_id = v_lote_a;
  if v_saldo <> 0 then
    raise exception 'r140e1_item_novo_nao_iniciou_com_saldo_zero';
  end if;

  begin
    insert into public.estoque_itens (
      clinica_id, titular_tipo, titular_dentista_id, nome, unidade_base
    ) values (
      v_clinica_b, 'dentista', v_dentista_a, '__R140E1_TITULAR_CRUZADO__', 'unidade'
    );
    raise exception 'r140e1_aceitou_dentista_de_outra_clinica';
  exception when foreign_key_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'estoque_itens_titular_fkey' then raise; end if;
  end;

  insert into public.estoque_operacoes (
    clinica_id, ator_usuario_id, chave_idempotencia, payload_hash, resultado
  ) values (
    v_clinica_a, v_usuario_a, gen_random_uuid(), repeat('a', 64), '{}'::jsonb
  ) returning id into v_op_entrada;

  insert into public.estoque_movimentos (
    id, clinica_id, item_id, lote_id, tipo, quantidade, origem_tipo, operacao_id, ator_usuario_id
  ) values (
    v_movimento_entrada, v_clinica_a, v_item_a, v_lote_a, 'entrada', 100, 'manual', v_op_entrada, v_usuario_a
  );

  select coalesce(sum(quantidade), 0) into v_saldo
  from public.estoque_movimentos
  where clinica_id = v_clinica_a and item_id = v_item_a and lote_id = v_lote_a;
  if v_saldo <> 100 then
    raise exception 'r140e1_item_novo_ou_entrada_100_falhou';
  end if;

  insert into public.estoque_operacoes (
    clinica_id, ator_usuario_id, chave_idempotencia, payload_hash, resultado
  ) values (
    v_clinica_a, v_usuario_a, gen_random_uuid(), repeat('b', 64), '{}'::jsonb
  ) returning id into v_op_consumo;
  insert into public.estoque_movimentos (
    id, clinica_id, item_id, lote_id, tipo, quantidade, motivo, origem_tipo, operacao_id, ator_usuario_id
  ) values (
    v_movimento_consumo, v_clinica_a, v_item_a, v_lote_a, 'consumo', -2, 'Uso sintético', 'manual', v_op_consumo, v_usuario_a
  );

  select sum(quantidade) into v_saldo
  from public.estoque_movimentos
  where clinica_id = v_clinica_a and item_id = v_item_a and lote_id = v_lote_a;
  if v_saldo <> 98 then
    raise exception 'r140e1_consumo_2_nao_resultou_em_98';
  end if;

  insert into public.estoque_operacoes (
    clinica_id, ator_usuario_id, chave_idempotencia, payload_hash, resultado
  ) values (
    v_clinica_a, v_usuario_a, gen_random_uuid(), repeat('c', 64), '{}'::jsonb
  ) returning id into v_op_correcao;
  -- O inverso temporariamente deixa saldo -2; o trigger de saldo é diferido até a substituição.
  insert into public.estoque_movimentos (
    id, clinica_id, item_id, lote_id, tipo, quantidade, motivo, origem_tipo, operacao_id, reversao_de, ator_usuario_id
  ) values (
    v_movimento_reversao, v_clinica_a, v_item_a, v_lote_a, 'reversao', -100, 'Correção sintética', 'correcao', v_op_correcao, v_movimento_entrada, v_usuario_a
  );
  select sum(quantidade) into v_saldo
  from public.estoque_movimentos
  where clinica_id = v_clinica_a and item_id = v_item_a and lote_id = v_lote_a;
  if v_saldo <> -2 then
    raise exception 'r140e1_reversao_nao_produziu_saldo_transitorio_esperado';
  end if;
  insert into public.estoque_movimentos (
    id, clinica_id, item_id, lote_id, tipo, quantidade, origem_tipo, origem_id, operacao_id, ator_usuario_id
  ) values (
    v_movimento_substituto, v_clinica_a, v_item_a, v_lote_a, 'entrada', 80, 'correcao', v_movimento_entrada, v_op_correcao, v_usuario_a
  );
  set constraints estoque_saldo_final_nao_negativo immediate;

  select sum(quantidade) into v_saldo
  from public.estoque_movimentos
  where clinica_id = v_clinica_a and item_id = v_item_a and lote_id = v_lote_a;
  if v_saldo <> 78 then
    raise exception 'r140e1_correcao_100_para_80_nao_manteve_78';
  end if;

  begin
    insert into public.estoque_movimentos (
      clinica_id, item_id, lote_id, tipo, quantidade, motivo, origem_tipo, operacao_id, ator_usuario_id
    ) values (
      v_clinica_a, v_item_a, v_lote_a, 'consumo', -79, 'Saída sintética', 'manual', v_op_consumo, v_usuario_a
    );
    raise exception 'r140e1_aceitou_saida_com_saldo_insuficiente';
  exception when check_violation then
    if sqlerrm <> 'ESTOQUE_SALDO_INSUFICIENTE' then raise; end if;
  end;

  begin
    insert into public.estoque_movimentos (
      clinica_id, item_id, lote_id, tipo, quantidade, motivo, origem_tipo, operacao_id, ator_usuario_id
    ) values (
      v_clinica_a, v_item_a, v_lote_a, 'ajuste', 0, 'Contagem zero inválida', 'contagem', v_op_consumo, v_usuario_a
    );
    raise exception 'r140e1_aceitou_movimento_zero';
  exception when check_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'estoque_movimentos_quantidade_check' then raise; end if;
  end;

  begin
    insert into public.estoque_movimentos (
      clinica_id, item_id, lote_id, tipo, quantidade, motivo, origem_tipo, operacao_id, ator_usuario_id
    ) values (
      v_clinica_a, v_item_a, v_lote_a, 'ajuste', 'NaN', 'Contagem NaN inválida', 'contagem', v_op_consumo, v_usuario_a
    );
    raise exception 'r140e1_aceitou_movimento_nan';
  exception when check_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'estoque_movimentos_quantidade_check' then raise; end if;
  end;

  begin
    insert into public.estoque_movimentos (
      clinica_id, item_id, lote_id, tipo, quantidade, motivo, origem_tipo, operacao_id, ator_usuario_id
    ) values (
      v_clinica_a, v_item_a, v_lote_b, 'ajuste', 1, 'Lote externo inválido', 'manual', v_op_consumo, v_usuario_a
    );
    raise exception 'r140e1_aceitou_lote_de_outra_clinica';
  exception when foreign_key_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'estoque_movimentos_lote_fkey' then raise; end if;
  end;

  begin
    insert into public.estoque_movimentos (
      clinica_id, item_id, lote_id, tipo, quantidade, motivo, origem_tipo, operacao_id, ator_usuario_id
    ) values (
      v_clinica_a, v_item_a, v_lote_a_outro, 'ajuste', 1, 'Lote de outro item inválido', 'manual', v_op_consumo, v_usuario_a
    );
    raise exception 'r140e1_aceitou_lote_de_outro_item';
  exception when foreign_key_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'estoque_movimentos_lote_fkey' then raise; end if;
  end;

  begin
    insert into public.estoque_movimentos (
      clinica_id, item_id, lote_id, tipo, quantidade, motivo, origem_tipo, operacao_id, reversao_de, ator_usuario_id
    ) values (
      v_clinica_a, v_item_a, v_lote_a, 'reversao', -99, 'Correção inválida', 'correcao', v_op_correcao, v_movimento_entrada, v_usuario_a
    );
    raise exception 'r140e1_aceitou_reversao_com_quantidade_errada';
  exception when check_violation then
    if sqlerrm <> 'ESTOQUE_REVERSAO_INVALIDA' then raise; end if;
  end;

  begin
    insert into public.estoque_movimentos (
      clinica_id, item_id, lote_id, tipo, quantidade, motivo, origem_tipo, operacao_id, reversao_de, ator_usuario_id
    ) values (
      v_clinica_a, v_item_a, v_lote_a, 'reversao', -100, 'Correção repetida', 'correcao', v_op_correcao, v_movimento_entrada, v_usuario_a
    );
    raise exception 'r140e1_aceitou_reversao_duplicada';
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'estoque_movimentos_reversao_de_key' then raise; end if;
  end;

  begin
    insert into public.estoque_operacoes (
      clinica_id, ator_usuario_id, chave_idempotencia, payload_hash, resultado
    ) values (
      v_clinica_a, v_usuario_a, (select chave_idempotencia from public.estoque_operacoes where id = v_op_entrada), repeat('d', 64), '{}'::jsonb
    );
    raise exception 'r140e1_aceitou_chave_idempotencia_repetida';
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'estoque_operacoes_chave_key' then raise; end if;
  end;

  begin
    insert into public.estoque_movimentos (
      clinica_id, item_id, lote_id, tipo, quantidade, motivo, origem_tipo, operacao_id, ator_usuario_id
    ) values (
      v_clinica_a, v_item_a, v_lote_a, 'ajuste', 1, 'Ator inválido', 'manual', v_op_consumo, v_usuario_b
    );
    raise exception 'r140e1_aceitou_operacao_de_outro_ator';
  exception when foreign_key_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'estoque_movimentos_operacao_fkey' then raise; end if;
  end;

  insert into public.estoque_auditoria (
    clinica_id, ator_usuario_id, acao, item_id, antes, depois, motivo, operacao_id
  ) values (
    v_clinica_a, v_usuario_a, 'entrada', v_item_a, null, jsonb_build_object('quantidade', '100'), 'Auditoria sintética', v_op_entrada
  );

  begin
    update public.estoque_movimentos set motivo = 'Alteração inválida' where id = v_movimento_consumo;
    raise exception 'r140e1_aceitou_update_movimento';
  exception when check_violation then if sqlerrm <> 'ESTOQUE_FATO_IMUTAVEL' then raise; end if;
  end;
  begin
    delete from public.estoque_movimentos where id = v_movimento_consumo;
    raise exception 'r140e1_aceitou_delete_movimento';
  exception when check_violation then if sqlerrm <> 'ESTOQUE_FATO_IMUTAVEL' then raise; end if;
  end;
  begin
    update public.estoque_operacoes set resultado = jsonb_build_object('alterado', true) where id = v_op_entrada;
    raise exception 'r140e1_aceitou_update_operacao';
  exception when check_violation then if sqlerrm <> 'ESTOQUE_FATO_IMUTAVEL' then raise; end if;
  end;
  begin
    delete from public.estoque_operacoes where id = v_op_entrada;
    raise exception 'r140e1_aceitou_delete_operacao';
  exception when check_violation then if sqlerrm <> 'ESTOQUE_FATO_IMUTAVEL' then raise; end if;
  end;
  begin
    update public.estoque_auditoria set acao = 'alterada' where item_id = v_item_a;
    raise exception 'r140e1_aceitou_update_auditoria';
  exception when check_violation then if sqlerrm <> 'ESTOQUE_FATO_IMUTAVEL' then raise; end if;
  end;
  begin
    delete from public.estoque_auditoria where item_id = v_item_a;
    raise exception 'r140e1_aceitou_delete_auditoria';
  exception when check_violation then if sqlerrm <> 'ESTOQUE_FATO_IMUTAVEL' then raise; end if;
  end;
  begin
    update public.estoque_lotes set versao = 2 where id = v_lote_a;
    raise exception 'r140e1_aceitou_update_lote';
  exception when check_violation then if sqlerrm <> 'ESTOQUE_FATO_IMUTAVEL' then raise; end if;
  end;
  begin
    delete from public.estoque_lotes where id = v_lote_a;
    raise exception 'r140e1_aceitou_delete_lote';
  exception when check_violation then if sqlerrm <> 'ESTOQUE_FATO_IMUTAVEL' then raise; end if;
  end;

  begin
    update public.estoque_itens set ativo = false, versao = 2 where id = v_item_a;
    raise exception 'r140e1_aceitou_arquivar_item_com_saldo';
  exception when check_violation then if sqlerrm <> 'ESTOQUE_ITEM_COM_SALDO' then raise; end if;
  end;
  begin
    update public.estoque_itens set unidade_base = 'g', versao = 2 where id = v_item_a;
    raise exception 'r140e1_aceitou_trocar_unidade_pos_movimento';
  exception when check_violation then if sqlerrm <> 'ESTOQUE_TITULAR_UNIDADE_IMUTAVEIS' then raise; end if;
  end;
  begin
    update public.estoque_itens
    set titular_tipo = 'dentista', titular_dentista_id = v_dentista_a, versao = 2
    where id = v_item_a;
    raise exception 'r140e1_aceitou_trocar_titular_pos_movimento';
  exception when check_violation then if sqlerrm <> 'ESTOQUE_TITULAR_UNIDADE_IMUTAVEIS' then raise; end if;
  end;

  raise notice 'R-140e1 estrutura: 27 gates físicos passaram; rollback obrigatório a seguir.';
end;
$$;

select 27::integer as gates_passaram;

rollback;
