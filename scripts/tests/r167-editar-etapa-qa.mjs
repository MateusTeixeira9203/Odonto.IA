// Executar: node scripts/tests/r167-editar-etapa-qa.mjs /diretorio/privado/das/fixtures
// Somente Supabase Free com contas sintéticas; nunca apontar este script à produção.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const fixtureDir = process.argv[2];
assert.ok(fixtureDir, 'Informe o diretório privado das fixtures sintéticas.');
const config = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'connection.json'), 'utf8'));
const fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'fixture.json'), 'utf8'));
assert.equal(config.project_ref, 'etlqznuoxiilvxzygpat');
assert.equal(fixture.project_ref, config.project_ref);

async function login(account) {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.anon_key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  assert.equal(response.status, 200);
  return { ...account, token: (await response.json()).access_token };
}

async function request(account, route, method = 'GET', body) {
  const response = await fetch(`${config.url}/rest/v1/${route}`, {
    method,
    headers: {
      apikey: config.anon_key,
      Authorization: `Bearer ${account.token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

function ok(result) {
  assert.ok(result.status < 300, `HTTP ${result.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

const A = await login(fixture.accounts[0]);
const B = await login(fixture.accounts[1]);

async function budget(prices) {
  const [orcamento] = ok(await request(A, 'orcamentos', 'POST', {
    clinica_id: A.clinica_id,
    paciente_id: A.paciente_id,
    dentista_id: A.dentista_id,
    total: prices.reduce((sum, price) => sum + price, 0),
    status: 'rascunho',
  }));
  const itens = ok(await request(A, 'orcamento_itens', 'POST', prices.map((price, index) => ({
    clinica_id: A.clinica_id,
    orcamento_id: orcamento.id,
    descricao: `QA R167 procedimento ${index + 1}`,
    quantidade: 1,
    preco_unitario: price,
    preco_total: price,
    aprovado: true,
  }))));
  return { ...orcamento, itens };
}

async function rpc(account, name, body) {
  return request(account, `rpc/${name}`, 'POST', body);
}

async function getStage(stageId) {
  const [stage] = ok(await request(A,
    `orcamento_cobrancas?id=eq.${stageId}&clinica_id=eq.${A.clinica_id}&select=subtotal,desconto,valor_final,situacao`,
  ));
  const items = ok(await request(A,
    `orcamento_cobranca_itens?cobranca_id=eq.${stageId}&clinica_id=eq.${A.clinica_id}&ativo=eq.true&select=orcamento_item_id,preco_total_snapshot&order=orcamento_item_id`,
  ));
  const payments = ok(await request(A,
    `pagamentos?cobranca_id=eq.${stageId}&clinica_id=eq.${A.clinica_id}&select=valor,status&order=created_at`,
  ));
  return { stage, items, payments };
}

const editable = await budget([4400, 6000]);
const stage = ok(await rpc(A, 'criar_cobranca_orcamento', {
  p_orcamento_id: editable.id,
  p_item_ids: [editable.itens[0].id],
  p_desconto: 0,
  p_numero_parcelas: 1,
  p_primeiro_vencimento: '2026-09-12',
}));
ok(await rpc(A, 'registrar_recebimento_cobranca', {
  p_cobranca_id: stage.id,
  p_valor: 500,
  p_forma: 'pix',
  p_data: '2026-09-12',
}));

const belowReceived = await rpc(A, 'editar_cobranca_orcamento', {
  p_cobranca_id: stage.id,
  p_item_ids: editable.itens.map((item) => item.id),
  p_valor_final: 400,
});
assert.ok(belowReceived.status >= 400);
assert.match(belowReceived.data.message, /valor_final_abaixo_recebido/);

ok(await rpc(A, 'editar_cobranca_orcamento', {
  p_cobranca_id: stage.id,
  p_item_ids: editable.itens.map((item) => item.id),
  p_valor_final: 1500,
}));
const edited = await getStage(stage.id);
assert.deepEqual(
  [Number(edited.stage.subtotal), Number(edited.stage.desconto), Number(edited.stage.valor_final), edited.items.length],
  [10400, 8900, 1500, 2],
);
assert.equal(
  edited.payments.filter((payment) => payment.status === 'pago').reduce((sum, payment) => sum + Number(payment.valor), 0),
  500,
);
assert.equal(
  edited.payments.filter((payment) => payment.status === 'pendente').reduce((sum, payment) => sum + Number(payment.valor), 0),
  1000,
);

const crossClinic = await rpc(B, 'editar_cobranca_orcamento', {
  p_cobranca_id: stage.id,
  p_item_ids: editable.itens.map((item) => item.id),
  p_valor_final: 1500,
});
assert.ok(crossClinic.status >= 400);
const unchanged = await getStage(stage.id);
assert.equal(Number(unchanged.stage.valor_final), 1500);

ok(await rpc(A, 'editar_cobranca_orcamento', {
  p_cobranca_id: stage.id,
  p_item_ids: [editable.itens[0].id],
  p_valor_final: 500,
}));
const removedItem = await getStage(stage.id);
assert.deepEqual(
  [Number(removedItem.stage.subtotal), Number(removedItem.stage.desconto), Number(removedItem.stage.valor_final), removedItem.items.length],
  [4400, 3900, 500, 1],
);

const cancellable = ok(await rpc(A, 'criar_cobranca_orcamento', {
  p_orcamento_id: editable.id,
  p_item_ids: [editable.itens[1].id],
  p_desconto: 0,
  p_numero_parcelas: 1,
  p_primeiro_vencimento: '2026-09-12',
}));
ok(await rpc(A, 'cancelar_cobranca_orcamento', {
  p_cobranca_id: cancellable.id,
  p_motivo: 'QA R167: cancela antes de testar a imutabilidade.',
}));
const cancelledEdit = await rpc(A, 'editar_cobranca_orcamento', {
  p_cobranca_id: cancellable.id,
  p_item_ids: [editable.itens[1].id],
  p_valor_final: 6000,
});
assert.ok(cancelledEdit.status >= 400);
assert.match(cancelledEdit.data.message, /cobranca_indisponivel/);

const deletable = await budget([400]);
const deleteStage = ok(await rpc(A, 'criar_cobranca_orcamento', {
  p_orcamento_id: deletable.id,
  p_item_ids: [deletable.itens[0].id],
  p_desconto: 40,
  p_numero_parcelas: 1,
  p_primeiro_vencimento: '2026-09-12',
}));
ok(await rpc(A, 'registrar_recebimento_cobranca', {
  p_cobranca_id: deleteStage.id,
  p_valor: 360,
  p_forma: 'pix',
  p_data: '2026-09-12',
}));
const deleted = await request(A, `orcamentos?id=eq.${deletable.id}&clinica_id=eq.${A.clinica_id}`, 'DELETE');
assert.equal(deleted.status, 200);
const remaining = ok(await request(A, `orcamentos?id=eq.${deletable.id}&select=id`));
assert.deepEqual(remaining, []);

console.log(JSON.stringify({ passed: true, checks: [
  'adiciona procedimento à etapa',
  'deriva desconto do valor final',
  'preserva recebido e recompõe saldo',
  'rejeita valor abaixo do recebido',
  'remove procedimento e libera a etapa',
  'mantém etapa cancelada imutável',
  'isola outra clínica',
  'dentista exclui orçamento com etapa paga',
] }));
