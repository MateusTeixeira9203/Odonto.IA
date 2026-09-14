import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adicionarProcedimentosFichaSchema,
  montarPayloadAdicionarProcedimentos,
} from './adicionar-procedimentos';

const ids = {
  ficha: '11111111-1111-4111-8111-111111111111',
  paciente: '22222222-2222-4222-8222-222222222222',
  captura: '33333333-3333-4333-8333-333333333333',
  evento: '44444444-4444-4444-8444-444444444444',
  clinica: '55555555-5555-4555-8555-555555555555',
  dentista: '66666666-6666-4666-8666-666666666666',
};

function input() {
  return {
    fichaId: ids.ficha,
    pacienteId: ids.paciente,
    capturaId: ids.captura,
    eventos: [{
      id: ids.evento,
      tipo: 'carie_restauracao' as const,
      procedimentoId: null,
      procedimentoNome: 'Restauração em resina',
      status: 'indicado' as const,
      origem: 'clinica' as const,
      momento_planejado: 'proxima_sessao' as const,
      ancora: { nivel: 'face' as const, dente: 16, faces: ['O' as const] },
      grupo_id: null,
      papel_no_grupo: null,
      observacao: 'Monitorar sensibilidade',
      detalhe: null,
      realizado_em: null,
      encaminhadoParaId: null,
    }],
  };
}

test('monta o payload da adição com contexto apenas do servidor e identidade preservada', () => {
  const parsed = adicionarProcedimentosFichaSchema.parse(input());
  const [evento] = montarPayloadAdicionarProcedimentos(parsed.eventos, {
    clinicId: ids.clinica,
    pacienteId: ids.paciente,
    dentistaId: ids.dentista,
    fichaId: ids.ficha,
  });

  assert.deepEqual(evento, {
    id: ids.evento,
    clinica_id: ids.clinica,
    paciente_id: ids.paciente,
    dentista_id: ids.dentista,
    ficha_id: ids.ficha,
    grupo_id: null,
    tipo: 'carie_restauracao',
    procedimento_id: null,
    procedimento_nome: 'Restauração em resina',
    status: 'indicado',
    origem: 'clinica',
    momento_planejado: 'proxima_sessao',
    nivel: 'face',
    arcada: null,
    quadrante: null,
    dente: 16,
    faces: ['O'],
    papel_no_grupo: null,
    encaminhado_para: null,
    observacao: 'Monitorar sensibilidade',
    detalhe: null,
    realizado_em: null,
  });
});

test('rejeita ids repetidos e procedimento livre sem conteúdo clínico', () => {
  const repetido = input();
  repetido.eventos.push({ ...repetido.eventos[0], id: ids.evento });
  assert.equal(adicionarProcedimentosFichaSchema.safeParse(repetido).success, false);

  const semNome = input();
  semNome.eventos[0] = {
    ...semNome.eventos[0],
    tipo: 'outro',
    procedimentoNome: null,
    observacao: '',
  };
  assert.equal(adicionarProcedimentosFichaSchema.safeParse(semNome).success, false);
});
