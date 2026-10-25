import { captureState, expect, login, newVisit, openDay, prepareSuite, setTheme, test } from './support';

prepareSuite();

for (const width of [1440, 390]) {
  test(`OD-001r sem face, MO, multidente e duplicata ${width}px`, async ({ page }, info) => {
    await login(page);
    const reuseSlot = process.env.MD_REST_REUSE_SLOT;
    const reuseName = process.env.MD_REST_REUSE_NAME;
    if (width === 1440 && reuseSlot && reuseName?.startsWith('QA MD Restauracao1440 ')) {
      await openDay(page, { name: reuseName, slotId: reuseSlot });
    } else await newVisit(page, info, `Restauracao${width}`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme(page, true);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const tooth = (number: number) => page.getByRole('button', { name: new RegExp(`^Dente ${number} —`) });
    const rows = page.locator('[data-documento-evento]');
    await tooth(26).click();
    await page.getByRole('button', { name: 'Restauração', exact: true }).click();
    await expect(rows).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Escolha ao menos uma face' })).toBeVisible();
    await captureState(page, info, `OD001r-${width}-sem-face`);
    await page.getByRole('button', { name: 'Face M', exact: true }).click();
    await page.getByRole('button', { name: 'Face Oclusal', exact: true }).click();
    await page.getByRole('button', { name: 'Restauração', exact: true }).click();
    await expect(rows).toHaveCount(1);
    const line26 = rows.filter({ has: page.getByRole('combobox', { name: 'Nome do procedimento 26', exact: true }) });
    for (const face of ['M', 'O']) await expect(line26.getByRole('button', { name: `Face ${face} do procedimento 26`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    for (const face of ['D', 'V', 'L']) await expect(line26.getByRole('button', { name: `Face ${face} do procedimento 26`, exact: true })).toHaveAttribute('aria-pressed', 'false');
    await captureState(page, info, `OD001r-${width}-26-MO`);
    // Remover apenas o rascunho próprio para conferir o lote em estado vazio.
    await line26.getByRole('button', { name: /^Remover / }).click();
    await expect(rows).toHaveCount(0);
    if (await tooth(26).getAttribute('aria-pressed') !== 'true') await tooth(26).click();
    await tooth(27).click();
    await page.getByRole('button', { name: 'Face Oclusal', exact: true }).click();
    await page.getByRole('button', { name: 'Restauração', exact: true }).click();
    await expect(rows).toHaveCount(2);
    for (const number of [26, 27]) {
      const line = rows.filter({ has: page.getByRole('combobox', { name: `Nome do procedimento ${number}`, exact: true }) });
      await expect(line).toHaveCount(1);
      await expect(line.getByRole('button', { name: `Face O do procedimento ${number}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    for (const number of [26, 27]) if (await tooth(number).getAttribute('aria-pressed') !== 'true') await tooth(number).click();
    await page.getByRole('button', { name: 'Face Oclusal', exact: true }).click();
    await page.getByRole('button', { name: 'Restauração', exact: true }).click();
    await expect(rows).toHaveCount(2);
    await expect(page.getByText(/já tem.*em aberto/).first()).toBeVisible();
    await captureState(page, info, `OD001r-${width}-lote-duplicata`);
  });
}
