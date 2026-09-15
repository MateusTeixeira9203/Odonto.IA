/** SQL real em Postgres/WASM isolado; não acessa Supabase nem altera clínicas.
 * R169_PGLITE=/tmp/r169-db-check/pglite/package/dist/index.js node scripts/test-r169c-editar-evolucao.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.R169_PGLITE) throw new Error('Informe R169_PGLITE (runtime temporário, fora das dependências do app).');
const { PGlite } = await import(pathToFileURL(process.env.R169_PGLITE).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const clinic = id(1), otherClinic = id(2), actor = id(3), colleague = id(4), patient = id(5);
const ficha = id(6), evolucao = id(7), evento = id(8), atendimento = id(9);
const legadoFicha = id(10), modernaFicha = id(11), modernaAtendimento = id(12), modernaEvento = id(13), automatica = id(14);

await db.exec(`
  create role authenticated; create role anon; create role service_role;
  create schema auth;
  create table fichas(
    id uuid primary key, clinica_id uuid not null, paciente_id uuid not null, dentista_id uuid not null,
    assinado_em timestamptz, assinatura_url text, anotacoes text, updated_at timestamptz default now()
  );
  create table ficha_evolucoes(
    id uuid primary key default gen_random_uuid(), clinica_id uuid not null, ficha_id uuid not null, atendimento_id uuid,
    dentista_id uuid not null, data date not null, texto text, automatica boolean not null default false,
    updated_at timestamptz default now()
  );
  create table atendimentos_clinicos(
    id uuid primary key, clinica_id uuid not null, paciente_id uuid not null, dentista_id uuid not null, data_atendimento date not null
  );
  create table odontograma_eventos(id uuid primary key, clinica_id uuid not null, ficha_id uuid not null, paciente_id uuid not null, procedimento_nome text);
  create table atendimento_eventos(atendimento_id uuid not null, clinica_id uuid not null, evento_id uuid not null);
  create function get_my_clinica_id() returns uuid language sql as $$ select current_setting('qa.clinic')::uuid $$;
  create function get_my_dentista_id() returns uuid language sql as $$ select nullif(current_setting('qa.actor'), '')::uuid $$;
  create function get_my_role() returns text language sql as $$ select current_setting('qa.role') $$;
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('qa.user'), '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  grant all on all tables in schema public to authenticated;
  insert into fichas(id,clinica_id,paciente_id,dentista_id,anotacoes) values
    ('${ficha}','${clinic}','${patient}','${actor}','Anotação da ficha'),
    ('${legadoFicha}','${clinic}','${patient}','${actor}','Evolução legada'),
    ('${modernaFicha}','${clinic}','${patient}','${actor}','Não deve ser usada');
  insert into ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values
    ('${evolucao}','${clinic}','${ficha}','${atendimento}','${actor}','2026-09-14','Texto original',false),
    ('${automatica}','${clinic}','${ficha}',null,'${actor}','2026-09-14','Gerada automaticamente',true);
  insert into atendimentos_clinicos values
    ('${atendimento}','${clinic}','${patient}','${actor}','2026-09-14'),
    ('${modernaAtendimento}','${clinic}','${patient}','${actor}','2026-09-15');
  insert into odontograma_eventos values
    ('${evento}','${clinic}','${ficha}','${patient}','Restauração'),
    ('${modernaEvento}','${clinic}','${modernaFicha}','${patient}','Profilaxia');
  insert into atendimento_eventos values
    ('${atendimento}','${clinic}','${evento}'),
    ('${modernaAtendimento}','${clinic}','${modernaEvento}');
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260915001500_r169c_editar_evolucao_clinica.sql', import.meta.url), 'utf8'));

async function caller(who = actor, role = 'dentista', activeClinic = clinic, user = who) {
  await db.query("select set_config('qa.actor',$1,false), set_config('qa.role',$2,false), set_config('qa.clinic',$3,false), set_config('qa.user',$4,false)", [who, role, activeClinic, user]);
}
async function editar({ pacienteId = patient, fichaId = ficha, atendimentoId = atendimento, evolucaoId = evolucao, original = 'Texto original', texto = 'Texto atualizado' } = {}) {
  await db.exec('set role authenticated');
  try {
    return await db.query('select editar_evolucao_clinica($1,$2,$3,$4,$5,$6) as texto', [pacienteId, fichaId, atendimentoId, evolucaoId, original, texto]);
  } finally {
    await db.exec('reset role');
  }
}
async function evolucaoAtual(evolucaoId = evolucao) {
  return (await db.query('select * from ficha_evolucoes where id=$1', [evolucaoId])).rows[0];
}
async function procedimentos() {
  return (await db.query('select * from odontograma_eventos order by id')).rows;
}
let passed = 0;
async function check(label, fn) { await fn(); passed++; console.log(`PASS ${label}`); }

await caller();
await check('atualiza somente o texto da evolução escolhida e preserva procedimentos', async () => {
  const antes = await evolucaoAtual();
  const eventosAntes = await procedimentos();
  const resultado = await editar({ texto: '  Evolução revisada  ' });
  const depois = await evolucaoAtual();
  assert.equal(resultado.rows[0].texto, 'Evolução revisada');
  assert.equal(depois.texto, 'Evolução revisada');
  assert.equal(depois.ficha_id, antes.ficha_id);
  assert.equal(depois.atendimento_id, antes.atendimento_id);
  assert.equal(depois.dentista_id, antes.dentista_id);
  assert.deepEqual(await procedimentos(), eventosAntes);
});

await check('CAS recusa texto desatualizado sem sobrescrever a evolução', async () => {
  const antes = await evolucaoAtual();
  await assert.rejects(editar({ original: 'Texto original', texto: 'Não pode salvar' }), /evolucao_conflito/);
  assert.deepEqual(await evolucaoAtual(), antes);
});

await check('autoria, clínica e perfis sem papel clínico são recusados', async () => {
  await caller(colleague);
  await assert.rejects(editar({ original: 'Evolução revisada', texto: 'Colega' }), /evolucao_sem_permissao/);
  await caller(actor, 'secretaria');
  await assert.rejects(editar({ original: 'Evolução revisada', texto: 'Secretaria' }), /evolucao_sem_permissao/);
  await caller(actor, 'dentista', otherClinic);
  await assert.rejects(editar({ original: 'Evolução revisada', texto: 'Outra clínica' }), /evolucao_sem_permissao/);
  await caller();
});

await check('assinatura por data ou URL bloqueia sem alterar texto', async () => {
  const antes = await evolucaoAtual();
  await db.query('update fichas set assinado_em=now() where id=$1', [ficha]);
  await assert.rejects(editar({ original: 'Evolução revisada' }), /evolucao_assinada/);
  await db.query('update fichas set assinado_em=null, assinatura_url=$1 where id=$2', ['assinatura-qa', ficha]);
  await assert.rejects(editar({ original: 'Evolução revisada' }), /evolucao_assinada/);
  await db.query('update fichas set assinatura_url=null where id=$1', [ficha]);
  assert.deepEqual(await evolucaoAtual(), antes);
});

await check('linha automática nunca é editável por este fluxo', async () => {
  await assert.rejects(editar({ evolucaoId: automatica, atendimentoId: null, original: 'Gerada automaticamente', texto: 'Não pode editar' }), /evolucao_sem_permissao/);
  assert.equal((await evolucaoAtual(automatica)).texto, 'Gerada automaticamente');
});

await check('legado sem evolução atualiza anotacoes e vazio normaliza para null', async () => {
  const resultado = await editar({ fichaId: legadoFicha, atendimentoId: null, evolucaoId: null, original: 'Evolução legada', texto: '' });
  assert.equal(resultado.rows[0].texto, null);
  const legado = (await db.query('select anotacoes from fichas where id=$1', [legadoFicha])).rows[0];
  assert.equal(legado.anotacoes, null);
  assert.equal((await db.query('select count(*)::int n from ficha_evolucoes where ficha_id=$1', [legadoFicha])).rows[0].n, 0);
});

await check('consulta moderna sem linha cria apenas evolução com data e autoria da consulta', async () => {
  const eventosAntes = await procedimentos();
  const resultado = await editar({ fichaId: modernaFicha, atendimentoId: modernaAtendimento, evolucaoId: null, original: null, texto: 'Evolução moderna' });
  assert.equal(resultado.rows[0].texto, 'Evolução moderna');
  const criada = (await db.query('select * from ficha_evolucoes where ficha_id=$1 and atendimento_id=$2', [modernaFicha, modernaAtendimento])).rows[0];
  assert.equal(criada.texto, 'Evolução moderna');
  assert.equal(criada.data.toISOString().slice(0, 10), '2026-09-15');
  assert.equal(criada.dentista_id, actor);
  assert.equal(criada.automatica, false);
  assert.deepEqual(await procedimentos(), eventosAntes);
  await assert.rejects(editar({ fichaId: modernaFicha, atendimentoId: modernaAtendimento, evolucaoId: null, original: null, texto: 'Duplicada' }), /evolucao_conflito/);
});

await check('atendimento sem evento da ficha, texto nulo e texto longo são recusados', async () => {
  await assert.rejects(editar({ fichaId: modernaFicha, atendimentoId: atendimento, evolucaoId: null, original: null, texto: 'Contexto indevido' }), /evolucao_sem_permissao/);
  await assert.rejects(editar({ texto: null }), /evolucao_invalida/);
  await assert.rejects(editar({ texto: 'a'.repeat(20001) }), /evolucao_invalida/);
});

await check('ACL expõe somente authenticated e rollback remove a função', async () => {
  const assinatura = 'editar_evolucao_clinica(uuid,uuid,uuid,uuid,text,text)';
  const grants = (await db.query("select has_function_privilege('anon',$1,'execute') as anon, has_function_privilege('authenticated',$1,'execute') as auth", [assinatura])).rows[0];
  assert.deepEqual(grants, { anon: false, auth: true });
  await db.exec(await readFile(new URL('../supabase/rollbacks/20260915001500_r169c_editar_evolucao_clinica.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query("select count(*)::int n from pg_proc where proname='editar_evolucao_clinica'")).rows[0].n, 0);
});

console.log(`${passed} checks passaram. Modelo isolado; não substitui teste manual autenticado no preview.`);
await db.close();
