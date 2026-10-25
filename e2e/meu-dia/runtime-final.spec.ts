import { writeFile } from 'node:fs/promises';
import { baseURL, captureState, expect, login, newVisit, prepareSuite, test } from './support';

prepareSuite();
test('Diagnóstico texto por fill e teclado sem salvar', async ({ page }, info) => {
  await login(page);
  await newVisit(page, info, 'Runtime');
  const editor = page.getByRole('textbox', { name: 'Relato para organizar com Dex', exact: true });
  await editor.fill('QA diagnóstico fictício por fill.');
  await page.waitForTimeout(1000);
  const afterFill = await editor.inputValue();
  await editor.click();
  await editor.pressSequentially('QA diagnóstico fictício por teclado.', { delay: 30 });
  await page.waitForTimeout(1000);
  const afterKeys = await editor.inputValue();
  await editor.fill('QA preenchimento fictício após foco.');
  await page.waitForTimeout(1000);
  const afterFocusedFill = await editor.inputValue();
  await writeFile(info.outputPath('texto-diagnostico.json'), JSON.stringify({ baseURL, afterFill, afterKeys, afterFocusedFill, main: await page.locator('main').innerText() }, null, 2));
  await captureState(page, info, 'texto-diagnostico');
  expect(afterKeys).toContain('QA diagnóstico fictício por teclado.');
  expect(afterFocusedFill).toBe('QA preenchimento fictício após foco.');
});
for (const width of [1440, 390]) {
  test(`Runtime OD016 dente trocar fechar Anexar MD06 ${width}`, async ({ page }, info) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await login(page);
    await newVisit(page, info, 'Runtime');
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const tooth = (number: number) => page.getByRole('button', { name: new RegExp(`^Dente ${number} —`) });
    await tooth(26).click();
    await expect(tooth(26)).toHaveAttribute('aria-pressed', 'true');
    await tooth(27).click();
    await expect(tooth(27)).toHaveAttribute('aria-pressed', 'true');
    await tooth(26).click();
    await expect(tooth(26)).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Detalhe do dente', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Detalhe do dente 27', exact: true })).toBeVisible();
    await captureState(page, info, `runtime-${width}-dente27`);
    await page.getByRole('button', { name: 'Fechar painel do dente', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Detalhe do dente 27', exact: true })).toHaveCount(0);
    await expect(tooth(18)).toBeVisible();
    const fileChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Anexar', exact: true }).click();
    const chooser = await fileChooser;
    expect(await chooser.element().getAttribute('type')).toBe('file');
    for (const [dentition, number, label] of [['Decíduos', 55, 'Dentição decídua'], ['Permanentes', 18, 'Dentição permanente']] as const) {
      await page.getByRole('button', { name: dentition, exact: true }).click();
      await expect(tooth(number)).toBeVisible();
      if (new URL(baseURL).port === '3011') await expect(page.getByText(label, { exact: true })).toBeVisible();
      await captureState(page, info, `runtime-${width}-${dentition}`);
    }
    await writeFile(info.outputPath('runtime-errors.json'), JSON.stringify(errors));
    expect(errors).toEqual([]);
  });
}
