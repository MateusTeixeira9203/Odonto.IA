import { writeFile } from 'node:fs/promises';
import { baseURL, expect, login, prepareSuite, test } from './support';

prepareSuite();
const slotId = '9fd836cc-af5f-4ffb-b221-fc91256be87b';
const name = 'QA MD LacunaEncaixe 3010 1792892245629';
const url = `${baseURL}/dashboard/meu-dia?ag=${slotId}`;
async function ready(page: import('@playwright/test').Page) {
  await page.goto(url);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.waitForFunction(() => {
    const select = document.querySelector('select[aria-label="Mudar status do atendimento"]');
    return select != null && Object.keys(select).some(key => key.startsWith('__reactProps') && typeof (Reflect.get(select, key) as { onChange?: unknown }).onChange === 'function');
  });
}

test('STATUS comparação única navegação rápida', async ({ page }, info) => {
  test.setTimeout(90000);
  if (process.env.MD_STATUS_COMPARE !== 'af303ad-2c6eeff') throw Error('Comparação de status exige opt-in específico.');
  await login(page);
  await ready(page);
  const control = page.getByRole('combobox', { name: 'Mudar status do atendimento', exact: true });
  const initial = await control.inputValue();
  const network: unknown[] = [];
  page.on('response', response => {
    if (response.request().method() === 'POST') network.push({ path: new URL(response.url()).pathname, status: response.status() });
  });
  const steps: unknown[] = [];
  let failed = false;
  for (const status of ['checked_in', 'in_progress', 'scheduled']) {
    const before = await control.inputValue();
    await control.selectOption(status);
    await ready(page);
    const start = Date.now();
    let passed = true;
    try { await expect(control).toHaveValue(status, { timeout: 5000 }); } catch { passed = false; failed = true; }
    steps.push({ before, requested: status, received: await control.inputValue(), waitMs: Date.now() - start, passed,
      selected: await page.locator('[data-rail-alvo][aria-pressed=true]').getAttribute('data-rail-alvo') });
  }
  await writeFile(info.outputPath('status-dom-rede.json'), JSON.stringify({ baseURL, slotId, initial, steps, network, main: await page.locator('main').innerText() }, null, 2));
  await page.screenshot({ path: info.outputPath('status.png') });
  expect(failed).toBe(false);
});

test('ARRASTO comparação única scroller horizontal visível', async ({ page }, info) => {
  test.setTimeout(60000);
  await login(page);
  await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const rail = page.locator('[data-meu-dia-fila] > div').first();
  await rail.scrollIntoViewIfNeeded();
  await rail.evaluate(el => { el.scrollLeft = 0; });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  const before = await rail.evaluate(el => ({ left: el.scrollLeft, sw: el.scrollWidth, cw: el.clientWidth, rect: el.getBoundingClientRect().toJSON() }));
  const box = await rail.boundingBox();
  if (!box) throw Error('Fila sem boundingBox.');
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 18 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after = await rail.evaluate(el => ({ left: el.scrollLeft, sw: el.scrollWidth, cw: el.clientWidth, rect: el.getBoundingClientRect().toJSON() }));
  const selected = await page.locator('[data-rail-alvo][aria-pressed=true]').getAttribute('data-rail-alvo');
  await writeFile(info.outputPath('arrasto-dom.json'), JSON.stringify({ baseURL, slotId, before, after, selected }, null, 2));
  await page.screenshot({ path: info.outputPath('arrasto.png') });
  expect(after.left).toBeGreaterThan(before.left);
  expect(selected).toBe(slotId);
});
