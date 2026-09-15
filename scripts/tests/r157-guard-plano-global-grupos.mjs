/** SQL real em Postgres/WASM isolado; não acessa Supabase nem dados reais.
 * R169_PGLITE=/tmp/r169-db-check/pglite/package/dist/index.js \
 *   node scripts/tests/r157-guard-plano-global-grupos.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.R169_PGLITE) throw new Error('Informe R169_PGLITE para o runtime PGlite externo ao app.');
const { PGlite } = await import(pathToFileURL(process.env.R169_PGLITE).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const clinic = id(1), groupBudget = id(2), globalBudget = id(3), historicBudget = id(4), retiredBudget = id(5);
const patient = id(6), dentist = id(7), charge = id(8);

await db.exec(`
  create role anon;
  create role authenticated;
  create schema private;
  create table public.orcamentos(
    id uuid primary key, clinica_id uuid not null, valor_acordado numeric,
    plano_forma text, desconto numeric default 0, condicoes_pagamento text
  );
  create table public.orcamento_itens(
    id uuid primary key default gen_random_uuid(), clinica_id uuid not null,
    orcamento_id uuid not null, composicao jsonb, retirado_em timestamptz
  );
  create table public.pagamentos(
    id uuid primary key default gen_random_uuid(), clinica_id uuid not null,
    orcamento_id uuid not null, cobranca_id uuid
  );
  create function public.validar_grupo_existente()
  returns trigger language plpgsql as $$
  begin
    if new.composicao is not null then raise exception 'grupo_invalido'; end if;
    return new;
  end;
  $$;

  -- Estado que precede a migration: grupo ativo, grupo+acordo histórico e grupo retirado.
  insert into public.orcamentos values
    ('${groupBudget}', '${clinic}', null, null, 0, null),
    ('${globalBudget}', '${clinic}', 100, 'avista', 0, null),
    ('${historicBudget}', '${clinic}', 100, 'avista', 5, null),
    ('${retiredBudget}', '${clinic}', null, null, 0, null);
  insert into public.orcamento_itens(clinica_id,orcamento_id,composicao,retirado_em) values
    ('${clinic}', '${groupBudget}', '[]', null),
    ('${clinic}', '${historicBudget}', '[]', null),
    ('${clinic}', '${retiredBudget}', '[]', now());
  create trigger r157_validar_grupo before insert on public.orcamento_itens
    for each row execute function public.validar_grupo_existente();
`);

await db.exec(await readFile(new URL('../../supabase/migrations/20260915183139_r157_bloquear_plano_global_grupos.sql', import.meta.url), 'utf8'));

let passed = 0;
async function check(label, operation) {
  await operation();
  passed += 1;
  console.log(`PASS ${label}`);
}
async function rejected(operation) {
  await assert.rejects(operation, /grupo_orcamento_negociado/);
}

await check('bloqueia valor acordado, plano e desconto globais com grupo ativo', async () => {
  await rejected(() => db.query('update public.orcamentos set valor_acordado=90 where id=$1', [groupBudget]));
  await rejected(() => db.query("update public.orcamentos set plano_forma='avista' where id=$1", [groupBudget]));
  await rejected(() => db.query('update public.orcamentos set desconto=10 where id=$1', [groupBudget]));
});

await check('bloqueia parcela global nova, mas permite cobrança por etapa', async () => {
  await rejected(() => db.query(
    'insert into public.pagamentos(clinica_id,orcamento_id,cobranca_id) values($1,$2,null)', [clinic, groupBudget],
  ));
  await db.query(
    'insert into public.pagamentos(clinica_id,orcamento_id,cobranca_id) values($1,$2,$3)', [clinic, groupBudget, charge],
  );
});

await check('bloqueia transformar cobrança por etapa em pagamento global', async () => {
  await rejected(() => db.query(
    'update public.pagamentos set cobranca_id=null where orcamento_id=$1 and cobranca_id=$2', [groupBudget, charge],
  ));
});

await check('guarda executa antes da validação R157 ao inserir grupo em orçamento global', async () => {
  await rejected(() => db.query(
    "insert into public.orcamento_itens(clinica_id,orcamento_id,composicao) values($1,$2,'[]')", [clinic, globalBudget],
  ));
});

await check('preserva histórico e ignora grupo retirado por R169', async () => {
  await db.query("update public.orcamentos set condicoes_pagamento='histórico' where id=$1", [historicBudget]);
  await db.query('update public.orcamentos set valor_acordado=null, plano_forma=null, desconto=0 where id=$1', [historicBudget]);
  await db.query("update public.orcamentos set valor_acordado=100, plano_forma='avista' where id=$1", [retiredBudget]);
});

console.log(`${passed}/${passed} verificações passaram`);
await db.close();
