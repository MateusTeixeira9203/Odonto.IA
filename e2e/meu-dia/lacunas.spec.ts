import { writeFile } from 'node:fs/promises';
import { baseURL, captureState, expect, login, prepareSuite, test } from './support';

prepareSuite();
test('R47 R48 R51 continuação na mesma fixture', async ({ page }, info) => {
  test.setTimeout(90000);
  await login(page);
  const url = `${baseURL}/dashboard/meu-dia?ag=e5988940-4288-45ab-8268-f216b64c9af6`;
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'QA MD Plano 1792892300947 0', exact: true })).toBeVisible();
  const summary = page.locator('[data-meu-dia-retomada] summary');
  if (await summary.count()) await summary.click();
  const history = page.getByRole('region', { name: 'Plano e histórico das sessões', exact: true });
  const pending = history.locator('article').filter({ hasText: 'QA procedimento 26' }).filter({ has: page.getByRole('button', { name: 'Próxima sessão', exact: true }) });
  await captureState(page, info, 'plano-estado-inicial');
  await pending.getByRole('button', { name: 'A fazer', exact: true }).click();
  await expect(pending.getByRole('button', { name: 'A fazer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await pending.getByRole('button', { name: 'Próxima sessão', exact: true }).click();
  await expect(pending.getByRole('button', { name: 'Próxima sessão', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(pending.getByRole('button', { name: 'A fazer', exact: true })).toBeEnabled();
  await expect(history.getByText('QA procedimento 26 separado para a próxima sessão.', { exact: true })).toBeVisible();
  await history.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(pending.getByRole('button', { name: 'A fazer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto(url);
  if (await summary.count()) await summary.click();
  await expect(pending.getByRole('button', { name: 'A fazer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await captureState(page, info, 'R48-desfazer-persistido');
  await pending.getByRole('button', { name: 'Registrar hoje', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Nome do procedimento 26', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar atendimento', exact: true })).toBeEnabled();
  await captureState(page, info, 'R51-rascunho');
});

test('Alerta e orto exibidos no perfil da fixture já salva', async ({ page }, info) => {
  test.setTimeout(90000);
  await login(page);
  await page.goto(`${baseURL}/dashboard/pacientes/f8c8411f-d93a-401a-8983-80e2692190dd`);
  await expect(page.getByRole('button', { name: /Abrir ficha/ })).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(20000);
  const alertProfile = await page.getByText('QA alerta sintético de auditoria.', { exact: true }).isVisible();
  const profileDOM = await page.locator('main').innerText();
  await captureState(page, info, 'alerta-perfil');
  await page.getByRole('button', { name: /Abrir ficha/ }).click();
  await page.waitForTimeout(20000);
  const ortoFicha = await page.getByText(/QA manutenção sintética superior/).first().isVisible();
  const alertFicha = await page.getByText('QA alerta sintético de auditoria.', { exact: true }).isVisible();
  await captureState(page, info, 'orto-ficha');
  const fichaDOM = await page.locator('main').innerText();
  const disclosures = await page.locator('details').evaluateAll(elements => elements.map(el => ({ open: el instanceof HTMLDetailsElement && el.open, summary: el.querySelector('summary')?.textContent, text: el.textContent })));
  await writeFile(info.outputPath('perfil-assertions.json'), JSON.stringify({ baseURL, alertProfile, alertFicha, ortoFicha, profileDOM, fichaDOM, disclosures }, null, 2));
  expect.soft(ortoFicha, 'Manutenção superior exibida na ficha').toBe(true);
  expect(alertProfile, 'Alerta exibido no perfil').toBe(true);
});
test('Encaixe mede seleção até 20 segundos sem repetir criação', async ({ page }, info) => {
  test.setTimeout(90000);
  await login(page);
  await page.goto(`${baseURL}/dashboard/meu-dia`);
  await expect(page.getByRole('button', { name: /^(Encaixe|Atender agora)$/ })).toBeVisible({ timeout: 20000 });
  const name = `QA MD LacunaEncaixe ${new URL(baseURL).port} ${Date.now()}`;
  const network: unknown[] = [];
  page.on('response', async response => {
    const url = new URL(response.url());
    if (!url.hostname.endsWith('supabase.co') && !(url.hostname === 'localhost' && response.request().method() === 'POST')) return;
    const req = response.request();
    const entry: Record<string, unknown> = { path: url.pathname, method: req.method(), status: response.status() };
    if (url.hostname.endsWith('supabase.co') && ['POST', 'PATCH'].includes(req.method())) {
      try { const body: unknown = await response.json(); entry.result = body; } catch { /* sem JSON */ }
    }
    network.push(entry);
  });
  await page.getByRole('button', { name: /^(Encaixe|Atender agora)$/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Atender agora', exact: true });
  await dialog.getByPlaceholder('Buscar por nome...', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: `Cadastrar “${name}” e atender`, exact: true }).click();
  const start = Date.now();
  const samples = [];
  for (const at of [1000, 5000, 10000, 20000]) {
    await page.waitForTimeout(Math.max(0, at - (Date.now() - start)));
    samples.push({ ms: Date.now() - start, profile: await page.getByRole('link', { name: /Ver perfil completo/ }).getAttribute('href').catch(() => null), headings: await page.getByRole('heading').allTextContents(),
      selected: await page.locator('[data-rail-alvo][aria-pressed=true]').evaluateAll(els => els.map(el => ({ id: el.getAttribute('data-rail-alvo'), text: el.textContent }))),
      ownSlots: await page.locator('[data-rail-alvo]').filter({ hasText: name }).evaluateAll(els => els.map(el => ({ id: el.getAttribute('data-rail-alvo'), text: el.textContent }))) });
  }
  await writeFile(info.outputPath('encaixe-rede-dom.json'), JSON.stringify({ name, baseURL, samples, network }, null, 2));
  await captureState(page, info, 'encaixe-20s');
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
});

test('Dentição compara rótulo ao selecionar Decíduos', async ({ page }, info) => {
  await login(page);
  await page.goto(`${baseURL}/dashboard/meu-dia?ag=962125c7-55f7-4af7-8f63-16cf4ea9e90d`);
  await page.locator('[data-rail-alvo="962125c7-55f7-4af7-8f63-16cf4ea9e90d"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Decíduos', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Dente 55/ })).toBeVisible();
  await captureState(page, info, 'deciduos-rotulo');
  await writeFile(info.outputPath('rotulo.json'), JSON.stringify({ baseURL, permanentLabel: await page.getByText('Dentição permanente', { exact: true }).count(), deciduous55: await page.getByRole('button', { name: /^Dente 55/ }).count() }));
  await expect(page.getByText('Dentição permanente', { exact: true })).toHaveCount(0);
});
