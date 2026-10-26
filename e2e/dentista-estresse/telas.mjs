import { base, id, name, expect } from './harness.mjs';

export async function openFicha(page, n) {
  await page.goto(base + '/dashboard/pacientes/' + id(1));
  await page.getByRole('tab', { name: 'Prontuário', exact: true }).click({ timeout: 30000 });
  await page.getByRole('button', { name: new RegExp(`^Abrir ficha.*QA D2 Ficha ${n}`) }).first().click({ timeout: 20000 });
  await page.getByRole('region', { name: 'Ficha aberta no prontuário', exact: true }).waitFor();
}
export async function openDelete(page) {
  await page.getByRole('button', { name: 'Mais ações da Ficha', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Apagar Ficha', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Apagar esta ficha?', exact: true });
  await dialog.waitFor(); return dialog;
}
export async function fillDelete(dialog, motivo = 'aberta_por_engano', nome = name) {
  await dialog.getByRole('combobox').selectOption(motivo);
  await dialog.getByRole('textbox', { name: /Para confirmar, digite o nome do paciente/ }).fill(nome);
}
export async function cancelDelete(dialog) { await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click(); }
export async function deleted(h, n) { await expect.poll(async () => (await h.get('fichas', id(n))).length).toBe(0); }
