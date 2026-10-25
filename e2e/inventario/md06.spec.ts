import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = process.cwd();
const evidence = process.env.QA_MD06_EVIDENCE;
const slot = '962125c7-55f7-4af7-8f63-16cf4ea9e90d';
const patient = 'f8c8411f-d93a-401a-8983-80e2692190dd';
test.setTimeout(180_000);

async function login(page: Page, port: number) {
  const snapshot = resolve(root, '..', port === 3012 ? 'Odonto.IA-antes2' : 'Odonto.IA-depois3');
  const env = readFileSync(join(snapshot, '.env.development.local'), 'utf8');
  const host = env.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
  if (!host || new URL(host).hostname !== 'uhuxteswtvgdnlixwrdu.supabase.co') throw new Error('Host QA incorreto.');
  const raw = readFileSync(join(root, '.env.qa-contas'), 'utf8');
  const password = raw.match(/^#\s*Senha de todas:\s*(.+)\r?$/m)?.[1]?.trim();
  if (!password || !evidence) throw new Error('Configuracao QA incompleta.');
  mkdirSync(evidence, { recursive: true });
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

async function capture(page: Page, name: string) {
  if (!evidence) throw new Error('Pasta de evidencia ausente.');
  await page.screenshot({ path: join(evidence, `${name}.png`), fullPage: false });
  writeFileSync(join(evidence, `${name}.json`), JSON.stringify({
    path: new URL(page.url()).pathname,
    theme: await page.locator('html').getAttribute('class'),
    width: await page.evaluate(() => innerWidth),
    labels: await page.getByText(/^Dentição (permanente|decídua)$/).allTextContents(),
    teeth: await page.getByRole('button', { name: /^Dente (18|55) —/ }).allTextContents(),
    main: await page.locator('main').innerText(),
  }, null, 2));
}

async function cycle(page: Page, scope: Locator, name: string, header: boolean) {
  for (const [index, tab, tooth, label] of [
    [0, 'Permanentes', 18, 'Dentição permanente'],
    [1, 'Decíduos', 55, 'Dentição decídua'],
    [2, 'Permanentes', 18, 'Dentição permanente'],
  ] as const) {
    await scope.getByRole('button', { name: tab, exact: true }).click();
    const dental = scope.getByRole('button', { name: new RegExp(`^Dente ${tooth} —`) });
    await expect(dental).toBeVisible();
    await expect(scope.getByRole('button', { name: new RegExp(`^Dente ${tooth === 18 ? 55 : 18} —`) })).toHaveCount(0);
    if (header) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(1);
      await expect(page.getByText(label === 'Dentição permanente' ? 'Dentição decídua' : 'Dentição permanente', { exact: true })).toHaveCount(0);
    } else await expect(page.getByText(/^Dentição (permanente|decídua)$/)).toHaveCount(0);
    await dental.scrollIntoViewIfNeeded();
    await capture(page, `${name}-${index}-${tooth}`);
  }
}

for (const port of [3012, 3013]) {
  for (const width of [1440, 390]) {
    for (const dark of [false, true]) {
      test(`MD06 ${port} ${width} ${dark ? 'escuro' : 'claro'}`, async ({ page }) => {
        const tag = `MD06-${port}-${width}-${dark ? 'escuro' : 'claro'}`;
        await page.setViewportSize({ width: 1440, height: 900 });
        await login(page, port);
        await page.goto(`http://localhost:${port}/dashboard/meu-dia?ag=${slot}`);
        if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== dark) {
          await page.locator('button[title="Modo Escuro"],button[title="Modo Claro"]').first().click();
        }
        await expect(page.locator('html')).toHaveClass(dark ? /dark/ : /light/);
        await page.setViewportSize({ width, height: 900 });
        await page.locator(`[data-rail-alvo="${slot}"]`).click();
        await cycle(page, page.locator('main'), `${tag}-meu-dia`, port === 3013);

        // Consumidores usam o estado interno padrao; nenhum cabecalho do Meu Dia deve vazar.
        for (const origin of ['Prontuario', 'Ficha', 'Adicionar'] as const) {
          await page.goto(`http://localhost:${port}/dashboard/pacientes/${patient}`);
          await page.getByRole('tab', { name: 'Prontuário', exact: true }).click();
          if (origin !== 'Prontuario') await page.getByRole('button', { name: /Abrir ficha/ }).first().click();
          if (origin === 'Adicionar') {
            await page.getByRole('button', { name: 'Adicionar procedimentos', exact: true }).click();
            await expect(page.getByText('Registre pelo relato; revise cada item antes de incluir nesta ficha.', { exact: true })).toBeVisible();
            await expect(page.getByText(/^Dentição (permanente|decídua)$/)).toHaveCount(0);
            await capture(page, `${tag}-adicionar-padrao`);
          } else {
            await page.getByRole('button', { name: 'Novo atendimento', exact: true }).click();
            await cycle(page, page.locator('main'), `${tag}-${origin}`, false);
          }
        }
      });
    }
  }
}
