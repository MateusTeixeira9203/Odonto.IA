import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { contexto, exigirHostQa, configPgQa, lerVariavel, mascarar, registros } from '../../scripts/qa/_lib.mjs';

export { assert, expect };
export const root = path.resolve(import.meta.dirname, '../..');
const snapshotName = process.env.DENTISTA_D2_SNAPSHOT ?? 'dentistadev2';
assert.match(snapshotName, /^dentistadev2(?:-[a-z0-9-]+)?$/);
export const runtime = path.resolve(root, `../Odonto.IA-${snapshotName}`);
export const commit = process.env.DENTISTA_D2_COMMIT ?? '3d14edb231c318c4f005f57818a41233e8bab6ad';
assert.match(commit, /^[0-9a-f]{40}$/);
export const prefix = process.env.DENTISTA_D2_PREFIX ?? 'd025d200';
assert.match(prefix, /^d025d2[0-9a-f]{2}$/);
const port = process.env.DENTISTA_D2_PORT ?? '3013';
assert.ok(['3013', '3015'].includes(port));
assert.ok(port !== '3015' || snapshotName === 'dentistadev2-iso', '3015 reservada ao reteste autorizado');
export const base = `http://localhost:${port}`;
export const dir = `C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/dentista-dev2-${commit.slice(0, 7)}${prefix === 'd025d200' ? '' : '-' + prefix}`;
export const id = n => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const suffix = prefix === 'd025d200' ? '' : ' ' + prefix;
export const name = 'QA D2 Campanha Dentista' + suffix;
export const patientName = n => `QA D2 Sintético ${n}${suffix}`;
export const positiveName = role => `QA D2 Positivo ${role} ${commit.slice(0, 7)}${suffix}`;
export const emails = { ANA: 'dentista.a.r140@example.invalid', SARA: 'secretaria.a.auditoria@example.invalid', BRUNO: 'dentista.b.r140@example.invalid', ADMIN: 'admin.a.auditoria@example.invalid', PROTETICO: 'protetico.a.qa@example.invalid' };
export const rows = async query => { const r = await query; assert.ok(!r.error, r.error?.message); return r.data; };
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function start(lote) {
  assert.equal(process.env.DENTISTA_D2_READY, `${commit.slice(0, 7)}-odonto-qa`, 'opt-in obrigatório por versão');
  const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: runtime, encoding: 'utf8' }).trim();
  assert.equal(head(), commit);
  const sourceClean = () => assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'src'], { cwd: runtime, encoding: 'utf8' }).trim(), '', 'src do snapshot deve estar limpa');
  sourceClean();
  const record = registros().find(r => r.porta === Number(port));
  assert.equal(record?.nome, snapshotName); assert.equal(record?.commit, commit);
  const ctx = await contexto(runtime);
  const host = exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  assert.equal(host, 'uhuxteswtvgdnlixwrdu.supabase.co');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${lote}.json`);
  assert.ok(!fs.existsSync(file), 'Não repetir lote com escritas; preserve evidência e reveja hipótese');
  const report = { lote, commit, base, host, inicio: new Date().toISOString(), casos: [], limites: [], ids: {} };
  const save = () => fs.writeFileSync(file, JSON.stringify(report, null, 2));
  save();
  const guarded = (input, init) => { assert.equal(new URL(input instanceof Request ? input.url : String(input)).hostname, host); return fetch(input, init); };
  const make = key => createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: guarded } });
  const db = make(ctx.env.SUPABASE_SERVICE_ROLE_KEY);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const sessions = {};
  const get = (table, value, column = 'id') => rows(db.from(table).select('*').eq(column, value));
  async function login(role) {
    if (sessions[role]) return sessions[role];
    const account = ctx.accounts.contas.find(a => a.email === emails[role]); assert.ok(account, `Conta QA ${role}`);
    const client = make(ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const auth = await client.auth.signInWithPassword({ email: account.email, password: account.senha });
    assert.ok(!auth.error, `Auth QA ${role} recusou`);
    const user = await rows(client.from('users').select('active_clinica_id').eq('id', auth.data.user.id).single());
    const dentist = await rows(db.from('dentistas').select('id,nome,clinica_id,role,cro').eq('user_id', auth.data.user.id).eq('clinica_id', user.active_clinica_id).single());
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => {
      const u = new URL(route.request().url());
      if (['data:', 'blob:', 'about:'].includes(u.protocol)) return route.continue();
      if (u.origin === base || u.hostname === host) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(base + '/login');
    await page.waitForFunction(() => { const f = document.querySelector('form'); return f && Object.keys(f).some(k => k.startsWith('__reactProps') && typeof Reflect.get(f, k).onSubmit === 'function'); });
    await page.locator('input[type=email]').fill(account.email);
    await page.locator('input[type=password]').fill(account.senha);
    await page.locator('button[type=submit]').click();
    await page.waitForURL(u => u.pathname.startsWith('/dashboard'), { timeout: 60000 });
    assert.ok((await context.cookies()).some(c => c.name.startsWith('sb-uhuxteswtvgdnlixwrdu-auth-token')));
    return sessions[role] = { client, page, context, ...dentist };
  }
  async function action(role, exportedName, args, route = '/dashboard/pacientes/' + id(1)) {
    const s = await login(role);
    const manifest = JSON.parse(fs.readFileSync(path.join(runtime, '.next/dev/server/server-reference-manifest.json'), 'utf8'));
    const entries = Object.entries(manifest.node).filter(([, v]) => v.exportedName === exportedName);
    assert.ok(entries.length, 'Ação não compilada: ' + exportedName);
    // O manifest do snapshot é a origem, nunca IDs fixos de outro build.
    const actionId = entries[0][0];
    const response = await s.page.request.post(base + route, { headers: { 'next-action': actionId, 'content-type': 'text/plain;charset=UTF-8', accept: 'text/x-component', origin: base }, data: JSON.stringify(args), maxRedirects: 0, timeout: 60000 });
    const body = await response.text();
    const objects = body.split('\n').filter(l => /^[0-9a-f]+:\{/i.test(l)).map(l => JSON.parse(l.slice(l.indexOf(':') + 1), (_k, v) => v === '$undefined' ? undefined : v));
    const result = objects.find(o => Object.hasOwn(o, 'ok') || Object.hasOwn(o, 'error') || Object.hasOwn(o, 'id'));
    if (result) return result;
    if (objects.some(o => Object.keys(o).length === 0)) return {};
    throw new Error(`Ação ${exportedName} sem resultado HTTP ${response.status()}: ${mascarar(body, ctx.segredos).slice(0, 350)}`);
  }
  async function capture(page, label) {
    if (!page || new URL(page.url()).pathname === '/login') return;
    const stem = label.replace(/[^a-zA-Z0-9_-]/g, '-');
    await page.screenshot({ path: path.join(dir, `${stem}.png`), animations: 'disabled', timeout: 15000 });
    // Somente DOM visível; não serializar scripts, cookies ou input de credenciais.
    fs.writeFileSync(path.join(dir, `${stem}.txt`), await page.locator('body').innerText());
  }
  async function check(cenario, fn, page) {
    const c = { cenario, resultado: 'FALHOU', inicio: new Date().toISOString() }; report.casos.push(c); save();
    try { c.evidencia = await fn(c); c.resultado = 'PASSOU'; }
    catch (e) { c.erro = mascarar(e.message, ctx.segredos); }
    try { if (page) await capture(page, `${lote}-${report.casos.length}`); } catch (e) { c.capturaErro = mascarar(e.message, ctx.segredos); }
    c.fim = new Date().toISOString(); save(); console.log(c.resultado + ' ' + cenario);
    return c;
  }
  async function ownState() {
    const out = {};
    for (const t of ['pacientes', 'fichas', 'agendamentos', 'odontograma_eventos', 'orcamentos', 'assinaturas', 'orcamento_cobrancas', 'pagamentos', 'prontuario_exclusoes', 'prontuario_exclusoes_copias']) {
      const col = t === 'pacientes' ? 'id' : 'paciente_id';
      const data = await rows(db.from(t).select('*').in(col, [id(1), id(2), id(3), id(4)]).order(t === 'prontuario_exclusoes_copias' ? 'exclusao_id' : 'id'));
      out[t] = { hash: sha(data), count: data.length };
    }
    return out;
  }
  async function pgRun(fn) {
    const conn = await lerVariavel(path.join(root, '.env.qa-dump'), 'QA_DB_URL'); exigirHostQa(conn);
    const pg = new Client(configPgQa(conn, fs.readFileSync(path.join(root, 'scripts/qa/supabase-ca.crt'))));
    try { await pg.connect(); return await fn(pg); }
    catch (e) { throw new Error(mascarar(e.message, [...ctx.segredos, conn])); }
    finally { await pg.end(); }
  }
  async function finish() {
    try { assert.equal(head(), commit); sourceClean(); report.headDepois = head(); }
    finally { await browser.close(); }
    report.fim = new Date().toISOString(); save();
    const table = report.casos.map((c, i) => `| ${c.cenario.replaceAll('|', '/')} | ${c.resultado} | ${lote}.json #${i + 1}${c.erro ? ': ' + c.erro.replaceAll('|', '/').replaceAll('\n', ' ').slice(0, 500) : ''} |`).join('\n');
    fs.writeFileSync(path.join(dir, `${lote}.md`), `# Campanha dentista Dev 2 · ${lote}\n\nSnapshot ${commit} · ${base} · odonto-qa. HEAD antes/depois conferido. Sem produção.\n\n| Cenário | Resultado | Evidência |\n|---|---|---|\n${table}\n\nLimites: ${report.limites.join('; ') || 'Cobertura limitada aos cenários enumerados; não certifica ausência universal de erros.'}\n\nIDs exatos e dados de retorno seguros: ${lote}.json. Prints/DOM somente de fixtures próprias. Sem trace/HAR/storageState.\n`);
    if (report.casos.some(c => c.resultado === 'FALHOU')) process.exitCode = 1;
  }
  return { ctx, db, browser, login, sessions, get, action, capture, check, ownState, pgRun, report, save, finish };
}
