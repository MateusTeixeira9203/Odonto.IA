import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Contas fictícias: credenciais lidas apenas em memória, sem trace ou storageState.
const root = 'C:/Users/mateu/Desktop/Projetos clone/Odonto.IA';
const accounts = {
  ana: 'dentista.a.r140@example.invalid',
  admin: 'admin.a.auditoria@example.invalid',
  secretaria: 'secretaria.a.auditoria@example.invalid',
  protetico: 'protetico.a.qa@example.invalid',
  outra: 'dentista.b.r140@example.invalid',
};
async function login(page: Page, port: number, role: keyof typeof accounts) {
  const raw = readFileSync(join(root, '.env.qa-contas'), 'utf8');
  const password = raw.match(/^#\s*Senha de todas:\s*(.+)\r?$/m)?.[1]?.trim();
  if (!password) throw new Error('Credencial QA indisponível; conteúdo omitido.');
  await page.goto(`http://localhost:${port}/login`);
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return form && Object.keys(form).some(key => key.startsWith('__reactProps') &&
      typeof (Reflect.get(form, key) as { onSubmit?: unknown }).onSubmit === 'function');
  });
  try {
    await page.locator('input[type=email]').fill(accounts[role]);
    await page.locator('input[type=password]').fill(password);
    await page.locator('button[type=submit]').click();
    await page.waitForURL(url => url.pathname.startsWith('/dashboard'));
  } catch { throw new Error('Login QA interrompido; detalhes omitidos.'); }
}
const patient = 'e0000000-0000-4000-8000-000000000901';
const ficha = 'e0000000-0000-4000-8000-000000000911';
test.setTimeout(180_000);

for (const role of [...Object.keys(accounts), 'anonimo'] as (keyof typeof accounts | 'anonimo')[]) {
  test(`009f PDF por papel: ${role}`, async ({ page }) => {
    if (role !== 'anonimo') await login(page, 3013, role);
    for (const [route, expected] of [
      [`/api/fichas/${ficha}/pdf`, role === 'anonimo' ? 401 : role === 'secretaria' ? 403 : ['protetico', 'outra'].includes(role) ? 404 : 200],
      [`/api/pacientes/${patient}/prontuario`, role === 'anonimo' ? 401 : ['protetico', 'outra'].includes(role) ? 404 : 200],
    ] as const) {
      const response = await page.request.get(`http://localhost:3013${route}`);
      expect(response.status()).toBe(expected);
      const body = await response.text();
      if (expected !== 200 || role === 'secretaria') {
        expect(body).not.toContain('Avaliacao ficticia');
        expect(body).not.toContain('Restauracao do 16 concluida');
      } else {
        expect(body).toContain('Avaliacao ficticia');
        expect(body).toContain('Restauracao do 16 concluida');
      }
      if (role === 'secretaria' && expected === 200) {
        expect(body).toContain('Versão administrativa: sem dados clínicos.');
        expect(body).not.toMatch(/Fichas Cl[ií]nicas|Evolu[çc][aã]o cl[ií]nica/);
      }
    }
  });
}
for (const port of [3012, 3013]) {
  test(`014 evolução vigente antes/depois ${port}`, async ({ page }) => {
    await login(page, port, 'ana');
    const response = await page.request.get(`http://localhost:${port}/api/fichas/6a7a35ed-bae9-437c-9e03-d401761944c0/pdf`);
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body.includes('QA segunda verificacao de evolucao OD-003')).toBe(port === 3013);
    expect(body.includes('QA evolucao inicial OD-003')).toBe(port === 3012);
    const full = await page.request.get(`http://localhost:${port}/api/pacientes/a7818276-90c1-457c-b4b9-3feea177b7c3/prontuario`);
    expect(full.status()).toBe(200);
    const html = await full.text();
    expect(html.includes('QA evolucao inicial OD-003')).toBe(port === 3012);
    expect(html.split('QA segunda verificacao de evolucao OD-003').length - 1).toBe(port === 3013 ? 2 : 1);
  });
  test(`004 baseline cartões e detalhe ${port}`, async ({ page }, info) => {
    await login(page, port, 'ana');
    await page.goto(`http://localhost:${port}/dashboard/pacientes/e0000000-0000-4000-8000-000000000801?tab=orcamentos`);
    for (const date of ['05', '06', '07', '08']) {
      const card = page.getByRole('button', { name: new RegExp(`Abrir orçamento de ${date}/10/2026`) });
      await card.click();
      const dialog = page.getByRole('dialog', { name: 'Orçamento', exact: true });
      await expect(dialog).toBeVisible();
      await info.attach(`orcamento-${date}-${port}`, { body: await dialog.ariaSnapshot(), contentType: 'text/plain' });
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
  });
}

test('@reteste OD010 assinado bloqueia exclusão sem enviar escrita', async ({ page }, info) => {
  await login(page, 3013, 'ana');
  const url = 'http://localhost:3013/dashboard/pacientes/76432f42-e381-4934-91db-70f6e76c918a?tab=orcamentos';
  await page.goto(url);
  const card = page.getByRole('button', { name: /^Abrir orçamento de/ }).filter({ hasText: '2.000,00' }).first();
  await card.click();
  const detail = page.getByRole('dialog', { name: 'Orçamento', exact: true });
  await expect(detail).toContainText('2.000');
  await detail.getByRole('button', { name: 'Excluir', exact: true }).click();
  const blocked = page.getByRole('dialog', { name: 'Excluir orçamento', exact: true });
  await expect(blocked).toContainText('tem aceite assinado pelo paciente e não pode ser excluído');
  await expect(blocked.getByRole('button', { name: 'Excluir', exact: true })).toHaveCount(0);
  await expect(blocked.getByRole('button', { name: 'Fechar', exact: true })).toBeVisible();
  await info.attach('bloqueio-assinado', { body: await blocked.ariaSnapshot(), contentType: 'text/plain' });
  await blocked.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.reload();
  await expect(card).toBeVisible();
});

test('@reteste OD011 texto na ficha escolhida e recarga', async ({ page }, info) => {
  test.skip(process.env.QA2_WRITE_READY !== 'OD011', 'Escrita QA exige liberação explícita em memória.');
  await login(page, 3013, 'ana');
  const url = 'http://localhost:3013/dashboard/pacientes/5c8c53fc-adb7-4061-880c-1bd3ddf3f426?tab=ficha-clinica';
  await page.goto(url);
  const cards = page.getByRole('button', { name: /^Abrir ficha/ });
  await expect(cards.first()).toBeVisible();
  const before = await cards.allTextContents();
  const chosen = page.getByRole('button', { name: /Abrir ficha.*QA OD011 ficha escolhida/ }).first();
  await chosen.click();
  const opened = page.getByRole('region', { name: 'Ficha aberta no prontuário' });
  await expect(opened).toBeVisible();
  await opened.getByRole('button', { name: 'Novo atendimento', exact: true }).click();
  await page.getByRole('button', { name: '+ Evolução', exact: true }).click();
  const text = `QA2 OD011 reteste ficticio ${Date.now()}`;
  await page.getByPlaceholder('Curativo, sutura, orientação ou evolução da consulta').fill(text);
  // Uma única tentativa: timeout exige inspeção, nunca retry automático de escrita.
  await page.getByRole('button', { name: 'Salvar atendimento', exact: true }).click();
  await expect(opened).toBeVisible({ timeout: 45_000 });
  await expect(opened).toContainText(text);
  await expect(opened.locator('[data-sessao][aria-current=true]')).toContainText(text);
  await info.attach('sessao-persistida', { body: await opened.ariaSnapshot(), contentType: 'text/plain' });
  await page.reload();
  await expect(cards.first()).toBeVisible();
  expect((await cards.allTextContents()).some(value => value.includes('QA OD011 ficha escolhida'))).toBe(true);
  await info.attach('fichas-antes', { body: JSON.stringify(before), contentType: 'application/json' });
  await chosen.click();
  await expect(opened).toContainText(text);
});

for (const port of [3012, 3013]) {
  test(`@visual ficha e orçamento temas e larguras ${port}`, async ({ page }, info) => {
    await login(page, port, 'ana');
    const records: unknown[] = [];
    const evidence = process.env.QA2_EVIDENCE_DIR ?? 'C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/prints';
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const dark of [false, true]) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`http://localhost:${port}/dashboard/pacientes/e0000000-0000-4000-8000-000000000801?tab=orcamentos`);
        if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== dark) {
          await page.locator('button[title="Modo Escuro"],button[title="Modo Claro"]').first().click();
        }
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole('button', { name: /Abrir orçamento de 06\/10\/2026/ }).click();
        const dialog = page.getByRole('dialog', { name: 'Orçamento', exact: true });
        await expect(dialog).toBeVisible();
        await page.waitForTimeout(250);
        const measurement = await page.evaluate(() => ({
          width: innerWidth, scroll: document.documentElement.scrollWidth,
          dialogWidth: document.querySelector('[role=dialog]')?.clientWidth,
          overflow: [...document.querySelectorAll('[role=dialog] *')].filter(el => {
            const css = getComputedStyle(el);
            return css.overflowY === 'auto' && el.scrollHeight > el.clientHeight + 2;
          }).map(el => ({ tag: el.tagName, client: el.clientHeight, scroll: el.scrollHeight })),
        }));
        records.push({ port, dark, type: 'orcamento', ...measurement });
        expect(measurement.scroll).toBeLessThanOrEqual(width);
        await page.screenshot({ path: `${evidence}/QA2-004-${width}-${dark ? 'escuro' : 'claro'}-${port === 3012 ? 'antes' : 'depois'}.png`, fullPage: false });
        await page.keyboard.press('Escape');
        await page.goto(`http://localhost:${port}/dashboard/pacientes/e0000000-0000-4000-8000-000000000901?tab=ficha-clinica`);
        await page.getByRole('button', { name: /^Abrir ficha/ }).first().click();
        const opened = page.getByRole('region', { name: 'Ficha aberta no prontuário' });
        await expect(opened).toBeVisible();
        await page.waitForTimeout(250);
        const fichaMeasure = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        records.push({ port, dark, type: 'ficha', ...fichaMeasure });
        expect(fichaMeasure.scroll).toBeLessThanOrEqual(width);
        await page.screenshot({ path: `${evidence}/QA2-003-${width}-${dark ? 'escuro' : 'claro'}-${port === 3012 ? 'antes' : 'depois'}.png`, fullPage: false });
      }
    }
    const measurementsDir = process.env.QA2_EVIDENCE_DIR ? evidence : join(evidence, '..');
    writeFileSync(join(measurementsDir, 'QA2-medidas-' + port + '.json'), JSON.stringify(records, null, 2));
    await info.attach('medidas', { body: JSON.stringify(records, null, 2), contentType: 'application/json' });
  });
}

test('@f3 003f dez sessões e anteriores, controle de edição da autora', async ({ page }, info) => {
  await login(page, 3013, 'ana');
  await page.goto('http://localhost:3013/dashboard/pacientes/b0000000-0000-4000-8000-0000000000a4?tab=ficha-clinica');
  await page.getByRole('button', { name: /Abrir ficha.*Manutencao periodontal/ }).first().click();
  const opened = page.getByRole('region', { name: 'Ficha aberta no prontuário' });
  await expect(opened.locator('[data-sessao]')).toHaveCount(10);
  await page.getByRole('button', { name: /Mostrar sessões anteriores/ }).click();
  await expect(opened.locator('[data-sessao]')).toHaveCount(12);
  await info.attach('f3-doze-sessoes', { body: await opened.ariaSnapshot(), contentType: 'text/plain' });
  await expect(opened.getByRole('button', { name: /Editar evolução/ }).first()).toBeVisible();
});
