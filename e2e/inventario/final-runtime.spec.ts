import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const evidence = process.env.QA2_FINAL_EVIDENCE;
const patient = 'f8c8411f-d93a-401a-8983-80e2692190dd';
test.setTimeout(180_000);
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

async function login(page: Page, port: number) {
  const snapshot = resolve(process.cwd(), '..', port === 3012 ? 'Odonto.IA-antes2' : 'Odonto.IA-depois3');
  const config = readFileSync(join(snapshot, '.env.development.local'), 'utf8');
  const host = config.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
  if (!host || new URL(host).hostname !== 'uhuxteswtvgdnlixwrdu.supabase.co') throw new Error('Host QA incorreto.');
  const password = readFileSync(resolve('.env.qa-contas'), 'utf8').match(/^#\s*Senha de todas:\s*(.+)\r?$/m)?.[1]?.trim();
  if (!password || !evidence) throw new Error('Configuracao QA indisponivel.');
  await page.goto(`http://localhost:${port}/login`);
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return form && Object.keys(form).some(key => key.startsWith('__reactProps') &&
      typeof (Reflect.get(form, key) as { onSubmit?: unknown }).onSubmit === 'function');
  });
  try {
    await page.locator('input[type=email]').fill('dentista.a.r140@example.invalid');
    await page.locator('input[type=password]').fill(password);
    await page.locator('button[type=submit]').click();
    await page.waitForURL(url => url.pathname.startsWith('/dashboard'));
  } catch { throw new Error('Login QA interrompido; detalhes omitidos.'); }
}

async function capture(page: Page, name: string, data: object = {}) {
  if (!evidence) throw new Error('Evidencia ausente.');
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: join(evidence, `${name}.png`), fullPage: false });
  writeFileSync(join(evidence, `${name}.json`), JSON.stringify({ ...data,
    path: new URL(page.url()).pathname,
    width: await page.evaluate(() => innerWidth),
    theme: await page.locator('html').getAttribute('class'),
    main: await page.locator('main').innerText(),
  }, null, 2));
}

for (const port of [3013, 3012]) for (const width of [390, 1440]) {
  test(`runtime ${port} ${width}`, async ({ page }) => {
    const tag = `runtime-${port}-${width}`;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.name));
    await page.setViewportSize({ width, height: 900 });
    await login(page, port);

    if (!['1', 'apresentar'].includes(process.env.QA2_RUNTIME_CONTINUATION ?? '')) {
    // Samples start before hydration. No request/credential payloads are recorded.
    await page.addInitScript(() => {
      const samples: { t: number; theme: string; background: string }[] = [];
      Reflect.set(window, '__qaPaint', samples);
      const frame = () => {
        if (document.documentElement) samples.push({ t: performance.now(),
          theme: document.documentElement.className,
          background: getComputedStyle(document.documentElement).backgroundColor });
        if (samples.length < 80) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    for (const dark of [false, true]) {
      await page.goto(`http://localhost:${port}/dashboard`);
      if (width === 390) {
        await page.getByRole('banner').getByRole('button').click();
        const theme = page.getByRole('button', { name: /^(Modo Claro|Modo Escuro)$/ });
        await expect(theme).toBeVisible();
        if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== dark) await theme.click();
        await capture(page, `${tag}-${dark ? 'escuro' : 'claro'}-menu`);
        await page.locator('nav').getByRole('link', { name: 'Pacientes', exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/pacientes$/);
        await expect(theme).toBeHidden();
      } else {
        if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== dark) {
          await page.locator('button[title="Modo Claro"],button[title="Modo Escuro"]').first().click();
        }
        await expect(page.getByRole('banner', { includeHidden: true }).getByRole('button', { includeHidden: true })).toBeHidden();
      }
      await expect(page.locator('html')).toHaveClass(dark ? /dark/ : /light/);
      await page.goto(`http://localhost:${port}/dashboard`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => (Reflect.get(window, '__qaPaint') as unknown[])?.length >= 40);
      const samples: unknown = await page.evaluate(() => Reflect.get(window, '__qaPaint'));
      await capture(page, `${tag}-${dark ? 'escuro' : 'claro'}-paint`, { samples });
      await expect(page.locator('html')).toHaveClass(dark ? /dark/ : /light/);
      await expect(page.getByText('Primeiros passos', { exact: true })).toHaveCount(0);
    }

    await page.keyboard.press('Control+k');
    const search = page.getByPlaceholder('Buscar paciente, página ou ação...', { exact: true });
    await expect(search).toBeVisible();
    await expect(search).toBeFocused();
    await search.fill('QA MD OrtoAlerta');
    await expect(page.getByRole('button').filter({ hasText: 'QA MD OrtoAlerta' }).first()).toBeVisible();
    await capture(page, `${tag}-paleta-busca`);
    await page.keyboard.press('Escape');
    await expect(search).toBeHidden();
    }

    if (process.env.QA2_RUNTIME_CONTINUATION !== 'apresentar') {
    await page.goto(`http://localhost:${port}/dashboard/pacientes/novo`);
    await page.getByPlaceholder('DD', { exact: true }).fill('24');
    await expect(page.getByPlaceholder('MM', { exact: true })).toBeFocused();
    await page.keyboard.type('10');
    await expect(page.getByPlaceholder('AAAA', { exact: true })).toBeFocused();
    await page.keyboard.type('2000');
    await page.keyboard.press('Tab');
    await expect(page.getByPlaceholder('DD', { exact: true })).toHaveValue('24');
    await expect(page.getByPlaceholder('MM', { exact: true })).toHaveValue('10');
    await expect(page.getByPlaceholder('AAAA', { exact: true })).toHaveValue('2000');
    await capture(page, `${tag}-data-digitada`);
    }

    await page.goto(`http://localhost:${port}/dashboard/pacientes/${patient}`);
    await page.getByRole('button', { name: /^Apresentar/ }).first().click();
    const picker = page.getByRole('dialog', { name: 'Apresentar ficha', exact: true });
    await expect(picker).toBeVisible();
    await capture(page, `${tag}-apresentar-escolha`);
    await picker.getByRole('button').filter({ hasText: /\d{2}\/\d{2}\/\d{4}/ }).first().click();
    const present = page.getByRole('button', { name: 'Apresentar para o paciente', exact: true });
    await expect(present).toBeVisible();
    await capture(page, `${tag}-apresentar-editor`);
    await present.click();
    const close = page.locator('button[title="Fechar apresentação (Esc)"]');
    await expect(close).toBeVisible();
    await page.waitForTimeout(350);
    await capture(page, `${tag}-apresentar-tela-estavel`);
    await page.keyboard.press('Escape');
    await expect(close).toBeHidden();
    expect(errors, 'Erros de runtime sem dados sensiveis').toEqual([]);
  });
}
