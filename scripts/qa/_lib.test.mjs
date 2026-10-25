import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { REF_QA, REF_PROD, ROOT, exigirHostQa, configPgQa, validarPorta, validarNome, validarCommit, flags, resolverFixture, guardaSqlFixture, temTransacao, trocarMarcadoresSenha, mascarar, lerVariavel, contasQa, verificarEnvSnapshot, childEnv, planoE2e, processoSnapshot, desfazerJuncao } from './_lib.mjs';

function temporary() { return fs.mkdtempSync(path.join(os.tmpdir(), 'od017-unit-')); }
function removeTemporary(dir) {
  assert(path.resolve(dir).startsWith(path.join(os.tmpdir(), 'od017-unit-')));
  fs.rmSync(dir, { recursive: true });
}
test('host: somente a API e as conexões PostgreSQL do QA', () => {
  for (const value of [`https://${REF_QA}.supabase.co`, `postgres://postgres:fake@db.${REF_QA}.supabase.co/postgres`, `postgres://postgres.${REF_QA}:fake@aws-0.pooler.supabase.com/postgres`]) assert.doesNotThrow(() => exigirHostQa(value));
  for (const value of ['', undefined, 'https://example.org', `https://${REF_PROD}.supabase.co`, `https://${REF_QA}.supabase.co.example.org`, `postgres://postgres.${REF_QA}:fake@evil.example/postgres`, `https://${REF_QA}.supabase.co?ref=${REF_PROD}`]) assert.throws(() => exigirHostQa(value));
});
test('parâmetros de conexão não podem substituir host, usuário ou TLS depois da trava QA', () => {
  const host = 'aws-0.pooler.supabase.com';
  const config = configPgQa(`postgres://postgres.${REF_QA}:fake-password@${host}:6543/postgres?host=evil.example&user=other&sslmode=disable`, 'fake-public-ca');
  assert.equal(config.host, host);
  assert.equal(config.user, `postgres.${REF_QA}`);
  assert.equal(config.port, 6543);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, 'fake-public-ca');
  assert(!('connectionString' in config));
});
test('flags, porta, nome e SHA recusam formatos, repetições e opções extras', () => {
  for (const p of ['3010', 3015, '3029']) assert.equal(validarPorta(p), Number(p));
  for (const p of ['3000', '3001', '3002', '3030', '03015', '3015x']) assert.throws(() => validarPorta(p));
  for (const n of ['od017', 'antes-2']) assert.equal(validarNome(n), n);
  for (const n of ['../x', 'a', 'UPPER', 'a b', 'x'.repeat(21)]) assert.throws(() => validarNome(n));
  assert.equal(validarCommit('abcdef1'), 'abcdef1');
  for (const sha of ['zz', 'HEAD', 'abcdef', 'a'.repeat(41), '1234567;evil']) assert.throws(() => validarCommit(sha));
  assert.throws(() => flags({ nome: { type: 'string' } }, ['nome'], ['--shell']));
  assert.throws(() => flags({ nome: { type: 'string' } }, ['nome'], ['--nome', 'ok', '--nome', 'other']));
  assert.throws(() => flags({ nome: { type: 'string' } }, ['nome'], []));
});
test('T5: .env.local descartável de produção impede snapshot', () => {
  const dir = temporary();
  try {
    fs.writeFileSync(path.join(dir, '.env.local'), `NEXT_PUBLIC_SUPABASE_URL=https://${REF_PROD}.supabase.co`);
    assert.throws(() => verificarEnvSnapshot(dir));
    fs.writeFileSync(path.join(dir, '.env.local'), `NEXT_PUBLIC_SUPABASE_URL=https://${REF_QA}.supabase.co`);
    assert.throws(() => verificarEnvSnapshot(dir));
    fs.unlinkSync(path.join(dir, '.env.local'));
    fs.writeFileSync(path.join(dir, 'env.local'), REF_PROD);
    assert.throws(() => verificarEnvSnapshot(dir));
  } finally { removeTemporary(dir); }
});
test('fixtures: sem traversal, sem cleanup no apply e sem seed no clean', () => {
  const root = temporary();
  try {
    const dir = path.join(root, 'supabase/tests/fixtures'); fs.mkdirSync(dir, { recursive: true });
    for (const n of ['smoke-seed.sql', 'smoke-cleanup.sql']) fs.writeFileSync(path.join(dir, n), 'select 1;');
    assert.equal(resolverFixture('smoke-seed.sql', { root }), path.join(dir, 'smoke-seed.sql'));
    assert.equal(resolverFixture('smoke-cleanup.sql', { root, limpeza: true }), path.join(dir, 'smoke-cleanup.sql'));
    for (const file of ['../migrations/x.sql', 'smoke-cleanup.sql', 'missing.sql', 'X.sql']) assert.throws(() => resolverFixture(file, { root }));
    assert.throws(() => resolverFixture('smoke-seed.sql', { root, limpeza: true }));
  } finally { removeTemporary(root); }
});
test('SQL permite DML/DO e recusa DDL, privilégios, arquivos e execução dinâmica', () => {
  for (const sql of ["insert into pacientes(nome) values('drop table');", "do $$ begin if not exists(select 1) then raise exception 'ausente'; end if; end $$; select 1;", 'begin; delete from pacientes where id=1; commit;']) assert.doesNotThrow(() => guardaSqlFixture(sql));
  for (const sql of ['drop table pacientes;', '/* comentário */ ALTER TABLE pacientes add x int;', 'create policy p on pacientes using(true);', 'grant all on pacientes to anon;', 'revoke select on pacientes from anon;', 'truncate pacientes;', "COPY pacientes TO PROGRAM 'whoami';", "select pg_read_file('/secret');", "do $$ begin execute 'DR' || 'OP TABLE pacientes'; end $$;", `-- ${REF_PROD}\nselect 1;`]) assert.throws(() => guardaSqlFixture(sql));
  assert.equal(temTransacao('begin; select 1; commit;'), true);
  assert.equal(temTransacao("do $$ begin raise notice 'commit'; end $$; insert into t values('begin');"), false);
  assert.throws(() => guardaSqlFixture("select 'incompleto"));
});
test('marcadores são obrigatórios e escapam apóstrofos apenas em memória', () => {
  const sql = "select crypt('<SENHA_QA_X>', 'salt');";
  assert.throws(() => trocarMarcadoresSenha(sql, {}), /defina SENHA_QA_X/);
  assert.equal(trocarMarcadoresSenha(sql, { SENHA_QA_X: "fake'password" }), "select crypt('fake''password', 'salt');");
});
test('mascarar remove valores, URL PostgreSQL, JWT e valores codificados', () => {
  const secret = 'fake-password-123';
  const result = mascarar(`${secret} ${encodeURIComponent(secret)} postgres://other:unknown@host/db eyJabc.eyJdef.signature`, [secret]);
  assert(!result.includes(secret)); assert(!result.includes('postgres://')); assert(!result.includes('eyJabc'));
  const escaped = 'fake-"password-\\value';
  assert(!mascarar(JSON.stringify(escaped), [escaped]).includes('password'));
});
test('a CA pública TLS é a Supabase Root 2021 CA, sem chave privada e com validade vigente', () => {
  const pem = fs.readFileSync(new URL('./supabase-ca.crt', import.meta.url), 'utf8');
  const certificate = new X509Certificate(pem);
  assert.equal(certificate.ca, true);
  assert(certificate.verify(certificate.publicKey));
  assert.equal(certificate.fingerprint256.replaceAll(':', ''), '807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA');
  assert(Date.now() > Date.parse(certificate.validFrom) && Date.now() < Date.parse(certificate.validTo));
  assert(!pem.includes('PRIVATE KEY'));
});
test('lerVariavel retém somente QA_DB_URL, e contas usa o parser de comentário/linhas QA', async () => {
  const dir = temporary();
  try {
    const file = path.join(dir, 'synthetic.env');
    fs.writeFileSync(file, `PROD_DB_URL=not-used\nQA_DB_URL='qa-only'\nOTHER=value\n`);
    assert.equal(await lerVariavel(file, 'QA_DB_URL'), 'qa-only');
    assert.equal(await lerVariavel(file, 'MISSING'), undefined);
    const result = contasQa('# Senha de todas: fake-password\nana@example.invalid -> Dra. Ana\ncarlos@example.invalid → Dr. Carlos Local\n');
    assert.equal(result.contas.length, 2); assert.equal(result.contas[0].senha, 'fake-password');
    assert.throws(() => contasQa('missing'));
  } finally { removeTemporary(dir); }
});
test('ambiente herdado não impõe credenciais Supabase ao Next do snapshot', () => {
  assert.deepEqual(childEnv({ PATH: 'example', SUPABASE_SERVICE_ROLE_KEY: 'fake', NEXT_PUBLIC_SUPABASE_URL: 'fake', SUPABASE_URL: 'fake' }), { PATH: 'example' });
});
test('identidade de processo exige o snapshot e a porta exatos', () => {
  const dir = 'C:/Projetos clone/Odonto.IA-od017';
  assert(processoSnapshot(`node "${dir}/node_modules/next/dist/bin/next" dev --webpack -p 3015`, 3015, dir));
  assert(!processoSnapshot(`node C:/principal/node_modules/next/dist/bin/next dev -p 3015`, 3015, dir));
  assert(!processoSnapshot(`node "${dir}/node_modules/next/dist/bin/next" dev -p 30150`, 3015, dir));
});
test('T12: comando real usa a porta registrada e recusa porta sem registro antes de iniciar Playwright', () => {
  const records = [{ nome: 'od017', porta: 3020, commit: 'abcdef1', pid: 123 }];
  const plan = planoE2e({ porta: '3020', pasta: 'e2e/qa2', records, env: { QA_BASE_URL: 'http://old.invalid', MD_RETEST_READY: 'operator-value' } });
  assert.equal(plan.env.QA_BASE_URL, 'http://localhost:3020');
  assert.equal(plan.env.MD_SCOPE, 'changed');
  assert.equal(plan.env.MD_RETEST_READY, 'operator-value');
  assert.deepEqual(plan.args.slice(1), ['test', 'e2e/qa2', '--workers=1', '--retries=0']);
  assert.throws(() => planoE2e({ porta: 3021, pasta: 'e2e/qa2', records }), /sem snapshot registrado/);
  assert.throws(() => planoE2e({ porta: 3020, pasta: 'e2e/../outside', records }));
  assert.throws(() => planoE2e({ porta: 3020, pasta: 'e2e/qa2', escopo: 'anything', records }));
});
test('T6: desfazer junção preserva todos os arquivos do alvo e nunca aceita o principal', () => {
  const dir = temporary(); const main = path.join(dir, 'main'); const snap = path.join(dir, 'main-od017');
  const target = path.join(main, 'node_modules'); const link = path.join(snap, 'node_modules');
  fs.mkdirSync(path.join(target, 'next'), { recursive: true }); fs.mkdirSync(snap);
  fs.writeFileSync(path.join(target, 'next/package.json'), '{"fixture":true}');
  fs.writeFileSync(path.join(target, 'sentinel'), 'keep');
  fs.symlinkSync(target, link, 'junction');
  try {
    assert.throws(() => desfazerJuncao(main, main));
    desfazerJuncao(snap, main);
    assert(!fs.existsSync(link));
    assert.equal(fs.readFileSync(path.join(target, 'sentinel'), 'utf8'), 'keep');
    assert.equal(fs.readdirSync(target, { recursive: true }).filter(p => fs.statSync(path.join(target, p)).isFile()).length, 2);
  } finally {
    // Never recurse into the temporary directory if the junction was not removed.
    if (!fs.existsSync(link)) removeTemporary(dir);
  }
});
test('CLI recusa flags inválidas antes de carregar ambiente ou criar worktree', () => {
  for (const args of [
    ['snapshot-up.mjs', '--nome', 'od017', '--commit', 'abcdef1', '--porta', '3000'],
    ['snapshot-up.mjs', '--nome', '../x', '--commit', 'abcdef1', '--porta', '3015'],
    ['snapshot-up.mjs', '--nome', 'od017', '--commit', 'zz', '--porta', '3015'],
    ['snapshot-up.mjs', '--nome', 'od017', '--commit', 'abcdef1', '--porta', '3015', '--shell'],
    ['snapshot-down.mjs', '--porta', '3000'],
    ['fixture-apply.mjs', '--arquivo', '../migrations/x.sql'],
    ['fixture-apply.mjs', '--arquivo', 'od017-smoke-cleanup.sql'],
  ]) {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/qa', args[0]), ...args.slice(1)], { encoding: 'utf8', shell: false, windowsHide: true });
    assert.equal(result.status, 2, args[0]);
    assert.match(result.stderr, /RECUSA/);
  }
});
