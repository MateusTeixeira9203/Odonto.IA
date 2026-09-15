import assert from 'node:assert/strict';
import test from 'node:test';
import { agendarPendenciaComoSecretaria, mesmoInstante, podeProsseguirLeituraAgenda, resolverCartaoParaAgenda, type AgendarPendenciaBridgeDependencies, type AgendarPendenciaInput } from './pendencias-bridge.ts';
import type { PendenciaCard } from '@/server/pendencias/contracts';

const input: AgendarPendenciaInput = {
  clinicaIdEsperada: '11111111-1111-4111-8111-111111111111',
  pendenciaId: '22222222-2222-4222-8222-222222222222',
  versaoEsperada: 4,
  dataHora: '2026-09-15T19:00:00.000Z',
  duracaoMinutos: 30,
};

const card: PendenciaCard = {
  id: input.pendenciaId,
  tipo: 'reativar_paciente',
  status: 'esperando_resposta',
  pacienteId: '33333333-3333-4333-8333-333333333333',
  pacienteNome: 'Ana Souza',
  temTelefone: true,
  dentistaId: '44444444-4444-4444-8444-444444444444',
  dentistaNome: 'Dra. Joana',
  agendamentoId: null,
  dataHora: null,
  duracaoMinutos: null,
  ultimaVisitaEm: '2026-08-01',
  responsavelUsuarioId: '55555555-5555-4555-8555-555555555555',
  envioConfirmado: true,
  adiadoAte: null,
  resolucao: null,
  versao: input.versaoEsperada,
  mensagem: 'Olá, Ana.',
  capabilities: {
    podeVerContato: true,
    podeAbrirWhatsApp: true,
    podeGerirAcompanhamento: true,
    podeRegistrarEnvio: true,
    podeConfirmarAgenda: false,
    podeCancelarAgenda: false,
    podeConcluirAgendamento: true,
  },
};

test('ponte de agenda aceita somente o cartão atual com agenda.editar', () => {
  assert.deepEqual(resolverCartaoParaAgenda(input, card), { ok: true, data: card });
  const denied = resolverCartaoParaAgenda(input, { ...card, capabilities: { ...card.capabilities, podeConcluirAgendamento: false } });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.codigo, 'SEM_ACESSO');
});

test('ponte de agenda fecha por CAS e estado antes da mutação legada', () => {
  for (const invalid of [{ ...card, versao: 5 }, { ...card, status: 'a_contatar' as const }, { ...card, envioConfirmado: false }]) {
    const result = resolverCartaoParaAgenda(input, invalid);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.codigo, 'CONFLITO');
  }
});

test('CAS de data compara o instante, não a apresentação ISO', () => {
  assert.equal(mesmoInstante('2026-09-15T19:00:00.000Z', '2026-09-15T16:00:00-03:00'), true);
  assert.equal(mesmoInstante('2026-09-15T19:00:00.000Z', '2026-09-15T19:30:00.000Z'), false);
  assert.equal(mesmoInstante(null, '2026-09-15T19:00:00.000Z'), false);
});

test('leituras de agenda falham fechadas antes de qualquer mutação', () => {
  assert.equal(podeProsseguirLeituraAgenda({ agendaError: false, bloqueiosError: false, agendamentosError: false, expedienteIndisponivel: false }), true);
  for (const failure of [
    { agendaError: true, bloqueiosError: false, agendamentosError: false, expedienteIndisponivel: false },
    { agendaError: false, bloqueiosError: true, agendamentosError: false, expedienteIndisponivel: false },
    { agendaError: false, bloqueiosError: false, agendamentosError: true, expedienteIndisponivel: false },
    { agendaError: false, bloqueiosError: false, agendamentosError: false, expedienteIndisponivel: true },
  ]) assert.equal(podeProsseguirLeituraAgenda(failure), false);
});

test('adapter da secretária revalida R159 e não toca no banco quando o cartão não permite agenda.editar', async () => {
  let requiredUser = false;
  const dependencies: AgendarPendenciaBridgeDependencies = {
    getMember: async () => ({ ok: true, data: { usuarioId: '66666666-6666-4666-8666-666666666666', email: null, clinicaId: input.clinicaIdEsperada, membroId: '77777777-7777-4777-8777-777777777777', role: 'secretaria', perfilClinico: null } }),
    listar: async () => ({ ok: true, data: { clinicaId: input.clinicaIdEsperada, clinicaNome: 'Clínica Central', items: [{ ...card, capabilities: { ...card.capabilities, podeConcluirAgendamento: false } }], modelos: [] } }),
    requireUser: async () => { requiredUser = true; return assert.fail('não deve abrir cliente autenticado sem agenda.editar'); },
  };
  const result = await agendarPendenciaComoSecretaria(input, dependencies);
  assert.equal(result.handled, true);
  if (result.handled) {
    assert.equal(result.result.ok, false);
    if (!result.result.ok) assert.equal(result.result.codigo, 'SEM_ACESSO');
  }
  assert.equal(requiredUser, false);
});
