import assert from 'node:assert/strict';
import test from 'node:test';

import {
  iniciarOnboardingComercial,
  type CommercialOnboardingDependencies,
} from './commercial-onboarding';

const id = '11111111-1111-4111-8111-111111111111';
const clinicalInput = {
  modalidade: 'individual' as const,
  modeloClinica: 'colaborativa' as const,
  atuaClinicamente: true,
  nomeClinica: 'Clínica Teste',
  nomeUsuario: 'Dra Teste',
  cro: 'CRO-123',
  especialidades: ['Clínica geral'],
};
const success = {
  ok: true as const,
  data: { clinicaId: id, membroId: id, dentistaId: id, assinaturaId: id, modalidade: 'individual' as const, checkoutPendente: true as const },
};

test('registra somente planejamento e dados permitidos para checkout posterior', async () => {
  const deps: CommercialOnboardingDependencies = { start: async (input) => {
    assert.deepEqual(input, {
      p_modalidade: 'individual', p_modelo_clinica: 'colaborativa', p_atua_clinicamente: true,
      p_nome_clinica: 'Clínica Teste', p_nome_usuario: 'Dra Teste', p_cro: 'CRO-123',
      p_especialidades: ['Clínica geral'], p_telefone: null, p_cidade: null, p_estado: null, p_foco_principal: null,
    });
    return { data: success, error: null };
  } };
  assert.deepEqual(await iniciarOnboardingComercial(clinicalInput, deps), success);
});

test('bloqueia configuração comercial forjada e dados clínicos ausentes antes da RPC', async () => {
  let calls = 0;
  const deps: CommercialOnboardingDependencies = { start: async () => { calls += 1; return { data: success, error: null }; } };
  for (const input of [
    { ...clinicalInput, atuaClinicamente: false, modeloClinica: 'colaborativa' },
    { ...clinicalInput, cro: null },
    { ...clinicalInput, pagadorUsuarioId: id },
  ]) {
    assert.deepEqual(await iniciarOnboardingComercial(input, deps), { ok: false, codigo: 'INVALIDO' });
  }
  assert.equal(calls, 0);
});

test('aceita owner não clínico em clínica gerida com cobrança individual, mas rejeita resposta malformada', async () => {
  const central = { ...clinicalInput, modalidade: 'individual' as const, modeloClinica: 'gerida' as const, atuaClinicamente: false, cro: null, especialidades: [] };
  const deps: CommercialOnboardingDependencies = { start: async () => ({ data: { ok: true, data: { clinicaId: id } }, error: null }) };
  assert.deepEqual(await iniciarOnboardingComercial(central, deps), { ok: false, codigo: 'INDISPONIVEL' });
});

test('mapeia cadastro anterior sem devolver mensagem SQL', async () => {
  const result = await iniciarOnboardingComercial(clinicalInput, {
    start: async () => ({ data: null, error: { message: 'ALREADY_ONBOARDED: SQL interno' } }),
  });
  assert.deepEqual(result, { ok: false, codigo: 'JA_CADASTRADO' });
});
