import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export { expect, test };

export const scope = process.env.MD_SCOPE ?? 'changed';
export const baseURL = process.env.QA_BASE_URL ?? 'http://localhost:3011';

export function assertSnapshot(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' || parsed.hostname !== 'localhost' || !['3010', '3011', '3021'].includes(parsed.port)) {
    throw new Error('Meu Dia QA permite somente localhost:3010/3011/3021.');
  }
}

export function prepareSuite(): void {
  test.describe.configure({ mode: 'default', retries: 0 });
  test.beforeEach(async () => {
    test.skip(process.env.MD_RETEST_READY !== 'OD-001r+OD-002g', 'Aguardar as duas correções e liberação do reteste.');
    assertSnapshot(baseURL);
    if (!['changed', 'final'].includes(scope)) throw new Error('MD_SCOPE deve ser changed ou final.');
  });
}

export function finalOnly(): void {
  test.skip(scope !== 'final', 'Inventário amplo reservado ao reteste final.');
}

export async function login(page: Page, role: 'ana' | 'carlos' | 'secretaria' = 'ana'): Promise<void> {
  assertSnapshot(baseURL);
  const prefix = role === 'ana' ? 'QA' : role === 'carlos' ? 'QA_CARLOS' : 'QA_SECRETARIA';
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) throw new Error(`Defina ${prefix}_EMAIL e ${prefix}_PASSWORD em memória; não grave no teste.`);
  // Contextos distintos no teste Ana/Carlos; não reutilizar sessão de outro papel.
  await page.goto(`${baseURL}/login`);
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    if (!form) return false;
    return Object.keys(form).some(key => key.startsWith('__reactProps') &&
      typeof (Reflect.get(form, key) as { onSubmit?: unknown }).onSubmit === 'function');
  });
  try {
    // Não usar test.step com credenciais, trace, vídeo, storageState ou anexos do login.
    await page.evaluate(({ emailValue, passwordValue }) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      for (const [selector, value] of [['input[type=email]', emailValue], ['input[type=password]', passwordValue]]) {
        const input = document.querySelector(selector);
        if (!(input instanceof HTMLInputElement) || !setter) throw new Error('Formulário indisponível.');
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, { emailValue: email, passwordValue: password });
    await page.locator('button[type=submit]').click();
    await page.waitForURL(url => url.pathname.startsWith('/dashboard'));
  } catch {
    throw new Error('Login QA não concluiu; detalhes e credenciais omitidos.');
  }
}

export type OwnVisit = { name: string; slotId: string };

export async function openDay(page: Page, visit?: OwnVisit): Promise<void> {
  await page.goto(`${baseURL}/dashboard/meu-dia${visit ? `?ag=${visit.slotId}` : ''}`);
  if (new URL(baseURL).port === '3010') await expect(page.getByRole('button', { name: /^(Encaixe|Atender agora)$/ })).toBeVisible();
  else await expect(page.getByRole('heading', { name: 'Meu Dia', exact: true })).toBeVisible();
  if (visit) {
    const slot = page.locator(`[data-rail-alvo="${visit.slotId}"]`);
    if (new URL(baseURL).port !== '3010' && await slot.getAttribute('aria-pressed') !== 'true') await slot.click();
    if (new URL(baseURL).port !== '3010') await expect(slot).toHaveAttribute('aria-pressed', 'true');
  }
}

export async function encaixe(page: Page, name: string, create: boolean): Promise<OwnVisit> {
  if (!name.startsWith('QA ')) throw new Error('Escrita restrita a paciente próprio QA.');
  await openDay(page);
  await page.getByRole('button', { name: /^(Encaixe|Atender agora)$/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Atender agora', exact: true });
  await dialog.getByPlaceholder('Buscar por nome...', { exact: true }).fill(name);
  if (create) await dialog.getByRole('button', { name: `Cadastrar “${name}” e atender`, exact: true }).click();
  else await dialog.getByText(name, { exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Relato para organizar com Dex', exact: true })).toBeVisible();
  const selected = page.locator('[data-rail-alvo][aria-pressed=true]');
  const slotId = await selected.getAttribute('data-rail-alvo');
  if (!slotId || !/^[\da-f-]{36}$/i.test(slotId)) throw new Error('Encaixe ainda não selecionou o agendamento. Não repetir criação.');
  return { name, slotId };
}

export async function newVisit(page: Page, info: TestInfo, label: string): Promise<OwnVisit> {
  if (process.env.MD_FINAL_REUSE === '2c6eeff') {
    const fixtures: Record<string, OwnVisit> = {
      Salvar: { name: 'QA MD LacunaEncaixe 3010 1792892245629', slotId: '9fd836cc-af5f-4ffb-b221-fc91256be87b' },
      Documento: { name: 'QA MD LacunaEncaixe 3011 1792892275609', slotId: '259a84e6-e19d-4cfd-b7bc-91876f1c4bca' },
      GerarEvolucao: { name: 'QA MD LacunaEncaixe 3010 1792892343333', slotId: '51365abf-db3f-4519-b150-c1b9c3e5e6a1' },
      PSR: { name: 'QA MD LacunaEncaixe 3011 1792892376521', slotId: 'cef4d30f-55ba-4802-baa6-aff960c17a95' },
      TrocaB: { name: 'QA MD ChipsPreservados 1792891721218 0', slotId: 'd59318dc-57dc-458f-99fd-86f434b1e4b5' },
      FilaB: { name: 'QA MD ChipsPreservados 1792891721218 0', slotId: 'd59318dc-57dc-458f-99fd-86f434b1e4b5' },
    };
    const visit = fixtures[label] ?? { name: 'QA MD Restauracao1440 1792891310664 0', slotId: '962125c7-55f7-4af7-8f63-16cf4ea9e90d' };
    await openDay(page, visit);
    await expect(page.getByRole('heading', { name: visit.name, exact: true })).toBeVisible();
    await page.waitForFunction(() => {
      const editor = document.querySelector('textarea[aria-label="Relato para organizar com Dex"]');
      return editor != null && Object.keys(editor).some(key => key.startsWith('__reactProps') &&
        typeof (Reflect.get(editor, key) as { onChange?: unknown }).onChange === 'function');
    });
    await page.getByRole('textbox', { name: 'Relato para organizar com Dex', exact: true }).click();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await writeFile(info.outputPath('fixture-reutilizada.json'), JSON.stringify({ label, ...visit }));
    return visit;
  }
  const name = `QA MD ${label} ${Date.now()} ${info.workerIndex}`;
  const visit = await encaixe(page, name, true);
  const recordPath = info.outputPath('registro-sintetico-criado.json');
  await writeFile(recordPath, JSON.stringify(visit));
  await info.attach('registro-sintetico-criado', { path: recordPath, contentType: 'application/json' });
  return visit;
}

export function syntheticDex(teeth: number[] = [26, 27], type = 'carie_restauracao') {
  return {
    queixa_principal: 'QA queixa fictícia.', dentes_observacoes: {},
    anotacoes: 'QA relato fictício preservado.', conduta: 'QA retorno para revisão.', alerta_novo: null,
    dentes_afetados: teeth, procedimentos: teeth.map(d => `QA procedimento ${d}`), orto_manutencao: null,
    odontograma_eventos: teeth.map(dente => ({
      tipo: type, procedimentoNome: `QA procedimento ${dente}`, status: 'indicado', origem: 'clinica',
      momento_planejado: 'sessao_atual', ancora: { nivel: 'dente', dente, faces: [] },
      grupo_id: null, papel_no_grupo: null, observacao: 'QA observação fictícia.',
      evidencia_status: 'indicacao_explicita', revisar_status: false,
    })),
  };
}

export async function organize(page: Page, teeth: number[] = [26, 27], type = 'carie_restauracao'): Promise<void> {
  await page.route('**/api/dex/formatar-evolucao', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(syntheticDex(teeth, type)),
  }));
  await page.getByRole('textbox', { name: 'Relato para organizar com Dex', exact: true }).last()
    .fill(`QA indiquei procedimentos fictícios nos dentes ${teeth.join(', ')}.`);
  await page.getByRole('button', { name: /Organizar com o Dex/ }).click();
  for (const dente of teeth) await expect(page.getByRole('combobox', { name: `Nome do procedimento ${dente}`, exact: true })).toBeVisible();
}

export async function addPsr(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Adicionar tabela/ }).click();
  await page.getByRole('menuitem', { name: 'Periodontia (PSR)', exact: true }).click();
  await expect(page.getByRole('button', { name: /^S1 —/ })).toBeVisible();
}

export async function saveOnce(page: Page, visit: OwnVisit, shortcut = false): Promise<void> {
  if (process.env.MD_FINAL_REUSE === '2c6eeff' && process.env.MD_ALLOW_WRITE !== 'OWN_FIXTURES_2c6eeff') {
    throw new Error('Save da regressão final exige opt-in MD_ALLOW_WRITE.');
  }
  const selected = page.locator(`[data-rail-alvo="${visit.slotId}"]`);
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: visit.name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar atendimento', exact: true })).toBeEnabled();
  if (shortcut) await page.keyboard.press('ControlOrMeta+s');
  else await page.getByRole('button', { name: 'Salvar atendimento', exact: true }).click();
  // Não presumir que o app ficará no atendimento: ele pode avançar/esvaziar a seleção.
  // Não repetir o clique em caso de timeout/resultado incerto: inspecionar persistência primeiro.
  await expect(selected).toContainText('registrado', { timeout: 30_000 });
  await openDay(page, visit);
  await expect(page.getByRole('region', { name: 'Atendimento já registrado', exact: true })).toBeVisible();
}

export async function reloadDraft(page: Page): Promise<void> {
  // O aviso nativo de saída não é falha do roteiro; confirmar somente esta recarga.
  const accept = async (dialog: import('@playwright/test').Dialog) => { await dialog.accept(); };
  page.once('dialog', accept);
  try { await page.reload(); } finally { page.off('dialog', accept); }
}

export async function captureState(page: Page, info: TestInfo, label: string, assertResponsive = true): Promise<void> {
  const measurement = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    tables: [...document.querySelectorAll('[data-tabela-evento]')].map(element => ({
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
    })),
    teeth: [...document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Dente "]')].map(element => {
      const rect = element.getBoundingClientRect();
      return { name: element.getAttribute('aria-label'), width: rect.width, x: rect.x, y: rect.y };
    }),
  }));
  const domPath = info.outputPath(`${label}-dom.json`);
  const screenshotPath = info.outputPath(`${label}.png`);
  await writeFile(domPath, JSON.stringify(measurement, null, 2));
  await page.screenshot({ path: screenshotPath, fullPage: false, animations: 'disabled' });
  await info.attach(`${label}-dom`, { path: domPath, contentType: 'application/json' });
  await info.attach(label, { path: screenshotPath, contentType: 'image/png' });
  if (assertResponsive) expect(measurement.scrollWidth, `${label}: overflow horizontal da página`).toBeLessThanOrEqual(measurement.width);
}

export async function setTheme(page: Page, dark: boolean): Promise<void> {
  if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== dark) {
    await page.locator('button[title="Modo Escuro"],button[title="Modo Claro"]').first().click();
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(dark);
}
