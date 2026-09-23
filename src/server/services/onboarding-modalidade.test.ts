import assert from 'node:assert/strict';
import test from 'node:test';

import { completeOnboardingModalidade } from './onboarding-modalidade';

const key = '4b84942d-d619-40f7-a123-1d883824d70b';
const clinicId = 'a9b9f0d6-9758-4a46-b3f0-56d5b7695550';
const memberId = 'b9b9f0d6-9758-4a46-b3f0-56d5b7695550';
const dentistId = 'c9b9f0d6-9758-4a46-b3f0-56d5b7695550';

function input(overrides: Record<string, unknown> = {}) {
  return {
    nomeClinica: 'Clínica Aurora',
    modalidade: 'gerida' as const,
    criadorAtende: false,
    nomeUsuario: 'Ana Souza',
    cro: null,
    especialidade: [],
    email: 'ana@aurora.test',
    foco: null,
    chaveIdempotencia: key,
    quantidadeDentistasPrevista: 0,
    ...overrides,
  };
}

test('aceita proprietário não clínico em clínica gerida', async () => {
  let request: unknown;
  const result = await completeOnboardingModalidade(input(), {
    complete: async (value) => {
      request = value;
      return {
        data: { ok: true, data: { clinicaId: clinicId, membroId: memberId, modalidade: 'gerida', criadorAtende: false, dentistaId: null, quantidadeDentistasPrevista: 0 } },
        error: null,
      };
    },
  });

  assert.deepEqual(request, {
    p_nome_clinica: 'Clínica Aurora', p_modalidade: 'gerida', p_criador_atende: false,
    p_nome_usuario: 'Ana Souza', p_cro: null, p_especialidade: [], p_email: 'ana@aurora.test',
    p_foco_principal: null, p_chave_idempotencia: key, p_quantidade_dentistas_prevista: 0,
  });
  assert.deepEqual(result, { ok: true, data: { clinicaId: clinicId, membroId: memberId, modalidade: 'gerida', criadorAtende: false, dentistaId: null, quantidadeDentistasPrevista: 0 } });
});

test('exige perfil clínico no cadastro colaborativo', async () => {
  const result = await completeOnboardingModalidade(input({ modalidade: 'colaborativa', criadorAtende: false }), {
    complete: async () => { throw new Error('não deve chamar RPC'); },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.codigo, 'INVALIDO');
});

test('exige CRO e especialidade para criador que atende', async () => {
  const result = await completeOnboardingModalidade(input({ criadorAtende: true }), {
    complete: async () => { throw new Error('não deve chamar RPC'); },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.codigo, 'INVALIDO');
});

test('aceita criador clínico e conserva resposta estruturada', async () => {
  const result = await completeOnboardingModalidade(input({
    criadorAtende: true, cro: 'CRO-SP 12345', especialidade: ['Clínico Geral'], foco: 'economizar_tempo', quantidadeDentistasPrevista: 1,
  }), {
    complete: async () => ({
      data: { ok: true, data: { clinicaId: clinicId, membroId: memberId, modalidade: 'gerida', criadorAtende: true, dentistaId: dentistId, quantidadeDentistasPrevista: 1 } },
      error: null,
    }),
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.dentistaId, dentistId);
});
