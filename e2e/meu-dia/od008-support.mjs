import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
import { contexto, exigirHostQa } from '../../scripts/qa/_lib.mjs';

assert.equal(process.env.OD008_QA_READY, 'e0a2662-APLICADA', 'Opt-in OD008 ausente.');
export { assert, randomUUID, expect };
export const base = 'http://localhost:3011';
export const snapshotDir = path.resolve('../Odonto.IA-depois4');
assert(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: snapshotDir, encoding: 'utf8' }).startsWith('e0a2662'));
export const ctx = await contexto(snapshotDir);
export const host = exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
export const outDir = 'C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/QA-OD008-auth-2026-10-25';
fs.mkdirSync(outDir, { recursive: true });
export const evidencePath = path.join(outDir, 'evidence.json');
export const save = data => fs.writeFileSync(evidencePath, JSON.stringify(data, null, 2));
export const read = () => JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
export const localDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const hash = rows => createHash('sha256').update(JSON.stringify([...rows].sort((a, b) => a.id.localeCompare(b.id)))).digest('hex');
export async function rows(query) { const result = await query; assert(!result.error, result.error?.message); return result.data; }
export const serverDates = [];
export const observer = createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL, ctx.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, init) => {
    assert.equal(new URL(input instanceof Request ? input.url : String(input)).hostname, host);
    assert(['GET', 'HEAD'].includes((init?.method ?? 'GET').toUpperCase()), 'Observador somente leitura.');
    const response = await fetch(input, init);
    if (response.headers.get('date')) serverDates.push(response.headers.get('date'));
    return response;
  } },
});
export async function snapshot(evidence) {
  const all = await rows(observer.from('pedidos_protetico').select('*').order('id'));
  const idSet = new Set(evidence.orderIds ?? []);
  const own = all.filter(row => idSet.has(row.id) || row.observacao?.startsWith(evidence.prefix));
  const existing = all.filter(row => !idSet.has(row.id) && !row.observacao?.startsWith(evidence.prefix));
  return { own: { count: own.length, hash: hash(own), rows: own }, existing: { count: existing.length, hash: hash(existing) } };
}
const emails = { ANA: 'dentista.a.r140@example.invalid', CARLOS: 'dentista.c.auditoria@example.invalid', ADMIN: 'admin.a.auditoria@example.invalid', SECRETARIA: 'secretaria.a.auditoria@example.invalid', PROTETICO: 'protetico.a.qa@example.invalid', BRUNO: 'dentista.b.r140@example.invalid' };
export const sessions = {};
export async function apiLogin(role) {
  const account = ctx.accounts.contas.find(c => c.email === emails[role] || role === 'CARLOS' && /carlos/i.test(c.descricao));
  assert(account, `Conta QA ausente para ${role}`);
  const client = createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL, ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => { assert.equal(new URL(input instanceof Request ? input.url : String(input)).hostname, host); return fetch(input, init); } },
  });
  const auth = await client.auth.signInWithPassword({ email: account.email, password: account.senha });
  assert(!auth.error, `Auth falhou para ${role}; detalhes omitidos.`);
  const user = await rows(client.from('users').select('active_clinica_id').eq('id', auth.data.user.id).single());
  const dentist = await rows(observer.from('dentistas').select('id,nome,role,clinica_id').eq('user_id', auth.data.user.id).eq('clinica_id', user.active_clinica_id).single());
  const rpcRole = await client.rpc('get_my_role');
  const rpcId = await client.rpc('get_my_dentista_id');
  assert(!rpcRole.error && !rpcId.error);
  assert.equal(rpcRole.data, dentist.role); assert.equal(rpcId.data, dentist.id);
  sessions[role] = { client, account, userId: auth.data.user.id, clinicId: user.active_clinica_id, dentistId: dentist.id, name: dentist.nome, role: dentist.role };
  console.log(`AUTH ${role} confirmado`);
  return sessions[role];
}
export async function browserLogin(browser, role) {
  const session = sessions[role] ?? await apiLogin(role);
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith('.supabase.co') && url.hostname !== host) return route.abort();
    return route.continue();
  });
  await page.goto(base + '/login');
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return form && Object.keys(form).some(key => key.startsWith('__reactProps') && typeof Reflect.get(form, key).onSubmit === 'function');
  });
  await page.evaluate(({ email, password }) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const [selector, value] of [['input[type=email]', email], ['input[type=password]', password]]) {
      const element = document.querySelector(selector); setter.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, { email: session.account.email, password: session.account.senha });
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url => url.pathname.startsWith('/dashboard'), { timeout: 60000 });
  return { context, page };
}
export const launch = () => chromium.launch({ channel: 'msedge', headless: true });
export function result(response) { return { http: response.status, error: response.error ? { code: response.error.code, message: response.error.message, details: response.error.details } : null, data: response.data, count: response.count }; }
export async function record(evidence, label, action, check) {
  const before = await snapshot(evidence);
  const response = await action();
  const after = await snapshot(evidence);
  const item = { label, response: result(response), before, after, passed: false };
  try { check(response, before, after); item.passed = true; } catch (error) { item.failure = error.message; }
  evidence.cases.push(item); save(evidence);
  console.log(`${item.passed ? 'PASSOU' : 'FALHOU'} ${label}`);
  return item;
}
export function deniedUnchanged(response, before, after) {
  assert(response.error || response.data?.length === 0, 'A mutação não foi recusada.');
  assert.equal(after.own.hash, before.own.hash); assert.equal(after.own.count, before.own.count);
}
