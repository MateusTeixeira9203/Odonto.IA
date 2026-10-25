import { captureState, expect, login, newVisit, openDay, prepareSuite, setTheme, test } from './support';

prepareSuite();

test('OD-001r Canal, Extração, Ausente e Ponte preservados; pares 1440 e 390', async ({ page }, info) => {
  await login(page);
  const reuseSlot = process.env.MD_CHIPS_REUSE_SLOT;
  const reuseName = process.env.MD_CHIPS_REUSE_NAME;
  const visit = reuseSlot && reuseName?.startsWith('QA MD ChipsPreservados ')
    ? { name: reuseName, slotId: reuseSlot }
    : await newVisit(page, info, 'ChipsPreservados');
  if (reuseSlot) await openDay(page, visit);
  for (const port of [3010, 3011]) {
    await page.goto(`http://localhost:${port}/dashboard/meu-dia?ag=${visit.slotId}`);
    await expect(page.getByRole('heading', { name: visit.name, exact: true })).toBeVisible();
    for (const width of [1440, 390]) {
      for (const dark of [false, true]) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await setTheme(page, dark);
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.getByRole('button', { name: /^Dente 26 —/ }).scrollIntoViewIfNeeded();
        await captureState(page, info, `${port === 3010 ? 'antes' : 'depois'}-${width}-${dark ? 'escuro' : 'claro'}`, port === 3011);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [number, chip] of [[26, 'Canal'], [27, 'Extração'], [28, 'Dente ausente']] as const) {
    const selection = page.getByRole('button', { name: 'Limpar seleção', exact: true });
    if (await selection.isVisible()) await selection.click();
    await page.getByRole('button', { name: new RegExp(`^Dente ${number} —`) }).click();
    await page.getByRole('button', { name: chip, exact: true }).click();
  }
  await expect(page.locator('[data-documento-evento]')).toHaveCount(3);
  await captureState(page, info, 'chips-canal-extracao-ausente');
  const clear = page.getByRole('button', { name: 'Limpar seleção', exact: true });
  if (await clear.isVisible()) await clear.click();
  await page.getByRole('button', { name: /^Dente 16 —/ }).click();
  await page.getByRole('button', { name: 'Ponte fixa', exact: true }).click();
  const bridge = page.getByRole('group', { name: 'Criar ponte a partir do dente 16', exact: true });
  await expect(bridge).toBeVisible();
  await bridge.getByRole('combobox', { name: 'Dente do outro extremo da ponte', exact: true }).selectOption('14');
  await expect(bridge.getByRole('button', { name: 'Confirmar ponte', exact: true })).toBeEnabled();
  await captureState(page, info, 'ponte-com-seletor-preservado');
  await bridge.getByRole('button', { name: 'Confirmar ponte', exact: true }).click();
  await expect(bridge).toHaveCount(0);
  await expect(page.locator('[data-documento-evento]')).toHaveCount(6);
  await captureState(page, info, 'ponte-confirmada-no-rascunho');
});

for (const origin of ['Prontuário', 'Ficha'] as const) {
  test(`OD-001r consumidor ${origin}: seletor de faces e Aplicar preservados`, async ({ page }, info) => {
    await login(page);
    // Registro próprio salvo na primeira rodada. Leitura e rascunho local, sem Salvar.
    await page.goto('http://localhost:3011/dashboard/pacientes/f8c8411f-d93a-401a-8983-80e2692190dd');
    await page.getByRole('tab', { name: 'Prontuário', exact: true }).click();
    if (origin === 'Ficha') await page.getByRole('button', { name: /Abrir ficha/ }).first().click();
    await page.getByRole('button', { name: 'Novo atendimento', exact: true }).click();
    await page.getByRole('button', { name: /^Dente 26 —/ }).click();
    await page.getByRole('button', { name: 'Restauração ▾', exact: true }).click();
    const apply = page.getByRole('button', { name: 'Aplicar 0 faces', exact: true });
    await expect(apply).toBeDisabled();
    await page.getByRole('button', { name: 'Face M', exact: true }).click();
    await page.getByRole('button', { name: 'Face Oclusal', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Aplicar 2 faces', exact: true })).toBeEnabled();
    await captureState(page, info, `consumidor-${origin}-seletor-aplicar`);
    await page.getByRole('button', { name: 'Aplicar 2 faces', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Aplicar 2 faces', exact: true })).toHaveCount(0);
    await captureState(page, info, `consumidor-${origin}-apos-aplicar`);
  });
}

test('Evidência somente leitura da autoria no encaminhado já salvo', async ({ page }, info) => {
  const slotId = process.env.MD_READONLY_SLOT;
  const name = process.env.MD_READONLY_NAME;
  test.skip(!slotId || !name?.startsWith('QA MD Encaminhado '), 'Requer registro próprio criado pelo teste MD-04.');
  if (!slotId || !name) throw new Error('Identificação QA ausente.');
  await login(page);
  await openDay(page, { name, slotId });
  await page.locator('[data-meu-dia-retomada] summary').click();
  const history = page.getByRole('region', { name: 'Plano e histórico das sessões', exact: true });
  for (const button of await history.locator('article button[aria-expanded=false]').all()) await button.click();
  const executor = history.getByText('concluído por Dr. Carlos Local', { exact: true });
  await executor.scrollIntoViewIfNeeded();
  await expect(executor).toBeVisible();
  await captureState(page, info, 'MD04-autoria-visivel-releitura');
});
