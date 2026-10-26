import { start, id, base, positiveName, assert, expect, rows } from './harness.mjs';
const h = await start('07-positivo-ana-releitura');
try {
  const a = await h.login('ANA');
  await h.check('ANA cancelamento já persistido: reler motivo e recarregar sem reenviar mutação', async () => {
    const before = (await h.get('agendamentos', id(6201)))[0];
    assert.equal(before.status, 'cancelled');
    assert.equal(before.observacoes, '[Cancelado: QA D2 Motivo ANA]\nQA D2 Observação positiva original');
    assert.equal((await rows(h.db.from('notificacoes').select('id').eq('clinica_id', a.clinica_id).eq('titulo', 'Consulta cancelada — ' + positiveName('ANA')))).length, 0);
    await a.page.goto(base + '/dashboard/agendamentos?d=2026-11-25&v=dia'); await a.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(a.page.getByRole('button', { name: /Novo agendamento/i }).first()).toBeVisible();
    assert.deepEqual((await h.get('agendamentos', id(6201)))[0], before);
    return { id: id(6201), estado: before.status, motivo: before.observacoes, semNotificacao: true, semReenvio: true, causaPrimeiraFalha: 'ERR_ABORTED na recarga do Next dev; mutação e asserts anteriores já tinham passado. Registro inicial conservado.' };
  }, a.page);
} finally { await h.finish(); }
