// Harness de eval — consistência da estruturação clínica (Spec Fase 1 #2 / C3).
//
// PRÉ-REQUISITOS:
//   - Servidor de PRODUÇÃO rodando em localhost:3000 (npm run build && npm run start).
//     Não usar dev (HMR polui). Rebuild entre rodadas quando o prompt mudar.
//   - Playwright instalado localmente sem sujar o package.json:  npm i --no-save playwright
//     (usa o chromium já em %LOCALAPPDATA%/ms-playwright)
//   - Conta de teste test-diag-0712@ existente em prod (auth por cookie de sessão).
//
// COMO RODAR (da raiz do repo, pra o import de 'playwright' resolver):
//   node plans/specs/eval/run-formatar-evolucao.mjs
//   node plans/specs/eval/run-formatar-evolucao.mjs --tag baseline   (rótulo no arquivo de saída)
//
// SAÍDA: tabela no stdout + JSON completo em scratchpad (ou ./eval-resultado-*.json como fallback).

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.EVAL_BASE ?? 'http://localhost:3000';
const RUNS_PER_CASE = 3;
const THROTTLE_MS = 2000; // gentileza com o rate-limit (20/60s por IP)
const DENTIST = { email: 'test-diag-0712@example.com', password: 'TesteDiag2026!' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const tagArg = process.argv.indexOf('--tag');
const TAG = tagArg !== -1 ? process.argv[tagArg + 1] : 'run';

const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Um procedimento "é um achado" se sua PRIMEIRA palavra normalizada bate com um termo de achado. */
function procIsAchado(proc, achadoTerm) {
  const first = norm(proc).split(/\s+/)[0];
  return first === norm(achadoTerm);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', DENTIST.email);
  await page.fill('input[type="password"]', DENTIST.password);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function chamar(ctx, texto) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const res = await ctx.request.post(`${BASE}/api/dex/formatar-evolucao`, {
      data: { texto },
      timeout: 30000,
    });
    if (res.status() === 429) {
      const retry = Number(res.headers()['retry-after'] ?? 3);
      await new Promise((r) => setTimeout(r, (retry + 1) * 1000));
      continue;
    }
    if (!res.ok()) return { erro: `HTTP ${res.status()}`, body: await res.text() };
    return { data: await res.json() };
  }
  return { erro: 'rate-limit persistente após retry' };
}

/** Avalia uma resposta contra a `espera` do caso. Retorna { falhas: string[], orphans: number[] }. */
function avaliar(resp, espera) {
  const falhas = [];
  const afetados = (resp.dentes_afetados ?? []).map(Number);
  const chaves = new Set(Object.keys(resp.dentes_observacoes ?? {}));

  // Invariante universal: nenhum dente órfão.
  const orphans = afetados.filter((d) => !chaves.has(String(d)));
  if (orphans.length) falhas.push(`ORFÃO: dente(s) ${orphans.join(',')} sem chave em dentes_observacoes`);

  for (const d of espera.dentes_afetados_contem ?? []) {
    if (!afetados.includes(d)) falhas.push(`dentes_afetados não contém ${d}`);
  }
  for (const d of espera.dentes_observacoes_tem_chave ?? []) {
    if (!chaves.has(String(d))) falhas.push(`dentes_observacoes sem chave "${d}"`);
  }
  for (const termo of espera.procedimentos_nao_contem_achado ?? []) {
    const ofensor = (resp.procedimentos ?? []).find((p) => procIsAchado(p, termo));
    if (ofensor) falhas.push(`procedimento é achado "${ofensor}" (esperado: intervenção, não "${termo}")`);
  }
  for (const termo of espera.anotacoes_contem ?? []) {
    if (!norm(resp.anotacoes).includes(norm(termo))) falhas.push(`anotacoes não contém "${termo}"`);
  }
  for (const termo of espera.anotacoes_nao_contem ?? []) {
    if (norm(resp.anotacoes).includes(norm(termo))) falhas.push(`anotacoes contém ruído "${termo}"`);
  }
  if (espera.retorno_sugerido_nao_null && !resp.retorno_sugerido) {
    falhas.push('retorno_sugerido veio null (esperado prazo)');
  }
  return { falhas, orphans };
}

async function main() {
  const casos = JSON.parse(readFileSync(join(__dirname, 'formatar-evolucao-casos.json'), 'utf8')).casos;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page);

  const resultado = { tag: TAG, base: BASE, quando: new Date().toISOString(), casos: [] };

  for (const caso of casos) {
    const rodadas = [];
    for (let i = 0; i < RUNS_PER_CASE; i++) {
      const r = await chamar(ctx, caso.texto);
      if (r.erro) {
        rodadas.push({ erro: r.erro });
      } else {
        const { falhas, orphans } = avaliar(r.data, caso.espera);
        rodadas.push({
          dentes_afetados: (r.data.dentes_afetados ?? []).map(Number).sort((a, b) => a - b),
          chaves_obs: Object.keys(r.data.dentes_observacoes ?? {}).map(Number).sort((a, b) => a - b),
          procedimentos: r.data.procedimentos ?? [],
          retorno: r.data.retorno_sugerido ?? null,
          orphans,
          falhas,
        });
      }
      await new Promise((res) => setTimeout(res, THROTTLE_MS));
    }

    // Estabilidade estrutural entre as 3 rodadas (dentes + chaves).
    const validas = rodadas.filter((r) => !r.erro);
    const assinaturas = validas.map((r) => `${r.dentes_afetados.join(',')}|${r.chaves_obs.join(',')}`);
    const estavel = assinaturas.length > 1 && assinaturas.every((a) => a === assinaturas[0]);
    const totalFalhas = validas.reduce((n, r) => n + r.falhas.length, 0);
    const orphansTotais = validas.reduce((n, r) => n + r.orphans.length, 0);

    resultado.casos.push({ id: caso.id, provenance: caso.provenance, estavel, totalFalhas, orphansTotais, rodadas });

    const status = rodadas.some((r) => r.erro) ? 'ERRO' : totalFalhas === 0 && estavel ? 'PASS' : 'FAIL';
    console.log(`\n[${status}] ${caso.id}  (orphans=${orphansTotais}, falhas=${totalFalhas}, estável=${estavel})`);
    for (const [i, r] of rodadas.entries()) {
      if (r.erro) { console.log(`  run${i + 1}: ERRO ${r.erro}`); continue; }
      console.log(`  run${i + 1}: afetados=[${r.dentes_afetados}] chaves=[${r.chaves_obs}] proc=${JSON.stringify(r.procedimentos)}`);
      for (const f of r.falhas) console.log(`         ✗ ${f}`);
    }
  }

  await browser.close();

  // Resumo
  const pass = resultado.casos.filter((c) => c.totalFalhas === 0 && c.estavel && c.rodadas.every((r) => !r.erro)).length;
  console.log(`\n=== RESUMO [${TAG}] ${pass}/${resultado.casos.length} casos PASS ===`);
  console.log(`orphans totais: ${resultado.casos.reduce((n, c) => n + c.orphansTotais, 0)}`);

  const SCRATCH = 'C:/Users/mateu/AppData/Local/Temp/claude/C--Users-mateu-Desktop-Odonto-IA-main/fff5c442-4df7-466b-aa83-78731a50485b/scratchpad';
  let out;
  try {
    out = join(SCRATCH, `eval-formatar-${TAG}.json`);
    writeFileSync(out, JSON.stringify(resultado, null, 2));
  } catch {
    out = join(__dirname, `eval-resultado-${TAG}.json`);
    writeFileSync(out, JSON.stringify(resultado, null, 2));
  }
  console.log(`Resultado completo: ${out}`);
}

main().catch((err) => { console.error('ERRO FATAL:', err); process.exit(1); });
