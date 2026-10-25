// Opt-in HTTP regression against the existing QA server; no production or schema access.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { contexto, exigirHostQa, cli } from './qa/_lib.mjs';

await cli(async () => {
  const a2 = process.env.RUN_SEC_B1_A2_QA === '1';
  if (process.env.RUN_SEC_B1_QA !== '1' && !a2) { console.log('SKIP SEC-B1: use RUN_SEC_B1_QA=1 ou RUN_SEC_B1_A2_QA=1'); return; }
  const ctx = await contexto();
  const base = 'http://localhost:3000';
  const host = exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  console.log(`HOST ${host}; HTTP ${base}`);
  const observer = createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL, ctx.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const target = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(target.hostname, host);
      assert(['GET', 'HEAD'].includes((init?.method ?? 'GET').toUpperCase()));
      return fetch(input, init);
    } },
  });
  const patientId = 'b662fec4-040f-4395-8332-fc6449b17aba';
  const slotId = '48258a21-06a3-45df-8fbd-a8d22a70a649';
  const clinicA = 'b0000000-0000-4000-8000-000000000001';
  const patient = await observer.from('pacientes').select('id,clinica_id').eq('id', patientId).single();
  const slot = await observer.from('agendamentos').select('id,clinica_id,dentista_id,paciente_id').eq('id', slotId).single();
  assert(!patient.error && !slot.error);
  assert.equal(patient.data.clinica_id, clinicA);
  assert.equal(slot.data.clinica_id, clinicA);
  assert.equal(slot.data.paciente_id, patientId);

  async function snapshot() {
    const fichas = await observer.from('fichas').select('*').eq('paciente_id', patientId).order('id');
    assert(!fichas.error);
    const tables = {
      fichas: fichas.data,
      atendimentos_clinicos: (await observer.from('atendimentos_clinicos').select('*').eq('paciente_id', patientId).order('id')),
      odontograma_eventos: (await observer.from('odontograma_eventos').select('*').eq('paciente_id', patientId).order('id')),
      ficha_evolucoes: fichas.data.length
        ? await observer.from('ficha_evolucoes').select('*').in('ficha_id', fichas.data.map(f => f.id)).order('id')
        : { data: [], error: null },
    };
    return Object.fromEntries(Object.entries(tables).map(([name, result]) => {
      const data = Array.isArray(result) ? result : (assert(!result.error), result.data);
      assert(data);
      return [name, { count: data.length, hash: createHash('sha256').update(JSON.stringify(data)).digest('hex') }];
    }));
  }

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const evidence = { host, base, patientId, slotId, cases: [], created: {} };
  const stamp = Date.now();
  const evidenceFile = `.qa/sec-b1-${a2 ? 'a2-' : ''}${stamp}.json`;
  function save() { writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2)); }
  try {
    async function login(index) {
      const account = ctx.accounts.contas[index];
      assert(account.email.endsWith('@example.invalid'));
      const page = await browser.newPage();
      await page.goto(base + '/login');
      await page.waitForFunction(() => {
        const form = document.querySelector('form');
        return form && Object.keys(form).some(k => k.startsWith('__reactProps') && typeof Reflect.get(form, k).onSubmit === 'function');
      });
      await page.locator('input[type=email]').fill(account.email);
      await page.locator('input[type=password]').fill(account.senha);
      await page.locator('button[type=submit]').click();
      await page.waitForURL(u => u.pathname.startsWith('/dashboard'), { timeout: 60000 });
      // Requests from browser and SSR must target only QA/localhost.
      const external = await page.evaluate(() => performance.getEntriesByType('resource')
        .map(r => new URL(r.name).hostname).filter(h => h.endsWith('.supabase.co')));
      assert(external.every(h => h === host));
      return page;
    }
    const ana = await login(0);
    await ana.goto(base + '/dashboard/meu-dia');
    await ana.getByRole('heading', { name: 'Meu Dia', exact: true }).waitFor({ timeout: 60000 });
    // Warm the Prontuário wrapper as well before resolving its server reference.
    await ana.goto(base + '/dashboard/pacientes/' + patientId);
    await ana.getByRole('tab', { name: 'Prontuário', exact: true }).waitFor({ timeout: 60000 });
    const manifest = JSON.parse(readFileSync('.next/dev/server/server-reference-manifest.json', 'utf8'));
    function actionId(name) {
      const action = Object.entries(manifest.node).find(([, value]) => value.exportedName === name)?.[0];
      assert(action, 'Action não compilada');
      return action;
    }
    const input = { visitaKey: randomUUID(), pacienteId: patientId, agendamentoId: slotId,
      textoVisita: 'QA SEC-B1 contenção sintética', eventosDraft: [], alertaNovo: null,
      ortoManutencao: null, destinoNovos: { fichaId: null } };
    async function call(page, action, data) {
      const path = action === 'salvarVisitaMeuDia' ? '/dashboard/meu-dia' : '/dashboard/pacientes/' + patientId;
      const response = await page.request.post(base + path, { headers: {
        'next-action': actionId(action), 'content-type': 'text/plain;charset=UTF-8', accept: 'text/x-component', origin: base,
      }, data: JSON.stringify([data]), maxRedirects: 0, timeout: 60000 });
      assert.equal(response.status(), 200, 'HTTP da action');
      const text = await response.text();
      const line = text.split('\n').find(l => /^\d+:\{"ok":/.test(l));
      assert(line, 'Retorno da action ausente');
      return JSON.parse(line.slice(line.indexOf(':') + 1));
    }
    if (a2) {
      const data = '2026-10-24';
      const payloads = {
        salvarFicha: { pacienteId: patientId, origem: 'manual', dataAtendimento: data,
          queixaPrincipal: '', anotacoes: 'QA SEC-B1 A2 ficha sintética', dentesAfetados: [],
          dentesObservacoes: {}, procedimentos: [], conduta: '' },
        importarHistoricoDoWord: { pacienteId: patientId, dataAtendimento: data, texto: 'QA SEC-B1 A2 histórico sintético' },
      };
      const bruno = await login(4);
      for (const [action, payload] of Object.entries(payloads)) {
        const before = await snapshot();
        const result = await call(bruno, action, payload);
        const after = await snapshot();
        evidence.cases.push({ label: 'A2 Bruno', action, result, before, after }); save();
        assert.equal(result.ok, false);
        assert.equal(result.error, 'Registro nao encontrado.');
        assert.deepEqual(after, before);
        console.log(`PASS A2 Bruno / ${action}: recusa e quatro tabelas iguais`);
      }
      await bruno.context().close();
      for (const [action, payload] of Object.entries(payloads)) {
        const before = await snapshot();
        const result = await call(ana, action, payload);
        const after = await snapshot();
        evidence.cases.push({ label: 'A2 Ana', action, result, before, after }); save();
        assert.equal(result.ok, true);
        const ficha = await observer.from('fichas').select('clinica_id,paciente_id,origem,anotacoes')
          .eq('id', result.fichaId).single();
        assert(!ficha.error);
        assert.equal(ficha.data.clinica_id, clinicA);
        assert.equal(ficha.data.paciente_id, patientId);
        assert.equal(ficha.data.origem, action === 'salvarFicha' ? 'manual' : 'importado');
        assert.equal(ficha.data.anotacoes, payload.anotacoes ?? payload.texto);
        assert.equal(after.fichas.count, before.fichas.count + 1);
        for (const table of ['atendimentos_clinicos', 'ficha_evolucoes', 'odontograma_eventos']) assert.deepEqual(after[table], before[table]);
        console.log(`PASS A2 Ana / ${action}: ficha persistida na A; demais tabelas iguais`);
      }
      console.log(`EVIDÊNCIA ${evidenceFile}; dados sintéticos preservados, sem DELETE`);
      return;
    }
    for (const [label, index, expected] of [
      ['Bruno', 4, 'Registro nao encontrado.'], ['secretaria', 3, 'Sem permissão.'], ['protetico', 5, 'Sem permissão.'],
    ]) {
      const page = await login(index);
      for (const action of ['salvarVisitaMeuDia', 'salvarAtendimentoDoProntuario']) {
        const before = await snapshot();
        const result = await call(page, action, { ...input, visitaKey: randomUUID() });
        const after = await snapshot();
        evidence.cases.push({ label, action, result, before, after }); save();
        assert.equal(result.ok, false);
        assert.equal(result.error, expected);
        assert.deepEqual(after, before, 'Contagens/hashes clínicos mudaram na recusa');
        console.log(`PASS ${label} / ${action}: recusa e quatro tabelas iguais`);
      }
      await page.context().close();
    }
    // Create only a new synthetic appointment through Ana's authenticated client.
    const client = createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL, ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const logged = await client.auth.signInWithPassword({ email: ctx.accounts.contas[0].email, password: ctx.accounts.contas[0].senha });
    assert(!logged.error);
    const newSlot = randomUUID();
    const appointment = await client.from('agendamentos').insert({ id: newSlot, clinica_id: clinicA,
      dentista_id: slot.data.dentista_id, paciente_id: patientId, data_hora: new Date().toISOString(),
      duracao_minutos: 15, status: 'scheduled', observacoes: 'QA SEC-B1 normal sintético', created_by: slot.data.dentista_id });
    assert(!appointment.error, 'Agendamento sintético não criado');
    evidence.created.agendamentoId = newSlot; save();
    const normalInput = { ...input, visitaKey: randomUUID(), agendamentoId: newSlot };
    const normal = await call(ana, 'salvarVisitaMeuDia', normalInput);
    evidence.cases.push({ label: 'Ana normal', result: normal }); save();
    assert.equal(normal.ok, true);
    evidence.created.atendimentoId = normal.atendimentoId;
    evidence.created.fichaId = normal.fichaId; save();
    const persisted = await observer.from('atendimentos_clinicos').select('estado,clinica_id,paciente_id,dentista_id')
      .eq('id', normal.atendimentoId).single();
    const ficha = await observer.from('fichas').select('clinica_id,paciente_id').eq('id', normal.fichaId).single();
    assert(!persisted.error && !ficha.error);
    assert.equal(persisted.data.estado, 'finalizado');
    assert.equal(persisted.data.clinica_id, clinicA);
    assert.equal(persisted.data.paciente_id, patientId);
    assert.equal(persisted.data.dentista_id, slot.data.dentista_id);
    assert.equal(ficha.data.clinica_id, clinicA);
    assert.equal(ficha.data.paciente_id, patientId);
    console.log('PASS Ana: salva normal e persistência conferida');
    const before = await snapshot();
    const repeat = await call(ana, 'salvarVisitaMeuDia', normalInput);
    const after = await snapshot();
    assert.equal(repeat.ok, false);
    assert.equal(repeat.error, 'Esta visita já foi finalizada e está salva na Ficha. Se você acrescentou algo depois, isso não foi gravado: use Novo atendimento na Ficha do paciente.');
    assert.deepEqual(after, before);
    evidence.cases.push({ label: 'Ana finalizada', result: repeat, before, after }); save();
    console.log('PASS Ana: frase finalizada preservada e zero escrita na repetição');
    console.log(`EVIDÊNCIA ${evidenceFile}; dados sintéticos preservados, sem DELETE`);
  } finally { save(); await browser.close(); }
});
