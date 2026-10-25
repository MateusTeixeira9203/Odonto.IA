import { expect, test, type Page, type TestInfo } from '@playwright/test';
export { expect, test };
export const baseURL = process.env.QA_BASE_URL ?? 'http://localhost:3015';
export const before = new URL(baseURL).port === '3014';
export const evidence = process.env.INICIO_EVIDENCE_DIR;
export function guard() {
  const url = new URL(baseURL);
  if (url.protocol !== 'http:' || url.hostname !== 'localhost' || !['3014', '3015'].includes(url.port)) throw new Error('Somente snapshots QA3 3014/3015.');
  if (process.env.INICIO_QA_HOST !== 'uhuxteswtvgdnlixwrdu.supabase.co') throw new Error('Host odonto-qa não confirmado.');
}
test.beforeEach(() => { guard(); });
export async function login(page: Page, role: 'ANA' | 'CARLOS' | 'SECRETARIA' | 'ADMIN' | 'PROTETICO' | 'BRUNO' = 'ANA') {
  const email = process.env['INICIO_' + role + '_EMAIL'];
  const password = process.env.INICIO_PASSWORD;
  if (!email || !password) throw new Error('Variáveis da conta fictícia ausentes.');
  await page.goto(baseURL + '/login');
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return form && Object.keys(form).some(k => k.startsWith('__reactProps') && typeof (Reflect.get(form, k) as {onSubmit?: unknown}).onSubmit === 'function');
  });
  try {
    await page.evaluate(({ email, password }) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      for (const [selector, value] of [['input[type=email]', email], ['input[type=password]', password]]) {
        const input = document.querySelector(selector);
        if (!(input instanceof HTMLInputElement) || !setter) throw new Error('Login indisponível.');
        setter.call(input, value);
        input.dispatchEvent(new Event('input', {bubbles:true}));
      }
    }, { email, password });
    await page.locator('button[type=submit]').click();
    await page.waitForURL(u => u.pathname.startsWith('/dashboard'), {timeout:60000});
  } catch { throw new Error('Login QA não concluiu; credenciais omitidas.'); }
}
export async function inicio(page: Page) {
  await page.goto(baseURL + '/dashboard');
  await expect(page.locator('h1').first()).toHaveText(/^(Bom dia|Boa tarde|Boa noite)/, {timeout:60000});
}
export async function capture(page: Page, info: TestInfo, label: string) {
  const metrics = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    heading: document.querySelector('h1')?.textContent,
    metrics: [...document.querySelectorAll('#dex-tour-metrics dd')].map(e => e.textContent),
    links: [...document.querySelectorAll('main a[href]')].map(e => ({text:e.textContent,href:e.getAttribute('href')})),
  }));
  await info.attach(label + '-dom', {body:JSON.stringify(metrics,null,2),contentType:'application/json'});
  if (evidence) await page.screenshot({path:evidence + '/' + label + '.png',fullPage:false,animations:'disabled'});
  return metrics;
}
export async function theme(page: Page, dark: boolean) {
  if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== dark)
    await page.locator('button[title="Modo Escuro"]:visible,button[title="Modo Claro"]:visible').first().click();
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(dark);
}
