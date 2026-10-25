import { addPsr, captureState, encaixe, expect, finalOnly, login, newVisit, openDay, organize, prepareSuite, reloadDraft, saveOnce, test } from './support';

prepareSuite();
test.beforeEach(() => finalOnly());

test('R01 R02 R04 R05 R10 R11 R13 R14 consulta própria, status, Ctrl+S e recarga', async ({ page }, info) => {
  await login(page);
  const visit = await newVisit(page, info, 'Salvar');
  await expect(page.getByRole('button', { name: 'Salvar atendimento', exact: true })).toBeDisabled();
  for (const status of ['checked_in', 'in_progress', 'scheduled']) {
    const response = process.env.MD_FINAL_REUSE === '2c6eeff'
      ? page.waitForResponse(item => item.request().method() === 'POST' && new URL(item.url()).pathname === '/dashboard/meu-dia')
      : null;
    await page.getByRole('combobox', { name: 'Mudar status do atendimento', exact: true }).selectOption(status);
    if (response) await response;
    await openDay(page, visit);
    await expect(page.getByRole('combobox', { name: 'Mudar status do atendimento', exact: true })).toHaveValue(status);
  }
  await organize(page);
  const observation = page.getByRole('textbox', { name: /^Observação de QA procedimento 26/ });
  await observation.fill('QA sem perda na persistência.');
  await saveOnce(page, visit, true);
  await expect(page.locator(`[data-rail-alvo="${visit.slotId}"]`)).toContainText('Concluído');
  await expect(page.getByRole('textbox', { name: 'Relato para organizar com Dex', exact: true })).toHaveCount(0);
  await captureState(page, info, 'salvo-recarregado');
  // A notificação única e os campos de banco de R14 precisam de SELECT autenticado
  // no reteste; a interface comprova somente status/registro/recarga.
});

test('R15 R16 R23 R24 R25 R26 R27 revisão editável, lote, desfazer e rascunho na mesma aba', async ({ page }, info) => {
  await login(page);
  const visit = await newVisit(page, info, 'Documento');
  await organize(page);
  const line = page.locator('[data-documento-evento]').filter({ has: page.getByRole('combobox', { name: 'Nome do procedimento 26', exact: true }) });
  await line.getByRole('combobox', { name: 'Nome do procedimento 26', exact: true }).fill('QA nome editado 26');
  await line.getByRole('button', { name: 'Face O do procedimento 26', exact: true }).click();
  await expect(line.getByRole('button', { name: 'Face O do procedimento 26', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Mais ações do documento', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Alterar vários', exact: true }).click();
  const checkboxes = page.getByRole('checkbox', { name: /^Selecionar QA/ });
  await expect(checkboxes).toHaveCount(2);
  for (const checkbox of await checkboxes.all()) await checkbox.check();
  await page.getByRole('combobox', { name: 'Situação das linhas selecionadas', exact: true }).selectOption('proxima_sessao');
  await expect(page.locator('[data-linha-situacao]').filter({ hasText: 'Próxima sessão' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Desfazer alteração em lote', exact: true }).click();
  await expect(page.locator('[data-linha-situacao]').filter({ hasText: 'A fazer' })).toHaveCount(2);
  // Paciente próprio novo já está em Nova ficha; não há tratamento anterior a separar.
  await addPsr(page);
  await page.getByRole('button', { name: /^S1 —/ }).click();
  // sessionStorage precisa ser conferido no MESMO contexto/aba, sem recriar o perfil.
  await expect.poll(() => page.evaluate(() => Object.values(sessionStorage).some(value => value.includes('QA nome editado 26')))).toBe(true);
  await reloadDraft(page);
  await expect(page.getByRole('heading', { name: visit.name, exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Nome do procedimento 26', exact: true })).toHaveValue('QA nome editado 26');
  await expect(page.getByRole('button', { name: /^S1 —.*código 0/ })).toBeVisible();
  await captureState(page, info, 'rascunho-restaurado-com-tabela');
  await saveOnce(page, visit);
});

test('R15 R21 R53 Dex com erro e sem conexão conserva texto e permite recuperação', async ({ page, context }, info) => {
  await login(page);
  await newVisit(page, info, 'Falhas');
  const text = 'QA texto fictício que precisa sobreviver às falhas.';
  const editor = page.getByRole('textbox', { name: 'Relato para organizar com Dex', exact: true });
  await editor.fill(text);
  await page.route('**/api/dex/formatar-evolucao', route => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'QA falha simulada.' }) }));
  await page.getByRole('button', { name: /Organizar com o Dex/ }).click();
  await expect(page.getByRole('button', { name: 'Tentar de novo', exact: true })).toBeVisible();
  await expect(editor).toHaveValue(text);
  await captureState(page, info, 'Dex-502-sem-perda');
  await page.unroute('**/api/dex/formatar-evolucao');
  try {
    await context.setOffline(true);
    await page.getByRole('button', { name: /Organizar com o Dex/ }).click();
    await expect(page.getByRole('button', { name: 'Tentar de novo', exact: true })).toBeVisible();
    await expect(editor).toHaveValue(text);
    await captureState(page, info, 'Dex-offline-sem-perda');
  } finally {
    await context.setOffline(false);
  }
  await page.getByLabel('Anexar arquivo ao atendimento', { exact: true }).setInputFiles({
    name: 'QA-documento.txt', mimeType: 'text/plain', buffer: Buffer.from('QA documento fictício de base. Dente 26 a avaliar.'),
  });
  await expect.poll(async () => page.getByRole('textbox', { name: 'Relato para organizar com Dex', exact: true })
    .evaluateAll(elements => elements.map(element => (element as HTMLTextAreaElement).value).join('\n')), { timeout: 30_000 })
    .toContain('QA documento fictício');
  await organize(page, [26]);
  await expect(page.getByRole('combobox', { name: 'Nome do procedimento 26', exact: true })).toBeVisible();
});

test('R10 R15 R23 limites 5.000/50.000 não cortam texto nem permitem salvar acima do limite', async ({ page }, info) => {
  await login(page);
  await newVisit(page, info, 'Limites');
  const editor = page.getByRole('textbox', { name: 'Relato para organizar com Dex', exact: true });
  for (const count of [5_000, 5_001, 50_000, 50_001]) {
    const text = 'a'.repeat(count);
    await editor.fill(text);
    await expect(editor).toHaveValue(text);
    if (count > 5_000) await expect(page.getByRole('button', { name: 'Salvar atendimento', exact: true })).toBeDisabled();
    if (count > 50_000) {
      await expect(page.getByRole('button', { name: /Organizar com o Dex/ })).toBeDisabled();
      await expect(page.getByRole('alert').filter({ hasText: '50.000' })).toBeVisible();
    }
    await captureState(page, info, `limite-${count}`);
  }
});

test('R03 R05 R58 arrastar fila não troca paciente; Enter e Espaço selecionam somente QA', async ({ page }, info) => {
  await login(page);
  const first = await newVisit(page, info, 'FilaA');
  const second = await newVisit(page, info, 'FilaB');
  await page.setViewportSize({ width: 390, height: 844 });
  const rail = page.locator('[data-meu-dia-fila] > div').first();
  const box = await rail.boundingBox();
  if (!box) throw new Error('Fila não renderizada.');
  const before = await rail.evaluate(element => element.scrollLeft);
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  await page.mouse.down();
  // O rail exige gesto >100ms; passos intermediários reais e pausa no mouse pressionado.
  await page.waitForTimeout(120);
  await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 18 });
  await page.mouse.up();
  await expect(page.locator(`[data-rail-alvo="${second.slotId}"]`)).toHaveAttribute('aria-pressed', 'true');
  const dimensions = await rail.evaluate(element => ({ sw: element.scrollWidth, cw: element.clientWidth, left: element.scrollLeft }));
  if (dimensions.sw > dimensions.cw && before < dimensions.sw - dimensions.cw) expect(dimensions.left).not.toBe(before);
  for (const [visit, key] of [[first, 'Enter'], [second, 'Space']] as const) {
    const slot = page.locator(`[data-rail-alvo="${visit.slotId}"]`);
    await slot.focus();
    await page.keyboard.press(key);
    await expect(slot).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: visit.name, exact: true })).toBeVisible();
  }
});

test('R47 R48 R51 plano: próxima sessão persiste, desfazer restaura e Registrar hoje produz rascunho', async ({ page }, info) => {
  await login(page);
  const first = await newVisit(page, info, 'Plano');
  await organize(page, [26]);
  await saveOnce(page, first);
  const next = await encaixe(page, first.name, false);
  await page.locator('[data-meu-dia-retomada] summary').click();
  const history = page.getByRole('region', { name: 'Plano e histórico das sessões', exact: true });
  const pending = history.locator('article').filter({ hasText: 'QA procedimento 26' }).filter({ has: page.getByRole('button', { name: 'Próxima sessão', exact: true }) });
  await expect(pending).toHaveCount(1);
  await pending.getByRole('button', { name: 'Próxima sessão', exact: true }).click();
  await expect(pending.getByRole('button', { name: 'Próxima sessão', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await captureState(page, info, 'plano-proxima-antes-recarregar');
  await openDay(page, next);
  await page.locator('[data-meu-dia-retomada] summary').click();
  await expect(pending.getByRole('button', { name: 'Próxima sessão', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await pending.getByRole('button', { name: 'A fazer', exact: true }).click();
  await pending.getByRole('button', { name: 'Próxima sessão', exact: true }).click();
  await history.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(pending.getByRole('button', { name: 'A fazer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await openDay(page, next);
  await page.locator('[data-meu-dia-retomada] summary').click();
  await expect(pending.getByRole('button', { name: 'A fazer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await pending.getByRole('button', { name: 'Registrar hoje', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Nome do procedimento 26', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar atendimento', exact: true })).toBeEnabled();
  await captureState(page, info, 'registrar-hoje-rascunho');
});

test('R59 secretária redirecionada sem criar registro', async ({ browser }) => {
  test.skip(!process.env.QA_SECRETARIA_EMAIL || !process.env.QA_SECRETARIA_PASSWORD, 'Requer conta sintética secretária por env.');
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await login(page, 'secretaria');
    await page.goto(`${process.env.QA_BASE_URL ?? 'http://localhost:3011'}/dashboard/meu-dia`);
    await expect(page).not.toHaveURL(/\/dashboard\/meu-dia/);
    await expect(page.getByRole('button', { name: 'Salvar atendimento', exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
