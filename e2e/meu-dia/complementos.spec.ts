import { addPsr, captureState, expect, finalOnly, login, newVisit, openDay, prepareSuite, reloadDraft, saveOnce, syntheticDex, test } from './support';

prepareSuite();
test.beforeEach(() => finalOnly());

test('R16 R17 R18 observações, alerta e ortodontia sobrevivem à recarga e ao save', async ({ page }, info) => {
  await login(page);
  const visit = await newVisit(page, info, 'OrtoAlerta');
  const response = {
    ...syntheticDex([]), alerta_novo: 'QA alerta sintético de auditoria.',
    orto_manutencao: {
      arcada: 'superior', registro_superior: 'QA manutenção sintética superior.', registro_inferior: null,
      observacao_geral: 'QA observação ortodôntica.', fio: null, ativacao: 'QA ativação fictícia.',
      elastico_corrente: null, elastico_intermaxilar: null,
    },
  };
  await page.route('**/api/dex/formatar-evolucao', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) }));
  await page.getByRole('textbox', { name: 'Relato para organizar com Dex', exact: true }).fill('QA manutenção superior; registrar alerta fictício e observação.');
  await page.getByRole('button', { name: /Organizar com o Dex/ }).click();
  await expect(page.getByText('Manutenção ortodôntica', { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.values(sessionStorage).some(value => value.includes('QA alerta sintético de auditoria.')))).toBe(true);
  await reloadDraft(page);
  await expect(page.getByRole('heading', { name: visit.name, exact: true })).toBeVisible();
  await expect(page.getByText(/QA manutenção sintética superior/).first()).toBeVisible();
  await captureState(page, info, 'orto-alerta-rascunho-restaurado');
  await saveOnce(page, visit);
  await page.getByRole('link', { name: /Ver perfil completo/ }).click();
  await expect(page.getByText('QA alerta sintético de auditoria.', { exact: true })).toBeVisible();
  await captureState(page, info, 'orto-alerta-persistido');
});

test('R28 R38 gerar evolução usa contrato real simulado e exige revisão antes de salvar', async ({ page }, info) => {
  await login(page);
  const visit = await newVisit(page, info, 'GerarEvolucao');
  await addPsr(page);
  await page.getByRole('button', { name: /^S1 —/ }).click();
  await page.route('**/api/dex/sugerir-evolucao', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ texto: 'QA evolução fictícia sugerida, conferida pela dentista.' }),
  }));
  await page.getByRole('button', { name: 'Mais ações do atendimento', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Gerar evolução com Dex', exact: true }).click();
  await expect.poll(() => page.locator('textarea').evaluateAll(elements => elements.map(element => (element as HTMLTextAreaElement).value).join('\n')))
    .toContain('QA evolução fictícia sugerida');
  await captureState(page, info, 'evolucao-gerada-a-revisar');
  await saveOnce(page, visit);
});

test('R10 R15 troca de paciente pede confirmação, cancelar preserva e descartar isola rascunho', async ({ page }, info) => {
  await login(page);
  const first = await newVisit(page, info, 'TrocaA');
  const second = await newVisit(page, info, 'TrocaB');
  const editor = page.getByRole('textbox', { name: 'Relato para organizar com Dex', exact: true });
  await editor.fill('QA texto exclusivo do paciente B; nunca pode aparecer no A.');
  await page.locator(`[data-rail-alvo="${first.slotId}"]`).click();
  const warning = page.getByRole('alertdialog');
  await expect(warning).toContainText(second.name);
  await warning.getByRole('button', { name: 'Continuar editando', exact: true }).click();
  await expect(editor).toHaveValue('QA texto exclusivo do paciente B; nunca pode aparecer no A.');
  await page.locator(`[data-rail-alvo="${first.slotId}"]`).click();
  await warning.getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page.getByRole('heading', { name: first.name, exact: true })).toBeVisible();
  await expect(editor).toHaveValue('');
  await openDay(page, second);
  await expect(editor).toHaveValue('');
});
