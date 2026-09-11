import assert from 'node:assert/strict';
import test from 'node:test';
import {
  prepareMemberAccess,
  type PrepareMemberAccessDependencies,
} from './prepare-member-access';

const input = {
  clinicaIdEsperada: '9ee9603b-9dd8-45da-8435-74fbf2bf45cd',
  membroId: 'aa455915-833d-4988-8318-0630802fcf5b',
  versaoEsperada: 1,
  acessos: [{ permissao: 'agenda.ler', escopo: { tipo: 'clinica' } }],
  motivo: 'Conferência da recepção',
  chaveIdempotencia: 'e58a3871-2751-482d-928b-920973d67da6',
};

test('encaminha somente payload normalizado, preservando a chave para retry', async () => {
  let calls = 0;
  const result = await prepareMemberAccess({
    ...input,
    clinicaIdEsperada: input.clinicaIdEsperada.toUpperCase(),
    motivo: `  ${input.motivo}  `,
  }, {
    async prepare(payload) {
      calls++;
      assert.deepEqual(payload, {
        p_clinica_id: input.clinicaIdEsperada,
        p_membro_id: input.membroId,
        p_versao_esperada: 1,
        p_acessos: input.acessos,
        p_motivo: input.motivo,
        p_chave_idempotencia: input.chaveIdempotencia,
      });
      return { data: { ok: true, data: { versao: 2 } }, error: null };
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: true, data: { versao: 2 } });
});

test('nega payload adulterado antes de chamar a RPC', async () => {
  const invalidInputs: unknown[] = [
    null, {}, { ...input, atorUsuarioId: input.membroId },
    { ...input, tetoDelegacao: input.acessos },
    { ...input, versaoEsperada: 0 }, { ...input, versaoEsperada: 1.5 },
    { ...input, versaoEsperada: 2_147_483_648 },
    { ...input, motivo: ' ' }, { ...input, motivo: 'a'.repeat(501) },
    { ...input, clinicaIdEsperada: 'outra-clinica' },
    { ...input, acessos: [...input.acessos, ...input.acessos] },
    { ...input, acessos: [{ permissao: 'admin.total', escopo: { tipo: 'clinica' } }] },
    { ...input, acessos: [{ permissao: 'clinico.registrar', escopo: { tipo: 'clinica' } }] },
    { ...input, acessos: [{ permissao: 'agenda.ler', escopo: { tipo: 'selecionados', dentistaIds: [] } }] },
  ];
  for (const invalid of invalidInputs) {
    const result = await prepareMemberAccess(invalid, {
      prepare: async () => { assert.fail('RPC não deve ser chamada'); },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.codigo, 'INVALIDO');
  }
});

test('configuração vazia continua válida; não acrescenta concessão implícita', async () => {
  const result = await prepareMemberAccess({ ...input, acessos: [] }, {
    async prepare(payload) {
      assert.deepEqual(payload.p_acessos, []);
      return { data: { ok: true, data: { versao: 2 } }, error: null };
    },
  });
  assert.equal(result.ok, true);
});

test('preserva falhas de negócio sem propagar mensagem interna remota', async () => {
  for (const codigo of ['INVALIDO', 'SEM_ACESSO', 'NAO_ENCONTRADO', 'CONFLITO', 'CONTEXTO_ALTERADO', 'INDISPONIVEL']) {
    const result = await prepareMemberAccess(input, {
      prepare: async () => ({ data: { ok: false, codigo, mensagem: 'detalhe interno privado' }, error: null }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.codigo, codigo);
      assert.ok(!result.mensagem.includes('privado'));
    }
  }
});

test('resposta quebrada ou erro técnico nunca se transforma em autorização', async () => {
  const sources: PrepareMemberAccessDependencies[] = [
    { prepare: async () => ({ data: null, error: null }) },
    { prepare: async () => ({ data: { ok: true, data: { versao: -1 } }, error: null }) },
    { prepare: async () => ({ data: { ok: true, data: { versao: 2 }, permissoes: ['tudo'] }, error: null }) },
    { prepare: async () => ({ data: { ok: false, codigo: 'DESCONHECIDO', mensagem: 'falhou' }, error: null }) },
    { prepare: async () => ({ data: { ok: true, data: { versao: 2 } }, error: { message: 'dados privados' } }) },
    { prepare: async () => { throw new Error('credencial privada'); } },
  ];
  for (const source of sources) {
    const result = await prepareMemberAccess(input, source);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.codigo, 'INDISPONIVEL');
      assert.ok(!/privad/.test(result.mensagem));
    }
  }
});
