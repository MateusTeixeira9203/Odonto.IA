/** Isolated PostgreSQL/WASM gate for the financial migration candidates. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';


test('test-r184-r189-r194-db: PostgreSQL/WASM isolado', {
  skip: !process.env.ODONTO_PGLITE ? 'OD016-T7: ODONTO_PGLITE ausente (runtime PGlite externo); dono: ALFA - Orquestrador' : false,
}, async () => {
const { PGlite } = await import(pathToFileURL(process.env.ODONTO_PGLITE).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [clinic, otherClinic, dentistUser, secretaryUser, outsiderUser, dentist, secretary, patient] =
  [1, 2, 3, 4, 5, 6, 7, 8].map(id);
const sql = async name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const rows = async (query, params = []) => (await db.query(query, params)).rows;
const as = async user => db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
let checks = 0;
async function check(label, fn) {
  await fn();
  checks++;
  console.log(`PASS ${label}`);
}
async function count(table, where = '') {
  return Number((await rows(`select count(*) as n from ${table} ${where}`))[0].n);
}
async function budget(n, due, approved = due) {
  const b = id(n);
  await db.query('insert into orcamentos(id,clinica_id,paciente_id,dentista_id,total) values($1,$2,$3,$4,$5)', [b, clinic, patient, dentist, due]);
  await db.query('insert into orcamento_itens(orcamento_id,clinica_id,preco_total,aprovado) values($1,$2,$3,true)', [b, clinic, approved]);
  return b;
}

await db.exec(`
create schema auth;
create role anon;
create role authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table users(id uuid primary key, active_clinica_id uuid);
create table clinica_usuarios(usuario_id uuid, clinica_id uuid, role text, status text);
create table dentistas(id uuid primary key, user_id uuid, clinica_id uuid, role text, ativo boolean, nome text);
create table pacientes(id uuid primary key, clinica_id uuid, nome text);
create table orcamentos(
 id uuid primary key, clinica_id uuid, paciente_id uuid, dentista_id uuid,
 plano_forma text, total numeric, desconto numeric, valor_acordado numeric, plano_parcelas smallint,
 plano_entrada_valor numeric, plano_entrada_forma text, plano_parcelas_forma text,
 plano_definido_em timestamptz, plano_definido_por_id uuid
);
create table orcamento_itens(orcamento_id uuid, clinica_id uuid, preco_total numeric, aprovado boolean, retirado_em timestamptz);
create table orcamento_cobrancas(orcamento_id uuid, clinica_id uuid, situacao text, desconto numeric);
create table pagamentos(
 id uuid primary key default gen_random_uuid(), clinica_id uuid, orcamento_id uuid,
 paciente_id uuid, dentista_id uuid, valor numeric, status text,
 data_vencimento date, parcela_numero smallint, total_parcelas smallint,
 forma_pagamento text, data_pagamento date, marcado_por_id uuid,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
create table activity_logs(
 clinica_id uuid, actor_id uuid, actor_nome text, paciente_id uuid,
 entity_type text, entity_id text, action text, metadata jsonb
);
create table notificacoes(
 clinica_id uuid, para_role text, para_dentista_id uuid, de_dentista_id uuid,
 tipo text, titulo text, mensagem text, href text
);
create view orcamentos_com_estado with (security_invoker = true) as
select o.*,
  coalesce(ai.soma_aprovada, 0) as valor_aprovado,
  coalesce(pg.total_pago, 0) as valor_pago,
  devido.valor as valor_devido,
  case
    when coalesce(ai.soma_aprovada, 0) = 0 then 'proposto'
    when coalesce(pg.total_pago, 0) < devido.valor then 'aceito'
    else 'quitado'
  end as estado
from orcamentos o
left join lateral (
  select sum(oi.preco_total) as soma_aprovada
  from orcamento_itens oi
  where oi.orcamento_id = o.id and oi.clinica_id = o.clinica_id and oi.aprovado and oi.retirado_em is null
) ai on true
left join lateral (
  select sum(p.valor) as total_pago
  from pagamentos p
  where p.orcamento_id = o.id and p.clinica_id = o.clinica_id and p.status = 'pago'
) pg on true
left join lateral (
  select count(*) as quantidade, sum(c.desconto) as desconto
  from orcamento_cobrancas c
  where c.orcamento_id = o.id and c.clinica_id = o.clinica_id and c.situacao = 'aberta'
) etapas on true
cross join lateral (
  select coalesce(o.valor_acordado,
    greatest(0, coalesce(ai.soma_aprovada, 0) - case when etapas.quantidade > 0
      then coalesce(etapas.desconto, 0) else coalesce(o.desconto, 0) end)) as valor
) devido;
`);
await db.query('insert into users values($1,$2),($3,$2),($4,$5)', [dentistUser, clinic, secretaryUser, outsiderUser, otherClinic]);
await db.query("insert into clinica_usuarios values($1,$3,'dentista','ativo'),($2,$3,'secretaria','ativo')", [dentistUser, secretaryUser, clinic]);
await db.query("insert into dentistas values($1,$2,$3,'dentista',true,'Doutor QA'),($4,$5,$3,'secretaria',true,'Secretária QA')", [dentist, dentistUser, clinic, secretary, secretaryUser]);
await db.query('insert into pacientes values($1,$2,$3)', [patient, clinic, 'Paciente QA']);
await as(dentistUser);
await db.exec(await sql('20261011210438_r188_guardar_autorizacao_gerar_parcelas.sql'));
const fingerprint = (await rows("select md5(pg_get_functiondef('public.gerar_parcelas_orcamento(uuid,smallint,date,numeric,numeric,text,text)'::regprocedure)) as md5"))[0].md5;
console.log(`R188 fingerprint in local PostgreSQL: ${fingerprint}`);
await db.exec(await sql('20261012034818_r184_previsao_aprovacao_parcial.sql'));
await db.exec(await sql('20261012034837_r189_recebimento_idempotente.sql'));
await db.exec(await sql('20261012034858_r194_confirmacao_parcela_idempotente.sql'));

await check('R184 partial approval freezes only approved value', async () => {
  const b = await budget(20, 500, 200);
  const result = await rows('select valor, status from gerar_parcelas_orcamento($1::uuid,2::smallint,$2::date)', [b, '2026-11-01']);
  assert.deepEqual(result.map(x => Number(x.valor)), [100, 100]);
  assert(result.every(x => x.status === 'pendente'));
  assert.equal(Number((await rows('select valor_acordado from orcamentos where id=$1', [b]))[0].valor_acordado), 200);
});
await check('R184 discount and prior receipt reduce the pending installments', async () => {
  const b = await budget(39, 300, 100);
  await db.query('update orcamentos set desconto=30 where id=$1', [b]);
  await db.query('insert into orcamento_itens(orcamento_id,clinica_id,preco_total,aprovado) values($1,$2,200,false)', [b, clinic]);
  await db.query("insert into pagamentos(clinica_id,orcamento_id,paciente_id,dentista_id,valor,status) values($1,$2,$3,$4,20,'pago')", [clinic, b, patient, dentist]);
  const payments = await rows('select valor from gerar_parcelas_orcamento($1::uuid,2::smallint,$2::date)', [b, '2026-11-01']);
  assert.deepEqual(payments.map(x => Number(x.valor)), [25, 25]);
  assert.equal(Number((await rows('select valor_acordado from orcamentos where id=$1', [b]))[0].valor_acordado), 70);
  assert.equal(Number((await rows('select valor_devido from orcamentos_com_estado where id=$1', [b]))[0].valor_devido), 70);
});
await check('R184 denies another clinic without writing', async () => {
  const b = await budget(21, 100);
  const before = await count('pagamentos');
  await as(outsiderUser);
  await assert.rejects(rows('select * from gerar_parcelas_orcamento($1::uuid,2::smallint,$2::date)', [b, '2026-11-01']), /sem_permissao/);
  assert.equal(await count('pagamentos'), before);
  await as(dentistUser);
});
await check('R189 same key replays once; distinct key is a new receipt', async () => {
  const b = await budget(22, 300);
  const args = [id(30), b, 100, 'pix', '2026-10-12'];
  const first = (await rows('select * from registrar_recebimento_orcamento_idempotente($1::uuid,$2::uuid,$3::numeric,$4::text,$5::date)', args))[0];
  const replay = (await rows('select * from registrar_recebimento_orcamento_idempotente($1::uuid,$2::uuid,$3::numeric,$4::text,$5::date)', args))[0];
  assert.equal(first.pagamento_id, replay.pagamento_id);
  assert.equal(first.repetida, false);
  assert.equal(replay.repetida, true);
  await assert.rejects(rows('select * from registrar_recebimento_orcamento_idempotente($1::uuid,$2::uuid,$3::numeric,$4::text,$5::date)', [id(30), b, 120, 'pix', '2026-10-12']), /chave_idempotencia_reutilizada/);
  const second = (await rows('select * from registrar_recebimento_orcamento_idempotente($1::uuid,$2::uuid,$3::numeric,$4::text,$5::date)', [id(31), b, 100, 'pix', '2026-10-12']))[0];
  assert.notEqual(first.pagamento_id, second.pagamento_id);
  assert.equal(await count('pagamentos', `where orcamento_id='${b}'`), 2);
  assert.equal(await count('activity_logs', `where entity_id='${b}'`), 2);
});
await check('R189 cross-user replay is denied with no extra effect', async () => {
  const b = await budget(23, 200);
  await rows('select * from registrar_recebimento_orcamento_idempotente($1::uuid,$2::uuid,$3::numeric,$4::text,$5::date)', [id(32), b, 50, 'pix', '2026-10-12']);
  await as(secretaryUser);
  await assert.rejects(rows('select * from registrar_recebimento_orcamento_idempotente($1::uuid,$2::uuid,$3::numeric,$4::text,$5::date)', [id(32), b, 50, 'pix', '2026-10-12']), /chave_idempotencia_reutilizada/);
  assert.equal(await count('pagamentos', `where orcamento_id='${b}'`), 1);
  await as(dentistUser);
});
await check('R194 existing prediction wins; retry does not pay next prediction', async () => {
  const b = await budget(24, 200);
  await db.query("insert into pagamentos(clinica_id,orcamento_id,paciente_id,dentista_id,valor,status,data_vencimento,parcela_numero) values($1,$2,$3,$4,100,'pendente','2026-11-01',1),($1,$2,$3,$4,100,'pendente','2026-12-01',2)", [clinic, b, patient, dentist]);
  const args = [id(33), b, 'pix', '2026-10-12'];
  const first = (await rows('select * from registrar_pagamento_rapido_idempotente($1::uuid,$2::uuid,$3::text,$4::date)', args))[0];
  const replay = (await rows('select * from registrar_pagamento_rapido_idempotente($1::uuid,$2::uuid,$3::text,$4::date)', args))[0];
  assert.equal(first.pagamento_id, replay.pagamento_id);
  assert.equal(replay.repetida, true);
  assert.deepEqual((await rows('select status from pagamentos where orcamento_id=$1 order by parcela_numero', [b])).map(x => x.status), ['pago', 'pendente']);
  assert.equal(await count('activity_logs', `where entity_id='${b}'`), 1);
  assert.equal(await count('notificacoes', "where tipo='pagamento_confirmado'"), 0);
});
await check('R194 different key pays next prediction; reused key cannot change payload', async () => {
  const b = id(24);
  await assert.rejects(rows('select * from registrar_pagamento_rapido_idempotente($1::uuid,$2::uuid,$3::text,$4::date)', [id(33), b, 'dinheiro', '2026-10-12']), /chave_idempotencia_reutilizada/);
  assert.deepEqual((await rows('select status from pagamentos where orcamento_id=$1 order by parcela_numero', [b])).map(x => x.status), ['pago', 'pendente']);
  const next = (await rows('select * from registrar_pagamento_rapido_idempotente($1::uuid,$2::uuid,$3::text,$4::date)', [id(44), b, 'pix', '2026-10-12']))[0];
  assert.equal(next.repetida, false);
  assert.deepEqual((await rows('select status from pagamentos where orcamento_id=$1 order by parcela_numero', [b])).map(x => x.status), ['pago', 'pago']);
  assert.equal(await count('activity_logs', `where entity_id='${b}'`), 2);
});
await check('R194 secretary balance sends one notification; replay sends none', async () => {
  const b = await budget(25, 100);
  await as(secretaryUser);
  const args = [id(34), b, 'pix', '2026-10-12'];
  const first = (await rows('select * from registrar_pagamento_rapido_idempotente($1::uuid,$2::uuid,$3::text,$4::date)', args))[0];
  const replay = (await rows('select * from registrar_pagamento_rapido_idempotente($1::uuid,$2::uuid,$3::text,$4::date)', args))[0];
  assert.equal(first.pagamento_id, replay.pagamento_id);
  assert.equal(replay.repetida, true);
  assert.equal(await count('pagamentos', `where orcamento_id='${b}'`), 1);
  assert.equal(await count('activity_logs', `where entity_id='${b}'`), 1);
  assert.equal(await count('notificacoes', "where tipo='pagamento_confirmado'"), 1);
  await as(dentistUser);
});
await check('R194 invalid owner cannot discover or alter payment', async () => {
  const b = await budget(26, 100);
  const before = await count('pagamentos');
  await as(outsiderUser);
  await assert.rejects(rows('select * from registrar_pagamento_rapido_idempotente($1::uuid,$2::uuid,$3::text,$4::date)', [id(35), b, 'pix', '2026-10-12']), /sem_permissao/);
  assert.equal(await count('pagamentos'), before);
});
await as(dentistUser);
await check('R184 rejects no approval and preserves explicit agreement', async () => {
  const noApproval = await budget(27, 300, 0);
  await assert.rejects(rows('select * from gerar_parcelas_orcamento($1::uuid,2::smallint,$2::date)', [noApproval, '2026-11-01']), /orcamento_sem_aprovacao/);
  assert.equal(await count('pagamentos', `where orcamento_id='${noApproval}'`), 0);
  const agreed = await budget(28, 300, 100);
  const payments = await rows('select valor from gerar_parcelas_orcamento($1::uuid,2::smallint,$2::date,$3::numeric)', [agreed, '2026-11-01', 180]);
  assert.deepEqual(payments.map(x => Number(x.valor)), [90, 90]);
});
await check('R189 overpayment rejects without a payment or log', async () => {
  const b = await budget(29, 100);
  await assert.rejects(rows('select * from registrar_recebimento_orcamento_idempotente($1::uuid,$2::uuid,$3::numeric,$4::text,$5::date)', [id(40), b, 120, 'pix', '2026-10-12']), /valor_acima_do_saldo/);
  assert.equal(await count('pagamentos', `where orcamento_id='${b}'`), 0);
  assert.equal(await count('activity_logs', `where entity_id='${b}'`), 0);
});
await check('R189 log failure rolls back receipt and same key can retry', async () => {
  const b = await budget(36, 100);
  const args = [id(41), b, 50, 'pix', '2026-10-12'];
  await db.exec("alter table activity_logs add constraint qa_fail_receipt_log check(action <> 'pagamento.registrado') not valid");
  await assert.rejects(rows('select * from registrar_recebimento_orcamento_idempotente($1::uuid,$2::uuid,$3::numeric,$4::text,$5::date)', args), /qa_fail_receipt_log/);
  assert.equal(await count('pagamentos', `where orcamento_id='${b}'`), 0);
  await db.exec('alter table activity_logs drop constraint qa_fail_receipt_log');
  const result = (await rows('select * from registrar_recebimento_orcamento_idempotente($1::uuid,$2::uuid,$3::numeric,$4::text,$5::date)', args))[0];
  assert.equal(result.repetida, false);
  assert.equal(await count('pagamentos', `where orcamento_id='${b}'`), 1);
});
await check('R194 notification failure is logged and retry stays idempotent', async () => {
  const b = await budget(37, 100);
  await as(secretaryUser);
  const beforeNotifications = await count('notificacoes', "where tipo='pagamento_confirmado'");
  await db.exec("alter table notificacoes add constraint qa_fail_notification check(tipo <> 'pagamento_confirmado') not valid");
  const args = [id(42), b, 'pix', '2026-10-12'];
  const first = (await rows('select * from registrar_pagamento_rapido_idempotente($1::uuid,$2::uuid,$3::text,$4::date)', args))[0];
  await db.exec('alter table notificacoes drop constraint qa_fail_notification');
  const replay = (await rows('select * from registrar_pagamento_rapido_idempotente($1::uuid,$2::uuid,$3::text,$4::date)', args))[0];
  assert.equal(first.pagamento_id, replay.pagamento_id);
  assert.equal(replay.repetida, true);
  assert.equal(await count('notificacoes', "where tipo='pagamento_confirmado'"), beforeNotifications);
  assert.equal((await rows('select metadata->>\'notificacao_pagamento_confirmado\' as status from activity_logs where entity_id=$1', [b]))[0].status, 'falhou');
  assert.equal(await count('activity_logs', `where entity_id='${b}'`), 1);
  await as(dentistUser);
});
await check('R194 log failure rolls back prediction conversion', async () => {
  const b = await budget(38, 100);
  await db.query("insert into pagamentos(clinica_id,orcamento_id,paciente_id,dentista_id,valor,status,data_vencimento) values($1,$2,$3,$4,100,'pendente','2026-11-01')", [clinic, b, patient, dentist]);
  const args = [id(43), b, 'pix', '2026-10-12'];
  await db.exec("alter table activity_logs add constraint qa_fail_quick_log check(action <> 'pagamento.registrado') not valid");
  await assert.rejects(rows('select * from registrar_pagamento_rapido_idempotente($1::uuid,$2::uuid,$3::text,$4::date)', args), /qa_fail_quick_log/);
  assert.equal((await rows('select status from pagamentos where orcamento_id=$1', [b]))[0].status, 'pendente');
  await db.exec('alter table activity_logs drop constraint qa_fail_quick_log');
  const first = (await rows('select * from registrar_pagamento_rapido_idempotente($1::uuid,$2::uuid,$3::text,$4::date)', args))[0];
  assert.equal(first.repetida, false);
  assert.equal(await count('pagamentos', `where orcamento_id='${b}'`), 1);
});
console.log(`${checks} isolated database checks passed`);
await db.close();

});
