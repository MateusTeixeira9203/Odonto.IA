import assert from 'node:assert/strict';
import test from 'node:test';

import { getClinicFinancialActions, type ClinicFinancialActionsDependencies } from './acoes-clinica';

const clinicId = '33333333-3333-4333-8333-333333333333';

function dependencies(payload: unknown): ClinicFinancialActionsDependencies {
  return { get: async () => ({ data: payload, error: null }) };
}

test('expõe somente as permissões financeiras já calculadas no banco', async () => {
  const result = await getClinicFinancialActions(
    clinicId,
    dependencies({ ok: true, data: { podeRegistrarEntrada: true, podeRegistrarCusto: false } }),
  );

  assert.deepEqual(result, { ok: true, data: { podeRegistrarEntrada: true, podeRegistrarCusto: false } });
});

test('não consulta a RPC quando a clínica não é válida', async () => {
  let called = false;
  const result = await getClinicFinancialActions('invalida', {
    get: async () => {
      called = true;
      return { data: null, error: null };
    },
  });

  assert.equal(called, false);
  assert.deepEqual(result, { ok: false, codigo: 'CONTEXTO_ALTERADO', mensagem: 'A clínica ativa não é válida.' });
});

test('recusa um payload de autorização incompleto', async () => {
  const result = await getClinicFinancialActions(
    clinicId,
    dependencies({ ok: true, data: { podeRegistrarEntrada: true } }),
  );

  assert.deepEqual(result, { ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível consultar as permissões financeiras.' });
});
