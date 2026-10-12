/** Isolated PostgreSQL/WASM gate for R182-EST-01. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.ODONTO_PGLITE) {
  console.log('SKIP R182-EST-01: set ODONTO_PGLITE to run the isolated PostgreSQL/WASM gate.');
  process.exit(0);
}
const { PGlite } = await import(pathToFileURL(process.env.ODONTO_PGLITE).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const migration = await readFile(new URL('../supabase/migrations/20261012134222_r182_estabilizar_conclusao_encaminhada.sql', import.meta.url), 'utf8');
const source = await readFile(new URL('../src/server/patients/registro-actions.ts', import.meta.url), 'utf8');
const rows = async (query, params = []) => (await db.query(query, params)).rows;
const [clinic, otherClinic, authorUser, recipientUser, outsiderUser, externalUser, authorDentist, recipientDentist, outsiderDentist, externalDentist] =
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(id);
let checks = 0;

async function check(label, callback) {
  await callback();
  checks++;
  console.log(`PASS ${label}`);
}

async function as(userId) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
}

async function eventState(eventId) {
  return (await rows(`
    select id::text, clinica_id::text, paciente_id::text, dentista_id::text,
           encaminhado_para::text, status, coalesce(realizado_em::text, '') as realizado_em,
           momento_planejado
    from public.odontograma_eventos where id = $1
  `, [eventId]))[0];
}

async function logCount(eventId) {
  return Number((await rows('select count(*) as count from public.activity_logs where entity_id = $1', [eventId]))[0].count);
}

async function seedEvent(n, { momento = 'proxima_sessao', signed = false } = {}) {
  const eventId = id(n);
  const fichaId = id(100 + n);
  const patientId = id(200 + n);
  await db.query('insert into public.fichas(id, clinica_id, assinado_em) values($1,$2,$3)', [fichaId, clinic, signed ? '2026-10-10T12:00:00Z' : null]);
  await db.query(`
    insert into public.odontograma_eventos(
      id, clinica_id, paciente_id, dentista_id, ficha_id, encaminhado_para,
      status, realizado_em, momento_planejado
    ) values ($1,$2,$3,$4,$5,$6,'indicado',null,$7)
  `, [eventId, clinic, patientId, authorDentist, fichaId, recipientDentist, momento]);
  return { eventId, patientId };
}

await db.exec(`
create schema auth;
create role anon;
create role authenticated;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.users(id uuid primary key, active_clinica_id uuid not null);
create table public.clinica_usuarios(usuario_id uuid, clinica_id uuid, role text, status text);
create table public.dentistas(
  id uuid primary key, user_id uuid, clinica_id uuid, role text, ativo boolean, nome text
);
create table public.fichas(id uuid primary key, clinica_id uuid not null, assinado_em timestamptz);
create table public.odontograma_eventos(
  id uuid primary key,
  clinica_id uuid not null,
  paciente_id uuid not null,
  dentista_id uuid not null,
  ficha_id uuid not null,
  encaminhado_para uuid,
  status text not null check (status in ('indicado', 'realizado')),
  realizado_em date,
  momento_planejado text not null check (momento_planejado in ('sessao_atual', 'proxima_sessao')),
  constraint odontograma_eventos_momento_coerente
    check (momento_planejado = 'sessao_atual' or status = 'indicado')
);
create table public.activity_logs(
  clinica_id uuid, actor_id uuid, actor_nome text, paciente_id uuid,
  entity_type text, entity_id text, action text, metadata jsonb
);

create function public.get_my_clinica_id() returns uuid language sql stable as $$
  select active_clinica_id from public.users where id = auth.uid()
$$;
create function public.get_my_dentista_id() returns uuid language sql stable as $$
  select d.id from public.dentistas d
  where d.user_id = auth.uid() and d.clinica_id = public.get_my_clinica_id() and d.ativo
$$;
create function public.get_my_role() returns text language sql stable as $$
  select cu.role from public.clinica_usuarios cu
  where cu.usuario_id = auth.uid() and cu.clinica_id = public.get_my_clinica_id() and cu.status = 'ativo'
$$;
`);

await db.query('insert into public.users values($1,$2),($3,$2),($4,$2),($5,$6)', [authorUser, clinic, recipientUser, outsiderUser, externalUser, otherClinic]);
await db.query(`
  insert into public.clinica_usuarios values
    ($1,$2,'dentista','ativo'),($3,$2,'dentista','ativo'),($4,$2,'dentista','ativo'),
    ($5,$6,'dentista','ativo')
`, [authorUser, clinic, recipientUser, outsiderUser, externalUser, otherClinic]);
await db.query(`
  insert into public.dentistas values
    ($1,$2,$3,'dentista',true,'Autora QA'),
    ($4,$5,$3,'dentista',true,'Destino QA'),
    ($6,$7,$3,'dentista',true,'Outro QA'),
    ($8,$9,$10,'dentista',true,'Outra Clínica QA')
`, [authorDentist, authorUser, clinic, recipientDentist, recipientUser, outsiderDentist, outsiderUser, externalDentist, externalUser, otherClinic]);
await db.exec(migration);

await check('RPC retains authenticated execution only', async () => {
  const privileges = (await rows(`
    select
      has_function_privilege('authenticated', 'public.concluir_evento_encaminhado(uuid[], text, date)', 'EXECUTE') as authenticated,
      has_function_privilege('anon', 'public.concluir_evento_encaminhado(uuid[], text, date)', 'EXECUTE') as anon,
      has_function_privilege('public', 'public.concluir_evento_encaminhado(uuid[], text, date)', 'EXECUTE') as public
  `))[0];
  assert.deepEqual(privileges, { authenticated: true, anon: false, public: false });
});

await check('action keeps the existing RPC and server-side clinical date', async () => {
  assert.match(source, /supabase\.rpc\('concluir_evento_encaminhado'/);
  assert.match(source, /p_realizado_em:\s*params\.novoStatus === 'realizado' \? hojeBRT\(\) : null/);
});

const forwarded = await seedEvent(20);
await as(recipientUser);
await check('recipient completes next-session forwarding, preserving fields and audit trail', async () => {
  await rows("select public.concluir_evento_encaminhado(array[$1]::uuid[], 'realizado', $2::date)", [forwarded.eventId, '2026-10-12']);
  assert.deepEqual(await eventState(forwarded.eventId), {
    id: forwarded.eventId,
    clinica_id: clinic,
    paciente_id: forwarded.patientId,
    dentista_id: authorDentist,
    encaminhado_para: recipientDentist,
    status: 'realizado',
    realizado_em: '2026-10-12',
    momento_planejado: 'sessao_atual',
  });
  const log = (await rows('select action, metadata->>\'status\' as status, metadata->>\'realizado_em\' as realizado_em from public.activity_logs where entity_id=$1', [forwarded.eventId]))[0];
  assert.deepEqual(log, { action: 'odontograma_evento.marcado_realizado', status: 'realizado', realizado_em: '2026-10-12' });
});

await check('recipient reopens without inventing a return to next session', async () => {
  await rows("select public.concluir_evento_encaminhado(array[$1]::uuid[], 'indicado', null)", [forwarded.eventId]);
  const reloaded = await eventState(forwarded.eventId);
  assert.equal(reloaded.status, 'indicado');
  assert.equal(reloaded.realizado_em, '');
  assert.equal(reloaded.momento_planejado, 'sessao_atual');
  assert.equal(await logCount(forwarded.eventId), 2);
  const log = (await rows('select action from public.activity_logs where entity_id=$1 order by action desc limit 1', [forwarded.eventId]))[0];
  assert.equal(log.action, 'odontograma_evento.reaberto');
});

const currentSession = await seedEvent(21, { momento: 'sessao_atual' });
await check('already-current-session forwarding remains completable', async () => {
  await rows("select public.concluir_evento_encaminhado(array[$1]::uuid[], 'realizado', $2::date)", [currentSession.eventId, '2026-10-12']);
  const reloaded = await eventState(currentSession.eventId);
  assert.equal(reloaded.status, 'realizado');
  assert.equal(reloaded.momento_planejado, 'sessao_atual');
});

await check('another dentist in the clinic is denied with no effect', async () => {
  const before = await eventState(forwarded.eventId);
  const beforeLogs = await logCount(forwarded.eventId);
  await as(outsiderUser);
  await assert.rejects(rows("select public.concluir_evento_encaminhado(array[$1]::uuid[], 'realizado', $2::date)", [forwarded.eventId, '2026-10-12']), /sem_permissao/);
  assert.deepEqual(await eventState(forwarded.eventId), before);
  assert.equal(await logCount(forwarded.eventId), beforeLogs);
  await as(recipientUser);
});

await check('another clinic is denied with no effect', async () => {
  const before = await eventState(currentSession.eventId);
  const beforeLogs = await logCount(currentSession.eventId);
  await as(externalUser);
  await assert.rejects(rows("select public.concluir_evento_encaminhado(array[$1]::uuid[], 'indicado', null)", [currentSession.eventId]), /sem_permissao/);
  assert.deepEqual(await eventState(currentSession.eventId), before);
  assert.equal(await logCount(currentSession.eventId), beforeLogs);
  await as(recipientUser);
});

await check('mixed batch containing a signed ficha is atomic and denied', async () => {
  const allowed = await seedEvent(22);
  const signed = await seedEvent(23, { signed: true });
  const beforeAllowed = await eventState(allowed.eventId);
  const beforeSigned = await eventState(signed.eventId);
  const beforeLogs = await logCount(allowed.eventId) + await logCount(signed.eventId);
  await assert.rejects(rows("select public.concluir_evento_encaminhado(array[$1,$2]::uuid[], 'realizado', $3::date)", [allowed.eventId, signed.eventId, '2026-10-12']), /sem_permissao/);
  assert.deepEqual(await eventState(allowed.eventId), beforeAllowed);
  assert.deepEqual(await eventState(signed.eventId), beforeSigned);
  assert.equal(await logCount(allowed.eventId) + await logCount(signed.eventId), beforeLogs);
});

console.log(`R182-EST-01 passed ${checks} checks in isolated PostgreSQL/WASM.`);
await db.close();
