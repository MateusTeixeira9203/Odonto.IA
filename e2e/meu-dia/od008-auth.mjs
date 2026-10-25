import fs from 'node:fs';
import path from 'node:path';
import { assert, randomUUID, expect, base, host, outDir, evidencePath, save, read, localDay, rows, observer, snapshot, sessions, apiLogin, browserLogin, launch, record, deniedUnchanged, serverDates } from './od008-support.mjs';

const resume = process.env.OD008_RESUME === 'fixture-only';
assert(!fs.existsSync(evidencePath) || resume, 'Evidência já existe; não repetir escritas.');
const evidence = resume ? read() : { commit: 'e0a2662', host, base, started: new Date().toISOString(), prefix: `QA OD008 ${Date.now()}`, identities: {}, patients: [], appointments: [], orders: {}, orderIds: [], cases: [] };
if (resume) { assert.equal(Object.keys(evidence.orders).length, 0); assert.equal(evidence.cases.length, 0); evidence.fixtureResume = 'Primeiro preparo: Ana criou seu slot; insert do slot Carlos por Ana foi recusado. Retomar por identidade responsável, após SELECT de existência.'; }
save(evidence);
for (const role of ['ANA', 'CARLOS', 'ADMIN', 'SECRETARIA', 'PROTETICO', 'BRUNO']) {
  const s = await apiLogin(role);
  evidence.identities[role] = { userId: s.userId, dentistId: s.dentistId, clinicId: s.clinicId, role: s.role, name: s.name };
  save(evidence);
}
for (const role of ['CARLOS', 'ADMIN', 'SECRETARIA', 'PROTETICO']) assert.equal(sessions[role].clinicId, sessions.ANA.clinicId);
assert.notEqual(sessions.BRUNO.clinicId, sessions.ANA.clinicId);
evidence.initial ??= await snapshot(evidence); save(evidence);
async function patient(role, label) {
  const s = sessions[role]; const fixture = { id: randomUUID(), label, name: `${evidence.prefix} ${label}`, clinicId: s.clinicId };
  const previous = evidence.patients.find(p => p.label === label);
  if (previous) { assert.equal((await rows(observer.from('pacientes').select('id').eq('id', previous.id))).length, 1); return previous; }
  evidence.patients.push(fixture); save(evidence);
  const r = await s.client.from('pacientes').insert({ id: fixture.id, nome: fixture.name, clinica_id: s.clinicId, dentista_id: s.dentistId });
  assert(!r.error, r.error?.message); return fixture;
}
const primary = await patient('ANA', 'principal');
const alternate = await patient('ANA', 'alternativo');
const foreign = await patient('BRUNO', 'clinica B');
for (const [index, role] of ['ANA', 'CARLOS', 'ADMIN', 'SECRETARIA'].entries()) {
  const p = await patient('ANA', `UI ${role}`);
  const dentist = role === 'SECRETARIA' ? sessions.ANA : sessions[role];
  const date = new Date(); date.setUTCDate(date.getUTCDate() + 2); const day = date.toISOString().slice(0, 10);
  const previous = evidence.appointments.find(a => a.role === role);
  const appt = previous ?? { id: randomUUID(), role, patientId: p.id, patientName: p.name, clinicId: sessions.ANA.clinicId, dentistId: dentist.dentistId, date: day, time: `${10 + index}:10` };
  if (!previous) evidence.appointments.push(appt); save(evidence);
  if ((await rows(observer.from('agendamentos').select('id').eq('id', appt.id))).length) continue;
  const r = await sessions[role].client.from('agendamentos').insert({ id: appt.id, clinica_id: appt.clinicId, paciente_id: p.id, dentista_id: appt.dentistId, data_hora: `${appt.date}T${appt.time}:00-03:00`, duracao_minutos: 15, status: 'scheduled', observacoes: `${evidence.prefix} Agenda ${role}`, created_by: sessions[role].dentistId });
  assert(!r.error, r.error?.message);
}
const alternatives = await rows(observer.from('dentistas').select('id,role').eq('clinica_id', sessions.ANA.clinicId).eq('role', 'protetico').neq('id', sessions.PROTETICO.dentistId));
const otherRecipient = alternatives[0]?.id ?? sessions.CARLOS.dentistId;
evidence.otherRecipient = { id: otherRecipient, role: alternatives[0]?.role ?? 'dentista', note: alternatives.length ? 'Segundo protético existente' : 'Outro destinatário da mesma clínica; sem criar nova identidade' };
async function order(key, { role = 'ANA', recipient = sessions.PROTETICO.dentistId, patientId = primary.id } = {}) {
  const s = sessions[role]; const id = randomUUID(); evidence.orderIds.push(id);
  const payload = { id, clinica_id: s.clinicId, protetico_id: recipient, dentista_id: s.dentistId, paciente_id: patientId, observacao: `${evidence.prefix} ${key}`, data_entrega: localDay(), status: 'pendente' };
  evidence.orders[key] = payload; save(evidence);
  const r = await s.client.from('pedidos_protetico').insert(payload).select('*'); assert(!r.error, r.error?.message);
  return payload;
}
const ui = await order('ENTREGA_UI'); const api = await order('HORA_FORJADA_API'); const guard = await order('GUARDA');
const other = await order('OUTRO_DESTINATARIO_A', { recipient: otherRecipient });
const foreignOrder = await order('PEDIDO_B', { role: 'BRUNO', recipient: sessions.BRUNO.dentistId, patientId: foreign.id });
evidence.seeded = await snapshot(evidence); save(evidence);
const browser = await launch();
try {
  const { page } = await browserLogin(browser, 'PROTETICO');
  await page.goto(base + '/dashboard/protetico');
  const card = observation => page.locator('div.rounded-2xl').filter({ has: page.getByText(observation, { exact: true }) });
  await expect(card(ui.observacao)).toHaveCount(1);
  await expect(page.getByText(other.observacao, { exact: true })).toHaveCount(0);
  await expect(page.getByText(foreignOrder.observacao, { exact: true })).toHaveCount(0);
  const before = await snapshot(evidence); const serverBefore = serverDates.at(-1);
  await card(ui.observacao).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, 'protetico-entrega-antes.png') });
  await card(ui.observacao).getByRole('button', { name: 'Entregue', exact: true }).click();
  await expect(page.getByText('Marcado como entregue!', { exact: true })).toBeVisible({ timeout: 20000 });
  await expect.poll(async () => (await rows(observer.from('pedidos_protetico').select('status').eq('id', ui.id).single())).status, { timeout: 20000 }).toBe('entregue');
  const after = await snapshot(evidence); const delivered = after.own.rows.find(row => row.id === ui.id);
  assert(delivered.entregue_em); assert(Math.abs(Date.parse(delivered.entregue_em) - Date.parse(serverDates.at(-1))) < 10000);
  evidence.cases.push({ label: 'PROTETICO entrega real pela tela', passed: true, toast: 'Marcado como entregue!', serverBefore, serverAfter: serverDates.at(-1), before, after }); save(evidence);
  await page.reload(); await expect(card(ui.observacao).getByRole('button', { name: 'Entregue', exact: true })).toHaveCount(0);
  await page.screenshot({ path: path.join(outDir, 'protetico-entrega-depois-reload.png') });
  console.log('PASSOU entrega real pela tela e recarga');
  const forged = '1999-01-01T00:00:00.000Z';
  await record(evidence, 'PROTETICO data de entrega e updated_at forjados ignorados', () => sessions.PROTETICO.client.from('pedidos_protetico').update({ status: 'entregue', entregue_em: forged, updated_at: forged }).eq('id', api.id).select('*'), (r, _before, state) => {
    assert(!r.error); assert.equal(r.data.length, 1);
    const row = state.own.rows.find(row => row.id === api.id);
    assert.equal(row.status, 'entregue'); assert.notEqual(row.entregue_em, forged); assert.notEqual(row.updated_at, forged);
    assert(Math.abs(Date.parse(row.entregue_em) - Date.parse(serverDates.at(-1))) < 10000);
  });
  // O cartão foi carregado pendente antes da entrega REST: uma recusa REAL da action,
  // sem fabricar resposta de erro e sem outra atualização clínica.
  const refusalBefore = await snapshot(evidence);
  await card(api.observacao).getByRole('button', { name: 'Entregue', exact: true }).click();
  const refusalText = 'Pedido não encontrado, ou já foi marcado como entregue.';
  await expect(page.getByText(refusalText, { exact: true })).toBeVisible({ timeout: 20000 });
  const refusalAfter = await snapshot(evidence); assert.equal(refusalBefore.own.hash, refusalAfter.own.hash);
  evidence.cases.push({ label: 'PROTETICO recusa real na tela com cartão obsoleto', passed: true, exactText: refusalText, before: refusalBefore, after: refusalAfter, note: 'Recusa count=0 da action; não é mensagem do trigger42501.' }); save(evidence);
  await page.screenshot({ path: path.join(outDir, 'protetico-recusa-texto-exato.png') });
  const mutationId = randomUUID(); evidence.orderIds.push(mutationId); save(evidence);
  const mutations = { protetico_id: otherRecipient, dentista_id: sessions.CARLOS.dentistId, paciente_id: alternate.id, id: mutationId, observacao: `${evidence.prefix} descricao alterada`, clinica_id: sessions.BRUNO.clinicId, agendamento_id: evidence.appointments[0].id, data_entrega: '2026-12-01', created_at: forged };
  for (const [field, value] of Object.entries(mutations)) {
    const item = await record(evidence, `PROTETICO proibir ${field} junto da entrega válida`, () => sessions.PROTETICO.client.from('pedidos_protetico').update({ status: 'entregue', [field]: value }).eq('id', guard.id).select('*'), (r, a, b) => { assert.equal(r.error?.code, '42501'); deniedUnchanged(r, a, b); });
    if (!item.passed) throw Error(`Parada: guarda ${field} não passou; não mascarar os campos seguintes com estado já alterado.`);
  }
  await record(evidence, 'PROTETICO desfazer entregue para pendente', () => sessions.PROTETICO.client.from('pedidos_protetico').update({ status: 'pendente' }).eq('id', ui.id).select('*'), (r, a, b) => { assert.equal(r.error?.code, '42501'); deniedUnchanged(r, a, b); });
  await record(evidence, 'PROTETICO apagar pedido próprio', () => sessions.PROTETICO.client.from('pedidos_protetico').delete().eq('id', ui.id).select('*'), deniedUnchanged);
  const blockedId = randomUUID(); evidence.orderIds.push(blockedId); save(evidence);
  await record(evidence, 'PROTETICO criar pedido REST', () => sessions.PROTETICO.client.from('pedidos_protetico').insert({ ...guard, id: blockedId, observacao: `${evidence.prefix} INSERT proibido` }).select('*'), (r, a, b) => { assert.equal(r.error?.code, '42501'); deniedUnchanged(r, a, b); });
  const visible = await rows(sessions.PROTETICO.client.from('pedidos_protetico').select('id,protetico_id,clinica_id'));
  assert(visible.every(row => row.protetico_id === sessions.PROTETICO.dentistId && row.clinica_id === sessions.PROTETICO.clinicId));
  for (const target of [other, foreignOrder]) assert(!visible.some(row => row.id === target.id));
  evidence.cases.push({ label: 'PROTETICO SELECT só próprios', passed: true, visibleCount: visible.length, ownFixtureIds: visible.filter(row => evidence.orderIds.includes(row.id)).map(row => row.id), excluded: [other.id, foreignOrder.id] }); save(evidence);
  const createControls = await page.getByRole('button', { name: /criar|novo pedido|enviar.*protético/i }).count();
  evidence.cases.push({ label: 'PROTETICO tela sem criação', passed: createControls === 0, createControls, url: page.url() }); save(evidence);
  for (const role of ['ANA', 'CARLOS', 'ADMIN', 'SECRETARIA']) {
    const seen = await rows(sessions[role].client.from('pedidos_protetico').select('id').in('id', [ui.id, guard.id, other.id]));
    evidence.cases.push({ label: `${role} SELECT pedidos A`, passed: seen.length === 3, ids: seen.map(row => row.id) }); save(evidence);
  }
  const foreignRead = await rows(sessions.BRUNO.client.from('pedidos_protetico').select('id').in('id', [ui.id, api.id, guard.id, other.id]));
  evidence.cases.push({ label: 'BRUNO não lê pedidos A', passed: foreignRead.length === 0, ids: foreignRead.map(row => row.id) }); save(evidence);
  await record(evidence, 'BRUNO não altera pedido A', () => sessions.BRUNO.client.from('pedidos_protetico').update({ observacao: `${evidence.prefix} Bruno proibido` }).eq('id', guard.id).select('*'), deniedUnchanged);
  await record(evidence, 'BRUNO não apaga pedido A', () => sessions.BRUNO.client.from('pedidos_protetico').delete().eq('id', guard.id).select('*'), deniedUnchanged);
  evidence.phase1Final = await snapshot(evidence); evidence.phase1Complete = true; save(evidence);
} catch (error) {
  evidence.phase1Error = error.message; save(evidence); throw error;
} finally { await browser.close(); }
