/** OD-001f1: live Auth/read-only service test. No HTTP/browser claims.
 * RUN_OD001F1_QA=1 node scripts/test-od001f1-minima.mjs
 * Reads local QA credentials in memory; prints only host and case results.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

const expectedHost = 'uhuxteswtvgdnlixwrdu.supabase.co';
const root = process.cwd();
const nativeRequire = createRequire(import.meta.url);
const tables = ['atendimentos_clinicos', 'fichas', 'ficha_evolucoes', 'odontograma_eventos'];
function check(condition, label) {
  assert(condition, label);
  console.log(`PASS: ${label}`);
}
function loader(client) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    function requireModule(name) {
      // Supply the request's authenticated transport, not a fabricated role/context.
      if (name === '@/lib/supabase/server') return { createClient: async () => client };
      if (name === 'react') return { cache: fn => fn };
      if (name === 'next/navigation') return { redirect: () => { throw new Error('Unexpected redirect'); } };
      if (name === 'next/cache') return { revalidatePath: () => { throw new Error('Unexpected success/revalidation'); } };
      if (name === '@/server/patients/rotear-visita' || name === '@/server/patients/finalizar-atendimento') {
        return new Proxy({}, { get: () => () => { throw new Error('Unexpected write branch'); } });
      }
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(file), name);
        const resolved = [base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(existsSync);
        if (!resolved) throw new Error('Local dependency unavailable');
        return load(resolved);
      }
      return nativeRequire(name);
    }
    runInNewContext(code, { module, exports: module.exports, require: requireModule,
      console: { error: () => {} }, Date, Map, Set, process, Buffer, URL }, { filename: path.relative(root, file) });
    return module.exports;
  }
  return name => load(path.join(root, name));
}
async function main() {
  if (process.env.RUN_OD001F1_QA !== '1') { console.log('SKIP: live QA requires RUN_OD001F1_QA=1'); return; }
  process.loadEnvFile('.env.development.local');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.equal(new URL(url).hostname, expectedHost, 'QA host mismatch');
  console.log(`HOST: ${expectedHost}`);
  const accountText = readFileSync('.env.qa-contas', 'utf8');
  const passwordLine = accountText.split(/\r?\n/).find(line => /^#\s*Senha de todas\s*:/i.test(line));
  assert(passwordLine, 'QA password header unavailable');
  const password = passwordLine.replace(/^#\s*Senha de todas\s*:\s*/i, '').trim();
  const observer = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const makeClient = () => createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const target = String(input instanceof Request ? input.url : input);
      if (method !== 'GET' && method !== 'HEAD' && !target.includes('/auth/v1/token')) {
        throw new Error('Read-only QA transport blocked mutation');
      }
      return fetch(input, init);
    } } });
  async function login(email, expectedRole) {
    assert(email.endsWith('@example.invalid') && accountText.includes(email), 'Synthetic account required');
    const client = makeClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    assert(!error && data.user, 'QA login failed');
    const load = loader(client);
    const context = await load('src/server/auth/clinic.ts').requireClinicContext();
    assert.equal(context.role, expectedRole, 'Unexpected QA role');
    return { client, context, load };
  }
  const dentist = await login('dentista.a.r140@example.invalid', 'dentista');
  const prosthetic = await login('protetico.a.qa@example.invalid', 'protetico');
  const secretary = await login('secretaria.a.auditoria@example.invalid', 'secretaria');
  const other = await login('dentista.b.r140@example.invalid', 'dentista');
  const clinicId = dentist.context.clinicId;
  assert.equal(prosthetic.context.clinicId, clinicId);
  assert.equal(secretary.context.clinicId, clinicId);
  assert.notEqual(other.context.clinicId, clinicId);
  async function snapshot() {
    return Promise.all(tables.map(async table => {
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const result = await observer.from(table).select('*').eq('clinica_id', clinicId).order('id').range(offset, offset + 499);
        assert(!result.error && result.data, 'Snapshot unavailable');
        rows.push(...result.data);
        if (result.data.length < 500) break;
      }
      return [table, rows.length, createHash('sha256').update(JSON.stringify(rows)).digest('hex')];
    }));
  }
  const before = await snapshot();
  try {
    const input = { visitaKey: randomUUID(), pacienteId: randomUUID(), agendamentoId: randomUUID(),
      textoVisita: 'QA OD-001f1 synthetic denied request', eventosDraft: [], alertaNovo: null,
      ortoManutencao: null, destinoNovos: { fichaId: null } };
    for (const [label, actor] of [['protetico', prosthetic], ['secretaria', secretary]]) {
      const day = await actor.load('src/app/dashboard/meu-dia/actions.ts').salvarVisitaMeuDia(input);
      const record = await actor.load('src/app/dashboard/pacientes/[id]/prontuario-actions.ts').salvarAtendimentoDoProntuario(input);
      check(!day.ok && day.error === 'Sem permiss\u00e3o.', `${label}: Meu Dia denied`);
      check(!record.ok && record.error === 'Sem permiss\u00e3o.', `${label}: Ficha denied`);
    }
    for (const table of tables) {
      const result = await other.client.from(table).select('id').eq('clinica_id', clinicId).limit(1);
      check(!result.error && result.data.length === 0, `B1: ${table} isolated`);
    }
    const visits = await dentist.client.from('atendimentos_clinicos')
      .select('id,paciente_id,agendamento_id,chave_idempotencia').eq('clinica_id', clinicId)
      .eq('dentista_id', dentist.context.dentistaId).eq('estado', 'finalizado').limit(50);
    assert(!visits.error && visits.data, 'Finalized fixture query failed');
    let fixture;
    for (const visit of visits.data) {
      const patient = await dentist.client.from('pacientes').select('nome').eq('id', visit.paciente_id).single();
      if (!patient.error && /^QA\b/i.test(patient.data.nome) && visit.agendamento_id) { fixture = visit; break; }
    }
    assert(fixture, 'Synthetic finalized Meu Dia fixture unavailable');
    const finalInput = { ...input, visitaKey: fixture.chave_idempotencia,
      pacienteId: fixture.paciente_id, agendamentoId: fixture.agendamento_id };
    const service = dentist.load('src/server/patients/registrar-atendimento-clinico.ts');
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await dentist.load('src/app/dashboard/meu-dia/actions.ts').salvarVisitaMeuDia(finalInput);
      check(!result.ok && result.error === service.MENSAGEM_VISITA_FINALIZADA, `A1: finalized repeat ${attempt + 1} denied`);
    }
  } finally {
    assert.deepEqual(await snapshot(), before, 'Clinical data changed');
    console.log('PASS: four clinical tables unchanged (counts and hashes)');
  }
  console.log('NOT TESTED: HTTP redirects, browser draft preservation, normal new save, B1 write denial');
}
main().catch(error => { const labels = ['Synthetic finalized Meu Dia fixture unavailable', 'Local dependency unavailable', 'Unexpected write branch', 'Unexpected success/revalidation', 'Read-only QA transport blocked mutation']; console.error(labels.find(label => error.message.includes(label)) ?? 'FAIL: QA service test incomplete; sensitive details suppressed'); process.exitCode = 1; });





