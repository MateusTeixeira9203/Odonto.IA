import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cadastrarItem,
  detalharEstoque,
  listarEstoque,
  receberMaterial,
  type EstoqueMutationDependencies,
  type EstoqueQueryDependencies,
} from './operations.ts';

const CLINICA_ID = '11111111-1111-4111-8111-111111111111';
const ITEM_ID = '22222222-2222-4222-8222-222222222222';
const LOTE_ID = '33333333-3333-4333-8333-333333333333';
const MOVIMENTO_ID = '44444444-4444-4444-8444-444444444444';
const MEMBRO_ID = '55555555-5555-4555-8555-555555555555';
const CHAVE_IDEMPOTENCIA = '66666666-6666-4666-8666-666666666666';

const context = { clinicaIdEsperada: CLINICA_ID, chaveIdempotencia: CHAVE_IDEMPOTENCIA };

const item = {
  id: ITEM_ID,
  nome: 'Luva nitrílica',
  unidadeBase: 'unidade',
  titular: { tipo: 'clinica' },
  controlaLote: true,
  minimo: '10',
  saldo: '-2',
  ativo: true,
  versao: 2,
  validadeProxima: '2027-12-31',
};

test('cadastrar encaminha somente entrada camelCase normalizada para operar_estoque', async () => {
  const result = await cadastrarItem({
    ...context,
    clinicaIdEsperada: CLINICA_ID.toUpperCase(),
    chaveIdempotencia: CHAVE_IDEMPOTENCIA.toUpperCase(),
    titular: { tipo: 'clinica' },
    nome: '  Luva nitrílica  ',
    unidadeBase: 'unidade',
    comportamento: 'consumivel',
    controlaLote: true,
    minimo: '10',
  }, {
    async operate(payload) {
      assert.deepEqual(payload, {
        p_acao: 'cadastrar',
        p_entrada: {
          ...context,
          titular: { tipo: 'clinica' },
          nome: 'Luva nitrílica',
          unidadeBase: 'unidade',
          comportamento: 'consumivel',
          controlaLote: true,
          minimo: '10',
        },
      });
      return { data: { ok: true, data: { itemId: ITEM_ID, versao: 1 } }, error: null };
    },
  });

  assert.deepEqual(result, { ok: true, data: { itemId: ITEM_ID, versao: 1 } });
});

test('entrada inválida ou vencida sem confirmação não chama a RPC', async () => {
  const source: EstoqueMutationDependencies = {
    operate: async () => assert.fail('RPC não deve ser chamada'),
  };
  const validReceive = {
    ...context,
    itemId: ITEM_ID,
    versaoEsperada: 1,
    quantidadeBase: '10',
    novoLote: { codigoFabricante: 'LX-12', validadeISO: '2000-01-01' },
  };

  for (const input of [
    null,
    { ...validReceive, atorUsuarioId: MEMBRO_ID },
    validReceive,
    { ...validReceive, aceitarVencido: true },
    { ...validReceive, motivoVencido: 'Lote usado para descarte imediato' },
  ]) {
    const result = await receberMaterial(input, source);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.codigo, 'INVALIDO');
  }
});

test('recebimento vencido explícito encaminha confirmação e motivo sem dados implícitos', async () => {
  const result = await receberMaterial({
    ...context,
    itemId: ITEM_ID,
    versaoEsperada: 1,
    quantidadeBase: '10',
    novoLote: { codigoFabricante: 'LX-12', validadeISO: '2000-01-01' },
    aceitarVencido: true,
    motivoVencido: '  Conferido para descarte controlado  ',
  }, {
    async operate(payload) {
      assert.deepEqual(payload, {
        p_acao: 'receber',
        p_entrada: {
          ...context,
          itemId: ITEM_ID,
          versaoEsperada: 1,
          quantidadeBase: '10',
          novoLote: { codigoFabricante: 'LX-12', validadeISO: '2000-01-01' },
          aceitarVencido: true,
          motivoVencido: 'Conferido para descarte controlado',
        },
      });
      return {
        data: {
          ok: true,
          data: { itemId: ITEM_ID, loteId: LOTE_ID, movimentoId: MOVIMENTO_ID, saldo: '10', versao: 2 },
        },
        error: null,
      };
    },
  });

  assert.equal(result.ok, true);
});

test('listagem normaliza paginação e preserva saldo divergente assinado do DTO', async () => {
  const result = await listarEstoque({
    clinicaIdEsperada: CLINICA_ID.toUpperCase(),
    titular: { tipo: 'clinica' },
  }, {
    async query(payload) {
      assert.deepEqual(payload, {
        p_acao: 'listar',
        p_entrada: {
          clinicaIdEsperada: CLINICA_ID,
          titular: { tipo: 'clinica' },
          busca: '',
          filtro: 'todos',
          cursor: null,
          limite: 25,
        },
      });
      return { data: { ok: true, data: { itens: [item], proximoCursor: null, total: 1 } }, error: null };
    },
  });

  assert.deepEqual(result, { ok: true, data: { itens: [item], proximoCursor: null, total: 1 } });
});

test('detalhe rejeita cursor e resposta com decimal assinado inválido antes de expor dado', async () => {
  const invalidSource: EstoqueQueryDependencies = {
    query: async () => ({
      data: {
        ok: true,
        data: {
          item,
          lotes: [{ id: LOTE_ID, codigoFabricante: null, validadeISO: null, semIdentificacao: true, saldo: '98' }],
          movimentos: [{
            id: MOVIMENTO_ID,
            loteId: LOTE_ID,
            tipo: 'consumo',
            quantidade: '0',
            motivo: 'Uso clínico',
            ocorridoEm: '2026-09-12T12:00:00.000Z',
            atorUsuarioId: MEMBRO_ID,
            atorNome: 'Dra. Ana',
            reversaoDe: null,
            corrigido: false,
          }],
          proximoCursor: null,
        },
      },
      error: null,
    }),
  };

  const response = await detalharEstoque({ clinicaIdEsperada: CLINICA_ID, itemId: ITEM_ID }, invalidSource);
  assert.equal(response.ok, false);
  if (!response.ok) assert.equal(response.codigo, 'INDISPONIVEL');

  const invalidInput = await detalharEstoque({
    clinicaIdEsperada: CLINICA_ID,
    itemId: ITEM_ID,
    cursor: { ocorridoEm: '2026-09-12', id: MOVIMENTO_ID },
  }, {
    query: async () => assert.fail('RPC não deve ser chamada'),
  });
  assert.equal(invalidInput.ok, false);
  if (!invalidInput.ok) assert.equal(invalidInput.codigo, 'INVALIDO');
});

test('falhas de rede, resposta extra e mensagens remotas nunca autorizam operação', async () => {
  const sources: EstoqueMutationDependencies[] = [
    { operate: async () => ({ data: { ok: true, data: { itemId: ITEM_ID, versao: 1, extra: true } }, error: null }) },
    { operate: async () => ({ data: { ok: true, data: { itemId: ITEM_ID, versao: 1 } }, error: { message: 'segredo de rede' } }) },
    { operate: async () => { throw new Error('credencial privada'); } },
  ];
  const input = {
    ...context,
    titular: { tipo: 'clinica' },
    nome: 'Luva',
    unidadeBase: 'unidade',
    comportamento: 'consumivel',
    controlaLote: false,
    minimo: '0',
  };

  for (const source of sources) {
    const result = await cadastrarItem(input, source);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.codigo, 'INDISPONIVEL');
      assert.ok(!/segredo|privada/.test(result.mensagem));
    }
  }
});
