/** Isolated PostgreSQL/WASM gate for R-197. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.ODONTO_PGLITE) {
  console.log('SKIP R-197: set ODONTO_PGLITE to run the isolated PostgreSQL/WASM gate.');
  process.exit(0);
}

const { PGlite } = await import(pathToFileURL(process.env.ODONTO_PGLITE).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [clinic, otherClinic, dentistUser, otherDentistUser, secretaryUser, outsiderUser, dentist, otherDentist, secretary, outsiderDentist, patient, ficha] =
  Array.from({ length: 12 }, (_, index) => id(index + 1));
const rows = async (query, params = []) => (await db.query(query, params)).rows;
const as = async (user) => db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
const call = (budgetId, items, version) => rows(
  'select * from public.editar_valores_orcamento_vinculado($1::uuid, $2::jsonb, $3::timestamptz)',
  [budgetId, JSON.stringify(items), version],
);
const migration = await readFile(
  new URL('../supabase/migrations/20261012150833_r197_editar_valores_orcamento_vinculado.sql', import.meta.url),
  'utf8',
);
let checks = 0;
async function check(label, fn) {
  await fn();
  checks++;
  console.log(`PASS ${label}`);
}
async function count(query, params = []) {
  return Number((await rows(query, params))[0].n);
}
async function eligibleBudget(n) {
  const budgetId = id(n);
  const firstItem = id(n + 100);
  const secondItem = id(n + 200);
  const version = '2026-10-12T10:00:00.000Z';
  await db.query(
    `insert into orcamentos(id, clinica_id, ficha_id, paciente_id, dentista_id, status, total, desconto, updated_at)
     values($1,$2,$3,$4,$5,'rascunho',250,25,$6::timestamptz)`,
    [budgetId, clinic, ficha, patient, dentist, version],
  );
  await db.query(
    `insert into orcamento_itens(id, orcamento_id, clinica_id, descricao, procedimento_id, quantidade, preco_unitario, preco_total, aprovado)
     values($1,$2,$3,'Procedimento A',$4,1,100,100,false),
           ($5,$2,$3,'Procedimento B',$6,3,50,150,false)`,
    [firstItem, budgetId, clinic, id(n + 300), secondItem, id(n + 400)],
  );
  await db.query(
    'insert into orcamento_eventos(orcamento_id, item_id, clinica_id) values($1,$2,$3),($1,$4,$3)',
    [budgetId, firstItem, clinic, secondItem],
  );
  return { budgetId, firstItem, secondItem, version };
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
create table pacientes(id uuid primary key, clinica_id uuid);
create table fichas(id uuid primary key, clinica_id uuid, paciente_id uuid);
create table orcamentos(
  id uuid primary key, clinica_id uuid, ficha_id uuid, paciente_id uuid, dentista_id uuid,
  status text, total numeric, desconto numeric, valor_acordado numeric, plano_forma text,
  updated_at timestamptz not null default now()
);
create table orcamento_itens(
  id uuid primary key, orcamento_id uuid, clinica_id uuid, descricao text, procedimento_id uuid,
  quantidade integer, preco_unitario numeric, preco_total numeric, aprovado boolean, retirado_em timestamptz, composicao jsonb
);
create table orcamento_eventos(orcamento_id uuid, item_id uuid, clinica_id uuid);
create table assinaturas(orcamento_id uuid, clinica_id uuid);
create table orcamento_cobrancas(orcamento_id uuid, clinica_id uuid);
create table pagamentos(orcamento_id uuid, clinica_id uuid);
create table activity_logs(
  clinica_id uuid, actor_id uuid, actor_nome text, paciente_id uuid,
  entity_type text, entity_id text, action text, metadata jsonb
);
create function public.get_my_clinica_id() returns uuid language sql stable as $$
  select active_clinica_id from users where id = auth.uid()
$$;
create function public.get_my_dentista_id() returns uuid language sql stable as $$
  select id from dentistas where user_id = auth.uid()
    and clinica_id = public.get_my_clinica_id() limit 1
$$;
create function public.get_my_role() returns text language sql stable as $$
  select coalesce(
    (select role from clinica_usuarios where usuario_id = auth.uid()
      and clinica_id = public.get_my_clinica_id() and status = 'ativo' limit 1),
    (select role from dentistas where user_id = auth.uid() and ativo = true limit 1)
  )
$$;
create function touch_orcamento_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
create trigger orcamentos_updated_at before update on orcamentos
for each row execute function touch_orcamento_updated_at();
`);
await db.query(
  `insert into users values($1,$2),($3,$2),($4,$2),($5,$6)`,
  [dentistUser, clinic, otherDentistUser, secretaryUser, outsiderUser, otherClinic],
);
await db.query(
  `insert into clinica_usuarios values
    ($1,$5,'dentista','ativo'),($2,$5,'dentista','ativo'),($3,$5,'secretaria','ativo'),($4,$6,'dentista','ativo')`,
  [dentistUser, otherDentistUser, secretaryUser, outsiderUser, clinic, otherClinic],
);
await db.query(
  `insert into dentistas values
    ($1,$2,$5,'dentista',true,'Dentista QA'),
    ($3,$4,$5,'dentista',true,'Outro dentista QA'),
    ($6,$7,$5,'secretaria',true,'Secretária QA'),
    ($8,$9,$10,'dentista',true,'Outra clínica QA')`,
  [dentist, dentistUser, otherDentist, otherDentistUser, clinic, secretary, secretaryUser, outsiderDentist, outsiderUser, otherClinic],
);
await db.query('insert into pacientes values($1,$2)', [patient, clinic]);
await db.query('insert into fichas values($1,$2,$3)', [ficha, clinic, patient]);
await db.exec(migration);

await as(dentistUser);
await check('altera valores em itens existentes, mantém vínculos e registra uma trilha', async () => {
  const target = await eligibleBudget(1000);
  const result = await call(target.budgetId, [
    { id: target.firstItem, quantidade: 2, preco_unitario: 125.5 },
    { id: target.secondItem, quantidade: 1, preco_unitario: 80 },
  ], target.version);
  assert.equal(Number(result[0].total), 306);
  assert.deepEqual(
    (await rows('select id, quantidade, preco_unitario, preco_total from orcamento_itens where orcamento_id=$1 order by id', [target.budgetId]))
      .map((item) => ({ ...item, preco_unitario: Number(item.preco_unitario), preco_total: Number(item.preco_total) })),
    [
      { id: target.firstItem, quantidade: 2, preco_unitario: 125.5, preco_total: 251 },
      { id: target.secondItem, quantidade: 1, preco_unitario: 80, preco_total: 80 },
    ].sort((a, b) => a.id.localeCompare(b.id)),
  );
  assert.equal(await count('select count(*) as n from orcamento_eventos where orcamento_id=$1 and item_id in ($2,$3)', [target.budgetId, target.firstItem, target.secondItem]), 2);
  assert.equal(await count("select count(*) as n from activity_logs where entity_id=$1 and action='orcamento.editado'", [target.budgetId]), 1);
  const log = (await rows('select metadata from activity_logs where entity_id=$1', [target.budgetId]))[0].metadata;
  assert.equal(log.alteracao, 'valores_itens_vinculados');
  assert.deepEqual(log.itemIds.sort(), [target.firstItem, target.secondItem].sort());
});

await check('rejeita versão antiga, omissão, duplicação e item estranho sem efeito parcial', async () => {
  const target = await eligibleBudget(2000);
  const original = await rows('select quantidade, preco_unitario, preco_total from orcamento_itens where id=$1', [target.firstItem]);
  for (const [items, version, expected] of [
    [[{ id: target.firstItem, quantidade: 2, preco_unitario: 1 }, { id: target.secondItem, quantidade: 1, preco_unitario: 1 }], '2020-01-01T00:00:00.000Z', /conflito/],
    [[{ id: target.firstItem, quantidade: 2, preco_unitario: 1 }], target.version, /itens_incompletos/],
    [[{ id: target.firstItem, quantidade: 2, preco_unitario: 1 }, { id: target.firstItem, quantidade: 1, preco_unitario: 1 }], target.version, /item_duplicado/],
    [[{ id: target.firstItem, quantidade: 2, preco_unitario: 1 }, { id: id(2999), quantidade: 1, preco_unitario: 1 }], target.version, /item_invalido/],
  ]) {
    await assert.rejects(call(target.budgetId, items, version), expected);
  }
  assert.deepEqual(await rows('select quantidade, preco_unitario, preco_total from orcamento_itens where id=$1', [target.firstItem]), original);
  assert.equal(await count('select count(*) as n from activity_logs where entity_id=$1', [target.budgetId]), 0);
});

await check('rejeita payload SQL nulo e preserva retirada ou composição do R-169b', async () => {
  const invalid = await eligibleBudget(2500);
  await assert.rejects(rows(
    'select * from public.editar_valores_orcamento_vinculado($1::uuid, null::jsonb, $2::timestamptz)',
    [invalid.budgetId, invalid.version],
  ), /itens_invalidos/);

  for (const [offset, sql] of [
    [1, 'update orcamento_itens set retirado_em=now() where id=$1'],
    [2, "update orcamento_itens set composicao='[]'::jsonb where id=$1"],
  ]) {
    const target = await eligibleBudget(2600 + offset * 10);
    await db.query(sql, [target.firstItem]);
    await assert.rejects(call(target.budgetId, [
      { id: target.firstItem, quantidade: 2, preco_unitario: 100 },
      { id: target.secondItem, quantidade: 1, preco_unitario: 50 },
    ], target.version), /orcamento_itens_(retirados|com_composicao)/);
    assert.equal(await count('select count(*) as n from activity_logs where entity_id=$1', [target.budgetId]), 0);
  }
});

await check('nega outro dentista, secretária e outra clínica sem escrever', async () => {
  const target = await eligibleBudget(3000);
  const payload = [{ id: target.firstItem, quantidade: 2, preco_unitario: 100 }, { id: target.secondItem, quantidade: 1, preco_unitario: 50 }];
  for (const user of [otherDentistUser, secretaryUser, outsiderUser]) {
    await as(user);
    await assert.rejects(call(target.budgetId, payload, target.version), /sem_permissao/);
  }
  await as(dentistUser);
  assert.equal(await count('select count(*) as n from activity_logs where entity_id=$1', [target.budgetId]), 0);
  assert.equal(Number((await rows('select total from orcamentos where id=$1', [target.budgetId]))[0].total), 250);
});

await check('nega dentista inativo com orçamento próprio e efeito zero', async () => {
  const target = await eligibleBudget(3500);
  const payload = [
    { id: target.firstItem, quantidade: 2, preco_unitario: 100 },
    { id: target.secondItem, quantidade: 1, preco_unitario: 50 },
  ];
  await db.query('update dentistas set ativo=false where id=$1', [dentist]);
  await assert.rejects(call(target.budgetId, payload, target.version), /sem_permissao/);
  assert.equal(Number((await rows('select total from orcamentos where id=$1', [target.budgetId]))[0].total), 250);
  assert.equal(await count('select count(*) as n from activity_logs where entity_id=$1', [target.budgetId]), 0);
  await db.query('update dentistas set ativo=true where id=$1', [dentist]);
});

await check('nega participação suspensa apesar do fallback de papel legado', async () => {
  const target = await eligibleBudget(3700);
  const payload = [
    { id: target.firstItem, quantidade: 2, preco_unitario: 100 },
    { id: target.secondItem, quantidade: 1, preco_unitario: 50 },
  ];
  await db.query("update clinica_usuarios set status='suspenso' where usuario_id=$1 and clinica_id=$2", [dentistUser, clinic]);
  assert.equal((await rows('select public.get_my_role() as role'))[0].role, 'dentista');
  await assert.rejects(call(target.budgetId, payload, target.version), /sem_permissao/);
  assert.equal(Number((await rows('select total from orcamentos where id=$1', [target.budgetId]))[0].total), 250);
  assert.equal(await count('select count(*) as n from activity_logs where entity_id=$1', [target.budgetId]), 0);
  await db.query("update clinica_usuarios set status='ativo' where usuario_id=$1 and clinica_id=$2", [dentistUser, clinic]);
});

await check('encaminha orçamento com histórico comercial ao R-172 sem mutação', async () => {
  for (const [offset, historySql] of [
    [1, 'update orcamento_itens set aprovado=true where id=$1'],
    [2, 'update orcamentos set valor_acordado=250 where id=$1'],
    [3, 'insert into assinaturas(orcamento_id, clinica_id) values($1,$2)'],
    [4, 'insert into orcamento_cobrancas(orcamento_id, clinica_id) values($1,$2)'],
    [5, 'insert into pagamentos(orcamento_id, clinica_id) values($1,$2)'],
  ]) {
    const target = await eligibleBudget(4000 + offset * 10);
    const parameters = historySql.includes('orcamento_itens')
      ? [target.firstItem]
      : historySql.includes('valor_acordado')
        ? [target.budgetId]
        : [target.budgetId, clinic];
    await db.query(historySql, parameters);
    const versaoAtual = (await rows('select updated_at from orcamentos where id=$1', [target.budgetId]))[0].updated_at;
    await assert.rejects(call(target.budgetId, [
      { id: target.firstItem, quantidade: 2, preco_unitario: 100 },
      { id: target.secondItem, quantidade: 1, preco_unitario: 50 },
    ], versaoAtual), /orcamento_com_historico_comercial/);
    assert.equal(await count('select count(*) as n from activity_logs where entity_id=$1', [target.budgetId]), 0);
  }
});

console.log(`${checks} isolated database checks passed`);
await db.close();
