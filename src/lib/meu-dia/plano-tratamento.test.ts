import assert from 'node:assert/strict';
import test from 'node:test';
import type { MeuDiaPendencia } from '@/server/dashboard/get-meu-dia';
import { projetarPlanoTratamento } from './plano-tratamento';

const EU = 'dentista-eu';

function pendencia(id: string, overrides: Partial<MeuDiaPendencia> = {}): MeuDiaPendencia {
  return {
    id,
    tipo: 'restauracao',
    procedimentoId: null,
    procedimentoNome: `Procedimento ${id}`,
    dente: 36,
    arcada: null,
    quadrante: null,
    registradoEm: '2026-09-04T10:00:00.000Z',
    dentistaNome: 'Dra. Camila',
    nivel: 'dente',
    origem: 'clinica',
    momentoPlanejado: 'sessao_atual',
    faces: [],
    grupoId: null,
    papelNoGrupo: null,
    observacao: null,
    emAndamento: false,
    dentistaId: EU,
    encaminhadoParaId: null,
    encaminhadoParaNome: null,
    ...overrides,
  };
}

function projetar(pendencias: MeuDiaPendencia[], extras: Partial<Parameters<typeof projetarPlanoTratamento>[0]> = {}) {
  return projetarPlanoTratamento({
    pendencias,
    meuDentistaId: EU,
    idsEmRevisao: new Set(),
    momentosOtimistas: new Map(),
    idsConcluidosOtimistas: new Set(),
    ...extras,
  });
}

test('projeta a matriz de autoria sem esconder pendências clínicas', () => {
  const plano = projetar([
    pendencia('minha'),
    pendencia('recebida', { dentistaId: 'dr-rui', dentistaNome: 'Dr. Rui', encaminhadoParaId: EU, encaminhadoParaNome: 'Dra. Camila' }),
    pendencia('encaminhada', { encaminhadoParaId: 'dra-ana', encaminhadoParaNome: 'Dra. Ana' }),
    pendencia('colega', { dentistaId: 'dr-paulo', dentistaNome: 'Dr. Paulo' }),
  ]);

  assert.deepEqual(plano.minhaFila.map((item) => item.pendencia.id), ['minha']);
  assert.deepEqual(plano.recebidas.map((item) => item.pendencia.id), ['recebida']);
  assert.deepEqual(plano.acompanhadas.map((item) => item.pendencia.id), ['encaminhada', 'colega']);
  assert.equal(plano.recebidas[0].permissoes.concluirEncaminhada, true);
  assert.deepEqual(plano.acompanhadas[0].permissoes, {
    alterarMomento: false, registrarHoje: false, concluirEncaminhada: false, encaminhar: false,
  });
});

test('preserva IDs distintos iguais na âncora e soma as três seções', () => {
  const plano = projetar([pendencia('A'), pendencia('B')]);
  assert.deepEqual(plano.minhaFila.map((item) => item.pendencia.id), ['A', 'B']);
  assert.equal(plano.total, 2);
});

test('oculta somente IDs em revisão ou concluídos otimisticamente', () => {
  const plano = projetar([pendencia('revisao'), pendencia('concluida'), pendencia('visivel')], {
    idsEmRevisao: new Set(['revisao']),
    idsConcluidosOtimistas: new Set(['concluida']),
  });
  assert.deepEqual(plano.minhaFila.map((item) => item.pendencia.id), ['visivel']);
  assert.equal(plano.total, 1);
});

test('aplica override otimista e reposiciona Próxima sessão sem mudar a base', () => {
  const plano = projetar([
    pendencia('A', { momentoPlanejado: 'sessao_atual' }),
    pendencia('B', { momentoPlanejado: 'proxima_sessao' }),
  ], { momentosOtimistas: new Map([['A', 'proxima_sessao']]) });
  assert.deepEqual(plano.minhaFila.map((item) => item.pendencia.id), ['A', 'B']);
  assert.equal(plano.minhaFila[0].momentoEfetivo, 'proxima_sessao');
});
