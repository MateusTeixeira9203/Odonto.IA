import assert from 'node:assert/strict';
import test from 'node:test';
import { criarPacienteEAgendamentoRecepcao } from './reception-actions.ts';

const clinicaId = '11111111-1111-4111-8111-111111111111';
const dentistaId = '22222222-2222-4222-8222-222222222222';
const pacienteId = '33333333-3333-4333-8333-333333333333';
const agendamentoId = '44444444-4444-4444-8444-444444444444';

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    async reception() {
      return {
        ok: true as const,
        data: { usuarioId: 'u', membroId: 'm', clinicaId, nome: 'Recepção', clinicaNome: 'Clínica' },
      };
    },
    async execute() {
      return { data: { ok: true, pacienteId, agendamentoId }, error: null };
    },
    async executeExisting() {
      return { data: { ok: true, agendamentoId }, error: null };
    },
    ...overrides,
  };
}

const input = {
  dentistaId,
  nome: 'Paciente novo',
  telefone: null,
  dataHora: '2026-09-16T13:30:00-03:00',
  duracaoMinutos: 30,
  observacoes: null,
};

test('action de recepção envia a clínica resolvida à RPC atômica', async () => {
  let payload: unknown;
  const result = await criarPacienteEAgendamentoRecepcao(input, dependencies({
    async execute(value: unknown) {
      payload = value;
      return { data: { ok: true, pacienteId, agendamentoId }, error: null };
    },
  }));

  assert.deepEqual(result, { ok: true, pacienteId, agendamentoId });
  assert.deepEqual(payload, {
    p_clinica_id: clinicaId,
    p_dentista_id: dentistaId,
    p_nome: 'Paciente novo',
    p_telefone: null,
    p_data_hora: '2026-09-16T13:30:00-03:00',
    p_duracao_minutos: 30,
    p_observacoes: null,
  });
});

test('action falha fechada sem recepção ou resposta válida da RPC', async () => {
  const denied = await criarPacienteEAgendamentoRecepcao(input, dependencies({
    async reception() { return { ok: false as const, codigo: 'SEM_ACESSO' as const, mensagem: 'negado' }; },
  }));
  assert.equal(denied.ok, false);

  const invalid = await criarPacienteEAgendamentoRecepcao(input, dependencies({
    async execute() { return { data: { ok: true, pacienteId: 'not-uuid' }, error: null }; },
  }));
  assert.equal(invalid.ok, false);
});
