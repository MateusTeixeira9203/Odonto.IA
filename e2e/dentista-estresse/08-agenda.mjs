import { start, id, base, assert, expect, rows } from './harness.mjs';
const h = await start('08-agenda');
try {
  const a = await h.login('ANA'), p = a.page;
  await p.goto(base + '/dashboard/agendamentos?d=2026-11-17&v=dia');
  let created;
  await h.check('Agenda UI abre novo agendamento com paciente sintético e permite cancelar sem gravar', async () => {
    const before = await h.ownState();
    await p.getByRole('button', { name: /Novo agendamento/i }).first().click();
    const input = p.getByPlaceholder('Buscar paciente pelo nome...', { exact: true }); await input.fill('QA D2 Sintético 3');
    await expect(p.getByText('QA D2 Sintético 3', { exact: true }).first()).toBeVisible();
    await p.getByText('QA D2 Sintético 3', { exact: true }).first().click();
    await h.capture(p, '08-ui-novo-paciente');
    await p.keyboard.press('Escape'); assert.deepEqual(await h.ownState(), before);
    return { aberturaUI: true, busca: id(3), cancelamentoSemEfeito: true };
  }, p);
  await h.check('Agenda criar, persistir ID, recarregar e mostrar na agenda da Ana', async () => {
    const r = await h.action('ANA', 'criarAgendamento', [{ pacienteId: id(3), dataHora: '2026-11-17T13:00:00-03:00', duracaoMinutos: 30, observacoes: 'QA D2 agenda criar', forcarForaDoExpediente: true }], '/dashboard/agendamentos');
    assert.ok(r.id, JSON.stringify(r)); created = r.id; h.report.ids.agendamentoCriado = created; h.save();
    const row = (await h.get('agendamentos', created))[0]; assert.equal(row.paciente_id, id(3)); assert.equal(row.dentista_id, a.id); assert.equal(row.status, 'scheduled');
    await p.reload(); await expect(p.getByText('QA D2 Sintético 3', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    return { id: created, paciente: id(3), status: row.status };
  }, p);
  await h.check('Agenda editar horário/duração/observação e trocar paciente, com recarga', async () => {
    assert.ok(created, 'criação anterior deve passar');
    const r = await h.action('ANA', 'atualizarAgendamento', [created, { pacienteId: id(4), dataHora: '2026-11-17T14:00:00-03:00', duracaoMinutos: 45, observacoes: 'QA D2 agenda editada', forcarForaDoExpediente: true }], '/dashboard/agendamentos'); assert.ok(!r.error, r.error);
    const row = (await h.get('agendamentos', created))[0]; assert.equal(row.paciente_id, id(4)); assert.equal(row.duracao_minutos, 45); assert.equal(row.observacoes, 'QA D2 agenda editada'); assert.equal(new Date(row.data_hora).toISOString(), '2026-11-17T17:00:00.000Z');
    await p.reload(); await expect(p.getByText('QA D2 Sintético 4', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    return { id: created, paciente: id(4), duracao: row.duracao_minutos };
  }, p);
  await h.check('Agenda check-in e repetição não regravam o estado', async () => {
    assert.ok(created); const r = await h.action('ANA', 'fazerCheckIn', [created], '/dashboard/agendamentos'); assert.ok(!r.error, r.error);
    const before = (await h.get('agendamentos', created))[0]; assert.equal(before.status, 'checked_in');
    const again = await h.action('ANA', 'fazerCheckIn', [created], '/dashboard/agendamentos'); assert.match(again.error, /Check-in só é permitido/);
    assert.deepEqual((await h.get('agendamentos', created))[0], before);
    await p.reload(); return { id: created, status: before.status, repeticao: again.error };
  }, p);
  await h.check('Agenda cancelar com motivo mantém paciente correto e persiste após recarga', async () => {
    assert.ok(created); const r = await h.action('ANA', 'cancelarComMotivo', [created, 'QA D2 remarcação sintética'], '/dashboard/agendamentos'); assert.ok(!r.error, r.error);
    const row = (await h.get('agendamentos', created))[0]; assert.equal(row.status, 'cancelled'); assert.equal(row.paciente_id, id(4)); assert.ok(row.observacoes.includes('QA D2 remarcação sintética'));
    await p.reload(); assert.equal((await h.get('agendamentos', created))[0].status, 'cancelled'); return { id: created, status: row.status, motivoPreservado: true };
  }, p);
  await h.check('Agenda encaixe sem colisão, colisão do paciente intransponível mesmo com override', async () => {
    const data = { pacienteId: id(3), dataHora: '2026-11-17T15:30:00-03:00', duracaoMinutos: 30, observacoes: 'QA D2 encaixe' };
    const r = await h.action('ANA', 'criarEncaixe', [data], '/dashboard/agendamentos'); assert.ok(r.id, JSON.stringify(r));
    h.report.ids.encaixe = r.id; h.save(); assert.equal((await h.get('agendamentos', r.id))[0].paciente_id, id(3));
    const before = await rows(h.db.from('agendamentos').select('id').eq('paciente_id', id(3)));
    const collision = await h.action('ANA', 'criarEncaixe', [{ ...data, forcarEncaixe: true }], '/dashboard/agendamentos'); assert.match(collision.error, /paciente já tem um horário/);
    const after = await rows(h.db.from('agendamentos').select('id').eq('paciente_id', id(3))); assert.equal(after.length, before.length);
    await p.reload(); return { encaixe: r.id, recusa: collision.error, semDuplicacao: true };
  }, p);
  await h.check('Agenda recarga por dentista: Bruno só tem sua fixture; Ana mantém agenda sem Bruno', async () => {
    const b = await h.login('BRUNO');
    for (const session of [a, b]) {
      await session.page.goto(base + '/dashboard/agendamentos?d=2026-11-16&v=dia'); await session.page.reload();
      const body = await session.page.locator('body').innerText(); const mine = session === a ? 3 : 2, other = session === a ? 2 : 3;
      assert.ok(body.includes(`QA D2 Sintético ${mine}`)); assert.ok(!body.includes(`QA D2 Sintético ${other}`));
      await h.capture(session.page, `08-reload-${session === a ? 'Ana' : 'Bruno'}`);
    }
    return { ana: id(201), bruno: id(202), isoladosAposRecarga: true };
  });
  h.report.limites.push('Criação/edição/check-in/cancelamento/encaixe executados pela Server Action autenticada; abertura, busca, cancelamento e leitura/recarga na UI. Não equiparar a cliques completos nos formulários de gravação.');
} finally { await h.finish(); }
