import fs from 'node:fs';
import path from 'node:path';
import { start, id, name, base, dir, assert, expect } from './harness.mjs';
const h = await start('07-08-releituras');
try {
  const b = await h.login('BRUNO'), a = await h.login('ANA');
  await h.check('Automação I7: esperar notFound renderizar; nenhuma informação A exposta', async () => {
    await b.page.goto(base + '/dashboard/pacientes/' + id(1)); await expect(b.page.getByText('Página não encontrada', { exact: true })).toBeVisible();
    assert.ok(!(await b.page.locator('body').innerText()).includes(name)); return { paciente: id(1), causa: 'Primeira asserção leu shell antes do notFound; print original mostrava notFound.' };
  }, b.page);
  await h.check('Automação A8: escolher nome visível na agenda, ignorando duplicata responsiva oculta', async () => {
    const report = JSON.parse(fs.readFileSync(path.join(dir, '08-agenda.json'), 'utf8'));
    await a.page.goto(base + '/dashboard/agendamentos?d=2026-11-17&v=dia');
    const visible = a.page.getByText('QA D2 Sintético 3', { exact: true }).filter({ visible: true }).first(); await visible.scrollIntoViewIfNeeded(); await expect(visible).toBeVisible();
    const row = (await h.get('agendamentos', report.ids.agendamentoCriado))[0]; assert.equal(row.paciente_id, id(4)); assert.equal(row.status, 'cancelled');
    const encaixe = (await h.get('agendamentos', report.ids.encaixe))[0]; assert.equal(encaixe.paciente_id, id(3));
    return { criacaoEdicaoPersistidas: row.id, encaixeVisivel: encaixe.id, causa: 'Duas cópias responsivas no DOM; first() selecionava oculta. Sem repetição de escrita.' };
  }, a.page);
} finally { await h.finish(); }
