// Executar: node scripts/tests/r166-desconto-qa.mjs /diretorio/privado/das/fixtures
// Somente Supabase Free com contas sintéticas; nunca apontar este script à produção.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const fixtureDir = process.argv[2];
assert.ok(fixtureDir, 'Informe o diretório privado das fixtures sintéticas.');
const config = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'connection.json'), 'utf8'));
const fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'fixture.json'), 'utf8'));
assert.equal(config.project_ref, 'etlqznuoxiilvxzygpat');
assert.equal(fixture.project_ref, config.project_ref);
assert.equal(new URL(config.url).hostname, `${config.project_ref}.supabase.co`);
const results = [];
async function request(account, route, method = 'GET', body) {
  const r = await fetch(`${config.url}/rest/v1/${route}`, {
    method, headers: { apikey: config.anon_key, Authorization: `Bearer ${account.token}`,
      'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null };
}
function ok(result) {
  assert.ok(result.status < 300, `HTTP ${result.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}
async function login(account) {
  const r = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: config.anon_key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.user.id, account.user_id);
  return { ...account, token: data.access_token };
}
const A = await login(fixture.accounts[0]);
const B = await login(fixture.accounts[1]);
assert.notEqual(A.clinica_id, B.clinica_id);
async function budget(desconto = 0, prices = [400]) {
  const [o] = ok(await request(A, 'orcamentos', 'POST', { clinica_id: A.clinica_id,
    paciente_id: A.paciente_id, dentista_id: A.dentista_id, total: prices.reduce((s, p) => s + p, 0) - desconto,
    desconto, status: 'rascunho' }));
  const itens = ok(await request(A, 'orcamento_itens', 'POST', prices.map(preco => ({
    clinica_id: A.clinica_id, orcamento_id: o.id, descricao: 'QA R166 desconto sintético',
    quantidade: 1, preco_unitario: preco, preco_total: preco, aprovado: true,
  }))));
  return { ...o, itens };
}
async function rpc(name, body, account = A) { return request(account, `rpc/${name}`, 'POST', body); }
async function state(o, due, paid, estado) {
  const [s] = ok(await request(A, `orcamentos_com_estado?id=eq.${o.id}&clinica_id=eq.${A.clinica_id}&select=id,valor_devido,valor_pago,estado`));
  assert.deepEqual([s.valor_devido, s.valor_pago, s.estado], [due, paid, estado]);
  results.push({ id: o.id, due, paid, estado });
}
const received = (id, valor) => rpc('registrar_recebimento_orcamento', {
  p_orcamento_id: id, p_valor: valor, p_forma: 'pix', p_data: '2026-09-11',
});
const global = await budget(40);
await state(global, 360, 0, 'aceito');
const blockedStage = await rpc('criar_cobranca_orcamento', { p_orcamento_id: global.id,
  p_item_ids: global.itens.map(i => i.id), p_desconto: 0 });
assert.ok(blockedStage.status >= 400);
assert.match(blockedStage.data.message, /orcamento_acordo_global/);

const payment = ok(await received(global.id, 360));
await state(global, 360, 360, 'quitado');
assert.ok((await received(global.id, 0.01)).status >= 400);
ok(await rpc('corrigir_recebimento_orcamento', { p_pagamento_id: payment.id, p_valor: 300, p_forma: 'pix', p_data: '2026-09-11' }));
await state(global, 360, 300, 'aceito');
assert.ok((await rpc('corrigir_recebimento_orcamento', { p_pagamento_id: payment.id, p_valor: 400, p_forma: 'pix', p_data: '2026-09-11' })).status >= 400);
ok(await received(global.id, 60));
await state(global, 360, 360, 'quitado');
const partial = await budget();
ok(await received(partial.id, 360));
await state(partial, 400, 360, 'aceito');
const stage = await budget();
const charge = ok(await rpc('criar_cobranca_orcamento', { p_orcamento_id: stage.id,
  p_item_ids: stage.itens.map(i => i.id), p_desconto: 40, p_numero_parcelas: 1, p_primeiro_vencimento: '2026-09-11' }));
await state(stage, 360, 0, 'aceito');
ok(await rpc('registrar_recebimento_cobranca', { p_cobranca_id: charge.id,
  p_valor: 360, p_forma: 'pix', p_data: '2026-09-11' }));
await state(stage, 360, 360, 'quitado');
const multi = await budget(0, [200, 200]);
const charges = [];
for (const item of multi.itens) charges.push(ok(await rpc('criar_cobranca_orcamento', {
  p_orcamento_id: multi.id, p_item_ids: [item.id], p_desconto: 20,
  p_numero_parcelas: 1, p_primeiro_vencimento: '2026-09-11',
})));
await state(multi, 360, 0, 'aceito');
ok(await rpc('cancelar_cobranca_orcamento', { p_cobranca_id: charges[0].id, p_motivo: 'QA R166 cancelamento sintético' }));
await state(multi, 380, 0, 'aceito');
// Simula proposta global alterada depois de uma obrigação histórica já registrada.
const historical = await budget();
const historicalCharge = ok(await rpc('criar_cobranca_orcamento', { p_orcamento_id: historical.id,
  p_item_ids: historical.itens.map(i => i.id), p_desconto: 40 }));
ok(await request(A, `orcamentos?id=eq.${historical.id}&clinica_id=eq.${A.clinica_id}`, 'PATCH', { desconto: 100, total: 300 }));
await state(historical, 360, 0, 'aceito');
ok(await rpc('cancelar_cobranca_orcamento', { p_cobranca_id: historicalCharge.id, p_motivo: 'QA R166 volta ao global' }));
await state(historical, 300, 0, 'aceito');
const agreed = await budget(40);
ok(await rpc('definir_plano_avista', { p_orcamento_id: agreed.id, p_valor_acordado: 360 }));
const [forecast] = ok(await request(A, `pagamentos?orcamento_id=eq.${agreed.id}&clinica_id=eq.${A.clinica_id}&status=eq.pendente&select=id`));
ok(await rpc('confirmar_previsao_orcamento', { p_pagamento_id: forecast.id, p_forma: 'pix', p_data: '2026-09-11' }));
await state(agreed, 360, 360, 'quitado');
// Relação embutida usada por actions, PDF e export de prontuário.
const [embedded] = ok(await request(A, `orcamentos?id=eq.${stage.id}&clinica_id=eq.${A.clinica_id}&select=id,desconto,cobrancas:orcamento_cobrancas(desconto,situacao)`));
assert.equal(embedded.cobrancas[0].desconto, 40);
const finance = ok(await request(A, `orcamentos_com_estado?clinica_id=eq.${A.clinica_id}&paciente_id=eq.${A.paciente_id}&estado=eq.aceito&select=id,valor_devido,valor_pago,itens:orcamento_itens(descricao)`));
assert.ok(finance.some(o => o.id === partial.id && o.valor_devido - o.valor_pago === 40));
assert.ok(!finance.some(o => o.id === stage.id || o.id === global.id));
// A view deve continuar respeitando RLS mesmo com os novos joins.
assert.deepEqual(ok(await request(B, `orcamentos_com_estado?id=eq.${stage.id}&clinica_id=eq.${B.clinica_id}&select=id`)), []);
assert.deepEqual(ok(await request(B, `orcamentos_com_estado?id=eq.${stage.id}&clinica_id=eq.${A.clinica_id}&select=id`)), []);
assert.ok((await rpc('registrar_recebimento_orcamento', { p_orcamento_id: stage.id,
  p_valor: 1, p_forma: 'pix', p_data: '2026-09-11' }, B)).status >= 400);
const signatureId = ok(await rpc('aceitar_orcamento', { p_orcamento_id: global.id,
  p_assinado_por: 'QA R166 — aceite sintético sem validade clínica', p_assinatura_ref: 'qa-r166-sintetico' }));
const [signature] = ok(await request(A, `assinaturas?id=eq.${signatureId}&clinica_id=eq.${A.clinica_id}&select=termos_snapshot`));
assert.equal(signature.termos_snapshot.total, 360);
const report = { project: config.project_ref, checkedAt: new Date().toISOString(), results,
  checks: ['excesso rejeitado', 'correção de recebido', 'pagamento parcial', 'desconto por etapa',
    'cancelamento da etapa', 'acordo não duplica desconto', 'confirmação de previsão', 'novo aceite', 'guarda de acordo global', 'precedência histórica', 'financeiro', 'embed', 'isolamento A/B'],
  patientId: A.paciente_id, stageId: stage.id, globalId: global.id };
fs.writeFileSync(path.join(fixtureDir, 'r166-qa-report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ passed: true, states: results.length, checks: report.checks }));
