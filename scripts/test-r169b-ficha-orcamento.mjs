/** SQL real em Postgres/WASM isolado; não acessa Supabase nem altera clínicas.
 * R169_PGLITE=/caminho/pglite/dist/index.js node scripts/test-r169b-ficha-orcamento.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.R169_PGLITE) throw new Error('Informe R169_PGLITE (runtime temporário, fora das dependências do app).');
const { PGlite } = await import(pathToFileURL(process.env.R169_PGLITE).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const clinic = id(1), actor = id(2), patient = id(3), ficha = id(4), orcamento = id(5);
const eventoA = id(6), eventoB = id(7), item = id(8), cobranca = id(9);

await db.exec(`
  create role authenticated; create role anon;
  create table dentistas(id uuid primary key, clinica_id uuid not null, nome text not null);
  create table fichas(id uuid primary key, clinica_id uuid not null, paciente_id uuid not null, dentista_id uuid,
    assinado_em timestamptz, dentes_afetados integer[], dentes_observacoes jsonb, procedimentos text[], status text, updated_at timestamptz);
  create table odontograma_eventos(id uuid primary key, clinica_id uuid not null, paciente_id uuid not null, dentista_id uuid,
    ficha_id uuid not null, assinatura_id uuid, procedimento_nome text, tipo text not null, observacao text, dente integer,
    status text not null, origem text not null, nivel text default 'dente', arcada text, quadrante smallint, created_at timestamptz default now());
  create table procedimentos(id uuid primary key, clinica_id uuid not null);
  create table orcamentos(id uuid primary key, clinica_id uuid not null, ficha_id uuid, paciente_id uuid not null, dentista_id uuid,
    total numeric, valor_acordado numeric, desconto numeric default 0, updated_at timestamptz);
  create table orcamento_itens(id uuid primary key, clinica_id uuid not null, orcamento_id uuid not null, descricao text,
    procedimento_id uuid, quantidade integer, preco_unitario numeric, preco_total numeric, aprovado boolean default false);
  create table orcamento_eventos(clinica_id uuid not null, orcamento_id uuid not null, evento_id uuid not null unique);
  create table pagamentos(id uuid primary key, clinica_id uuid not null, orcamento_id uuid not null, valor numeric, status text);
  create table orcamento_cobrancas(id uuid primary key, clinica_id uuid not null, orcamento_id uuid not null, situacao text, desconto numeric default 0);
  create table activity_logs(id uuid default gen_random_uuid(), clinica_id uuid, actor_id uuid, actor_nome text, paciente_id uuid, entity_type text, entity_id text, action text, metadata jsonb);
  create function get_my_clinica_id() returns uuid language sql as $$ select current_setting('qa.clinic')::uuid $$;
  create function get_my_dentista_id() returns uuid language sql as $$ select current_setting('qa.actor')::uuid $$;
  create function get_my_role() returns text language sql as $$ select current_setting('qa.role') $$;
  create function can_act_as_dentista(uuid) returns boolean language sql as $$ select true $$;
  create function criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date,text) returns void language plpgsql as $$
  declare v_clinica_id uuid := public.get_my_clinica_id();
  begin
    perform oi.id from public.orcamento_itens oi where oi.id = $2[1] and oi.orcamento_id = $1 and oi.clinica_id = v_clinica_id for update;
  end;
  $$;
  create function editar_cobranca_orcamento(uuid,uuid[],numeric) returns void language plpgsql as $$
  declare v_clinica_id uuid := public.get_my_clinica_id();
  begin
    perform oi.id from public.orcamento_itens oi where oi.id = $2[1] and oi.orcamento_id = $1 and oi.clinica_id = v_clinica_id order by oi.id;
  end;
  $$;
  create function reorganizar_parcelas_orcamento(uuid,numeric,jsonb) returns void language plpgsql as $$
  declare v_clinica_id uuid := public.get_my_clinica_id(); v_orc public.orcamentos%rowtype;
  begin
    select * into v_orc from public.orcamentos where id = $1;
    perform oi.id from public.orcamento_itens oi where oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id;
  end;
  $$;
  insert into dentistas values ('${actor}','${clinic}','Autor QA');
  insert into fichas values ('${ficha}','${clinic}','${patient}','${actor}',null,array[11,12],'{}',array['Antigo'],'aberta',now());
  insert into orcamentos values ('${orcamento}','${clinic}','${ficha}','${patient}','${actor}',300,null,0,'2026-09-14T00:00:00Z');
  insert into orcamento_itens(id,clinica_id,orcamento_id,descricao,quantidade,preco_unitario,preco_total,aprovado)
    values ('${item}','${clinic}','${orcamento}','Dois procedimentos',2,150,300,true);
  insert into odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,procedimento_nome,tipo,observacao,dente,status,origem)
    values ('${eventoA}','${clinic}','${patient}','${actor}','${ficha}','Procedimento A','outro',null,11,'indicado','clinica'),
           ('${eventoB}','${clinic}','${patient}','${actor}','${ficha}','Procedimento B','outro',null,12,'realizado','clinica');
  insert into orcamento_eventos values ('${clinic}','${orcamento}','${eventoA}'), ('${clinic}','${orcamento}','${eventoB}');
  select set_config('qa.clinic','${clinic}',false), set_config('qa.actor','${actor}',false), set_config('qa.role','dentista',false);
`);
try {
  await db.exec(await readFile(new URL('../supabase/migrations/20260914210240_r169b_ficha_orcamento_incremental.sql', import.meta.url), 'utf8'));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  throw error;
}

let passed = 0;
async function check(label, fn) {
  try { await fn(); } catch (error) { console.error(error instanceof Error ? error.message : error); throw error; }
  passed++; console.log(`PASS ${label}`);
}

await check('retirada clínica rederiva ficha e registra histórico na mesma transação', async () => {
  await db.query('select retirar_evento_ficha_orcamento($1)', [eventoB]);
  const event = (await db.query('select retirado_em from odontograma_eventos where id=$1', [eventoB])).rows[0];
  const row = (await db.query('select dentes_afetados, procedimentos, status from fichas where id=$1', [ficha])).rows[0];
  assert.ok(event.retirado_em);
  assert.deepEqual(row.dentes_afetados, [11]);
  assert.deepEqual(row.procedimentos, ['Procedimento A']);
  assert.equal(row.status, 'aberta');
  assert.equal((await db.query("select count(*)::int as n from activity_logs where action='odontograma_evento.retirado'")).rows[0].n, 1);
});

await check('nome e dispensa comercial são decisões auditáveis, sem mexer em valores', async () => {
  const alteracao = id(11);
  await db.query("insert into activity_logs(id,clinica_id,actor_id,actor_nome,paciente_id,entity_type,entity_id,action,metadata) values($1,$2,$3,'Autor QA',$4,'odontograma_evento',$5,'odontograma_evento.detalhe_alterado',$6)", [
    alteracao, clinic, actor, patient, eventoA, { nome_alterado: true, nome_atual: 'Procedimento A atualizado' },
  ]);
  await db.query('update odontograma_eventos set procedimento_nome=$1 where id=$2', ['Procedimento A atualizado', eventoA]);
  await assert.rejects(
    db.query('insert into orcamento_eventos(clinica_id,orcamento_id,evento_id) values($1,$2,$3)', [clinic, orcamento, eventoA]),
    /duplicate key/,
  );
  await db.query('select vincular_eventos_legados_item_orcamento($1,$2,$3)', [orcamento, item, [eventoA, eventoB]]);
  assert.equal((await db.query('select count(*)::int as n from orcamento_eventos where item_id=$1', [item])).rows[0].n, 2);
  await assert.rejects(
    db.query('select resolver_renomeacao_item_orcamento($1,$2,$3,$4,$5,false)', [orcamento, eventoA, item, alteracao, 'Procedimento A atualizado']),
    /item_agrupado/,
  );
  await db.query('select resolver_renomeacao_item_orcamento($1,$2,$3,$4,$5,true)', [orcamento, eventoA, item, alteracao, 'Procedimento A atualizado']);
  assert.equal((await db.query('select descricao from orcamento_itens where id=$1', [item])).rows[0].descricao, 'Dois procedimentos');
  const retirada = (await db.query("select id from activity_logs where action='odontograma_evento.retirado' limit 1")).rows[0].id;
  await db.query('select dispensar_retirada_orcamento($1,$2,$3)', [orcamento, eventoB, retirada]);
  assert.equal((await db.query("select count(*)::int as n from activity_logs where action='orcamento_evento.retirada_dispensada'")).rows[0].n, 1);
  assert.equal(Number((await db.query('select preco_total from orcamento_itens where id=$1', [item])).rows[0].preco_total), 300);
});

await check('retirada comercial exige todos os eventos associados ao item', async () => {
  await assert.rejects(
    db.query('select retirar_itens_orcamento_da_ficha($1,$2,$3,$4,false)', [orcamento, item, [eventoA], '2026-09-14T00:00:00Z']),
    /revisar_cobranca/,
  );
  assert.equal((await db.query('select retirado_em from orcamento_itens where id=$1', [item])).rows[0].retirado_em, null);
});

await check('prévia financeira não muda item, total, cobrança ou recebimento', async () => {
  await db.query("insert into pagamentos values($1,$2,$3,100,'pago')", [id(10), clinic, orcamento]);
  await db.query("insert into orcamento_cobrancas values($1,$2,$3,'aberta',0)", [cobranca, clinic, orcamento]);
  const preview = (await db.query('select retirar_itens_orcamento_da_ficha($1,$2,$3,$4,false) as result', [orcamento, item, [eventoA, eventoB], '2026-09-14T00:00:00Z'])).rows[0].result;
  assert.equal(preview.status, 'revisar_cobranca');
  assert.equal(preview.total_antes, 300);
  assert.equal(preview.total_depois, 0);
  assert.equal(preview.devido_antes, 300);
  assert.equal(preview.devido_depois, 0);
  assert.equal(preview.recebido, 100);
  assert.equal(preview.motivo, 'valor_abaixo_recebido');
  assert.equal((await db.query('select retirado_em from orcamento_itens where id=$1', [item])).rows[0].retirado_em, null);
  assert.equal(Number((await db.query('select total from orcamentos where id=$1', [orcamento])).rows[0].total), 300);
  assert.equal((await db.query("select count(*)::int as n from pagamentos where status='pago'")).rows[0].n, 1);
});

await check('recebido acima do novo devido exige correção antes da retirada', async () => {
  const result = (await db.query('select retirar_itens_orcamento_da_ficha($1,$2,$3,$4,true) as result', [orcamento, item, [eventoA, eventoB], '2026-09-14T00:00:00Z'])).rows[0].result;
  assert.equal(result.status, 'revisar_cobranca');
  assert.equal(result.motivo, 'valor_abaixo_recebido');
  assert.equal((await db.query('select retirado_em from orcamento_itens where id=$1', [item])).rows[0].retirado_em, null);
  assert.equal((await db.query("select count(*)::int as n from pagamentos where status='pago'")).rows[0].n, 1);
  assert.equal((await db.query('select situacao from orcamento_cobrancas where id=$1', [cobranca])).rows[0].situacao, 'aberta');
});

await check('após correção financeira, retirada comercial preserva o registro cancelado', async () => {
  await db.query("update pagamentos set status='cancelado' where orcamento_id=$1", [orcamento]);
  await db.query("update orcamento_cobrancas set situacao='cancelada' where id=$1", [cobranca]);
  const result = (await db.query('select retirar_itens_orcamento_da_ficha($1,$2,$3,$4,true) as result', [orcamento, item, [eventoA, eventoB], '2026-09-14T00:00:00Z'])).rows[0].result;
  assert.equal(result.status, 'ok');
  assert.ok((await db.query('select retirado_em from orcamento_itens where id=$1', [item])).rows[0].retirado_em);
  assert.equal(Number((await db.query('select total from orcamentos where id=$1', [orcamento])).rows[0].total), 0);
  assert.equal((await db.query("select count(*)::int as n from pagamentos where status='cancelado'")).rows[0].n, 1);
});

await check('rollback recusa apagar a API quando já existe histórico R169b', async () => {
  await assert.rejects(
    db.exec(await readFile(new URL('../supabase/rollbacks/20260914210240_r169b_ficha_orcamento_incremental.sql', import.meta.url), 'utf8')),
    /r169b_historico_preservado_rollback_recusado/,
  );
});

console.log(`${passed} checks passaram. Modelo isolado; não substitui o teste manual autenticado no preview.`);
await db.close();
