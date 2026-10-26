import { start, id, name, base, assert, expect } from './harness.mjs';
const h = await start('07-isolamento');
try {
  const b = await h.login('BRUNO'), a = await h.login('ANA');
  await a.page.goto(base + '/dashboard/pacientes/' + id(1));
  await a.page.getByRole('tab', { name: 'Prontuário', exact: true }).click();
  await b.page.goto(base + '/dashboard/agendamentos');
  for (const route of ['/dashboard/pacientes/' + id(1), '/dashboard/meu-dia', '/dashboard/agendamentos?d=2026-11-16', '/dashboard/pacientes', '/dashboard/orcamentos', '/dashboard/financeiro', '/dashboard/protetico']) {
    await h.check('Bruno UI não expõe dados da A: ' + route, async () => {
      const r = await b.page.goto(base + route); await b.page.waitForLoadState('domcontentloaded');
      if (route.endsWith(id(1))) await expect(b.page.getByText('Página não encontrada', { exact: true })).toBeVisible();
      const text = await b.page.locator('body').innerText();
      for (const marker of [name, 'QA-D2-CLINICO-PRIVADO', 'QA D2 Ficha', 'QA D2 Procedimento', 'QA D2 Sintético 3']) assert.ok(!text.includes(marker), 'Vazamento: ' + marker);
      if (route.endsWith(id(1))) assert.match(text, /404|não encontrad|não existe/i);
      return { route, http: r?.status(), urlFinal: new URL(b.page.url()).pathname, semMarcadoresA: true };
    }, b.page);
  }
  for (const endpoint of ['/api/pacientes/' + id(1) + '/prontuario', '/api/fichas/' + id(104) + '/pdf', '/api/orcamentos/' + id(601) + '/pdf']) await h.check('Bruno PDF nega ' + endpoint, async () => {
    const r = await b.page.request.get(base + endpoint); assert.equal(r.status(), 404); return { endpoint, http: r.status() };
  });
  for (const [table, fixture] of [['pacientes', 1], ['fichas', 104], ['agendamentos', 201], ['odontograma_eventos', 303], ['orcamentos', 601], ['pagamentos', 1001]]) await h.check('Bruno RLS leitura/UPDATE não alcança ' + table, async () => {
    const before = await h.get(table, id(fixture));
    const read = await b.client.from(table).select('id').eq('id', id(fixture)); assert.ok(!read.error); assert.deepEqual(read.data, []);
    // Atualização inócua no ID explicitamente conhecido: prova zero linhas afetadas.
    const update = await b.client.from(table).update({ id: id(fixture) }).eq('id', id(fixture)).select('id');
    assert.ok(update.error || update.data.length === 0); assert.deepEqual(await h.get(table, id(fixture)), before);
    return { table, id: id(fixture), lido: 0, atualizado: update.data?.length ?? 0, code: update.error?.code };
  });
  for (const [label, query] of [
    ['ficha B referindo paciente A', () => b.client.from('fichas').insert({ id: id(4501), clinica_id: b.clinica_id, dentista_id: b.id, paciente_id: id(1), origem: 'manual', status: 'aberta', data_atendimento: '2026-10-25' })],
    ['agendamento B referindo paciente A', () => b.client.from('agendamentos').insert({ id: id(4502), clinica_id: b.clinica_id, dentista_id: b.id, paciente_id: id(1), data_hora: '2026-11-20T16:00:00Z', duracao_minutos: 30, status: 'scheduled' })],
    ['trocar paciente do agendamento B por A', () => b.client.from('agendamentos').update({ paciente_id: id(1) }).eq('id', id(202))],
  ]) await h.check('FK isolamento exige 23503: ' + label, async () => {
    const before = await h.ownState(); const r = await query(); assert.equal(r.error?.code, '23503'); assert.deepEqual(await h.ownState(), before); return { codigo: r.error.code, mensagem: r.error.message };
  });
  const save = { pacienteId: id(1), origem: 'manual', dataAtendimento: '2026-10-25', queixaPrincipal: '', anotacoes: 'QA D2 negativa', dentesAfetados: [], dentesObservacoes: {}, procedimentos: [], conduta: '' };
  const schedule = { pacienteId: id(1), dataHora: '2026-11-20T16:00:00Z', duracaoMinutos: 30, observacoes: 'QA D2 negativa' };
  const actions = [
    ['salvarFicha', [save]],
    ['importarHistoricoDoWord', [{ pacienteId: id(1), dataAtendimento: '2026-10-25', texto: 'QA D2 negativa' }]],
    ['salvarAtendimentoDoProntuario', [{ visitaKey: id(4601), pacienteId: id(1), textoVisita: 'QA D2 negativa', eventosDraft: [], alertaNovo: null, ortoManutencao: null, destinoNovos: { fichaId: null } }]],
    ['salvarEventosOdontograma', [{ fichaId: id(106), pacienteId: id(1), eventos: [] }]],
    ['deletarFicha', [id(104), { motivo: 'aberta_por_engano', nomePaciente: name, confirmaOrcamentoAceito: false }]],
    ['editarDetalhesEvento', [{ eventoId: id(303), detalhe: null, alterarDetalhe: false, observacao: 'QA D2 negativa', alterarObservacao: true }]],
    ['excluirProcedimento', [{ eventoId: id(303) }]],
    ['alternarStatusRegistro', [{ eventoIds: [id(303)], novoStatus: 'realizado' }]],
    ['alternarMomentoRegistro', [{ eventoIds: [id(303)], novoMomento: 'proxima_sessao' }]],
    ['criarAgendamento', [schedule]], ['criarEncaixe', [schedule]],
    ['atualizarAgendamento', [id(201), { pacienteId: id(2) }]],
    ['fazerCheckIn', [id(201)]], ['iniciarAtendimento', [id(201)]], ['marcarNoShow', [id(201)]],
    ['cancelarComMotivo', [id(201), 'QA D2 negativa']], ['deletarAgendamento', [id(201)]],
    ['editarOrcamento', [id(601), [], 0]], ['excluirOrcamento', [id(601), id(1)]],
    ['atualizarPaciente', [id(1), { nome: 'QA D2 NUNCA DEVE MUDAR' }]],
  ];
  for (const [action, args] of actions) await h.check('Bruno ação negativa: ' + action, async () => {
    const before = await h.ownState(); const r = await h.action('BRUNO', action, args);
    assert.deepEqual(await h.ownState(), before, 'Efeito indevido');
    assert.ok(r.error || r.ok === false, 'Sucesso aparente não é recusa explícita: ' + JSON.stringify(r));
    if (['editarDetalhesEvento', 'excluirProcedimento'].includes(action)) assert.equal(r.error, 'Registro não encontrado.');
    return { action, resultado: r, semEfeito: true };
  });
  h.report.limites.push('Matriz cobre as rotas e 20 ações enumeradas, não todo endpoint possível; não testar cadastros/configurações globais fora das fixtures próprias.');
  await h.check('Reverificação somente leitura: paciente A mostra página não encontrada após SSR estabilizar', async () => {
    await b.page.goto(base + '/dashboard/pacientes/' + id(1));
    await expect(b.page.getByText('Página não encontrada', { exact: true })).toBeVisible();
    assert.ok(!(await b.page.locator('body').innerText()).includes(name));
    return { semVazamento: true, causaDaPrimeiraFalha: 'leitura do shell antes de notFound renderizar; print original já mostra notFound' };
  }, b.page);
} finally { await h.finish(); }
