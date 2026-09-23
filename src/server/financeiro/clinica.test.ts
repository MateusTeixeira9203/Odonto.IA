import assert from 'node:assert/strict';
import test from 'node:test';

import { getClinicFinancial, type ClinicFinancialDependencies } from './clinica';

const clinicId = '33333333-3333-4333-8333-333333333333';
const dentistId = '44444444-4444-4444-8444-444444444444';

function dependencies(payload: unknown): ClinicFinancialDependencies {
  return {
    get: async () => ({ data: payload, error: null }),
  };
}

function data() {
  return {
    clinicaId: clinicId,
    mes: '2026-09',
    recebido: 48240,
    despesas: 14620,
    resultadoOperacional: 33620,
    margemOperacional: 69.7,
    saldoCaixa: 41800,
    aReceber: 17980,
    vencido: 4820,
    despesasFixas: 7200,
    despesasFixasPrevistas: 7200,
    folegoCaixaMeses: 5.8,
    temBaseDeCustos: true,
    podeGerirCustos: true,
    recorrencias: [{
      id: '55555555-5555-4555-8555-555555555555',
      descricao: 'Aluguel',
      categoria: 'Infraestrutura',
      valor: 7200,
      diaVencimento: 5,
      ativo: true,
    }],
    chart: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((mes) => ({
      mesISO: mes,
      mes: 'Set',
      recebido: 1,
      despesas: 1,
    })),
    profissionais: [{
      dentistaId: dentistId,
      nome: 'Dra. Marina',
      producaoAprovada: 100,
      recebidoVinculado: 80,
      aReceber: 20,
    }],
    extrato: [{
      id: '66666666-6666-4666-8666-666666666666',
      tipo: 'recebimento',
      descricao: 'Paciente',
      data: '2026-09-20',
      valor: 100,
    }],
  };
}

test('preserva leitura agregada tipada da clínica', async () => {
  const result = await getClinicFinancial(
    { clinicaIdEsperada: clinicId, mes: '2026-09' },
    dependencies({ ok: true, data: data() }),
  );

  assert.deepEqual(result, { ok: true, data: data() });
});

test('não chama RPC com mês ou clínica inválidos', async () => {
  let called = false;
  const result = await getClinicFinancial(
    { clinicaIdEsperada: 'invalido', mes: '2026-13' },
    { get: async () => { called = true; return { data: null, error: null }; } },
  );

  assert.equal(called, false);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.codigo, 'CONTEXTO_ALTERADO');
});

test('não transforma falha da RPC em saldo zero', async () => {
  const result = await getClinicFinancial(
    { clinicaIdEsperada: clinicId, mes: '2026-09' },
    { get: async () => ({ data: null, error: { message: 'falha' } }) },
  );

  assert.deepEqual(result, {
    ok: false,
    codigo: 'INDISPONIVEL',
    mensagem: 'Não foi possível consultar o financeiro da clínica agora.',
  });
});
