import { addPsr, baseURL, captureState, expect, finalOnly, login, newVisit, organize, prepareSuite, saveOnce, setTheme, test } from './support';

prepareSuite();
test.beforeEach(() => finalOnly());

for (const width of [390, 768, 1440]) {
  test(`R19 R23 R24 R31 R41 R45 R57 R58 documento20+, PSR, endo e implante ${width}px`, async ({ page }, info) => {
    await login(page);
    const visit = await newVisit(page, info, `Visual${width}`);
    const states = async (label: string) => {
      for (const dark of [false, true]) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await setTheme(page, dark);
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await captureState(page, info, `${label}-${width}-${dark ? 'escuro' : 'claro'}`);
        const tables = page.locator('[data-tabela-evento]');
        for (let index = 0; index < await tables.count(); index++) {
          await tables.nth(index).scrollIntoViewIfNeeded();
          await captureState(page, info, `${label}-tabela${index}-${width}-${dark ? 'escuro' : 'claro'}`);
        }
      }
    };
    await states('documento-vazio');
    const teeth = [11, 12, 13, 14, 15, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 37, 38];
    await organize(page, teeth);
    await expect(page.locator('[data-documento-evento]')).toHaveCount(22);
    await states('documento22');
    await organize(page, [16], 'endodontia');
    const endo = page.locator('[data-documento-evento]').filter({ has: page.getByRole('combobox', { name: 'Nome do procedimento 16', exact: true }) });
    await endo.getByRole('button', { name: /Tabela/ }).click();
    await organize(page, [36], 'implante');
    const implant = page.locator('[data-documento-evento]').filter({ has: page.getByRole('combobox', { name: 'Nome do procedimento 36', exact: true }) });
    await implant.getByRole('button', { name: /Tabela/ }).click();
    await addPsr(page);
    await expect(page.locator('[data-tabela-evento]')).toHaveCount(3);
    await states('tres-tabelas');
    await saveOnce(page, visit);
    await states('historico-salvo');
    // Comparação no MESMO registro já persistido, antes/depois somente leitura.
    for (const [port, label] of [['3010', 'antes'], ['3011', 'depois']] as const) {
      await page.goto(`${new URL(baseURL).origin.replace(/:301[01]$/, `:${port}`)}/dashboard/meu-dia?ag=${visit.slotId}`);
      await page.locator(`[data-rail-alvo="${visit.slotId}"]`).click();
      await states(`mesmo-atendimento-${label}`);
    }
  });
}
