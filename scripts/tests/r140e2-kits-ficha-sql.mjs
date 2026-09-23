// Exercita RPCs reais R140e2 em Postgres local isolado (PGlite).
// PGLITE_MODULE_PATH=/tmp/r169-db-check/pglite/package/dist/index.js node scripts/tests/r140e2-kits-ficha-sql.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.PGLITE_MODULE_PATH) throw new Error('Defina PGLITE_MODULE_PATH.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const migrations = new URL('../../supabase/migrations/', import.meta.url);
const sql = (name) => readFile(new URL(name, migrations), 'utf8');
const ids = {
  clinica: '10000000-0000-4000-8000-000000000001', usuario: '20000000-0000-4000-8000-000000000001',
  dentista: '30000000-0000-4000-8000-000000000001', membro: '40000000-0000-4000-8000-000000000001',
  atendimento: '50000000-0000-4000-8000-000000000001', item: '60000000-0000-4000-8000-000000000001',
  lote: '70000000-0000-4000-8000-000000000001', kitKey: '80000000-0000-4000-8000-000000000001',
  declararKey: '80000000-0000-4000-8000-000000000002', confirmarKey: '80000000-0000-4000-8000-000000000003',
  linha: '90000000-0000-4000-8000-000000000001', itemInacessivel: '60000000-0000-4000-8000-000000000002', loteVencido: '70000000-0000-4000-8000-000000000002', estranho: '20000000-0000-4000-8000-000000000002',
  dentistaEstranho: '30000000-0000-4000-8000-000000000002', membroEstranho: '40000000-0000-4000-8000-000000000002',
  secretariaUsuario: '20000000-0000-4000-8000-000000000003', secretariaMembro: '40000000-0000-4000-8000-000000000003', secretaria: '30000000-0000-4000-8000-000000000003',
};
const rpc = async (nome, entrada) => (await db.query(
  nome === 'operar_kits_estoque'
    ? `select public.operar_kits_estoque('cadastrar', $1::jsonb) resultado`
    : `select public.${nome}($1::jsonb) resultado`,
  [JSON.stringify(entrada)],
)).rows[0].resultado;
const contagens = async () => (await db.query(`select
  (select count(*)::int from public.estoque_operacoes) operacoes,
  (select count(*)::int from public.estoque_movimentos) movimentos,
  (select count(*)::int from public.estoque_auditoria) auditorias,
  (select count(*)::int from public.estoque_usos where estado_operacional='pendente_autorizacao') pendentes,
  (select versao from public.estoque_itens where id='${ids.item}') versao,
  (select count(*)::int from public.estoque_kits) kits,
  (select count(*)::int from public.estoque_kit_versoes) kit_versoes,
  (select count(*)::int from public.estoque_kit_componentes) kit_componentes`)).rows[0];

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private; create schema extensions;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
    create function extensions.digest(text,text) returns bytea language sql immutable as $$ select decode(repeat('00',32),'hex') $$;
    create table public.clinicas(id uuid primary key);
    create table public.users(id uuid primary key, active_clinica_id uuid);
    create table public.dentistas(id uuid primary key, clinica_id uuid not null, user_id uuid not null, nome text, role text not null default 'dentista', ativo boolean not null default true);
    create table public.secretarias(id uuid primary key default gen_random_uuid(), clinica_id uuid, usuario_id uuid, nome text);
    create table public.clinica_governanca(clinica_id uuid primary key);
    create table public.clinica_usuarios(id uuid primary key, clinica_id uuid not null, usuario_id uuid not null, status text not null);
    create table public.clinica_acessos(id uuid primary key default gen_random_uuid(), clinica_id uuid not null, membro_id uuid not null, acessos jsonb not null default '[]');
    create table public.atendimentos_clinicos(id uuid primary key, clinica_id uuid not null, dentista_id uuid not null, updated_at timestamptz not null default now());
    create function private.obter_contexto_estoque(p_clinica uuid) returns jsonb language sql stable set search_path=pg_catalog,public,auth as $$
      select jsonb_build_object('ok',true,'data',jsonb_build_object('clinicaId',p_clinica::text,'membroId',cu.id::text,'dentistaId',d.id::text,
        'permissoesPessoais',((jsonb_build_array('estoque.ler','estoque.gerir','estoque.receber','estoque.consumir','estoque.descartar','estoque.ajustar') - case when current_setting('test.sem_estoque_ler',true)='1' then 'estoque.ler' else '__ausente__' end) - case when current_setting('test.sem_estoque_gerir',true)='1' then 'estoque.gerir' else '__ausente__' end),
        'permissoesCompartilhadas',((jsonb_build_array('estoque.ler','estoque.gerir','estoque.receber','estoque.consumir','estoque.descartar','estoque.ajustar') - case when current_setting('test.sem_estoque_ler',true)='1' then 'estoque.ler' else '__ausente__' end) - case when current_setting('test.sem_estoque_gerir',true)='1' then 'estoque.gerir' else '__ausente__' end)))
      from public.clinica_usuarios cu left join public.dentistas d on d.clinica_id=cu.clinica_id and d.user_id=cu.usuario_id
      where cu.clinica_id=p_clinica and cu.usuario_id=auth.uid() and cu.status='ativo' limit 1 $$;
    insert into public.clinicas values('${ids.clinica}'); insert into public.users values('${ids.usuario}','${ids.clinica}'),('${ids.estranho}','${ids.clinica}'),('${ids.secretariaUsuario}','${ids.clinica}');
    insert into public.dentistas values('${ids.dentista}','${ids.clinica}','${ids.usuario}','Dra QA','dentista',true),('${ids.dentistaEstranho}','${ids.clinica}','${ids.estranho}','Dr. Não responsável','dentista',true);
    insert into public.secretarias(id,clinica_id,usuario_id,nome) values('${ids.secretaria}','${ids.clinica}','${ids.secretariaUsuario}','Secretária QA'); insert into public.clinica_governanca values('${ids.clinica}'); insert into public.clinica_usuarios values('${ids.membro}','${ids.clinica}','${ids.usuario}','ativo'),('${ids.membroEstranho}','${ids.clinica}','${ids.estranho}','ativo'),('${ids.secretariaMembro}','${ids.clinica}','${ids.secretariaUsuario}','ativo');
    insert into public.clinica_acessos(clinica_id,membro_id,acessos) values('${ids.clinica}','${ids.membro}','[{"permissao":"kits.gerir","escopo":{"tipo":"clinica"}}]');
    insert into public.atendimentos_clinicos(id,clinica_id,dentista_id) values('${ids.atendimento}','${ids.clinica}','${ids.dentista}');
    select set_config('test.actor','${ids.usuario}',false);
  `);
  for (const name of ['20260923120000_r140e1_estrutura_estoque_manual.sql','20260923120200_r140e1b_operacoes_estoque.sql','20260923120300_r140e1b_corrigir_trigger_saldo_definer.sql','20260923120400_r140e1b_corrigir_tipo_consumo.sql','20260923120500_r140e2_kits_usos_consumiveis.sql','20260923120600_r140e2_correcao_uso_estoque.sql','20260923120700_r140e2_leituras_kits_usos.sql','20260923120800_r140e2_bloquear_lotes_vencidos_e_leitura.sql']) {
    await db.exec(await sql(name));
  }
  await db.exec('set role authenticated');
  await assert.rejects(
    db.query('select * from public.estoque_usos'),
    /permission denied/i,
    'o papel autenticado só alcança usos pelas RPCs, nunca por tabela direta',
  );
  await assert.rejects(
    db.query("select private.declarar_usos_estoque_legacy_r140e2('{}'::jsonb)"),
    /permission denied/i,
    'a função legada não fica exposta depois do wrapper forward',
  );
  await db.exec('reset role');
  await db.exec(`
    insert into public.estoque_itens(id,clinica_id,titular_tipo,nome,unidade_base,comportamento,controle_lote,minimo) values('${ids.item}','${ids.clinica}','clinica','Resina QA','unidade','consumivel',false,0);
    insert into public.estoque_itens(id,clinica_id,titular_tipo,titular_dentista_id,nome,unidade_base,comportamento,controle_lote,minimo) values('${ids.itemInacessivel}','${ids.clinica}','dentista','${ids.dentistaEstranho}','Material alheio','unidade','consumivel',false,0);
    insert into public.estoque_lotes(id,clinica_id,item_id,origem_sem_identificacao) values('${ids.lote}','${ids.clinica}','${ids.item}',true);
    insert into public.estoque_lotes(id,clinica_id,item_id,identificador_fabricante,validade,origem_sem_identificacao) values
      ('${ids.loteVencido}','${ids.clinica}','${ids.item}','VENCIDO','2000-01-01',false);
    insert into public.estoque_operacoes(id,clinica_id,ator_usuario_id,chave_idempotencia,payload_hash,resultado) values(gen_random_uuid(),'${ids.clinica}','${ids.usuario}',gen_random_uuid(),repeat('0',64),'{}');
    insert into public.estoque_movimentos(id,clinica_id,item_id,lote_id,tipo,quantidade,origem_tipo,operacao_id,ator_usuario_id) select gen_random_uuid(),'${ids.clinica}','${ids.item}','${ids.lote}','entrada',10,'manual',id,'${ids.usuario}' from public.estoque_operacoes limit 1;
  `);
  const kit = await rpc('operar_kits_estoque', { clinicaIdEsperada: ids.clinica, chaveIdempotencia: ids.kitKey, titular: { tipo: 'clinica' }, nome: 'Kit restaurador', componentes: [{ itemId: ids.item, quantidadeBase: '2' }] });
  assert.equal(kit.ok, true, JSON.stringify(kit));
  const kitsLidos = (await db.query('select public.listar_kits_estoque($1::jsonb) resultado', [JSON.stringify({ clinicaIdEsperada: ids.clinica, titular: { tipo: 'clinica' } })])).rows[0].resultado;
  assert.equal(kitsLidos.data.kits[0].kitId, kit.data.kitId, 'leitura de kits respeita titular e retorna composição');
  assert.equal(kitsLidos.data.kits[0].kitVersaoId, kit.data.kitVersaoId, 'a ficha recebe a versão imutável do kit para cada declaração');
  const antesKitInacessivel = await contagens();
  const criarKitInacessivel = await rpc('operar_kits_estoque', { clinicaIdEsperada: ids.clinica, chaveIdempotencia: '80000000-0000-4000-8000-000000000018', titular: { tipo: 'clinica' }, nome: 'Kit incompleto', componentes: [{ itemId: ids.item, quantidadeBase: '1' }, { itemId: ids.itemInacessivel, quantidadeBase: '1' }] });
  assert.deepEqual({ ok: criarKitInacessivel.ok, codigo: criarKitInacessivel.codigo }, { ok: false, codigo: 'SEM_ACESSO' }, 'componente inacessível não deixa kit criado parcialmente');
  assert.deepEqual(await contagens(), antesKitInacessivel, 'falha ao criar kit não cria kit, versão, componente nem operação');
  const editarKitInacessivel = (await db.query(`select public.operar_kits_estoque('editar',$1::jsonb) resultado`, [JSON.stringify({ clinicaIdEsperada: ids.clinica, chaveIdempotencia: '80000000-0000-4000-8000-000000000019', kitId: kit.data.kitId, versaoEsperada: 1, nome: 'Kit alterado parcialmente', componentes: [{ itemId: ids.item, quantidadeBase: '1' }, { itemId: ids.itemInacessivel, quantidadeBase: '1' }] })])).rows[0].resultado;
  assert.deepEqual({ ok: editarKitInacessivel.ok, codigo: editarKitInacessivel.codigo }, { ok: false, codigo: 'SEM_ACESSO' }, 'componente inacessível não cria versão parcial ao editar');
  assert.deepEqual(await contagens(), antesKitInacessivel, 'falha ao editar preserva kit e versão publicada');
  const antesDeclaracaoParcial = await contagens();
  const declaracaoInvalida = await rpc('declarar_usos_estoque', { clinicaIdEsperada: ids.clinica, atendimentoId: ids.atendimento, chaveIdempotencia: '80000000-0000-4000-8000-000000000020', linhas: [{ linhaOrigemId: '90000000-0000-4000-8000-000000000020', itemId: ids.item, loteId: ids.lote, quantidade: '1', kitVersaoId: null }, { linhaOrigemId: '90000000-0000-4000-8000-000000000021', itemId: ids.item, loteId: ids.lote, quantidade: '1', kitVersaoId: '44444444-4444-4444-8444-444444444445' }] });
  assert.deepEqual({ ok: declaracaoInvalida.ok, codigo: declaracaoInvalida.codigo }, { ok: false, codigo: 'INVALIDO' }, 'segunda linha com versão de kit inválida não persiste a primeira');
  assert.deepEqual(await contagens(), antesDeclaracaoParcial, 'declaração rejeitada não cria uso nem operação parcial');
  const declaracao = { clinicaIdEsperada: ids.clinica, atendimentoId: ids.atendimento, chaveIdempotencia: ids.declararKey, linhas: [{ linhaOrigemId: ids.linha, itemId: ids.item, loteId: ids.lote, quantidade: '2', kitVersaoId: kit.data.kitVersaoId }] };
  const declarado = await rpc('declarar_usos_estoque', declaracao);
  assert.equal(declarado.ok, true, JSON.stringify(declarado));
  const usoId = declarado.data.usos[0].usoId;
  assert.equal(declarado.data.usos[0].linhaOrigemId, ids.linha, 'a resposta vincula cada uso à linha da ficha sem depender da ordem da RPC');
  const previaSemDeficit = await rpc('previsualizar_confirmacao_usos_estoque', { clinicaIdEsperada: ids.clinica, atendimentoId: ids.atendimento, usoIds: [usoId] });
  assert.deepEqual(previaSemDeficit.data.insuficientes, [], 'a prévia não exige aceite quando o lote cobre todas as linhas');
  const usosLidos = (await db.query('select public.listar_usos_atendimento_estoque($1::jsonb) resultado', [JSON.stringify({ clinicaIdEsperada: ids.clinica, atendimentoId: ids.atendimento })])).rows[0].resultado;
  assert.equal(usosLidos.data.usos[0].usoId, usoId, 'leitura da ficha retorna somente os usos do autor');
  assert.equal(usosLidos.data.usos[0].itemId, ids.item, 'leitura autorizada traz o item para revisar lote e quantidade reais');
  await db.exec(`create function private.r140e2_auditoria_falha() returns trigger language plpgsql as $$ begin raise exception 'AUDITORIA_FORCADA'; end $$; create trigger r140e2_auditoria_falha before insert on public.estoque_auditoria for each row execute function private.r140e2_auditoria_falha();`);
  const confirmar = { clinicaIdEsperada: ids.clinica, atendimentoId: ids.atendimento, usoIds: [usoId], divergenciasAceitas: [], chaveIdempotencia: ids.confirmarKey };
  const antes = await contagens(); const falha = await rpc('confirmar_usos_estoque', confirmar); const depoisFalha = await contagens();
  assert.deepEqual({ ok: falha.ok, codigo: falha.codigo }, { ok: false, codigo: 'INDISPONIVEL' });
  assert.deepEqual(depoisFalha, antes, 'falha de auditoria reverte operação, baixa, saldo e versão');
  await db.exec('drop trigger r140e2_auditoria_falha on public.estoque_auditoria');
  const confirmado = await rpc('confirmar_usos_estoque', confirmar);
  assert.equal(confirmado.ok, true, JSON.stringify(confirmado));
  assert.equal(confirmado.data.usos[0].usoId, usoId);
  const replay = await rpc('confirmar_usos_estoque', confirmar);
  assert.deepEqual(replay, confirmado, 'idempotência devolve a confirmação original');
  const novoPedidoDaMesmaLinha = await rpc('confirmar_usos_estoque', { ...confirmar, chaveIdempotencia: '80000000-0000-4000-8000-000000000011' });
  assert.deepEqual(novoPedidoDaMesmaLinha, confirmado, 'nova chave reconcilia o fato já confirmado sem segunda baixa');
  const final = await contagens();
  assert.equal(final.movimentos, antes.movimentos + 1); assert.equal(final.auditorias, antes.auditorias + 1); assert.equal(final.pendentes, 0); assert.equal(final.versao, antes.versao + 1);
  const declaracaoVencida = await rpc('declarar_usos_estoque', { ...declaracao, chaveIdempotencia: '80000000-0000-4000-8000-000000000013', linhas: [{ linhaOrigemId: '90000000-0000-4000-8000-000000000013', itemId: ids.item, loteId: ids.loteVencido, quantidade: '1', kitVersaoId: null }] });
  assert.deepEqual({ ok: declaracaoVencida.ok, codigo: declaracaoVencida.codigo }, { ok: false, codigo: 'LOTE_VENCIDO' }, 'declaração não persiste lote vencido');
  const declaracaoLegadaVencida = (await db.query('select private.declarar_usos_estoque_legacy_r140e2($1::jsonb) resultado', [JSON.stringify({ ...declaracao, chaveIdempotencia: '80000000-0000-4000-8000-000000000014', linhas: [{ linhaOrigemId: '90000000-0000-4000-8000-000000000014', itemId: ids.item, loteId: ids.loteVencido, quantidade: '1', kitVersaoId: null }] })])).rows[0].resultado;
  assert.equal(declaracaoLegadaVencida.ok, true, JSON.stringify(declaracaoLegadaVencida));
  const confirmacaoVencida = await rpc('confirmar_usos_estoque', { ...confirmar, usoIds: [declaracaoLegadaVencida.data.usos[0].usoId], divergenciasAceitas: [], chaveIdempotencia: '80000000-0000-4000-8000-000000000015' });
  assert.deepEqual({ ok: confirmacaoVencida.ok, codigo: confirmacaoVencida.codigo }, { ok: false, codigo: 'LOTE_VENCIDO' }, 'confirmação não baixa uso pendente cujo lote venceu');
  const correcaoVencida = (await db.query('select public.corrigir_uso_estoque($1::jsonb) resultado', [JSON.stringify({ clinicaIdEsperada: ids.clinica, atendimentoId: ids.atendimento, usoId, revisaoEsperada: 1, chaveIdempotencia: '80000000-0000-4000-8000-000000000016', substituicao: { itemId: ids.item, loteId: ids.loteVencido, quantidade: '1', kitVersaoId: null, versaoItemEsperada: final.versao }, aceitarDivergencia: false })])).rows[0].resultado;
  assert.deepEqual({ ok: correcaoVencida.ok, codigo: correcaoVencida.codigo }, { ok: false, codigo: 'LOTE_VENCIDO' }, 'correção preserva uso confirmado e não troca para lote vencido');
  const linhaDivergente = '90000000-0000-4000-8000-000000000002';
  const declaradoDivergente = await rpc('declarar_usos_estoque', { ...declaracao, chaveIdempotencia: '80000000-0000-4000-8000-000000000004', linhas: [{ linhaOrigemId: linhaDivergente, itemId: ids.item, loteId: ids.lote, quantidade: '9', kitVersaoId: null }] });
  const usoDivergente = declaradoDivergente.data.usos[0].usoId;
  const previaDivergente = await rpc('previsualizar_confirmacao_usos_estoque', { clinicaIdEsperada: ids.clinica, atendimentoId: ids.atendimento, usoIds: [usoDivergente] });
  assert.deepEqual(previaDivergente.data.insuficientes.map((uso) => uso.usoId), [usoDivergente], 'a prévia retorna somente a linha que precisa de aceite explícito');
  const semAceite = await rpc('confirmar_usos_estoque', { ...confirmar, usoIds: [usoDivergente], divergenciasAceitas: [], chaveIdempotencia: '80000000-0000-4000-8000-000000000005' });
  assert.deepEqual({ ok: semAceite.ok, codigo: semAceite.codigo }, { ok: false, codigo: 'SALDO_INSUFICIENTE' }, 'déficit exige aceite explícito da própria linha');
  const comAceite = await rpc('confirmar_usos_estoque', { ...confirmar, usoIds: [usoDivergente], divergenciasAceitas: [{ usoId: usoDivergente, versaoItemEsperada: final.versao }], chaveIdempotencia: '80000000-0000-4000-8000-000000000006' });
  assert.equal(comAceite.ok, true, JSON.stringify(comAceite));
  const estadoDivergente = (await db.query(`select estado_operacional from public.estoque_usos where id='${usoDivergente}'`)).rows[0].estado_operacional;
  assert.equal(estadoDivergente, 'confirmado_divergente');
  const manualNegativo = await db.query(`select public.operar_estoque('consumir',$1::jsonb) resultado`, [JSON.stringify({ clinicaIdEsperada: ids.clinica, chaveIdempotencia: '80000000-0000-4000-8000-000000000007', itemId: ids.item, loteId: ids.lote, versaoEsperada: final.versao + 1, quantidade: '1', motivo: 'Tentativa manual' })]);
  assert.deepEqual({ ok: manualNegativo.rows[0].resultado.ok, codigo: manualNegativo.rows[0].resultado.codigo }, { ok: false, codigo: 'SALDO_INSUFICIENTE' }, 'movimento manual não pode aprofundar o déficit clínico');
  const correcaoInput = {
    clinicaIdEsperada: ids.clinica, atendimentoId: ids.atendimento, usoId, revisaoEsperada: 1,
    chaveIdempotencia: '80000000-0000-4000-8000-000000000010',
    substituicao: { itemId: ids.item, loteId: ids.lote, quantidade: '1', kitVersaoId: null, versaoItemEsperada: final.versao + 1 },
    aceitarDivergencia: false,
  };
  await db.exec(`create trigger r140e2_correcao_auditoria_falha before insert on public.estoque_auditoria for each row execute function private.r140e2_auditoria_falha()`);
  const antesCorrecao = await contagens();
  const falhaCorrecao = (await db.query('select public.corrigir_uso_estoque($1::jsonb) resultado', [JSON.stringify(correcaoInput)])).rows[0].resultado;
  assert.deepEqual({ ok: falhaCorrecao.ok, codigo: falhaCorrecao.codigo }, { ok: false, codigo: 'INDISPONIVEL' });
  assert.deepEqual(await contagens(), antesCorrecao, 'falha de auditoria também reverte a compensação da correção');
  await db.exec('drop trigger r140e2_correcao_auditoria_falha on public.estoque_auditoria');
  const correcao = (await db.query('select public.corrigir_uso_estoque($1::jsonb) resultado', [JSON.stringify(correcaoInput)])).rows[0].resultado;
  assert.equal(correcao.ok, true, JSON.stringify(correcao));
  const replayCorrecao = (await db.query('select public.corrigir_uso_estoque($1::jsonb) resultado', [JSON.stringify(correcaoInput)])).rows[0].resultado;
  assert.deepEqual(replayCorrecao, correcao, 'replay de correção não cria outra compensação');
  const correcaoObsoleta = (await db.query('select public.corrigir_uso_estoque($1::jsonb) resultado', [JSON.stringify({ ...correcaoInput, chaveIdempotencia: '80000000-0000-4000-8000-000000000012', revisaoEsperada: 2 })])).rows[0].resultado;
  assert.deepEqual({ ok: correcaoObsoleta.ok, codigo: correcaoObsoleta.codigo }, { ok: false, codigo: 'CONFLITO' }, 'revisão já substituída não aceita segunda correção');
  const usosCorrigidos = (await db.query(`select revisao,estado_operacional from public.estoque_usos where atendimento_id='${ids.atendimento}' and linha_origem_id='${ids.linha}' order by revisao`)).rows;
  assert.deepEqual(usosCorrigidos.map((uso) => [uso.revisao, uso.estado_operacional]), [[1, 'substituido'], [2, 'confirmado']], 'correção preserva uso e cria revisão confirmada');
  await db.exec(`update public.clinica_acessos set acessos='[]'::jsonb where clinica_id='${ids.clinica}'`);
  const kitsSemGerir = (await db.query('select public.listar_kits_estoque($1::jsonb) resultado', [JSON.stringify({ clinicaIdEsperada: ids.clinica, titular: { tipo: 'clinica' } })])).rows[0].resultado;
  assert.equal(kitsSemGerir.ok, true, 'ler componentes autorizados basta para aplicar um kit; gerir só é exigido ao alterá-lo');
  assert.equal(kitsSemGerir.ok, true, 'a leitura do kit continua disponível sem capacidade de gerir estoque');
  const kitCooperativo = await rpc('operar_kits_estoque', { clinicaIdEsperada: ids.clinica, chaveIdempotencia: '80000000-0000-4000-8000-000000000021', titular: { tipo: 'clinica' }, nome: 'Kit cooperativo', componentes: [{ itemId: ids.item, quantidadeBase: '1' }] });
  assert.equal(kitCooperativo.ok, true, 'estoque.gerir compartilhado permite criar kit clínico sem concessão kits.gerir');
  const kitProprio = await rpc('operar_kits_estoque', { clinicaIdEsperada: ids.clinica, chaveIdempotencia: '80000000-0000-4000-8000-000000000022', titular: { tipo: 'dentista', dentistaId: ids.dentista }, nome: 'Kit próprio', componentes: [{ itemId: ids.item, quantidadeBase: '1' }] });
  assert.equal(kitProprio.ok, true, 'estoque.gerir próprio permite criar kit pessoal');
  await db.exec(`select set_config('test.actor','${ids.secretariaUsuario}',false); select set_config('test.sem_estoque_gerir','0',false)`);
  const kitSecretaria = await rpc('operar_kits_estoque', { clinicaIdEsperada: ids.clinica, chaveIdempotencia: '80000000-0000-4000-8000-000000000023', titular: { tipo: 'clinica' }, nome: 'Kit da secretária', componentes: [{ itemId: ids.item, quantidadeBase: '1' }] });
  assert.equal(kitSecretaria.ok, true, 'secretária com estoque.gerir compartilhado cria kit clínico');
  await db.exec(`select set_config('test.actor','${ids.usuario}',false); select set_config('test.sem_estoque_gerir','1',false)`);
  const semPermissaoKit = await rpc('operar_kits_estoque', { clinicaIdEsperada: ids.clinica, chaveIdempotencia: '80000000-0000-4000-8000-000000000024', titular: { tipo: 'clinica' }, nome: 'Kit sem estoque gerir', componentes: [{ itemId: ids.item, quantidadeBase: '1' }] });
  assert.deepEqual({ ok: semPermissaoKit.ok, codigo: semPermissaoKit.codigo }, { ok: false, codigo: 'SEM_ACESSO' }, 'sem estoque.gerir não cria kit mesmo sem depender de kits.gerir');
  await db.exec(`select set_config('test.sem_estoque_gerir','0',false)`);
  await db.exec(`select set_config('test.sem_estoque_ler','1',false)`);
  const semLerDeclarar = await rpc('declarar_usos_estoque', { ...declaracao, chaveIdempotencia: '80000000-0000-4000-8000-000000000017', linhas: [{ linhaOrigemId: '90000000-0000-4000-8000-000000000017', itemId: ids.item, loteId: ids.lote, quantidade: '1', kitVersaoId: null }] });
  assert.deepEqual({ ok: semLerDeclarar.ok, codigo: semLerDeclarar.codigo }, { ok: false, codigo: 'SEM_ACESSO' }, 'declaração não aceita UUID de material sem estoque.ler');
  await db.exec(`select set_config('test.sem_estoque_ler','0',false); insert into public.clinica_acessos(clinica_id,membro_id,acessos) values('${ids.clinica}','${ids.membroEstranho}','[]'); select set_config('test.actor','${ids.estranho}',false)`);
  const fichaDeOutro = await rpc('declarar_usos_estoque', { ...declaracao, chaveIdempotencia: '80000000-0000-4000-8000-000000000009', linhas: [{ linhaOrigemId: '90000000-0000-4000-8000-000000000003', itemId: ids.item, loteId: ids.lote, quantidade: '1', kitVersaoId: null }] });
  assert.deepEqual({ ok: fichaDeOutro.ok, codigo: fichaDeOutro.codigo }, { ok: false, codigo: 'SEM_ACESSO' }, 'somente o dentista responsável declara na própria ficha');
  console.log('R140e2: kit, autorização, lotes vencidos, declaração, confirmação, correção compensada e rollbacks de auditoria verificados em PGlite.');
} finally { await db.close(); }
