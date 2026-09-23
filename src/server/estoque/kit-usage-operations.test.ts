import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cadastrarKit,
  editarKit,
  confirmarUsos,
  declararUsos,
  listarUsosDaFicha,
  previsualizarConfirmacaoUsos,
  type KitUsageDependencies,
} from './kit-usage-operations.ts';

const ids = {
  clinica: '11111111-1111-4111-8111-111111111111',
  chave: '22222222-2222-4222-8222-222222222222',
  item: '33333333-3333-4333-8333-333333333333',
  kit: '44444444-4444-4444-8444-444444444444',
  versao: '55555555-5555-4555-8555-555555555555',
  atendimento: '66666666-6666-4666-8666-666666666666',
  uso: '77777777-7777-4777-8777-777777777777',
  movimento: '88888888-8888-4888-8888-888888888888',
  lote: '99999999-9999-4999-8999-999999999999',
  linha: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

const unusedDependencies: KitUsageDependencies = {
  operateKit: async () => assert.fail('RPC não deve ser chamada'),
  declareUsage: async () => assert.fail('RPC não deve ser chamada'),
  confirmUsage: async () => assert.fail('RPC não deve ser chamada'),
  correctUsage: async () => assert.fail('RPC não deve ser chamada'),
  listKits: async () => assert.fail('RPC não deve ser chamada'),
  listUsages: async () => assert.fail('RPC não deve ser chamada'),
  previewConfirmation: async () => assert.fail('RPC não deve ser chamada'),
};

test('cadastro normaliza o kit e encaminha somente o contrato da RPC', async () => {
  const result = await cadastrarKit({
    clinicaIdEsperada: ids.clinica.toUpperCase(),
    chaveIdempotencia: ids.chave.toUpperCase(),
    titular: { tipo: 'clinica' },
    nome: '  Kit restaurador  ',
    componentes: [{ itemId: ids.item.toUpperCase(), quantidadeBase: '2' }],
  }, {
    ...unusedDependencies,
    async operateKit(payload) {
      assert.deepEqual(payload, {
        p_acao: 'cadastrar',
        p_entrada: {
          clinicaIdEsperada: ids.clinica,
          chaveIdempotencia: ids.chave,
          titular: { tipo: 'clinica' },
          nome: 'Kit restaurador',
          componentes: [{ itemId: ids.item, quantidadeBase: '2' }],
        },
      });
      return { data: { ok: true, data: { kitId: ids.kit, kitVersaoId: ids.versao, versao: 1 } }, error: null };
    },
  });
  assert.deepEqual(result, { ok: true, data: { kitId: ids.kit, kitVersaoId: ids.versao, versao: 1 } });
});

test('edição encaminha CAS da versão e componentes revisados para a RPC', async () => {
  const result = await editarKit({
    clinicaIdEsperada: ids.clinica,
    chaveIdempotencia: ids.chave,
    kitId: ids.kit,
    versaoEsperada: 3,
    nome: ' Kit restaurador revisado ',
    componentes: [{ itemId: ids.item, quantidadeBase: '1.5' }],
  }, {
    ...unusedDependencies,
    async operateKit(payload) {
      assert.deepEqual(payload, {
        p_acao: 'editar',
        p_entrada: {
          clinicaIdEsperada: ids.clinica,
          chaveIdempotencia: ids.chave,
          kitId: ids.kit,
          versaoEsperada: 3,
          nome: 'Kit restaurador revisado',
          componentes: [{ itemId: ids.item, quantidadeBase: '1.5' }],
        },
      });
      return { data: { ok: true, data: { kitId: ids.kit, kitVersaoId: ids.versao, versao: 4 } }, error: null };
    },
  });
  assert.deepEqual(result, { ok: true, data: { kitId: ids.kit, kitVersaoId: ids.versao, versao: 4 } });
});

test('confirmação recusa divergência fora dos usos antes da RPC', async () => {
  const result = await confirmarUsos({
    clinicaIdEsperada: ids.clinica,
    chaveIdempotencia: ids.chave,
    atendimentoId: ids.atendimento,
    usoIds: [ids.uso],
    divergenciasAceitas: [{ usoId: ids.movimento, versaoItemEsperada: 1 }],
  }, unusedDependencies);
  assert.deepEqual(result, { ok: false, codigo: 'INVALIDO', mensagem: 'Revise os materiais antes de continuar.' });
});

test('prévia devolve somente os usos deficitários e versões atuais', async () => {
  const result = await previsualizarConfirmacaoUsos({
    clinicaIdEsperada: ids.clinica.toUpperCase(),
    atendimentoId: ids.atendimento.toUpperCase(),
    usoIds: [ids.uso.toUpperCase()],
  }, {
    ...unusedDependencies,
    async previewConfirmation(payload) {
      assert.deepEqual(payload, {
        p_entrada: { clinicaIdEsperada: ids.clinica, atendimentoId: ids.atendimento, usoIds: [ids.uso] },
      });
      return { data: { ok: true, data: { insuficientes: [{ usoId: ids.uso, versaoItemEsperada: 3 }] } }, error: null };
    },
  });
  assert.deepEqual(result, { ok: true, data: { insuficientes: [{ usoId: ids.uso, versaoItemEsperada: 3 }] } });
});

test('declaração devolve a identidade da linha, sem contrato implícito de ordenação', async () => {
  const result = await declararUsos({
    clinicaIdEsperada: ids.clinica,
    chaveIdempotencia: ids.chave,
    atendimentoId: ids.atendimento,
    linhas: [{ linhaOrigemId: ids.linha, itemId: ids.item, loteId: ids.lote, quantidade: '1', kitVersaoId: null }],
  }, {
    ...unusedDependencies,
    async declareUsage() {
      return { data: { ok: true, data: { usos: [{ usoId: ids.uso, linhaOrigemId: ids.linha, estado: 'pendente_autorizacao' }] } }, error: null };
    },
  });
  assert.deepEqual(result, { ok: true, data: { usos: [{ usoId: ids.uso, linhaOrigemId: ids.linha, estado: 'pendente_autorizacao' }] } });
});

test('leitura da ficha inclui o item e a versão do kit necessários para corrigir o uso auditado', async () => {
  const result = await listarUsosDaFicha({ clinicaIdEsperada: ids.clinica, atendimentoId: ids.atendimento }, {
    ...unusedDependencies,
    async listUsages() {
      return { data: { ok: true, data: { usos: [{ usoId: ids.uso, linhaOrigemId: ids.linha, revisao: 1, material: 'Resina', quantidade: '1', unidade: 'unidade', itemId: ids.item, loteId: ids.lote, kitVersaoId: null, estado: 'confirmado', movimentoId: ids.versao }] } }, error: null };
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.usos[0]?.itemId, ids.item);
});
