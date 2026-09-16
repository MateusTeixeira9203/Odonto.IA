import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getMemberAccessEditor,
  saveMemberAccessEditor,
  type GetMemberAccessEditorDependencies,
} from './member-access-editor.ts';

const clinicaId = '11111111-1111-4111-8111-111111111111';
const membroId = '22222222-2222-4222-8222-222222222222';
const chaveIdempotencia = '33333333-3333-4333-8333-333333333333';
const detail = {
  ok: true,
  data: {
    clinicaId,
    membroId,
    versao: 1,
    acessos: [{ permissao: 'agenda.ler', escopo: { tipo: 'clinica' } }],
  },
};

test('consulta somente a configuração do membro e normaliza UUIDs', async () => {
  const dependencies: GetMemberAccessEditorDependencies = {
    async get(input) {
      assert.deepEqual(input, { p_clinica_id: clinicaId, p_membro_id: membroId });
      return { data: detail, error: null };
    },
  };
  assert.deepEqual(await getMemberAccessEditor({
    clinicaIdEsperada: clinicaId.toUpperCase(),
    membroId: membroId.toUpperCase(),
  }, dependencies), detail);
});

test('não consulta com identidade, capacidade ou UUID adulterados', async () => {
  const dependencies: GetMemberAccessEditorDependencies = {
    async get() { assert.fail('a RPC não deve ser chamada'); },
  };
  for (const input of [
    null,
    {},
    { clinicaIdEsperada: clinicaId },
    { clinicaIdEsperada: clinicaId, membroId, atorId: membroId },
    { clinicaIdEsperada: 'fora', membroId },
  ]) {
    const result = await getMemberAccessEditor(input, dependencies);
    assert.deepEqual(result, {
      ok: false,
      codigo: 'NAO_ENCONTRADO',
      mensagem: 'A configuração desta pessoa não está disponível.',
    });
  }
});

test('retorno remoto estranho ou de outra clínica nunca abre o editor', async () => {
  const sources: GetMemberAccessEditorDependencies[] = [
    { async get() { return { data: null, error: null }; } },
    { async get() { return { data: { ...detail, dadosClinicos: [] }, error: null }; } },
    { async get() { return { data: { ...detail, data: { ...detail.data, clinicaId: membroId } }, error: null }; } },
    { async get() { return { data: detail, error: { message: 'segredo remoto' } }; } },
    { async get() { throw new Error('segredo remoto'); } },
  ];
  for (const source of sources) {
    const result = await getMemberAccessEditor({ clinicaIdEsperada: clinicaId, membroId }, source);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(!result.mensagem.includes('segredo'));
  }
});

test('preserva a falha de piloto sem expor a mensagem remota', async () => {
  const result = await getMemberAccessEditor({ clinicaIdEsperada: clinicaId, membroId }, {
    async get() {
      return { data: { ok: false, codigo: 'NAO_SUPORTADO', mensagem: 'detalhe interno' }, error: null };
    },
  });
  assert.deepEqual(result, {
    ok: false,
    codigo: 'NAO_SUPORTADO',
    mensagem: 'Esta pessoa tem permissões fora do piloto atual.',
  });
});

test('recusa concessões sem dependência antes de chamar a RPC', async () => {
  const input = {
    clinicaIdEsperada: clinicaId,
    membroId,
    versaoEsperada: 1,
    acessos: [{ permissao: 'recebimentos.registrar', escopo: { tipo: 'clinica' } }],
    motivo: 'Início da recepção',
    chaveIdempotencia,
  };
  const result = await saveMemberAccessEditor(input, {
    async prepare() { assert.fail('a RPC não deve ser chamada'); },
  });
  assert.deepEqual(result, {
    ok: false,
    codigo: 'INVALIDO',
    mensagem: 'Revise as permissões antes de salvar.',
  });
});

test('exige leitura para gerir acompanhamentos antes de chamar a RPC', async () => {
  const input = {
    clinicaIdEsperada: clinicaId,
    membroId,
    versaoEsperada: 1,
    acessos: [{ permissao: 'acompanhamentos.gerir', escopo: { tipo: 'clinica' } }],
    motivo: 'Organização da fila',
    chaveIdempotencia,
  };
  const result = await saveMemberAccessEditor(input, {
    async prepare() { assert.fail('a RPC não deve ser chamada'); },
  });
  assert.deepEqual(result, {
    ok: false,
    codigo: 'INVALIDO',
    mensagem: 'Revise as permissões antes de salvar.',
  });
});

test('aceita leitura e gestão de acompanhamentos', async () => {
  const acessos = [
    { permissao: 'acompanhamentos.ler' as const, escopo: { tipo: 'clinica' as const } },
    { permissao: 'acompanhamentos.gerir' as const, escopo: { tipo: 'clinica' as const } },
  ];
  const result = await saveMemberAccessEditor({
    clinicaIdEsperada: clinicaId, membroId, versaoEsperada: 1, acessos,
    motivo: 'Organização da fila', chaveIdempotencia,
  }, {
    async prepare() { return { data: { ok: true, data: { versao: 2 } }, error: null }; },
  });
  assert.deepEqual(result, { ok: true, data: { versao: 2 } });
});

test('aceita orçamento e WhatsApp como capacidades independentes', async () => {
  const acessos = [
    { permissao: 'orcamentos.ler' as const, escopo: { tipo: 'clinica' as const } },
    { permissao: 'contatos.whatsapp' as const, escopo: { tipo: 'clinica' as const } },
  ];
  const result = await saveMemberAccessEditor({
    clinicaIdEsperada: clinicaId, membroId, versaoEsperada: 1, acessos,
    motivo: 'Acompanhamento de pendências', chaveIdempotencia,
  }, {
    async prepare() { return { data: { ok: true, data: { versao: 2 } }, error: null }; },
  });
  assert.deepEqual(result, { ok: true, data: { versao: 2 } });
});

test('encaminha somente a matriz efetiva com versão e chave idempotente', async () => {
  const acessos = [
    { permissao: 'cobrancas.ler' as const, escopo: { tipo: 'clinica' as const } },
    { permissao: 'recebimentos.registrar' as const, escopo: { tipo: 'clinica' as const } },
  ];
  const result = await saveMemberAccessEditor({
    clinicaIdEsperada: clinicaId,
    membroId,
    versaoEsperada: 1,
    acessos,
    motivo: '  Início da recepção  ',
    chaveIdempotencia,
  }, {
    async prepare(payload) {
      assert.deepEqual(payload, {
        p_clinica_id: clinicaId,
        p_membro_id: membroId,
        p_versao_esperada: 1,
        p_acessos: acessos,
        p_motivo: 'Início da recepção',
        p_chave_idempotencia: chaveIdempotencia,
      });
      return { data: { ok: true, data: { versao: 2 } }, error: null };
    },
  });
  assert.deepEqual(result, { ok: true, data: { versao: 2 } });
});
