import assert from 'node:assert/strict';
import test from 'node:test';
import { operarRecebimento, type RecebimentoDependencies } from './recebimentos';

const id = '11111111-1111-4111-8111-111111111111';
const input = { clinicaIdEsperada: id, chaveIdempotencia: id, acao: 'registrar', payload: {
  orcamentoId: id, valorCentavos: 12550, formaPagamento: 'pix', data: '2026-09-15',
} };
const success = { ok: true, data: { pagamentoId: id, orcamentoId: id, pacienteId: id,
  titular: 'clinica', valorCentavos: 12550, status: 'pago', atualizadoEm: '2026-09-15T15:00:00.123456+00:00' } };

test('valida e envia centavos sem atribuir titular ou operador pelo cliente', async () => {
  const deps: RecebimentoDependencies = { operate: async (args) => {
    assert.equal(args.p_clinica_id_esperada, id);
    assert.deepEqual(args.p_payload, input.payload);
    return { data: success, error: null };
  } };
  assert.deepEqual(await operarRecebimento(input, deps), success);
});

test('nega campos forjados, data impossível, fração e orçamento/cobrança ambíguos antes da RPC', async () => {
  let calls = 0;
  const deps: RecebimentoDependencies = { operate: async () => { calls++; return { data: success, error: null }; } };
  for (const payload of [
    { ...input.payload, titular: 'clinica' }, { ...input.payload, atorId: id },
    { ...input.payload, valorCentavos: 12.5 }, { ...input.payload, data: '2026-02-30' },
    { ...input.payload, cobrancaId: id }, { ...input.payload, valorCentavos: 0 },
  ]) assert.equal((await operarRecebimento({ ...input, payload }, deps)).ok, false);
  assert.equal(calls, 0);
});

test('exige etag em confirmação/correção/estorno e motivo de estorno', async () => {
  const deps: RecebimentoDependencies = { operate: async () => { assert.fail('não deve chamar'); } };
  for (const acao of ['confirmar', 'corrigir', 'estornar']) {
    assert.equal((await operarRecebimento({ ...input, acao, payload: { pagamentoId: id } }, deps)).ok, false);
  }
});

test('não expõe mensagens SQL, rejeita resposta inesperada e trata falha de rede', async () => {
  for (const deps of [
    { operate: async () => ({ data: null, error: { message: 'password private SQL' } }) },
    { operate: async () => ({ data: { ok: true, data: { ...success.data, prontuario: 'secret' } }, error: null }) },
    { operate: async () => { throw new Error('private'); } },
  ]) {
    const result = await operarRecebimento(input, deps);
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /password|private|secret/);
  }
});

test('preserva conflito do servidor com mensagem local segura', async () => {
  const result = await operarRecebimento(input, { operate: async () => ({
    data: { ok: false, codigo: 'CONFLITO', mensagem: 'SQL interno' }, error: null,
  }) });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.codigo, 'CONFLITO');
  assert.doesNotMatch(JSON.stringify(result), /SQL/);
});
