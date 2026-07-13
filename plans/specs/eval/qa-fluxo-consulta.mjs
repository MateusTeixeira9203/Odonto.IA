// QA do fluxo Modo Consulta (spec fase1-5, gate 3):
// login → Atender agora (walk-in c/ paciente de teste) → colar caso pesado → Organizar
// → Confirmar e salvar → botão "Concluir consulta" → aterrissa no perfil do paciente.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const DENTIST = { email: 'test-diag-0712@example.com', password: 'TesteDiag2026!' };
const SHOT = (n) => `C:/Users/mateu/AppData/Local/Temp/claude/C--Users-mateu-Desktop-Odonto-IA-main/f106501b-ac6e-4169-b76d-a6227a0d3bac/scratchpad/qa-${n}.png`;

const CASO_PESADO = `Paciente de reabilitação, ditando o resumo. Fiz raspagem supra e infra em toda a boca. O dezesseis com comprometimento pulpar, iniciei canal com curativo de hidróxido de cálcio. Extraí o dezoito, siso incluso. Os sisos vinte e oito e quarenta e oito ficam indicados pra exodontia nas próximas sessões. Facetas planejadas nos incisivos onze e vinte e um, preparei e moldei os dois hoje. Restaurei o quatorze na oclusal com resina. Paciente alérgico a dipirona, anotar. Retorno em sete dias.`;

const erros = [];
const log = (m) => console.log(`[qa] ${m}`);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') erros.push(msg.text().slice(0, 160)); });

  // 1. Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', DENTIST.email);
  await page.fill('input[type="password"]', DENTIST.password);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  log('login ok');

  // 2. Atender agora (procura o gatilho no dashboard; fallback: agendamentos)
  let gatilho = page.locator('button:has-text("Atender agora")').first();
  if (!(await gatilho.count())) {
    await page.goto(`${BASE}/dashboard/agendamentos`, { waitUntil: 'networkidle' });
    gatilho = page.locator('button:has-text("Atender agora")').first();
  }
  if (!(await gatilho.count())) throw new Error('botão "Atender agora" não encontrado');
  await gatilho.click();
  await page.fill('input[placeholder="Buscar por nome..."]', 'Maria');
  // Escopado ao portal do dialog — fora dele há chips da agenda com o mesmo nome.
  const sugestao = page.locator('[data-base-ui-portal] button:has-text("Maria")').first();
  await sugestao.waitFor({ timeout: 10000 });
  await sugestao.click();
  await page.waitForURL(/\/consulta\//, { timeout: 20000 });
  log(`no Modo Consulta: ${page.url()}`);

  // 3. Cola o caso pesado e organiza
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ timeout: 15000 });
  await textarea.fill(CASO_PESADO);
  await page.click('button:has-text("Organizar com DEX")');
  await page.locator('text=Confirmar evolução').waitFor({ timeout: 60000 });
  await page.screenshot({ path: SHOT('1-confirmar-evolucao'), fullPage: true });
  log('evolução organizada (screenshot 1)');

  // 4. Salva a ficha
  await page.click('button:has-text("Confirmar e salvar na ficha")');
  await page.locator('text=Ficha salva!').waitFor({ timeout: 30000 });
  log('ficha salva');

  // 5. Botão novo "Concluir consulta" visível → screenshot → clica
  const concluir = page.locator('button:has-text("Concluir consulta")');
  await concluir.waitFor({ timeout: 10000 });
  await page.screenshot({ path: SHOT('2-ficha-salva-concluir'), fullPage: true });
  log('botão "Concluir consulta" presente (screenshot 2)');
  await concluir.click();
  await page.waitForURL(/\/dashboard\/pacientes\//, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: SHOT('3-perfil-paciente'), fullPage: true });
  log(`aterrissou no perfil: ${page.url()} (screenshot 3)`);

  await browser.close();
  console.log(`\n=== QA FLUXO: PASS ===`);
  if (erros.length) {
    console.log(`console errors (${erros.length}):`);
    for (const e of [...new Set(erros)].slice(0, 8)) console.log(`  ✗ ${e}`);
  } else {
    console.log('zero console errors');
  }
}

main().catch((err) => { console.error('QA FALHOU:', err.message); process.exit(1); });
