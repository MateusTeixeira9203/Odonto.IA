/** SQL real em Postgres/WASM isolado; não acessa Supabase nem muda dados de clínicas.
 * R169_PGLITE=/caminho/pglite/dist/index.js node scripts/test-r169-editar-nome.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.R169_PGLITE) throw new Error('Informe R169_PGLITE (runtime temporário, fora das dependências do app).');
const { PGlite } = await import(pathToFileURL(process.env.R169_PGLITE).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const clinic = id(1), actor = id(2), colleague = id(3), patient = id(4), ficha = id(5), evento = id(6);
await db.exec(`
  create role authenticated; create role anon; create role service_role;
  create table dentistas(id uuid primary key, clinica_id uuid, nome text);
  create table fichas(id uuid primary key, clinica_id uuid, assinado_em timestamptz,
    procedimentos text[], dentes_observacoes jsonb, dentes_afetados int[],
    status text, data_atendimento date, anotacoes text, updated_at timestamptz);
  create table odontograma_eventos(id uuid primary key, clinica_id uuid, paciente_id uuid,
    ficha_id uuid, dentista_id uuid, encaminhado_para uuid, assinatura_id uuid,
    procedimento_nome text, procedimento_id uuid, tipo text, detalhe jsonb, observacao text,
    dente int, status text, grupo_id uuid, created_at timestamptz default now());
  create table activity_logs(clinica_id uuid, actor_id uuid, actor_nome text, paciente_id uuid,
    entity_type text, entity_id text, action text, metadata jsonb);
  create table orcamento_itens(id uuid primary key, procedimento_nome text, valor numeric, pago numeric);
  create function get_my_clinica_id() returns uuid language sql as $$ select current_setting('qa.clinic')::uuid $$;
  create function get_my_dentista_id() returns uuid language sql as $$ select nullif(current_setting('qa.actor'),'')::uuid $$;
  create function get_my_role() returns text language sql as $$ select current_setting('qa.role') $$;
  insert into dentistas values ('${actor}','${clinic}','Autor QA'), ('${colleague}','${clinic}','Colega QA');
  insert into fichas values ('${ficha}','${clinic}',null,array['Curativo'],'{"46":"Curativo"}',array[46],'concluido','2026-09-14','Texto original',now());
  insert into odontograma_eventos values ('${evento}','${clinic}','${patient}','${ficha}','${actor}',null,null,
    'Curativo','${id(9)}','outro',null,null,46,'realizado','${id(10)}',now());
  insert into orcamento_itens values ('${id(7)}','Curativo',200,100);
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260902100000_r140c_editar_detalhes_no_prontuario.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20260914204853_r169_editar_nome_procedimento.sql', import.meta.url), 'utf8'));
async function caller(who = actor, role = 'dentista', activeClinic = clinic) {
  await db.query("select set_config('qa.actor',$1,false),set_config('qa.role',$2,false),set_config('qa.clinic',$3,false)", [who, role, activeClinic]);
}
async function current() {
  return (await db.query('select * from odontograma_eventos where id=$1', [evento])).rows[0];
}
const snapshot = (r) => ({ procedimentoNome:r.procedimento_nome, observacao:r.observacao, detalhe:r.detalhe });
async function edit({ name, obs, detalhe, original, eventId=evento } = {}) {
  await db.exec('set role authenticated');
  try {
    await db.query('select editar_detalhes_evento_odontograma($1,$2,$3,$4,$5,$6,$7,$8)', [
      eventId, detalhe ?? null, detalhe !== undefined, obs ?? null, obs !== undefined,
      name ?? null, name !== undefined, original ?? null,
    ]);
  } finally { await db.exec('reset role'); }
}
let passed = 0;
async function check(label, fn) { await fn(); passed++; console.log(`PASS ${label}`); }
await caller();
await check('nome e observação atômicos; identidade, região, status, grupo e orçamento preservados', async () => {
  const before = await current();
  const budget = (await db.query('select * from orcamento_itens')).rows;
  await edit({name:'  Curativo provisório  ', obs:'Sem intercorrências', original:{...snapshot(before),observacao:''}});
  const after = await current();
  assert.equal(after.procedimento_nome,'Curativo provisório'); assert.equal(after.observacao,'Sem intercorrências');
  for (const field of ['id','procedimento_id','tipo','dente','status','grupo_id','ficha_id','dentista_id','created_at']) assert.deepEqual(after[field],before[field]);
  assert.deepEqual((await db.query('select * from orcamento_itens')).rows,budget);
  const f=(await db.query('select * from fichas')).rows[0];
  assert.deepEqual(f.procedimentos,['Curativo provisório']);
  assert.deepEqual(f.dentes_observacoes,{'46':'Curativo provisório (Sem intercorrências)'});
  assert.equal(f.status,'concluido'); assert.equal(f.anotacoes,'Texto original');
  const log=(await db.query('select * from activity_logs')).rows[0];
  assert.equal(log.actor_id,actor); assert.equal(log.metadata.nome_anterior,'Curativo');
  assert.equal(log.metadata.nome_atual,'Curativo provisório');
});
await check('nome vazio, acima de 500 e snapshot ausente são recusados', async () => {
  const original=snapshot(await current());
  await assert.rejects(edit({name:'   ',original}),/nome_invalido/);
  await assert.rejects(edit({name:'a'.repeat(501),original}),/nome_invalido/);
  await assert.rejects(edit({name:'Novo nome'}),/snapshot_obrigatorio/);
});
await check('conflito conserva nome e observação sem gravação parcial ou log adicional', async () => {
  const before=await current(); const logs=(await db.query('select count(*)::int n from activity_logs')).rows[0].n;
  await assert.rejects(edit({name:'Não deve salvar',obs:'Não deve salvar',original:{...snapshot(before),procedimentoNome:'antigo'}}),/conflito_edicao/);
  assert.deepEqual(await current(),before);
  assert.equal((await db.query('select count(*)::int n from activity_logs')).rows[0].n,logs);
});
await check('snapshot de outro campo não conflita nem sobrescreve campo não editado', async () => {
  const before=await current();
  await edit({name:'Curativo de proteção',original:{...snapshot(before),observacao:'desatualizada'}});
  assert.equal((await current()).observacao,before.observacao);
});
await check('colega sem encaminhamento, secretaria e outra clínica recusados', async () => {
  const original=snapshot(await current());
  await caller(colleague); await assert.rejects(edit({name:'Indevido',original}),/sem_permissao/);
  await caller(actor,'secretaria'); await assert.rejects(edit({name:'Indevido',original}),/sem_permissao/);
  await caller(actor,'dentista',id(100)); await assert.rejects(edit({name:'Indevido',original}),/registro_bloqueado/);
  await caller();
});
await check('encaminhado altera somente detalhe técnico; rename/observação recusados', async () => {
  await db.query("update odontograma_eventos set encaminhado_para=$1,tipo='implante' where id=$2",[colleague,evento]);
  await caller(colleague); const original=snapshot(await current());
  await assert.rejects(edit({name:'Indevido',original}),/sem_permissao/);
  await assert.rejects(edit({obs:'Indevido',original}),/sem_permissao/);
  await edit({detalhe:{marca:'QA'},original}); assert.deepEqual((await current()).detalhe,{marca:'QA'});
  await caller();
});
await check('assinatura no evento ou na ficha bloqueia rename', async () => {
  const original=snapshot(await current());
  await db.query('update odontograma_eventos set assinatura_id=$1 where id=$2',[id(11),evento]);
  await assert.rejects(edit({name:'Indevido',original}),/registro_bloqueado/);
  await db.query('update odontograma_eventos set assinatura_id=null where id=$1',[evento]);
  await db.query('update fichas set assinado_em=now() where id=$1',[ficha]);
  await assert.rejects(edit({name:'Indevido',original}),/registro_bloqueado/);
  await db.query('update fichas set assinado_em=null where id=$1',[ficha]);
});
await check('cliente legado de cinco argumentos funciona; uma única assinatura', async () => {
  await db.query("select editar_detalhes_evento_odontograma($1,null,false,'Cliente antigo',true)",[evento]);
  assert.equal((await current()).observacao,'Cliente antigo');
  const funcs=await db.query("select pronargs from pg_proc where proname='editar_detalhes_evento_odontograma'");
  assert.deepEqual(funcs.rows,[{pronargs:8}]);
});
await check('anon sem EXECUTE; authenticated e service_role preservados', async () => {
  const sig='editar_detalhes_evento_odontograma(uuid,jsonb,boolean,text,boolean,text,boolean,jsonb)';
  const grants=(await db.query("select has_function_privilege('anon',$1,'execute') as anon,has_function_privilege('authenticated',$1,'execute') as auth,has_function_privilege('service_role',$1,'execute') as service",[sig])).rows[0];
  assert.deepEqual(grants,{anon:false,auth:true,service:true});
});
await check('falha de auditoria reverte evento e derivados na mesma transação', async () => {
  const before=await current(); const beforeFicha=(await db.query('select * from fichas')).rows;
  await db.exec("create function falhar_log() returns trigger language plpgsql as $$ begin raise exception 'qa_falha_log'; end $$; create trigger falhar_log before insert on activity_logs for each row execute function falhar_log();");
  await assert.rejects(edit({name:'Não deve persistir',original:snapshot(before)}),/qa_falha_log/);
  assert.deepEqual(await current(),before); assert.deepEqual((await db.query('select * from fichas')).rows,beforeFicha);
});
await check('rollback restaura assinatura antiga sem apagar nomes salvos', async () => {
  const before=await current();
  await db.exec(await readFile(new URL('../supabase/rollbacks/20260914204853_r169_editar_nome_procedimento.sql',import.meta.url),'utf8'));
  assert.deepEqual(await current(),before);
  assert.deepEqual((await db.query("select pronargs from pg_proc where proname='editar_detalhes_evento_odontograma'")).rows,[{pronargs:5}]);
});
// Fluxos clínicos antigos também precisam respeitar a retirada histórica.
await db.exec(`
  drop trigger falhar_log on activity_logs;
  alter table fichas add column paciente_id uuid default '${patient}', add column dentista_id uuid default '${actor}';
  alter table dentistas add column cro text default 'QA', add column ativo boolean default true, add column role text default 'dentista';
  alter table odontograma_eventos add column retirado_em timestamptz,
    add column origem text, add column nivel text, add column arcada text, add column quadrante smallint,
    add column faces text[], add column papel_no_grupo text, add column realizado_em date,
    add column momento_planejado text;
  create table procedimentos(id uuid primary key, clinica_id uuid);
  create table assinaturas(id uuid primary key default gen_random_uuid(), clinica_id uuid, paciente_id uuid,
    tipo text, ficha_id uuid, dentista_id uuid, assinado_por text, cro_no_ato text, assinatura_ref text);
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260914210511_r169_preservar_retirados_fluxos_clinicos.sql', import.meta.url),'utf8'));
await db.exec('create trigger imutabilidade before update or delete on odontograma_eventos for each row execute function bloquear_edicao_evento_assinado()');
await db.query('update odontograma_eventos set retirado_em=now() where id=$1',[evento]);
await check('cliente de salvamento integral conserva retirados fora do payload', async () => {
  await db.query('select salvar_eventos_odontograma($1,$2,$3,$4,true)',[ficha,clinic,patient,[]]);
  assert.ok((await current()).retirado_em);
});
await check('salvamento, update direto e delete não reativam/apagam histórico retirado', async () => {
  await assert.rejects(db.query('select salvar_eventos_odontograma($1,$2,$3,$4,false)',[ficha,clinic,patient,[{
    id:evento, clinica_id:clinic, paciente_id:patient, ficha_id:ficha, dentista_id:actor, tipo:'outro', procedimento_nome:'Reativação',status:'realizado',faces:[],
  }]]),/evento_contexto_invalido/);
  await assert.rejects(db.query('update odontograma_eventos set retirado_em=null where id=$1',[evento]),/evento_retirado_imutavel/);
  await assert.rejects(db.query('delete from odontograma_eventos where id=$1',[evento]),/evento_retirado_imutavel/);
});
await check('assinatura recusa retirado sem gerar assinatura órfã', async () => {
  await assert.rejects(db.query("select assinar_procedimentos($1,'Paciente QA','assinatura-qa')",[[evento]]),/status_invalido/);
  assert.equal((await db.query('select count(*)::int n from assinaturas')).rows[0].n,0);
});
await check('assinatura de evento ativo continua funcionando e bloqueia edição posterior', async () => {
  const active=id(20);
  await db.query("insert into odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,procedimento_nome) values($1,$2,$3,$4,$5,'outro','realizado','Ativo QA')",[active,clinic,patient,ficha,actor]);
  const signed=await db.query("select assinar_procedimentos($1,'Paciente QA','assinatura-qa') as id",[[active]]);
  assert.ok(signed.rows[0].id);
  await assert.rejects(db.query("update odontograma_eventos set procedimento_nome='Não pode' where id=$1",[active]),/evento_assinado_imutavel/);
});
console.log(`${passed} checks passaram. Modelo isolado; não substitui teste manual autenticado no preview.`);
await db.close();
