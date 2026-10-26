import { setTimeout as delay } from 'node:timers/promises';
import { start, id, base, assert, expect, rows } from './harness.mjs';
import { openFicha } from './telas.mjs';
const h = await start('09-estresse');
const placeholder = 'Curativo, sutura, orientação ou evolução da consulta';
try {
  const a = await h.login('ANA'), p = a.page;
  async function novo(page, text) {
    await openFicha(page, 106);
    await page.getByRole('button', { name: 'Novo atendimento', exact: true }).first().click();
    const region = page.getByRole('region', { name: 'Novo atendimento no prontuário', exact: true });
    await region.waitFor();
    if (!await region.getByPlaceholder(placeholder).isVisible()) await region.getByRole('button', { name: '+ Evolução', exact: true }).click();
    await region.getByPlaceholder(placeholder).fill(text); return region;
  }
  const visits = text => rows(h.db.from('ficha_evolucoes').select('id,atendimento_id,texto').eq('ficha_id', id(106)).eq('texto', text));
  await h.check('Rajada UI: dois cliques no mesmo Salvar produzem uma única visita', async () => {
    const text = 'QA D2 DUPLO CLICK 3d14edb'; const region = await novo(p, text);
    assert.equal((await visits(text)).length, 0);
    await region.getByRole('button', { name: 'Salvar atendimento', exact: true }).evaluate(el => { el.click(); el.click(); });
    await expect.poll(async () => (await visits(text)).length, { timeout: 30000 }).toBe(1);
    await p.reload(); const found = await visits(text); assert.equal(found.length, 1); h.report.ids.duplo = found.map(x => x.id); h.save();
    return { visitas: found, count: 1 };
  }, p);
  await h.check('Concorrência de requests: mesma visitaKey repetida três vezes mantém um registro', async () => {
    const input = { visitaKey: id(4701), pacienteId: id(1), fichaId: id(106), textoVisita: 'QA D2 MESMA CHAVE', eventosDraft: [], alertaNovo: null, ortoManutencao: null, destinoNovos: { fichaId: id(106) } };
    const results = await Promise.all(Array.from({ length: 3 }, () => h.action('ANA', 'salvarAtendimentoDoProntuario', [input])));
    const found = await rows(h.db.from('atendimentos_clinicos').select('id,chave_idempotencia').eq('chave_idempotencia', id(4701)));
    assert.equal(found.length, 1); assert.ok(results.some(r => r.ok)); h.report.ids.rajada = found.map(x => x.id); h.save();
    return { responses: results, persisted: found };
  });
  await h.check('Duas abas: edição concorrente do mesmo procedimento retorna conflito e preserva primeira', async () => {
    const second = await a.context.newPage(); await openFicha(second, 106);
    const event = (await h.get('odontograma_eventos', id(303)))[0];
    const original = { procedimentoNome: event.procedimento_nome, observacao: event.observacao, detalhe: event.detalhe };
    const input = { eventoId: id(303), detalhe: null, alterarDetalhe: false, alterarObservacao: true, original, observacao: 'QA D2 PRIMEIRA ABA' };
    const first = await h.action('ANA', 'editarDetalhesEvento', [input]); assert.equal(first.ok, true, first.error);
    const stale = await h.action('ANA', 'editarDetalhesEvento', [{ ...input, observacao: 'QA D2 SEGUNDA ABA VELHA' }]); assert.equal(stale.ok, false); assert.match(stale.error, /alterado enquanto você editava/);
    assert.equal((await h.get('odontograma_eventos', id(303)))[0].observacao, input.observacao);
    await second.reload(); await h.capture(second, '09-segunda-aba-conflito'); await second.close(); return { first, stale, id: id(303), preservado: true };
  });
  await h.check('Dois profissionais na mesma ficha: admin alheio não sobrescreve evento da Ana', async () => {
    const admin = await h.login('ADMIN'); await openFicha(admin.page, 106);
    const before = (await h.get('odontograma_eventos', id(303)))[0];
    const r = await h.action('ADMIN', 'editarDetalhesEvento', [{ eventoId: id(303), detalhe: null, alterarDetalhe: false, alterarObservacao: true, observacao: 'QA D2 ADMIN NÃO DEVE SOBRESCREVER' }]);
    assert.equal(r.ok, false); assert.deepEqual((await h.get('odontograma_eventos', id(303)))[0], before);
    return { response: r, semSobrescrita: true };
  });
  for (const width of [390, 1440]) for (const dark of [false, true]) await h.check(`Ficha com 60 procedimentos/35 evoluções: ${width}px ${dark ? 'escuro' : 'claro'}`, async () => {
    await p.setViewportSize({ width, height: 1000 }); await openFicha(p, 105);
    // next-themes: altera somente a preferência local do navegador de teste.
    await p.evaluate(d => { localStorage.setItem('theme', d ? 'dark' : 'light'); document.documentElement.classList.toggle('dark', d); document.documentElement.style.colorScheme = d ? 'dark' : 'light'; }, dark);
    const region = p.getByRole('region', { name: 'Ficha aberta no prontuário', exact: true }); await expect(region).toBeVisible();
    const metrics = await p.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, dark: document.documentElement.classList.contains('dark') }));
    assert.ok(metrics.scroll <= width + 1, JSON.stringify(metrics)); assert.equal(metrics.dark, dark);
    const events = await rows(h.db.from('odontograma_eventos').select('id').eq('ficha_id', id(105))); const evolutions = await rows(h.db.from('ficha_evolucoes').select('id').eq('ficha_id', id(105)));
    assert.equal(events.length, 60); assert.equal(evolutions.length, 35); return { metrics, eventos: events.length, evolucoes: evolutions.length };
  }, p);
  await h.check('Lista grande: busca própria e voltar/avançar conservam paciente e dados persistidos', async () => {
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.goto(base + '/dashboard/pacientes');
    const input = p.getByPlaceholder(/Buscar.*nome|Buscar paciente|Buscar por/i).first(); await input.fill('QA D2 Sintético 5035');
    await expect(p.getByText('QA D2 Sintético 5035', { exact: true }).first()).toBeVisible();
    const before = await h.ownState(); await p.goto(base + '/dashboard/pacientes/' + id(1)); await p.goBack(); await p.goForward();
    await expect(p.getByRole('tab', { name: 'Orçamentos', exact: true })).toBeVisible(); assert.deepEqual(await h.ownState(), before);
    return { pacientesProprios: 40, buscaId: id(5035), semEfeito: true };
  }, p);
  await h.check('Offline ao salvar: sem sucesso falso, preserva evolução e permite recuperação', async () => {
    const text = 'QA D2 OFFLINE EVOLUCAO'; const region = await novo(p, text);
    try {
      await a.context.setOffline(true);
      await region.getByRole('button', { name: 'Salvar atendimento', exact: true }).click();
      await expect(region.getByPlaceholder(placeholder)).toHaveValue(text);
      assert.equal((await visits(text)).length, 0);
    } finally { await a.context.setOffline(false); }
    await expect(region.getByRole('button', { name: 'Salvar atendimento', exact: true })).toBeEnabled({ timeout: 20000 });
    await region.getByRole('button', { name: 'Salvar atendimento', exact: true }).click();
    await expect.poll(async () => (await visits(text)).length, { timeout: 30000 }).toBe(1);
    const found = await visits(text); h.report.ids.offline = found.map(x => x.id); h.save(); return { recuperado: true, visitas: found };
  }, p);
  await h.check('Rede lenta e recarga durante salvar: no máximo uma visita, estado confirmado no banco', async () => {
    const text = 'QA D2 RELOAD SALVANDO'; const region = await novo(p, text); let seen;
    const intercepted = new Promise(resolve => { seen = resolve; });
    const routeHandler = async route => { if (route.request().method() === 'POST' && route.request().headers()['next-action']) { seen(); await delay(1500); } await route.continue().catch(() => {}); };
    await a.context.route(base + '/**', routeHandler);
    try {
      await region.getByRole('button', { name: 'Salvar atendimento', exact: true }).click(); await intercepted;
      await p.reload(); await expect(p.getByRole('tab', { name: 'Orçamentos', exact: true })).toBeVisible();
      await delay(2000); const found = await visits(text); assert.ok(found.length <= 1); h.report.ids.reload = found.map(x => x.id); h.save();
      return { persistidos: found, count: found.length, requisicaoLentaInterceptada: true, recargaReal: true };
    } finally { await a.context.unroute(base + '/**', routeHandler); }
  }, p);
  h.report.limites.push('Rajada limitada a3requests e2cliques, exclusivamente fixtures próprias; não é teste de carga. Matriz visual mede overflow da página e guarda prints, não certifica contraste/fidelidade integral. Recarga em voo aceita0ou1persistido e comprova ausência de duplicação, não recuperação de todo rascunho.');
} finally { await h.finish(); }
