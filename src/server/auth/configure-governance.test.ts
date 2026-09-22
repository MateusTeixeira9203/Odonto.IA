import assert from 'node:assert/strict';
import test from 'node:test';

import { configureInitialGovernance } from './configure-governance.ts';

const clinicId = 'a1111111-1111-4111-8111-111111111111';
const memberId = 'b2222222-2222-4222-8222-222222222222';
const key = 'c3333333-3333-4333-8333-333333333333';

test('envia somente os parâmetros canônicos para a RPC inicial', async () => {
  let received: unknown;
  const result = await configureInitialGovernance({
    clinicaIdEsperada: clinicId.toUpperCase(),
    modalidade: 'gerida',
    proprietarioMembroId: memberId.toUpperCase(),
    versaoEsperada: 0,
    chaveIdempotencia: key.toUpperCase(),
  }, {
    configure: async (input) => {
      received = input;
      return {
        data: {
          ok: true,
          data: {
            clinicaId: clinicId,
            modalidade: 'gerida',
            versao: 1,
            proprietarioMembroId: memberId,
          },
        },
        error: null,
      };
    },
  });

  assert.deepEqual(received, {
    p_clinica_id: clinicId,
    p_modalidade: 'gerida',
    p_proprietario_membro_id: memberId,
    p_versao_esperada: 0,
    p_chave_idempotencia: key,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('rejeita versão diferente de zero antes da RPC', async () => {
  let called = false;
  const result = await configureInitialGovernance({
    clinicaIdEsperada: clinicId,
    modalidade: 'gerida',
    proprietarioMembroId: memberId,
    versaoEsperada: 1,
    chaveIdempotencia: key,
  }, {
    configure: async () => {
      called = true;
      throw new Error('não deveria chamar');
    },
  });

  assert.equal(called, false);
  assert.deepEqual(result, {
    ok: false,
    codigo: 'INVALIDO',
    mensagem: 'Revise os dados da modalidade antes de continuar.',
  });
});

test('clínica colaborativa não envia proprietário', async () => {
  let received: unknown;
  const result = await configureInitialGovernance({
    clinicaIdEsperada: clinicId,
    modalidade: 'colaborativa',
    proprietarioMembroId: null,
    versaoEsperada: 0,
    chaveIdempotencia: key,
  }, {
    configure: async (input) => {
      received = input;
      return {
        data: {
          ok: true,
          data: { clinicaId: clinicId, modalidade: 'colaborativa', versao: 1, proprietarioMembroId: null },
        },
        error: null,
      };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(received, {
    p_clinica_id: clinicId,
    p_modalidade: 'colaborativa',
    p_proprietario_membro_id: null,
    p_versao_esperada: 0,
    p_chave_idempotencia: key,
  });
});

test('rejeita proprietário em colaborativa antes da RPC', async () => {
  const result = await configureInitialGovernance({
    clinicaIdEsperada: clinicId,
    modalidade: 'colaborativa',
    proprietarioMembroId: memberId,
    versaoEsperada: 0,
    chaveIdempotencia: key,
  });

  assert.deepEqual(result, {
    ok: false,
    codigo: 'INVALIDO',
    mensagem: 'Revise os dados da modalidade antes de continuar.',
  });
});

test('não confia em resposta RPC incompleta', async () => {
  const result = await configureInitialGovernance({
    clinicaIdEsperada: clinicId,
    modalidade: 'gerida',
    proprietarioMembroId: memberId,
    versaoEsperada: 0,
    chaveIdempotencia: key,
  }, {
    configure: async () => ({ data: { ok: true, data: { clinicaId: clinicId } }, error: null }),
  });

  assert.deepEqual(result, {
    ok: false,
    codigo: 'INDISPONIVEL',
    mensagem: 'Não foi possível configurar a clínica agora.',
  });
});
