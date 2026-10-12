/** QA limitada à clínica sintética B no Supabase publicado. Sem carga/falha injetada. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const projectRef = 'zenfemoxvwerplrjgfqz';
const clinicId = '53eefdac-401b-484c-8ad4-a6cdd78b1a69';
if (process.env.RUN_ODONTO_FINANCE_QA !== '1') throw new Error('QA live requires RUN_ODONTO_FINANCE_QA=1');
process.loadEnvFile('.env.local');
const qa = JSON.parse(readFileSync(process.env.ODONTO_QA_ACCOUNTS, 'utf8'));
const patientId = process.env.ODONTO_QA_PATIENT_ID;
assert.equal(qa.projectRef, projectRef);
assert.equal(qa.clinicaId, clinicId);
assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL, new RegExp(projectRef));
assert.match(patientId, /^[0-9a-f-]{36}$/i);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const patient = await admin.from('pacientes').select('id').eq('id', patientId)
  .eq('clinica_id', clinicId).ilike('nome', 'QA %').single();
if (patient.error || patient.data?.id !== patientId) throw new Error('Patient is not a QA record in the expected clinic');

async function login(role) {
  const account = qa.accounts.find(a => a.role === role);
  assert(account && account.clinicaId === clinicId);
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error || data.user?.id !== account.userId) throw new Error(`${role}: QA login failed`);
  return { client, account };
}
const dentist = await login('dentista');
const secretary = await login('secretaria');
const prosthetic = await login('protetico');
const ids = {};
async function selectOne(table, fields, filters) {
  let query = admin.from(table).select(fields);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { data, error } = await query.single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}
async function count(table, filters) {
  let query = admin.from(table).select('id', { count: 'exact', head: true });
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { count: n, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return n;
}
async function insert(table, value) {
  const { error } = await admin.from(table).insert(value);
  if (error) throw new Error(`${table}: ${error.message}`);
}
async function budget(label, total, approved, discount = 0) {
  const id = randomUUID();
  ids[label] = id;
  await insert('orcamentos', {
    id, clinica_id: clinicId, paciente_id: patientId,
    dentista_id: dentist.account.profileId, status: 'aprovado', total, desconto: discount,
  });
  await insert('orcamento_itens', [
    { clinica_id: clinicId, orcamento_id: id, descricao: `QA FIN ${label} aprovado`,
      quantidade: 1, preco_unitario: approved, preco_total: approved, aprovado: true },
    ...(total > approved ? [{ clinica_id: clinicId, orcamento_id: id,
      descricao: `QA FIN ${label} nao aprovado`, quantidade: 1,
      preco_unitario: total - approved, preco_total: total - approved, aprovado: false }] : []),
  ]);
  return id;
}
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}
async function rejected(client, name, args, expected) {
  const { error } = await client.rpc(name, args);
  assert(error?.message.includes(expected), `${name}: expected ${expected}, got ${error?.message ?? 'success'}`);
}
const paymentRows = async budgetId => {
  const { data, error } = await admin.from('pagamentos').select('id,valor,status,parcela_numero,operacao_id')
    .eq('clinica_id', clinicId).eq('orcamento_id', budgetId).order('created_at');
  if (error) throw new Error(`pagamentos: ${error.message}`);
  return data;
};

const partial = await budget('R184', 300, 100, 30);
await insert('pagamentos', { clinica_id: clinicId, orcamento_id: partial, paciente_id: patientId,
  dentista_id: dentist.account.profileId, valor: 20, status: 'pago',
  forma_pagamento: 'pix', data_pagamento: '2026-10-12', marcado_por_id: dentist.account.profileId });
const installments = await rpc(dentist.client, 'gerar_parcelas_orcamento', {
  p_orcamento_id: partial, p_numero_parcelas: 2, p_primeiro_vencimento: '2026-11-01',
});
assert.deepEqual(installments.map(p => Number(p.valor)).sort(), [25, 25]);
assert.equal(Number((await selectOne('orcamentos', 'valor_acordado', { id: partial, clinica_id: clinicId })).valor_acordado), 70);
await rejected(prosthetic.client, 'gerar_parcelas_orcamento', {
  p_orcamento_id: partial, p_numero_parcelas: 2, p_primeiro_vencimento: '2026-11-01',
}, 'sem_permissao');
assert.equal((await paymentRows(partial)).length, 3);
console.log('PASS R184 calculo parcial, reload e negativa autenticada');

const manual = await budget('R189', 300, 300);
const manualArgs = { p_operacao_id: randomUUID(), p_orcamento_id: manual,
  p_valor: 100, p_forma: 'pix', p_data: '2026-10-12' };
const firstManual = (await rpc(dentist.client, 'registrar_recebimento_orcamento_idempotente', manualArgs))[0];
const repeatedManual = (await rpc(dentist.client, 'registrar_recebimento_orcamento_idempotente', manualArgs))[0];
assert.equal(firstManual.pagamento_id, repeatedManual.pagamento_id);
assert.equal(repeatedManual.repetida, true);
await rejected(secretary.client, 'registrar_recebimento_orcamento_idempotente', manualArgs, 'chave_idempotencia_reutilizada');
await rejected(dentist.client, 'registrar_recebimento_orcamento_idempotente',
  { ...manualArgs, p_valor: 120 }, 'chave_idempotencia_reutilizada');
const secondManual = (await rpc(dentist.client, 'registrar_recebimento_orcamento_idempotente',
  { ...manualArgs, p_operacao_id: randomUUID() }))[0];
assert.notEqual(firstManual.pagamento_id, secondManual.pagamento_id);
assert.equal((await paymentRows(manual)).length, 2);
assert.equal(await count('activity_logs', { clinica_id: clinicId, entity_id: manual, action: 'pagamento.registrado' }), 2);
console.log('PASS R189 retry, conflito entre usuarios e segunda intencao');

const predicted = await budget('R194_PREVISAO', 200, 200);
for (const [number, due] of [[1, '2026-11-01'], [2, '2026-12-01']]) {
  await insert('pagamentos', { clinica_id: clinicId, orcamento_id: predicted,
    paciente_id: patientId, dentista_id: dentist.account.profileId, valor: 100,
    status: 'pendente', parcela_numero: number, total_parcelas: 2, data_vencimento: due });
}
const quickArgs = { p_operacao_id: randomUUID(), p_orcamento_id: predicted,
  p_forma: 'pix', p_data: '2026-10-12' };
const firstQuick = (await rpc(dentist.client, 'registrar_pagamento_rapido_idempotente', quickArgs))[0];
const repeatedQuick = (await rpc(dentist.client, 'registrar_pagamento_rapido_idempotente', quickArgs))[0];
assert.equal(firstQuick.pagamento_id, repeatedQuick.pagamento_id);
assert.equal(repeatedQuick.repetida, true);
assert.deepEqual((await paymentRows(predicted)).map(p => p.status).sort(), ['pago', 'pendente']);
assert.equal(await count('activity_logs', { clinica_id: clinicId, entity_id: predicted, action: 'pagamento.registrado' }), 1);
console.log('PASS R194 parcela vencedora e retry sem segundo efeito');

const balance = await budget('R194_SALDO', 100, 100);
const notificationFilter = { clinica_id: clinicId, tipo: 'pagamento_confirmado',
  para_dentista_id: dentist.account.profileId };
const notificationsBefore = await count('notificacoes', notificationFilter);
const balanceArgs = { p_operacao_id: randomUUID(), p_orcamento_id: balance,
  p_forma: 'pix', p_data: '2026-10-12' };
const firstBalance = (await rpc(secretary.client, 'registrar_pagamento_rapido_idempotente', balanceArgs))[0];
const repeatedBalance = (await rpc(secretary.client, 'registrar_pagamento_rapido_idempotente', balanceArgs))[0];
assert.equal(firstBalance.pagamento_id, repeatedBalance.pagamento_id);
assert.equal(repeatedBalance.repetida, true);
assert.equal((await paymentRows(balance)).length, 1);
assert.equal(await count('activity_logs', { clinica_id: clinicId, entity_id: balance, action: 'pagamento.registrado' }), 1);
assert.equal(await count('notificacoes', notificationFilter), notificationsBefore + 1);
console.log('PASS R194 saldo da secretaria, log e notificacao unica');
console.log(JSON.stringify({ projectRef, clinicId, qaBudgetIds: ids, checks: 4 }));
