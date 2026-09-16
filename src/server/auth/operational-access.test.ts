import assert from 'node:assert/strict';
import test from 'node:test';
import { hasOperationalPermission, hasRecebimentosOperationalAccess } from './operational-access.ts';

const clinicaId = '11111111-1111-4111-8111-111111111111';
const dentistaId = '22222222-2222-4222-8222-222222222222';

test('consulta somente a whitelist operacional com escopo de unidade ou profissional', async () => {
  const calls: unknown[] = [];
  const granted = await hasOperationalPermission({
    clinicaIdEsperada: clinicaId,
    permissao: 'agenda.editar',
    dentistaId,
  }, {
    async check(input) {
      calls.push(input);
      return { data: true, error: null };
    },
  });
  assert.equal(granted, true);
  assert.deepEqual(calls, [{
    p_clinica_id: clinicaId,
    p_permissao: 'agenda.editar',
    p_dentista_id: dentistaId,
  }]);
});

test('nega permissões fora do contrato e falhas do banco', async () => {
  let called = false;
  assert.equal(await hasOperationalPermission({
    clinicaIdEsperada: clinicaId,
    permissao: 'clinico.ler',
    dentistaId,
  }, {
    async check() { called = true; return { data: true, error: null }; },
  }), false);
  assert.equal(called, false);

  assert.equal(await hasOperationalPermission({
    clinicaIdEsperada: clinicaId,
    permissao: 'financeiro.ler',
    dentistaId: null,
  }, {
    async check() { return { data: null, error: { message: 'timeout' } }; },
  }), false);
});

test('a navegação de recebimentos exige a leitura de cobranças, não financeiro genérico', async () => {
  const chamadas: string[] = [];
  const permitido = await hasRecebimentosOperationalAccess(clinicaId, {
    async check(input) {
      chamadas.push(input.p_permissao);
      return { data: input.p_permissao === 'cobrancas.ler', error: null };
    },
  });
  assert.equal(permitido, true);
  assert.deepEqual(chamadas, ['cobrancas.ler']);
});
