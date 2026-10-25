import { addPsr, captureState, encaixe, expect, login, newVisit, openDay, organize, prepareSuite, saveOnce, setTheme, test } from './support';

prepareSuite();

test('MD-01 @changed R10 R11 R13 R41 PSR cicla, desfaz e persiste sem repetir save', async ({ page }, info) => {
  await login(page);
  const visit = await newVisit(page, info, 'PSR');
  await addPsr(page);
  for (const code of [0, 1, 2]) {
    await page.getByRole('button', { name: /^S1 —/ }).click();
    await expect(page.getByRole('button', { name: new RegExp(`^S1 —.*código ${code}`) })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Remover tabela', exact: true }).click();
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await page.getByRole('button', { name: /^S1 —/ }).click();
  await expect(page.getByRole('button', { name: /^S1 —.*código 3/ })).toBeVisible();
  await captureState(page, info, 'PSR-antes-de-salvar');
  await saveOnce(page, visit, true);
  // Consumidor direto de MD-01; não é auditoria integral da Ficha do QA2.
  await page.getByRole('link', { name: /Ver perfil completo/ }).click();
  await page.getByRole('tab', { name: 'Prontuário', exact: true }).click();
  const ficha = page.getByRole('button', { name: /Abrir ficha/ });
  await expect(ficha).toHaveCount(1);
  await ficha.click();
  await expect(page.getByText(/PSR|Exame periodontal/).first()).toBeVisible();
  // A conferência do valor e edição no consumidor compartilhado exige abrir
  // seu formulário específico após a OD-003f; completar com QA2 sem alterar F1.
  await captureState(page, info, 'PSR-consumidor-prontuario');
});

for (const width of [390, 768, 900, 1440]) {
  test(`MD-03 @changed R31 R32 R35 R58 dentes e seleção ${width}px nos dois temas`, async ({ page }, info) => {
    await login(page);
    await newVisit(page, info, `Dentes${width}`);
    for (const dark of [false, true]) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await setTheme(page, dark);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const teeth = page.getByRole('button', { name: /^Dente \d+ —/ });
      await expect(teeth).toHaveCount(32);
      await teeth.first().scrollIntoViewIfNeeded();
      const rectangles = await teeth.evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, y: Math.round(rect.y) };
      }));
      if (width === 390) {
        expect(Math.min(...rectangles.map(rect => rect.width))).toBeGreaterThanOrEqual(32);
        const rows = new Map<number, number>();
        for (const rect of rectangles) rows.set(rect.y, (rows.get(rect.y) ?? 0) + 1);
        expect([...rows.values()]).toEqual([8, 8, 8, 8]);
      } else if (width >= 900) {
        const rows = new Map<number, number>();
        for (const rect of rectangles) rows.set(rect.y, (rows.get(rect.y) ?? 0) + 1);
        expect([...rows.values()]).toEqual([16, 16]);
      }
      for (const tooth of [26, 27]) {
        const button = page.getByRole('button', { name: new RegExp(`^Dente ${tooth} —`) });
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
      }
      await captureState(page, info, `MD03-${width}-${dark ? 'escuro' : 'claro'}`);
      // Limpar seleção pelo mesmo gesto para não inverter no segundo tema.
      for (const tooth of [26, 27]) await page.getByRole('button', { name: new RegExp(`^Dente ${tooth} —`) }).click();
      if (width === 390) {
        await page.getByRole('button', { name: /^Decíduos/ }).click();
        const deciduous = page.getByRole('button', { name: /^Dente \d+ —/ });
        await expect(deciduous).toHaveCount(20);
        const sizes = await deciduous.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
        expect(Math.min(...sizes)).toBeGreaterThanOrEqual(32);
        for (const number of [55, 65]) {
          const button = page.getByRole('button', { name: new RegExp(`^Dente ${number} —`) });
          await button.click();
          await expect(button).toHaveAttribute('aria-pressed', 'true');
        }
        await captureState(page, info, `MD03-deciduos-390-${dark ? 'escuro' : 'claro'}`);
        await page.getByRole('button', { name: 'Limpar seleção', exact: true }).click();
        await page.getByRole('button', { name: /^Permanentes/ }).click();
      }
    }
  });
}

test('MD-04 @changed R26 R49 R51 Ana encaminha e Carlos conclui com autoria explícita', async ({ page, browser }, info) => {
  test.skip(!process.env.QA_CARLOS_EMAIL || !process.env.QA_CARLOS_PASSWORD || !process.env.QA_CARLOS_NAME,
    'Requer identidade Carlos e nome exibido reais da fixture QA por env; não presumir ID/nome.');
  const carlosName = process.env.QA_CARLOS_NAME!;
  await login(page);
  const visit = await newVisit(page, info, 'Encaminhado');
  await organize(page, [26, 27]);
  const line = page.locator('[data-documento-evento]').filter({ has: page.getByRole('combobox', { name: 'Nome do procedimento 26', exact: true }) });
  await line.getByRole('button', { name: /^Mais opções de/ }).click();
  await page.getByRole('menuitem', { name: 'Encaminhar', exact: true }).click();
  await line.getByRole('combobox', { name: /^Encaminhar / }).selectOption({ label: carlosName });
  await expect(line).toContainText(`Encaminhado para ${carlosName}`);
  const ordinary = page.locator('[data-documento-evento]').filter({ has: page.getByRole('combobox', { name: 'Nome do procedimento 27', exact: true }) });
  await ordinary.locator('[data-linha-situacao]').click();
  await expect(ordinary.locator('[data-linha-situacao]')).toHaveText('Realizado hoje');
  await saveOnce(page, visit);
  const context = await browser.newContext({ baseURL: process.env.QA_BASE_URL ?? 'http://localhost:3011' });
  try {
    const carlos = await context.newPage();
    await login(carlos, 'carlos');
    await encaixe(carlos, visit.name, false);
    await carlos.locator('[data-meu-dia-retomada] summary').click();
    const pending = carlos.getByRole('region', { name: 'Plano e histórico das sessões', exact: true })
      .locator('article').filter({ hasText: 'QA procedimento 26' }).filter({ hasText: 'encaminhado para você' });
    await expect(pending).toHaveCount(1);
    await pending.getByRole('button', { name: /Concluir encaminhado/ }).click();
    await expect(pending).toHaveCount(0);
    await openDay(page, visit);
    await page.locator('[data-meu-dia-retomada] summary').click();
    const history = page.getByRole('region', { name: 'Plano e histórico das sessões', exact: true });
    for (const button of await history.locator('article button[aria-expanded=false]').all()) await button.click();
    await expect(history.getByText(`concluído por ${carlosName}`, { exact: true })).toBeVisible();
    await history.getByText(`concluído por ${carlosName}`, { exact: true }).scrollIntoViewIfNeeded();
    await captureState(page, info, 'MD04-historico-Ana-executor-Carlos');
    // Há somente uma conclusão encaminhada; o procedimento comum27 é da Ana.
    await expect(history.getByText(/^concluído por /)).toHaveCount(1);
  } finally {
    await context.close();
  }
});
