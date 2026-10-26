import { start, id, base, positiveName, assert, expect, rows } from './harness.mjs';
const h = await start('07-positivos');
async function reload(page) {
  try { await page.reload({ waitUntil: 'domcontentloaded' }); }
  catch (e) {
    if (!e.message.includes('ERR_ABORTED')) throw e;
    // O Next dev pode substituir a navegação pelo refresh que acabou de disparar.
    // Somente leitura é retomada; nunca reenviar a mutação.
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  }
}
try {
  const sessions = {};
  for (const role of ['ANA', 'SARA', 'ADMIN']) { sessions[role] = await h.login(role); await sessions[role].page.goto(base + '/dashboard/agendamentos?d=2026-11-25&v=dia'); }
  await h.check('Seed Auth positivos:3pacientes/9agendamentos novos na faixa própria, sem colisão', async () => {
    const patients = [], agenda = [];
    for (const [i, role] of ['ANA', 'SARA', 'ADMIN'].entries()) {
      const s = sessions[role], owner = role === 'SARA' ? sessions.ANA : s;
      const patient = { id: id(6101 + i), clinica_id: s.clinica_id, dentista_id: owner.id, nome: positiveName(role) };
      assert.equal((await h.get('pacientes', patient.id)).length, 0); patients.push(patient);
      for (let j = 0; j < 3; j++) agenda.push({ id: id(6200 + i * 10 + j), clinica_id: s.clinica_id, dentista_id: owner.id, paciente_id: patient.id, data_hora: `2026-11-25T${13 + j}:00:00-03:00`, duracao_minutos: 30, status: 'scheduled', observacoes: 'QA D2 Observação positiva original', google_event_id: null });
    }
    // Uma transação parametrizada deixa zero fixture parcial caso algum preflight falhe.
    await h.pgRun(async pg => {
      await pg.query('begin');
      try {
        for (const p of patients) await pg.query('insert into public.pacientes(id,clinica_id,dentista_id,nome) values($1,$2,$3,$4)', [p.id, p.clinica_id, p.dentista_id, p.nome]);
        for (const a of agenda) await pg.query('insert into public.agendamentos(id,clinica_id,dentista_id,paciente_id,data_hora,duracao_minutos,status,observacoes) values($1,$2,$3,$4,$5,$6,$7,$8)', [a.id, a.clinica_id, a.dentista_id, a.paciente_id, a.data_hora, a.duracao_minutos, a.status, a.observacoes]);
        await pg.query('commit');
      } catch (e) { await pg.query('rollback'); throw e; }
    });
    h.report.ids = { pacientes: patients.map(p => p.id), agendamentos: agenda.map(a => a.id) }; h.save();
    return h.report.ids;
  });
  if (h.report.casos.some(c => c.resultado === 'FALHOU')) throw new Error('Preparo positivos falhou; sem repetição de escrita');
  for (const [i, role] of ['ANA', 'SARA', 'ADMIN'].entries()) {
    const s = sessions[role], patientId = id(6101 + i), fixtureName = positiveName(role);
    await h.check(`${role} Auth positivo marcarNoShow persiste no_show e recarrega`, async () => {
      const target = id(6200 + i * 10); const before = (await h.get('agendamentos', target))[0];
      const r = await h.action(role, 'marcarNoShow', [target], '/dashboard/agendamentos'); assert.deepEqual(r, {});
      const now = (await h.get('agendamentos', target))[0]; assert.equal(now.status, 'no_show'); assert.equal(now.paciente_id, before.paciente_id); assert.equal(now.observacoes, before.observacoes);
      await reload(s.page); assert.equal((await h.get('agendamentos', target))[0].status, 'no_show');
      return { id: target, response: r, status: now.status, recarga: true };
    }, s.page);
    await h.check(`${role} Auth positivo cancelar com motivo preserva observação; notificação só Sara`, async () => {
      const target = id(6201 + i * 10), title = `Consulta cancelada — ${fixtureName}`;
      const notifications = () => rows(h.db.from('notificacoes').select('id,para_dentista_id,tipo,titulo,mensagem').eq('clinica_id', s.clinica_id).eq('titulo', title));
      const before = await notifications(); assert.equal(before.length, 0);
      const r = await h.action(role, 'cancelarComMotivo', [target, `QA D2 Motivo ${role}`], '/dashboard/agendamentos'); assert.deepEqual(r, {});
      const now = (await h.get('agendamentos', target))[0]; assert.equal(now.status, 'cancelled'); assert.equal(now.observacoes, `[Cancelado: QA D2 Motivo ${role}]\nQA D2 Observação positiva original`); assert.equal(now.google_event_id, null);
      const after = await notifications(); assert.equal(after.length, role === 'SARA' ? 1 : 0);
      if (role === 'SARA') { assert.equal(after[0].para_dentista_id, sessions.ANA.id); assert.ok(after[0].mensagem.includes('QA D2 Motivo SARA')); }
      await reload(s.page); assert.equal((await h.get('agendamentos', target))[0].status, 'cancelled');
      return { id: target, response: r, observacoes: now.observacoes, notificacoes: after, recarga: true };
    }, s.page);
    await h.check(`${role} Auth positivo deletar agendamento remove somente ID próprio e recarrega`, async () => {
      const target = id(6202 + i * 10); assert.equal((await h.get('agendamentos', target)).length, 1);
      const siblings = await rows(h.db.from('agendamentos').select('id,status,observacoes').eq('paciente_id', patientId).neq('id', target).order('id'));
      const r = await h.action(role, 'deletarAgendamento', [target], '/dashboard/agendamentos'); assert.deepEqual(r, {}); assert.equal((await h.get('agendamentos', target)).length, 0);
      assert.deepEqual(await rows(h.db.from('agendamentos').select('id,status,observacoes').eq('paciente_id', patientId).order('id')), siblings);
      await reload(s.page); assert.equal((await h.get('agendamentos', target)).length, 0); return { id: target, response: r, removido: true, demaisPreservados: true };
    }, s.page);
    await h.check(`${role} Auth positivo atualizar paciente persiste nome e recarrega cabeçalho`, async () => {
      const before = (await h.get('pacientes', patientId))[0], changedName = fixtureName + ' Atualizado';
      const r = await h.action(role, 'atualizarPaciente', [patientId, { nome: changedName }], '/dashboard/pacientes/' + patientId); assert.deepEqual(r, {});
      const now = (await h.get('pacientes', patientId))[0]; assert.equal(now.nome, changedName); assert.equal(now.dentista_id, before.dentista_id); assert.equal(now.clinica_id, before.clinica_id);
      await s.page.goto(base + '/dashboard/pacientes/' + patientId); await reload(s.page);
      await expect(s.page.getByRole('heading', { name: changedName, exact: true }).first()).toBeVisible();
      return { id: patientId, response: r, nome: now.nome, dentistaPreservado: true, recarga: true };
    }, s.page);
  }
  h.report.limites.push('Integração externa Google Calendar não exercitada:fixtures novas sem google_event_id; não usar conta externa real. UI comprova recarga, chamadas são Server Actions com Auth real.');
} finally { await h.finish(); }
