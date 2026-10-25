import fs from 'node:fs';
import path from 'node:path';
import { assert, expect, base, snapshotDir, outDir, read, save, localDay, rows, observer, snapshot, sessions, browserLogin, launch, record } from './od008-support.mjs';

const evidence = read(); assert(evidence.phase1Complete, 'Concluir prova protético primeiro.');
assert(!evidence.uiStarted || process.env.OD008_UI_RESUME === '1', 'Não repetir criação UI.');
evidence.uiStarted = new Date().toISOString(); save(evidence);
const browser = await launch();
try {
  for (const role of ['ANA', 'CARLOS', 'ADMIN', 'SECRETARIA']) {
    const appt = evidence.appointments.find(a => a.role === role); assert(appt);
    const label = `${role} criar pedido pela tela Agenda`;
    if (evidence.cases.some(c => c.label === label)) continue;
    const { page, context } = await browserLogin(browser, role);
    const observation = `${evidence.prefix} UI PEDIDO ${role}`;
    assert.equal((await rows(observer.from('pedidos_protetico').select('id').eq('observacao', observation))).length, 0, 'Pedido já existe; não repetir click.');
    const before = await snapshot(evidence);
    try {
      await page.goto(`${base}/dashboard/agendamentos?v=mes&d=${appt.date}`);
      const patient = page.getByText(appt.patientName, { exact: true }).first();
      await expect(patient).toBeVisible({ timeout: 30000 }); await patient.click();
      await page.getByRole('button', { name: 'Enviar ao protético', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('#pedido-protetico').click();
      await page.getByRole('option', { name: evidence.identities.PROTETICO.name, exact: true }).click();
      await dialog.locator('#pedido-protetico-data').fill(localDay());
      await dialog.locator('#pedido-protetico-observacao').fill(observation);
      await page.screenshot({ path: path.join(outDir, `equipe-${role}-criar-antes.png`) });
      evidence.uiLastClick = { role, observation, at: new Date().toISOString(), appointmentId: appt.id }; save(evidence);
      await dialog.getByRole('button', { name: 'Enviar pedido', exact: true }).click();
      await expect(page.getByText('Enviado pro protético!', { exact: true })).toBeVisible({ timeout: 20000 });
      const created = await rows(observer.from('pedidos_protetico').select('*').eq('observacao', observation));
      assert.equal(created.length, 1); const order = created[0];
      evidence.orderIds.push(order.id); evidence.orders[`UI_${role}`] = order;
      const after = await snapshot(evidence);
      assert.equal(after.own.count, before.own.count + 1); assert.equal(order.clinica_id, evidence.identities.ANA.clinicId);
      assert.equal(order.protetico_id, evidence.identities.PROTETICO.dentistId); assert.equal(order.paciente_id, appt.patientId);
      assert.equal(order.agendamento_id, appt.id);
      evidence.cases.push({ label, passed: true, orderId: order.id, toast: 'Enviado pro protético!', before, after }); save(evidence);
      await page.screenshot({ path: path.join(outDir, `equipe-${role}-criar-depois.png`) });
      console.log('PASSOU ' + label);
      // O produto só oferece criar/enviar na Agenda e entregue no protético.
      // As permissões CRUD restantes são provadas por REST, sem chamar edição de
      // agendamento de "edição de pedido" nem fabricar controles no DOM.
      const readRows = await rows(sessions[role].client.from('pedidos_protetico').select('*').eq('id', order.id));
      evidence.cases.push({ label: `${role} ler pedido próprio REST`, passed: readRows.length === 1, orderId: order.id }); save(evidence);
      await record(evidence, `${role} editar pedido REST`, () => sessions[role].client.from('pedidos_protetico').update({ observacao: `${observation} editado`, data_entrega: '2026-12-02' }).eq('id', order.id).select('*'), (r, a, b) => {
        assert(!r.error); assert.equal(r.data.length, 1); assert.equal(r.data[0].observacao, `${observation} editado`); assert.equal(a.own.count, b.own.count); assert.notEqual(a.own.hash, b.own.hash);
      });
      await record(evidence, `${role} apagar pedido REST (exclusão exigida pelo teste)`, () => sessions[role].client.from('pedidos_protetico').delete().eq('id', order.id).select('*'), (r, a, b) => {
        assert(!r.error); assert.equal(r.data.length, 1); assert.equal(b.own.count, a.own.count - 1);
      });
      evidence.cases.push({ label: `${role} editar/ler/apagar pedido pela tela`, passed: null, status: 'INCONCLUSIVO', note: 'A tela Agenda oferece Enviar ao protético; não há gerenciamento de pedidos com leitura/edição/exclusão. REST acima não prova UI inexistente.' }); save(evidence);
    } catch (error) {
      evidence.cases.push({ label, passed: false, failure: error.message, ui: await page.locator('body').innerText().catch(() => 'DOM indisponível') }); save(evidence);
      await page.screenshot({ path: path.join(outDir, `equipe-${role}-falha.png`) }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  const { page } = await browserLogin(browser, 'PROTETICO');
  await page.goto(base + '/dashboard/protetico');
  const manifest = JSON.parse(fs.readFileSync(path.join(snapshotDir, '.next/dev/server/server-reference-manifest.json'), 'utf8'));
  const action = Object.entries(manifest.node).find(([, value]) => value.exportedName === 'criarPedidoProtetico')?.[0];
  assert(action, 'Action criarPedidoProtetico não compilada.');
  const before = await snapshot(evidence);
  const guard = evidence.orders.GUARDA;
  const response = await page.request.post(base + '/dashboard/agendamentos', {
    headers: { 'next-action': action, 'content-type': 'text/plain;charset=UTF-8', accept: 'text/x-component', origin: base },
    data: JSON.stringify([{ pacienteId: guard.paciente_id, proteticoId: guard.protetico_id, observacao: `${evidence.prefix} action criar proibida`, dataEntrega: localDay() }]),
    maxRedirects: 0, timeout: 60000,
  });
  const text = await response.text();
  const line = text.split('\n').find(line => /^\d+:\{"error":/.test(line));
  const parsed = line ? JSON.parse(line.slice(line.indexOf(':') + 1)) : null;
  const after = await snapshot(evidence);
  evidence.cases.push({ label: 'PROTETICO criar pedido action autenticada real', passed: parsed?.error === 'Você não tem permissão para criar um pedido.' && before.own.hash === after.own.hash, http: response.status(), returned: parsed, before, after }); save(evidence);
  await page.goto(base + '/dashboard/agendamentos');
  const controls = await page.getByRole('button', { name: /novo agendamento|enviar ao protético|enviar pedido/i }).allTextContents();
  evidence.cases.push({ label: 'PROTETICO acesso UI Agenda para criação', passed: page.url() === base + '/dashboard/protetico' && controls.length === 0, url: page.url(), controls, main: await page.locator('main').innerText() }); save(evidence);
  await page.screenshot({ path: path.join(outDir, 'protetico-tentativa-acesso-criacao.png') });
  evidence.final = await snapshot(evidence);
  evidence.existingRowsUnchanged = evidence.final.existing.hash === evidence.initial.existing.hash && evidence.final.existing.count === evidence.initial.existing.count;
  evidence.uiComplete = true; evidence.finished = new Date().toISOString(); save(evidence);
  console.log('UI EQUIPE CONCLUÍDA; registros anteriores ' + (evidence.existingRowsUnchanged ? 'preservados' : 'hash divergente'));
} finally { await browser.close(); }
