import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configureStockAccess,
  getStockAccessContext,
  type ConfigureStockAccessDependencies,
  type GetStockAccessContextDependencies,
} from './access.ts';

const CLINICA_ID = '11111111-1111-4111-8111-111111111111';
const MEMBRO_ID = '22222222-2222-4222-8222-222222222222';
const DENTISTA_ID = '33333333-3333-4333-8333-333333333333';
const CHAVE_IDEMPOTENCIA = '44444444-4444-4444-8444-444444444444';

const contextInput = { clinicaIdEsperada: CLINICA_ID };
const configureInput = {
  clinicaIdEsperada: CLINICA_ID,
  membroId: MEMBRO_ID,
  versaoEsperada: 1,
  acessos: [
    { permissao: 'estoque.ler', escopo: { tipo: 'clinica' } },
    { permissao: 'estoque.receber', escopo: { tipo: 'clinica' } },
  ],
  motivo: 'Conferência de recebimento da recepção',
  chaveIdempotencia: CHAVE_IDEMPOTENCIA,
};

const contextData = {
  clinicaId: CLINICA_ID,
  membroId: MEMBRO_ID,
  modelo: 'colaborativa' as const,
  dentistaId: DENTISTA_ID,
  permissoesPessoais: ['estoque.ler', 'estoque.gerir'],
  permissoesCompartilhadas: ['estoque.ler', 'estoque.receber'],
  podeGerenciarCompartilhado: true,
};

test('consulta encaminha somente clínica normalizada e retorna o contexto estrito', async () => {
  let calls = 0;
  const result = await getStockAccessContext({ clinicaIdEsperada: CLINICA_ID.toUpperCase() }, {
    async getContext(payload) {
      calls++;
      assert.deepEqual(payload, { p_clinica_id_esperada: CLINICA_ID });
      return { data: { ok: true, data: contextData }, error: null };
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: true, data: contextData });
});

test('consulta inválida não chama a RPC', async () => {
  const source: GetStockAccessContextDependencies = {
    getContext: async () => assert.fail('RPC não deve ser chamada'),
  };

  for (const input of [null, {}, { clinicaIdEsperada: 'clínica' }, {
    ...contextInput,
    membroId: MEMBRO_ID,
  }]) {
    const result = await getStockAccessContext(input, source);
    assert.deepEqual(result, {
      ok: false,
      codigo: 'INVALIDO',
      mensagem: 'Revise os dados do estoque antes de salvar.',
    });
  }
});

test('configuração encaminha o payload público normalizado, inclusive a revogação vazia', async () => {
  const result = await configureStockAccess({
    ...configureInput,
    clinicaIdEsperada: CLINICA_ID.toUpperCase(),
    membroId: MEMBRO_ID.toUpperCase(),
    chaveIdempotencia: CHAVE_IDEMPOTENCIA.toUpperCase(),
    acessos: [],
    motivo: `  ${configureInput.motivo}  `,
  }, {
    async configure(payload) {
      assert.deepEqual(payload, {
        p_clinica_id: CLINICA_ID,
        p_membro_id: MEMBRO_ID,
        p_versao_esperada: 1,
        p_acessos: [],
        p_motivo: configureInput.motivo,
        p_chave_idempotencia: CHAVE_IDEMPOTENCIA,
      });
      return { data: { ok: true, data: { versao: 2 } }, error: null };
    },
  });

  assert.deepEqual(result, { ok: true, data: { versao: 2 } });
});

test('configuração rejeita permissões pessoais, outros módulos e mutação sem leitura antes da RPC', async () => {
  const source: ConfigureStockAccessDependencies = {
    configure: async () => assert.fail('RPC não deve ser chamada'),
  };
  const invalidInputs: unknown[] = [
    null,
    {},
    { ...configureInput, atorUsuarioId: MEMBRO_ID },
    { ...configureInput, versaoEsperada: 0 },
    { ...configureInput, motivo: ' ' },
    { ...configureInput, acessos: [{ permissao: 'estoque.ler', escopo: { tipo: 'proprio' } }] },
    { ...configureInput, acessos: [{ permissao: 'estoque.ler', escopo: { tipo: 'selecionados', dentistaIds: [DENTISTA_ID] } }] },
    { ...configureInput, acessos: [{ permissao: 'agenda.ler', escopo: { tipo: 'clinica' } }] },
    { ...configureInput, acessos: [{ permissao: 'kits.gerir', escopo: { tipo: 'clinica' } }] },
    { ...configureInput, acessos: [{ permissao: 'estoque.gerir', escopo: { tipo: 'clinica' } }] },
    {
      ...configureInput,
      acessos: [
        { permissao: 'estoque.ler', escopo: { tipo: 'clinica' } },
        { permissao: 'estoque.ler', escopo: { tipo: 'clinica' } },
      ],
    },
  ];

  for (const input of invalidInputs) {
    const result = await configureStockAccess(input, source);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.codigo, 'INVALIDO');
  }
});

test('falhas da RPC mantêm apenas códigos e mensagens públicas', async () => {
  for (const codigo of ['INVALIDO', 'SEM_ACESSO', 'NAO_ENCONTRADO', 'CONFLITO', 'CONTEXTO_ALTERADO', 'INDISPONIVEL']) {
    const result = await configureStockAccess(configureInput, {
      configure: async () => ({
        data: { ok: false, codigo, mensagem: 'detalhe interno confidencial' },
        error: null,
      }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.codigo, codigo);
      assert.ok(!result.mensagem.includes('confidencial'));
    }
  }
});

test('respostas quebradas e falhas de rede fecham o contexto e a configuração', async () => {
  const contextSources: GetStockAccessContextDependencies[] = [
    { getContext: async () => ({ data: null, error: null }) },
    { getContext: async () => ({ data: { ok: true, data: { ...contextData, extra: true } }, error: null }) },
    { getContext: async () => ({ data: { ok: true, data: { ...contextData, permissoesPessoais: ['estoque.ler', 'estoque.ler'] } }, error: null }) },
    { getContext: async () => ({ data: { ok: true, data: contextData }, error: { message: 'segredo da rede' } }) },
    { getContext: async () => { throw new Error('segredo da conexão'); } },
  ];
  const configureSources: ConfigureStockAccessDependencies[] = [
    { configure: async () => ({ data: { ok: true, data: { versao: 0 } }, error: null }) },
    { configure: async () => ({ data: { ok: false, codigo: 'SALDO_INSUFICIENTE', mensagem: 'interno' }, error: null }) },
    { configure: async () => ({ data: { ok: true, data: { versao: 2 }, extra: true }, error: null }) },
    { configure: async () => ({ data: { ok: true, data: { versao: 2 } }, error: { message: 'segredo da rede' } }) },
    { configure: async () => { throw new Error('segredo da conexão'); } },
  ];

  for (const source of contextSources) {
    const result = await getStockAccessContext(contextInput, source);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.codigo, 'INDISPONIVEL');
      assert.ok(!/segredo/.test(result.mensagem));
    }
  }
  for (const source of configureSources) {
    const result = await configureStockAccess(configureInput, source);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.codigo, 'INDISPONIVEL');
      assert.ok(!/segredo/.test(result.mensagem));
    }
  }
});
