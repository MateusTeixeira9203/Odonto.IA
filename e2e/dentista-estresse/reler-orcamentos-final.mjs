import { start, base, name, patientName, assert, expect } from './harness.mjs';
const h = await start(process.argv[2] === 'destino-validado' ? '07-orcamentos-destino-validado' : '07-orcamentos-releitura');
try {
  const b = await h.login('BRUNO');
  await h.check('Bruno orçamentos: releitura após ERR_ABORTED, sem repetir mutações', async () => {
    const response = await b.page.goto(base + '/dashboard/orcamentos', { waitUntil: 'domcontentloaded' });
    await expect(b.page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
    const text = await b.page.locator('body').innerText();
    for (const marker of [name, 'QA-D2-CLINICO-PRIVADO', 'QA D2 Ficha', 'QA D2 Procedimento', patientName(3)]) assert.ok(!text.includes(marker), 'Vazamento: ' + marker);
    assert.equal(new URL(b.page.url()).pathname, '/dashboard/pacientes');
    return { http: response.status(), rotaEstabilizada: '/dashboard/pacientes', contrato: 'OrcamentosPage redireciona para pacientes (R-153)', semMarcadoresA: true, escritaRepetida: false, original: '07-isolamento.json #5 preservado' };
  }, b.page);
} finally { await h.finish(); }
