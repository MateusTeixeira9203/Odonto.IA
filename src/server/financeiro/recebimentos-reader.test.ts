import assert from 'node:assert/strict';
import test from 'node:test';
import { listarRecebimentosOperacionais } from './recebimentos-reader';

const id = '11111111-1111-4111-8111-111111111111';
const page = {
  itens: [{
    orcamentoId: id, pacienteId: id, dentistaId: id, pacienteNome: 'Paciente', dentistaNome: 'Dra', titular: 'clinica',
    devidoCentavos: 10_000, pagoCentavos: 0, saldoCentavos: 10_000,
    capacidades: { podeRegistrar: true, podeConfirmar: true, podeCorrigir: false, podeEstornar: false },
    pagamentos: [],
  }],
  proximoOffset: null,
};

test('preserva uma página válida com as capacidades calculadas no banco', async () => {
  const result = await listarRecebimentosOperacionais({ clinicaIdEsperada: id }, {
    list: async (input) => {
      assert.deepEqual(input, { p_clinica_id_esperada: id, p_limite: 25, p_offset: 0 });
      return { data: page, error: null };
    },
  });
  assert.deepEqual(result, { ok: true, data: page });
});

test('não converte erro de RPC ou DTO inválido em lista vazia', async () => {
  for (const response of [
    { data: null, error: { message: 'private SQL' } },
    { data: { ...page, itens: [{ ...page.itens[0], devidoCentavos: null }] }, error: null },
  ]) {
    const result = await listarRecebimentosOperacionais({ clinicaIdEsperada: id }, { list: async () => response });
    assert.deepEqual(result, { ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível carregar os recebimentos. Tente novamente.' });
  }
});
