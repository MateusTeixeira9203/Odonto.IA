// PGLITE_MODULE_PATH=/tmp/r169-db-check/pglite/package/dist/index.js node scripts/tests/r163c-recebimentos.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.env.PGLITE_MODULE_PATH) throw new Error('Defina PGLITE_MODULE_PATH.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [clinic, other, owner, dentistUser, secretary, dentist, member, budget, patient, charge] = Array.from({ length: 10 }, (_, i) => uuid(i + 1));
const readerOnly = uuid(70);
const [otherUser, otherDentist, otherMember, otherBudget, otherPatient] = [uuid(30), uuid(31), uuid(32), uuid(33), uuid(34)];
try {
  await db.exec(`
    create role anon; create role authenticated; create schema private; create schema auth; create schema extensions;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
    -- Hash determinístico da fixture; a extensão SHA256 de produção não é alvo deste teste.
    create function extensions.digest(text,text) returns bytea language sql immutable as $$ select decode(md5($1),'hex') $$;
    create table clinicas(id uuid primary key);
    create table users(id uuid primary key, active_clinica_id uuid);
    create table clinica_usuarios(id uuid primary key,clinica_id uuid,usuario_id uuid,role text,status text);
    create table clinica_governanca(clinica_id uuid primary key,modelo_clinica text,responsavel_usuario_id uuid);
    create table clinica_acessos(id uuid primary key default gen_random_uuid(),clinica_id uuid,membro_id uuid);
    create table dentistas(id uuid primary key,clinica_id uuid,user_id uuid,nome text,role text,ativo boolean);
    create table pacientes(id uuid primary key,clinica_id uuid,nome text);
    create table orcamentos(id uuid primary key,clinica_id uuid,dentista_id uuid,paciente_id uuid,titular_recebimento text default 'clinica',valor_acordado numeric,desconto numeric);
    create table orcamento_itens(id uuid primary key default gen_random_uuid(),clinica_id uuid,orcamento_id uuid,preco_total numeric,aprovado boolean,retirado_em timestamptz);
    create table orcamento_cobrancas(id uuid primary key,clinica_id uuid,orcamento_id uuid,paciente_id uuid,dentista_id uuid,situacao text,valor_final numeric,desconto numeric);
    create table pagamentos(id uuid primary key default gen_random_uuid(),clinica_id uuid,orcamento_id uuid,cobranca_id uuid,paciente_id uuid,dentista_id uuid,valor numeric,status text,forma_pagamento text,data_pagamento date,marcado_por_id uuid,observacoes text,titular_recebimento text default 'clinica',created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp());
    create view orcamentos_com_estado as
      select o.*,coalesce(aprovados.valor,0) valor_aprovado,coalesce(pagos.valor,0) valor_pago,devido.valor valor_devido,
        case when coalesce(aprovados.valor,0)=0 then 'proposto' when coalesce(pagos.valor,0)<devido.valor then 'aceito' else 'quitado' end estado
      from orcamentos o
      left join lateral (select sum(i.preco_total) valor from orcamento_itens i where i.orcamento_id=o.id and i.clinica_id=o.clinica_id and i.aprovado and i.retirado_em is null) aprovados on true
      left join lateral (select sum(p.valor) valor from pagamentos p where p.orcamento_id=o.id and p.clinica_id=o.clinica_id and p.status='pago') pagos on true
      left join lateral (select count(*) quantidade,sum(c.desconto) desconto from orcamento_cobrancas c where c.orcamento_id=o.id and c.clinica_id=o.clinica_id and c.situacao='aberta') etapas on true
      cross join lateral (select coalesce(o.valor_acordado,greatest(0,coalesce(aprovados.valor,0)-case when etapas.quantidade>0 then coalesce(etapas.desconto,0) else coalesce(o.desconto,0) end)) valor) devido;
    create function private.touch_payment() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end; $$;
    create trigger touch before update on pagamentos for each row execute function private.touch_payment();
    create table activity_logs(id uuid primary key default gen_random_uuid(),clinica_id uuid,actor_id uuid,actor_nome text,paciente_id uuid,entity_type text,entity_id text,action text,metadata jsonb);
    create function public.get_my_clinica_id() returns uuid language sql stable as $$ select active_clinica_id from users where id=auth.uid() $$;
    create function public.get_my_dentista_id() returns uuid language sql stable as $$ select id from dentistas where user_id=auth.uid() $$;
    create function public.can_act_as_dentista(uuid) returns boolean language sql stable as $$ select false $$;
    create function public.recompor_previsao_cobranca(uuid,uuid,uuid) returns void language sql as $$ select $$;
    create table test_grants(actor uuid,clinica uuid,dentista uuid,permission text);
    -- A integração R159c tem fixture própria; aqui exercitamos consumo da capacidade.
    create function private.membro_tem_permissao_operacional(uuid,text,uuid default null) returns boolean language sql stable as $$
      select exists(select 1 from test_grants where actor=auth.uid() and clinica=$1 and permission=$2 and dentista=$3)
    $$;
    insert into clinicas values ('${clinic}'),('${other}');
    insert into users values ('${owner}','${clinic}'),('${dentistUser}','${clinic}'),('${secretary}','${clinic}'),('${readerOnly}','${clinic}'),('${otherUser}','${other}');
    insert into clinica_usuarios values ('${member}','${clinic}','${owner}','gestor','ativo'),('${uuid(20)}','${clinic}','${dentistUser}','dentista','ativo'),('${uuid(21)}','${clinic}','${secretary}','secretaria','ativo'),('${uuid(22)}','${clinic}','${readerOnly}','secretaria','ativo'),('${otherMember}','${other}','${otherUser}','secretaria','ativo');
    insert into clinica_governanca values ('${clinic}','gerida','${owner}'),('${other}','colaborativa',null);
    insert into dentistas values ('${dentist}','${clinic}','${dentistUser}','Dra QA','dentista',true),('${otherDentist}','${other}','${uuid(35)}','Dr Outro','dentista',true);
    insert into pacientes values ('${patient}','${clinic}','Paciente QA'),('${otherPatient}','${other}','Paciente Fora');
    insert into orcamentos values ('${budget}','${clinic}','${dentist}','${patient}','clinica',800),('${otherBudget}','${other}','${otherDentist}','${otherPatient}','clinica',320);
    insert into orcamento_itens(clinica_id,orcamento_id,preco_total,aprovado) values ('${clinic}','${budget}',1000,true);
    insert into orcamento_itens(clinica_id,orcamento_id,preco_total,aprovado) values ('${other}','${otherBudget}',320,true);
    insert into orcamento_cobrancas values ('${charge}','${clinic}','${budget}','${patient}','${dentist}','aberta',500,0);
    insert into pagamentos(clinica_id,orcamento_id,paciente_id,dentista_id,valor,status,forma_pagamento,data_pagamento)
      values ('${other}','${otherBudget}','${otherPatient}','${otherDentist}',20,'pago','pix','2026-09-15');
    select set_config('test.actor','${owner}',false);
  `);
  await db.exec(await readFile(new URL('./fixtures/r163c-financial-rpcs-baseline.sql', import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20260916010847_r163c_operacoes_financeiras_capacidades.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20260916013140_r163c_leitor_recebimentos_operacional.sql',import.meta.url),'utf8'));
  const leitorEstavel = (await db.query("select pg_get_functiondef('public.listar_recebimentos_operacionais(uuid,integer,integer)'::regprocedure) definicao")).rows[0].definicao;
  assert.match(leitorEstavel, /STABLE/);
  await db.exec('begin read only');
  await assert.rejects(
    db.query('select public.listar_recebimentos_operacionais($1,$2,$3)', [clinic, 25, 0]),
    /read-only transaction/,
  );
  await db.exec('rollback');
  await db.exec(await readFile(new URL('../../supabase/migrations/20260916020500_r163c_leitor_recebimentos_canonico.sql',import.meta.url),'utf8'));
  const leitorVolatil = (await db.query("select pg_get_functiondef('public.listar_recebimentos_operacionais(uuid,integer,integer)'::regprocedure) definicao")).rows[0].definicao;
  assert.doesNotMatch(leitorVolatil, /STABLE/);
  for (const signature of [
    'registrar_recebimento_orcamento(uuid,numeric,text,date)',
    'registrar_recebimento_cobranca(uuid,numeric,text,date)',
    'confirmar_previsao_orcamento(uuid,text,date)',
    'corrigir_recebimento_orcamento(uuid,numeric,text,date)',
    'estornar_recebimento_orcamento(uuid,text)',
  ]) {
    const legacy=(await db.query('select pg_get_functiondef(($1)::regprocedure) definition',[`public.${signature}`])).rows[0].definition;
    const clone=(await db.query('select pg_get_functiondef(($1)::regprocedure) definition',[`private.r163c_${signature}`])).rows[0].definition;
    assert.match(legacy,/public\.get_my_clinica_id\(\)/);
    assert.match(legacy,/public\.can_act_as_dentista\(/);
    assert.match(clone,/private\.financeiro_clinica_ativa\(\)/);
    assert.match(clone,/private\.financeiro_pode_operar\(/);
  }
  await db.exec('set role authenticated');
  await assert.rejects(
    db.query('select private.r163c_registrar_recebimento_orcamento($1,$2,$3,$4)',[budget,1,'pix','2026-09-15']),
    /permission denied/,
  );
  const publicEnvelope=(await db.query(
    'select public.operar_recebimento_clinica($1,$2,$3::jsonb,$4) r',
    [other,'registrar','{}',uuid(87)],
  )).rows[0].r;
  assert.equal(publicEnvelope.codigo,'CONTEXTO_ALTERADO');
  await db.exec('reset role');
  const call = async (action, payload, key=uuid(100), expected=clinic) => (await db.query('select public.operar_recebimento_clinica($1,$2,$3::jsonb,$4) r',[expected,action,JSON.stringify(payload),key])).rows[0].r;
  const sum = async () => (await db.query("select trim_scale(coalesce(sum(valor),0))::text total from pagamentos where clinica_id=$1 and status='pago'", [clinic])).rows[0].total;
  const actor = async (id) => db.query("select set_config('test.actor',$1,false)",[id]);
  const payload = {orcamentoId:budget,valorCentavos:25000,formaPagamento:'pix',data:'2026-09-15'};
  assert.equal((await call('registrar',{...payload,formaPagamento:'forjada'},uuid(88))).codigo,'INVALIDO');
  assert.equal((await call('registrar',{...payload,data:'2026-02-30'},uuid(89))).codigo,'INVALIDO');
  const chargePayment=await call('registrar',{cobrancaId:charge,valorCentavos:10000,formaPagamento:'pix',data:'2026-09-15'},uuid(90));
  assert.equal(chargePayment.ok,true,JSON.stringify(chargePayment));
  assert.equal(await sum(),'100');
  const first=await call('registrar',payload);
  assert.equal(first.ok,true,JSON.stringify(first));
  assert.equal(await sum(),'350');
  const logs=(await db.query('select actor_id,metadata from activity_logs')).rows;
  assert.equal(logs[0].actor_id,null);
  assert.equal(logs[0].metadata.ator_usuario_id,owner);
  assert.deepEqual(await call('registrar',payload),first);
  assert.equal(await sum(),'350');
  assert.equal((await call('registrar',{...payload,valorCentavos:1000})).codigo,'CONFLITO');
  assert.equal((await call('registrar',payload,uuid(101),other)).codigo,'CONTEXTO_ALTERADO');
  assert.equal((await call('registrar',{...payload,valorCentavos:60000},uuid(102))).codigo,'SALDO_EXCEDIDO');
  assert.equal(await sum(),'350'); // R169 valor devido 800, não soma bruta 1000.
  await actor(secretary);
  assert.equal((await call('registrar',payload,uuid(103))).codigo,'SEM_ACESSO');
  await db.exec(`insert into test_grants values ('${secretary}','${clinic}','${dentist}','recebimentos.registrar'),('${secretary}','${clinic}','${dentist}','cobrancas.ler')`);
  assert.equal((await call('registrar',{...payload,valorCentavos:1000},uuid(104))).ok,true);
  const listar = async (clinicaId, limite = 25, offset = 0) => (await db.query('select public.listar_recebimentos_operacionais($1,$2,$3) recebimentos', [clinicaId, limite, offset])).rows[0].recebimentos;
  const recebimentosSecretaria = await listar(clinic);
  assert.equal(recebimentosSecretaria.itens.length, 1);
  assert.equal(recebimentosSecretaria.proximoOffset, null);
  assert.equal(recebimentosSecretaria.itens[0].pacienteNome, 'Paciente QA');
  assert.equal(recebimentosSecretaria.itens[0].saldoCentavos, 44000);
  assert.deepEqual(recebimentosSecretaria.itens[0].capacidades, { podeRegistrar: true, podeConfirmar: true, podeCorrigir: false, podeEstornar: false });
  assert.equal(recebimentosSecretaria.itens[0].pagamentos.every((pagamento) => !Object.hasOwn(pagamento, 'prontuario')), true);
  await actor(otherUser);
  await db.exec(`insert into test_grants values ('${otherUser}','${other}','${otherDentist}','cobrancas.ler')`);
  const recebimentosOutraClinica = await listar(other);
  assert.equal(recebimentosOutraClinica.itens.length, 1);
  assert.equal(recebimentosOutraClinica.itens[0].pacienteNome, 'Paciente Fora');
  assert.deepEqual((await listar(clinic)).itens, []);
  await actor(secretary);
  assert.deepEqual((await listar(other)).itens, []);
  await actor(readerOnly);
  await db.exec(`insert into test_grants values ('${readerOnly}','${clinic}','${dentist}','cobrancas.ler')`);
  const pagamentosAntesLeitura = (await db.query('select count(*)::int total from pagamentos where clinica_id=$1', [clinic])).rows[0].total;
  const leitorSemEscrita = await listar(clinic);
  assert.equal(leitorSemEscrita.itens.length, 1);
  assert.deepEqual(leitorSemEscrita.itens[0].capacidades, { podeRegistrar: false, podeConfirmar: false, podeCorrigir: false, podeEstornar: false });
  assert.equal((await call('registrar',{...payload,valorCentavos:100},uuid(112))).codigo,'SEM_ACESSO');
  assert.equal((await db.query('select count(*)::int total from pagamentos where clinica_id=$1', [clinic])).rows[0].total,pagamentosAntesLeitura);
  await actor(secretary);
  await db.exec(`insert into pacientes values ('${uuid(60)}','${clinic}','Paciente Página'); insert into orcamentos values ('${uuid(61)}','${clinic}','${dentist}','${uuid(60)}','clinica',120); insert into orcamento_itens(clinica_id,orcamento_id,preco_total,aprovado) values ('${clinic}','${uuid(61)}',120,true)`);
  const primeiraPagina = await listar(clinic, 1);
  assert.equal(primeiraPagina.itens.length, 1);
  assert.equal(primeiraPagina.proximoOffset, 1);
  const segundaPagina = await listar(clinic, 1, primeiraPagina.proximoOffset);
  assert.equal(segundaPagina.itens.length, 1);
  assert.equal(segundaPagina.proximoOffset, null);
  await db.exec(`
    insert into pacientes values ('${uuid(62)}','${clinic}','Rascunho'),('${uuid(63)}','${clinic}','Retirado'),('${uuid(64)}','${clinic}','Desconto');
    insert into orcamentos values ('${uuid(65)}','${clinic}','${dentist}','${uuid(62)}','clinica',null),('${uuid(66)}','${clinic}','${dentist}','${uuid(63)}','clinica',null),('${uuid(67)}','${clinic}','${dentist}','${uuid(64)}','clinica',null);
    insert into orcamento_itens(clinica_id,orcamento_id,preco_total,aprovado,retirado_em) values ('${clinic}','${uuid(66)}',500,true,clock_timestamp()),('${clinic}','${uuid(67)}',1000,true,null);
    insert into orcamento_cobrancas values ('${uuid(68)}','${clinic}','${uuid(67)}','${uuid(64)}','${dentist}','aberta',900,100);
  `);
  const leitorCanonico = await listar(clinic, 25);
  const comDesconto = leitorCanonico.itens.find((item) => item.orcamentoId === uuid(67));
  assert.equal(comDesconto?.devidoCentavos,90000);
  assert.equal(comDesconto?.saldoCentavos,90000);
  assert.equal(leitorCanonico.itens.some((item) => item.orcamentoId === uuid(65) || item.orcamentoId === uuid(66)),false);
  const correction={pagamentoId:first.data.pagamentoId,atualizadoEm:first.data.atualizadoEm,valorCentavos:20000,formaPagamento:'dinheiro',data:'2026-09-15'};
  assert.equal((await call('corrigir',correction,uuid(105))).codigo,'SEM_ACESSO');
  await actor(owner);
  const corrected=await call('corrigir',correction,uuid(106));
  assert.equal(corrected.ok,true,JSON.stringify(corrected));
  assert.equal((await call('corrigir',correction,uuid(107))).codigo,'CONFLITO');
  assert.equal(await sum(),'310');
  const reverted=await call('estornar',{pagamentoId:first.data.pagamentoId,atualizadoEm:corrected.data.atualizadoEm,motivo:'Correção QA'},uuid(108));
  assert.equal(reverted.ok,true,JSON.stringify(reverted));
  assert.equal(await sum(),'110');
  const forecastId=uuid(91);
  await db.query(`insert into pagamentos(id,clinica_id,orcamento_id,paciente_id,dentista_id,valor,status)
    values($1,$2,$3,$4,$5,50,'pendente')`,[forecastId,clinic,budget,patient,dentist]);
  const forecast=(await db.query('select updated_at from pagamentos where id=$1',[forecastId])).rows[0];
  const confirmed=await call('confirmar',{pagamentoId:forecastId,atualizadoEm:forecast.updated_at,formaPagamento:'boleto',data:'2026-09-15'},uuid(92));
  assert.equal(confirmed.ok,true,JSON.stringify(confirmed));
  assert.equal(await sum(),'160');
  assert.deepEqual(await call('confirmar',{pagamentoId:forecastId,atualizadoEm:forecast.updated_at,formaPagamento:'boleto',data:'2026-09-15'},uuid(92)),confirmed);
  assert.equal((await call('confirmar',{pagamentoId:forecastId,atualizadoEm:forecast.updated_at,formaPagamento:'boleto',data:'2026-09-15'},uuid(93))).codigo,'CONFLITO');
  const [rivalA,rivalB]=await Promise.all([
    call('registrar',{...payload,valorCentavos:50000},uuid(94)),
    call('registrar',{...payload,valorCentavos:50000},uuid(95)),
  ]);
  assert.deepEqual([rivalA.ok,rivalB.ok].sort(),[false,true]);
  assert.equal(await sum(),'660'); // O saldo restante era 640; só uma requisição concorrente entra.
  await db.exec(`create function private.fail_audit() returns trigger language plpgsql as $$ begin raise exception 'private test failure'; end; $$; create trigger fail before insert on activity_logs for each row execute function private.fail_audit();`);
  const countBefore=(await db.query('select count(*) n from financeiro_operacoes_clinica')).rows[0].n;
  assert.equal((await call('registrar',{...payload,valorCentavos:10000},uuid(109))).codigo,'INDISPONIVEL');
  assert.equal(await sum(),'660');
  assert.equal((await db.query('select count(*) n from financeiro_operacoes_clinica')).rows[0].n,countBefore);
  await db.exec('drop trigger fail on activity_logs');
  assert.equal((await call('registrar',{...payload,valorCentavos:1000},uuid(109))).ok,true);
  await db.exec(`update clinica_usuarios set status='suspenso' where usuario_id='${owner}'`);
  assert.equal((await call('registrar',payload,uuid(109))).codigo,'SEM_ACESSO'); // Retry revalida revogação.
  await actor(dentistUser);
  assert.equal((await call('registrar',{...payload,valorCentavos:100},uuid(110))).ok,true);
  await db.exec(`update clinica_usuarios set role='secretaria' where usuario_id='${dentistUser}'`);
  assert.equal((await call('registrar',payload,uuid(111))).codigo,'SEM_ACESSO'); // Perfil clínico antigo não restaura poder.
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from financeiro_operacoes_clinica'),/permission denied/);
  await db.exec('reset role');
  console.log('R163c: autorização, isolamento, cobrança, previsão, centavos/saldo, idempotência, CAS, corrida de saldo e rollback passaram.');
} finally { await db.close(); }
