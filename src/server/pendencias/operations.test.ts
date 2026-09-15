import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listarPendencias,
  operarPendencia,
  salvarModelo,
  type PendenciasDependencies,
} from './operations.ts';

const CLINICA_ID = '11111111-1111-4111-8111-111111111111';
const PENDENCIA_ID = '22222222-2222-4222-8222-222222222222';
const PACIENTE_ID = '33333333-3333-4333-8333-333333333333';
const DENTISTA_ID = '44444444-4444-4444-8444-444444444444';
const RESPONSAVEL_ID = '55555555-5555-4555-8555-555555555555';
const AGENDAMENTO_ID = '66666666-6666-4666-8666-666666666666';

const card = {
  id: PENDENCIA_ID,
  tipo: 'confirmar_presenca' as const,
  status: 'a_contatar' as const,
  pacienteId: PACIENTE_ID,
  pacienteNome: 'Ana Souza',
  temTelefone: true,
  dentistaId: DENTISTA_ID,
  dentistaNome: 'Dra. Joana',
  agendamentoId: AGENDAMENTO_ID,
  dataHora: '2026-09-14T16:00:00.000Z',
  duracaoMinutos: 30,
  ultimaVisitaEm: null,
  responsavelUsuarioId: RESPONSAVEL_ID,
  envioConfirmado: false,
  adiadoAte: null,
  resolucao: null,
  versao: 1,
  mensagem: 'Olá, Ana.',
  capabilities: {
    podeVerContato: true,
    podeAbrirWhatsApp: true,
    podeGerirAcompanhamento: true,
    podeRegistrarEnvio: true,
    podeConfirmarAgenda: true,
    podeCancelarAgenda: true,
    podeConcluirAgendamento: false,
  },
};

const board = {
  clinicaId: CLINICA_ID,
  clinicaNome: 'Clínica Central',
  items: [card],
  modelos: [{
    dentistaId: DENTISTA_ID,
    dentistaNome: 'Dra. Joana',
    tipo: 'confirmar_presenca' as const,
    ativo: true,
    template: 'Olá, {paciente}',
    versao: 0,
    podeEditar: true,
  }],
};

test('listar encaminha somente a clínica normalizada e fecha resposta fora do contrato', async () => {
  const result = await listarPendencias({ clinicaIdEsperada: CLINICA_ID.toUpperCase() }, {
    async listar(input) {
      assert.deepEqual(input, { p_clinica_id_esperada: CLINICA_ID });
      return { data: { ok: true, data: board }, error: null };
    },
    operar: async () => assert.fail('não deve operar'),
    salvarModelo: async () => assert.fail('não deve salvar'),
  });
  assert.deepEqual(result, { ok: true, data: board });
});

test('preparar abertura exige texto avulso e encaminha apenas payload normalizado', async () => {
  const source: PendenciasDependencies = {
    listar: async () => assert.fail('não deve listar'),
    salvarModelo: async () => assert.fail('não deve salvar'),
    async operar(input) {
      assert.deepEqual(input, {
        p_acao: 'preparar_abertura',
        p_entrada: {
          acao: 'preparar_abertura',
          clinicaIdEsperada: CLINICA_ID,
          pendenciaId: PENDENCIA_ID,
          versaoEsperada: 1,
          mensagem: 'Olá, Ana.',
        },
      });
      return {
        data: {
          ok: true,
          data: {
            pendenciaId: PENDENCIA_ID,
            versao: 2,
            whatsappUrl: 'https://wa.me/5511999999999?text=Ol%C3%A1%2C%20Ana.',
            mensagem: 'Olá, Ana.',
            agendaSideEffect: null,
          },
        },
        error: null,
      };
    },
  };
  const invalid = await operarPendencia({
    acao: 'preparar_abertura', clinicaIdEsperada: CLINICA_ID, pendenciaId: PENDENCIA_ID, versaoEsperada: 1,
  }, source);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.codigo, 'INVALIDO');

  const result = await operarPendencia({
    acao: 'preparar_abertura', clinicaIdEsperada: CLINICA_ID.toUpperCase(), pendenciaId: PENDENCIA_ID.toUpperCase(),
    versaoEsperada: 1, mensagem: '  Olá, Ana.  ',
  }, source);
  assert.equal(result.ok, true);
});

test('aceita URL percent-encoded de uma mensagem válida no limite de caracteres', async () => {
  const longUrl = `https://wa.me/5511999999999?text=${'%F0%9F%98%80'.repeat(2_000)}`;
  const source: PendenciasDependencies = {
    listar: async () => assert.fail('não deve listar'),
    salvarModelo: async () => assert.fail('não deve salvar'),
    operar: async () => ({
      data: { ok: true, data: {
        pendenciaId: PENDENCIA_ID, versao: 2, whatsappUrl: longUrl, mensagem: 'x', agendaSideEffect: null,
      } },
      error: null,
    }),
  };
  const accepted = await operarPendencia({
    acao: 'preparar_abertura', clinicaIdEsperada: CLINICA_ID, pendenciaId: PENDENCIA_ID,
    versaoEsperada: 1, mensagem: 'x',
  }, source);
  assert.equal(accepted.ok, true);
  const rejected = await operarPendencia({
    acao: 'preparar_abertura', clinicaIdEsperada: CLINICA_ID, pendenciaId: PENDENCIA_ID,
    versaoEsperada: 1, mensagem: 'x'.repeat(2_001),
  }, source);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.codigo, 'INVALIDO');
});

test('encerrar não aceita resolução arbitrária e modelo aceita versão zero do fallback', async () => {
  const source: PendenciasDependencies = {
    listar: async () => assert.fail('não deve listar'),
    operar: async () => assert.fail('não deve operar'),
    async salvarModelo(input) {
      assert.deepEqual(input, {
        p_entrada: {
          clinicaIdEsperada: CLINICA_ID,
          dentistaId: DENTISTA_ID,
          tipo: 'reativar_paciente',
          ativo: false,
          template: 'Olá, {paciente}',
          versaoEsperada: 0,
        },
      });
      return {
        data: {
          ok: true,
          data: {
            dentistaId: DENTISTA_ID,
            dentistaNome: 'Dra. Joana',
            tipo: 'reativar_paciente',
            ativo: false,
            template: 'Olá, {paciente}',
            versao: 1,
            podeEditar: true,
          },
        },
        error: null,
      };
    },
  };
  const invalid = await operarPendencia({
    acao: 'resolver', clinicaIdEsperada: CLINICA_ID, pendenciaId: PENDENCIA_ID, versaoEsperada: 1, resolucao: 'confirmado',
  }, source);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.codigo, 'INVALIDO');
  const result = await salvarModelo({
    clinicaIdEsperada: CLINICA_ID.toUpperCase(), dentistaId: DENTISTA_ID.toUpperCase(), tipo: 'reativar_paciente',
    ativo: false, template: '  Olá, {paciente}  ', versaoEsperada: 0,
  }, source);
  assert.equal(result.ok, true);
});

test('erros remotos, cartões com telefone vazado e respostas extras fecham a operação', async () => {
  const sources: PendenciasDependencies[] = [
    {
      listar: async () => ({ data: { ok: true, data: { ...board, items: [{ ...card, telefone: '55119999' }] } }, error: null }),
      operar: async () => ({ data: { ok: false, codigo: 'SEM_ACESSO', mensagem: 'detalhe privado' }, error: null }),
      salvarModelo: async () => ({ data: null, error: { message: 'segredo' } }),
    },
    {
      listar: async () => { throw new Error('segredo'); },
      operar: async () => ({ data: { ok: true, data: { pendenciaId: PENDENCIA_ID, versao: 2, whatsappUrl: null, mensagem: null, agendaSideEffect: null, extra: true } }, error: null }),
      salvarModelo: async () => ({ data: null, error: null }),
    },
  ];
  for (const source of sources) {
    const listed = await listarPendencias({ clinicaIdEsperada: CLINICA_ID }, source);
    assert.equal(listed.ok, false);
    const operation = await operarPendencia({ acao: 'registrar_envio', clinicaIdEsperada: CLINICA_ID, pendenciaId: PENDENCIA_ID, versaoEsperada: 1 }, source);
    if (!operation.ok) assert.ok(!operation.mensagem.includes('privado'));
  }
});
