/** SQL real em Postgres/WASM isolado; não acessa Supabase nem muda dados de clínicas.
 * R169_PGLITE=/caminho/pglite/dist/index.js node scripts/test-r169-adicionar-procedimentos.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.R169_PGLITE) throw new Error('Informe R169_PGLITE (runtime temporário, fora das dependências do app).');
const { PGlite } = await import(pathToFileURL(process.env.R169_PGLITE).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const clinic = id(1), actor = id(2), other = id(3), patient = id(4), ficha = id(5), capture = id(6), eventId = id(7);

await db.exec(`
  create role authenticated; create role anon;
  create table dentistas(id uuid primary key, clinica_id uuid not null, nome text not null, ativo boolean not null default true, role text not null default 'dentista');
  create table fichas(id uuid primary key, clinica_id uuid not null, paciente_id uuid not null, dentista_id uuid not null,
    assinado_em timestamptz, dentes_afetados integer[], dentes_observacoes jsonb, procedimentos text[], status text, updated_at timestamptz);
  create table procedimentos(id uuid primary key, clinica_id uuid not null);
  create table odontograma_eventos(
    id uuid primary key, clinica_id uuid not null, paciente_id uuid not null, dentista_id uuid not null, ficha_id uuid,
    grupo_id uuid, tipo text not null, procedimento_id uuid, procedimento_nome text, status text not null, origem text not null,
    momento_planejado text not null, nivel text not null, arcada text, quadrante smallint, dente smallint, faces text[] not null default '{}',
    papel_no_grupo text, observacao text, detalhe jsonb, realizado_em date, registrado_em date not null default current_date,
    created_at timestamptz not null default now(), assinatura_id uuid, encaminhado_para uuid
  );
  create table activity_logs(clinica_id uuid, actor_id uuid, actor_nome text, paciente_id uuid, entity_type text, entity_id text, action text, metadata jsonb);
  create function get_my_clinica_id() returns uuid language sql as $$ select current_setting('qa.clinic')::uuid $$;
  create function get_my_dentista_id() returns uuid language sql as $$ select nullif(current_setting('qa.actor'),'')::uuid $$;
  create function get_my_role() returns text language sql as $$ select current_setting('qa.role') $$;
  insert into dentistas(id,clinica_id,nome) values ('${actor}','${clinic}','Dra. QA'), ('${other}','${clinic}','Dr. Outro');
  insert into fichas(id,clinica_id,paciente_id,dentista_id,dentes_afetados,dentes_observacoes,procedimentos,status,updated_at)
    values ('${ficha}','${clinic}','${patient}','${actor}',array[]::integer[],'{}',array[]::text[],'concluida',now());
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260914210000_r169_adicionar_procedimentos_ficha.sql', import.meta.url), 'utf8'));
await db.query("select set_config('qa.actor',$1,false),set_config('qa.role',$2,false),set_config('qa.clinic',$3,false)", [actor, 'dentista', clinic]);

function payload(overrides = {}) {
  return [{
    id: eventId, clinica_id: clinic, paciente_id: patient, dentista_id: actor, ficha_id: ficha,
    grupo_id: null, tipo: 'carie_restauracao', procedimento_id: null, procedimento_nome: 'Restauração',
    status: 'indicado', origem: 'clinica', momento_planejado: 'proxima_sessao', nivel: 'face',
    arcada: null, quadrante: null, dente: 16, faces: ['O'], papel_no_grupo: null,
    observacao: 'Sensibilidade', detalhe: null, realizado_em: null, encaminhado_para: null,
    ...overrides,
  }];
}
async function add(events = payload(), captureId = capture) {
  await db.exec('set role authenticated');
  try {
    return await db.query('select adicionar_procedimentos_ficha($1,$2,$3,$4) as ids', [ficha, patient, captureId, events]);
  } finally {
    await db.exec('reset role');
  }
}
let passed = 0;
async function check(label, fn) { await fn(); passed++; console.log(`PASS ${label}`); }

await check('insere, audita e rederiva ficha com dentes_afetados integer[]', async () => {
  const result = await add();
  assert.deepEqual(result.rows[0].ids, [eventId]);
  const fichaAtual = (await db.query('select * from fichas where id=$1', [ficha])).rows[0];
  assert.deepEqual(fichaAtual.dentes_afetados, [16]);
  assert.deepEqual(fichaAtual.dentes_observacoes, { 16: 'Restauração (Sensibilidade)' });
  assert.deepEqual(fichaAtual.procedimentos, ['Restauração']);
  assert.equal(fichaAtual.status, 'aberta');
  const log = (await db.query('select * from activity_logs')).rows[0];
  assert.equal(log.action, 'odontograma_evento.adicionado_ficha');
  assert.equal(log.metadata.captura_id, capture);
});

await check('retry idêntico do mesmo lote não sobrescreve nem duplica auditoria', async () => {
  await add();
  assert.equal((await db.query('select count(*)::int as n from odontograma_eventos')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int as n from activity_logs')).rows[0].n, 1);
});

await check('captura diferente, evento retirado e captura ausente são recusados', async () => {
  await assert.rejects(add(payload(), id(8)), /conflito_evento/);
  await db.query('update odontograma_eventos set retirado_em=now() where id=$1', [eventId]);
  await assert.rejects(add(), /conflito_evento/);
  await assert.rejects(add(payload({ id: id(9) }), null), /evento_invalido/);
});

await check('validação SQL rejeita nulos que NOT IN não cobriria e textos acima do limite', async () => {
  await assert.rejects(add(payload({ id: id(10), tipo: null })), /evento_invalido/);
  await assert.rejects(add(payload({ id: id(11), observacao: 'a'.repeat(4001) })), /evento_invalido/);
  await assert.rejects(add(payload({ id: id(12), procedimento_nome: 'a'.repeat(501) })), /evento_invalido/);
});

await check('ficha assinada, autor diferente e falha na auditoria não deixam escrita parcial', async () => {
  await db.query('update fichas set assinado_em=now() where id=$1', [ficha]);
  await assert.rejects(add(payload({ id: id(13) })), /ficha_assinada/);
  await db.query('update fichas set assinado_em=null where id=$1', [ficha]);
  await db.query("select set_config('qa.actor',$1,false)", [other]);
  await assert.rejects(add(payload({ id: id(13), dentista_id: other })), /sem_permissao/);
  await db.query("select set_config('qa.actor',$1,false)", [actor]);
  await db.exec("create function falhar_log() returns trigger language plpgsql as $$ begin raise exception 'qa_falha_log'; end $$; create trigger falhar_log before insert on activity_logs for each row execute function falhar_log();");
  await assert.rejects(add(payload({ id: id(13) })), /qa_falha_log/);
  assert.equal((await db.query('select count(*)::int as n from odontograma_eventos where id=$1', [id(13)])).rows[0].n, 0);
});

console.log(`${passed} checks passaram. Modelo isolado; não substitui teste manual autenticado no preview.`);
await db.close();
