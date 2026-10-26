import { start, id, name, assert, expect, rows } from './harness.mjs';
import { openFicha, openDelete, fillDelete, cancelDelete, deleted } from './telas.mjs';
const h = await start('05-apagar');
try {
  const a = await h.login('ANA'), p = a.page;
  await h.check('M3 UI motivo obrigatório, nome incorreto, Outro 4/5/200/201 caracteres', async () => {
    await openFicha(p, 101); const d = await openDelete(p), button = d.getByRole('button', { name: 'Apagar ficha', exact: true });
    await expect(button).toBeDisabled();
    await fillDelete(d, 'outro', 'Nome incorreto');
    const detail = d.getByRole('textbox', { name: 'Descreva em poucas palavras, sem dados clínicos', exact: true });
    await detail.fill('cinco'); await expect(button).toBeDisabled();
    await d.getByRole('textbox', { name: /Para confirmar, digite o nome do paciente/ }).fill(name);
    for (const n of [4, 5, 200, 201]) { await detail.fill('x'.repeat(n)); if (n < 5 || n > 200) await expect(button).toBeDisabled(); else await expect(button).toBeEnabled(); }
    await cancelDelete(d); assert.equal((await h.get('fichas', id(101))).length, 1);
    return { id: id(101), persistiu: true, limites: [4, 5, 200, 201] };
  }, p);
  for (const [label, args, message] of [
    ['motivo inválido', { p_motivo: 'inexistente' }, /motivo_invalido/],
    ['Outro 4', { p_motivo: 'outro', p_motivo_detalhe: '1234' }, /motivo_invalido/],
    ['Outro 201', { p_motivo: 'outro', p_motivo_detalhe: 'x'.repeat(201) }, /motivo_invalido/],
    ['nome incorreto', { p_nome_paciente: 'Outro paciente' }, /confirmacao_invalida/],
  ]) await h.check('M3 RPC recusa ' + label + ' sem efeito', async () => {
    const before = await h.ownState();
    const r = await a.client.rpc('excluir_ficha_clinica', { p_ficha_id: id(101), p_motivo: 'aberta_por_engano', p_motivo_detalhe: null, p_nome_paciente: name, p_confirma_orcamento_aceito: false, ...args });
    assert.ok(r.error); assert.match(r.error.message, message); assert.deepEqual(await h.ownState(), before);
    return { error: r.error.message, code: r.error.code, id: id(101), estadoInalterado: true };
  });
  await h.check('M3 apagar própria ficha na UI; recarga e auditoria com cópia', async () => {
    await openFicha(p, 101); const d = await openDelete(p); await fillDelete(d, 'outro');
    await d.getByRole('textbox', { name: 'Descreva em poucas palavras, sem dados clínicos', exact: true }).fill('Teste sintético D2');
    await d.getByRole('button', { name: 'Apagar ficha', exact: true }).click(); await deleted(h, 101);
    await p.reload(); assert.equal((await h.get('fichas', id(101))).length, 0);
    const audit = await h.get('prontuario_exclusoes', id(101), 'ficha_id'); assert.equal(audit.length, 1);
    const copy = await h.get('prontuario_exclusoes_copias', id(101), 'ficha_id'); assert.equal(copy.length, 1);
    return { ficha: id(101), auditoria: audit[0].id, copia: copy[0].exclusao_id };
  }, p);
  await h.check('M3 aceite exige Entendi; sem marcar não apaga; marcado preserva orçamento/cobranças/pagamentos', async () => {
    const budget = (await h.get('orcamentos', id(601)))[0]; assert.ok(budget);
    const sig = await h.get('assinaturas', id(1101)); const charge = await h.get('orcamento_cobrancas', id(901)); const payment = await h.get('pagamentos', id(1001));
    await openFicha(p, 102); const d = await openDelete(p); await fillDelete(d);
    await expect(d.getByText(/orçamento aceito pelo paciente/, { exact: false }).first()).toBeVisible();
    await expect(d.getByRole('button', { name: 'Apagar ficha', exact: true })).toBeDisabled();
    await d.getByRole('checkbox', { name: /Entendi/ }).check();
    await d.getByRole('button', { name: 'Apagar ficha', exact: true }).click(); await deleted(h, 102);
    const now = (await h.get('orcamentos', id(601)))[0]; assert.equal(now.ficha_id, null);
    const oldRest = { ...budget }, newRest = { ...now };
    for (const key of ['ficha_id', 'updated_at']) { delete oldRest[key]; delete newRest[key]; }
    assert.deepEqual(newRest, oldRest); assert.deepEqual(await h.get('assinaturas', id(1101)), sig);
    assert.deepEqual(await h.get('orcamento_cobrancas', id(901)), charge); assert.deepEqual(await h.get('pagamentos', id(1001)), payment);
    await p.reload(); await p.getByRole('tab', { name: 'Orçamentos', exact: true }).click();
    await expect(p.getByRole('button', { name: /^Abrir orçamento de/ }).first()).toBeVisible();
    return { ficha: id(102), orcamento: id(601), aceite: id(1101), financeiroPreservado: true };
  }, p);
  await h.check('M3b financeiro de outro profissional invisível na prévia; RPC exige Entendi e UI recupera', async () => {
    const visible = await rows(a.client.from('orcamento_cobrancas').select('id').eq('id', id(902)));
    assert.equal(visible.length, 0, 'Pré-condição: cobrança de outro profissional oculta por RLS');
    const charge = await h.get('orcamento_cobrancas', id(902)); const payment = await h.get('pagamentos', id(1002));
    await openFicha(p, 103); const d = await openDelete(p); await fillDelete(d);
    await expect(d.getByRole('checkbox')).toHaveCount(0);
    await d.getByRole('button', { name: 'Apagar ficha', exact: true }).click();
    await expect(d.getByRole('checkbox', { name: /Entendi/ })).toBeVisible();
    await expect(d.getByText('Esta ficha tem orçamento ou pagamento que será mantido', { exact: true })).toBeVisible();
    assert.equal((await h.get('fichas', id(103))).length, 1);
    await d.getByRole('checkbox', { name: /Entendi/ }).check(); await d.getByRole('button', { name: 'Apagar ficha', exact: true }).click();
    await deleted(h, 103); assert.equal((await h.get('orcamentos', id(602)))[0].ficha_id, null);
    assert.deepEqual(await h.get('orcamento_cobrancas', id(902)), charge); assert.deepEqual(await h.get('pagamentos', id(1002)), payment);
    return { ficha: id(103), orcamento: id(602), rls: 'oculto', fallback: 'confirmado', financeiroPreservado: true };
  }, p);
} finally { await h.finish(); }
