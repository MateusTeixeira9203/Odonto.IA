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
const THROTTLE_MS = 3500; // gentileza com o rate-limit (20/60s por IP) — 8 casos x 3 runs = 24 chamadas
// Conta QA reusável (clínica odontoia-test.local) — a test-diag-0712@ foi limpa de prod em 07/2026.
const DENTIST = { email: 'qa-teste-dentista2@odontoia-test.local', password: 'QaTeste2026!' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const tagArg = process.argv.indexOf('--tag');
const TAG = tagArg !== -1 ? process.argv[tagArg + 1] : 'run';

const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Um procedimento "é um achado" se sua PRIMEIRA palavra normalizada bate com um termo de achado. */
function procIsAchado(proc, achadoTerm) {
  const first = norm(proc).split(/\s+/)[0];
  return first === norm(achadoTerm);
}

// ── Comparadores de odontograma_eventos (§7 v3) ──
/** faces do evento (ancora.faces) casam com as esperadas, ignorando ordem. */
function facesMatch(ev, expFaces) {
  if (!expFaces) return true;
  const got = (ev?.ancora?.faces ?? []).map(String).sort();
  const want = expFaces.map(String).sort();
  return got.length === want.length && got.every((f, i) => f === want[i]);
}
/** Um evento casa a espera por tipo (+status/dente/faces quando declarados). */
function eventoMatch(ev, exp) {
  if (!ev || norm(ev.tipo) !== norm(exp.tipo)) return false;
  if (exp.status && norm(ev.status) !== norm(exp.status)) return false;
  if (exp.dente != null && Number(ev?.ancora?.dente) !== Number(exp.dente)) return false;
  return facesMatch(ev, exp.faces);
}
function descEvento(exp) {
  return `{tipo:${exp.tipo}, status:${exp.status ?? '*'}, dente:${exp.dente ?? '*'}${exp.faces ? ', faces:' + exp.faces.join('') : ''}}`;
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', DENTIST.email);
  await page.fill('input[type="password"]', DENTIST.password);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

async function chamar(ctx, texto, modo) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    let res;
    try {
      // 45s > teto de 30s da rota: capturamos o 500 da rota em vez de estourar antes dela.
      res = await ctx.request.post(`${BASE}/api/dex/formatar-evolucao`, {
        data: modo ? { texto, modo } : { texto },
        timeout: 45000,
      });
    } catch (err) {
      // Timeout/erro de rede vira erro de rodada — nunca derruba a suíte inteira.
      return { erro: `request falhou: ${String(err?.message ?? err).slice(0, 120)}` };
    }
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

/** Avalia uma resposta contra a `espera` do caso. Retorna { falhas: string[], orphans: number[], alucinacoes: number[] }. */
function avaliar(resp, espera) {
  const falhas = [];
  const afetados = (resp.dentes_afetados ?? []).map(Number);
  const chaves = new Set(Object.keys(resp.dentes_observacoes ?? {}));

  // Invariante universal: nenhum dente órfão.
  const orphans = afetados.filter((d) => !chaves.has(String(d)));
  if (orphans.length) falhas.push(`ORFÃO: dente(s) ${orphans.join(',')} sem chave em dentes_observacoes`);

  // Universo fechado (casos pesados): dente fora de dentes_permitidos = alucinação, falha grave.
  let alucinacoes = [];
  if (espera.dentes_permitidos) {
    alucinacoes = afetados.filter((d) => !espera.dentes_permitidos.includes(d));
    if (alucinacoes.length) falhas.push(`ALUCINAÇÃO: dente(s) ${alucinacoes.join(',')} não estão no relato`);
  }

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
  if (espera.alerta_novo_nao_null && !(typeof resp.alerta_novo === 'string' && resp.alerta_novo.trim())) {
    falhas.push('alerta_novo veio null (alergia/medicamento mencionado no relato)');
  }
  // Adendo 13/07 §G: a observação de um dente específico deve conter um termo
  // (ex: nota de coordenação vira "Planejamento: ..." no dente certo).
  for (const [dente, termo] of Object.entries(espera.observacao_contem ?? {})) {
    const obs = norm((resp.dentes_observacoes ?? {})[String(Number(dente))] ?? '');
    if (!obs.includes(norm(termo))) falhas.push(`observação do dente ${dente} não contém "${termo}"`);
  }
  // Adendo 13/07 §G: nota de coordenação nunca vira item de procedimentos.
  for (const prefixo of espera.procedimentos_nao_contem_prefixo ?? []) {
    const ofensor = (resp.procedimentos ?? []).find((p) => norm(p).startsWith(norm(prefixo)));
    if (ofensor) falhas.push(`procedimentos contém item de coordenação "${ofensor}" (prefixo proibido: "${prefixo}")`);
  }

  // ── Odontograma v3 (§7 da spec spec-modo-consulta-v3-odontograma) ──
  const eventos = Array.isArray(resp.odontograma_eventos) ? resp.odontograma_eventos : [];
  for (const exp of espera.odontograma_eventos_contem ?? []) {
    if (!eventos.some((ev) => eventoMatch(ev, exp))) falhas.push(`odontograma_eventos não contém ${descEvento(exp)}`);
  }
  for (const exp of espera.odontograma_eventos_nao_contem ?? []) {
    if (eventos.some((ev) => eventoMatch(ev, exp))) falhas.push(`odontograma_eventos NÃO deveria conter ${descEvento(exp)}`);
  }
  // grupo_consistente: todos os dentes desse tipo devem cair sob UM único grupo_id (Fatia B).
  for (const g of espera.grupo_consistente ?? []) {
    const evs = eventos.filter((ev) => norm(ev.tipo) === norm(g.tipo) && g.dentes.includes(Number(ev?.ancora?.dente)));
    const ids = new Set(evs.map((ev) => ev.grupo_id).filter(Boolean));
    if (evs.length < g.dentes.length || ids.size !== 1) falhas.push(`grupo_consistente falhou p/ ${g.tipo} [${g.dentes.join(',')}] (grupos distintos: ${ids.size})`);
  }
  if (espera.orto_manutencao_nao_null && !(resp.orto_manutencao && typeof resp.orto_manutencao === 'object')) {
    falhas.push('orto_manutencao veio null (esperado preenchido)');
  }
  if (espera.odontograma_eventos_vazio && eventos.length > 0) {
    falhas.push(`odontograma_eventos deveria ser [] (veio ${eventos.length})`);
  }
  if (espera.origem_todos) {
    const off = eventos.filter((ev) => ev.origem !== espera.origem_todos);
    if (off.length) falhas.push(`${off.length} evento(s) com origem != "${espera.origem_todos}"`);
  }
  return { falhas, orphans, alucinacoes };
}

async function main() {
  const casos = JSON.parse(readFileSync(join(__dirname, 'formatar-evolucao-casos.json'), 'utf8')).casos;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page);

  const resultado = { tag: TAG, base: BASE, quando: new Date().toISOString(), casos: [] };

  for (const caso of casos) {
    if (caso.skip) { console.log(`\n[SKIP] ${caso.id}  (${caso.skip})`); continue; }
    const rodadas = [];
    for (let i = 0; i < RUNS_PER_CASE; i++) {
      const t0 = Date.now();
      const r = await chamar(ctx, caso.texto, caso.modo);
      const latMs = Date.now() - t0;
      if (r.erro) {
        rodadas.push({ erro: r.erro, latMs });
      } else {
        const { falhas, orphans, alucinacoes } = avaliar(r.data, caso.espera);
        rodadas.push({
          dentes_afetados: (r.data.dentes_afetados ?? []).map(Number).sort((a, b) => a - b),
          chaves_obs: Object.keys(r.data.dentes_observacoes ?? {}).map(Number).sort((a, b) => a - b),
          procedimentos: r.data.procedimentos ?? [],
          retorno: r.data.retorno_sugerido ?? null,
          orphans,
          alucinacoes,
          falhas,
          latMs,
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
  const latencias = resultado.casos.flatMap((c) => c.rodadas.filter((r) => !r.erro).map((r) => r.latMs)).sort((a, b) => a - b);
  const latP95 = latencias.length ? latencias[Math.floor(latencias.length * 0.95)] : 0;
  const latMed = latencias.length ? Math.round(latencias.reduce((a, b) => a + b, 0) / latencias.length) : 0;
  console.log(`\n=== RESUMO [${TAG}] ${pass}/${resultado.casos.length} casos PASS ===`);
  console.log(`orphans totais: ${resultado.casos.reduce((n, c) => n + c.orphansTotais, 0)}`);
  console.log(`alucinações totais: ${resultado.casos.reduce((n, c) => n + c.rodadas.reduce((m, r) => m + (r.alucinacoes?.length ?? 0), 0), 0)}`);
  console.log(`latência rota: méd=${latMed}ms p95=${latP95}ms (gate spec fase1-5: p95 < 6000ms)`);

  // Resultado fica junto dos casos (plans/ é a memória do projeto).
  const out = join(__dirname, `eval-resultado-${TAG}.json`);
  writeFileSync(out, JSON.stringify(resultado, null, 2));
  console.log(`Resultado completo: ${out}`);
}

main().catch((err) => { console.error('ERRO FATAL:', err); process.exit(1); });
